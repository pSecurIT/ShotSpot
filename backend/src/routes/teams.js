const express = require('express');
const router = express.Router();
const db = require('../db');

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
router.post('/', async (req, res) => {
  const { name } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Update a team
router.put('/:id', async (req, res) => {
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
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// Delete a team
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM teams WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json({ message: 'Team deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

module.exports = router;