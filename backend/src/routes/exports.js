import express from 'express';
import { param, query, body, validationResult } from 'express-validator';
import PDFDocument from 'pdfkit';
import { stringify } from 'csv-stringify';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

/**
 * Helper function to fetch game data with all related information
 */
async function fetchGameData(gameId) {
  // Fetch game details
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

  // Fetch shots
  const shotsResult = await db.query(`
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
    ORDER BY s.period, s.created_at
  `, [gameId]);

  // Fetch events
  const eventsResult = await db.query(`
    SELECT 
      ge.*,
      p.first_name,
      p.last_name,
      p.jersey_number,
      t.name as team_name
    FROM game_events ge
    LEFT JOIN players p ON ge.player_id = p.id
    JOIN teams t ON ge.team_id = t.id
    WHERE ge.game_id = $1
    ORDER BY ge.period, ge.created_at
  `, [gameId]);

  // Fetch player stats
  const playersResult = await db.query(`
    SELECT 
      p.id,
      p.first_name,
      p.last_name,
      p.jersey_number,
      t.name as team_name,
      gr.is_captain,
      gr.is_starting,
      gr.starting_position,
      COUNT(DISTINCT s.id) FILTER (WHERE s.result = 'goal') as goals,
      COUNT(DISTINCT s.id) as total_shots
    FROM game_rosters gr
    JOIN players p ON gr.player_id = p.id
    JOIN teams t ON gr.team_id = t.id
    LEFT JOIN shots s ON s.player_id = p.id AND s.game_id = gr.game_id
    WHERE gr.game_id = $1
    GROUP BY p.id, p.first_name, p.last_name, p.jersey_number, t.name, gr.is_captain, gr.is_starting, gr.starting_position
    ORDER BY t.name, p.jersey_number
  `, [gameId]);

  return {
    game,
    shots: shotsResult.rows,
    events: eventsResult.rows,
    players: playersResult.rows
  };
}

/**
 * Helper function to fetch season data
 */
