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
import { param, body, validationResult } from 'express-validator';
import PDFDocument from 'pdfkit';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

/**
 * Helper function to fetch game data with detailed statistics
 */
async function fetchGameData(gameId) {
  // Get game info
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
    return null;
  }

  const game = gameResult.rows[0];

  // Get period-by-period scoring
  const periodScores = await db.query(`
    SELECT 
      period,
      team_id,
      COUNT(CASE WHEN result = 'goal' THEN 1 END) as goals
    FROM shots
    WHERE game_id = $1
    GROUP BY period, team_id
    ORDER BY period, team_id
  `, [gameId]);

  // Get team statistics
  const teamStats = await db.query(`
    SELECT 
      t.id as team_id,
      t.name as team_name,
      COUNT(s.id) as total_shots,
      COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals,
      COUNT(CASE WHEN s.result = 'miss' THEN 1 END) as misses,
      COUNT(CASE WHEN s.result = 'blocked' THEN 1 END) as blocked,
      ROUND(
        COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
        NULLIF(COUNT(s.id)::numeric, 0) * 100, 
        2
      ) as fg_percentage
    FROM teams t
    LEFT JOIN shots s ON s.team_id = t.id AND s.game_id = $1
    WHERE t.id IN ($2, $3)
    GROUP BY t.id, t.name
  `, [gameId, game.home_team_id, game.away_team_id]);

  // Get top performers
  const topPerformers = await db.query(`
    SELECT 
      p.id,
      p.first_name,
      p.last_name,
      p.jersey_number,
      t.name as team_name,
      COUNT(s.id) as total_shots,
      COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals,
      ROUND(
        COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
        NULLIF(COUNT(s.id)::numeric, 0) * 100, 
        2
      ) as fg_percentage
    FROM players p
    JOIN teams t ON p.team_id = t.id
    JOIN shots s ON s.player_id = p.id
    WHERE s.game_id = $1
    GROUP BY p.id, p.first_name, p.last_name, p.jersey_number, t.name
    HAVING COUNT(CASE WHEN s.result = 'goal' THEN 1 END) > 0
    ORDER BY goals DESC, fg_percentage DESC
    LIMIT 5
  `, [gameId]);

  // Get key events timeline
  const events = await db.query(`
    SELECT 
      'shot' as event_type,
      s.period,
      s.time_remaining,
      s.result,
      p.first_name || ' ' || p.last_name as player_name,
      t.name as team_name
    FROM shots s
    JOIN players p ON s.player_id = p.id
    JOIN teams t ON s.team_id = t.id
    WHERE s.game_id = $1 AND s.result = 'goal'
    UNION ALL
    SELECT 
      ge.event_type,
      ge.period,
      ge.time_remaining,
      NULL as result,
      COALESCE(p.first_name || ' ' || p.last_name, 'Team') as player_name,
      t.name as team_name
    FROM game_events ge
    LEFT JOIN players p ON ge.player_id = p.id
    JOIN teams t ON ge.team_id = t.id
    WHERE ge.game_id = $1
    ORDER BY period, time_remaining DESC
    LIMIT 50
  `, [gameId]);

  // Get shot chart data
  const shotChart = await db.query(`
    SELECT 
      x_coord,
      y_coord,
      result,
      team_id
    FROM shots
    WHERE game_id = $1
  `, [gameId]);

  return {
    game,
    periodScores: periodScores.rows,
    teamStats: teamStats.rows,
    topPerformers: topPerformers.rows,
    events: events.rows,
    shotChart: shotChart.rows
  };
}

/**
 * Helper function to add header to PDF
 */
function addPDFHeader(doc, title) {
  doc.fontSize(20).font('Helvetica-Bold').text(title, 50, 50);
  doc.moveDown();
  doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, 50, 80);
  doc.moveDown(2);
}

/**
 * Generate Post-Match Summary Report
 * GET /api/reports/games/:gameId/post-match
 */
