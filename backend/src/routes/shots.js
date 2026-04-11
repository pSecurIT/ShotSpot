import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';
import { hasTrainerAccess } from '../middleware/trainerAccess.js';

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

const SHOT_EVENT_STATUSES = ['confirmed', 'unconfirmed'];

const fetchCompleteShotById = async (shotId) => {
  const completeShotResult = await db.query(`
    SELECT
      s.*,
      p.first_name,
      p.last_name,
      p.jersey_number,
      c.name as club_name
    FROM shots s
    JOIN players p ON s.player_id = p.id
    JOIN clubs c ON s.club_id = c.id
    WHERE s.id = $1
  `, [shotId]);

  return completeShotResult.rows[0] || null;
};

const getFallbackShotPlayerId = async (clubId) => {
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
 * Get all shots for a game
 */
router.get('/:gameId', [
  param('gameId').isInt().withMessage('Game ID must be an integer'),
  query('period').optional().isInt({ min: 1 }).withMessage('Period must be a positive integer'),
  query('club_id').optional().isInt().withMessage('Club ID must be an integer'),
  query('player_id').optional().isInt().withMessage('Player ID must be an integer'),
  query('result').optional().isIn(['goal', 'miss', 'blocked']).withMessage('Invalid result value'),
  query('event_status').optional().isIn(SHOT_EVENT_STATUSES).withMessage('Invalid event status value')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;
  const { period, club_id, player_id, result, event_status } = req.query;

  try {
    // Build dynamic query with filters
    let queryText = `
      SELECT 
        s.*,
        p.first_name,
        p.last_name,
        p.jersey_number,
        c.name as club_name
      FROM shots s
      JOIN players p ON s.player_id = p.id
      JOIN clubs c ON s.club_id = c.id
      WHERE s.game_id = $1
    `;
    const queryParams = [gameId];
    let paramIndex = 2;

    if (period) {
      queryText += ` AND s.period = $${paramIndex}`;
      queryParams.push(period);
      paramIndex++;
    }

    if (club_id) {
      queryText += ` AND s.club_id = $${paramIndex}`;
      queryParams.push(club_id);
      paramIndex++;
    }

    if (player_id) {
      queryText += ` AND s.player_id = $${paramIndex}`;
      queryParams.push(player_id);
      paramIndex++;
    }

    if (result) {
      queryText += ` AND s.result = $${paramIndex}`;
      queryParams.push(result);
      paramIndex++;
    }

    if (event_status) {
      queryText += ` AND s.event_status = $${paramIndex}`;
      queryParams.push(event_status);
      paramIndex++;
    }

    queryText += ' ORDER BY s.created_at DESC';

    const shotsResult = await db.query(queryText, queryParams);

    res.json(shotsResult.rows);
  } catch (err) {
    console.error('Error fetching shots:', err);
    res.status(500).json({ error: 'Failed to fetch shots' });
  }
});

/**
 * Create a new shot
 */
router.post('/:gameId', [
  requireRole(['admin', 'coach']),
  param('gameId').isInt().withMessage('Game ID must be an integer'),
  body('player_id').optional({ nullable: true }).isInt().withMessage('Player ID must be an integer'),
  body('club_id').isInt().withMessage('Club ID is required and must be an integer'),
  body('x_coord').isFloat({ min: 0, max: 100 }).withMessage('X coordinate must be between 0 and 100'),
  body('y_coord').isFloat({ min: 0, max: 100 }).withMessage('Y coordinate must be between 0 and 100'),
  body('result').isIn(['goal', 'miss', 'blocked']).withMessage('Result must be goal, miss, or blocked'),
  body('period').isInt({ min: 1 }).withMessage('Period must be a positive integer'),
  body('time_remaining').optional().matches(/^\d{2}:\d{2}:\d{2}$/).withMessage('Time remaining must be in format HH:MM:SS'),
  body('shot_type').optional().isString().withMessage('Shot type must be a string'),
  body('distance').optional().isFloat({ min: 0 }).withMessage('Distance must be a positive number'),
  body('client_uuid').optional().isUUID().withMessage('client_uuid must be a valid UUID'),
  body('event_status').optional().isIn(SHOT_EVENT_STATUSES).withMessage('event_status must be confirmed or unconfirmed')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;
  const {
    player_id,
    club_id,
    x_coord,
    y_coord,
    result,
    period,
    time_remaining,
    shot_type,
    distance,
    client_uuid,
    event_status
  } = req.body;
  const normalizedEventStatus = event_status || 'confirmed';
  let playerIdForShot = player_id ?? null;

  try {
    // Verify game exists and is in progress
    const gameCheck = await db.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = gameCheck.rows[0];
    if (game.status !== 'in_progress') {
      return res.status(400).json({ error: 'Can only record shots for games in progress' });
    }

    // Verify club is participating in this game
    if (club_id !== game.home_club_id && club_id !== game.away_club_id) {
      return res.status(400).json({ error: 'Club is not participating in this game' });
    }

    if (playerIdForShot !== null) {
      // Verify player exists and belongs to the specified club
      const playerCheck = await db.query('SELECT * FROM players WHERE id = $1', [playerIdForShot]);
      if (playerCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Player not found' });
      }

      const player = playerCheck.rows[0];
      if (player.club_id !== club_id) {
        // Fallback for migrated data: allow if player is explicitly rostered for this game and club.
        const rosterCheck = await db.query(
          `SELECT 1
           FROM game_rosters
           WHERE game_id = $1 AND player_id = $2 AND club_id = $3
           LIMIT 1`,
          [gameId, playerIdForShot, club_id]
        );

        if (rosterCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Player does not belong to the specified club' });
        }
      }
    } else {
      playerIdForShot = await getFallbackShotPlayerId(club_id);
    }

    // For coaches: verify they have trainer access to the club they're recording for
    if (req.user.role === 'coach') {
      const hasAccess = await hasTrainerAccess(req.user.userId, { clubId: club_id });
      if (!hasAccess) {
        return res.status(403).json({
          error: 'You can only record shots for your assigned team',
          providedClub: club_id,
          gameClubs: { home: game.home_club_id, away: game.away_club_id }
        });
      }
    }

    // Idempotent create for offline retries.
    if (client_uuid) {
      const existingShotResult = await db.query(
        'SELECT id FROM shots WHERE game_id = $1 AND client_uuid = $2 LIMIT 1',
        [gameId, client_uuid]
      );

      if (existingShotResult.rows.length > 0) {
        const existingShot = await fetchCompleteShotById(existingShotResult.rows[0].id);
        return res.status(200).json(existingShot);
      }
    }

    // Insert shot
    const shotResult = await db.query(`
      INSERT INTO shots (game_id, player_id, club_id, x_coord, y_coord, result, period, time_remaining, shot_type, distance, client_uuid, event_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [gameId, playerIdForShot, club_id, x_coord, y_coord, result, period, time_remaining, shot_type, distance, client_uuid || null, normalizedEventStatus]);

    const shot = shotResult.rows[0];

    // If it's a goal, update the game score
    if (result === 'goal' && normalizedEventStatus === 'confirmed') {
      const scoreField = club_id === game.home_club_id ? 'home_score' : 'away_score';
      await db.query(`
        UPDATE games 
        SET ${scoreField} = ${scoreField} + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [gameId]);
    }

    const completeShot = await fetchCompleteShotById(shot.id);

    // Emit WebSocket event for real-time analytics update
    const io = req.app.get('io');
    if (io) {
      io.to(`game-${gameId}`).emit('shot-recorded', {
        gameId: parseInt(gameId),
        shot: completeShot,
        timestamp: new Date().toISOString()
      });

      // Emit analytics refresh event
      io.to(`game-${gameId}`).emit('analytics-update', {
        gameId: parseInt(gameId),
        type: 'shot',
        timestamp: new Date().toISOString()
      });
    }

    res.status(201).json(completeShot);
  } catch (err) {
    if (err.code === '23505' && client_uuid) {
      try {
        const existingShotResult = await db.query(
          'SELECT id FROM shots WHERE game_id = $1 AND client_uuid = $2 LIMIT 1',
          [gameId, client_uuid]
        );

        if (existingShotResult.rows.length > 0) {
          const existingShot = await fetchCompleteShotById(existingShotResult.rows[0].id);
          return res.status(200).json(existingShot);
        }
      } catch (lookupError) {
        console.error('Error resolving duplicate shot by client_uuid:', lookupError);
      }
    }

    console.error('Error creating shot:', err);
    res.status(500).json({ error: 'Failed to create shot' });
  }
});

