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
  query('team_id').optional().isInt().withMessage('Team ID must be an integer'),
  query('period').optional().isInt({ min: 1 }).withMessage('Period must be a positive integer'),
  query('grid_size').optional().isInt({ min: 5, max: 20 }).withMessage('Grid size must be between 5 and 20')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;
  const { team_id, period, grid_size = 10 } = req.query;

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

    if (team_id) {
      queryText += ` AND team_id = $${paramIndex}`;
      queryParams.push(team_id);
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
  query('team_id').optional().isInt().withMessage('Team ID must be an integer'),
  query('period').optional().isInt({ min: 1 }).withMessage('Period must be a positive integer'),
  query('player_id').optional().isInt().withMessage('Player ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;
  const { team_id, period, player_id } = req.query;

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
        t.name as team_name,
        s.team_id
      FROM shots s
      JOIN players p ON s.player_id = p.id
      JOIN teams t ON s.team_id = t.id
      WHERE s.game_id = $1
    `;
    const queryParams = [gameId];
    let paramIndex = 2;

    if (team_id) {
      queryText += ` AND s.team_id = $${paramIndex}`;
      queryParams.push(team_id);
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
  query('team_id').optional().isInt().withMessage('Team ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;
  const { team_id } = req.query;

  try {
    let queryText = `
      SELECT 
        p.id as player_id,
        p.first_name,
        p.last_name,
        p.jersey_number,
        t.name as team_name,
        s.team_id,
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
        -- Zone performance (left, center, right based on x_coord)
        COUNT(CASE WHEN s.x_coord < 33.33 THEN 1 END) as left_zone_shots,
        COUNT(CASE WHEN s.x_coord >= 33.33 AND s.x_coord < 66.67 THEN 1 END) as center_zone_shots,
        COUNT(CASE WHEN s.x_coord >= 66.67 THEN 1 END) as right_zone_shots,
        COUNT(CASE WHEN s.x_coord < 33.33 AND s.result = 'goal' THEN 1 END) as left_zone_goals,
        COUNT(CASE WHEN s.x_coord >= 33.33 AND s.x_coord < 66.67 AND s.result = 'goal' THEN 1 END) as center_zone_goals,
        COUNT(CASE WHEN s.x_coord >= 66.67 AND s.result = 'goal' THEN 1 END) as right_zone_goals
      FROM shots s
      JOIN players p ON s.player_id = p.id
      JOIN teams t ON s.team_id = t.id
      WHERE s.game_id = $1
    `;
    const queryParams = [gameId];
    let paramIndex = 2;

    if (team_id) {
      queryText += ` AND s.team_id = $${paramIndex}`;
      queryParams.push(team_id);
      paramIndex++;
    }

    queryText += ' GROUP BY p.id, p.first_name, p.last_name, p.jersey_number, t.name, s.team_id ORDER BY goals DESC, total_shots DESC';

    const result = await db.query(queryText, queryParams);

    // Calculate zone success rates
    const players = result.rows.map(row => ({
      ...row,
      total_shots: parseInt(row.total_shots),
      goals: parseInt(row.goals),
      misses: parseInt(row.misses),
      blocked: parseInt(row.blocked),
      field_goal_percentage: parseFloat(row.field_goal_percentage) || 0,
      avg_distance: parseFloat(row.avg_distance) || 0,
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

    // Remove raw zone counts from response
    players.forEach(player => {
      delete player.left_zone_shots;
      delete player.center_zone_shots;
      delete player.right_zone_shots;
      delete player.left_zone_goals;
      delete player.center_zone_goals;
      delete player.right_zone_goals;
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
        t.id as team_id,
        t.name as team_name,
        COUNT(*) as total_shots,
        COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals,
        ROUND(
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as fg_percentage
      FROM shots s
      JOIN teams t ON s.team_id = t.id
      WHERE s.game_id = $1
      GROUP BY t.id, t.name
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
      by_team: teamStats.rows.map(row => ({
        team_id: row.team_id,
        team_name: row.team_name,
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
  query('team_id').optional().isInt().withMessage('Team ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;
  const { team_id } = req.query;

  try {
    let queryText = `
      SELECT 
        s.player_id,
        p.first_name,
        p.last_name,
        p.jersey_number,
        t.name as team_name,
        s.result,
        s.created_at,
        ROW_NUMBER() OVER (PARTITION BY s.player_id ORDER BY s.created_at) as shot_number
      FROM shots s
      JOIN players p ON s.player_id = p.id
      JOIN teams t ON s.team_id = t.id
      WHERE s.game_id = $1
    `;
    const queryParams = [gameId];

    if (team_id) {
      queryText += ` AND s.team_id = $2`;
      queryParams.push(team_id);
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
          team_name: shot.team_name,
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
  query('team_id').optional().isInt().withMessage('Team ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;
  const { team_id } = req.query;

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

    if (team_id) {
      overallQuery += ` AND team_id = $2`;
      overallParams.push(team_id);
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

      if (team_id) {
        zoneQuery += ` AND team_id = $6`;
        zoneParams.push(team_id);
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
  query('team_id').optional().isInt().withMessage('Team ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;
  const { team_id } = req.query;

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

    if (team_id) {
      queryText += ` AND team_id = $2`;
      queryParams.push(team_id);
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

export default router;
