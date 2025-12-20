/**
 * Series Routes
 * Belgian korfball division levels (Eerste Klasse, Tweede Klasse, etc.)
 * Used for league hierarchy and promotion/relegation tracking
 */

import express from 'express';
import { param, body, validationResult } from 'express-validator';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// ============================================================================
// GET ALL SERIES
// ============================================================================

/**
 * Get all series (divisions), ordered by level
 */
router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        s.*,
        COUNT(c.id) as competition_count
      FROM series s
      LEFT JOIN competitions c ON c.series_id = s.id
      GROUP BY s.id
      ORDER BY s.level ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching series:', err);
    res.status(500).json({ error: 'Failed to fetch series' });
  }
});

// ============================================================================
// GET SINGLE SERIES
// ============================================================================

/**
 * Get a single series by ID with competitions
 */
router.get('/:id', [
  auth,
  param('id').isInt({ min: 1 }).withMessage('Series ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;

  try {
    // Get series details
    const seriesResult = await db.query('SELECT * FROM series WHERE id = $1', [id]);
    
    if (seriesResult.rows.length === 0) {
      return res.status(404).json({ error: 'Series not found' });
    }

    // Get competitions in this series
    const competitionsResult = await db.query(`
      SELECT 
        c.*,
        s.name as season_name,
        COUNT(DISTINCT ct.team_id) as team_count
      FROM competitions c
      LEFT JOIN seasons s ON c.season_id = s.id
      LEFT JOIN competition_teams ct ON ct.competition_id = c.id
      WHERE c.series_id = $1
      GROUP BY c.id, s.name
      ORDER BY c.start_date DESC
    `, [id]);

    res.json({
      ...seriesResult.rows[0],
      competitions: competitionsResult.rows
    });
  } catch (err) {
    console.error('Error fetching series:', err);
    res.status(500).json({ error: 'Failed to fetch series' });
  }
});

// ============================================================================
// CREATE SERIES
// ============================================================================

/**
 * Create a new series (division)
 * Requires admin role
 */
router.post('/', [
  requireRole(['admin']),
  body('name')
    .trim()
    .notEmpty().withMessage('Series name is required')
    .isLength({ max: 255 }).withMessage('Series name must be 255 characters or less'),
  body('level')
    .isInt({ min: 1 }).withMessage('Level must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { name, level } = req.body;

  try {
    // Check if level already exists
    const levelCheck = await db.query('SELECT id FROM series WHERE level = $1', [level]);
    if (levelCheck.rows.length > 0) {
      return res.status(409).json({ error: 'A series with this level already exists' });
    }

    const result = await db.query(
      'INSERT INTO series (name, level) VALUES ($1, $2) RETURNING *',
      [name, level]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating series:', err);
    res.status(500).json({ error: 'Failed to create series' });
  }
});

// ============================================================================
// UPDATE SERIES
// ============================================================================

/**
 * Update a series
 * Requires admin role
 */
router.put('/:id', [
  requireRole(['admin']),
  param('id').isInt({ min: 1 }).withMessage('Series ID must be a positive integer'),
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Series name cannot be empty')
    .isLength({ max: 255 }).withMessage('Series name must be 255 characters or less'),
  body('level')
    .optional()
    .isInt({ min: 1 }).withMessage('Level must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;
  const { name, level } = req.body;

  try {
    // Check if series exists
    const seriesCheck = await db.query('SELECT id FROM series WHERE id = $1', [id]);
    if (seriesCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Series not found' });
    }

    // If updating level, check for conflicts
    if (level) {
      const levelCheck = await db.query('SELECT id FROM series WHERE level = $1 AND id != $2', [level, id]);
      if (levelCheck.rows.length > 0) {
        return res.status(409).json({ error: 'A series with this level already exists' });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }

    if (level !== undefined) {
      updates.push(`level = $${paramIndex}`);
      values.push(level);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const result = await db.query(
      `UPDATE series SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating series:', err);
    res.status(500).json({ error: 'Failed to update series' });
  }
});

// ============================================================================
// DELETE SERIES
// ============================================================================

/**
 * Delete a series
 * Requires admin role
 * Cannot delete if competitions exist in this series
 */
router.delete('/:id', [
  requireRole(['admin']),
  param('id').isInt({ min: 1 }).withMessage('Series ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;

  try {
    // Check if series exists
    const seriesCheck = await db.query('SELECT id FROM series WHERE id = $1', [id]);
    if (seriesCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Series not found' });
    }

    // Check if any competitions use this series
    const competitionsCheck = await db.query(
      'SELECT COUNT(*) as count FROM competitions WHERE series_id = $1',
      [id]
    );

    if (parseInt(competitionsCheck.rows[0].count) > 0) {
      return res.status(409).json({ 
        error: 'Cannot delete series with existing competitions. Remove competitions first or unlink them from this series.' 
      });
    }

    await db.query('DELETE FROM series WHERE id = $1', [id]);
    res.json({ message: 'Series deleted successfully' });
  } catch (err) {
    console.error('Error deleting series:', err);
    res.status(500).json({ error: 'Failed to delete series' });
  }
});

export default router;
