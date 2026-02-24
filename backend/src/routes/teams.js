import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';
import { hasTrainerAccess } from '../middleware/trainerAccess.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// Get all teams (age groups)
router.get('/', async (req, res) => {
  try {
    const { club_id, season_id } = req.query;
    let query = `
      SELECT t.*, c.name as club_name, s.name as season_name
      FROM teams t
      LEFT JOIN clubs c ON t.club_id = c.id
      LEFT JOIN seasons s ON t.season_id = s.id
      WHERE 1=1
    `;
    const params = [];
    
    if (club_id) {
      params.push(club_id);
      query += ` AND t.club_id = $${params.length}`;
    }
    
    if (season_id) {
      params.push(season_id);
      query += ` AND t.season_id = $${params.length}`;
    }
    
    query += ' ORDER BY c.name, t.age_group, t.name';
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (_err) {
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Create a new team (age group)
router.post('/', [
  requireRole(['admin', 'coach']),
  body('club_id')
    .isInt({ min: 1 })
    .withMessage('Valid club ID is required'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Team name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Team name must be between 2 and 100 characters'),
  body('age_group')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Age group must be 20 characters or less'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'mixed'])
    .withMessage('Gender must be male, female, or mixed'),
  body('season_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Season ID must be a positive integer')
], async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { club_id, name, age_group, gender, season_id } = req.body;
  try {
    // Check if club exists
    const clubCheck = await db.query('SELECT id FROM clubs WHERE id = $1', [club_id]);
    if (clubCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Club not found' });
    }

    if (req.user.role === 'coach') {
      const allowed = await hasTrainerAccess(req.user.userId, { clubId: club_id });
      if (!allowed) {
        return res.status(403).json({ error: 'Trainer assignment required for this club' });
      }
    }

    const result = await db.query(
      `INSERT INTO teams (club_id, name, age_group, gender, season_id) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [club_id, name, age_group || null, gender || null, season_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Team with this name already exists for this club and season' });
    }
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Get a team by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(`
      SELECT t.*, c.name as club_name, s.name as season_name
      FROM teams t
      LEFT JOIN clubs c ON t.club_id = c.id
      LEFT JOIN seasons s ON t.season_id = s.id
      WHERE t.id = $1
    `, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Get players for a team (age group)
router.get('/:id/players', async (req, res) => {
  const { id } = req.params;
  try {
    // Verify team exists
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

// Update a team (age group)
router.put('/:id', [
  requireRole(['admin', 'coach']),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Team name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Team name must be between 2 and 100 characters'),
  body('age_group')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Age group must be 20 characters or less'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'mixed'])
    .withMessage('Gender must be male, female, or mixed'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
  body('season_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Season ID must be a positive integer')
], async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;
  const { name, age_group, gender, is_active, season_id } = req.body;
  try {
    // Load team to confirm existence and get club for trainer access
    const teamCheck = await db.query('SELECT id, club_id FROM teams WHERE id = $1', [id]);
    if (teamCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (req.user.role === 'coach') {
      const allowed = await hasTrainerAccess(req.user.userId, { clubId: Number(teamCheck.rows[0].club_id) });
      if (!allowed) {
        return res.status(403).json({ error: 'Trainer assignment required for this club' });
      }
    }

    const result = await db.query(
      `UPDATE teams 
       SET name = $1, age_group = $2, gender = $3, is_active = COALESCE($4, is_active), 
           season_id = $5, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $6 
       RETURNING *`,
      [name, age_group || null, gender || null, is_active, season_id || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Team with this name already exists for this club and season' });
    }
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Delete a team (age group)
router.delete('/:id', [
  requireRole(['admin', 'coach'])
], async (req, res) => {
  const { id } = req.params;
  try {
    // Load team to find club and verify existence
    const teamCheck = await db.query('SELECT id, club_id FROM teams WHERE id = $1', [id]);
    if (teamCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (req.user.role === 'coach') {
      const allowed = await hasTrainerAccess(req.user.userId, { clubId: Number(teamCheck.rows[0].club_id) });
      if (!allowed) {
        return res.status(403).json({ error: 'Trainer assignment required for this club' });
      }
    }

    // Begin a transaction
    await db.query('BEGIN');

    // Check if team has any games linked
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

    // Check if team has any players
    const playersCheck = await db.query(
      'SELECT id FROM players WHERE team_id = $1 LIMIT 1',
      [id]
    );

    if (playersCheck.rows.length > 0) {
      await db.query('ROLLBACK');
      return res.status(409).json({ 
        error: 'Cannot delete team',
        details: 'Team has players assigned. Please reassign or remove players first.'
      });
    }

    // Delete team
    const result = await db.query('DELETE FROM teams WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Team not found' });
    }

    await db.query('COMMIT');
    res.status(204).send();
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

export default router;