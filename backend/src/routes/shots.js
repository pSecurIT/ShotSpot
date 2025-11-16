import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

/**
 * Get all shots for a game
 */
router.get('/:gameId', [
  param('gameId').isInt().withMessage('Game ID must be an integer'),
  query('period').optional().isInt({ min: 1 }).withMessage('Period must be a positive integer'),
  query('team_id').optional().isInt().withMessage('Team ID must be an integer'),
  query('player_id').optional().isInt().withMessage('Player ID must be an integer'),
  query('result').optional().isIn(['goal', 'miss', 'blocked']).withMessage('Invalid result value')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;
  const { period, team_id, player_id, result } = req.query;

  try {
    // Build dynamic query with filters
    let queryText = `
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
    `;
    const queryParams = [gameId];
    let paramIndex = 2;

    if (period) {
      queryText += ` AND s.period = $${paramIndex}`;
      queryParams.push(period);
      paramIndex++;
    }

    if (team_id) {
      queryText += ` AND s.team_id = $${paramIndex}`;
      queryParams.push(team_id);
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
  body('player_id').isInt().withMessage('Player ID is required and must be an integer'),
  body('team_id').isInt().withMessage('Team ID is required and must be an integer'),
  body('x_coord').isFloat({ min: 0, max: 100 }).withMessage('X coordinate must be between 0 and 100'),
  body('y_coord').isFloat({ min: 0, max: 100 }).withMessage('Y coordinate must be between 0 and 100'),
  body('result').isIn(['goal', 'miss', 'blocked']).withMessage('Result must be goal, miss, or blocked'),
  body('period').isInt({ min: 1 }).withMessage('Period must be a positive integer'),
  body('time_remaining').optional().matches(/^\d{2}:\d{2}:\d{2}$/).withMessage('Time remaining must be in format HH:MM:SS'),
  body('shot_type').optional().isString().withMessage('Shot type must be a string'),
  body('distance').optional().isFloat({ min: 0 }).withMessage('Distance must be a positive number')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;
  const { player_id, team_id, x_coord, y_coord, result, period, time_remaining, shot_type, distance } = req.body;

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

    // Verify player exists and belongs to one of the teams
    const playerCheck = await db.query('SELECT * FROM players WHERE id = $1', [player_id]);
    if (playerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = playerCheck.rows[0];
    if (player.team_id !== team_id) {
      return res.status(400).json({ error: 'Player does not belong to the specified team' });
    }

    // Verify team is participating in this game
    if (team_id !== game.home_team_id && team_id !== game.away_team_id) {
      return res.status(400).json({ error: 'Team is not participating in this game' });
    }

    // Insert shot
    const shotResult = await db.query(`
      INSERT INTO shots (game_id, player_id, team_id, x_coord, y_coord, result, period, time_remaining, shot_type, distance)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [gameId, player_id, team_id, x_coord, y_coord, result, period, time_remaining, shot_type, distance]);

    const shot = shotResult.rows[0];

    // If it's a goal, update the game score
    if (result === 'goal') {
      const scoreField = team_id === game.home_team_id ? 'home_score' : 'away_score';
      await db.query(`
        UPDATE games 
        SET ${scoreField} = ${scoreField} + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [gameId]);
    }

    // Fetch complete shot data with player and team info
    const completeShotResult = await db.query(`
      SELECT 
        s.*,
        p.first_name,
        p.last_name,
        p.jersey_number,
        t.name as team_name
      FROM shots s
      JOIN players p ON s.player_id = p.id
      JOIN teams t ON s.team_id = t.id
      WHERE s.id = $1
    `, [shot.id]);

    const completeShot = completeShotResult.rows[0];

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
  body('distance').optional().isFloat({ min: 0 }).withMessage('Distance must be a positive number')
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
    const newResult = updates.result || oldResult;

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

    // Update game score if result changed
    if (updates.result && oldResult !== newResult) {
      const game = await db.query('SELECT * FROM games WHERE id = $1', [gameId]);
      const gameData = game.rows[0];
      const scoreField = oldShot.team_id === gameData.home_team_id ? 'home_score' : 'away_score';

      let scoreChange = 0;
      if (oldResult === 'goal' && newResult !== 'goal') {
        scoreChange = -1; // Was a goal, now isn't
      } else if (oldResult !== 'goal' && newResult === 'goal') {
        scoreChange = 1; // Wasn't a goal, now is
      }

      if (scoreChange !== 0) {
        await db.query(`
          UPDATE games 
          SET ${scoreField} = GREATEST(0, ${scoreField} + $1), updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [scoreChange, gameId]);
      }
    }

    // Fetch complete shot data
    const completeShotResult = await db.query(`
      SELECT 
        s.*,
        p.first_name,
        p.last_name,
        p.jersey_number,
        t.name as team_name
      FROM shots s
      JOIN players p ON s.player_id = p.id
      JOIN teams t ON s.team_id = t.id
      WHERE s.id = $1
    `, [shotId]);

    res.json(completeShotResult.rows[0]);
  } catch (err) {
    console.error('Error updating shot:', err);
    res.status(500).json({ error: 'Failed to update shot' });
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
      const scoreField = shot.team_id === gameData.home_team_id ? 'home_score' : 'away_score';

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