async function fetchSeasonData(teamId, startDate, endDate) {
  const params = [];
  let whereConditions = [];
  let paramIndex = 1;

  if (teamId) {
    whereConditions.push(`(g.home_team_id = $${paramIndex} OR g.away_team_id = $${paramIndex})`);
    params.push(teamId);
    paramIndex++;
  }

  if (startDate) {
    whereConditions.push(`g.date >= $${paramIndex}`);
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    whereConditions.push(`g.date <= $${paramIndex}`);
    params.push(endDate);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const gamesResult = await db.query(`
    SELECT 
      g.*,
      ht.name as home_team_name,
      at.name as away_team_name
    FROM games g
    JOIN teams ht ON g.home_team_id = ht.id
    JOIN teams at ON g.away_team_id = at.id
    ${whereClause}
    ORDER BY g.date DESC
  `, params);

  return gamesResult.rows;
}

/**
 * Helper function to generate PDF for a game
 */
function generateGamePDF(gameData, template = 'summary') {
  const doc = new PDFDocument({ margin: 50 });
  const { game, shots, events, players } = gameData;

  // Title
  doc.fontSize(20).text('Match Report', { align: 'center' });
  doc.moveDown();

  // Game information
  doc.fontSize(14).text(`${game.home_team_name} vs ${game.away_team_name}`, { align: 'center' });
  doc.fontSize(10).text(`Date: ${new Date(game.date).toLocaleDateString()}`, { align: 'center' });
  doc.fontSize(16).text(`Score: ${game.home_score} - ${game.away_score}`, { align: 'center' });
  doc.moveDown();

  if (template === 'summary' || template === 'detailed') {
    // Shots summary
    doc.fontSize(14).text('Shots Summary');
    doc.fontSize(10);
    const homeShots = shots.filter(s => s.team_name === game.home_team_name);
    const awayShots = shots.filter(s => s.team_name === game.away_team_name);
    const homeGoals = homeShots.filter(s => s.result === 'goal').length;
    const awayGoals = awayShots.filter(s => s.result === 'goal').length;
    
    doc.text(`${game.home_team_name}: ${homeGoals} goals from ${homeShots.length} shots`);
    doc.text(`${game.away_team_name}: ${awayGoals} goals from ${awayShots.length} shots`);
    doc.moveDown();
  }

  if (template === 'detailed') {
    // Detailed shots
    doc.fontSize(14).text('Shot Details');
    doc.fontSize(8);
    shots.forEach(shot => {
      doc.text(`P${shot.period} - ${shot.first_name} ${shot.last_name} (#${shot.jersey_number}) - ${shot.result.toUpperCase()}`);
    });
    doc.moveDown();

    // Events
    if (events.length > 0) {
      doc.fontSize(14).text('Events');
      doc.fontSize(8);
      events.forEach(event => {
        const playerInfo = event.first_name ? `${event.first_name} ${event.last_name} (#${event.jersey_number})` : 'Team';
        doc.text(`P${event.period} - ${event.event_type}: ${playerInfo}`);
      });
      doc.moveDown();
    }
  }

  if (template === 'coach' || template === 'detailed') {
    // Player statistics
    doc.fontSize(14).text('Player Statistics');
    doc.fontSize(8);
    
    const homeTeamPlayers = players.filter(p => p.team_name === game.home_team_name);
    const awayTeamPlayers = players.filter(p => p.team_name === game.away_team_name);

    doc.fontSize(12).text(`${game.home_team_name}`);
    doc.fontSize(8);
    homeTeamPlayers.forEach(player => {
      const captainMark = player.is_captain ? ' (C)' : '';
      doc.text(`#${player.jersey_number} ${player.first_name} ${player.last_name}${captainMark} - ${player.goals}/${player.total_shots} shots`);
    });
    doc.moveDown();

    doc.fontSize(12).text(`${game.away_team_name}`);
    doc.fontSize(8);
    awayTeamPlayers.forEach(player => {
      const captainMark = player.is_captain ? ' (C)' : '';
      doc.text(`#${player.jersey_number} ${player.first_name} ${player.last_name}${captainMark} - ${player.goals}/${player.total_shots} shots`);
    });
  }

  doc.end();
  return doc;
}

/**
 * Helper function to generate CSV for shots
 */
function generateShotsCSV(shots) {
  return new Promise((resolve, reject) => {
    const columns = ['Period', 'Player', 'Jersey Number', 'Team', 'Result', 'X Coord', 'Y Coord', 'Shot Type', 'Distance'];
    const data = shots.map(s => [
      s.period,
      `${s.first_name} ${s.last_name}`,
      s.jersey_number,
      s.team_name,
      s.result,
      s.x_coord,
      s.y_coord,
      s.shot_type || '',
      s.distance || ''
    ]);

    stringify([columns, ...data], (err, output) => {
      if (err) reject(err);
      else resolve(output);
    });
  });
}

/**
 * Helper function to generate CSV for events
 */
function generateEventsCSV(events) {
  return new Promise((resolve, reject) => {
    const columns = ['Period', 'Event Type', 'Player', 'Jersey Number', 'Team', 'Details'];
    const data = events.map(e => [
      e.period,
      e.event_type,
      e.first_name ? `${e.first_name} ${e.last_name}` : 'N/A',
      e.jersey_number || 'N/A',
      e.team_name,
      e.details ? JSON.stringify(e.details) : ''
    ]);

    stringify([columns, ...data], (err, output) => {
      if (err) reject(err);
      else resolve(output);
    });
  });
}

/**
 * Helper function to generate CSV for players
 */
function generatePlayersCSV(players) {
  return new Promise((resolve, reject) => {
    const columns = ['Jersey Number', 'First Name', 'Last Name', 'Team', 'Captain', 'Starting', 'Position', 'Goals', 'Total Shots'];
    const data = players.map(p => [
      p.jersey_number,
      p.first_name,
      p.last_name,
      p.team_name,
      p.is_captain ? 'Yes' : 'No',
      p.is_starting ? 'Yes' : 'No',
      p.starting_position || '',
      p.goals,
      p.total_shots
    ]);

    stringify([columns, ...data], (err, output) => {
      if (err) reject(err);
      else resolve(output);
    });
  });
}

/**
 * POST /api/exports/match-pdf/:gameId
 * Generate comprehensive match PDF report
 * Optional parameters: template (summary/detailed/coach)
 */
router.post('/match-pdf/:gameId', [
  requireRole(['admin', 'coach']),
  param('gameId')
    .isInt({ min: 1 })
    .withMessage('Game ID must be a positive integer'),
  body('template')
    .optional()
    .isIn(['summary', 'detailed', 'coach'])
    .withMessage('Template must be summary, detailed, or coach')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { gameId } = req.params;
  const { template = 'summary' } = req.body;

  try {
    const gameData = await fetchGameData(gameId);
    
    if (!gameData) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const doc = generateGamePDF(gameData, template);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=match-${gameId}-${template}.pdf`);
    
    doc.pipe(res);
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Error generating match PDF:', err);
    }
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

/**
 * GET /api/exports/match-csv/:gameId
 * Export match data as CSV
 * Query params: sections (shots/events/players) - comma-separated
 */
router.get('/match-csv/:gameId', [
  requireRole(['admin', 'coach']),
  param('gameId')
    .isInt({ min: 1 })
    .withMessage('Game ID must be a positive integer'),
  query('sections')
    .optional()
    .custom((value) => {
      const validSections = ['shots', 'events', 'players'];
      const sections = value.split(',');
      return sections.every(s => validSections.includes(s.trim()));
    })
    .withMessage('Sections must be comma-separated values from: shots, events, players')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { gameId } = req.params;
  const { sections = 'shots,events,players' } = req.query;
  const requestedSections = sections.split(',').map(s => s.trim());

  try {
    const gameData = await fetchGameData(gameId);
    
    if (!gameData) {
      return res.status(404).json({ error: 'Game not found' });
    }

    let csvOutput = '';

    if (requestedSections.includes('shots') && gameData.shots.length > 0) {
      csvOutput += '=== SHOTS ===\n';
      csvOutput += await generateShotsCSV(gameData.shots);
      csvOutput += '\n\n';
    }

    if (requestedSections.includes('events') && gameData.events.length > 0) {
      csvOutput += '=== EVENTS ===\n';
      csvOutput += await generateEventsCSV(gameData.events);
      csvOutput += '\n\n';
    }

    if (requestedSections.includes('players') && gameData.players.length > 0) {
      csvOutput += '=== PLAYERS ===\n';
      csvOutput += await generatePlayersCSV(gameData.players);
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=match-${gameId}.csv`);
    res.send(csvOutput);
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Error generating match CSV:', err);
    }
    res.status(500).json({ error: 'Failed to generate CSV' });
  }
});

