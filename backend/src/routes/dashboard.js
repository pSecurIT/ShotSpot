import express from 'express';
import db from '../db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

/**
 * GET /api/dashboard/summary
 * Quick stats summary for the dashboard landing page.
 */
router.get('/summary', async (_req, res) => {
  try {
    const [teamsResult, playersResult, gamesResult] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS count FROM teams'),
      db.query('SELECT COUNT(*)::int AS count FROM players'),
      db.query('SELECT COUNT(*)::int AS count FROM games')
    ]);

    res.json({
      teams: teamsResult.rows[0]?.count ?? 0,
      players: playersResult.rows[0]?.count ?? 0,
      games: gamesResult.rows[0]?.count ?? 0
    });
  } catch (err) {
    console.error('Error fetching dashboard summary:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

export default router;
