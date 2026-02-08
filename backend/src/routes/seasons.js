import express from 'express';
import db from '../db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// ============================================================================
// GET ALL SEASONS
// ============================================================================

/**
 * Get all seasons, optionally filtered by active flag
 * Query params: active=true|false
 */
router.get('/', async (req, res) => {
  try {
    const active = typeof req.query.active === 'string' ? req.query.active.toLowerCase() : null;
    const params = [];
    let query = `
      SELECT id, name, start_date, end_date, season_type, is_active, created_at, updated_at
      FROM seasons
    `;

    if (active === 'true' || active === 'false') {
      params.push(active === 'true');
      query += ` WHERE is_active = $${params.length}`;
    }

    query += ' ORDER BY is_active DESC, start_date DESC, name ASC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching seasons:', err);
    res.status(500).json({ error: 'Failed to fetch seasons' });
  }
});

export default router;
