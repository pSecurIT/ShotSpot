import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import pool from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

import { logError } from '../utils/logger.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

const SUBSTITUTION_EVENT_STATUSES = ['confirmed', 'unconfirmed'];

const fetchCompleteSubstitutionById = async (substitutionId) => {
  const result = await pool.query(
    `SELECT 
      s.*,
      pin.first_name as player_in_first_name,
      pin.last_name as player_in_last_name,
      pin.jersey_number as player_in_jersey_number,
      pout.first_name as player_out_first_name,
      pout.last_name as player_out_last_name,
      pout.jersey_number as player_out_jersey_number,
      c.name as club_name
    FROM substitutions s
    JOIN players pin ON s.player_in_id = pin.id
    JOIN players pout ON s.player_out_id = pout.id
    JOIN clubs c ON s.club_id = c.id
    WHERE s.id = $1`,
    [substitutionId]
  );

  return result.rows[0] || null;
};

/**
 * GET /api/substitutions/:gameId
 * Get all substitutions for a game with optional filtering
 * Query params: team_id, period, player_id
 */
router.get(
  '/:gameId',
  [
    param('gameId').isInt().withMessage('Game ID must be an integer'),
    query('club_id').optional().isInt().withMessage('Club ID must be an integer'),
    query('period').optional().isInt({ min: 1 }).withMessage('Period must be a positive integer'),
    query('player_id').optional().isInt().withMessage('Player ID must be an integer'),
    query('event_status').optional().isIn(SUBSTITUTION_EVENT_STATUSES).withMessage('Invalid event status value')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gameId } = req.params;
    const { club_id, period, player_id, event_status } = req.query;

    try {
      let query = `
        SELECT 
          s.*,
          pin.first_name as player_in_first_name,
          pin.last_name as player_in_last_name,
          pin.jersey_number as player_in_jersey_number,
          pout.first_name as player_out_first_name,
          pout.last_name as player_out_last_name,
          pout.jersey_number as player_out_jersey_number,
          c.name as club_name
        FROM substitutions s
        JOIN players pin ON s.player_in_id = pin.id
        JOIN players pout ON s.player_out_id = pout.id
        JOIN clubs c ON s.club_id = c.id
        WHERE s.game_id = $1
      `;
      const params = [gameId];
      let paramIndex = 2;

      if (club_id) {
        query += ` AND s.club_id = $${paramIndex}`;
        params.push(club_id);
        paramIndex++;
      }

      if (period) {
        query += ` AND s.period = $${paramIndex}`;
        params.push(period);
        paramIndex++;
      }

      if (player_id) {
        query += ` AND (s.player_in_id = $${paramIndex} OR s.player_out_id = $${paramIndex})`;
        params.push(player_id);
        paramIndex++;
      }

      if (event_status) {
        query += ` AND s.event_status = $${paramIndex}`;
        params.push(event_status);
        paramIndex++;
      }

      query += ' ORDER BY s.created_at DESC';

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      logError('Error fetching substitutions:', error);
      res.status(500).json({ error: 'Failed to fetch substitutions' });
    }
  }
);

/**
 * GET /api/substitutions/:gameId/active-players
 * Get current active (on-court) players for both teams based on starting lineup and substitutions
 * Returns which players are currently on the court vs on the bench
 */
