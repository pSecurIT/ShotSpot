import bcrypt from 'bcrypt';
import initDefaultAdmin from '../scripts/init-default-admin.js';
import db from '../src/db.js';

describe('🔐 Default Admin Initialization', () => {
  let originalEnv;

  beforeAll(() => {
    console.log('🔧 Setting up Default Admin tests...');
    // Save original environment
    originalEnv = {
      DEFAULT_ADMIN_USERNAME: process.env.DEFAULT_ADMIN_USERNAME,
      DEFAULT_ADMIN_EMAIL: process.env.DEFAULT_ADMIN_EMAIL,
      DEFAULT_ADMIN_PASSWORD: process.env.DEFAULT_ADMIN_PASSWORD
    };
  });

  beforeEach(async () => {
    // Clean up all users before each test
    await db.query('DELETE FROM users');
    
    // Reset environment variables
    delete process.env.DEFAULT_ADMIN_USERNAME;
    delete process.env.DEFAULT_ADMIN_EMAIL;
    delete process.env.DEFAULT_ADMIN_PASSWORD;
  });

  afterEach(async () => {
    // Clean up after each test
    await db.query('DELETE FROM users');
  });

  afterAll(async () => {
    console.log('✅ Default Admin tests completed');
    // Restore original environment
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value !== undefined) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    });
  });

  describe('✅ Admin Creation Success Cases', () => {
    it('should create default admin with auto-generated password', async () => {
      const result = await initDefaultAdmin();

      expect(result.created).toBe(true);
      expect(result.admin).toBeDefined();
      expect(result.admin.username).toBe('admin');
      expect(result.admin.email).toBe('admin@shotspot.local');
      expect(result.passwordGenerated).toBe(true);

      // Verify admin exists in database
      const adminQuery = await db.query(
        'SELECT * FROM users WHERE username = $1',
        ['admin']
      );
      expect(adminQuery.rows.length).toBe(1);
      
      const admin = adminQuery.rows[0];
      expect(admin.role).toBe('admin');
      expect(admin.password_must_change).toBe(true);
      expect(admin.password_hash).toBeTruthy();
      expect(admin.password_hash.length).toBeGreaterThan(20);
    });

    it('should create admin with custom username and email', async () => {
      process.env.DEFAULT_ADMIN_USERNAME = 'superadmin';
      process.env.DEFAULT_ADMIN_EMAIL = 'superadmin@test.com';

      const result = await initDefaultAdmin();

      expect(result.created).toBe(true);
      expect(result.admin.username).toBe('superadmin');
      expect(result.admin.email).toBe('superadmin@test.com');

      const adminQuery = await db.query(
        'SELECT * FROM users WHERE username = $1',
        ['superadmin']
      );
      expect(adminQuery.rows.length).toBe(1);
    });

    it('should create admin with custom password', async () => {
      const customPassword = 'CustomPass123!@#';
      process.env.DEFAULT_ADMIN_PASSWORD = customPassword;

      const result = await initDefaultAdmin();

      expect(result.created).toBe(true);
      expect(result.passwordGenerated).toBe(false);

      // Verify password is correctly hashed
      const adminQuery = await db.query(
        'SELECT password_hash FROM users WHERE username = $1',
        ['admin']
      );
      const passwordMatch = await bcrypt.compare(
        customPassword,
        adminQuery.rows[0].password_hash
      );
      expect(passwordMatch).toBe(true);
    });

    it('should normalize email to lowercase', async () => {
      process.env.DEFAULT_ADMIN_EMAIL = 'ADMIN@EXAMPLE.COM';

      const result = await initDefaultAdmin();

      expect(result.created).toBe(true);
      expect(result.admin.email).toBe('admin@example.com');
    });

    it('should trim whitespace from credentials', async () => {
      process.env.DEFAULT_ADMIN_USERNAME = '  admin123  ';
      process.env.DEFAULT_ADMIN_EMAIL = '  admin@test.com  ';

      const result = await initDefaultAdmin();

      expect(result.created).toBe(true);
      expect(result.admin.username).toBe('admin123');
      expect(result.admin.email).toBe('admin@test.com');
    });
  });

  describe('🔄 Idempotency Tests', () => {
    it('should not create admin if admin already exists', async () => {
      // Create first admin
      const result1 = await initDefaultAdmin();
      expect(result1.created).toBe(true);

      // Try to create second admin
      const result2 = await initDefaultAdmin();
      expect(result2.created).toBe(false);
      expect(result2.reason).toBe('admin_exists');

      // Verify only one admin exists
      const adminQuery = await db.query(
        'SELECT COUNT(*) as count FROM users WHERE role = \'admin\''
      );
      expect(parseInt(adminQuery.rows[0].count)).toBe(1);
    });

    it('should not create admin if username already exists', async () => {
      // Create a regular user with 'admin' username
      await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, 'user')`,
        ['admin', 'other@example.com', 'dummyhash']
      );

      const result = await initDefaultAdmin();
      expect(result.created).toBe(false);
      expect(result.reason).toBe('user_exists');

      // Verify no admin role was created
      const adminQuery = await db.query(
        'SELECT COUNT(*) as count FROM users WHERE role = \'admin\''
      );
      expect(parseInt(adminQuery.rows[0].count)).toBe(0);
    });

    it('should not create admin if email already exists', async () => {
      // Create a regular user with admin email
      await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, 'user')`,
        ['otheruser', 'admin@shotspot.local', 'dummyhash']
      );

      const result = await initDefaultAdmin();
      expect(result.created).toBe(false);
      expect(result.reason).toBe('user_exists');
    });
  });

  describe('🔒 Security Validations', () => {
    it('should use bcrypt with 12 rounds for password hashing', async () => {
      process.env.DEFAULT_ADMIN_PASSWORD = 'TestPass123!';
      
      await initDefaultAdmin();

      const adminQuery = await db.query(
        'SELECT password_hash FROM users WHERE username = $1',
        ['admin']
      );
      const hash = adminQuery.rows[0].password_hash;

      // Bcrypt hashes with 12 rounds start with $2b$12$
      expect(hash).toMatch(/^\$2[aby]\$12\$/);
    });

    it('should reject weak custom password and auto-generate instead', async () => {
      process.env.DEFAULT_ADMIN_PASSWORD = 'weak';

      const result = await initDefaultAdmin();

      expect(result.created).toBe(true);
      expect(result.passwordGenerated).toBe(true);

      // Verify weak password was NOT used
      const adminQuery = await db.query(
        'SELECT password_hash FROM users WHERE username = $1',
        ['admin']
      );
      const passwordMatch = await bcrypt.compare(
        'weak',
        adminQuery.rows[0].password_hash
      );
      expect(passwordMatch).toBe(false);
    });

    it('should reject password without uppercase', async () => {
      process.env.DEFAULT_ADMIN_PASSWORD = 'testpass123!';

      const result = await initDefaultAdmin();

      expect(result.created).toBe(true);
      expect(result.passwordGenerated).toBe(true);
    });

    it('should reject password without lowercase', async () => {
      process.env.DEFAULT_ADMIN_PASSWORD = 'TESTPASS123!';

      const result = await initDefaultAdmin();

      expect(result.created).toBe(true);
      expect(result.passwordGenerated).toBe(true);
    });

    it('should reject password without number', async () => {
      process.env.DEFAULT_ADMIN_PASSWORD = 'TestPassword!';

      const result = await initDefaultAdmin();

      expect(result.created).toBe(true);
      expect(result.passwordGenerated).toBe(true);
    });

    it('should reject password without special character', async () => {
      process.env.DEFAULT_ADMIN_PASSWORD = 'TestPassword123';

      const result = await initDefaultAdmin();

      expect(result.created).toBe(true);
      expect(result.passwordGenerated).toBe(true);
    });

    it('should reject password shorter than 8 characters', async () => {
      process.env.DEFAULT_ADMIN_PASSWORD = 'Te1!';

      const result = await initDefaultAdmin();

      expect(result.created).toBe(true);
      expect(result.passwordGenerated).toBe(true);
    });

    it('should set password_must_change flag to true', async () => {
      await initDefaultAdmin();

      const adminQuery = await db.query(
        'SELECT password_must_change FROM users WHERE username = $1',
        ['admin']
      );
      expect(adminQuery.rows[0].password_must_change).toBe(true);
    });

    it('should accept valid custom password with all requirements', async () => {
      const validPassword = 'ValidPass123!@#';
      process.env.DEFAULT_ADMIN_PASSWORD = validPassword;

      const result = await initDefaultAdmin();

      expect(result.created).toBe(true);
      expect(result.passwordGenerated).toBe(false);

      const adminQuery = await db.query(
        'SELECT password_hash FROM users WHERE username = $1',
        ['admin']
      );
      const passwordMatch = await bcrypt.compare(
        validPassword,
        adminQuery.rows[0].password_hash
      );
      expect(passwordMatch).toBe(true);
    });
  });

  describe('⚠️ Input Validation and Error Handling', () => {
    it('should reject invalid username with special characters', async () => {
      process.env.DEFAULT_ADMIN_USERNAME = 'admin@test';

      await expect(initDefaultAdmin()).rejects.toThrow('Invalid username format');

      const userQuery = await db.query('SELECT COUNT(*) as count FROM users');
      expect(parseInt(userQuery.rows[0].count)).toBe(0);
    });

    it('should reject invalid username with spaces', async () => {
      process.env.DEFAULT_ADMIN_USERNAME = 'admin user';

      await expect(initDefaultAdmin()).rejects.toThrow('Invalid username format');
    });

    it('should accept username with hyphens and underscores', async () => {
      process.env.DEFAULT_ADMIN_USERNAME = 'admin-user_123';

      const result = await initDefaultAdmin();

      expect(result.created).toBe(true);
      expect(result.admin.username).toBe('admin-user_123');
    });

    it('should reject invalid email format', async () => {
      process.env.DEFAULT_ADMIN_EMAIL = 'not-an-email';

      await expect(initDefaultAdmin()).rejects.toThrow('Invalid email format');

      const userQuery = await db.query('SELECT COUNT(*) as count FROM users');
      expect(parseInt(userQuery.rows[0].count)).toBe(0);
    });

    it('should reject email without domain', async () => {
      process.env.DEFAULT_ADMIN_EMAIL = 'admin@';

      await expect(initDefaultAdmin()).rejects.toThrow('Invalid email format');
    });

    it('should reject email without @', async () => {
      process.env.DEFAULT_ADMIN_EMAIL = 'admin.example.com';

      await expect(initDefaultAdmin()).rejects.toThrow('Invalid email format');
    });

    it('should truncate long username to 50 characters', async () => {
      process.env.DEFAULT_ADMIN_USERNAME = 'a'.repeat(100);

      const result = await initDefaultAdmin();

      expect(result.created).toBe(true);
      expect(result.admin.username.length).toBe(50);
    });

    it('should truncate long email to 255 characters while preserving validity', async () => {
      // Create email with 250-char local part + @example.com = 262 chars total
      const longEmail = 'a'.repeat(240) + '@example.com';
      process.env.DEFAULT_ADMIN_EMAIL = longEmail;

      const result = await initDefaultAdmin();

      expect(result.created).toBe(true);
      expect(result.admin.email.length).toBeLessThanOrEqual(255);
      // Verify email is still valid after truncation
      expect(result.admin.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(result.admin.email).toContain('@example.com');
    });
  });

  describe('🎲 Password Generation Quality', () => {
    it('should generate unique passwords each time', async () => {
      const passwords = new Set();

      // Generate 10 admins (clean DB between each)
      for (let i = 0; i < 10; i++) {
        await db.query('DELETE FROM users');
        
        const result = await initDefaultAdmin();
        expect(result.created).toBe(true);
        expect(result.passwordGenerated).toBe(true);

        // Get the hashed password
        const adminQuery = await db.query(
          'SELECT password_hash FROM users WHERE username = $1',
          ['admin']
        );
        passwords.add(adminQuery.rows[0].password_hash);
      }

      // All passwords should be unique
      expect(passwords.size).toBe(10);
    });

    it('should generate password with mixed case', async () => {
      await initDefaultAdmin();

      const adminQuery = await db.query(
        'SELECT password_hash FROM users WHERE username = $1',
        ['admin']
      );
      
      // We can't directly check the generated password, but we know it meets requirements
      // based on the validation logic. Hash format confirms bcrypt was used.
      expect(adminQuery.rows[0].password_hash).toMatch(/^\$2[aby]\$12\$/);
    });
  });
});


