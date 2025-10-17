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
  body('role')
    .trim()
    .notEmpty()
    .withMessage('Role is required')
    .customSanitizer(value => value.toLowerCase())
    .isIn(['captain', 'player'])
    .withMessage('Role must be either captain or player')
];

// Apply authentication middleware to all routes
router.use(auth);

// Debug middleware to log all requests
router.use((req, res, next) => {
  console.log('Player Route Request:', {
    method: req.method,
    path: req.path,
    user: req.user,
    token: req.headers.authorization ? 'present' : 'missing',
  });
  next();
});

// Get all players
router.get('/', async (req, res) => {
  try {
    // Add optional team_id filter
    const { team_id } = req.query;
    const query = team_id
      ? `
        SELECT players.*, teams.name as team_name 
        FROM players 
        LEFT JOIN teams ON players.team_id = teams.id 
        WHERE team_id = $1
        ORDER BY team_id, last_name, first_name
      `
      : `
        SELECT players.*, teams.name as team_name 
        FROM players 
        LEFT JOIN teams ON players.team_id = teams.id 
        ORDER BY team_id, last_name, first_name
      `;
    
    const result = await db.query(query, team_id ? [team_id] : []);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Get a player by ID with stats
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Get player details and basic stats
    const result = await db.query(`
      WITH player_stats AS (
        SELECT 
          player_id,
          COUNT(*) as total_shots,
          COUNT(CASE WHEN result = 'goal' THEN 1 END) as goals,
          COUNT(CASE WHEN result = 'miss' THEN 1 END) as misses,
          COUNT(DISTINCT game_id) as games_played
        FROM shots
        WHERE player_id = $1
        GROUP BY player_id
      )
      SELECT 
        p.*,
        t.name as team_name,
        COALESCE(ps.total_shots, 0) as total_shots,
        COALESCE(ps.goals, 0) as goals,
        COALESCE(ps.misses, 0) as misses,
        COALESCE(ps.games_played, 0) as games_played
      FROM players p
      LEFT JOIN teams t ON p.team_id = t.id
      LEFT JOIN player_stats ps ON p.id = ps.player_id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
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
  } catch (_err) {
    res.status(500).json({ error: 'Failed to fetch team players' });
  }
});

// Create a new player
// Create a new player - allow either admin or coach role
router.post('/', [requireRole(['admin', 'coach']), ...validatePlayer], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Get data from request body, convert player role to lowercase
  // Handle both camelCase and snake_case property names
  const {
    team_id = req.body.teamId,
    first_name = req.body.firstName,
    last_name = req.body.lastName,
    jersey_number = req.body.jerseyNumber
  } = req.body;
  const role = (req.body.role || '').toLowerCase(); // Normalize the player's team role
  
  try {
    // Check for duplicate jersey number in the same team
    const existingPlayer = await db.query(
      'SELECT id FROM players WHERE team_id = $1 AND jersey_number = $2',
      [team_id, jersey_number]
    );

    if (existingPlayer.rows.length > 0) {
      return res.status(409).json({
        error: 'Jersey number already in use for this team'
      });
    }

    // Verify team exists
    const teamExists = await db.query('SELECT id FROM teams WHERE id = $1', [team_id]);
    if (teamExists.rows.length === 0) {
      return res.status(400).json({ error: 'Team does not exist' });
    }

    const result = await db.query(
      'INSERT INTO players (team_id, first_name, last_name, jersey_number, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [team_id, first_name, last_name, jersey_number, role]
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
router.put('/:id', [requireRole(['admin', 'coach']), ...validatePlayer], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  // Handle both camelCase and snake_case property names
  const {
    team_id = req.body.teamId,
    first_name = req.body.firstName,
    last_name = req.body.lastName,
    jersey_number = req.body.jerseyNumber,
    is_active = req.body.isActive
  } = req.body;
  const role = (req.body.role || '').toLowerCase(); // Normalize the player's team role
  
  try {
    // Check for duplicate jersey number in the same team, excluding current player
    const existingPlayer = await db.query(
      'SELECT id FROM players WHERE team_id = $1 AND jersey_number = $2 AND id != $3',
      [team_id, jersey_number, id]
    );

    if (existingPlayer.rows.length > 0) {
      return res.status(409).json({
        error: 'Jersey number already in use for this team'
      });
    }

    const result = await db.query(
      `UPDATE players 
       SET team_id = $1, first_name = $2, last_name = $3, 
           jersey_number = $4, role = $5, is_active = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
      [team_id, first_name, last_name, jersey_number, role, is_active, id]
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
router.delete('/:id', [requireRole(['admin', 'coach'])], async (req, res) => {
  const { id } = req.params;
  try {
    // Begin transaction
    await db.query('BEGIN');

    // Check if player has participated in any games
    const gameCheck = await db.query(`
      SELECT DISTINCT g.id 
      FROM games g
      JOIN shots s ON g.id = s.game_id
      WHERE s.player_id = $1
      LIMIT 1
    `, [id]);

    if (gameCheck.rows.length > 0) {
      await db.query('ROLLBACK');
      return res.status(409).json({
        error: 'Cannot delete player',
        details: 'Player has participated in games. You can set is_active to false instead.'
      });
    }

    const result = await db.query('DELETE FROM players WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Player not found' });
    }

    await db.query('COMMIT');
    res.status(204).send();
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

export default router;