router.get(
  '/:gameId/active-players',
  [param('gameId').isInt().withMessage('Game ID must be an integer')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gameId } = req.params;

    try {
      // Fetch game to determine home/away clubs
      const gameResult = await pool.query(
        'SELECT id, home_club_id, away_club_id FROM games WHERE id = $1',
        [gameId]
      );

      if (gameResult.rows.length === 0) {
        return res.status(404).json({ error: 'Game not found' });
      }

      const game = gameResult.rows[0];

      // Get starting lineup from game_rosters
      const rosterResult = await pool.query(
        `SELECT 
          gr.player_id,
          gr.club_id,
          gr.is_starting,
          p.first_name,
          p.last_name,
          p.jersey_number,
          p.gender,
          c.name as club_name
         FROM game_rosters gr
         JOIN players p ON gr.player_id = p.id
         JOIN clubs c ON gr.club_id = c.id
         WHERE gr.game_id = $1
         ORDER BY gr.club_id, p.jersey_number`,
        [gameId]
      );

      if (rosterResult.rows.length === 0) {
        return res.status(404).json({ error: 'No roster found for this game' });
      }

      // Get all substitutions for this game
      const subsResult = await pool.query(
        `SELECT player_in_id, player_out_id, club_id, created_at
         FROM substitutions
         WHERE game_id = $1 AND event_status = 'confirmed'
         ORDER BY created_at ASC`,
        [gameId]
      );

      // Calculate current active players
      const activePlayers = new Map(); // player_id -> boolean (true = on court, false = on bench)
      
      // Initialize with starting lineup
      rosterResult.rows.forEach(player => {
        activePlayers.set(player.player_id, player.is_starting);
      });

      // Apply all substitutions in chronological order
      subsResult.rows.forEach(sub => {
        activePlayers.set(sub.player_out_id, false); // Player out goes to bench
        activePlayers.set(sub.player_in_id, true);   // Player in goes to court
      });

      // Build response
      const response = {
        home_team: { active: [], bench: [] },
        away_team: { active: [], bench: [] }
      };

      rosterResult.rows.forEach(player => {
        const isActive = activePlayers.get(player.player_id);
        const playerData = {
          id: player.player_id,
          club_id: player.club_id,
          first_name: player.first_name,
          last_name: player.last_name,
          jersey_number: player.jersey_number,
          gender: player.gender,
          club_name: player.club_name
        };

        const clubKey = player.club_id === game.home_club_id ? 'home_team' : 'away_team';

        if (isActive) {
          response[clubKey].active.push(playerData);
        } else {
          response[clubKey].bench.push(playerData);
        }
      });

      res.json(response);
    } catch (error) {
      logError('Error fetching active players:', error);
      res.status(500).json({ error: 'Failed to fetch active players' });
    }
  }
);

/**
 * POST /api/substitutions/:gameId
 * Record a substitution during a live match
 * Body: { team_id, player_in_id, player_out_id, period, time_remaining, reason }
 */
