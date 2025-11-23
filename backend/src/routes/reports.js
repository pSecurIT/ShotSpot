import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import crypto from 'crypto';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// Apply rate limiting middleware to all routes in this router
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
router.use(limiter);

/**
 * Get all report exports (history)
 * Users see their own reports, admins see all
 */
router.get('/', [
  query('report_type').optional().isIn(['game', 'player', 'team', 'season']).withMessage('Invalid report type'),
  query('format').optional().isIn(['pdf', 'csv', 'json']).withMessage('Invalid format'),
  query('game_id').optional().isInt().withMessage('Game ID must be an integer'),
  query('team_id').optional().isInt().withMessage('Team ID must be an integer'),
  query('player_id').optional().isInt().withMessage('Player ID must be an integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { report_type, format, game_id, team_id, player_id, limit = 50 } = req.query;

  try {
    let queryText = `
      SELECT 
        re.*,
        rt.name as template_name,
        u.username as generated_by_username,
        g.date as game_date,
        t.name as team_name,
        CONCAT(p.first_name, ' ', p.last_name) as player_name
      FROM report_exports re
      LEFT JOIN report_templates rt ON re.template_id = rt.id
      LEFT JOIN users u ON re.generated_by = u.id
      LEFT JOIN games g ON re.game_id = g.id
      LEFT JOIN teams t ON re.team_id = t.id
      LEFT JOIN players p ON re.player_id = p.id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramIndex = 1;

    // Non-admin users can only see their own reports or public reports
    if (req.user.role !== 'admin') {
      queryText += ` AND (re.generated_by = $${paramIndex} OR re.is_public = true)`;
      queryParams.push(req.user.id);
      paramIndex++;
    }

    if (report_type) {
      queryText += ` AND re.report_type = $${paramIndex}`;
      queryParams.push(report_type);
      paramIndex++;
    }

    if (format) {
      queryText += ` AND re.format = $${paramIndex}`;
      queryParams.push(format);
      paramIndex++;
    }

    if (game_id) {
      queryText += ` AND re.game_id = $${paramIndex}`;
      queryParams.push(game_id);
      paramIndex++;
    }

    if (team_id) {
      queryText += ` AND re.team_id = $${paramIndex}`;
      queryParams.push(team_id);
      paramIndex++;
    }

    if (player_id) {
      queryText += ` AND re.player_id = $${paramIndex}`;
      queryParams.push(player_id);
      paramIndex++;
    }

    queryText += ` ORDER BY re.created_at DESC LIMIT $${paramIndex}`;
    queryParams.push(limit);

    const result = await db.query(queryText, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching report exports:', err);
    res.status(500).json({ error: 'Failed to fetch report exports' });
  }
});

/**
 * Get a specific report export by ID
 */
router.get('/:id', [
  param('id').isInt().withMessage('Report ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;

  try {
    const result = await db.query(`
      SELECT 
        re.*,
        rt.name as template_name,
        u.username as generated_by_username
      FROM report_exports re
      LEFT JOIN report_templates rt ON re.template_id = rt.id
      LEFT JOIN users u ON re.generated_by = u.id
      WHERE re.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = result.rows[0];

    // Non-admin users can only access their own reports or public reports
    if (req.user.role !== 'admin' && report.generated_by !== req.user.id && !report.is_public) {
      return res.status(403).json({ error: 'Access denied to this report' });
    }

    // Increment access count
    await db.query(
      'UPDATE report_exports SET access_count = access_count + 1 WHERE id = $1',
      [id]
    );

    res.json(report);
  } catch (err) {
    console.error('Error fetching report export:', err);
    res.status(500).json({ error: 'Failed to fetch report export' });
  }
});

/**
 * Generate a new report
 * This endpoint creates a report export record and returns the generated data
 * In a full implementation, this would trigger PDF/CSV generation
 */
router.post('/generate', [
  requireRole(['admin', 'coach']),
  body('template_id')
    .isInt()
    .withMessage('Template ID is required and must be an integer'),
  body('report_type')
    .isIn(['game', 'player', 'team', 'season'])
    .withMessage('Invalid report type'),
  body('format')
    .isIn(['pdf', 'csv', 'json'])
    .withMessage('Invalid format'),
  body('game_id')
    .optional()
    .isInt()
    .withMessage('Game ID must be an integer'),
  body('team_id')
    .optional()
    .isInt()
    .withMessage('Team ID must be an integer'),
  body('player_id')
    .optional()
    .isInt()
    .withMessage('Player ID must be an integer'),
  body('date_range')
    .optional()
    .isObject()
    .withMessage('Date range must be an object'),
  body('report_name')
    .trim()
    .notEmpty()
    .withMessage('Report name is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Report name must be between 2 and 200 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const {
    template_id,
    report_type,
    format,
    game_id,
    team_id,
    player_id,
    date_range,
    report_name
  } = req.body;

  try {
    // Verify template exists and user has access
    const templateCheck = await db.query(
      'SELECT * FROM report_templates WHERE id = $1 AND is_active = true',
      [template_id]
    );

    if (templateCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found or inactive' });
    }

    const template = templateCheck.rows[0];

    if (!template.is_default && template.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You do not have access to this template' });
    }

    // Verify referenced entities exist
    if (game_id) {
      const gameCheck = await db.query('SELECT id FROM games WHERE id = $1', [game_id]);
      if (gameCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Game not found' });
      }
    }

    if (team_id) {
      const teamCheck = await db.query('SELECT id FROM teams WHERE id = $1', [team_id]);
      if (teamCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Team not found' });
      }
    }

    if (player_id) {
      const playerCheck = await db.query('SELECT id FROM players WHERE id = $1', [player_id]);
      if (playerCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Player not found' });
      }
    }

    // Get user's export settings to determine retention policy
    let expiresAt = null;
    const settingsResult = await db.query(
      'SELECT auto_delete_after_days FROM export_settings WHERE user_id = $1',
      [req.user.id]
    );

    if (settingsResult.rows.length > 0 && settingsResult.rows[0].auto_delete_after_days) {
      const days = settingsResult.rows[0].auto_delete_after_days;
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);
    }

    // Generate a unique share token
    const shareToken = crypto.randomBytes(32).toString('hex');

    // In a real implementation, this would generate the actual report file
    // For now, we'll create the record and return report data in JSON format
    let reportData = {};

    if (report_type === 'game' && game_id) {
      // Fetch game report data
      reportData = await generateGameReport(game_id, template, req.user);
    } else if (report_type === 'player' && player_id) {
      // Fetch player report data
      reportData = await generatePlayerReport(player_id, date_range, template, req.user);
    } else if (report_type === 'team' && team_id) {
      // Fetch team report data
      reportData = await generateTeamReport(team_id, date_range, template, req.user);
    } else if (report_type === 'season') {
      // Fetch season report data
      reportData = await generateSeasonReport(team_id, date_range, template, req.user);
    }

    // Create report export record
    const reportExport = await db.query(`
      INSERT INTO report_exports (
        template_id, generated_by, report_name, report_type, format,
        game_id, team_id, player_id, date_range, share_token, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      template_id,
      req.user.id,
      report_name,
      report_type,
      format,
      game_id || null,
      team_id || null,
      player_id || null,
      date_range ? JSON.stringify(date_range) : null,
      shareToken,
      expiresAt
    ]);

    res.status(201).json({
      report: reportExport.rows[0],
      data: reportData,
      message: 'Report generated successfully'
    });
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * Delete a report export
 * Only the creator or admins can delete
 */
router.delete('/:id', [
  requireRole(['admin', 'coach']),
  param('id').isInt().withMessage('Report ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;

  try {
    // Check if report exists
    const reportCheck = await db.query(
      'SELECT * FROM report_exports WHERE id = $1',
      [id]
    );

    if (reportCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reportCheck.rows[0];

    // Only creator or admin can delete
    if (req.user.role !== 'admin' && report.generated_by !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to delete this report' });
    }

    await db.query('DELETE FROM report_exports WHERE id = $1', [id]);

    res.json({ message: 'Report deleted successfully' });
  } catch (err) {
    console.error('Error deleting report:', err);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

// Helper functions for generating report data

async function generateGameReport(gameId, template, _user) {
  // Fetch comprehensive game data based on template sections
  const gameData = {};

  // Game info
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

  gameData.game_info = gameResult.rows[0];

  // Include sections based on template
  const sections = template.sections || [];

  if (sections.includes('shot_chart') || sections.includes('player_stats')) {
    // Fetch shots data
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
      ORDER BY s.created_at
    `, [gameId]);

    gameData.shots = shotsResult.rows;
  }

  if (sections.includes('player_stats')) {
    // Fetch player statistics (reuse analytics endpoint logic)
    // This would ideally call a shared service function
    gameData.player_stats = { message: 'Player stats would be included here' };
  }

  if (sections.includes('zone_analysis') || sections.includes('hot_cold_zones')) {
    gameData.zone_analysis = { message: 'Zone analysis would be included here' };
  }

  return gameData;
}

async function generatePlayerReport(playerId, _dateRange, _template, _user) {
  const playerData = {};

  // Player info
  const playerResult = await db.query(`
    SELECT 
      p.*,
      t.name as team_name
    FROM players p
    LEFT JOIN teams t ON p.team_id = t.id
    WHERE p.id = $1
  `, [playerId]);

  playerData.player_info = playerResult.rows[0];

  // Player statistics across games
  playerData.statistics = { message: 'Player statistics across date range would be included here' };

  return playerData;
}

async function generateTeamReport(teamId, _dateRange, _template, _user) {
  const teamData = {};

  // Team info
  const teamResult = await db.query(
    'SELECT * FROM teams WHERE id = $1',
    [teamId]
  );

  teamData.team_info = teamResult.rows[0];

  // Team statistics
  teamData.statistics = { message: 'Team statistics across date range would be included here' };

  return teamData;
}

async function generateSeasonReport(_teamId, _dateRange, _template, _user) {
  const seasonData = {};

  // Season overview
  seasonData.overview = { message: 'Season overview would be included here' };

  // Aggregate statistics
  seasonData.statistics = { message: 'Season aggregate statistics would be included here' };

  return seasonData;
}

export default router;
