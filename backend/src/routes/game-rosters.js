import express from 'express';
import { body, param, validationResult } from 'express-validator';
import pool from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';
import { hasTrainerAccess } from '../middleware/trainerAccess.js';
import { validateGameRosterTwizzit } from '../middleware/twizzitValidation.js';

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
    const { club_id } = req.query;

    try {
      let query = `
        SELECT 
          gr.*,
          p.first_name,
          p.last_name,
          p.jersey_number,
          p.gender,
          c.name as club_name,
          tpm.twizzit_player_id,
          tpm.sync_status AS twizzit_sync_status
        FROM game_rosters gr
        JOIN players p ON gr.player_id = p.id
        JOIN clubs c ON gr.club_id = c.id
        LEFT JOIN twizzit_player_mappings tpm ON tpm.local_player_id = p.id
        WHERE gr.game_id = $1
      `;
      const params = [gameId];

      if (club_id) {
        query += ' AND gr.club_id = $2';
        params.push(club_id);
      }

      query += ' ORDER BY gr.club_id, p.last_name, p.first_name';

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
    body('players.*.club_id').isInt().withMessage('Club ID must be an integer'),
    body('players.*.player_id').isInt().withMessage('Player ID must be an integer'),
    body('players.*.is_captain').optional().isBoolean(),
    body('players.*.is_starting').optional().isBoolean(),
    body('players.*.starting_position').optional().isIn(['offense', 'defense']).withMessage('Starting position must be offense or defense')
  ],
  validateGameRosterTwizzit, // Validate Twizzit registration for official matches
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

      // Preload Twizzit mappings for provided players to surface non-blocking alerts
      const playerIds = players.map((p) => p.player_id);
      const mappingResult = playerIds.length
        ? await pool.query(
          'SELECT local_player_id, sync_status, twizzit_player_id FROM twizzit_player_mappings WHERE local_player_id = ANY($1)',
          [playerIds]
        )
        : { rows: [] };
      const mappingByPlayer = new Map(mappingResult.rows.map((row) => [row.local_player_id, row]));

      // For coaches, enforce trainer assignment only when assignments exist for the coach
      if (req.user.role === 'coach') {
        const assignments = await pool.query(
          `SELECT club_id, team_id
             FROM trainer_assignments
            WHERE user_id = $1
              AND is_active = true
              AND active_from <= CURRENT_DATE
              AND (active_to IS NULL OR active_to >= CURRENT_DATE)`,
          [req.user.id]
        );

        if (assignments.rowCount > 0) {
          const clubIds = [...new Set(players.map((p) => p.club_id))];
          for (const clubId of clubIds) {
            const allowed = await hasTrainerAccess(req.user.id, { clubId });
            if (!allowed) {
              return res.status(403).json({ error: 'Trainer assignment required for this club to set roster', clubId });
            }
          }
        }
      }

      // Start transaction
      await pool.query('BEGIN');

      // Clear existing roster for this game
      await pool.query('DELETE FROM game_rosters WHERE game_id = $1', [gameId]);

      // Validate that only one captain per club
      const captainsByClub = {};
      for (const player of players) {
        if (player.is_captain) {
          if (captainsByClub[player.club_id]) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ 
              error: 'Only one captain allowed per club' 
            });
          }
          captainsByClub[player.club_id] = true;
        }
      }

      const warnings = [];

      // Insert all players
      const insertedPlayers = [];
      for (const player of players) {
        const mapping = mappingByPlayer.get(player.player_id);
        if (!mapping) {
          warnings.push({
            player_id: player.player_id,
            club_id: player.club_id,
            type: 'twizzit_registration_missing',
            message: 'Player has no Twizzit registration mapping; rostered anyway. Please sync to Twizzit.'
          });
        } else if (mapping.sync_status !== 'success') {
          warnings.push({
            player_id: player.player_id,
            club_id: player.club_id,
            twizzit_player_id: mapping.twizzit_player_id,
            type: 'twizzit_registration_unsynced',
            message: `Player Twizzit mapping exists but status is ${mapping.sync_status}; rostered anyway.`
          });
        }

        const result = await pool.query(
          `INSERT INTO game_rosters (game_id, club_id, player_id, is_captain, is_starting, starting_position)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            gameId,
            player.club_id,
            player.player_id,
            player.is_captain || false,
            player.is_starting !== undefined ? player.is_starting : true,
            player.starting_position || null
          ]
        );
        insertedPlayers.push(result.rows[0]);
      }

      await pool.query('COMMIT');
      res.status(201).json({ roster: insertedPlayers, warnings });
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error('Error adding players to roster:', error);
      
      if (error.code === '23503') {
        return res.status(400).json({ error: 'Invalid game, club, or player ID' });
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

      if (req.user.role === 'coach') {
        const allowed = await hasTrainerAccess(req.user.id, { clubId: entry.club_id });
        if (!allowed) {
          await pool.query('ROLLBACK');
          return res.status(403).json({ error: 'Trainer assignment required for this club to update roster' });
        }
      }

      // If setting as captain, ensure no other captain for this club
      if (is_captain === true) {
        await pool.query(
          'UPDATE game_rosters SET is_captain = false WHERE game_id = $1 AND club_id = $2 AND id != $3',
          [gameId, entry.club_id, rosterId]
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
      const existing = await pool.query('SELECT club_id FROM game_rosters WHERE id = $1 AND game_id = $2', [rosterId, gameId]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Roster entry not found' });
      }

      if (req.user.role === 'coach') {
        const allowed = await hasTrainerAccess(req.user.id, { clubId: existing.rows[0].club_id });
        if (!allowed) {
          return res.status(403).json({ error: 'Trainer assignment required for this club to remove roster entry' });
        }
      }

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