router.post(
  '/:gameId',
  [
    requireRole(['admin', 'coach']),
    param('gameId').isInt().withMessage('Game ID must be an integer'),
    body('club_id').isInt({ min: 1 }).withMessage('Club ID must be a positive integer'),
    body('player_in_id').isInt({ min: 1 }).withMessage('Player in ID must be a positive integer'),
    body('player_out_id').isInt({ min: 1 }).withMessage('Player out ID must be a positive integer'),
    body('period').isInt({ min: 1 }).withMessage('Period must be a positive integer'),
    body('time_remaining').optional().isString().withMessage('Time remaining must be a string'),
    body('reason')
      .optional()
      .isIn(['tactical', 'injury', 'fatigue', 'disciplinary'])
      .withMessage('Reason must be one of: tactical, injury, fatigue, disciplinary'),
    body('client_uuid').optional().isUUID().withMessage('client_uuid must be a valid UUID'),
    body('event_status').optional().isIn(SUBSTITUTION_EVENT_STATUSES).withMessage('event_status must be confirmed or unconfirmed')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gameId } = req.params;
    const { club_id, player_in_id, player_out_id, period, time_remaining, reason, client_uuid, event_status } = req.body;
    const normalizedEventStatus = event_status || 'confirmed';

    try {
      // Validate: player_in and player_out must be different
      if (player_in_id === player_out_id) {
        return res.status(400).json({ error: 'Player in and player out must be different' });
      }

      if (client_uuid) {
        const existingSubstitutionResult = await pool.query(
          'SELECT id FROM substitutions WHERE game_id = $1 AND client_uuid = $2 LIMIT 1',
          [gameId, client_uuid]
        );

        if (existingSubstitutionResult.rows.length > 0) {
          const existingSubstitution = await fetchCompleteSubstitutionById(existingSubstitutionResult.rows[0].id);
          return res.status(200).json(existingSubstitution);
        }
      }

      await pool.query('BEGIN');

      // Verify game exists and is in progress
      const gameResult = await pool.query(
        'SELECT id, status, home_club_id, away_club_id FROM games WHERE id = $1',
        [gameId]
      );

      if (gameResult.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ error: 'Game not found' });
      }

      const game = gameResult.rows[0];
      if (game.status !== 'in_progress') {
        await pool.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Cannot record substitution for game that is not in progress',
          currentStatus: game.status
        });
      }

      // Verify club is participating in the game
      if (club_id !== game.home_club_id && club_id !== game.away_club_id) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ error: 'Club is not participating in this game' });
      }

      // Verify both players exist and belong to the club
      const playersResult = await pool.query(
        'SELECT id, club_id, first_name, last_name, jersey_number FROM players WHERE id = ANY($1)',
        [[player_in_id, player_out_id]]
      );

      if (playersResult.rows.length !== 2) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ error: 'One or both players not found' });
      }

      const playerIn = playersResult.rows.find(p => p.id === player_in_id);
      const playerOut = playersResult.rows.find(p => p.id === player_out_id);

      if (playerIn.club_id !== club_id || playerOut.club_id !== club_id) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ error: 'Both players must belong to the specified club' });
      }

      // Verify both players are in the game roster
      const rosterCheck = await pool.query(
        'SELECT player_id FROM game_rosters WHERE game_id = $1 AND player_id = ANY($2)',
        [gameId, [player_in_id, player_out_id]]
      );

      if (rosterCheck.rows.length !== 2) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Both players must be in the game roster',
          details: 'Players must be added to the roster before they can participate in substitutions'
        });
      }

      // Get current active players to validate substitution logic
      // Simpler approach: count ins vs outs for each player
      const activePlayersQuery = `
        WITH starting_lineup AS (
          SELECT player_id, is_starting
          FROM game_rosters
          WHERE game_id = $1 AND player_id = ANY($2)
        ),
        player_ins AS (
          SELECT player_in_id as player_id, COUNT(*) as in_count
          FROM substitutions
          WHERE game_id = $1 AND player_in_id = ANY($2) AND event_status = 'confirmed'
          GROUP BY player_in_id
        ),
        player_outs AS (
          SELECT player_out_id as player_id, COUNT(*) as out_count
          FROM substitutions
          WHERE game_id = $1 AND player_out_id = ANY($2) AND event_status = 'confirmed'
          GROUP BY player_out_id
        )
        SELECT 
          sl.player_id,
          sl.is_starting,
          COALESCE(pi.in_count, 0) as times_subbed_in,
          COALESCE(po.out_count, 0) as times_subbed_out,
          -- Player is active if: (started AND (ins = outs)) OR (didn't start AND (ins > outs))
          CASE 
            WHEN sl.is_starting THEN COALESCE(pi.in_count, 0) = COALESCE(po.out_count, 0)
            ELSE COALESCE(pi.in_count, 0) > COALESCE(po.out_count, 0)
          END as is_active
        FROM starting_lineup sl
        LEFT JOIN player_ins pi ON sl.player_id = pi.player_id
        LEFT JOIN player_outs po ON sl.player_id = po.player_id
      `;

      const activeCheck = await pool.query(activePlayersQuery, [gameId, [player_in_id, player_out_id]]);
      
      const playerInStatus = activeCheck.rows.find(p => p.player_id === player_in_id);
      const playerOutStatus = activeCheck.rows.find(p => p.player_id === player_out_id);

      // Validate: player coming in must be on bench, player going out must be on court
      if (playerInStatus?.is_active) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Player coming in is already on the court',
          playerIn: `${playerIn.first_name} ${playerIn.last_name} #${playerIn.jersey_number}`
        });
      }

      if (!playerOutStatus?.is_active) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Player going out is not currently on the court',
          playerOut: `${playerOut.first_name} ${playerOut.last_name} #${playerOut.jersey_number}`
        });
      }

      // Insert the substitution
      const insertResult = await pool.query(
        `INSERT INTO substitutions (game_id, club_id, player_in_id, player_out_id, period, time_remaining, reason, client_uuid, event_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [gameId, club_id, player_in_id, player_out_id, period, time_remaining || null, reason || 'tactical', client_uuid || null, normalizedEventStatus]
      );

      await pool.query('COMMIT');

      const substitution = await fetchCompleteSubstitutionById(insertResult.rows[0].id);

      res.status(201).json(substitution);
    } catch (error) {
      await pool.query('ROLLBACK');

      if (error.code === '23505' && client_uuid) {
        try {
          const existingSubstitutionResult = await pool.query(
            'SELECT id FROM substitutions WHERE game_id = $1 AND client_uuid = $2 LIMIT 1',
            [gameId, client_uuid]
          );

          if (existingSubstitutionResult.rows.length > 0) {
            const existingSubstitution = await fetchCompleteSubstitutionById(existingSubstitutionResult.rows[0].id);
            return res.status(200).json(existingSubstitution);
          }
        } catch (lookupError) {
          logError('Error resolving duplicate substitution by client_uuid:', lookupError);
        }
      }

      logError('Error recording substitution:', error);
      
      if (error.code === '23514') { // Check constraint violation
        return res.status(400).json({ error: 'Player in and player out must be different' });
      }
      
      res.status(500).json({ error: 'Failed to record substitution' });
    }
  }
);

/**
 * PUT /api/substitutions/:gameId/:substitutionId
 * Update a substitution for pending/edit workflow.
 */
router.put(
  '/:gameId/:substitutionId',
  [
    requireRole(['admin', 'coach']),
    param('gameId').isInt().withMessage('Game ID must be an integer'),
    param('substitutionId').isInt().withMessage('Substitution ID must be an integer'),
    body('period').optional().isInt({ min: 1 }).withMessage('Period must be a positive integer'),
    body('time_remaining').optional({ nullable: true }).isString().withMessage('Time remaining must be a string'),
    body('reason')
      .optional()
      .isIn(['tactical', 'injury', 'fatigue', 'disciplinary'])
      .withMessage('Reason must be one of: tactical, injury, fatigue, disciplinary'),
    body('event_status').optional().isIn(SUBSTITUTION_EVENT_STATUSES).withMessage('event_status must be confirmed or unconfirmed')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gameId, substitutionId } = req.params;
    const { period, time_remaining, reason, event_status } = req.body;

    try {
      const substitutionResult = await pool.query(
        'SELECT id FROM substitutions WHERE id = $1 AND game_id = $2',
        [substitutionId, gameId]
      );

      if (substitutionResult.rows.length === 0) {
        return res.status(404).json({ error: 'Substitution not found' });
      }

      const updateFields = [];
      const params = [];
      let paramIndex = 1;

      if (period !== undefined) {
        updateFields.push(`period = $${paramIndex}`);
        params.push(period);
        paramIndex++;
      }

      if (time_remaining !== undefined) {
        updateFields.push(`time_remaining = $${paramIndex}`);
        params.push(time_remaining || null);
        paramIndex++;
      }

      if (reason !== undefined) {
        updateFields.push(`reason = $${paramIndex}`);
        params.push(reason);
        paramIndex++;
      }

      if (event_status !== undefined) {
        updateFields.push(`event_status = $${paramIndex}`);
        params.push(event_status);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      params.push(substitutionId);

      await pool.query(
        `UPDATE substitutions SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
        params
      );

      const substitution = await fetchCompleteSubstitutionById(substitutionId);
      return res.status(200).json(substitution);
    } catch (error) {
      logError('Error updating substitution:', error);
      return res.status(500).json({ error: 'Failed to update substitution' });
    }
  }
);

