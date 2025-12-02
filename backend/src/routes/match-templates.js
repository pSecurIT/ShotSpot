import express from 'express';
import { body, param, validationResult } from 'express-validator';
import pool from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

/**
 * GET /api/match-templates
 * Get all match templates (system templates + user's templates)
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all system templates plus user's own templates
    const result = await pool.query(
      `SELECT 
        mt.*,
        u.username as created_by_username
       FROM match_templates mt
       LEFT JOIN users u ON mt.created_by = u.id
       WHERE mt.is_system_template = true OR mt.created_by = $1
       ORDER BY mt.is_system_template DESC, mt.name ASC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching match templates:', error);
    res.status(500).json({ error: 'Failed to fetch match templates' });
  }
});

/**
 * GET /api/match-templates/:id
 * Get a specific match template by ID
 */
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('Template ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
        mt.*,
        u.username as created_by_username
       FROM match_templates mt
       LEFT JOIN users u ON mt.created_by = u.id
       WHERE mt.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Match template not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching match template:', error);
    res.status(500).json({ error: 'Failed to fetch match template' });
  }
});

/**
 * POST /api/match-templates
 * Create a new match template
 */
router.post('/', [
  requireRole(['admin', 'coach']),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Template name is required')
    .isLength({ max: 100 })
    .withMessage('Template name must be at most 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be at most 500 characters'),
  body('number_of_periods')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Number of periods must be between 1 and 10'),
  body('period_duration_minutes')
    .optional()
    .isInt({ min: 1, max: 60 })
    .withMessage('Period duration must be between 1 and 60 minutes'),
  body('competition_type')
    .optional()
    .isIn(['league', 'cup', 'friendly', 'tournament'])
    .withMessage('Competition type must be league, cup, friendly, or tournament')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const {
    name,
    description,
    number_of_periods = 4,
    period_duration_minutes = 10,
    competition_type
  } = req.body;

  const userId = req.user.id;

  try {
    const result = await pool.query(
      `INSERT INTO match_templates (
        name, description, number_of_periods, period_duration_minutes,
        competition_type, created_by, is_system_template
      ) VALUES ($1, $2, $3, $4, $5, $6, false)
      RETURNING *`,
      [
        name, description, number_of_periods, period_duration_minutes,
        competition_type, userId
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating match template:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A template with this name already exists' });
    }
    
    res.status(500).json({ error: 'Failed to create match template' });
  }
});

/**
 * PUT /api/match-templates/:id
 * Update a match template
 */
router.put('/:id', [
  requireRole(['admin', 'coach']),
  param('id').isInt({ min: 1 }).withMessage('Template ID must be a positive integer'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Template name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Template name must be at most 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be at most 500 characters'),
  body('number_of_periods')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Number of periods must be between 1 and 10'),
  body('period_duration_minutes')
    .optional()
    .isInt({ min: 1, max: 60 })
    .withMessage('Period duration must be between 1 and 60 minutes'),
  body('competition_type')
    .optional()
    .isIn(['league', 'cup', 'friendly', 'tournament'])
    .withMessage('Competition type must be league, cup, friendly, or tournament')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role?.toLowerCase();

  try {
    // Check if template exists and user has permission to edit
    const templateCheck = await pool.query(
      'SELECT * FROM match_templates WHERE id = $1',
      [id]
    );

    if (templateCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Match template not found' });
    }

    const template = templateCheck.rows[0];

    // Only admin can edit system templates
    if (template.is_system_template && userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can edit system templates' });
    }

    // Users can only edit their own templates (unless admin)
    if (!template.is_system_template && template.created_by !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'You can only edit your own templates' });
    }

    // Build update query dynamically
    const updates = [];
    const params = [];
    let paramCount = 1;

    const fields = [
      'name', 'description', 'number_of_periods', 'period_duration_minutes',
      'competition_type'
    ];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        params.push(req.body[field]);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const result = await pool.query(
      `UPDATE match_templates SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating match template:', error);
    res.status(500).json({ error: 'Failed to update match template' });
  }
});

/**
 * DELETE /api/match-templates/:id
 * Delete a match template
 */
router.delete('/:id', [
  requireRole(['admin', 'coach']),
  param('id').isInt({ min: 1 }).withMessage('Template ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role?.toLowerCase();

  try {
    // Check if template exists and user has permission to delete
    const templateCheck = await pool.query(
      'SELECT * FROM match_templates WHERE id = $1',
      [id]
    );

    if (templateCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Match template not found' });
    }

    const template = templateCheck.rows[0];

    // System templates cannot be deleted
    if (template.is_system_template) {
      return res.status(403).json({ error: 'System templates cannot be deleted' });
    }

    // Users can only delete their own templates (unless admin)
    if (template.created_by !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'You can only delete your own templates' });
    }

    await pool.query('DELETE FROM match_templates WHERE id = $1', [id]);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting match template:', error);
    res.status(500).json({ error: 'Failed to delete match template' });
  }
});

/**
 * POST /api/match-templates/:id/apply-to-game/:gameId
 * Apply a match template to a game
 */
router.post('/:id/apply-to-game/:gameId', [
  requireRole(['admin', 'coach']),
  param('id').isInt({ min: 1 }).withMessage('Template ID must be a positive integer'),
  param('gameId').isInt({ min: 1 }).withMessage('Game ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id, gameId } = req.params;

  try {
    // Get the template
    const templateResult = await pool.query(
      'SELECT * FROM match_templates WHERE id = $1',
      [id]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match template not found' });
    }

    const template = templateResult.rows[0];

    // Check if game exists and is not in progress
    const gameResult = await pool.query(
      'SELECT * FROM games WHERE id = $1',
      [gameId]
    );

    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = gameResult.rows[0];

    if (game.status === 'in_progress') {
      return res.status(400).json({ error: 'Cannot apply template to a game in progress' });
    }

    if (game.status === 'completed') {
      return res.status(400).json({ error: 'Cannot apply template to a completed game' });
    }

    // Convert period duration to interval format
    const periodDuration = `00:${String(template.period_duration_minutes).padStart(2, '0')}:00`;

    // Apply template to game
    const _updateResult = await pool.query(
      `UPDATE games SET
        number_of_periods = $1,
        period_duration = $2::interval,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [
        template.number_of_periods,
        periodDuration,
        gameId
      ]
    );

    // Fetch updated game with team names
    const gameResponse = await pool.query(`
      SELECT 
        g.*,
        ht.name as home_team_name,
        at.name as away_team_name
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.id
      JOIN teams at ON g.away_team_id = at.id
      WHERE g.id = $1
    `, [gameId]);

    res.json({
      message: 'Template applied successfully',
      template: template.name,
      game: gameResponse.rows[0]
    });
  } catch (error) {
    console.error('Error applying template to game:', error);
    res.status(500).json({ error: 'Failed to apply template to game' });
  }
});

export default router;