/**
 * POST /api/exports/season-pdf
 * Generate season report PDF
 * Body: { team_id, season_id, start_date, end_date }
 */
router.post('/season-pdf', [
  requireRole(['admin', 'coach']),
  body('team_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Team ID must be a positive integer'),
  body('start_date')
    .optional()
    .isISO8601()
    .withMessage('Start date must be in ISO 8601 format'),
  body('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be in ISO 8601 format')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { team_id, start_date, end_date } = req.body;

  try {
    const games = await fetchSeasonData(team_id, start_date, end_date);
    
    if (games.length === 0) {
      return res.status(404).json({ error: 'No games found for the specified criteria' });
    }

    const doc = new PDFDocument({ margin: 50 });
    
    // Title
    doc.fontSize(20).text('Season Report', { align: 'center' });
    doc.moveDown();

    // Filter info
    doc.fontSize(10);
    if (team_id) {
      // Fetch the team name directly from the database to ensure accuracy
      const teamResult = await db.query('SELECT name FROM teams WHERE id = $1', [team_id]);
      const teamName = teamResult.rows.length > 0 ? teamResult.rows[0].name : 'Unknown Team';
      doc.text(`Team: ${teamName}`);
    }
    if (start_date) doc.text(`From: ${new Date(start_date).toLocaleDateString()}`);
    if (end_date) doc.text(`To: ${new Date(end_date).toLocaleDateString()}`);
    doc.moveDown();

    // Games summary
    doc.fontSize(14).text('Games Summary');
    doc.fontSize(10);
    doc.text(`Total Games: ${games.length}`);
    doc.text(`Completed: ${games.filter(g => g.status === 'completed').length}`);
    doc.text(`In Progress: ${games.filter(g => g.status === 'in_progress').length}`);
    doc.text(`Scheduled: ${games.filter(g => g.status === 'scheduled').length}`);
    doc.moveDown();

    // List of games
    doc.fontSize(12).text('Game Results');
    doc.fontSize(8);
    games.forEach(game => {
      doc.text(
        `${new Date(game.date).toLocaleDateString()} - ${game.home_team_name} ${game.home_score} - ${game.away_score} ${game.away_team_name} (${game.status})`
      );
    });

    doc.end();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=season-report.pdf');
    
    doc.pipe(res);
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Error generating season PDF:', err);
    }
    res.status(500).json({ error: 'Failed to generate season PDF' });
  }
});

/**
 * GET /api/exports/season-csv
 * Export season data as CSV
 * Query params: team_id, player_id, start_date, end_date
 */
