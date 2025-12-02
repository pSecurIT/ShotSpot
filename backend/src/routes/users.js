import express from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiting: max 100 requests per 15 min per IP
const userRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
});

// Apply rate limiting and authentication middleware to all routes
router.use(userRateLimiter);
router.use(auth);

// Get all users (admin only)
router.get('/', requireRole(['admin']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, username, email, role, is_active, last_login, created_at, updated_at
      FROM users
      WHERE is_active = true
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

// Get login history for a user (admin can view any, users can view their own)
router.get('/:userId/login-history', async (req, res) => {
  const { userId } = req.params;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const offset = parseInt(req.query.offset, 10) || 0;

  try {
    // Check if user is admin or viewing their own history
    if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
      return res.status(403).json({ error: 'Forbidden: Cannot view other users\' login history' });
    }

    const result = await db.query(`
      SELECT id, user_id, username, success, ip_address, user_agent, error_message, created_at
      FROM login_history
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM login_history WHERE user_id = $1',
      [userId]
    );

    res.json({
      history: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    });
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
    .if((value, { req }) => req.user.id === parseInt(req.params.userId, 10))
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
  const userIdNum = parseInt(userId, 10);
  if (isNaN(userIdNum)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  // Only allow users to change their own password unless they're admin
  if (req.user.id !== userIdNum && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized to change other users\' passwords' });
  }

  try {
    // If user is changing their own password, verify current password
    if (req.user.id === userIdNum) {
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

// Create new user (admin only)
router.post('/', [
  requireRole(['admin']),
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9])/)
    .withMessage('Password must include one lowercase letter, one uppercase letter, one number, and one special character'),
  body('role')
    .isIn(['user', 'coach', 'admin'])
    .withMessage('Invalid role')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, password, role } = req.body;

  try {
    // Check if username or email already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ 
        error: 'User with this username or email already exists' 
      });
    }

    // Hash password with bcrypt rounds = 12
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const result = await db.query(`
      INSERT INTO users (username, email, password_hash, role, is_active)
      VALUES ($1, $2, $3, $4, true)
      RETURNING id, username, email, role, is_active, last_login, created_at, updated_at
    `, [username, email, passwordHash, role]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Update user profile (admin or self)
router.patch('/:userId', [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { userId } = req.params;
  const { username, email } = req.body;
  const userIdNum = parseInt(userId, 10);
  if (isNaN(userIdNum)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  // Only allow users to edit their own profile unless they're admin
  if (req.user.id !== userIdNum && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized to edit other users\' profiles' });
  }

  // At least one field must be provided
  if (!username && !email) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  try {
    // Check if user exists
    const userCheck = await db.query(
      'SELECT id FROM users WHERE id = $1 AND is_active = true',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check uniqueness if updating username or email
    if (username || email) {
      const uniquenessCheck = await db.query(
        'SELECT id FROM users WHERE (username = $1 OR email = $2) AND id != $3',
        [username || '', email || '', userId]
      );

      if (uniquenessCheck.rows.length > 0) {
        return res.status(400).json({ 
          error: 'Username or email already taken' 
        });
      }
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (username) {
      updates.push(`username = $${paramCount++}`);
      values.push(username);
    }
    if (email) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    const result = await db.query(`
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, username, email, role, is_active, last_login, created_at, updated_at
    `, values);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Bulk role change (admin only)
router.post('/bulk-role-change', [
  requireRole(['admin']),
  body('userIds')
    .isArray({ min: 1 })
    .withMessage('userIds must be a non-empty array'),
  body('userIds.*')
    .isInt()
    .withMessage('Each userId must be an integer'),
  body('role')
    .isIn(['user', 'coach', 'admin'])
    .withMessage('Invalid role')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { userIds, role } = req.body;

  try {
    // Check if trying to change own role
    if (userIds.includes(req.user.id)) {
      return res.status(403).json({ 
        error: 'Cannot change your own role in bulk operation' 
      });
    }

    // Update roles for all selected users
    const result = await db.query(`
      UPDATE users
      SET role = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($2::int[]) AND is_active = true
      RETURNING id, username, email, role
    `, [role, userIds]);

    res.json({
      message: `Successfully updated ${result.rows.length} user(s)`,
      updated: result.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Delete user (soft delete - admin only)
router.delete('/:userId', requireRole(['admin']), async (req, res) => {
  const { userId } = req.params;

  try {
    // Prevent self-deletion
    if (parseInt(userId) === req.user.id) {
      return res.status(403).json({ 
        error: 'Cannot delete your own account' 
      });
    }

    // Check if user exists and is active
    const userCheck = await db.query(
      'SELECT id, role FROM users WHERE id = $1 AND is_active = true',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userToDelete = userCheck.rows[0];

    // Prevent deleting last admin
    if (userToDelete.role === 'admin') {
      const adminCount = await db.query(
        'SELECT COUNT(*) as count FROM users WHERE role = $1 AND is_active = true',
        ['admin']
      );

      if (parseInt(adminCount.rows[0].count) <= 1) {
        return res.status(403).json({ 
          error: 'Cannot delete the last admin user' 
        });
      }
    }

    // Soft delete: set is_active = false
    await db.query(`
      UPDATE users
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [userId]);

    res.json({ message: 'User deactivated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

export default router;