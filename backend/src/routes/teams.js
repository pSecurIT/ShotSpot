import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// Get all teams
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM teams ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Create a new team
router.post('/', [
  requireRole(['admin', 'coach']),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Team name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Team name must be between 2 and 100 characters')
], async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Team name already exists' });
    }
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Get a team by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT * FROM teams WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Get team players
router.get('/:id/players', async (req, res) => {
  const { id } = req.params;
  try {
    // First check if team exists
    const teamResult = await db.query('SELECT id FROM teams WHERE id = $1', [id]);
    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const result = await db.query(
      'SELECT * FROM players WHERE team_id = $1 ORDER BY jersey_number',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Update a team
router.put('/:id', [
  requireRole(['admin', 'coach']),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Team name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Team name must be between 2 and 100 characters')
], async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { name } = req.body;
  try {
    const result = await db.query(
      'UPDATE teams SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [name, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Team name already exists' });
    }
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Delete a team
router.delete('/:id', [
  requireRole(['admin', 'coach'])
], async (req, res) => {
  const { id } = req.params;
  try {
    // Begin a transaction
    await db.query('BEGIN');

    // Check if team has any games
    const gamesCheck = await db.query(
      'SELECT id FROM games WHERE home_team_id = $1 OR away_team_id = $1 LIMIT 1',
      [id]
    );

    if (gamesCheck.rows.length > 0) {
      await db.query('ROLLBACK');
      return res.status(409).json({ 
        error: 'Cannot delete team',
        details: 'Team has associated games. Please delete games first.'
      });
    }

    // Delete team and associated players
    const result = await db.query('DELETE FROM teams WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Team not found' });
    }

    await db.query('COMMIT');
    res.json({ 
      message: 'Team deleted successfully',
      details: 'All associated players have been removed'
    });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

export default router;