/**
 * Update a shot
 */
router.put('/:gameId/:shotId', [
  requireRole(['admin', 'coach']),
  param('gameId').isInt().withMessage('Game ID must be an integer'),
  param('shotId').isInt().withMessage('Shot ID must be an integer'),
  body('x_coord').optional().isFloat({ min: 0, max: 100 }).withMessage('X coordinate must be between 0 and 100'),
  body('y_coord').optional().isFloat({ min: 0, max: 100 }).withMessage('Y coordinate must be between 0 and 100'),
  body('result').optional().isIn(['goal', 'miss', 'blocked']).withMessage('Result must be goal, miss, or blocked'),
  body('shot_type').optional().isString().withMessage('Shot type must be a string'),
  body('distance').optional().isFloat({ min: 0 }).withMessage('Distance must be a positive number'),
  body('event_status').optional().isIn(SHOT_EVENT_STATUSES).withMessage('event_status must be confirmed or unconfirmed')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId, shotId } = req.params;
  const updates = req.body;

  try {
    // Verify shot exists and belongs to this game
    const shotCheck = await db.query('SELECT * FROM shots WHERE id = $1 AND game_id = $2', [shotId, gameId]);
    if (shotCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Shot not found' });
    }

    const oldShot = shotCheck.rows[0];
    const oldResult = oldShot.result;
    const oldStatus = oldShot.event_status || 'confirmed';
    const newResult = updates.result || oldResult;
    const newStatus = updates.event_status || oldStatus;

    // Build dynamic update query
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(shotId);
    const updateQuery = `UPDATE shots SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    
    const _updateResult = await db.query(updateQuery, values);

    // Update game score when goal-counting status changes.
    const oldCountsAsGoal = oldResult === 'goal' && oldStatus === 'confirmed';
    const newCountsAsGoal = newResult === 'goal' && newStatus === 'confirmed';

    if (oldCountsAsGoal !== newCountsAsGoal) {
      const game = await db.query('SELECT * FROM games WHERE id = $1', [gameId]);
      const gameData = game.rows[0];
      const scoreField = oldShot.club_id === gameData.home_club_id ? 'home_score' : 'away_score';

      const scoreChange = newCountsAsGoal ? 1 : -1;

      await db.query(`
        UPDATE games 
        SET ${scoreField} = GREATEST(0, ${scoreField} + $1), updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [scoreChange, gameId]);
    }

    const completeShot = await fetchCompleteShotById(shotId);
    res.json(completeShot);
  } catch (err) {
    console.error('Error updating shot:', err);
    res.status(500).json({ error: 'Failed to update shot' });
  }
});

