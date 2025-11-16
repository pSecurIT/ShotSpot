#!/usr/bin/env node

/**
 * Initialize default admin user on first startup
 * - Creates admin user if no admin exists in the database
 * - Uses environment variables for credentials
 * - Auto-generates secure password if not provided
 * - Forces password change on first login
 * - Idempotent: safe to run multiple times
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import db from '../src/db.js';

// Password validation regex (matches auth.js validation)
const PASSWORD_REGEX = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/;

/**
 * Generate cryptographically secure random password
 * Ensures it meets all validation requirements
 */
function generateSecurePassword() {
  const length = 16;
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  // Ensure at least one of each required character type
  let password = '';
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];
  password += special[crypto.randomInt(special.length)];
  
  // Fill rest with random characters from all sets
  const allChars = lowercase + uppercase + numbers + special;
  for (let i = password.length; i < length; i++) {
    password += allChars[crypto.randomInt(allChars.length)];
  }
  
  // Shuffle password to avoid predictable pattern using Fisher-Yates algorithm
  const chars = password.split('');
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * Validate password meets security requirements
 */
function validatePassword(password) {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  
  if (!PASSWORD_REGEX.test(password)) {
    return {
      valid: false,
      error: 'Password must include uppercase, lowercase, number, and special character'
    };
  }
  
  return { valid: true };
}

/**
 * Initialize default admin user
 */
async function initDefaultAdmin() {
  const pool = db.getPool ? db.getPool() : db;
  
  try {
    // Check if any admin user exists
    const adminCheck = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE role = \'admin\''
    );
    
    const adminCount = parseInt(adminCheck.rows[0].count);
    
    if (adminCount > 0) {
      console.log('ℹ️  Admin user(s) already exist, skipping default admin creation');
      return { created: false, reason: 'admin_exists' };
    }
    
    // Get credentials from environment and sanitize inputs
    const username = (process.env.DEFAULT_ADMIN_USERNAME || 'admin').trim().substring(0, 50);
    let email = (process.env.DEFAULT_ADMIN_EMAIL || 'admin@shotspot.local').trim().toLowerCase();
    
    // Truncate email if needed, but preserve domain
    if (email.length > 255) {
      const atIndex = email.indexOf('@');
      if (atIndex > 0) {
        const localPart = email.substring(0, atIndex);
        const domain = email.substring(atIndex);
        const maxLocalLength = 255 - domain.length;
        email = localPart.substring(0, maxLocalLength) + domain;
      } else {
        email = email.substring(0, 255);
      }
    }
    let password = process.env.DEFAULT_ADMIN_PASSWORD;
    
    // Validate username format (alphanumeric, underscore, hyphen only)
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      console.error('❌ DEFAULT_ADMIN_USERNAME contains invalid characters');
      console.error('   Allowed: letters, numbers, underscore, hyphen');
      throw new Error('Invalid username format');
    }
    
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.error('❌ DEFAULT_ADMIN_EMAIL is not a valid email address');
      throw new Error('Invalid email format');
    }
    
    // Generate secure password if not provided
    let passwordGenerated = false;
    if (!password || password.trim() === '') {
      password = generateSecurePassword();
      passwordGenerated = true;
      console.log('🔐 No DEFAULT_ADMIN_PASSWORD provided, generated secure password');
    } else {
      // Validate provided password
      const validation = validatePassword(password);
      if (!validation.valid) {
        console.error('❌ DEFAULT_ADMIN_PASSWORD does not meet security requirements:', validation.error);
        console.error('💡 Generating secure password instead...');
        password = generateSecurePassword();
        passwordGenerated = true;
      }
    }
    
    // Check if username or email already exists (edge case)
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (existingUser.rows.length > 0) {
      console.log('⚠️  User with username or email already exists, skipping admin creation');
      return { created: false, reason: 'user_exists' };
    }
    
    // Hash password with bcrypt rounds = 12 (OWASP 2024 recommendation)
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Create admin user with password_must_change flag
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, role, password_must_change) 
       VALUES ($1, $2, $3, 'admin', true) 
       RETURNING id, username, email, role`,
      [username, email, passwordHash]
    );
    
    const admin = result.rows[0];
    
    // Log success with credentials (ONLY shown once)
    console.log('\n' + '='.repeat(80));
    console.log('🎉 DEFAULT ADMIN USER CREATED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log('');
    console.log('📋 Admin Credentials:');
    console.log(`   Username: ${admin.username}`);
    console.log(`   Email:    ${admin.email}`);
    console.log(`   Password: ${password}`);
    console.log('');
    console.log('⚠️  IMPORTANT SECURITY NOTES:');
    console.log('   1. This password will NOT be shown again');
    console.log('   2. You MUST change this password on first login');
    console.log('   3. Most API operations are blocked until password is changed');
    console.log('   4. Save these credentials in a secure location NOW');
    console.log('');
    
    if (passwordGenerated) {
      console.log('🔒 Password was auto-generated for security');
      console.log('   Set DEFAULT_ADMIN_PASSWORD in .env to use custom password');
      console.log('');
    }
    
    console.log('📝 Next Steps:');
    console.log('   1. Login with these credentials');
    console.log('   2. Change password immediately via /api/auth/change-password');
    console.log('   3. Remove DEFAULT_ADMIN_PASSWORD from environment after first login');
    console.log('');
    console.log('='.repeat(80) + '\n');
    
    return { 
      created: true, 
      admin: { id: admin.id, username: admin.username, email: admin.email },
      passwordGenerated 
    };
    
  } catch (error) {
    console.error('❌ Error creating default admin user:', error.message);
    
    // Check if it's a schema issue
    if (error.message.includes('column "password_must_change" does not exist')) {
      console.error('💡 Run migrations first: the password_must_change column is missing');
      console.error('   Migration file: add_password_must_change.sql');
    }
    
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initDefaultAdmin()
    .then((result) => {
      if (result.created) {
        console.log('✅ Default admin initialization complete');
        process.exit(0);
      } else {
        console.log(`ℹ️  Admin creation skipped: ${result.reason}`);
        process.exit(0);
      }
    })
    .catch((error) => {
      console.error('❌ Failed to initialize default admin:', error);
      process.exit(1);
    });
}

export default initDefaultAdmin;
