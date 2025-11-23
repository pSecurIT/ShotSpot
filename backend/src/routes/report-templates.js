import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

/**
 * Get all report templates
 * Query params: type, is_default, is_active
 */
router.get('/', [
  query('type').optional().isIn(['summary', 'detailed', 'coach_focused', 'custom']).withMessage('Invalid template type'),
  query('is_default').optional().isBoolean().withMessage('is_default must be boolean'),
  query('is_active').optional().isBoolean().withMessage('is_active must be boolean')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { type, is_default, is_active } = req.query;

  try {
    let queryText = `
      SELECT 
        rt.*,
        u.username as created_by_username
      FROM report_templates rt
      LEFT JOIN users u ON rt.created_by = u.id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramIndex = 1;

    // Apply filters
    if (type) {
      queryText += ` AND rt.type = $${paramIndex}`;
      queryParams.push(type);
      paramIndex++;
    }

    if (is_default !== undefined) {
      queryText += ` AND rt.is_default = $${paramIndex}`;
      queryParams.push(is_default === 'true');
      paramIndex++;
    }

    if (is_active !== undefined) {
      queryText += ` AND rt.is_active = $${paramIndex}`;
      queryParams.push(is_active === 'true');
      paramIndex++;
    }

    // Non-admin users can only see default templates or their own custom templates
    if (req.user.role !== 'admin') {
      queryText += ` AND (rt.is_default = true OR rt.created_by = $${paramIndex})`;
      queryParams.push(req.user.id);
      paramIndex++;
    }

    queryText += ' ORDER BY rt.is_default DESC, rt.created_at DESC';

    const result = await db.query(queryText, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching report templates:', err);
    res.status(500).json({ error: 'Failed to fetch report templates' });
  }
});

/**
 * Get a single report template by ID
 */
router.get('/:id', [
  param('id').isInt().withMessage('Template ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;

  try {
    const result = await db.query(`
      SELECT 
        rt.*,
        u.username as created_by_username
      FROM report_templates rt
      LEFT JOIN users u ON rt.created_by = u.id
      WHERE rt.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report template not found' });
    }

    const template = result.rows[0];

    // Non-admin users can only access default templates or their own custom templates
    if (req.user.role !== 'admin' && !template.is_default && template.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied to this template' });
    }

    res.json(template);
  } catch (err) {
    console.error('Error fetching report template:', err);
    res.status(500).json({ error: 'Failed to fetch report template' });
  }
});

/**
 * Create a new custom report template
 * Only coaches and admins can create templates
 */
router.post('/', [
  requireRole(['admin', 'coach']),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Template name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Template name must be between 2 and 100 characters'),
  body('type')
    .isIn(['summary', 'detailed', 'coach_focused', 'custom'])
    .withMessage('Invalid template type'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('sections')
    .isArray()
    .withMessage('Sections must be an array'),
  body('metrics')
    .isArray()
    .withMessage('Metrics must be an array'),
  body('branding')
    .optional()
    .isObject()
    .withMessage('Branding must be an object'),
  body('language')
    .optional()
    .isLength({ min: 2, max: 10 })
    .withMessage('Invalid language code')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const {
    name,
    type,
    description,
    sections,
    metrics,
    branding = {},
    language = 'en',
    date_format = 'YYYY-MM-DD',
    time_format = '24h'
  } = req.body;

  try {
    const result = await db.query(`
      INSERT INTO report_templates (
        name, type, is_default, is_active, created_by, description,
        sections, metrics, branding, language, date_format, time_format
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      name,
      type,
      false, // Custom templates are never default
      true,
      req.user.id,
      description || null,
      JSON.stringify(sections),
      JSON.stringify(metrics),
      JSON.stringify(branding),
      language,
      date_format,
      time_format
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating report template:', err);
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'A template with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create report template' });
  }
});

/**
 * Update a report template
 * Only the creator or admins can update custom templates
 * Default templates cannot be updated
 */
router.put('/:id', [
  requireRole(['admin', 'coach']),
  param('id').isInt().withMessage('Template ID must be an integer'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Template name cannot be empty')
    .isLength({ min: 2, max: 100 })
    .withMessage('Template name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('sections')
    .optional()
    .isArray()
    .withMessage('Sections must be an array'),
  body('metrics')
    .optional()
    .isArray()
    .withMessage('Metrics must be an array'),
  body('branding')
    .optional()
    .isObject()
    .withMessage('Branding must be an object'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be boolean')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;

  try {
    // Check if template exists and get current data
    const templateCheck = await db.query(
      'SELECT * FROM report_templates WHERE id = $1',
      [id]
    );

    if (templateCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Report template not found' });
    }

    const template = templateCheck.rows[0];

    // Default templates cannot be modified
    if (template.is_default) {
      return res.status(403).json({ error: 'Default templates cannot be modified' });
    }

    // Only creator or admin can update
    if (req.user.role !== 'admin' && template.created_by !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to update this template' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = ['name', 'description', 'sections', 'metrics', 'branding', 'language', 'date_format', 'time_format', 'is_active'];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        
        // JSON fields need to be stringified
        if (['sections', 'metrics', 'branding'].includes(field)) {
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
      UPDATE report_templates
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating report template:', err);
    res.status(500).json({ error: 'Failed to update report template' });
  }
});

/**
 * Delete a report template
 * Only the creator or admins can delete custom templates
 * Default templates cannot be deleted
 */
router.delete('/:id', [
  requireRole(['admin', 'coach']),
  param('id').isInt().withMessage('Template ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;

  try {
    // Check if template exists
    const templateCheck = await db.query(
      'SELECT * FROM report_templates WHERE id = $1',
      [id]
    );

    if (templateCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Report template not found' });
    }

    const template = templateCheck.rows[0];

    // Default templates cannot be deleted
    if (template.is_default) {
      return res.status(403).json({ error: 'Default templates cannot be deleted' });
    }

    // Only creator or admin can delete
    if (req.user.role !== 'admin' && template.created_by !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to delete this template' });
    }

    await db.query('DELETE FROM report_templates WHERE id = $1', [id]);

    res.json({ message: 'Report template deleted successfully' });
  } catch (err) {
    console.error('Error deleting report template:', err);
    res.status(500).json({ error: 'Failed to delete report template' });
  }
});

export default router;
