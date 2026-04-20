import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

import { logError } from '../utils/logger.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

const FREE_SHOT_EVENT_STATUSES = ['confirmed', 'unconfirmed'];

const normalizeFreeShotNumbers = (freeShot) => {
  if (!freeShot) {
    return freeShot;
  }

  const normalizedFreeShot = { ...freeShot };
  if (normalizedFreeShot.x_coord) normalizedFreeShot.x_coord = parseFloat(normalizedFreeShot.x_coord);
  if (normalizedFreeShot.y_coord) normalizedFreeShot.y_coord = parseFloat(normalizedFreeShot.y_coord);
  if (normalizedFreeShot.distance) normalizedFreeShot.distance = parseFloat(normalizedFreeShot.distance);

  return normalizedFreeShot;
};

const fetchCompleteFreeShotById = async (freeShotId) => {
  const freeShotResult = await db.query(`
    SELECT 
      fs.*,
      p.first_name,
      p.last_name,
      p.jersey_number,
      c.name as club_name
    FROM free_shots fs
    JOIN clubs c ON fs.club_id = c.id
    JOIN players p ON fs.player_id = p.id
    WHERE fs.id = $1
  `, [freeShotId]);

  return normalizeFreeShotNumbers(freeShotResult.rows[0] || null);
};

const getFallbackFreeShotPlayerId = async (clubId) => {
  const existingFallback = await db.query(
    `SELECT id
     FROM players
     WHERE club_id = $1 AND first_name = $2 AND last_name = $3
     ORDER BY id ASC
     LIMIT 1`,
    [clubId, 'Unknown', 'Scorer']
  );

  if (existingFallback.rows.length > 0) {
    return existingFallback.rows[0].id;
  }

  const createdFallback = await db.query(
    `INSERT INTO players (club_id, first_name, last_name, jersey_number, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING id`,
    [clubId, 'Unknown', 'Scorer', null]
  );

  return createdFallback.rows[0].id;
};

/**
 * Get all free shots for a game
 * GET /api/free-shots/:gameId
 */
