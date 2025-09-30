import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// Get all users (admin only)
router.get('/', requireRole(['admin']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, username, email, role, created_at, updated_at
      FROM users
      ORDER BY username
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Get current user's details
router.get('/me', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, username, email, role, created_at, updated_at
      FROM users
      WHERE id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Update user role (admin only)
router.put('/:userId/role', [
  requireRole(['admin']),
  body('role')
    .isIn(['user', 'coach', 'admin'])
    .withMessage('Invalid role')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { userId } = req.params;
  const { role } = req.body;

  try {
    // Check if user exists
    const userCheck = await db.query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent self-demotion for admin
    if (parseInt(userId) === req.user.id && req.user.role === 'admin' && role !== 'admin') {
      return res.status(403).json({ 
        error: 'Cannot remove admin role from yourself' 
      });
    }

    const result = await db.query(`
      UPDATE users
      SET role = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, username, email, role, created_at, updated_at
    `, [role, userId]);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Update user password (self or admin)
router.put('/:userId/password', [
  body('currentPassword')
    .if((value, { req }) => req.user.id === parseInt(req.params.userId))
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { userId } = req.params;
  const { currentPassword, newPassword } = req.body;

  // Only allow users to change their own password unless they're admin
  if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized to change other users\' passwords' });
  }

  try {
    // If user is changing their own password, verify current password
    if (req.user.id === parseInt(userId)) {
      const user = await db.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId]
      );

      const isValid = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
      if (!isValid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query(`
      UPDATE users
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [hashedPassword, userId]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

export default router;