router.get('/season-csv', [
  requireRole(['admin', 'coach']),
  query('team_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Team ID must be a positive integer'),
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('Start date must be in ISO 8601 format'),
  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be in ISO 8601 format')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { team_id, start_date, end_date } = req.query;

  try {
    const games = await fetchSeasonData(team_id, start_date, end_date);
    
    if (games.length === 0) {
      return res.status(404).json({ error: 'No games found for the specified criteria' });
    }

    const columns = ['Date', 'Home Team', 'Away Team', 'Home Score', 'Away Score', 'Status', 'Periods'];
    const data = games.map(g => [
      new Date(g.date).toISOString(),
      g.home_team_name,
      g.away_team_name,
      g.home_score,
      g.away_score,
      g.status,
      g.current_period
    ]);

    stringify([columns, ...data], (err, output) => {
      if (err) {
        if (process.env.NODE_ENV !== 'test') {
          console.error('Error generating season CSV:', err);
        }
        return res.status(500).json({ error: 'Failed to generate CSV' });
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=season-report.csv');
      res.send(output);
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Error generating season CSV:', err);
    }
    res.status(500).json({ error: 'Failed to generate season CSV' });
  }
});

/**
 * POST /api/exports/bulk
 * Bulk export multiple games
 * Body: { game_ids: [], format: 'pdf'|'csv', template }
 */
router.post('/bulk', [
  requireRole(['admin', 'coach']),
  body('game_ids')
    .isArray({ min: 1 })
    .withMessage('game_ids must be a non-empty array'),
  body('game_ids.*')
    .isInt({ min: 1 })
    .withMessage('Each game ID must be a positive integer'),
  body('format')
    .isIn(['pdf', 'csv'])
    .withMessage('Format must be pdf or csv')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { game_ids, format } = req.body;

  // Defensive check to ensure game_ids is a real array and also cap its size
  if (!Array.isArray(game_ids)) {
    return res.status(400).json({ error: 'game_ids must be an array' });
  }
  const MAX_BULK_GAMES = 1000;
  if (game_ids.length > MAX_BULK_GAMES) {
    return res.status(400).json({ error: `Cannot export more than ${MAX_BULK_GAMES} games at once` });
  }

  try {
    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 50 });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=bulk-export.pdf');
      
      doc.pipe(res);

      doc.fontSize(20).text('Bulk Match Export', { align: 'center' });
      doc.moveDown();

      for (let i = 0; i < game_ids.length; i++) {
        const gameData = await fetchGameData(game_ids[i]);
        
        if (!gameData) {
          doc.fontSize(10).text(`Game ${game_ids[i]} not found`);
          doc.moveDown();
          continue;
        }

        const { game, shots, players: _players } = gameData;

        // Add page break between games (except for first game)
        if (i > 0) {
          doc.addPage();
        }

        doc.fontSize(16).text(`${game.home_team_name} vs ${game.away_team_name}`, { align: 'center' });
        doc.fontSize(10).text(`Date: ${new Date(game.date).toLocaleDateString()}`, { align: 'center' });
        doc.fontSize(14).text(`Score: ${game.home_score} - ${game.away_score}`, { align: 'center' });
        doc.moveDown();

        // Shots summary
        const homeShots = shots.filter(s => s.team_name === game.home_team_name);
        const awayShots = shots.filter(s => s.team_name === game.away_team_name);
        const homeGoals = homeShots.filter(s => s.result === 'goal').length;
        const awayGoals = awayShots.filter(s => s.result === 'goal').length;
        
        doc.fontSize(10);
        doc.text(`${game.home_team_name}: ${homeGoals}/${homeShots.length} shots`);
        doc.text(`${game.away_team_name}: ${awayGoals}/${awayShots.length} shots`);
      }

      doc.end();
    } else {
      // CSV format
      let csvOutput = '';

      for (const gameId of game_ids) {
        const gameData = await fetchGameData(gameId);
        
        if (!gameData) {
          csvOutput += `\n=== Game ${gameId} not found ===\n\n`;
          continue;
        }

        csvOutput += `\n=== GAME ${gameId}: ${gameData.game.home_team_name} vs ${gameData.game.away_team_name} ===\n`;
        csvOutput += `Date: ${new Date(gameData.game.date).toLocaleDateString()}\n`;
        csvOutput += `Score: ${gameData.game.home_score} - ${gameData.game.away_score}\n\n`;

        if (gameData.shots.length > 0) {
          csvOutput += await generateShotsCSV(gameData.shots);
          csvOutput += '\n\n';
        }
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=bulk-export.csv');
      res.send(csvOutput);
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Error generating bulk export:', err);
    }
    res.status(500).json({ error: 'Failed to generate bulk export' });
  }
});

