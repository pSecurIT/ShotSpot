import express from 'express';
import { body, param, validationResult } from 'express-validator';
import pool from '../db.js';

const router = express.Router();

/**
 * POST /api/possessions/:gameId
 * Start a new ball possession (ball crosses center line)
 */
router.post(
  '/:gameId',
  [
    param('gameId').isInt(),
    body('team_id').isInt(),
    body('period').isInt({ min: 1, max: 10 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gameId } = req.params;
    const { team_id, period } = req.body;

    try {
      // First, end any active possession for this game
      await pool.query(
        `UPDATE ball_possessions 
         SET ended_at = CURRENT_TIMESTAMP,
             duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at))::INTEGER,
             result = CASE WHEN result IS NULL THEN 'turnover' ELSE result END
         WHERE game_id = $1 AND ended_at IS NULL`,
        [gameId]
      );

      // Create new possession
      const result = await pool.query(
        `INSERT INTO ball_possessions (game_id, team_id, period)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [gameId, team_id, period]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating possession:', error);
      res.status(500).json({ error: 'Failed to create possession' });
    }
  }
);

/**
 * PUT /api/possessions/:gameId/:possessionId
 * End a ball possession with result
 */
router.put(
  '/:gameId/:possessionId',
  [
    param('gameId').isInt(),
    param('possessionId').isInt(),
    body('result').isIn(['goal', 'turnover', 'out_of_bounds', 'timeout', 'period_end'])
  ],
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
  [
    param('gameId').isInt()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gameId } = req.params;
    const { team_id, period } = req.query;

    try {
      let query = `
        SELECT p.*, t.name as team_name
        FROM ball_possessions p
        JOIN teams t ON p.team_id = t.id
        WHERE p.game_id = $1
      `;
      const params = [gameId];
      let paramCount = 1;

      if (team_id) {
        paramCount++;
        query += ` AND p.team_id = $${paramCount}`;
        params.push(team_id);
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
  [
    param('gameId').isInt()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gameId } = req.params;

    try {
      const result = await pool.query(
        `SELECT p.*, t.name as team_name,
                EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - p.started_at))::INTEGER as current_duration_seconds
         FROM ball_possessions p
         JOIN teams t ON p.team_id = t.id
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
  [
    param('gameId').isInt()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gameId } = req.params;

    try {
      const result = await pool.query(
        `SELECT 
          p.team_id,
          t.name as team_name,
          COUNT(*) as total_possessions,
          ROUND(AVG(p.duration_seconds), 1) as avg_duration_seconds,
          ROUND(AVG(p.shots_taken), 2) as avg_shots_per_possession,
          SUM(CASE WHEN p.result = 'goal' THEN 1 ELSE 0 END) as possessions_with_goal,
          SUM(CASE WHEN p.result = 'turnover' THEN 1 ELSE 0 END) as turnovers
         FROM ball_possessions p
         JOIN teams t ON p.team_id = t.id
         WHERE p.game_id = $1 AND p.ended_at IS NOT NULL
         GROUP BY p.team_id, t.name`,
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
  [
    param('gameId').isInt(),
    param('possessionId').isInt()
  ],
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
