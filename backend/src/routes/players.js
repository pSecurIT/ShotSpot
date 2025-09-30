import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Validation middleware
const validatePlayer = [
  body('team_id')
    .notEmpty()
    .withMessage('Team ID is required')
    .isInt()
    .withMessage('Team ID must be an integer'),
  body('first_name')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('last_name')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('jersey_number')
    .notEmpty()
    .withMessage('Jersey number is required')
    .isInt({ min: 1, max: 99 })
    .withMessage('Jersey number must be between 1 and 99'),
  body('position')
    .trim()
    .notEmpty()
    .withMessage('Position is required')
    .isIn(['attack', 'defense'])
    .withMessage('Position must be either attack or defense')
];

// Apply authentication middleware to all routes
router.use(auth);

// Get all players
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT players.*, teams.name as team_name 
      FROM players 
      LEFT JOIN teams ON players.team_id = teams.id 
      ORDER BY team_id, last_name, first_name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// Get players by team
router.get('/team/:teamId', async (req, res) => {
  const { teamId } = req.params;
  try {
    const result = await db.query(
      'SELECT * FROM players WHERE team_id = $1 ORDER BY last_name, first_name',
      [teamId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch team players' });
  }
});

// Create a new player
router.post('/', validatePlayer, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { team_id, first_name, last_name, jersey_number, position } = req.body;
  
  try {
    // Check for duplicate jersey number in the same team
    const existingPlayer = await db.query(
      'SELECT id FROM players WHERE team_id = $1 AND jersey_number = $2',
      [team_id, jersey_number]
    );

    if (existingPlayer.rows.length > 0) {
      return res.status(400).json({
        error: 'Jersey number already in use for this team'
      });
    }

    // Verify team exists
    const teamExists = await db.query('SELECT id FROM teams WHERE id = $1', [team_id]);
    if (teamExists.rows.length === 0) {
      return res.status(400).json({ error: 'Team does not exist' });
    }

    const result = await db.query(
      'INSERT INTO players (team_id, first_name, last_name, jersey_number, position) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [team_id, first_name, last_name, jersey_number, position]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23503') { // Foreign key violation
      return res.status(400).json({ error: 'Team does not exist' });
    }
    console.error('Create player error:', err);
    res.status(500).json({ error: 'Failed to create player' });
  }
});

// Update a player
router.put('/:id', validatePlayer, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { team_id, first_name, last_name, jersey_number, position, is_active } = req.body;
  
  try {
    // Check for duplicate jersey number in the same team, excluding current player
    const existingPlayer = await db.query(
      'SELECT id FROM players WHERE team_id = $1 AND jersey_number = $2 AND id != $3',
      [team_id, jersey_number, id]
    );

    if (existingPlayer.rows.length > 0) {
      return res.status(400).json({
        error: 'Jersey number already in use for this team'
      });
    }

    const result = await db.query(
      `UPDATE players 
       SET team_id = $1, first_name = $2, last_name = $3, 
           jersey_number = $4, position = $5, is_active = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
      [team_id, first_name, last_name, jersey_number, position, is_active, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23503') { // Foreign key violation
      return res.status(400).json({ error: 'Team does not exist' });
    }
    console.error('Update player error:', err);
    res.status(500).json({ error: 'Failed to update player' });
  }
});

// Delete a player
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM players WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json({ message: 'Player deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete player' });
  }
});

export default router;