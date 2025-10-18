import express from 'express';
import { body, param, validationResult } from 'express-validator';
import pool from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

/**
 * GET /api/game-rosters/:gameId
 * Get all roster entries for a game (both teams)
 */
router.get(
  '/:gameId',
  [param('gameId').isInt()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gameId } = req.params;
    const { team_id } = req.query;

    try {
      let query = `
        SELECT 
          gr.*,
          p.first_name,
          p.last_name,
          p.jersey_number,
          p.gender,
          t.name as team_name
        FROM game_rosters gr
        JOIN players p ON gr.player_id = p.id
        JOIN teams t ON gr.team_id = t.id
        WHERE gr.game_id = $1
      `;
      const params = [gameId];

      if (team_id) {
        query += ' AND gr.team_id = $2';
        params.push(team_id);
      }

      query += ' ORDER BY gr.team_id, p.last_name, p.first_name';

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching game roster:', error);
      res.status(500).json({ error: 'Failed to fetch game roster' });
    }
  }
);

/**
 * POST /api/game-rosters/:gameId
 * Add player(s) to game roster
 * Body: { players: [{ team_id, player_id, is_captain, is_starting }] }
 */
router.post(
  '/:gameId',
  [
    requireRole(['admin', 'coach']),
    param('gameId').isInt(),
    body('players').isArray().withMessage('Players must be an array'),
    body('players.*.team_id').isInt().withMessage('Team ID must be an integer'),
    body('players.*.player_id').isInt().withMessage('Player ID must be an integer'),
    body('players.*.is_captain').optional().isBoolean(),
    body('players.*.is_starting').optional().isBoolean()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gameId } = req.params;
    const { players } = req.body;

    try {
      // Check if game exists
      const gameCheck = await pool.query('SELECT id FROM games WHERE id = $1', [gameId]);
      if (gameCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Game not found' });
      }

      // Start transaction
      await pool.query('BEGIN');

      // Clear existing roster for this game
      await pool.query('DELETE FROM game_rosters WHERE game_id = $1', [gameId]);

      // Validate that only one captain per team
      const captainsByTeam = {};
      for (const player of players) {
        if (player.is_captain) {
          if (captainsByTeam[player.team_id]) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ 
              error: 'Only one captain allowed per team' 
            });
          }
          captainsByTeam[player.team_id] = true;
        }
      }

      // Insert all players
      const insertedPlayers = [];
      for (const player of players) {
        const result = await pool.query(
          `INSERT INTO game_rosters (game_id, team_id, player_id, is_captain, is_starting)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [
            gameId,
            player.team_id,
            player.player_id,
            player.is_captain || false,
            player.is_starting !== undefined ? player.is_starting : true
          ]
        );
        insertedPlayers.push(result.rows[0]);
      }

      await pool.query('COMMIT');
      res.status(201).json(insertedPlayers);
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error('Error adding players to roster:', error);
      
      if (error.code === '23503') {
        return res.status(400).json({ error: 'Invalid game, team, or player ID' });
      }
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Player already in roster for this game' });
      }
      
      res.status(500).json({ error: 'Failed to add players to roster' });
    }
  }
);

/**
 * PUT /api/game-rosters/:gameId/:rosterId
 * Update a roster entry (toggle captain, starting status)
 */
router.put(
  '/:gameId/:rosterId',
  [
    requireRole(['admin', 'coach']),
    param('gameId').isInt(),
    param('rosterId').isInt(),
    body('is_captain').optional().isBoolean(),
    body('is_starting').optional().isBoolean()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gameId, rosterId } = req.params;
    const { is_captain, is_starting } = req.body;

    try {
      await pool.query('BEGIN');

      // Get current roster entry
      const currentEntry = await pool.query(
        'SELECT * FROM game_rosters WHERE id = $1 AND game_id = $2',
        [rosterId, gameId]
      );

      if (currentEntry.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ error: 'Roster entry not found' });
      }

      const entry = currentEntry.rows[0];

      // If setting as captain, ensure no other captain for this team
      if (is_captain === true) {
        await pool.query(
          'UPDATE game_rosters SET is_captain = false WHERE game_id = $1 AND team_id = $2 AND id != $3',
          [gameId, entry.team_id, rosterId]
        );
      }

      // Update the roster entry
      const updates = [];
      const params = [];
      let paramCount = 1;

      if (is_captain !== undefined) {
        updates.push(`is_captain = $${paramCount}`);
        params.push(is_captain);
        paramCount++;
      }

      if (is_starting !== undefined) {
        updates.push(`is_starting = $${paramCount}`);
        params.push(is_starting);
        paramCount++;
      }

      if (updates.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ error: 'No fields to update' });
      }

      params.push(rosterId);
      const result = await pool.query(
        `UPDATE game_rosters SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        params
      );

      await pool.query('COMMIT');
      res.json(result.rows[0]);
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error('Error updating roster entry:', error);
      res.status(500).json({ error: 'Failed to update roster entry' });
    }
  }
);

/**
 * DELETE /api/game-rosters/:gameId/:rosterId
 * Remove a player from game roster
 */
router.delete(
  '/:gameId/:rosterId',
  [
    requireRole(['admin', 'coach']),
    param('gameId').isInt(),
    param('rosterId').isInt()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gameId, rosterId } = req.params;

    try {
      const result = await pool.query(
        'DELETE FROM game_rosters WHERE id = $1 AND game_id = $2 RETURNING *',
        [rosterId, gameId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Roster entry not found' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error removing player from roster:', error);
      res.status(500).json({ error: 'Failed to remove player from roster' });
    }
  }
);

export default router;