router.get('/games/:gameId/post-match', [
  param('gameId').isInt().withMessage('Game ID must be an integer')
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
        window_size: window,
        recent_shots_analyzed: 0,
        message: 'No shots data available yet',
        momentum: {
          home: 0,
          away: 0,
          trend: 'even'
        },
        recent_shots: []
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

  try {
    const data = await fetchGameData(gameId);
    
    if (!data) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=post-match-report-${gameId}.pdf`);
    
    // Pipe the PDF to the response
    doc.pipe(res);

    // Add header
    addPDFHeader(doc, 'Post-Match Summary Report');

    // Game Information
    doc.fontSize(14).font('Helvetica-Bold').text('Game Information', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Match: ${data.game.home_team_name} vs ${data.game.away_team_name}`);
    doc.text(`Date: ${new Date(data.game.date).toLocaleString()}`);
    doc.text(`Final Score: ${data.game.home_score} - ${data.game.away_score}`);
    doc.text(`Status: ${data.game.status}`);
    doc.text(`Periods: ${data.game.number_of_periods}`);
    doc.moveDown();

    // Period-by-Period Scoring
    doc.fontSize(14).font('Helvetica-Bold').text('Period-by-Period Scoring', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    const periods = [...new Set(data.periodScores.map(p => p.period))].sort();
    periods.forEach(period => {
      const homeScore = data.periodScores.find(p => p.period === period && p.team_id === data.game.home_team_id);
      const awayScore = data.periodScores.find(p => p.period === period && p.team_id === data.game.away_team_id);
      doc.text(`Period ${period}: ${data.game.home_team_name} ${homeScore?.goals || 0} - ${awayScore?.goals || 0} ${data.game.away_team_name}`);
    });
    doc.moveDown();

    // Team Statistics Comparison
    doc.fontSize(14).font('Helvetica-Bold').text('Team Statistics', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    data.teamStats.forEach(team => {
      doc.text(`${team.team_name}:`, { continued: false });
      doc.text(`  Total Shots: ${team.total_shots}`);
      doc.text(`  Goals: ${team.goals}`);
      doc.text(`  Misses: ${team.misses}`);
      doc.text(`  Blocked: ${team.blocked}`);
      doc.text(`  FG%: ${team.fg_percentage || 0}%`);
      doc.moveDown(0.5);
    });

    // Top Performers
    doc.fontSize(14).font('Helvetica-Bold').text('Top Performers', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    data.topPerformers.forEach((player, index) => {
      doc.text(`${index + 1}. ${player.first_name} ${player.last_name} (#${player.jersey_number}) - ${player.team_name}`);
      doc.text(`   Goals: ${player.goals}, Shots: ${player.total_shots}, FG%: ${player.fg_percentage || 0}%`);
    });
    doc.moveDown();

    // Timeline Summary
    doc.addPage();
    doc.fontSize(14).font('Helvetica-Bold').text('Key Events Timeline', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica');
    
    data.events.slice(0, 30).forEach(event => {
      const timeStr = event.time_remaining || 'N/A';
      let eventDesc = '';
      if (event.event_type === 'shot' && event.result === 'goal') {
        eventDesc = `⚽ GOAL by ${event.player_name} (${event.team_name})`;
      } else {
        eventDesc = `${event.event_type.toUpperCase()} - ${event.player_name} (${event.team_name})`;
      }
      doc.text(`P${event.period} ${timeStr}: ${eventDesc}`);
    });
    doc.moveDown();

    // Shot Chart Visualization
    doc.addPage();
    doc.fontSize(14).font('Helvetica-Bold').text('Shot Chart', { underline: true });
    doc.moveDown(0.5);
    
    // Draw court outline
    const courtX = 50;
    const courtY = 150;
    const courtWidth = 500;
    const courtHeight = 300;
    
    doc.rect(courtX, courtY, courtWidth, courtHeight).stroke();
    doc.text('Home Team', courtX + courtWidth / 4, courtY - 20, { align: 'center', width: courtWidth / 2 });
    doc.text('Away Team', courtX + 3 * courtWidth / 4, courtY - 20, { align: 'center', width: courtWidth / 2 });
    
    // Plot shots
    data.shotChart.forEach(shot => {
      const x = courtX + (shot.x_coord / 100) * courtWidth;
      const y = courtY + (shot.y_coord / 100) * courtHeight;
      
      if (shot.result === 'goal') {
        doc.circle(x, y, 3).fillAndStroke('#00FF00', '#000000');
      } else if (shot.result === 'miss') {
        doc.circle(x, y, 3).fillAndStroke('#FF0000', '#000000');
      } else {
        doc.circle(x, y, 3).fillAndStroke('#FFA500', '#000000');
      }
    });
    
    // Legend
    doc.moveDown(12);
    doc.fontSize(10);
    doc.circle(70, doc.y, 3).fillAndStroke('#00FF00', '#000000');
    doc.text('Goal', 80, doc.y - 5);
    doc.circle(150, doc.y, 3).fillAndStroke('#FF0000', '#000000');
    doc.text('Miss', 160, doc.y - 5);
    doc.circle(230, doc.y, 3).fillAndStroke('#FFA500', '#000000');
    doc.text('Blocked', 240, doc.y - 5);

    // Finalize PDF
    doc.end();

  } catch (err) {
    console.error('Error generating post-match report:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * Generate Player Performance Report
 * GET /api/reports/games/:gameId/player/:playerId
 */
router.get('/games/:gameId/player/:playerId', [
  param('gameId').isInt().withMessage('Game ID must be an integer'),
  param('playerId').isInt().withMessage('Player ID must be an integer')
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
        COUNT(s.id) as total_shots,
        COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals,
        COUNT(CASE WHEN s.result = 'miss' THEN 1 END) as misses,
        COUNT(CASE WHEN s.result = 'blocked' THEN 1 END) as blocked,
        ROUND(
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(s.id)::numeric, 0) * 100, 
          2
        ) as fg_percentage,
        ROUND(AVG(s.distance), 2) as avg_distance,
        COUNT(CASE WHEN s.x_coord < 33.33 THEN 1 END) as left_zone_shots,
        COUNT(CASE WHEN s.x_coord >= 33.33 AND s.x_coord < 66.67 THEN 1 END) as center_zone_shots,
        COUNT(CASE WHEN s.x_coord >= 66.67 THEN 1 END) as right_zone_shots
      FROM players p
      JOIN teams t ON p.team_id = t.id
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
  const { gameId, playerId } = req.params;

  try {
    // Get player info
    const playerResult = await db.query(`
      SELECT p.*, t.name as team_name
      FROM players p
      JOIN teams t ON p.team_id = t.id
      WHERE p.id = $1
    `, [playerId]);

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = playerResult.rows[0];

    // Get game info
    const gameResult = await db.query(`
      SELECT g.*, ht.name as home_team_name, at.name as away_team_name
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.id
      JOIN teams at ON g.away_team_id = at.id
      WHERE g.id = $1
    `, [gameId]);

    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = gameResult.rows[0];

    // Get player stats for this game
    const statsResult = await db.query(`
      SELECT 
        COUNT(*) as total_shots,
        COUNT(CASE WHEN result = 'goal' THEN 1 END) as goals,
        COUNT(CASE WHEN result = 'miss' THEN 1 END) as misses,
        COUNT(CASE WHEN result = 'blocked' THEN 1 END) as blocked,
        ROUND(AVG(distance), 2) as avg_distance,
        ROUND(
          COUNT(CASE WHEN result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as fg_percentage
      FROM shots
      WHERE game_id = $1 AND player_id = $2
    `, [gameId, playerId]);

    const stats = statsResult.rows[0];

    // Get shooting by zone
    const zoneStats = await db.query(`
      SELECT 
        CASE 
          WHEN x_coord < 33.33 THEN 'Left'
          WHEN x_coord >= 33.33 AND x_coord < 66.67 THEN 'Center'
          ELSE 'Right'
        END as zone,
        COUNT(*) as shots,
        COUNT(CASE WHEN result = 'goal' THEN 1 END) as goals,
        ROUND(
          COUNT(CASE WHEN result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as fg_percentage
      FROM shots
      WHERE game_id = $1 AND player_id = $2
      GROUP BY zone
    `, [gameId, playerId]);

    // Get season average
    const seasonAvg = await db.query(`
      SELECT 
        COUNT(*) as total_shots,
        COUNT(CASE WHEN result = 'goal' THEN 1 END) as goals,
        ROUND(
          COUNT(CASE WHEN result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as fg_percentage
      FROM shots s
      JOIN games g ON s.game_id = g.id
      WHERE s.player_id = $1 AND g.status = 'completed'
    `, [playerId]);

    // Get substitutions
    const subsResult = await db.query(`
      SELECT 
        period,
        CASE 
          WHEN player_in_id = $2 THEN 'in'
          WHEN player_out_id = $2 THEN 'out'
        END as type
      FROM substitutions
      WHERE game_id = $1 AND (player_in_id = $2 OR player_out_id = $2)
      ORDER BY period
    `, [gameId, playerId]);

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=player-report-${playerId}-game-${gameId}.pdf`);
    
    // Pipe the PDF to the response
    doc.pipe(res);

    // Add header
    addPDFHeader(doc, 'Player Performance Report');

    // Player & Game Information
    doc.fontSize(14).font('Helvetica-Bold').text('Player Information', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Name: ${player.first_name} ${player.last_name}`);
    doc.text(`Jersey Number: #${player.jersey_number}`);
    doc.text(`Team: ${player.team_name}`);
    doc.moveDown();
    
    doc.fontSize(14).font('Helvetica-Bold').text('Game Information', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Match: ${game.home_team_name} vs ${game.away_team_name}`);
    doc.text(`Date: ${new Date(game.date).toLocaleString()}`);
    doc.moveDown();

    // Match Statistics
    doc.fontSize(14).font('Helvetica-Bold').text('Match Statistics', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total Shots: ${stats.total_shots}`);
    doc.text(`Goals: ${stats.goals}`);
    doc.text(`Misses: ${stats.misses}`);
    doc.text(`Blocked: ${stats.blocked}`);
    doc.text(`Field Goal %: ${stats.fg_percentage || 0}%`);
    doc.text(`Average Distance: ${stats.avg_distance || 0}m`);
    doc.moveDown();

    // Shooting Efficiency by Zone
    doc.fontSize(14).font('Helvetica-Bold').text('Shooting Efficiency by Zone', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    zoneStats.rows.forEach(zone => {
      doc.text(`${zone.zone} Zone: ${zone.goals}/${zone.shots} (${zone.fg_percentage || 0}%)`);
    });
    doc.moveDown();

    // Substitutions
    doc.fontSize(14).font('Helvetica-Bold').text('Substitutions', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    if (subsResult.rows.length > 0) {
      subsResult.rows.forEach(sub => {
        doc.text(`Period ${sub.period}: ${sub.type === 'in' ? 'Entered' : 'Exited'} court`);
      });
    } else {
      doc.text('No substitutions recorded (likely started and completed game)');
    }
    doc.moveDown();

    // Season Comparison
    doc.fontSize(14).font('Helvetica-Bold').text('Season Comparison', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text('This Game vs Season Average:');
    doc.text(`  FG%: ${stats.fg_percentage || 0}% vs ${seasonAvg.rows[0].fg_percentage || 0}%`);
    doc.text(`  Total Goals This Game: ${stats.goals}`);
    doc.text(`  Career Total Goals: ${seasonAvg.rows[0].goals || 0}`);
    doc.moveDown();

    // Performance Notes
    doc.fontSize(14).font('Helvetica-Bold').text('Performance Notes', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    if (parseFloat(stats.fg_percentage || 0) > parseFloat(seasonAvg.rows[0].fg_percentage || 0)) {
      doc.text('✓ Above season average shooting percentage');
    } else {
      doc.text('• Below season average shooting percentage');
    }
    
    if (parseInt(stats.goals) > 0) {
      doc.text(`✓ Scored ${stats.goals} goal${parseInt(stats.goals) > 1 ? 's' : ''}`);
    }

    // Finalize PDF
    doc.end();

  } catch (err) {
    console.error('Error generating player report:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * Generate Coach's Analysis Report
 * POST /api/reports/games/:gameId/coach-analysis
 */
router.post('/games/:gameId/coach-analysis', [
  requireRole(['admin', 'coach']),
  param('gameId').isInt().withMessage('Game ID must be an integer'),
  body('notes').optional().isString().withMessage('Notes must be a string')
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
  const { notes } = req.body;

  try {
    const data = await fetchGameData(gameId);
    
    if (!data) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Get possession stats
    const possessionStats = await db.query(`
      SELECT 
        t.name as team_name,
        COUNT(bp.id) as total_possessions,
        ROUND(AVG(bp.duration_seconds), 2) as avg_possession_duration,
        ROUND(AVG(bp.shots_taken), 2) as avg_shots_per_possession,
        COUNT(CASE WHEN bp.result = 'goal' THEN 1 END) as possessions_ending_in_goal,
        COUNT(CASE WHEN bp.result = 'turnover' THEN 1 END) as turnovers
      FROM ball_possessions bp
      JOIN teams t ON bp.team_id = t.id
      WHERE bp.game_id = $1
      GROUP BY t.name
    `, [gameId]);

    // Get timeout effectiveness
    const timeoutStats = await db.query(`
      SELECT 
        t.name as team_name,
        COUNT(timeout_alias.id) as timeouts_used,
        timeout_alias.period
      FROM timeouts timeout_alias
      LEFT JOIN teams t ON timeout_alias.team_id = t.id
      WHERE timeout_alias.game_id = $1 AND timeout_alias.team_id IS NOT NULL
      GROUP BY t.name, timeout_alias.period
      ORDER BY timeout_alias.period
    `, [gameId]);

    // Get substitution patterns
    const subPatterns = await db.query(`
      SELECT 
        t.name as team_name,
        s.period,
        COUNT(*) as substitutions_count,
        s.reason
      FROM substitutions s
      JOIN teams t ON s.team_id = t.id
      WHERE s.game_id = $1
      GROUP BY t.name, s.period, s.reason
      ORDER BY s.period
    `, [gameId]);

    // Get quarter-by-quarter momentum
    const periodMomentum = await db.query(`
      SELECT 
        period,
        team_id,
        t.name as team_name,
        COUNT(*) as shots_taken,
        COUNT(CASE WHEN result = 'goal' THEN 1 END) as goals_scored,
        ROUND(
          COUNT(CASE WHEN result = 'goal' THEN 1 END)::numeric / 
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
      JOIN teams t ON s.team_id = t.id
      WHERE s.game_id = $1
      GROUP BY period, team_id, t.name
      ORDER BY period, team_id
    `, [gameId]);

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=coach-analysis-${gameId}.pdf`);
    
    // Pipe the PDF to the response
    doc.pipe(res);

    // Add header
    addPDFHeader(doc, 'Coach\'s Analysis Report');

    // Game Information
    doc.fontSize(14).font('Helvetica-Bold').text('Game Overview', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Match: ${data.game.home_team_name} vs ${data.game.away_team_name}`);
    doc.text(`Date: ${new Date(data.game.date).toLocaleString()}`);
    doc.text(`Final Score: ${data.game.home_score} - ${data.game.away_score}`);
    doc.moveDown();

    // Tactical Insights - Possession Stats
    doc.fontSize(14).font('Helvetica-Bold').text('Tactical Insights', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').text('Possession Statistics');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    
    possessionStats.rows.forEach(team => {
      doc.text(`${team.team_name}:`);
      doc.text(`  Total Possessions: ${team.total_possessions}`);
      doc.text(`  Avg Possession Duration: ${team.avg_possession_duration || 0}s`);
      doc.text(`  Avg Shots per Possession: ${team.avg_shots_per_possession || 0}`);
      doc.text(`  Possessions Ending in Goal: ${team.possessions_ending_in_goal}`);
      doc.text(`  Turnovers: ${team.turnovers}`);
      doc.moveDown(0.5);
    });

    // Timeout Effectiveness
    doc.fontSize(12).font('Helvetica-Bold').text('Timeout Usage');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    
    const timeoutsByTeam = {};
    timeoutStats.rows.forEach(t => {
      if (!timeoutsByTeam[t.team_name]) {
        timeoutsByTeam[t.team_name] = [];
      }
      timeoutsByTeam[t.team_name].push(`Period ${t.period}`);
    });
    
    Object.entries(timeoutsByTeam).forEach(([team, periods]) => {
      doc.text(`${team}: ${periods.join(', ')} (${periods.length} total)`);
    });
    doc.moveDown();

    // Substitution Patterns Analysis
    doc.addPage();
    doc.fontSize(14).font('Helvetica-Bold').text('Substitution Patterns', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    const subsByTeam = {};
    subPatterns.rows.forEach(sub => {
      if (!subsByTeam[sub.team_name]) {
        subsByTeam[sub.team_name] = {};
      }
      if (!subsByTeam[sub.team_name][sub.period]) {
        subsByTeam[sub.team_name][sub.period] = { total: 0, reasons: {} };
      }
      subsByTeam[sub.team_name][sub.period].total += parseInt(sub.substitutions_count);
      subsByTeam[sub.team_name][sub.period].reasons[sub.reason || 'tactical'] = parseInt(sub.substitutions_count);
    });
    
    Object.entries(subsByTeam).forEach(([team, periods]) => {
      doc.text(`${team}:`, { underline: true });
      Object.entries(periods).forEach(([period, data]) => {
        const reasons = Object.entries(data.reasons).map(([r, c]) => `${c} ${r}`).join(', ');
        doc.text(`  Period ${period}: ${data.total} substitutions (${reasons})`);
      });
      doc.moveDown(0.5);
    });

    // Quarter-by-Quarter Momentum
    doc.fontSize(14).font('Helvetica-Bold').text('Period-by-Period Momentum Analysis', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    const periodsByNum = {};
    periodMomentum.rows.forEach(p => {
      if (!periodsByNum[p.period]) {
        periodsByNum[p.period] = [];
      }
      periodsByNum[p.period].push(p);
    });
    
    Object.entries(periodsByNum).forEach(([period, teams]) => {
      doc.text(`Period ${period}:`);
      teams.forEach(team => {
        doc.text(`  ${team.team_name}: ${team.goals_scored} goals on ${team.shots_taken} shots (${team.fg_percentage || 0}% FG)`);
      });
      doc.moveDown(0.5);
    });

    // Opponent Analysis
    doc.addPage();
    doc.fontSize(14).font('Helvetica-Bold').text('Opponent Analysis', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    data.teamStats.forEach(team => {
      doc.text(`${team.team_name}:`, { underline: true });
      doc.text('Strengths:');
      if (parseFloat(team.fg_percentage) > 40) {
        doc.text(`  • Strong shooting efficiency (${team.fg_percentage}%)`);
      }
      if (parseInt(team.total_shots) > 30) {
        doc.text(`  • High shot volume (${team.total_shots} attempts)`);
      }
      
      doc.text('Weaknesses:');
      if (parseFloat(team.fg_percentage) < 35) {
        doc.text(`  • Low shooting efficiency (${team.fg_percentage}%)`);
      }
      if (parseInt(team.blocked) > 3) {
        doc.text(`  • High number of blocked shots (${team.blocked})`);
      }
      doc.moveDown();
    });

    // Coach's Recommendations
    doc.fontSize(14).font('Helvetica-Bold').text('Recommendations & Notes', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    if (notes) {
      doc.text(notes);
    } else {
      doc.text('No additional notes provided.');
    }

    // Finalize PDF
    doc.end();

  } catch (err) {
    console.error('Error generating coach analysis report:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

export default router;
