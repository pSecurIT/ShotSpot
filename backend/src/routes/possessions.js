import express from 'express';
import { body, param, validationResult } from 'express-validator';
import pool from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

/**
 * POST /api/possessions/:gameId
 * Start a new ball possession (ball crosses center line)
 */
router.post(
  '/:gameId',
  requireRole(['admin', 'coach']),
  param('gameId').isInt(),
  body('club_id').isInt(),
  body('period').isInt({ min: 1, max: 10 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gameId } = req.params;
    const { club_id, period } = req.body;

    try {
      // Validate game exists
      const gameRes = await pool.query('SELECT 1 FROM games WHERE id = $1', [gameId]);
      if (gameRes.rowCount === 0) {
        return res.status(404).json({ error: 'Game not found' });
      }

      // Validate club exists
      const clubRes = await pool.query('SELECT 1 FROM clubs WHERE id = $1', [club_id]);
      if (clubRes.rowCount === 0) {
        return res.status(404).json({ error: 'Club not found' });
      }

      // End any active possession for this game
      await pool.query(
        `UPDATE ball_possessions
         SET ended_at = CURRENT_TIMESTAMP,
             duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at))::INTEGER,
             result = COALESCE(result, 'turnover')
         WHERE game_id = $1 AND ended_at IS NULL`,
        [gameId]
      );

      // Create new possession and include club name
      const result = await pool.query(
        `INSERT INTO ball_possessions (game_id, club_id, period)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [gameId, club_id, period]
      );

      // Fetch the possession with club name to match GET /active response format
      const possessionWithClub = await pool.query(
        `SELECT p.*, c.name as club_name
         FROM ball_possessions p
         JOIN clubs c ON p.club_id = c.id
         WHERE p.id = $1`,
        [result.rows[0].id]
      );

      return res.status(201).json(possessionWithClub.rows[0]);
    } catch (error) {
      console.error('Error creating possession:', error);
      
      // Defensive mapping for FK errors if they still occur
      if (error && error.code === '23503') {
        if (error.constraint && error.constraint.includes('club')) {
          return res.status(404).json({ error: 'Club not found' });
        }
        if (error.constraint && error.constraint.includes('game')) {
          return res.status(404).json({ error: 'Game not found' });
        }
        return res.status(400).json({ error: 'Foreign key constraint failed' });
      }
      
      return res.status(500).json({ error: 'Failed to create possession' });
    }
  }
);

/**
 * PUT /api/possessions/:gameId/:possessionId
 * End a ball possession with result
 */
router.put(
  '/:gameId/:possessionId',
  requireRole(['admin', 'coach']),
  param('gameId').isInt(),
  param('possessionId').isInt(),
  body('result').isIn(['goal', 'turnover', 'out_of_bounds', 'timeout', 'period_end']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gameId, possessionId } = req.params;
    const { result } = req.body;

    try {
      const updateResult = await pool.query(
        `UPDATE ball_possessions
         SET ended_at = CURRENT_TIMESTAMP,
             duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at))::INTEGER,
             result = $1
         WHERE id = $2 AND game_id = $3 AND ended_at IS NULL
         RETURNING *`,
        [result, possessionId, gameId]
      );

      if (updateResult.rows.length === 0) {
        return res.status(404).json({ error: 'Possession not found or already ended' });
      }

      res.json(updateResult.rows[0]);
    } catch (error) {
      console.error('Error ending possession:', error);
      res.status(500).json({ error: 'Failed to end possession' });
    }
  }
);

/**
 * GET /api/possessions/:gameId
 * Get all possessions for a game with optional filtering
 */
router.get(
  '/:gameId',
  param('gameId').isInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gameId } = req.params;
    const { club_id, period } = req.query;

    try {
      let query = `
        SELECT p.*, c.name as club_name
        FROM ball_possessions p
        JOIN clubs c ON p.club_id = c.id
        WHERE p.game_id = $1
      `;
      const params = [gameId];
      let paramCount = 1;

      if (club_id) {
        paramCount++;
        query += ` AND p.club_id = $${paramCount}`;
        params.push(club_id);
      }

      if (period) {
        paramCount++;
        query += ` AND p.period = $${paramCount}`;
        params.push(period);
      }

      query += ' ORDER BY p.started_at DESC';

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching possessions:', error);
      res.status(500).json({ error: 'Failed to fetch possessions' });
    }
  }
);

/**
 * GET /api/possessions/:gameId/active
 * Get currently active possession for a game
 */
router.get(
  '/:gameId/active',
  param('gameId').isInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gameId } = req.params;

    try {
      const result = await pool.query(
        `SELECT p.*, c.name as club_name,
                EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - p.started_at))::INTEGER as current_duration_seconds
         FROM ball_possessions p
         JOIN clubs c ON p.club_id = c.id
         WHERE p.game_id = $1 AND p.ended_at IS NULL
         LIMIT 1`,
        [gameId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No active possession found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching active possession:', error);
      res.status(500).json({ error: 'Failed to fetch active possession' });
    }
  }
);

/**
 * GET /api/possessions/:gameId/stats
 * Get possession statistics for a game
 */
router.get(
  '/:gameId/stats',
  param('gameId').isInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gameId } = req.params;

    try {
      const result = await pool.query(
        `SELECT 
          p.club_id,
          c.name as club_name,
          COUNT(*)::INTEGER as total_possessions,
          ROUND(AVG(p.duration_seconds), 1) as avg_duration_seconds,
          ROUND(AVG(p.shots_taken), 2) as avg_shots_per_possession,
          SUM(CASE WHEN p.result = 'goal' THEN 1 ELSE 0 END)::INTEGER as possessions_with_goal,
          SUM(CASE WHEN p.result = 'turnover' THEN 1 ELSE 0 END)::INTEGER as turnovers
         FROM ball_possessions p
         JOIN clubs c ON p.club_id = c.id
         WHERE p.game_id = $1 AND p.ended_at IS NOT NULL
         GROUP BY p.club_id, c.name`,
        [gameId]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching possession stats:', error);
      res.status(500).json({ error: 'Failed to fetch possession stats' });
    }
  }
);

/**
 * PATCH /api/possessions/:gameId/:possessionId/increment-shots
 * Increment shots_taken counter for a possession
 */
router.patch(
  '/:gameId/:possessionId/increment-shots',
  requireRole(['admin', 'coach']),
  param('gameId').isInt(),
  param('possessionId').isInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gameId, possessionId } = req.params;

    try {
      const result = await pool.query(
        `UPDATE ball_possessions
         SET shots_taken = shots_taken + 1
         WHERE id = $1 AND game_id = $2
         RETURNING *`,
        [possessionId, gameId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Possession not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error incrementing shots:', error);
      res.status(500).json({ error: 'Failed to increment shots' });
    }
  }
);

export default router;
