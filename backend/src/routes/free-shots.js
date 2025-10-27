import express from 'express';
import { body, param, validationResult } from 'express-validator';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

/**
 * Get all free shots for a game
 * GET /api/free-shots/:gameId
 */
router.get('/:gameId', async (req, res) => {
  const { gameId } = req.params;

  try {
    const result = await db.query(`
      SELECT 
        fs.*,
        p.first_name,
        p.last_name,
        p.jersey_number,
        t.name as team_name
      FROM free_shots fs
      JOIN teams t ON fs.team_id = t.id
      JOIN players p ON fs.player_id = p.id
      WHERE fs.game_id = $1
      ORDER BY fs.created_at DESC
    `, [gameId]);

    // Convert numeric fields from strings to numbers
    const freeShots = result.rows.map(shot => {
      if (shot.x_coord) shot.x_coord = parseFloat(shot.x_coord);
      if (shot.y_coord) shot.y_coord = parseFloat(shot.y_coord);
      if (shot.distance) shot.distance = parseFloat(shot.distance);
      return shot;
    });

    res.json(freeShots);
  } catch (error) {
    console.error('Error fetching free shots:', error);
    res.status(500).json({ error: 'Failed to fetch free shots' });
  }
});

/**
 * Create a new free shot
 * POST /api/free-shots
 * Body: { game_id, player_id, team_id, period, time_remaining?, free_shot_type, reason?, x_coord?, y_coord?, result, distance? }
 */
router.post('/', [
  requireRole(['admin', 'coach']),
  body('game_id')
    .notEmpty()
    .isInt({ min: 1 })
    .withMessage('Game ID must be a positive integer'),
  body('player_id')
    .notEmpty()
    .isInt({ min: 1 })
    .withMessage('Player ID must be a positive integer'),
  body('team_id')
    .notEmpty()
    .isInt({ min: 1 })
    .withMessage('Team ID must be a positive integer'),
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
    .withMessage('Distance must be a number')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const {
    game_id: gameId, player_id, team_id, period, time_remaining, free_shot_type,
    reason, x_coord, y_coord, result, distance
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
        error: 'Cannot add free shots to game that is not in progress',
        currentStatus: game.status
      });
    }

    // Verify team is participating in the game
    if (team_id !== game.home_team_id && team_id !== game.away_team_id) {
      return res.status(400).json({ 
        error: 'Team is not participating in this game',
        gameTeams: { home: game.home_team_id, away: game.away_team_id },
        providedTeam: team_id
      });
    }

    // Verify player belongs to the team
    const playerResult = await db.query(
      'SELECT * FROM players WHERE id = $1',
      [player_id]
    );

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    if (playerResult.rows[0].team_id !== team_id) {
      return res.status(400).json({ 
        error: 'Player does not belong to the specified team',
        playerTeam: playerResult.rows[0].team_id,
        providedTeam: team_id
      });
    }

    // Insert the free shot
    const insertQuery = `
      INSERT INTO free_shots (
        game_id, player_id, team_id, period, time_remaining,
        free_shot_type, reason, x_coord, y_coord, result, distance
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const result_query = await db.query(insertQuery, [
      gameId, player_id, team_id, period, time_remaining || null,
      free_shot_type, reason || null, x_coord || null, y_coord || null,
      result, distance || null
    ]);

    // Fetch the complete free shot with joined data
    const freeShotResult = await db.query(`
      SELECT 
        fs.*,
        p.first_name,
        p.last_name,
        p.jersey_number,
        t.name as team_name
      FROM free_shots fs
      JOIN teams t ON fs.team_id = t.id
      JOIN players p ON fs.player_id = p.id
      WHERE fs.id = $1
    `, [result_query.rows[0].id]);

    // Convert numeric fields from strings to numbers
    const freeShot = freeShotResult.rows[0];
    if (freeShot.x_coord) freeShot.x_coord = parseFloat(freeShot.x_coord);
    if (freeShot.y_coord) freeShot.y_coord = parseFloat(freeShot.y_coord);
    if (freeShot.distance) freeShot.distance = parseFloat(freeShot.distance);

    res.status(201).json(freeShot);
  } catch (error) {
    console.error('Error creating free shot:', error);
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
  body('team_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Team ID must be a positive integer'),
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
    .withMessage('Distance must be a number')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { freeShotId } = req.params;
  const updates = req.body;
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

    // Fetch the complete updated free shot with joined data
    const updatedResult = await db.query(`
      SELECT 
        fs.*,
        p.first_name,
        p.last_name,
        p.jersey_number,
        t.name as team_name
      FROM free_shots fs
      JOIN teams t ON fs.team_id = t.id
      JOIN players p ON fs.player_id = p.id
      WHERE fs.id = $1
    `, [freeShotId]);

    // Convert numeric fields from strings to numbers
    const freeShot = updatedResult.rows[0];
    if (freeShot.x_coord) freeShot.x_coord = parseFloat(freeShot.x_coord);
    if (freeShot.y_coord) freeShot.y_coord = parseFloat(freeShot.y_coord);
    if (freeShot.distance) freeShot.distance = parseFloat(freeShot.distance);

    res.json(freeShot);
  } catch (error) {
    console.error('Error updating free shot:', error);
    res.status(500).json({ error: 'Failed to update free shot' });
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
    console.error('Error deleting free shot:', error);
    res.status(500).json({ error: 'Failed to delete free shot' });
  }
});

export default router;