/**
 * POST /api/substitutions/:gameId/:substitutionId/confirm
 * Confirm a substitution event.
 */
router.post(
  '/:gameId/:substitutionId/confirm',
  [
    requireRole(['admin', 'coach']),
    param('gameId').isInt().withMessage('Game ID must be an integer'),
    param('substitutionId').isInt().withMessage('Substitution ID must be an integer')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gameId, substitutionId } = req.params;

    try {
      const substitutionResult = await pool.query(
        'SELECT * FROM substitutions WHERE id = $1 AND game_id = $2',
        [substitutionId, gameId]
      );

      if (substitutionResult.rows.length === 0) {
        return res.status(404).json({ error: 'Substitution not found' });
      }

      if (substitutionResult.rows[0].event_status !== 'confirmed') {
        await pool.query(
          'UPDATE substitutions SET event_status = $1 WHERE id = $2',
          ['confirmed', substitutionId]
        );
      }

      const substitution = await fetchCompleteSubstitutionById(substitutionId);
      res.status(200).json(substitution);
    } catch (error) {
      logError('Error confirming substitution:', error);
      res.status(500).json({ error: 'Failed to confirm substitution' });
    }
  }
);

/**
 * DELETE /api/substitutions/:gameId/:substitutionId
 * Delete/undo a substitution (useful for correcting mistakes)
 */
router.delete(
  '/:gameId/:substitutionId',
  [
    requireRole(['admin', 'coach']),
    param('gameId').isInt().withMessage('Game ID must be an integer'),
    param('substitutionId').isInt().withMessage('Substitution ID must be an integer')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gameId, substitutionId } = req.params;

    try {
      // Verify substitution exists and belongs to the game
      const subCheck = await pool.query(
        'SELECT id FROM substitutions WHERE id = $1 AND game_id = $2',
        [substitutionId, gameId]
      );

      if (subCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Substitution not found' });
      }

      // Check if this is the most recent substitution
      const recentCheck = await pool.query(
        `SELECT id FROM substitutions 
         WHERE game_id = $1 AND created_at > (SELECT created_at FROM substitutions WHERE id = $2)
         LIMIT 1`,
        [gameId, substitutionId]
      );

      if (recentCheck.rows.length > 0) {
        return res.status(400).json({ 
          error: 'Can only delete the most recent substitution',
          details: 'To maintain data integrity, substitutions must be undone in reverse chronological order'
        });
      }

      // Delete the substitution
      await pool.query('DELETE FROM substitutions WHERE id = $1', [substitutionId]);

      res.status(200).json({ message: 'Substitution deleted successfully' });
    } catch (error) {
      logError('Error deleting substitution:', error);
      res.status(500).json({ error: 'Failed to delete substitution' });
    }
  }
);

export default router;
