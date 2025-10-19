import express from 'express';
import { body, query, validationResult } from 'express-validator';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

/**
 * Get all games with optional filtering
 * Query params: status, team_id, date_from, date_to
 */
router.get('/', [
  query('status')
    .optional()
    .isIn(['scheduled', 'to_reschedule', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Invalid status value'),
  query('team_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Team ID must be a positive integer'),
  query('date_from')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format for date_from'),
  query('date_to')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format for date_to')
], async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { status, team_id, date_from, date_to } = req.query;
  
  try {
    let query = `
      SELECT 
        g.*,
        ht.name as home_team_name,
        at.name as away_team_name
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.id
      JOIN teams at ON g.away_team_id = at.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND g.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (team_id) {
      query += ` AND (g.home_team_id = $${paramCount} OR g.away_team_id = $${paramCount})`;
      params.push(team_id);
      paramCount++;
    }

    if (date_from) {
      query += ` AND g.date >= $${paramCount}`;
      params.push(date_from);
      paramCount++;
    }

    if (date_to) {
      query += ` AND g.date <= $${paramCount}`;
      params.push(date_to);
      paramCount++;
    }

    query += ' ORDER BY g.date DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching games:', err);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

/**
 * Get a specific game by ID with detailed information
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await db.query(`
      SELECT 
        g.*,
        ht.name as home_team_name,
        at.name as away_team_name
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.id
      JOIN teams at ON g.away_team_id = at.id
      WHERE g.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching game:', err);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

/**
 * Create a new game
 */
router.post('/', [
  requireRole(['admin', 'coach']),
  body('home_team_id')
    .isInt({ min: 1 })
    .withMessage('Home team ID must be a positive integer'),
  body('away_team_id')
    .isInt({ min: 1 })
    .withMessage('Away team ID must be a positive integer'),
  body('date')
    .isISO8601()
    .withMessage('Date must be in ISO 8601 format'),
  body('status')
    .optional()
    .isIn(['scheduled', 'to_reschedule', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Invalid status value')
], async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { home_team_id, away_team_id, date, status = 'scheduled' } = req.body;

  // Validate that home and away teams are different
  if (home_team_id === away_team_id) {
    return res.status(400).json({ error: 'Home and away teams must be different' });
  }

  try {
    // Verify both teams exist
    const teamsCheck = await db.query(
      'SELECT id FROM teams WHERE id = $1 OR id = $2',
      [home_team_id, away_team_id]
    );

    if (teamsCheck.rows.length !== 2) {
      return res.status(404).json({ error: 'One or both teams not found' });
    }

    // Create the game
    const result = await db.query(`
      INSERT INTO games (home_team_id, away_team_id, date, status)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [home_team_id, away_team_id, date, status]);

    // Fetch the created game with team names
    const gameResult = await db.query(`
      SELECT 
        g.*,
        ht.name as home_team_name,
        at.name as away_team_name
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.id
      JOIN teams at ON g.away_team_id = at.id
      WHERE g.id = $1
    `, [result.rows[0].id]);

    res.status(201).json(gameResult.rows[0]);
  } catch (err) {
    console.error('Error creating game:', err);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

/**
 * Update game status and scores
 */
router.put('/:id', [
  requireRole(['admin', 'coach']),
  body('status')
    .optional()
    .isIn(['scheduled', 'to_reschedule', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Invalid status value'),
  body('home_score')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Home score must be a non-negative integer'),
  body('away_score')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Away score must be a non-negative integer'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be in ISO 8601 format'),
  body('home_attacking_side')
    .optional()
    .isIn(['left', 'right'])
    .withMessage('Home attacking side must be either "left" or "right"'),
  body('number_of_periods')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Number of periods must be between 1 and 10'),
  body('period_duration')
    .optional()
    .matches(/^\d{2}:\d{2}:\d{2}$/)
    .withMessage('Period duration must be in format HH:MM:SS')
], async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;
  const { status, home_score, away_score, date, home_attacking_side, number_of_periods, period_duration } = req.body;

  try {
    // Check if game exists
    const gameCheck = await db.query('SELECT * FROM games WHERE id = $1', [id]);
    if (gameCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Build update query dynamically
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    if (home_score !== undefined) {
      updates.push(`home_score = $${paramCount}`);
      params.push(home_score);
      paramCount++;
    }

    if (away_score !== undefined) {
      updates.push(`away_score = $${paramCount}`);
      params.push(away_score);
      paramCount++;
    }

    if (date !== undefined) {
      updates.push(`date = $${paramCount}`);
      params.push(date);
      paramCount++;
    }

    if (home_attacking_side !== undefined) {
      updates.push(`home_attacking_side = $${paramCount}`);
      params.push(home_attacking_side);
      paramCount++;
    }

    if (number_of_periods !== undefined) {
      updates.push(`number_of_periods = $${paramCount}`);
      params.push(number_of_periods);
      paramCount++;
    }

    if (period_duration !== undefined) {
      updates.push(`period_duration = $${paramCount}`);
      params.push(period_duration);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const query = `
      UPDATE games 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const _result = await db.query(query, params);

    // Fetch updated game with team names
    const gameResult = await db.query(`
      SELECT 
        g.*,
        ht.name as home_team_name,
        at.name as away_team_name
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.id
      JOIN teams at ON g.away_team_id = at.id
      WHERE g.id = $1
    `, [id]);

    res.json(gameResult.rows[0]);
  } catch (err) {
    console.error('Error updating game:', err);
    res.status(500).json({ error: 'Failed to update game' });
  }
});

/**
 * Start a game (change status to in_progress)
 */
router.post('/:id/start', [
  requireRole(['admin', 'coach'])
], async (req, res) => {
  const { id } = req.params;

  try {
    const gameCheck = await db.query('SELECT * FROM games WHERE id = $1', [id]);
    if (gameCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = gameCheck.rows[0];
    if (game.status === 'in_progress') {
      return res.status(400).json({ error: 'Game is already in progress' });
    }

    if (game.status === 'completed') {
      return res.status(400).json({ error: 'Cannot start a completed game' });
    }

    if (game.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot start a cancelled game' });
    }

    const _result = await db.query(`
      UPDATE games 
      SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);

    // Fetch updated game with team names
    const gameResult = await db.query(`
      SELECT 
        g.*,
        ht.name as home_team_name,
        at.name as away_team_name
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.id
      JOIN teams at ON g.away_team_id = at.id
      WHERE g.id = $1
    `, [id]);

    res.json(gameResult.rows[0]);
  } catch (err) {
    console.error('Error starting game:', err);
    res.status(500).json({ error: 'Failed to start game' });
  }
});

/**
 * End a game (change status to completed)
 */
router.post('/:id/end', [
  requireRole(['admin', 'coach'])
], async (req, res) => {
  const { id } = req.params;

  try {
    const gameCheck = await db.query('SELECT * FROM games WHERE id = $1', [id]);
    if (gameCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = gameCheck.rows[0];
    if (game.status === 'completed') {
      return res.status(400).json({ error: 'Game is already completed' });
    }

    if (game.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot end a cancelled game' });
    }

    const _result = await db.query(`
      UPDATE games 
      SET status = 'completed', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);

    // Fetch updated game with team names
    const gameResult = await db.query(`
      SELECT 
        g.*,
        ht.name as home_team_name,
        at.name as away_team_name
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.id
      JOIN teams at ON g.away_team_id = at.id
      WHERE g.id = $1
    `, [id]);

    res.json(gameResult.rows[0]);
  } catch (err) {
    console.error('Error ending game:', err);
    res.status(500).json({ error: 'Failed to end game' });
  }
});

/**
 * Cancel a game
 */
router.post('/:id/cancel', [
  requireRole(['admin', 'coach'])
], async (req, res) => {
  const { id } = req.params;

  try {
    const gameCheck = await db.query('SELECT * FROM games WHERE id = $1', [id]);
    if (gameCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = gameCheck.rows[0];
    if (game.status === 'completed') {
      return res.status(400).json({ error: 'Cannot cancel a completed game' });
    }

    if (game.status === 'cancelled') {
      return res.status(400).json({ error: 'Game is already cancelled' });
    }

    const _result = await db.query(`
      UPDATE games 
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);

    // Fetch updated game with team names
    const gameResult = await db.query(`
      SELECT 
        g.*,
        ht.name as home_team_name,
        at.name as away_team_name
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.id
      JOIN teams at ON g.away_team_id = at.id
      WHERE g.id = $1
    `, [id]);

    res.json(gameResult.rows[0]);
  } catch (err) {
    console.error('Error cancelling game:', err);
    res.status(500).json({ error: 'Failed to cancel game' });
  }
});

/**
 * Reschedule a game
 * Can mark as "to_reschedule" or immediately reschedule to a specific date/time
 */
router.post('/:id/reschedule', [
  requireRole(['admin', 'coach']),
  body('game_date')
    .optional()
    .isISO8601()
    .withMessage('Game date must be a valid ISO8601 date')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { game_date } = req.body;

  try {
    const gameCheck = await db.query('SELECT * FROM games WHERE id = $1', [id]);
    if (gameCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = gameCheck.rows[0];
    if (game.status === 'completed') {
      return res.status(400).json({ error: 'Cannot reschedule a completed game' });
    }

    if (game.status === 'in_progress') {
      return res.status(400).json({ error: 'Cannot reschedule a game in progress' });
    }

    // If date provided, reschedule to that date and set status to scheduled
    // If no date provided, just mark as to_reschedule
    let updateQuery;
    let queryParams;

    if (game_date) {
      updateQuery = `
        UPDATE games 
        SET date = $1, status = 'scheduled', updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
      queryParams = [game_date, id];
    } else {
      updateQuery = `
        UPDATE games 
        SET status = 'to_reschedule', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;
      queryParams = [id];
    }

    const _result = await db.query(updateQuery, queryParams);

    // Fetch updated game with team names
    const gameResult = await db.query(`
      SELECT 
        g.*,
        ht.name as home_team_name,
        at.name as away_team_name
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.id
      JOIN teams at ON g.away_team_id = at.id
      WHERE g.id = $1
    `, [id]);

    res.json(gameResult.rows[0]);
  } catch (err) {
    console.error('Error rescheduling game:', err);
    res.status(500).json({ error: 'Failed to reschedule game' });
  }
});

/**
 * Delete a game
 * Requires admin or coach role
 * Cascading deletes will automatically remove:
 * - All shots associated with the game
 * - All game events (fouls, substitutions, timeouts)
 * - All ball possessions
 * - All game roster entries
 */
router.delete('/:id', [
  requireRole(['admin', 'coach'])
], async (req, res) => {
  const { id } = req.params;

  try {
    // First check if game exists
    const gameCheck = await db.query(
      'SELECT id, status, home_team_name, away_team_name FROM (SELECT g.id, g.status, ht.name as home_team_name, at.name as away_team_name FROM games g JOIN teams ht ON g.home_team_id = ht.id JOIN teams at ON g.away_team_id = at.id WHERE g.id = $1) AS game_info',
      [id]
    );
    
    if (gameCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = gameCheck.rows[0];
    
    // Log the deletion for audit purposes
    console.log(`Deleting game ${id}: ${game.home_team_name} vs ${game.away_team_name} (Status: ${game.status})`);
    
    // Delete the game (cascade will handle related records)
    const result = await db.query('DELETE FROM games WHERE id = $1 RETURNING id', [id]);
    
    console.log(`Successfully deleted game ${id} and all related records`);
    
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting game:', err);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

export default router;