/**
 * GET /api/exports/player-report/:playerId
 * Generate player performance report
 * Query params: season, format (pdf/csv)
 */
router.get('/player-report/:playerId', [
  requireRole(['admin', 'coach']),
  param('playerId')
    .isInt({ min: 1 })
    .withMessage('Player ID must be a positive integer'),
  query('format')
    .optional()
    .isIn(['pdf', 'csv'])
    .withMessage('Format must be pdf or csv')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { playerId } = req.params;
  const { format = 'pdf' } = req.query;

  try {
    // Fetch player info
    const playerResult = await db.query(`
      SELECT p.*, t.name as team_name
      FROM players p
      LEFT JOIN teams t ON p.team_id = t.id
      WHERE p.id = $1
    `, [playerId]);

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = playerResult.rows[0];

    // Fetch player's game statistics
    const statsResult = await db.query(`
      SELECT 
        g.id as game_id,
        g.date,
        ht.name as home_team_name,
        at.name as away_team_name,
        g.home_score,
        g.away_score,
        COUNT(s.id) FILTER (WHERE s.result = 'goal') as goals,
        COUNT(s.id) as total_shots
      FROM game_rosters gr
      JOIN games g ON gr.game_id = g.id
      JOIN teams ht ON g.home_team_id = ht.id
      JOIN teams at ON g.away_team_id = at.id
      LEFT JOIN shots s ON s.player_id = gr.player_id AND s.game_id = g.id
      WHERE gr.player_id = $1 AND g.status = 'completed'
      GROUP BY g.id, g.date, ht.name, at.name, g.home_score, g.away_score
      ORDER BY g.date DESC
    `, [playerId]);

    const games = statsResult.rows;

    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 50 });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=player-${playerId}-report.pdf`);
      
      doc.pipe(res);

      // Title
      doc.fontSize(20).text('Player Performance Report', { align: 'center' });
      doc.moveDown();

      // Player info
      doc.fontSize(14).text(`${player.first_name} ${player.last_name}`);
      doc.fontSize(10);
      doc.text(`Jersey Number: ${player.jersey_number || 'N/A'}`);
      doc.text(`Team: ${player.team_name || 'Free Agent'}`);
      doc.text(`Gender: ${player.gender || 'N/A'}`);
      doc.moveDown();

      // Career statistics
      const totalGoals = games.reduce((sum, g) => sum + parseInt(g.goals), 0);
      const totalShots = games.reduce((sum, g) => sum + parseInt(g.total_shots), 0);
      const shootingPercentage = totalShots > 0 ? ((totalGoals / totalShots) * 100).toFixed(1) : 0;

      doc.fontSize(12).text('Career Statistics');
      doc.fontSize(10);
      doc.text(`Games Played: ${games.length}`);
      doc.text(`Total Goals: ${totalGoals}`);
      doc.text(`Total Shots: ${totalShots}`);
      doc.text(`Shooting Percentage: ${shootingPercentage}%`);
      doc.moveDown();

      // Game-by-game breakdown
      if (games.length > 0) {
        doc.fontSize(12).text('Game-by-Game Breakdown');
        doc.fontSize(8);
        games.forEach(game => {
          doc.text(
            `${new Date(game.date).toLocaleDateString()} - ${game.home_team_name} ${game.home_score}-${game.away_score} ${game.away_team_name} | ${game.goals}/${game.total_shots} shots`
          );
        });
      }

      doc.end();
    } else {
      // CSV format
      const columns = ['Date', 'Home Team', 'Away Team', 'Score', 'Goals', 'Total Shots'];
      const data = games.map(g => [
        new Date(g.date).toLocaleDateString(),
        g.home_team_name,
        g.away_team_name,
        `${g.home_score}-${g.away_score}`,
        g.goals,
        g.total_shots
      ]);

      stringify([columns, ...data], (err, output) => {
        if (err) {
          if (process.env.NODE_ENV !== 'test') {
            console.error('Error generating player CSV:', err);
          }
          return res.status(500).json({ error: 'Failed to generate CSV' });
        }

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=player-${playerId}-report.csv`);
        res.send(output);
      });
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Error generating player report:', err);
    }
    res.status(500).json({ error: 'Failed to generate player report' });
  }
});

export default router;
