import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';
import { hasTrainerAccess } from '../middleware/trainerAccess.js';

const router = express.Router();

// Validation middleware
const validatePlayer = [
  body('club_id')
    .notEmpty()
    .withMessage('Club ID is required')
    .isInt()
    .withMessage('Club ID must be an integer'),
  body('team_id')
    .optional()
    .isInt()
    .withMessage('Team ID must be an integer'),
  body('first_name')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  body('last_name')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  body('jersey_number')
    .notEmpty()
    .withMessage('Jersey number is required')
    .isInt({ min: 1, max: 99 })
    .withMessage('Jersey number must be between 1 and 99'),
  body('gender')
    .optional()
    .trim()
    .customSanitizer(value => value ? value.toLowerCase() : value)
    .isIn(['male', 'female'])
    .withMessage('Gender must be either male or female')
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

// Get all players with basic stats
router.get('/', async (req, res) => {
  try {
    // Add optional club_id and team_id filters
    const { club_id, team_id } = req.query;
    let query = `
      SELECT 
        p.*,
        c.name as club_name,
        t.name as team_name,
        COALESCE(COUNT(DISTINCT s.game_id), 0) as games_played,
        COALESCE(COUNT(CASE WHEN s.result = 'goal' THEN 1 END), 0) as goals,
        COALESCE(COUNT(s.id), 0) as total_shots
      FROM players p
      LEFT JOIN clubs c ON p.club_id = c.id
      LEFT JOIN teams t ON p.team_id = t.id
      LEFT JOIN shots s ON p.id = s.player_id
      WHERE 1=1
    `;
    const params = [];
    
    if (club_id) {
      params.push(club_id);
      query += ` AND p.club_id = $${params.length}`;
    }
    
    if (team_id) {
      params.push(team_id);
      query += ` AND p.team_id = $${params.length}`;
    }
    
    query += `
      GROUP BY p.id, c.name, t.name
      ORDER BY c.name, t.name, p.last_name, p.first_name
    `;
    
    const result = await db.query(query, params);
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
      `SELECT p.*, c.name as club_name, t.name as team_name
       FROM players p
       LEFT JOIN clubs c ON p.club_id = c.id
       LEFT JOIN teams t ON p.team_id = t.id
       WHERE p.team_id = $1 
       ORDER BY p.last_name, p.first_name`,
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
    // Format validation errors for better readability
    const formattedErrors = errors.array().map(err => err.msg).join('; ');
    return res.status(400).json({ 
      error: 'Validation failed',
      details: formattedErrors,
      validationErrors: errors.array()
    });
  }

  // Handle both camelCase and snake_case property names
  const {
    club_id = req.body.clubId,
    team_id = req.body.teamId,
    first_name = req.body.firstName,
    last_name = req.body.lastName,
    jersey_number = req.body.jerseyNumber,
    gender
  } = req.body;
  
  try {
    // Verify club exists
    const clubExists = await db.query('SELECT id FROM clubs WHERE id = $1', [club_id]);
    if (clubExists.rows.length === 0) {
      return res.status(400).json({ error: 'Club does not exist' });
    }

    if (req.user.role === 'coach') {
      const allowed = await hasTrainerAccess(req.user.userId, { clubId: club_id, teamId: team_id || null });
      if (!allowed) {
        return res.status(403).json({ error: 'Trainer assignment required for this club/team' });
      }
    }

    // If team_id provided, verify it exists and belongs to the club
    if (team_id) {
      const teamExists = await db.query('SELECT id FROM teams WHERE id = $1 AND club_id = $2', [team_id, club_id]);
      if (teamExists.rows.length === 0) {
        return res.status(400).json({ error: 'Team does not exist or does not belong to this club' });
      }
    }

    // Check for duplicate jersey number in the same club (enforced by DB constraint)
    const existingPlayer = await db.query(
      'SELECT id FROM players WHERE club_id = $1 AND jersey_number = $2',
      [club_id, jersey_number]
    );

    if (existingPlayer.rows.length > 0) {
      return res.status(409).json({
        error: 'Jersey number already in use for this club'
      });
    }

    const result = await db.query(
      'INSERT INTO players (club_id, team_id, first_name, last_name, jersey_number, gender, is_twizzit_registered) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [club_id, team_id || null, first_name, last_name, jersey_number, gender || null, false]
    );
    
    const player = result.rows[0];
    
    // Return player with warning about Twizzit registration requirement
    res.status(201).json({
      ...player,
      _warning: 'Player created but not yet registered in Twizzit. Official KBKB match participation requires Twizzit registration. Please sync from Twizzit or contact administrator.'
    });
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
    // Format validation errors for better readability
    const formattedErrors = errors.array().map(err => err.msg).join('; ');
    return res.status(400).json({ 
      error: 'Validation failed',
      details: formattedErrors,
      validationErrors: errors.array()
    });
  }

  const { id } = req.params;
  // Handle both camelCase and snake_case property names
  const {
    club_id = req.body.clubId,
    team_id = req.body.teamId,
    first_name = req.body.firstName,
    last_name = req.body.lastName,
    jersey_number = req.body.jerseyNumber,
    is_active = req.body.isActive,
    gender
  } = req.body;
  
  try {
    // Verify club exists
    const clubExists = await db.query('SELECT id FROM clubs WHERE id = $1', [club_id]);
    if (clubExists.rows.length === 0) {
      return res.status(400).json({ error: 'Club does not exist' });
    }

    if (req.user.role === 'coach') {
      const allowed = await hasTrainerAccess(req.user.userId, { clubId: club_id, teamId: team_id || null });
      if (!allowed) {
        return res.status(403).json({ error: 'Trainer assignment required for this club/team' });
      }
    }

    // If team_id provided, verify it exists and belongs to the club
    if (team_id) {
      const teamExists = await db.query('SELECT id FROM teams WHERE id = $1 AND club_id = $2', [team_id, club_id]);
      if (teamExists.rows.length === 0) {
        return res.status(400).json({ error: 'Team does not exist or does not belong to this club' });
      }

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
    }

    const result = await db.query(
      `UPDATE players 
       SET club_id = $1, team_id = $2, first_name = $3, last_name = $4, 
           jersey_number = $5, is_active = $6, gender = $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 RETURNING *`,
      [club_id, team_id || null, first_name, last_name, jersey_number, is_active, gender || null, id]
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