router.get('/:gameId', [
  param('gameId')
    .isInt({ min: 1 })
    .withMessage('Game ID must be a positive integer'),
  query('event_status')
    .optional()
    .isIn(FREE_SHOT_EVENT_STATUSES)
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
        fs.*,
        p.first_name,
        p.last_name,
        p.jersey_number,
        c.name as club_name
      FROM free_shots fs
      JOIN clubs c ON fs.club_id = c.id
      JOIN players p ON fs.player_id = p.id
      WHERE fs.game_id = $1
    `;
    const params = [gameId];

    if (event_status) {
      queryText += ' AND fs.event_status = $2';
      params.push(event_status);
    }

    queryText += ' ORDER BY fs.created_at DESC';

    const result = await db.query(queryText, params);

    const freeShots = result.rows.map(normalizeFreeShotNumbers);

    res.json(freeShots);
  } catch (error) {
    logError('Error fetching free shots:', error);
    res.status(500).json({ error: 'Failed to fetch free shots' });
  }
});

/**
 * Create a new free shot
 * POST /api/free-shots
 * Body: { game_id, player_id, club_id, period, time_remaining?, free_shot_type, reason?, x_coord?, y_coord?, result, distance? }
 */
router.post('/', [
  requireRole(['admin', 'coach']),
  body('game_id')
    .notEmpty()
    .isInt({ min: 1 })
    .withMessage('Game ID must be a positive integer'),
  body('player_id')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('Player ID must be a positive integer'),
  body('club_id')
    .notEmpty()
    .isInt({ min: 1 })
    .withMessage('Club ID must be a positive integer'),
  body('period')
    .notEmpty()
    .isInt({ min: 1, max: 10 })
    .withMessage('Period must be between 1 and 10'),
  body('time_remaining')
    .optional({ nullable: true })
    .isString()
    .withMessage('Time remaining must be a string in interval format'),
  body('free_shot_type')
    .notEmpty()
    .isIn(['free_shot', 'penalty'])
    .withMessage('Free shot type must be one of: free_shot, penalty'),
  body('reason')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 100 })
    .withMessage('Reason must be a string with maximum 100 characters'),
  body('x_coord')
    .optional({ nullable: true })
    .isNumeric()
    .withMessage('X coordinate must be a number'),
  body('y_coord')
    .optional({ nullable: true })
    .isNumeric()
    .withMessage('Y coordinate must be a number'),
  body('result')
    .notEmpty()
    .isIn(['goal', 'miss', 'blocked'])
    .withMessage('Result must be one of: goal, miss, blocked'),
  body('distance')
    .optional({ nullable: true })
    .isNumeric()
    .withMessage('Distance must be a number'),
  body('client_uuid')
    .optional()
    .isUUID()
    .withMessage('client_uuid must be a valid UUID'),
  body('event_status')
    .optional()
    .isIn(FREE_SHOT_EVENT_STATUSES)
    .withMessage('event_status must be confirmed or unconfirmed')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const {
    game_id: gameId, player_id, club_id, period, time_remaining, free_shot_type,
    reason, x_coord, y_coord, result, distance, client_uuid, event_status
  } = req.body;
  const normalizedEventStatus = event_status || 'confirmed';
  let playerIdForFreeShot = player_id ?? null;

  try {
    if (client_uuid) {
      const existingFreeShotResult = await db.query(
        'SELECT id FROM free_shots WHERE game_id = $1 AND client_uuid = $2 LIMIT 1',
        [gameId, client_uuid]
      );

      if (existingFreeShotResult.rows.length > 0) {
        const existingFreeShot = await fetchCompleteFreeShotById(existingFreeShotResult.rows[0].id);
        return res.status(200).json(existingFreeShot);
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
        error: 'Cannot add free shots to game that is not in progress',
        currentStatus: game.status
      });
    }

    // Verify club is participating in the game
    if (club_id !== game.home_club_id && club_id !== game.away_club_id) {
      return res.status(400).json({ 
        error: 'Team is not participating in this game',
        gameTeams: { home: game.home_club_id, away: game.away_club_id },
        providedTeam: club_id
      });
    }

    if (playerIdForFreeShot !== null) {
      // Verify player belongs to the club
      const playerResult = await db.query(
        'SELECT club_id FROM players WHERE id = $1',
        [playerIdForFreeShot]
      );

      if (playerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Player not found' });
      }

      if (playerResult.rows[0].club_id !== club_id) {
        return res.status(400).json({ 
          error: 'Player does not belong to the specified team',
          playerTeam: playerResult.rows[0].club_id,
          providedTeam: club_id
        });
      }
    } else {
      playerIdForFreeShot = await getFallbackFreeShotPlayerId(club_id);
    }

    // Insert the free shot
    const insertQuery = `
      INSERT INTO free_shots (
        game_id, player_id, club_id, period, time_remaining,
        free_shot_type, reason, x_coord, y_coord, result, distance, client_uuid, event_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const result_query = await db.query(insertQuery, [
      gameId, playerIdForFreeShot, club_id, period, time_remaining || null,
      free_shot_type, reason || null, x_coord || null, y_coord || null,
      result, distance || null, client_uuid || null, normalizedEventStatus
    ]);

    const freeShot = await fetchCompleteFreeShotById(result_query.rows[0].id);

    res.status(201).json(freeShot);
  } catch (error) {
    if (error.code === '23505' && client_uuid) {
      try {
        const existingFreeShotResult = await db.query(
          'SELECT id FROM free_shots WHERE game_id = $1 AND client_uuid = $2 LIMIT 1',
          [gameId, client_uuid]
        );

        if (existingFreeShotResult.rows.length > 0) {
          const existingFreeShot = await fetchCompleteFreeShotById(existingFreeShotResult.rows[0].id);
          return res.status(200).json(existingFreeShot);
        }
      } catch (lookupError) {
        logError('Error resolving duplicate free shot by client_uuid:', lookupError);
      }
    }

    logError('Error creating free shot:', error);
    res.status(500).json({ error: 'Failed to create free shot' });
  }
});

/**
 * Update a free shot
 * PUT /api/free-shots/:freeShotId
 * Body: { game_id, ...other fields }
 */
