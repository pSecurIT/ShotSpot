import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// Get all clubs
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM clubs ORDER BY name');
    res.json(result.rows);
  } catch (_err) {
    res.status(500).json({ error: 'Failed to fetch clubs' });
  }
});

// Create a new club
router.post('/', [
  requireRole(['admin', 'coach']),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Club name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Club name must be between 2 and 100 characters')
], async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { name } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Club name already exists' });
    }
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Get a club by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT * FROM clubs WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Club not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Get club teams (age groups)
router.get('/:id/teams', async (req, res) => {
  const { id } = req.params;
  try {
    // First check if club exists
    const clubResult = await db.query('SELECT id FROM clubs WHERE id = $1', [id]);
    if (clubResult.rows.length === 0) {
      return res.status(404).json({ error: 'Club not found' });
    }

    const result = await db.query(
      'SELECT * FROM teams WHERE club_id = $1 ORDER BY name',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Get club players (all players across all teams)
router.get('/:id/players', async (req, res) => {
  const { id } = req.params;
  try {
    // First check if club exists
    const clubResult = await db.query('SELECT id FROM clubs WHERE id = $1', [id]);
    if (clubResult.rows.length === 0) {
      return res.status(404).json({ error: 'Club not found' });
    }

    const result = await db.query(
      `SELECT p.*, t.name as team_name 
       FROM players p 
       LEFT JOIN teams t ON p.team_id = t.id
       WHERE p.club_id = $1 
       ORDER BY t.name, p.jersey_number`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Update a club
router.put('/:id', [
  requireRole(['admin', 'coach']),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Club name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Club name must be between 2 and 100 characters')
], async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;
  const { name } = req.body;
  try {
    const result = await db.query(
      'UPDATE clubs SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [name, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Club not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Club name already exists' });
    }
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Delete a club
router.delete('/:id', [
  requireRole(['admin', 'coach'])
], async (req, res) => {
  const { id } = req.params;
  try {
    // Begin a transaction
    await db.query('BEGIN');

    // Check if club has any games
    const gamesCheck = await db.query(
      'SELECT id FROM games WHERE home_club_id = $1 OR away_club_id = $1 LIMIT 1',
      [id]
    );

    if (gamesCheck.rows.length > 0) {
      await db.query('ROLLBACK');
      return res.status(409).json({ 
        error: 'Cannot delete club',
        details: 'Club has associated games. Please delete games first.'
      });
    }

    // Check if club still has teams
    const teamsCheck = await db.query(
      'SELECT id FROM teams WHERE club_id = $1 LIMIT 1',
      [id]
    );

    if (teamsCheck.rows.length > 0) {
      await db.query('ROLLBACK');
      return res.status(409).json({ 
        error: 'Cannot delete club with teams',
        details: 'Club has dependent teams. Remove teams first.'
      });
    }

    // Delete club (cascade will handle teams and players)
    const result = await db.query('DELETE FROM clubs WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Club not found' });
    }

    await db.query('COMMIT');
    res.status(204).send();
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

export default router;
