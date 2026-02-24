import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

/**
 * Get all scheduled reports
 * Coaches see their own, admins see all
 */
router.get('/', [
  query('is_active').optional().isBoolean().withMessage('is_active must be boolean'),
  query('schedule_type').optional().isIn(['after_match', 'weekly', 'monthly', 'season_end']).withMessage('Invalid schedule type')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { is_active, schedule_type } = req.query;

  try {
    let queryText = `
      SELECT 
        sr.*,
        rt.name as template_name,
        t.name as team_name,
        u.username as created_by_username
      FROM scheduled_reports sr
      JOIN report_templates rt ON sr.template_id = rt.id
      LEFT JOIN teams t ON sr.team_id = t.id
      LEFT JOIN users u ON sr.created_by = u.id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramIndex = 1;

    // Non-admin users can only see their own scheduled reports
    if (req.user.role !== 'admin') {
      queryText += ` AND sr.created_by = $${paramIndex}`;
      queryParams.push(req.user.userId);
      paramIndex++;
    }

    if (is_active !== undefined) {
      queryText += ` AND sr.is_active = $${paramIndex}`;
      queryParams.push(is_active === 'true');
      paramIndex++;
    }

    if (schedule_type) {
      queryText += ` AND sr.schedule_type = $${paramIndex}`;
      queryParams.push(schedule_type);
      paramIndex++;
    }

    queryText += ' ORDER BY sr.created_at DESC';

    const result = await db.query(queryText, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching scheduled reports:', err);
    res.status(500).json({ error: 'Failed to fetch scheduled reports' });
  }
});

/**
 * Get a single scheduled report by ID
 */
router.get('/:id', [
  param('id').isInt().withMessage('Scheduled report ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;

  try {
    const result = await db.query(`
      SELECT 
        sr.*,
        rt.name as template_name,
        t.name as team_name,
        u.username as created_by_username
      FROM scheduled_reports sr
      JOIN report_templates rt ON sr.template_id = rt.id
      LEFT JOIN teams t ON sr.team_id = t.id
      LEFT JOIN users u ON sr.created_by = u.id
      WHERE sr.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scheduled report not found' });
    }

    const scheduledReport = result.rows[0];

    // Non-admin users can only access their own scheduled reports
    if (req.user.role !== 'admin' && scheduledReport.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied to this scheduled report' });
    }

    res.json(scheduledReport);
  } catch (err) {
    console.error('Error fetching scheduled report:', err);
    res.status(500).json({ error: 'Failed to fetch scheduled report' });
  }
});

/**
 * Create a new scheduled report
 * Only coaches and admins can create scheduled reports
 */
