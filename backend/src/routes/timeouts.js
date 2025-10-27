import express from 'express';
import { body, param, validationResult } from 'express-validator';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

/**
 * Get all timeouts for a game
 * GET /api/timeouts/:gameId
 */
router.get('/:gameId', async (req, res) => {
  const { gameId } = req.params;

  try {
    const result = await db.query(`
      SELECT 
        t.*,
        tm.name as team_name
      FROM timeouts t
      LEFT JOIN teams tm ON t.team_id = tm.id
      WHERE t.game_id = $1
      ORDER BY t.created_at DESC
    `, [gameId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching timeouts:', error);
    res.status(500).json({ error: 'Failed to fetch timeouts' });
  }
});

/**
 * Create a new timeout
 * POST /api/timeouts
 * Body: { game_id, team_id?, timeout_type, period, time_remaining?, duration?, reason?, called_by? }
 */
router.post('/', [
  requireRole(['admin', 'coach']),
  body('game_id')
    .notEmpty()
    .isInt({ min: 1 })
    .withMessage('Game ID must be a positive integer'),
  body('team_id')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('Team ID must be a positive integer'),
  body('timeout_type')
    .notEmpty()
    .isIn(['team', 'injury', 'official', 'tv'])
    .withMessage('Timeout type must be one of: team, injury, official, tv'),
  body('period')
    .notEmpty()
    .isInt({ min: 1, max: 10 })
    .withMessage('Period must be between 1 and 10'),
  body('time_remaining')
    .optional({ nullable: true })
    .isString()
    .withMessage('Time remaining must be a string in interval format'),
  body('duration')
    .optional({ nullable: true })
    .isString()
    .withMessage('Duration must be a string in interval format'),
  body('reason')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 200 })
    .withMessage('Reason must be a string with maximum 200 characters'),
  body('called_by')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 100 })
    .withMessage('Called by must be a string with maximum 100 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const {
    game_id: gameId, team_id, timeout_type, period, time_remaining,
    duration, reason, called_by
  } = req.body;

  try {
    // Verify game exists and is in progress
    const gameResult = await db.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = gameResult.rows[0];
    if (game.status !== 'in_progress') {
      return res.status(400).json({ 
        error: 'Cannot add timeouts to game that is not in progress',
        currentStatus: game.status
      });
    }

    // For team timeouts, verify team is participating in the game
    if (team_id && timeout_type === 'team') {
      if (team_id !== game.home_team_id && team_id !== game.away_team_id) {
        return res.status(400).json({ 
          error: 'Team is not participating in this game',
          gameTeams: { home: game.home_team_id, away: game.away_team_id },
          providedTeam: team_id
        });
      }
    }

    // Official and TV timeouts shouldn't have a team_id
    if ((timeout_type === 'official' || timeout_type === 'tv') && team_id) {
      return res.status(400).json({ 
        error: `${timeout_type} timeouts should not have a team_id`
      });
    }

    // Team timeouts must have a team_id
    if (timeout_type === 'team' && !team_id) {
      return res.status(400).json({ 
        error: 'team_id is required for team timeouts'
      });
    }

    // Insert the timeout
    const insertQuery = `
      INSERT INTO timeouts (
        game_id, team_id, timeout_type, period, time_remaining,
        duration, reason, called_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result = await db.query(insertQuery, [
      gameId, team_id || null, timeout_type, period, time_remaining || null,
      duration || '1 minute', reason || null, called_by || null
    ]);

    // Fetch the complete timeout with joined data
    const timeoutResult = await db.query(`
      SELECT 
        t.*,
        tm.name as team_name
      FROM timeouts t
      LEFT JOIN teams tm ON t.team_id = tm.id
      WHERE t.id = $1
    `, [result.rows[0].id]);

    res.status(201).json(timeoutResult.rows[0]);
  } catch (error) {
    console.error('Error creating timeout:', error);
    res.status(500).json({ error: 'Failed to create timeout' });
  }
});

/**
 * End a timeout (set ended_at timestamp)
 * PUT /api/timeouts/:timeoutId/end
 * Body: { game_id }
 */
router.put('/:timeoutId/end', [
  requireRole(['admin', 'coach']),
  param('timeoutId')
    .isInt({ min: 1 })
    .withMessage('Timeout ID must be a positive integer'),
  body('game_id')
    .notEmpty()
    .isInt({ min: 1 })
    .withMessage('Game ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { timeoutId } = req.params;
  const { game_id: gameId } = req.body;

  try {
    // Verify timeout exists
    const timeoutResult = await db.query(
      'SELECT * FROM timeouts WHERE id = $1 AND game_id = $2',
      [timeoutId, gameId]
    );

    if (timeoutResult.rows.length === 0) {
      return res.status(404).json({ error: 'Timeout not found' });
    }

    const timeout = timeoutResult.rows[0];
    if (timeout.ended_at) {
      return res.status(400).json({ error: 'Timeout has already ended' });
    }

    // End the timeout
    const updateQuery = `
      UPDATE timeouts 
      SET ended_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    await db.query(updateQuery, [timeoutId]);

    // Fetch the complete updated timeout with joined data
    const updatedResult = await db.query(`
      SELECT 
        t.*,
        tm.name as team_name
      FROM timeouts t
      LEFT JOIN teams tm ON t.team_id = tm.id
      WHERE t.id = $1
    `, [timeoutId]);

    res.json(updatedResult.rows[0]);
  } catch (error) {
    console.error('Error ending timeout:', error);
    res.status(500).json({ error: 'Failed to end timeout' });
  }
});

