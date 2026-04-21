import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

import { logError } from '../utils/logger.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

const TIMEOUT_EVENT_STATUSES = ['confirmed', 'unconfirmed'];

const fetchCompleteTimeoutById = async (timeoutId) => {
  const timeoutResult = await db.query(`
    SELECT 
      t.*,
      c.name as club_name
    FROM timeouts t
    LEFT JOIN clubs c ON t.club_id = c.id
    WHERE t.id = $1
  `, [timeoutId]);

  return timeoutResult.rows[0] || null;
};

/**
 * Get all timeouts for a game
 * GET /api/timeouts/:gameId
 */
router.get('/:gameId', [
  param('gameId')
    .isInt({ min: 1 })
    .withMessage('Game ID must be a positive integer'),
  query('event_status')
    .optional()
    .isIn(TIMEOUT_EVENT_STATUSES)
    .withMessage('Invalid event status value')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { gameId } = req.params;
  const { event_status } = req.query;

  try {
    let queryText = `
      SELECT 
        t.*,
        c.name as club_name
      FROM timeouts t
      LEFT JOIN clubs c ON t.club_id = c.id
      WHERE t.game_id = $1
    `;
    const params = [gameId];

    if (event_status) {
      queryText += ' AND t.event_status = $2';
      params.push(event_status);
    }

    queryText += ' ORDER BY t.created_at DESC';

    const result = await db.query(queryText, params);

    res.json(result.rows);
  } catch (error) {
    logError('Error fetching timeouts:', error);
    res.status(500).json({ error: 'Failed to fetch timeouts' });
  }
});

/**
 * Create a new timeout
 * POST /api/timeouts
 * Body: { game_id, club_id?, timeout_type, period, time_remaining?, duration?, reason?, called_by? }
 */
router.post('/', [
  requireRole(['admin', 'coach']),
  body('game_id')
    .notEmpty()
    .isInt({ min: 1 })
    .withMessage('Game ID must be a positive integer'),
  body('club_id')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('Club ID must be a positive integer'),
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
    .withMessage('Called by must be a string with maximum 100 characters'),
  body('client_uuid')
    .optional()
    .isUUID()
    .withMessage('client_uuid must be a valid UUID'),
  body('event_status')
    .optional()
    .isIn(TIMEOUT_EVENT_STATUSES)
    .withMessage('event_status must be confirmed or unconfirmed')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const {
    game_id: gameId, club_id, timeout_type, period, time_remaining,
    duration, reason, called_by, client_uuid, event_status
  } = req.body;
  const normalizedEventStatus = event_status || 'confirmed';

  try {
    if (client_uuid) {
      const existingTimeoutResult = await db.query(
        'SELECT id FROM timeouts WHERE game_id = $1 AND client_uuid = $2 LIMIT 1',
        [gameId, client_uuid]
      );

      if (existingTimeoutResult.rows.length > 0) {
        const existingTimeout = await fetchCompleteTimeoutById(existingTimeoutResult.rows[0].id);
        return res.status(200).json(existingTimeout);
      }
    }

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

    // For team timeouts, verify club is participating in the game
    if (club_id && timeout_type === 'team') {
      if (club_id !== game.home_club_id && club_id !== game.away_club_id) {
        return res.status(400).json({ 
          error: 'Club is not participating in this game',
          gameClubs: { home: game.home_club_id, away: game.away_club_id },
          providedClub: club_id
        });
      }
    }

    // Official and TV timeouts shouldn't have a club_id
    if ((timeout_type === 'official' || timeout_type === 'tv') && club_id) {
      return res.status(400).json({ 
        error: `${timeout_type} timeouts should not have a club_id`
      });
    }

    // Team timeouts must have a club_id
    if (timeout_type === 'team' && !club_id) {
      return res.status(400).json({ 
        error: 'club_id is required for team timeouts'
      });
    }

    // Insert the timeout
    const insertQuery = `
      INSERT INTO timeouts (
        game_id, club_id, timeout_type, period, time_remaining,
        duration, reason, called_by, client_uuid, event_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const result = await db.query(insertQuery, [
      gameId, club_id || null, timeout_type, period, time_remaining || null,
      duration || '1 minute', reason || null, called_by || null, client_uuid || null, normalizedEventStatus
    ]);

    const timeout = await fetchCompleteTimeoutById(result.rows[0].id);

    res.status(201).json(timeout);
  } catch (error) {
    if (error.code === '23505' && client_uuid) {
      try {
        const existingTimeoutResult = await db.query(
          'SELECT id FROM timeouts WHERE game_id = $1 AND client_uuid = $2 LIMIT 1',
          [gameId, client_uuid]
        );

        if (existingTimeoutResult.rows.length > 0) {
          const existingTimeout = await fetchCompleteTimeoutById(existingTimeoutResult.rows[0].id);
          return res.status(200).json(existingTimeout);
        }
      } catch (lookupError) {
        logError('Error resolving duplicate timeout by client_uuid:', lookupError);
      }
    }

    logError('Error creating timeout:', error);
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
        c.name as club_name
      FROM timeouts t
      LEFT JOIN clubs c ON t.club_id = c.id
      WHERE t.id = $1
    `, [timeoutId]);

    res.json(updatedResult.rows[0]);
  } catch (error) {
    logError('Error ending timeout:', error);
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
  body('club_id')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('Club ID must be a positive integer'),
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
    .withMessage('Called by must be a string with maximum 100 characters'),
  body('event_status')
    .optional()
    .isIn(TIMEOUT_EVENT_STATUSES)
    .withMessage('event_status must be confirmed or unconfirmed')
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

    const timeout = await fetchCompleteTimeoutById(timeoutId);

    res.json(timeout);
  } catch (error) {
    logError('Error updating timeout:', error);
    res.status(500).json({ error: 'Failed to update timeout' });
  }
});

/**
 * Confirm a timeout
 * POST /api/timeouts/:timeoutId/confirm
 * Body: { game_id }
 */
router.post('/:timeoutId/confirm', [
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
    const timeoutResult = await db.query(
      'SELECT * FROM timeouts WHERE id = $1 AND game_id = $2',
      [timeoutId, gameId]
    );

    if (timeoutResult.rows.length === 0) {
      return res.status(404).json({ error: 'Timeout not found' });
    }

    if (timeoutResult.rows[0].event_status !== 'confirmed') {
      await db.query(
        'UPDATE timeouts SET event_status = $1 WHERE id = $2',
        ['confirmed', timeoutId]
      );
    }

    const timeout = await fetchCompleteTimeoutById(timeoutId);
    res.status(200).json(timeout);
  } catch (error) {
    logError('Error confirming timeout:', error);
    res.status(500).json({ error: 'Failed to confirm timeout' });
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
    logError('Error deleting timeout:', error);
    res.status(500).json({ error: 'Failed to delete timeout' });
  }
});

export default router;