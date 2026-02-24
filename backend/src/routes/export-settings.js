import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

/**
 * Get export settings for the authenticated user
 * Creates default settings if none exist
 */
router.get('/', async (req, res) => {
  try {
    let result = await db.query(
      'SELECT * FROM export_settings WHERE user_id = $1',
      [req.user.userId]
    );

    // If user has no settings, create default settings
    if (result.rows.length === 0) {
      const defaultSettings = await db.query(`
        INSERT INTO export_settings (
          user_id,
          default_format,
          anonymize_opponents,
          include_sensitive_data,
          allow_public_sharing,
          allowed_share_roles
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        req.user.userId,
        'pdf',
        false,
        true,
        false,
        JSON.stringify(['coach', 'admin'])
      ]);

      result = defaultSettings;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching export settings:', err);
    res.status(500).json({ error: 'Failed to fetch export settings' });
  }
});

/**
 * Update export settings for the authenticated user
 */
router.put('/', [
  body('default_format')
    .optional()
    .isIn(['pdf', 'csv', 'json'])
    .withMessage('Invalid format. Must be pdf, csv, or json'),
  body('default_template_id')
    .optional()
    .isInt()
    .withMessage('Template ID must be an integer'),
  body('anonymize_opponents')
    .optional()
    .isBoolean()
    .withMessage('anonymize_opponents must be boolean'),
  body('include_sensitive_data')
    .optional()
    .isBoolean()
    .withMessage('include_sensitive_data must be boolean'),
  body('auto_delete_after_days')
    .optional()
    .custom((value) => value === null || (Number.isInteger(value) && value > 0))
    .withMessage('auto_delete_after_days must be a positive integer or null'),
  body('allow_public_sharing')
    .optional()
    .isBoolean()
    .withMessage('allow_public_sharing must be boolean'),
  body('allowed_share_roles')
    .optional()
    .isArray()
    .withMessage('allowed_share_roles must be an array')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  try {
    // If default_template_id is provided, verify it exists and user has access
    if (req.body.default_template_id) {
      const templateCheck = await db.query(
        'SELECT * FROM report_templates WHERE id = $1',
        [req.body.default_template_id]
      );

      if (templateCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const template = templateCheck.rows[0];

      // Check if user has access to this template
      if (!template.is_default && template.created_by !== req.user.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'You do not have access to this template' });
      }
    }

    // Check if settings exist
    const existingSettings = await db.query(
      'SELECT id FROM export_settings WHERE user_id = $1',
      [req.user.userId]
    );

    let result;

    if (existingSettings.rows.length === 0) {
      // Create new settings
      const fields = ['user_id'];
      const values = [req.user.userId];
      const placeholders = ['$1'];
      let paramIndex = 2;

      const allowedFields = [
        'default_format',
        'default_template_id',
        'anonymize_opponents',
        'include_sensitive_data',
        'auto_delete_after_days',
        'allow_public_sharing',
        'allowed_share_roles'
      ];

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          fields.push(field);
          placeholders.push(`$${paramIndex}`);
          
          if (field === 'allowed_share_roles') {
            values.push(JSON.stringify(req.body[field]));
          } else {
            values.push(req.body[field]);
          }
          paramIndex++;
        }
      }

      result = await db.query(`
        INSERT INTO export_settings (${fields.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `, values);
    } else {
      // Update existing settings
      const updates = [];
      const values = [];
      let paramIndex = 1;

      const allowedFields = [
        'default_format',
        'default_template_id',
        'anonymize_opponents',
        'include_sensitive_data',
        'auto_delete_after_days',
        'allow_public_sharing',
        'allowed_share_roles'
      ];

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = $${paramIndex}`);
          
          if (field === 'allowed_share_roles') {
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

      values.push(req.user.userId);

      result = await db.query(`
        UPDATE export_settings
        SET ${updates.join(', ')}
        WHERE user_id = $${paramIndex}
        RETURNING *
      `, values);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating export settings:', err);
    res.status(500).json({ error: 'Failed to update export settings' });
  }
});

/**
 * Reset export settings to defaults
 */
router.post('/reset', async (req, res) => {
  try {
    const result = await db.query(`
      INSERT INTO export_settings (
        user_id,
        default_format,
        anonymize_opponents,
        include_sensitive_data,
        allow_public_sharing,
        allowed_share_roles
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) 
      DO UPDATE SET
        default_format = $2,
        anonymize_opponents = $3,
        include_sensitive_data = $4,
        auto_delete_after_days = NULL,
        allow_public_sharing = $5,
        allowed_share_roles = $6,
        default_template_id = NULL
      RETURNING *
    `, [
      req.user.userId,
      'pdf',
      false,
      true,
      false,
      JSON.stringify(['coach', 'admin'])
    ]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error resetting export settings:', err);
    res.status(500).json({ error: 'Failed to reset export settings' });
  }
});

export default router;
