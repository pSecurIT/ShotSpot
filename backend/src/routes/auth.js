import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import Tokens from 'csrf';
import db from '../db.js';

const router = express.Router();
const tokens = new Tokens();

// CSRF token endpoint
router.get('/csrf', (req, res) => {
  if (!req.session.csrfSecret) {
    req.session.csrfSecret = tokens.secretSync();
  }
  const token = tokens.create(req.session.csrfSecret);
  res.json({ csrfToken: token });
});

// Validation middleware
const validateRegistration = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters'),
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
];

// Register new user
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password } = req.body;

    // Check if user already exists
    const userExists = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({
        error: 'User with this username or email already exists'
      });
    }

    // Hash password with bcrypt rounds = 12 (OWASP 2024 recommendation)
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const result = await db.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, passwordHash]
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Error creating user' });
  }
});

// Login user
router.post('/login', [
  body('username').trim().notEmpty(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user by username or email
    const result = await db.query(
      'SELECT id, username, email, password_hash, role, password_must_change FROM users WHERE username = $1 OR email = $1',
      [username]
    );

    if (result.rows.length === 0) {
      // Timing attack protection: still hash to prevent user enumeration
      await bcrypt.hash(password, 12);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_key_min_32_chars_long_for_testing';
    
    // Normalize expiresIn: allow numeric string (seconds) or timeframe string like '1h'
    const rawExpires = process.env.JWT_EXPIRES_IN;
    let expiresIn;
    if (!rawExpires) {
      expiresIn = '1h'; // safe default for tests and CI
    } else if (/^\d+$/.test(rawExpires)) {
      expiresIn = Number(rawExpires); // numeric seconds
    } else {
      expiresIn = rawExpires; // string timespan like '1h', '30m'
    }
    
    // Only include passwordMustChange in JWT if it's true (cleaner tokens)
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role
    };
    
    if (user.password_must_change) {
      tokenPayload.passwordMustChange = true;
    }
    
    const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn });

    res.json({
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        passwordMustChange: user.password_must_change || false
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error during login' });
  }
});

// Change password endpoint (works even if password_must_change is true)
// Note: In production, also apply CSRF protection middleware to this endpoint
router.post('/change-password', [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9])/)
    .withMessage('Password must include one lowercase letter, one uppercase letter, one number, and one special character')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_key_min_32_chars_long_for_testing';

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (_err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get user from database
    const result = await db.query(
      'SELECT id, username, email, password_hash, role, password_must_change FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Check if new password is different from current
    const samePassword = await bcrypt.compare(newPassword, user.password_hash);
    if (samePassword) {
      return res.status(400).json({ error: 'New password cannot be the same as current password' });
    }
    
    // TODO: Consider adding password history check (last 3-5 passwords)
    // to prevent password reuse as per NIST guidelines

    // Hash new password with bcrypt rounds = 12 (OWASP 2024 recommendation)
    const salt = await bcrypt.genSalt(12);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    // Update password and clear password_must_change flag
    await db.query(
      'UPDATE users SET password_hash = $1, password_must_change = false, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, user.id]
    );

    // Generate new token without passwordMustChange flag (only include when true)
    const newToken = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role
      },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    res.json({
      message: 'Password changed successfully',
      token: newToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        passwordMustChange: false
      }
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Error changing password' });
  }
});

export default router;