router.put('/:freeShotId', [
  requireRole(['admin', 'coach']),
  param('freeShotId')
    .isInt({ min: 1 })
    .withMessage('Free shot ID must be a positive integer'),
  body('game_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Game ID must be a positive integer'),
  body('player_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Player ID must be a positive integer'),
  body('club_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Club ID must be a positive integer'),
  body('period')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Period must be between 1 and 10'),
  body('time_remaining')
    .optional({ nullable: true })
    .isString()
    .withMessage('Time remaining must be a string in interval format'),
  body('free_shot_type')
    .optional()
    .isIn(['free_shot', 'penalty'])
    .withMessage('Free shot type must be one of: free_shot, penalty'),
  body('reason')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 100 })
    .withMessage('Reason must be a string with maximum 100 characters'),
  body('x_coord')
    .optional({ nullable: true })
    .isNumeric()
    .withMessage('X coordinate must be a number'),
  body('y_coord')
    .optional({ nullable: true })
    .isNumeric()
    .withMessage('Y coordinate must be a number'),
  body('result')
    .optional()
    .isIn(['goal', 'miss', 'blocked'])
    .withMessage('Result must be one of: goal, miss, blocked'),
  body('distance')
    .optional({ nullable: true })
    .isNumeric()
    .withMessage('Distance must be a number'),
  body('event_status')
    .optional()
    .isIn(FREE_SHOT_EVENT_STATUSES)
    .withMessage('event_status must be confirmed or unconfirmed')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { freeShotId } = req.params;
  const updates = { ...req.body };
  if (updates.team_id && !updates.club_id) {
    updates.club_id = updates.team_id;
  }
  delete updates.team_id;
  const gameId = updates.game_id;

  try {
    // Verify free shot exists
    const freeShotResult = await db.query(
      'SELECT * FROM free_shots WHERE id = $1 AND game_id = $2',
      [freeShotId, gameId]
    );

    if (freeShotResult.rows.length === 0) {
      return res.status(404).json({ error: 'Free shot not found' });
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

    params.push(freeShotId);
    const updateQuery = `
      UPDATE free_shots 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    await db.query(updateQuery, params);

    const freeShot = await fetchCompleteFreeShotById(freeShotId);

    res.json(freeShot);
  } catch (error) {
    logError('Error updating free shot:', error);
    res.status(500).json({ error: 'Failed to update free shot' });
  }
});

/**
 * Confirm a free shot
 * POST /api/free-shots/:freeShotId/confirm
 * Body: { game_id }
 */
router.post('/:freeShotId/confirm', [
  requireRole(['admin', 'coach']),
  param('freeShotId')
    .isInt({ min: 1 })
    .withMessage('Free shot ID must be a positive integer'),
  body('game_id')
    .notEmpty()
    .isInt({ min: 1 })
    .withMessage('Game ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { freeShotId } = req.params;
  const { game_id: gameId } = req.body;

  try {
    const freeShotResult = await db.query(
      'SELECT * FROM free_shots WHERE id = $1 AND game_id = $2',
      [freeShotId, gameId]
    );

    if (freeShotResult.rows.length === 0) {
      return res.status(404).json({ error: 'Free shot not found' });
    }

    if (freeShotResult.rows[0].event_status !== 'confirmed') {
      await db.query(
        'UPDATE free_shots SET event_status = $1 WHERE id = $2',
        ['confirmed', freeShotId]
      );
    }

    const freeShot = await fetchCompleteFreeShotById(freeShotId);
    res.status(200).json(freeShot);
  } catch (error) {
    logError('Error confirming free shot:', error);
    res.status(500).json({ error: 'Failed to confirm free shot' });
  }
});

/**
 * Delete a free shot
 * DELETE /api/free-shots/:freeShotId
 * Body: { game_id }
 */
router.delete('/:freeShotId', [
  requireRole(['admin', 'coach']),
  param('freeShotId')
    .isInt({ min: 1 })
    .withMessage('Free shot ID must be a positive integer'),
  body('game_id')
    .notEmpty()
    .isInt({ min: 1 })
    .withMessage('Game ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { freeShotId } = req.params;
  const { game_id: gameId } = req.body;

  try {
    // Verify free shot exists
    const freeShotResult = await db.query(
      'SELECT * FROM free_shots WHERE id = $1 AND game_id = $2',
      [freeShotId, gameId]
    );

    if (freeShotResult.rows.length === 0) {
      return res.status(404).json({ error: 'Free shot not found' });
    }

    // Delete the free shot
    await db.query('DELETE FROM free_shots WHERE id = $1', [freeShotId]);

    res.json({ message: 'Free shot deleted successfully' });
  } catch (error) {
    logError('Error deleting free shot:', error);
    res.status(500).json({ error: 'Failed to delete free shot' });
  }
});

export default router;