/**
 * Confirm a shot event
 */
router.post('/:gameId/:shotId/confirm', [
  requireRole(['admin', 'coach']),
  param('gameId').isInt().withMessage('Game ID must be an integer'),
  param('shotId').isInt().withMessage('Shot ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId, shotId } = req.params;

  try {
    const shotCheck = await db.query('SELECT * FROM shots WHERE id = $1 AND game_id = $2', [shotId, gameId]);
    if (shotCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Shot not found' });
    }

    const shot = shotCheck.rows[0];
    if (shot.event_status === 'confirmed') {
      const completeShot = await fetchCompleteShotById(shotId);
      return res.status(200).json(completeShot);
    }

    await db.query(
      'UPDATE shots SET event_status = $1 WHERE id = $2',
      ['confirmed', shotId]
    );

    if (shot.result === 'goal') {
      const game = await db.query('SELECT * FROM games WHERE id = $1', [gameId]);
      const gameData = game.rows[0];
      const scoreField = shot.club_id === gameData.home_club_id ? 'home_score' : 'away_score';
      await db.query(
        `UPDATE games SET ${scoreField} = ${scoreField} + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [gameId]
      );
    }

    const completeShot = await fetchCompleteShotById(shotId);
    res.status(200).json(completeShot);
  } catch (err) {
    console.error('Error confirming shot:', err);
    res.status(500).json({ error: 'Failed to confirm shot' });
  }
});

/**
 * Delete a shot
 */
router.delete('/:gameId/:shotId', [
  requireRole(['admin', 'coach']),
  param('gameId').isInt().withMessage('Game ID must be an integer'),
  param('shotId').isInt().withMessage('Shot ID must be an integer')
], async (req, res) => {
  const { gameId, shotId } = req.params;

  try {
    // Verify shot exists and belongs to this game
    const shotCheck = await db.query('SELECT * FROM shots WHERE id = $1 AND game_id = $2', [shotId, gameId]);
    if (shotCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Shot not found' });
    }

    const shot = shotCheck.rows[0];

    // If it was a goal, decrease the score
    if (shot.result === 'goal') {
      const game = await db.query('SELECT * FROM games WHERE id = $1', [gameId]);
      const gameData = game.rows[0];
      const scoreField = shot.club_id === gameData.home_club_id ? 'home_score' : 'away_score';

      await db.query(`
        UPDATE games 
        SET ${scoreField} = GREATEST(0, ${scoreField} - 1), updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [gameId]);
    }

    await db.query('DELETE FROM shots WHERE id = $1', [shotId]);

    res.status(204).send();
  } catch (err) {
    console.error('Error deleting shot:', err);
    res.status(500).json({ error: 'Failed to delete shot' });
  }
});

export default router;