/**
 * Update a timeout
 * PUT /api/timeouts/:timeoutId
 * Body: { game_id, ...other fields }
 */
router.put('/:timeoutId', [
  requireRole(['admin', 'coach']),
  param('timeoutId')
    .isInt({ min: 1 })
    .withMessage('Timeout ID must be a positive integer'),
  body('game_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Game ID must be a positive integer'),
  body('team_id')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('Team ID must be a positive integer'),
  body('timeout_type')
    .optional()
    .isIn(['team', 'injury', 'official', 'tv'])
    .withMessage('Timeout type must be one of: team, injury, official, tv'),
  body('period')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Period must be between 1 and 10'),
  body('time_remaining')
    .optional({ nullable: true })
    .isString()
    .withMessage('Time remaining must be a string in interval format'),
  body('duration')
    .optional({ nullable: true })
    .isString()
    .withMessage('Duration must be a string in interval format'),
  body('reason')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 200 })
    .withMessage('Reason must be a string with maximum 200 characters'),
  body('called_by')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 100 })
    .withMessage('Called by must be a string with maximum 100 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { timeoutId } = req.params;
  const updates = req.body;
  const gameId = updates.game_id;

  try {
    // Verify timeout exists
    const timeoutResult = await db.query(
      'SELECT * FROM timeouts WHERE id = $1 AND game_id = $2',
      [timeoutId, gameId]
    );

    if (timeoutResult.rows.length === 0) {
      return res.status(404).json({ error: 'Timeout not found' });
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

    params.push(timeoutId);
    const updateQuery = `
      UPDATE timeouts 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    await db.query(updateQuery, params);

    // Fetch the complete updated timeout with joined data
    const updatedResult = await db.query(`
      SELECT 
        t.*,
        tm.name as team_name
      FROM timeouts t
      LEFT JOIN teams tm ON t.team_id = tm.id
      WHERE t.id = $1
    `, [timeoutId]);

    res.json(updatedResult.rows[0]);
  } catch (error) {
    console.error('Error updating timeout:', error);
    res.status(500).json({ error: 'Failed to update timeout' });
  }
});

/**
 * Delete a timeout
 * DELETE /api/timeouts/:timeoutId
 * Body: { game_id }
 */
router.delete('/:timeoutId', [
  requireRole(['admin', 'coach']),
  param('timeoutId')
    .isInt({ min: 1 })
    .withMessage('Timeout ID must be a positive integer'),
  body('game_id')
    .notEmpty()
    .isInt({ min: 1 })
    .withMessage('Game ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { timeoutId } = req.params;
  const { game_id: gameId } = req.body;

  try {
    // Verify timeout exists
    const timeoutResult = await db.query(
      'SELECT * FROM timeouts WHERE id = $1 AND game_id = $2',
      [timeoutId, gameId]
    );

    if (timeoutResult.rows.length === 0) {
      return res.status(404).json({ error: 'Timeout not found' });
    }

    // Delete the timeout
    await db.query('DELETE FROM timeouts WHERE id = $1', [timeoutId]);

    res.json({ message: 'Timeout deleted successfully' });
  } catch (error) {
    console.error('Error deleting timeout:', error);
    res.status(500).json({ error: 'Failed to delete timeout' });
  }
});

export default router;