import express from 'express';
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

    // Get substitutions for play time
    const subsResult = await db.query(`
      SELECT 
        period,
        EXTRACT(EPOCH FROM time_remaining) as time_remaining_seconds,
        CASE 
          WHEN player_in_id = $2 THEN 'in'
          WHEN player_out_id = $2 THEN 'out'
        END as type
      FROM substitutions
      WHERE game_id = $1 AND (player_in_id = $2 OR player_out_id = $2)
      ORDER BY period, time_remaining_seconds DESC
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
    doc.text(`  Goals per game: ${stats.goals} vs ${Math.round(seasonAvg.rows[0].goals / Math.max(1, seasonAvg.rows[0].total_shots / stats.total_shots || 1) * 100) / 100}`);
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
        COUNT(to.id) as timeouts_used,
        to.period
      FROM timeouts to
      JOIN teams t ON to.team_id = t.id
      WHERE to.game_id = $1
      GROUP BY t.name, to.period
      ORDER BY to.period
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
