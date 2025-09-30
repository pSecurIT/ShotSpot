import express from 'express';
import { body, param, validationResult } from 'express-validator';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// Validation middleware for shots
const validateShot = [
  body('game_id').isInt().withMessage('Game ID must be an integer'),
  body('player_id').isInt().withMessage('Player ID must be an integer'),
  body('team_id').isInt().withMessage('Team ID must be an integer'),
  body('x_coord').isFloat().withMessage('X coordinate must be a number'),
  body('y_coord').isFloat().withMessage('Y coordinate must be a number'),
  body('result')
    .isIn(['goal', 'miss', 'blocked'])
    .withMessage('Result must be goal, miss, or blocked'),
  body('period').isInt({ min: 1 }).withMessage('Period must be a positive integer'),
  body('time_remaining').isString().withMessage('Time remaining must be an interval string'),
  body('shot_type').optional().isString(),
  body('distance').optional().isFloat()
];

// Validation middleware for game events
const validateGameEvent = [
  body('game_id').isInt().withMessage('Game ID must be an integer'),
  body('event_type')
    .isIn(['foul', 'substitution', 'timeout'])
    .withMessage('Event type must be foul, substitution, or timeout'),
  body('team_id').isInt().withMessage('Team ID must be an integer'),
  body('player_id').optional().isInt(),
  body('period').isInt({ min: 1 }).withMessage('Period must be a positive integer'),
  body('time_remaining').isString().withMessage('Time remaining must be an interval string'),
  body('details').optional().isObject()
];

// Get all shots for a game
router.get('/games/:gameId/shots', [
  param('gameId').isInt().withMessage('Game ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;
  try {
    const result = await db.query(`
      SELECT s.*, 
        p.first_name || ' ' || p.last_name as player_name,
        t.name as team_name
      FROM shots s
      JOIN players p ON s.player_id = p.id
      JOIN teams t ON s.team_id = t.id
      WHERE s.game_id = $1
      ORDER BY s.created_at DESC
    `, [gameId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Record a new shot
router.post('/shots', [requireRole(['admin', 'coach']), validateShot], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    game_id, player_id, team_id, x_coord, y_coord,
    result, period, time_remaining, shot_type, distance
  } = req.body;

  try {
    // Verify game exists and is in progress
    const gameCheck = await db.query(
      'SELECT status FROM games WHERE id = $1',
      [game_id]
    );

    if (gameCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (gameCheck.rows[0].status !== 'in_progress') {
      return res.status(400).json({ 
        error: 'Invalid game status',
        details: 'Shots can only be recorded for games in progress'
      });
    }

    // Verify player belongs to the team
    const playerCheck = await db.query(
      'SELECT team_id FROM players WHERE id = $1',
      [player_id]
    );

    if (playerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    if (playerCheck.rows[0].team_id !== team_id) {
      return res.status(400).json({ error: 'Player does not belong to the specified team' });
    }

    const result = await db.query(`
      INSERT INTO shots (
        game_id, player_id, team_id, x_coord, y_coord,
        result, period, time_remaining, shot_type, distance
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      game_id, player_id, team_id, x_coord, y_coord,
      result, period, time_remaining, shot_type, distance
    ]);

    // If it's a goal, update the game score
    if (result.rows[0].result === 'goal') {
      const gameResult = await db.query(
        'SELECT home_team_id FROM games WHERE id = $1',
        [game_id]
      );

      const scoreField = team_id === gameResult.rows[0].home_team_id
        ? 'home_score'
        : 'away_score';

      await db.query(`
        UPDATE games 
        SET ${scoreField} = ${scoreField} + 1 
        WHERE id = $1
      `, [game_id]);
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Get all events for a game
router.get('/games/:gameId/events', [
  param('gameId').isInt().withMessage('Game ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;
  try {
    const result = await db.query(`
      SELECT e.*, 
        CASE WHEN e.player_id IS NOT NULL 
          THEN p.first_name || ' ' || p.last_name 
          ELSE NULL 
        END as player_name,
        t.name as team_name
      FROM game_events e
      LEFT JOIN players p ON e.player_id = p.id
      JOIN teams t ON e.team_id = t.id
      WHERE e.game_id = $1
      ORDER BY e.created_at DESC
    `, [gameId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Record a new game event
router.post('/events', [requireRole(['admin', 'coach']), validateGameEvent], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    game_id, event_type, team_id, player_id,
    period, time_remaining, details
  } = req.body;

  try {
    // Verify game exists and is in progress
    const gameCheck = await db.query(
      'SELECT status FROM games WHERE id = $1',
      [game_id]
    );

    if (gameCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (gameCheck.rows[0].status !== 'in_progress') {
      return res.status(400).json({ 
        error: 'Invalid game status',
        details: 'Events can only be recorded for games in progress'
      });
    }

    // If player_id is provided, verify player belongs to the team
    if (player_id) {
      const playerCheck = await db.query(
        'SELECT team_id FROM players WHERE id = $1',
        [player_id]
      );

      if (playerCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Player not found' });
      }

      if (playerCheck.rows[0].team_id !== team_id) {
        return res.status(400).json({ error: 'Player does not belong to the specified team' });
      }
    }

    const result = await db.query(`
      INSERT INTO game_events (
        game_id, event_type, team_id, player_id,
        period, time_remaining, details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      game_id, event_type, team_id, player_id,
      period, time_remaining, details
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

export default router;