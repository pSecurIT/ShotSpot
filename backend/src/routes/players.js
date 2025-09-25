const express = require('express');
const router = express.Router();
const db = require('../db');

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
router.post('/', async (req, res) => {
  const { team_id, first_name, last_name, jersey_number, position } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO players (team_id, first_name, last_name, jersey_number, position) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [team_id, first_name, last_name, jersey_number, position]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create player' });
  }
});

// Update a player
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { team_id, first_name, last_name, jersey_number, position, is_active } = req.body;
  try {
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

module.exports = router;