router.post('/', [
  requireRole(['admin', 'coach']),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Scheduled report name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('template_id')
    .isInt()
    .withMessage('Template ID is required and must be an integer'),
  body('schedule_type')
    .isIn(['after_match', 'weekly', 'monthly', 'season_end'])
    .withMessage('Invalid schedule type'),
  body('team_id')
    .optional()
    .isInt()
    .withMessage('Team ID must be an integer'),
  body('game_filters')
    .optional()
    .isObject()
    .withMessage('Game filters must be an object'),
  body('send_email')
    .optional()
    .isBoolean()
    .withMessage('send_email must be boolean'),
  body('email_recipients')
    .optional()
    .isArray()
    .withMessage('Email recipients must be an array'),
  body('email_recipients.*')
    .optional()
    .isEmail()
    .withMessage('Invalid email address in recipients list'),
  body('email_subject')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Email subject must be less than 200 characters'),
  body('email_body')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Email body must be less than 2000 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const {
    name,
    template_id,
    schedule_type,
    team_id,
    game_filters = {},
    send_email = false,
    email_recipients = [],
    email_subject,
    email_body
  } = req.body;

  try {
    // Verify template exists and user has access
    const templateCheck = await db.query(
      'SELECT * FROM report_templates WHERE id = $1',
      [template_id]
    );

    if (templateCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = templateCheck.rows[0];

    if (!template.is_default && template.created_by !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You do not have access to this template' });
    }

    // Verify team exists if team_id provided
    if (team_id) {
      const teamCheck = await db.query('SELECT id FROM teams WHERE id = $1', [team_id]);
      if (teamCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Team not found' });
      }
    }

    const result = await db.query(`
      INSERT INTO scheduled_reports (
        name, created_by, template_id, schedule_type, is_active,
        team_id, game_filters, send_email, email_recipients,
        email_subject, email_body
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      name,
      req.user.userId,
      template_id,
      schedule_type,
      true,
      team_id || null,
      JSON.stringify(game_filters),
      send_email,
      JSON.stringify(email_recipients),
      email_subject || null,
      email_body || null
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating scheduled report:', err);
    res.status(500).json({ error: 'Failed to create scheduled report' });
  }
});

/**
 * Update a scheduled report
 * Only the creator or admins can update
 */
router.put('/:id', [
  requireRole(['admin', 'coach']),
  param('id').isInt().withMessage('Scheduled report ID must be an integer'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('template_id')
    .optional()
    .isInt()
    .withMessage('Template ID must be an integer'),
  body('schedule_type')
    .optional()
    .isIn(['after_match', 'weekly', 'monthly', 'season_end'])
    .withMessage('Invalid schedule type'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be boolean'),
  body('team_id')
    .optional()
    .custom((value) => value === null || Number.isInteger(value))
    .withMessage('Team ID must be an integer or null'),
  body('game_filters')
    .optional()
    .isObject()
    .withMessage('Game filters must be an object'),
  body('send_email')
    .optional()
    .isBoolean()
    .withMessage('send_email must be boolean'),
  body('email_recipients')
    .optional()
    .isArray()
    .withMessage('Email recipients must be an array'),
  body('email_subject')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Email subject must be less than 200 characters'),
  body('email_body')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Email body must be less than 2000 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;

  try {
    // Check if scheduled report exists
    const reportCheck = await db.query(
      'SELECT * FROM scheduled_reports WHERE id = $1',
      [id]
    );

    if (reportCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Scheduled report not found' });
    }

    const report = reportCheck.rows[0];

    // Only creator or admin can update
    if (req.user.role !== 'admin' && report.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'You do not have permission to update this scheduled report' });
    }

    // If template_id is being updated, verify it exists and user has access
    if (req.body.template_id) {
      const templateCheck = await db.query(
        'SELECT * FROM report_templates WHERE id = $1',
        [req.body.template_id]
      );

      if (templateCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const template = templateCheck.rows[0];

      if (!template.is_default && template.created_by !== req.user.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'You do not have access to this template' });
      }
    }

    // If team_id is being updated, verify it exists
    if (req.body.team_id !== undefined && req.body.team_id !== null) {
      const teamCheck = await db.query('SELECT id FROM clubs WHERE id = $1', [req.body.team_id]);
      if (teamCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Club not found' });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = [
      'name',
      'template_id',
      'schedule_type',
      'is_active',
      'team_id',
      'game_filters',
      'send_email',
      'email_recipients',
      'email_subject',
      'email_body'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        
        // JSON fields need to be stringified
        if (['game_filters', 'email_recipients'].includes(field)) {
          values.push(JSON.stringify(req.body[field]));
        } else {
          values.push(req.body[field]);
        }
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(id);

    const result = await db.query(`
      UPDATE scheduled_reports
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating scheduled report:', err);
    res.status(500).json({ error: 'Failed to update scheduled report' });
  }
});

/**
 * Delete a scheduled report
 * Only the creator or admins can delete
 */
router.delete('/:id', [
  requireRole(['admin', 'coach']),
  param('id').isInt().withMessage('Scheduled report ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;

  try {
    // Check if scheduled report exists
    const reportCheck = await db.query(
      'SELECT * FROM scheduled_reports WHERE id = $1',
      [id]
    );

    if (reportCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Scheduled report not found' });
    }

    const report = reportCheck.rows[0];

    // Only creator or admin can delete
    if (req.user.role !== 'admin' && report.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'You do not have permission to delete this scheduled report' });
    }

    await db.query('DELETE FROM scheduled_reports WHERE id = $1', [id]);

    res.json({ message: 'Scheduled report deleted successfully' });
  } catch (err) {
    console.error('Error deleting scheduled report:', err);
    res.status(500).json({ error: 'Failed to delete scheduled report' });
  }
});

export default router;

