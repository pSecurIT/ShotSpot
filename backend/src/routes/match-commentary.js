import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

/**
 * Get all match commentary for a game with optional filtering
 * GET /api/match-commentary/:gameId
 * Query params: commentary_type, period
 */
router.get('/:gameId', [
  param('gameId')
    .isInt({ min: 1 })
    .withMessage('Game ID must be a positive integer'),
  query('commentary_type')
    .optional()
    .isIn(['note', 'highlight', 'injury', 'weather', 'technical'])
    .withMessage('Invalid commentary type'),
  query('period')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Period must be between 1 and 10')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { gameId } = req.params;
  const { commentary_type, period } = req.query;

  try {
    let queryText = `
      SELECT 
        mc.*,
        u.username as created_by_username
      FROM match_commentary mc
      LEFT JOIN users u ON mc.created_by = u.id
      WHERE mc.game_id = $1
    `;
    const params = [gameId];
    let paramIndex = 2;

    if (commentary_type) {
      queryText += ` AND mc.commentary_type = $${paramIndex}`;
      params.push(commentary_type);
      paramIndex++;
    }

    if (period) {
      queryText += ` AND mc.period = $${paramIndex}`;
      params.push(period);
      paramIndex++;
    }

    queryText += ' ORDER BY mc.created_at DESC';

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching match commentary:', error);
    res.status(500).json({ error: 'Failed to fetch match commentary' });
  }
});

/**
 * Create new match commentary
 * POST /api/match-commentary
 * Body: { game_id, period, time_remaining?, commentary_type, title?, content }
 */
router.post('/', [
  requireRole(['admin', 'coach']),
  body('game_id')
    .notEmpty()
    .isInt({ min: 1 })
    .withMessage('Game ID must be a positive integer'),
  body('period')
    .notEmpty()
    .isInt({ min: 1, max: 10 })
    .withMessage('Period must be between 1 and 10'),
  body('time_remaining')
    .optional({ nullable: true })
    .isString()
    .withMessage('Time remaining must be a string in interval format'),
  body('commentary_type')
    .notEmpty()
    .isIn(['note', 'highlight', 'injury', 'weather', 'technical'])
    .withMessage('Commentary type must be one of: note, highlight, injury, weather, technical'),
  body('title')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 100 })
    .withMessage('Title must be a string with maximum 100 characters'),
  body('content')
    .notEmpty()
    .isString()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Content must be a string between 1 and 2000 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { game_id: gameId, period, time_remaining, commentary_type, title, content } = req.body;
  const userId = req.user.id; // From auth middleware

  try {
    // Verify game exists
    const gameResult = await db.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Insert the commentary
    const insertQuery = `
      INSERT INTO match_commentary (
        game_id, period, time_remaining, commentary_type, title, content, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await db.query(insertQuery, [
      gameId, period, time_remaining || null, commentary_type, 
      title || null, content, userId
    ]);

    // Fetch the complete commentary with joined data
    const commentaryResult = await db.query(`
      SELECT 
        mc.*,
        u.username as created_by_username
      FROM match_commentary mc
      LEFT JOIN users u ON mc.created_by = u.id
      WHERE mc.id = $1
    `, [result.rows[0].id]);

    res.status(201).json(commentaryResult.rows[0]);
  } catch (error) {
    console.error('Error creating match commentary:', error);
    res.status(500).json({ error: 'Failed to create match commentary' });
  }
});

/**
 * Update match commentary
 * PUT /api/match-commentary/:commentaryId
 * Body: { period?, time_remaining?, commentary_type?, title?, content? }
 */
router.put('/:commentaryId', [
  requireRole(['admin', 'coach']),
  param('commentaryId')
    .isInt({ min: 1 })
    .withMessage('Commentary ID must be a positive integer'),
  body('period')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Period must be between 1 and 10'),
  body('time_remaining')
    .optional({ nullable: true })
    .isString()
    .withMessage('Time remaining must be a string in interval format'),
  body('commentary_type')
    .optional()
    .isIn(['note', 'highlight', 'injury', 'weather', 'technical'])
    .withMessage('Commentary type must be one of: note, highlight, injury, weather, technical'),
  body('title')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 100 })
    .withMessage('Title must be a string with maximum 100 characters'),
  body('content')
    .optional()
    .isString()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Content must be a string between 1 and 2000 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { commentaryId } = req.params;
  const updates = req.body;
  const userId = req.user.id; // From auth middleware

  try {
    // Verify commentary exists (no need for game_id verification in update)
    const commentaryResult = await db.query(
      'SELECT * FROM match_commentary WHERE id = $1',
      [commentaryId]
    );

    if (commentaryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match commentary not found' });
    }

    const commentary = commentaryResult.rows[0];

    // Check if user has permission to edit (admin or original creator)
    if (req.user.role !== 'admin' && commentary.created_by !== userId) {
      return res.status(403).json({ 
        error: 'Permission denied. You can only edit your own commentary.' 
      });
    }

    // Build dynamic update query
    const updateFields = [];
    const params = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Add updated_at field
    updateFields.push('updated_at = CURRENT_TIMESTAMP');

    params.push(commentaryId);
    const updateQuery = `
      UPDATE match_commentary 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    await db.query(updateQuery, params);

    // Fetch the complete updated commentary with joined data
    const updatedResult = await db.query(`
      SELECT 
        mc.*,
        u.username as created_by_username
      FROM match_commentary mc
      LEFT JOIN users u ON mc.created_by = u.id
      WHERE mc.id = $1
    `, [commentaryId]);

    res.json(updatedResult.rows[0]);
  } catch (error) {
    console.error('Error updating match commentary:', error);
    res.status(500).json({ error: 'Failed to update match commentary' });
  }
});

/**
 * Delete match commentary
 * DELETE /api/match-commentary/:commentaryId
 */
router.delete('/:commentaryId', [
  requireRole(['admin', 'coach']),
  param('commentaryId')
    .isInt({ min: 1 })
    .withMessage('Commentary ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { commentaryId } = req.params;
  const userId = req.user.id; // From auth middleware

  try {
    // Verify commentary exists
    const commentaryResult = await db.query(
      'SELECT * FROM match_commentary WHERE id = $1',
      [commentaryId]
    );

    if (commentaryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match commentary not found' });
    }

    const commentary = commentaryResult.rows[0];

    // Check if user has permission to delete (admin or original creator)
    if (req.user.role !== 'admin' && commentary.created_by !== userId) {
      return res.status(403).json({ 
        error: 'Permission denied. You can only delete your own commentary.' 
      });
    }

    // Delete the commentary
    await db.query('DELETE FROM match_commentary WHERE id = $1', [commentaryId]);

    res.json({ message: 'Match commentary deleted successfully' });
  } catch (error) {
    console.error('Error deleting match commentary:', error);
    res.status(500).json({ error: 'Failed to delete match commentary' });
  }
});

export default router;