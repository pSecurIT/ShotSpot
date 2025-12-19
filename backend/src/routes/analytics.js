import express from 'express';
import { param, query, validationResult } from 'express-validator';
import db from '../db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

/**
 * Get shot heatmap data for a game
 * Returns shot location density in a grid format
 */
router.get('/shots/:gameId/heatmap', [
  param('gameId').isInt().withMessage('Game ID must be an integer'),
  query('club_id').optional().isInt().withMessage('Club ID must be an integer'),
  query('period').optional().isInt({ min: 1 }).withMessage('Period must be a positive integer'),
  query('grid_size').optional().isInt({ min: 5, max: 20 }).withMessage('Grid size must be between 5 and 20')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;
  const { club_id, period, grid_size = 10 } = req.query;

  try {
    // Build query with optional filters
    let queryText = `
      SELECT 
        FLOOR(x_coord / $1) * $1 as x_bucket,
        FLOOR(y_coord / $1) * $1 as y_bucket,
        COUNT(*) as shot_count,
        COUNT(CASE WHEN result = 'goal' THEN 1 END) as goals,
        COUNT(CASE WHEN result = 'miss' THEN 1 END) as misses,
        COUNT(CASE WHEN result = 'blocked' THEN 1 END) as blocked,
        ROUND(AVG(CASE WHEN result = 'goal' THEN 100.0 ELSE 0 END), 2) as success_rate
      FROM shots
      WHERE game_id = $2
    `;
    const queryParams = [100.0 / grid_size, gameId];
    let paramIndex = 3;

    if (club_id) {
      queryText += ` AND club_id = $${paramIndex}`;
      queryParams.push(club_id);
      paramIndex++;
    }

    if (period) {
      queryText += ` AND period = $${paramIndex}`;
      queryParams.push(period);
      paramIndex++;
    }

    queryText += ' GROUP BY x_bucket, y_bucket ORDER BY x_bucket, y_bucket';

    const result = await db.query(queryText, queryParams);

    res.json({
      grid_size: parseInt(grid_size),
      data: result.rows.map(row => ({
        x: parseFloat(row.x_bucket),
        y: parseFloat(row.y_bucket),
        count: parseInt(row.shot_count),
        goals: parseInt(row.goals),
        misses: parseInt(row.misses),
        blocked: parseInt(row.blocked),
        success_rate: parseFloat(row.success_rate)
      }))
    });
  } catch (err) {
    console.error('Error fetching heatmap data:', err);
    res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
});

/**
 * Get shot chart data for a game
 * Returns individual shot locations with results
 */
router.get('/shots/:gameId/shot-chart', [
  param('gameId').isInt().withMessage('Game ID must be an integer'),
  query('club_id').optional().isInt().withMessage('Club ID must be an integer'),
  query('period').optional().isInt({ min: 1 }).withMessage('Period must be a positive integer'),
  query('player_id').optional().isInt().withMessage('Player ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;
  const { club_id, period, player_id } = req.query;

  try {
    let queryText = `
      SELECT 
        s.id,
        s.x_coord,
        s.y_coord,
        s.result,
        s.period,
        s.shot_type,
        s.distance,
        s.time_remaining,
        p.first_name,
        p.last_name,
        p.jersey_number,
        c.name as club_name,
        s.club_id
      FROM shots s
      JOIN players p ON s.player_id = p.id
      JOIN clubs c ON s.club_id = c.id
      WHERE s.game_id = $1
    `;
    const queryParams = [gameId];
    let paramIndex = 2;

    if (club_id) {
      queryText += ` AND s.club_id = $${paramIndex}`;
      queryParams.push(club_id);
      paramIndex++;
    }

    if (period) {
      queryText += ` AND s.period = $${paramIndex}`;
      queryParams.push(period);
      paramIndex++;
    }

    if (player_id) {
      queryText += ` AND s.player_id = $${paramIndex}`;
      queryParams.push(player_id);
      paramIndex++;
    }

    queryText += ' ORDER BY s.created_at';

    const result = await db.query(queryText, queryParams);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching shot chart data:', err);
    res.status(500).json({ error: 'Failed to fetch shot chart data' });
  }
});

/**
 * Get player shot analytics
 * Returns detailed statistics for each player
 */
router.get('/shots/:gameId/players', [
  param('gameId').isInt().withMessage('Game ID must be an integer'),
  query('club_id').optional().isInt().withMessage('Club ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;
  const { club_id } = req.query;

  try {
    // First get all players who participated in the game (from game_rosters or shots)
    let playersQuery = `
      SELECT DISTINCT
        p.id as player_id,
        p.first_name,
        p.last_name,
        p.jersey_number,
        c.name as club_name,
        c.id as club_id,
        gr.is_starting
      FROM players p
      JOIN clubs c ON p.club_id = c.id
      LEFT JOIN game_rosters gr ON gr.player_id = p.id AND gr.game_id = $1
      WHERE (
        EXISTS (
          SELECT 1 FROM shots WHERE player_id = p.id AND game_id = $1
        ) OR gr.game_id = $1
      )
    `;
    const playersParams = [gameId];
    
    if (club_id) {
      playersQuery += ' AND c.id = $2';
      playersParams.push(club_id);
    }
    
    const playersResult = await db.query(playersQuery, playersParams);

    // Get shot statistics
    let shotsQuery = `
      SELECT 
        p.id as player_id,
        COUNT(*) as total_shots,
        COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals,
        COUNT(CASE WHEN s.result = 'miss' THEN 1 END) as misses,
        COUNT(CASE WHEN s.result = 'blocked' THEN 1 END) as blocked,
        ROUND(
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as field_goal_percentage,
        ROUND(AVG(s.distance), 2) as avg_distance,
        ROUND(AVG(s.x_coord), 2) as avg_x_coord,
        ROUND(AVG(s.y_coord), 2) as avg_y_coord,
        COUNT(CASE WHEN s.x_coord < 33.33 THEN 1 END) as left_zone_shots,
        COUNT(CASE WHEN s.x_coord >= 33.33 AND s.x_coord < 66.67 THEN 1 END) as center_zone_shots,
        COUNT(CASE WHEN s.x_coord >= 66.67 THEN 1 END) as right_zone_shots,
        COUNT(CASE WHEN s.x_coord < 33.33 AND s.result = 'goal' THEN 1 END) as left_zone_goals,
        COUNT(CASE WHEN s.x_coord >= 33.33 AND s.x_coord < 66.67 AND s.result = 'goal' THEN 1 END) as center_zone_goals,
        COUNT(CASE WHEN s.x_coord >= 66.67 AND s.result = 'goal' THEN 1 END) as right_zone_goals
      FROM shots s
      JOIN players p ON s.player_id = p.id
      WHERE s.game_id = $1
      GROUP BY p.id
    `;
    const shotsParams = [gameId];
    const shotsResult = await db.query(shotsQuery, shotsParams);

    // Get substitutions for play time calculation
    const subsQuery = `
      SELECT 
        player_in_id as player_id,
        period,
        EXTRACT(EPOCH FROM time_remaining) as time_remaining_seconds,
        'in' as type
      FROM substitutions
      WHERE game_id = $1
      UNION ALL
      SELECT 
        player_out_id as player_id,
        period,
        EXTRACT(EPOCH FROM time_remaining) as time_remaining_seconds,
        'out' as type
      FROM substitutions
      WHERE game_id = $1
      ORDER BY period, time_remaining_seconds DESC, type DESC
    `;
    const subsResult = await db.query(subsQuery, [gameId]);

    // Get game period configuration
    const gameConfigQuery = `
      SELECT EXTRACT(EPOCH FROM period_duration)/60 as period_duration_minutes, number_of_periods
      FROM games
      WHERE id = $1
    `;
    const gameConfigResult = await db.query(gameConfigQuery, [gameId]);
    const periodDuration = gameConfigResult.rows[0]?.period_duration_minutes || 10; // Default 10 minutes
    const numberOfPeriods = gameConfigResult.rows[0]?.number_of_periods || 4; // Default 4 periods

    // Calculate play time for each player
    const playTimeMap = new Map();
    
    if (process.env.NODE_ENV !== 'test') {
      console.log('Play time calculation debug:');
      console.log('- Period duration:', periodDuration, 'minutes');
      console.log('- Number of periods:', numberOfPeriods);
      console.log('- Total players:', playersResult.rows.length);
      console.log('- Players with is_starting true:', playersResult.rows.filter(p => p.is_starting).length);
      console.log('- Total substitutions:', subsResult.rows.length);
    }
    
    playersResult.rows.forEach(player => {
      const playerId = player.player_id;
      const isStarter = player.is_starting === true; // Explicitly check for true
      
      // Track player's on-court time
      let totalSeconds = 0;
      let isOnCourt = isStarter; // Starters begin on court
      let lastTime = 0; // Start of game (in seconds from game start)
      let currentPeriod = 1;

      if (process.env.NODE_ENV !== 'test') {
        console.log(`\nPlayer: ${player.first_name} ${player.last_name} (#${player.jersey_number})`);
        console.log(`  - is_starting: ${player.is_starting}`);
        console.log(`  - isStarter: ${isStarter}`);
        console.log(`  - Initial isOnCourt: ${isOnCourt}`);
        console.log(`  - Initial lastTime: ${lastTime} seconds`);
      }

      // Process substitutions for this player
      const playerSubs = subsResult.rows.filter(sub => sub.player_id === playerId);
      
      if (process.env.NODE_ENV !== 'test') {
        console.log(`  - Substitutions for this player: ${playerSubs.length}`);
      }
      
      playerSubs.forEach(sub => {
        const subTime = (sub.period - 1) * periodDuration * 60 + (periodDuration * 60 - sub.time_remaining_seconds);
        
        // Handle period changes
        if (sub.period > currentPeriod) {
          if (isOnCourt) {
            // Add time from last event to end of previous period(s)
            totalSeconds += (currentPeriod * periodDuration * 60) - lastTime;
            // Add full periods between
            totalSeconds += (sub.period - currentPeriod - 1) * periodDuration * 60;
            // Set last time to start of current period
            lastTime = (sub.period - 1) * periodDuration * 60;
          } else {
            lastTime = (sub.period - 1) * periodDuration * 60;
          }
          currentPeriod = sub.period;
        }
        
        if (sub.type === 'in') {
          isOnCourt = true;
          lastTime = subTime;
        } else if (sub.type === 'out') {
          if (isOnCourt) {
            totalSeconds += subTime - lastTime;
          }
          isOnCourt = false;
          lastTime = subTime;
        }
      });

      // Add remaining time if player is still on court at end of game
      if (isOnCourt) {
        const remainingTime = (numberOfPeriods * periodDuration * 60) - lastTime;
        totalSeconds += remainingTime;
        if (process.env.NODE_ENV !== 'test') {
          console.log(`  - Still on court at game end, adding remaining: ${remainingTime} seconds`);
        }
      }

      if (process.env.NODE_ENV !== 'test') {
        console.log(`  - TOTAL PLAY TIME: ${totalSeconds} seconds (${Math.floor(totalSeconds/60)}:${(totalSeconds%60).toString().padStart(2,'0')})`);
      }

      playTimeMap.set(playerId, Math.round(totalSeconds));
    });

    // Merge all data
    const result = {
      rows: playersResult.rows.map(player => {
        const shots = shotsResult.rows.find(s => s.player_id === player.player_id) || {
          total_shots: 0,
          goals: 0,
          misses: 0,
          blocked: 0,
          field_goal_percentage: 0,
          avg_distance: 0,
          avg_x_coord: 0,
          avg_y_coord: 0,
          left_zone_shots: 0,
          center_zone_shots: 0,
          right_zone_shots: 0,
          left_zone_goals: 0,
          center_zone_goals: 0,
          right_zone_goals: 0
        };

        return {
          ...player,
          ...shots,
          play_time_seconds: playTimeMap.get(player.player_id) || 0
        };
      }).filter(p => p.total_shots > 0 || p.play_time_seconds > 0) // Only include players who played or shot
        .sort((a, b) => b.goals - a.goals || b.total_shots - a.total_shots)
    };

    // Calculate zone success rates
    const players = result.rows.map(row => ({
      ...row,
      total_shots: parseInt(row.total_shots),
      goals: parseInt(row.goals),
      misses: parseInt(row.misses),
      blocked: parseInt(row.blocked),
      field_goal_percentage: parseFloat(row.field_goal_percentage) || 0,
      average_distance: parseFloat(row.avg_distance) || 0,
      play_time_seconds: row.play_time_seconds || 0,
      avg_x_coord: parseFloat(row.avg_x_coord) || 0,
      avg_y_coord: parseFloat(row.avg_y_coord) || 0,
      zone_performance: {
        left: {
          shots: parseInt(row.left_zone_shots),
          goals: parseInt(row.left_zone_goals),
          success_rate: row.left_zone_shots > 0 
            ? parseFloat((row.left_zone_goals / row.left_zone_shots * 100).toFixed(2))
            : 0
        },
        center: {
          shots: parseInt(row.center_zone_shots),
          goals: parseInt(row.center_zone_goals),
          success_rate: row.center_zone_shots > 0 
            ? parseFloat((row.center_zone_goals / row.center_zone_shots * 100).toFixed(2))
            : 0
        },
        right: {
          shots: parseInt(row.right_zone_shots),
          goals: parseInt(row.right_zone_goals),
          success_rate: row.right_zone_shots > 0 
            ? parseFloat((row.right_zone_goals / row.right_zone_shots * 100).toFixed(2))
            : 0
        }
      }
    }));

    // Remove raw zone counts and internal fields from response
    players.forEach(player => {
      delete player.left_zone_shots;
      delete player.center_zone_shots;
      delete player.right_zone_shots;
      delete player.left_zone_goals;
      delete player.center_zone_goals;
      delete player.right_zone_goals;
      delete player.avg_distance; // Remove since we renamed to average_distance
      delete player.avg_x_coord;
      delete player.avg_y_coord;
    });

    res.json(players);
  } catch (err) {
    console.error('Error fetching player analytics:', err);
    res.status(500).json({ error: 'Failed to fetch player analytics' });
  }
});

/**
 * Get overall game shot statistics
 */
router.get('/shots/:gameId/summary', [
  param('gameId').isInt().withMessage('Game ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;

  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_shots,
        COUNT(CASE WHEN result = 'goal' THEN 1 END) as total_goals,
        COUNT(CASE WHEN result = 'miss' THEN 1 END) as total_misses,
        COUNT(CASE WHEN result = 'blocked' THEN 1 END) as total_blocked,
        ROUND(
          COUNT(CASE WHEN result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as overall_fg_percentage,
        ROUND(AVG(distance), 2) as avg_shot_distance
      FROM shots
      WHERE game_id = $1
    `, [gameId]);

    const teamStats = await db.query(`
      SELECT 
        c.id as club_id,
        c.name as club_name,
        COUNT(*) as total_shots,
        COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals,
        ROUND(
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as fg_percentage
      FROM shots s
      JOIN clubs c ON s.club_id = c.id
      WHERE s.game_id = $1
      GROUP BY c.id, c.name
    `, [gameId]);

    res.json({
      overall: {
        total_shots: parseInt(result.rows[0].total_shots),
        total_goals: parseInt(result.rows[0].total_goals),
        total_misses: parseInt(result.rows[0].total_misses),
        total_blocked: parseInt(result.rows[0].total_blocked),
        overall_fg_percentage: parseFloat(result.rows[0].overall_fg_percentage) || 0,
        avg_shot_distance: parseFloat(result.rows[0].avg_shot_distance) || 0
      },
      by_club: teamStats.rows.map(row => ({
        club_id: row.club_id,
        club_name: row.club_name,
        total_shots: parseInt(row.total_shots),
        goals: parseInt(row.goals),
        fg_percentage: parseFloat(row.fg_percentage) || 0
      }))
    });
  } catch (err) {
    console.error('Error fetching summary analytics:', err);
    res.status(500).json({ error: 'Failed to fetch summary analytics' });
  }
});

/**
 * Phase 3: Get streak tracking for players
 * Returns current and longest streaks (makes/misses)
 */
router.get('/shots/:gameId/streaks', [
  param('gameId').isInt().withMessage('Game ID must be an integer'),
  query('club_id').optional().isInt().withMessage('Club ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;
  const { club_id } = req.query;

  try {
    let queryText = `
      SELECT 
        s.player_id,
        p.first_name,
        p.last_name,
        p.jersey_number,
        c.name as club_name,
        s.result,
        s.created_at,
        ROW_NUMBER() OVER (PARTITION BY s.player_id ORDER BY s.created_at) as shot_number
      FROM shots s
      JOIN players p ON s.player_id = p.id
      JOIN clubs c ON s.club_id = c.id
      WHERE s.game_id = $1
    `;
    const queryParams = [gameId];

    if (club_id) {
      queryText += ' AND s.club_id = $2';
      queryParams.push(club_id);
    }

    queryText += ' ORDER BY s.player_id, s.created_at';

    const result = await db.query(queryText, queryParams);

    // Calculate streaks per player
    const streaksByPlayer = {};
    
    result.rows.forEach(shot => {
      if (!streaksByPlayer[shot.player_id]) {
        streaksByPlayer[shot.player_id] = {
          player_id: shot.player_id,
          first_name: shot.first_name,
          last_name: shot.last_name,
          jersey_number: shot.jersey_number,
          club_name: shot.club_name,
          current_streak: 0,
          current_streak_type: null,
          longest_make_streak: 0,
          longest_miss_streak: 0,
          shots: []
        };
      }

      const player = streaksByPlayer[shot.player_id];
      player.shots.push(shot.result);
    });

    // Calculate streaks
    Object.values(streaksByPlayer).forEach(player => {
      let currentStreak = 0;
      let currentType = null;
      let longestMake = 0;
      let longestMiss = 0;
      let tempMakeStreak = 0;
      let tempMissStreak = 0;

      player.shots.forEach(result => {
        const isMake = result === 'goal';
        
        // Update current streak
        if (currentType === null || currentType === isMake) {
          currentStreak++;
          currentType = isMake;
        } else {
          currentStreak = 1;
          currentType = isMake;
        }

        // Track temp streaks
        if (isMake) {
          tempMakeStreak++;
          if (tempMissStreak > longestMiss) longestMiss = tempMissStreak;
          tempMissStreak = 0;
        } else {
          tempMissStreak++;
          if (tempMakeStreak > longestMake) longestMake = tempMakeStreak;
          tempMakeStreak = 0;
        }
      });

      // Finalize
      if (tempMakeStreak > longestMake) longestMake = tempMakeStreak;
      if (tempMissStreak > longestMiss) longestMiss = tempMissStreak;

      player.current_streak = currentStreak;
      player.current_streak_type = currentType ? 'makes' : 'misses';
      player.longest_make_streak = longestMake;
      player.longest_miss_streak = longestMiss;
      delete player.shots;
    });

    res.json(Object.values(streaksByPlayer));
  } catch (err) {
    console.error('Error fetching streaks:', err);
    res.status(500).json({ error: 'Failed to fetch streak data' });
  }
});

/**
 * Phase 3: Get hot/cold zones with statistical significance
 * Returns zones with performance significantly above/below average
 */
router.get('/shots/:gameId/zones', [
  param('gameId').isInt().withMessage('Game ID must be an integer'),
  query('club_id').optional().isInt().withMessage('Club ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;
  const { club_id } = req.query;

  try {
    // Get overall FG% for comparison
    let overallQuery = `
      SELECT 
        ROUND(
          COUNT(CASE WHEN result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as overall_fg_percentage
      FROM shots
      WHERE game_id = $1
    `;
    const overallParams = [gameId];

    if (club_id) {
      overallQuery += ' AND club_id = $2';
      overallParams.push(club_id);
    }

    const overallResult = await db.query(overallQuery, overallParams);
    const overallFG = parseFloat(overallResult.rows[0].overall_fg_percentage) || 0;

    // Define zones (4x4 grid)
    const zones = [];
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        zones.push({
          zone_x: x,
          zone_y: y,
          min_x: x * 25,
          max_x: (x + 1) * 25,
          min_y: y * 25,
          max_y: (y + 1) * 25
        });
      }
    }

    // Get stats for each zone
    const zoneStats = await Promise.all(zones.map(async (zone) => {
      let zoneQuery = `
        SELECT 
          COUNT(*) as shots,
          COUNT(CASE WHEN result = 'goal' THEN 1 END) as goals,
          ROUND(
            COUNT(CASE WHEN result = 'goal' THEN 1 END)::numeric / 
            NULLIF(COUNT(*)::numeric, 0) * 100, 
            2
          ) as fg_percentage
        FROM shots
        WHERE game_id = $1
          AND x_coord >= $2 AND x_coord < $3
          AND y_coord >= $4 AND y_coord < $5
      `;
      const zoneParams = [gameId, zone.min_x, zone.max_x, zone.min_y, zone.max_y];

      if (club_id) {
        zoneQuery += ' AND club_id = $6';
        zoneParams.push(club_id);
      }

      const result = await db.query(zoneQuery, zoneParams);
      const stats = result.rows[0];
      const shots = parseInt(stats.shots);
      const fg_percentage = parseFloat(stats.fg_percentage) || 0;
      
      // Calculate statistical significance (simple threshold: 10+ shots & 15% difference)
      const difference = fg_percentage - overallFG;
      const isSignificant = shots >= 10 && Math.abs(difference) >= 15;
      const zoneType = isSignificant ? (difference > 0 ? 'hot' : 'cold') : 'neutral';

      return {
        ...zone,
        shots,
        goals: parseInt(stats.goals),
        fg_percentage,
        overall_fg: overallFG,
        difference: parseFloat(difference.toFixed(2)),
        is_significant: isSignificant,
        zone_type: zoneType
      };
    }));

    res.json({
      overall_fg_percentage: overallFG,
      zones: zoneStats.filter(z => z.shots > 0)
    });
  } catch (err) {
    console.error('Error fetching zone analysis:', err);
    res.status(500).json({ error: 'Failed to fetch zone analysis' });
  }
});

/**
 * Phase 3: Get period-over-period trends
 * Returns performance metrics by period to identify trends
 */
router.get('/shots/:gameId/trends', [
  param('gameId').isInt().withMessage('Game ID must be an integer'),
  query('club_id').optional().isInt().withMessage('Club ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;
  const { club_id } = req.query;

  try {
    let queryText = `
      SELECT 
        period,
        COUNT(*) as total_shots,
        COUNT(CASE WHEN result = 'goal' THEN 1 END) as goals,
        COUNT(CASE WHEN result = 'miss' THEN 1 END) as misses,
        COUNT(CASE WHEN result = 'blocked' THEN 1 END) as blocked,
        ROUND(
          COUNT(CASE WHEN result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as fg_percentage,
        ROUND(AVG(distance), 2) as avg_distance,
        COUNT(DISTINCT player_id) as players_with_shots
      FROM shots
      WHERE game_id = $1
    `;
    const queryParams = [gameId];

    if (club_id) {
      queryText += ' AND club_id = $2';
      queryParams.push(club_id);
    }

    queryText += ' GROUP BY period ORDER BY period';

    const result = await db.query(queryText, queryParams);

    const trends = result.rows.map((row, index, arr) => {
      const period = {
        period: row.period,
        total_shots: parseInt(row.total_shots),
        goals: parseInt(row.goals),
        misses: parseInt(row.misses),
        blocked: parseInt(row.blocked),
        fg_percentage: parseFloat(row.fg_percentage) || 0,
        avg_distance: parseFloat(row.avg_distance) || 0,
        players_with_shots: parseInt(row.players_with_shots),
        trend: null,
        fg_change: null
      };

      // Calculate trend compared to previous period
      if (index > 0) {
        const prevFG = parseFloat(arr[index - 1].fg_percentage) || 0;
        period.fg_change = parseFloat((period.fg_percentage - prevFG).toFixed(2));
        
        if (Math.abs(period.fg_change) < 5) {
          period.trend = 'stable';
        } else if (period.fg_change > 0) {
          period.trend = 'improving';
        } else {
          period.trend = 'declining';
        }
      }

      return period;
    });

    res.json(trends);
  } catch (err) {
    console.error('Error fetching trends:', err);
    res.status(500).json({ error: 'Failed to fetch trend data' });
  }
});

/**
 * Phase 4: Get player development across season
 * Returns performance metrics across multiple games
 */
router.get('/players/:playerId/development', [
  param('playerId').isInt().withMessage('Player ID must be an integer'),
  query('club_id').optional().isInt().withMessage('Club ID must be an integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { playerId } = req.params;
  const { club_id, limit = 10 } = req.query;

  try {
    let queryText = `
      SELECT 
        g.id as game_id,
        g.date as game_date,
        t.name as team_name,
        COUNT(*) as shots,
        COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals,
        ROUND(
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as fg_percentage,
        ROUND(AVG(s.distance), 2) as avg_distance
      FROM shots s
      JOIN games g ON s.game_id = g.id
      JOIN clubs t ON s.club_id = t.id
      WHERE s.player_id = $1
    `;
    const queryParams = [playerId];
    let paramIndex = 2;

    if (club_id) {
      queryText += ` AND s.club_id = $${paramIndex}`;
      queryParams.push(club_id);
      paramIndex++;
    }

    queryText += ` GROUP BY g.id, g.date, t.name ORDER BY g.date DESC LIMIT $${paramIndex}`;
    queryParams.push(limit);

    const result = await db.query(queryText, queryParams);

    const development = result.rows.map((row, index, arr) => {
      const game = {
        game_id: row.game_id,
        game_date: row.game_date,
        team_name: row.team_name,
        shots: parseInt(row.shots),
        goals: parseInt(row.goals),
        fg_percentage: parseFloat(row.fg_percentage) || 0,
        avg_distance: parseFloat(row.avg_distance) || 0,
        improvement: null
      };

      // Calculate improvement from previous game
      if (index < arr.length - 1) {
        const prevFG = parseFloat(arr[index + 1].fg_percentage) || 0;
        game.improvement = parseFloat((game.fg_percentage - prevFG).toFixed(2));
      }

      return game;
    });

    res.json(development);
  } catch (err) {
    console.error('Error fetching player development:', err);
    res.status(500).json({ error: 'Failed to fetch player development data' });
  }
});

/**
 * Phase 4: Get opponent shooting tendencies
 * Returns aggregated shooting patterns for a club across multiple games
 */
router.get('/clubs/:clubId/tendencies', [
  param('clubId').isInt().withMessage('Club ID must be an integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { clubId } = req.params;
  const { limit = 10 } = req.query;

  try {
    // Get overall club statistics across recent games
    const overallStats = await db.query(`
      SELECT 
        COUNT(DISTINCT s.game_id) as games_played,
        COUNT(*) as total_shots,
        COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as total_goals,
        ROUND(
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as avg_fg_percentage,
        ROUND(AVG(s.distance), 2) as avg_distance,
        ROUND(AVG(s.x_coord), 2) as avg_x_coord,
        ROUND(AVG(s.y_coord), 2) as avg_y_coord
      FROM shots s
      WHERE s.club_id = $1
        AND s.game_id IN (
          SELECT g.id FROM games g
          JOIN shots s2 ON g.id = s2.game_id
          WHERE s2.club_id = $1
          GROUP BY g.id
          ORDER BY g.date DESC
          LIMIT $2
        )
    `, [clubId, limit]);

    // Get favorite zones (hot zones across all games)
    const zoneStats = await db.query(`
      SELECT 
        CASE 
          WHEN s.x_coord < 33.33 THEN 'left'
          WHEN s.x_coord >= 33.33 AND s.x_coord < 66.67 THEN 'center'
          ELSE 'right'
        END as zone,
        COUNT(*) as shots,
        COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals,
        ROUND(
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as fg_percentage
      FROM shots s
      WHERE s.club_id = $1
        AND s.game_id IN (
          SELECT g.id FROM games g
          JOIN shots s2 ON g.id = s2.game_id
          WHERE s2.club_id = $1
          GROUP BY g.id
          ORDER BY g.date DESC
          LIMIT $2
        )
      GROUP BY zone
      ORDER BY shots DESC
    `, [clubId, limit]);

    // Get top shooters
    const topShooters = await db.query(`
      SELECT 
        p.id as player_id,
        p.first_name,
        p.last_name,
        p.jersey_number,
        COUNT(*) as shots,
        COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals,
        ROUND(
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as fg_percentage
      FROM shots s
      JOIN players p ON s.player_id = p.id
      WHERE s.club_id = $1
        AND s.game_id IN (
          SELECT g.id FROM games g
          JOIN shots s2 ON g.id = s2.game_id
          WHERE s2.club_id = $1
          GROUP BY g.id
          ORDER BY g.date DESC
          LIMIT $2
        )
      GROUP BY p.id, p.first_name, p.last_name, p.jersey_number
      ORDER BY shots DESC
      LIMIT 5
    `, [clubId, limit]);

    res.json({
      overall: {
        games_played: parseInt(overallStats.rows[0].games_played),
        total_shots: parseInt(overallStats.rows[0].total_shots),
        total_goals: parseInt(overallStats.rows[0].total_goals),
        avg_fg_percentage: parseFloat(overallStats.rows[0].avg_fg_percentage) || 0,
        avg_distance: parseFloat(overallStats.rows[0].avg_distance) || 0,
        avg_shot_location: {
          x: parseFloat(overallStats.rows[0].avg_x_coord) || 0,
          y: parseFloat(overallStats.rows[0].avg_y_coord) || 0
        }
      },
      zone_preferences: zoneStats.rows.map(row => ({
        zone: row.zone,
        shots: parseInt(row.shots),
        goals: parseInt(row.goals),
        fg_percentage: parseFloat(row.fg_percentage) || 0
      })),
      top_shooters: topShooters.rows.map(row => ({
        player_id: row.player_id,
        first_name: row.first_name,
        last_name: row.last_name,
        jersey_number: row.jersey_number,
        shots: parseInt(row.shots),
        goals: parseInt(row.goals),
        fg_percentage: parseFloat(row.fg_percentage) || 0
      }))
    });
  } catch (err) {
    console.error('Error fetching team tendencies:', err);
    res.status(500).json({ error: 'Failed to fetch team tendencies' });
  }
});

/**
 * Phase 4: Get matchup analysis
 * Compare club performance against specific opponents
 */
router.get('/clubs/:clubId/matchup/:opponentId', [
  param('clubId').isInt().withMessage('Club ID must be an integer'),
  param('opponentId').isInt().withMessage('Opponent ID must be an integer'),
  query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be between 1 and 20')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { clubId, opponentId } = req.params;
  const { limit = 5 } = req.query;

  try {
    // Find games between these two clubs
    const games = await db.query(`
      SELECT DISTINCT g.id, g.date
      FROM games g
      WHERE (g.home_club_id = $1 AND g.away_club_id = $2)
         OR (g.home_club_id = $2 AND g.away_club_id = $1)
      ORDER BY g.date DESC
      LIMIT $3
    `, [clubId, opponentId, limit]);

    const gameIds = games.rows.map(g => g.id);

    if (gameIds.length === 0) {
      return res.json({
        games_played: 0,
        message: 'No games found between these clubs',
        club_stats: null,
        opponent_stats: null
      });
    }

    // Get club stats in these matchups
    const clubStats = await db.query(`
      SELECT 
        COUNT(*) as total_shots,
        COUNT(CASE WHEN result = 'goal' THEN 1 END) as total_goals,
        ROUND(
          COUNT(CASE WHEN result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as avg_fg_percentage,
        ROUND(AVG(distance), 2) as avg_distance
      FROM shots
      WHERE club_id = $1 AND game_id = ANY($2)
    `, [clubId, gameIds]);

    // Get opponent stats in these matchups
    const opponentStats = await db.query(`
      SELECT 
        COUNT(*) as total_shots,
        COUNT(CASE WHEN result = 'goal' THEN 1 END) as total_goals,
        ROUND(
          COUNT(CASE WHEN result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as avg_fg_percentage,
        ROUND(AVG(distance), 2) as avg_distance
      FROM shots
      WHERE club_id = $1 AND game_id = ANY($2)
    `, [opponentId, gameIds]);

    res.json({
      games_played: games.rows.length,
      game_dates: games.rows.map(g => g.date),
      club_stats: {
        total_shots: parseInt(clubStats.rows[0].total_shots),
        total_goals: parseInt(clubStats.rows[0].total_goals),
        avg_fg_percentage: parseFloat(clubStats.rows[0].avg_fg_percentage) || 0,
        avg_distance: parseFloat(clubStats.rows[0].avg_distance) || 0
      },
      opponent_stats: {
        total_shots: parseInt(opponentStats.rows[0].total_shots),
        total_goals: parseInt(opponentStats.rows[0].total_goals),
        avg_fg_percentage: parseFloat(opponentStats.rows[0].avg_fg_percentage) || 0,
        avg_distance: parseFloat(opponentStats.rows[0].avg_distance) || 0
      }
    });
  } catch (err) {
    console.error('Error fetching matchup analysis:', err);
    res.status(500).json({ error: 'Failed to fetch matchup analysis' });
  }
});

export default router;
