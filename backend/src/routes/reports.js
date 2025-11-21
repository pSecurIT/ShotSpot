import express from 'express';
import { param, query, validationResult } from 'express-validator';
import db from '../db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

/**
 * Get live match report - current game state snapshot
 * Returns comprehensive game state including scores, shots, events, player stats
 */
router.get('/live/:gameId', [
  param('gameId').isInt().withMessage('Game ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;

  try {
    // Get game details
    const gameResult = await db.query(`
      SELECT 
        g.*,
        ht.name as home_team_name,
        at.name as away_team_name
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.id
      JOIN teams at ON g.away_team_id = at.id
      WHERE g.id = $1
    `, [gameId]);

    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = gameResult.rows[0];

    // Get shot summary by team
    const shotSummary = await db.query(`
      SELECT 
        t.id as team_id,
        t.name as team_name,
        COUNT(*) as total_shots,
        COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals,
        COUNT(CASE WHEN s.result = 'miss' THEN 1 END) as misses,
        COUNT(CASE WHEN s.result = 'blocked' THEN 1 END) as blocked,
        ROUND(
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as fg_percentage
      FROM teams t
      LEFT JOIN shots s ON s.team_id = t.id AND s.game_id = $1
      WHERE t.id = $2 OR t.id = $3
      GROUP BY t.id, t.name
      ORDER BY t.id
    `, [gameId, game.home_team_id, game.away_team_id]);

    // Get recent events (last 10)
    const recentEvents = await db.query(`
      SELECT 
        e.*,
        CASE WHEN e.player_id IS NOT NULL 
          THEN p.first_name || ' ' || p.last_name 
          ELSE NULL 
        END as player_name,
        t.name as team_name
      FROM game_events e
      LEFT JOIN players p ON e.player_id = p.id
      JOIN teams t ON e.team_id = t.id
      WHERE e.game_id = $1
      ORDER BY e.created_at DESC
      LIMIT 10
    `, [gameId]);

    // Get top scorers
    const topScorers = await db.query(`
      SELECT 
        p.id as player_id,
        p.first_name,
        p.last_name,
        p.jersey_number,
        t.name as team_name,
        COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals,
        COUNT(*) as total_shots
      FROM shots s
      JOIN players p ON s.player_id = p.id
      JOIN teams t ON s.team_id = t.id
      WHERE s.game_id = $1
      GROUP BY p.id, p.first_name, p.last_name, p.jersey_number, t.name
      HAVING COUNT(CASE WHEN s.result = 'goal' THEN 1 END) > 0
      ORDER BY goals DESC, total_shots DESC
      LIMIT 5
    `, [gameId]);

    // Build response
    const report = {
      game: {
        id: game.id,
        home_team: game.home_team_name,
        away_team: game.away_team_name,
        home_score: game.home_score,
        away_score: game.away_score,
        status: game.status,
        current_period: game.current_period,
        time_remaining: game.time_remaining,
        timer_state: game.timer_state,
        date: game.date
      },
      shot_summary: shotSummary.rows.map(row => ({
        team_id: row.team_id,
        team_name: row.team_name,
        total_shots: parseInt(row.total_shots) || 0,
        goals: parseInt(row.goals) || 0,
        misses: parseInt(row.misses) || 0,
        blocked: parseInt(row.blocked) || 0,
        fg_percentage: parseFloat(row.fg_percentage) || 0
      })),
      recent_events: recentEvents.rows,
      top_scorers: topScorers.rows.map(row => ({
        player_id: row.player_id,
        name: `${row.first_name} ${row.last_name}`,
        jersey_number: row.jersey_number,
        team_name: row.team_name,
        goals: parseInt(row.goals),
        total_shots: parseInt(row.total_shots)
      })),
      generated_at: new Date().toISOString()
    };

    res.json(report);
  } catch (err) {
    console.error('Error generating live report:', err);
    res.status(500).json({ error: 'Failed to generate live report' });
  }
});

/**
 * Get period report - statistics for a specific period
 */
router.get('/period/:gameId/:period', [
  param('gameId').isInt().withMessage('Game ID must be an integer'),
  param('period').isInt({ min: 1 }).withMessage('Period must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId, period } = req.params;

  try {
    // Verify game exists
    const gameCheck = await db.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Get shots for this period
    const periodShots = await db.query(`
      SELECT 
        t.id as team_id,
        t.name as team_name,
        COUNT(*) as total_shots,
        COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals,
        COUNT(CASE WHEN s.result = 'miss' THEN 1 END) as misses,
        COUNT(CASE WHEN s.result = 'blocked' THEN 1 END) as blocked,
        ROUND(
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as fg_percentage,
        ROUND(AVG(s.distance), 2) as avg_distance
      FROM shots s
      JOIN teams t ON s.team_id = t.id
      WHERE s.game_id = $1 AND s.period = $2
      GROUP BY t.id, t.name
    `, [gameId, period]);

    // Get events for this period
    const periodEvents = await db.query(`
      SELECT 
        e.*,
        CASE WHEN e.player_id IS NOT NULL 
          THEN p.first_name || ' ' || p.last_name 
          ELSE NULL 
        END as player_name,
        t.name as team_name
      FROM game_events e
      LEFT JOIN players p ON e.player_id = p.id
      JOIN teams t ON e.team_id = t.id
      WHERE e.game_id = $1 AND e.period = $2
      ORDER BY e.created_at
    `, [gameId, period]);

    // Get player stats for this period
    const playerStats = await db.query(`
      SELECT 
        p.id as player_id,
        p.first_name,
        p.last_name,
        p.jersey_number,
        t.name as team_name,
        COUNT(*) as shots,
        COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals,
        ROUND(
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as fg_percentage
      FROM shots s
      JOIN players p ON s.player_id = p.id
      JOIN teams t ON s.team_id = t.id
      WHERE s.game_id = $1 AND s.period = $2
      GROUP BY p.id, p.first_name, p.last_name, p.jersey_number, t.name
      ORDER BY goals DESC, shots DESC
    `, [gameId, period]);

    const report = {
      game_id: parseInt(gameId),
      period: parseInt(period),
      team_stats: periodShots.rows.map(row => ({
        team_id: row.team_id,
        team_name: row.team_name,
        total_shots: parseInt(row.total_shots) || 0,
        goals: parseInt(row.goals) || 0,
        misses: parseInt(row.misses) || 0,
        blocked: parseInt(row.blocked) || 0,
        fg_percentage: parseFloat(row.fg_percentage) || 0,
        avg_distance: parseFloat(row.avg_distance) || 0
      })),
      events: periodEvents.rows,
      player_stats: playerStats.rows.map(row => ({
        player_id: row.player_id,
        name: `${row.first_name} ${row.last_name}`,
        jersey_number: row.jersey_number,
        team_name: row.team_name,
        shots: parseInt(row.shots),
        goals: parseInt(row.goals),
        fg_percentage: parseFloat(row.fg_percentage) || 0
      })),
      generated_at: new Date().toISOString()
    };

    res.json(report);
  } catch (err) {
    console.error('Error generating period report:', err);
    res.status(500).json({ error: 'Failed to generate period report' });
  }
});

/**
 * Get momentum tracker - recent performance trends
 * Calculates momentum based on last N shots/events
 */
router.get('/momentum/:gameId', [
  param('gameId').isInt().withMessage('Game ID must be an integer'),
  query('window').optional().isInt({ min: 5, max: 20 }).withMessage('Window must be between 5 and 20')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;
  const window = parseInt(req.query.window) || 10;

  try {
    // Verify game exists
    const gameCheck = await db.query('SELECT home_team_id, away_team_id FROM games WHERE id = $1', [gameId]);
    if (gameCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const { home_team_id, away_team_id } = gameCheck.rows[0];

    // Get recent shots with results
    const recentShots = await db.query(`
      SELECT 
        s.team_id,
        s.result,
        s.created_at,
        t.name as team_name
      FROM shots s
      JOIN teams t ON s.team_id = t.id
      WHERE s.game_id = $1
      ORDER BY s.created_at DESC
      LIMIT $2
    `, [gameId, window]);

    if (recentShots.rows.length === 0) {
      return res.json({
        message: 'No shots data available yet',
        momentum: {
          home: 0,
          away: 0
        }
      });
    }

    // Calculate momentum score for each team
    // Goals = +3, Misses = -1, Blocked = -2
    let homeMomentum = 0;
    let awayMomentum = 0;

    recentShots.rows.forEach((shot, index) => {
      // More recent shots have higher weight
      const weight = (window - index) / window;
      let score = 0;

      if (shot.result === 'goal') {
        score = 3;
      } else if (shot.result === 'miss') {
        score = -1;
      } else if (shot.result === 'blocked') {
        score = -2;
      }

      if (shot.team_id === home_team_id) {
        homeMomentum += score * weight;
      } else if (shot.team_id === away_team_id) {
        awayMomentum += score * weight;
      }
    });

    // Normalize to -100 to +100 scale
    const maxPossible = 3 * window; // All goals with full weight
    homeMomentum = Math.round((homeMomentum / maxPossible) * 100);
    awayMomentum = Math.round((awayMomentum / maxPossible) * 100);

    res.json({
      window_size: window,
      recent_shots_analyzed: recentShots.rows.length,
      momentum: {
        home: homeMomentum,
        away: awayMomentum,
        trend: homeMomentum > awayMomentum ? 'home' : awayMomentum > homeMomentum ? 'away' : 'even'
      },
      recent_shots: recentShots.rows.slice(0, 5).map(shot => ({
        team_name: shot.team_name,
        result: shot.result,
        time: shot.created_at
      }))
    });
  } catch (err) {
    console.error('Error calculating momentum:', err);
    res.status(500).json({ error: 'Failed to calculate momentum' });
  }
});

/**
 * Get live player comparison - compare two players in current game
 */
router.get('/compare/:gameId/:playerId1/:playerId2', [
  param('gameId').isInt().withMessage('Game ID must be an integer'),
  param('playerId1').isInt().withMessage('Player ID 1 must be an integer'),
  param('playerId2').isInt().withMessage('Player ID 2 must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId, playerId1, playerId2 } = req.params;

  try {
    // Get stats for both players in this game
    const playerStats = await db.query(`
      SELECT 
        p.id as player_id,
        p.first_name,
        p.last_name,
        p.jersey_number,
        t.name as team_name,
        COUNT(*) as total_shots,
        COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals,
        COUNT(CASE WHEN s.result = 'miss' THEN 1 END) as misses,
        COUNT(CASE WHEN s.result = 'blocked' THEN 1 END) as blocked,
        ROUND(
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as fg_percentage,
        ROUND(AVG(s.distance), 2) as avg_distance,
        COUNT(CASE WHEN s.x_coord < 33.33 THEN 1 END) as left_zone_shots,
        COUNT(CASE WHEN s.x_coord >= 33.33 AND s.x_coord < 66.67 THEN 1 END) as center_zone_shots,
        COUNT(CASE WHEN s.x_coord >= 66.67 THEN 1 END) as right_zone_shots
      FROM players p
      LEFT JOIN shots s ON s.player_id = p.id AND s.game_id = $1
      WHERE p.id = $2 OR p.id = $3
      GROUP BY p.id, p.first_name, p.last_name, p.jersey_number, t.name
    `, [gameId, playerId1, playerId2]);

    if (playerStats.rows.length < 2) {
      return res.status(404).json({ error: 'One or both players not found' });
    }

    const comparison = playerStats.rows.map(row => ({
      player_id: row.player_id,
      name: `${row.first_name} ${row.last_name}`,
      jersey_number: row.jersey_number,
      team_name: row.team_name,
      total_shots: parseInt(row.total_shots) || 0,
      goals: parseInt(row.goals) || 0,
      misses: parseInt(row.misses) || 0,
      blocked: parseInt(row.blocked) || 0,
      fg_percentage: parseFloat(row.fg_percentage) || 0,
      avg_distance: parseFloat(row.avg_distance) || 0,
      zone_distribution: {
        left: parseInt(row.left_zone_shots) || 0,
        center: parseInt(row.center_zone_shots) || 0,
        right: parseInt(row.right_zone_shots) || 0
      }
    }));

    res.json({
      game_id: parseInt(gameId),
      players: comparison,
      comparison_summary: {
        goals_leader: comparison[0].goals > comparison[1].goals ? comparison[0].name : 
          comparison[1].goals > comparison[0].goals ? comparison[1].name : 'Tied',
        fg_percentage_leader: comparison[0].fg_percentage > comparison[1].fg_percentage ? comparison[0].name :
          comparison[1].fg_percentage > comparison[0].fg_percentage ? comparison[1].name : 'Tied',
        shots_leader: comparison[0].total_shots > comparison[1].total_shots ? comparison[0].name :
          comparison[1].total_shots > comparison[0].total_shots ? comparison[1].name : 'Tied'
      }
    });
  } catch (err) {
    console.error('Error comparing players:', err);
    res.status(500).json({ error: 'Failed to compare players' });
  }
});

/**
 * Get substitution suggestions based on performance patterns
 */
router.get('/suggestions/substitution/:gameId', [
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
    // Get current game roster (players on court)
    let rosterQuery = `
      SELECT 
        gr.player_id,
        p.first_name,
        p.last_name,
        p.jersey_number,
        t.name as team_name,
        t.id as team_id
      FROM game_rosters gr
      JOIN players p ON gr.player_id = p.id
      JOIN teams t ON p.team_id = t.id
      WHERE gr.game_id = $1 AND gr.is_starting = true
    `;
    const rosterParams = [gameId];

    if (team_id) {
      rosterQuery += ' AND p.team_id = $2';
      rosterParams.push(team_id);
    }

    const roster = await db.query(rosterQuery, rosterParams);

    // Get performance metrics for these players
    const performance = await db.query(`
      SELECT 
        p.id as player_id,
        COUNT(*) as shots_taken,
        COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals,
        ROUND(
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as fg_percentage
      FROM players p
      LEFT JOIN shots s ON s.player_id = p.id AND s.game_id = $1
      WHERE p.id = ANY($2)
      GROUP BY p.id
    `, [gameId, roster.rows.map(r => r.player_id)]);

    // Analyze performance and generate suggestions
    const suggestions = [];

    roster.rows.forEach(player => {
      const stats = performance.rows.find(p => p.player_id === player.player_id) || {
        shots_taken: 0,
        goals: 0,
        fg_percentage: 0
      };

      // Suggest substitution if:
      // 1. FG% < 30% and taken 5+ shots
      // 2. No shots taken in 2+ periods (would need period tracking)
      if (stats.shots_taken >= 5 && stats.fg_percentage < 30) {
        suggestions.push({
          player_id: player.player_id,
          name: `${player.first_name} ${player.last_name}`,
          jersey_number: player.jersey_number,
          team_name: player.team_name,
          reason: 'Low field goal percentage',
          current_fg: parseFloat(stats.fg_percentage),
          shots_taken: parseInt(stats.shots_taken),
          priority: 'medium'
        });
      } else if (stats.shots_taken === 0) {
        suggestions.push({
          player_id: player.player_id,
          name: `${player.first_name} ${player.last_name}`,
          jersey_number: player.jersey_number,
          team_name: player.team_name,
          reason: 'No shots attempted',
          current_fg: 0,
          shots_taken: 0,
          priority: 'low'
        });
      }
    });

    res.json({
      game_id: parseInt(gameId),
      suggestions: suggestions.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }),
      total_suggestions: suggestions.length
    });
  } catch (err) {
    console.error('Error generating substitution suggestions:', err);
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

/**
 * Export game report in JSON format
 * Provides comprehensive downloadable game data
 */
router.get('/export/:gameId', [
  param('gameId').isInt().withMessage('Game ID must be an integer'),
  query('format').optional().isIn(['json', 'summary']).withMessage('Format must be json or summary')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;
  const format = req.query.format || 'json';

  try {
    // Get complete game data
    const gameResult = await db.query(`
      SELECT 
        g.*,
        ht.name as home_team_name,
        at.name as away_team_name
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.id
      JOIN teams at ON g.away_team_id = at.id
      WHERE g.id = $1
    `, [gameId]);

    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = gameResult.rows[0];

    // Get all shots
    const shots = await db.query(`
      SELECT 
        s.*,
        p.first_name,
        p.last_name,
        p.jersey_number,
        t.name as team_name
      FROM shots s
      JOIN players p ON s.player_id = p.id
      JOIN teams t ON s.team_id = t.id
      WHERE s.game_id = $1
      ORDER BY s.created_at
    `, [gameId]);

    // Get all events
    const events = await db.query(`
      SELECT 
        e.*,
        CASE WHEN e.player_id IS NOT NULL 
          THEN p.first_name || ' ' || p.last_name 
          ELSE NULL 
        END as player_name,
        t.name as team_name
      FROM game_events e
      LEFT JOIN players p ON e.player_id = p.id
      JOIN teams t ON e.team_id = t.id
      WHERE e.game_id = $1
      ORDER BY e.created_at
    `, [gameId]);

    // Get player statistics
    const playerStats = await db.query(`
      SELECT 
        p.id as player_id,
        p.first_name,
        p.last_name,
        p.jersey_number,
        t.name as team_name,
        COUNT(*) as total_shots,
        COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals,
        COUNT(CASE WHEN s.result = 'miss' THEN 1 END) as misses,
        COUNT(CASE WHEN s.result = 'blocked' THEN 1 END) as blocked,
        ROUND(
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as fg_percentage
      FROM shots s
      JOIN players p ON s.player_id = p.id
      JOIN teams t ON s.team_id = t.id
      WHERE s.game_id = $1
      GROUP BY p.id, p.first_name, p.last_name, p.jersey_number, t.name
      ORDER BY goals DESC
    `, [gameId]);

    const report = {
      export_date: new Date().toISOString(),
      game: {
        id: game.id,
        date: game.date,
        status: game.status,
        home_team: {
          id: game.home_team_id,
          name: game.home_team_name,
          score: game.home_score
        },
        away_team: {
          id: game.away_team_id,
          name: game.away_team_name,
          score: game.away_score
        },
        current_period: game.current_period,
        time_remaining: game.time_remaining,
        period_duration: game.period_duration,
        number_of_periods: game.number_of_periods
      },
      shots: shots.rows,
      events: events.rows,
      player_statistics: playerStats.rows.map(row => ({
        player_id: row.player_id,
        name: `${row.first_name} ${row.last_name}`,
        jersey_number: row.jersey_number,
        team_name: row.team_name,
        total_shots: parseInt(row.total_shots),
        goals: parseInt(row.goals),
        misses: parseInt(row.misses),
        blocked: parseInt(row.blocked),
        fg_percentage: parseFloat(row.fg_percentage) || 0
      }))
    };

    if (format === 'summary') {
      // Return simplified summary
      const summary = {
        export_date: report.export_date,
        game: report.game,
        summary: {
          total_shots: shots.rows.length,
          total_goals: shots.rows.filter(s => s.result === 'goal').length,
          total_events: events.rows.length,
          top_scorer: playerStats.rows[0] ? {
            name: `${playerStats.rows[0].first_name} ${playerStats.rows[0].last_name}`,
            goals: parseInt(playerStats.rows[0].goals)
          } : null
        }
      };
      res.json(summary);
    } else {
      // Set headers for download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="game-${gameId}-report.json"`);
      res.json(report);
    }
  } catch (err) {
    console.error('Error exporting game report:', err);
    res.status(500).json({ error: 'Failed to export game report' });
  }
});

export default router;
