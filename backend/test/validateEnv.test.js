/**
 * @fileoverview Comprehensive tests for environment variable validation utility
 * Tests all validation logic, security requirements, and edge cases
 * Target coverage: 90%+ (security-critical module)
 */

import validateEnvVars from '../src/utils/validateEnv.js';

describe('🔐 Environment Variable Validation', () => {
  let originalEnv;
  let originalConsoleLog;
  let originalConsoleError;
  let originalProcessExit;
  let mockExit;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Backup original environment and console methods
    originalEnv = { ...process.env };
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalProcessExit = process.exit;

    // Create spies
    consoleLogSpy = jest.fn();
    consoleErrorSpy = jest.fn();
    mockExit = jest.fn();

    // Mock console and process.exit
    console.log = consoleLogSpy;
    console.error = consoleErrorSpy;
    process.exit = mockExit;

    // Clear environment variables
    const requiredVars = [
      'PORT', 'DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT', 'DB_NAME',
      'DB_MAX_CONNECTIONS', 'DB_IDLE_TIMEOUT_MS', 'JWT_SECRET', 'JWT_EXPIRES_IN',
      'CORS_ORIGIN', 'RATE_LIMIT_WINDOW_MS', 'RATE_LIMIT_MAX'
    ];
    requiredVars.forEach(varName => {
      delete process.env[varName];
    });
  });

  afterEach(() => {
    // Restore original environment and console methods
    process.env = originalEnv;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });

  describe('✅ Successful Validation', () => {
    it('✅ should pass with all valid environment variables', () => {
      // Set all required environment variables with valid values
      process.env.PORT = '3001';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'secure_password_123456';
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_NAME = 'test_db';
      process.env.DB_MAX_CONNECTIONS = '10';
      process.env.DB_IDLE_TIMEOUT_MS = '30000';
      process.env.JWT_SECRET = 'a_very_long_and_secure_jwt_secret_key_123456789';
      process.env.JWT_EXPIRES_IN = '1h';
      process.env.CORS_ORIGIN = 'http://localhost:3000';
      process.env.RATE_LIMIT_WINDOW_MS = '900000';
      process.env.RATE_LIMIT_MAX = '100';

      const result = validateEnvVars();

      expect(result).toBe(true);
      expect(mockExit).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('Environment validation passed successfully!');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('✅ should pass with HTTPS CORS origin', () => {
      // Set all required variables with HTTPS CORS origin
      process.env.PORT = '3001';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'secure_password_123456';
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_NAME = 'test_db';
      process.env.DB_MAX_CONNECTIONS = '10';
      process.env.DB_IDLE_TIMEOUT_MS = '30000';
      process.env.JWT_SECRET = 'a_very_long_and_secure_jwt_secret_key_123456789';
      process.env.JWT_EXPIRES_IN = '1h';
      process.env.CORS_ORIGIN = 'https://shotspot-app.com';
      process.env.RATE_LIMIT_WINDOW_MS = '900000';
      process.env.RATE_LIMIT_MAX = '100';

      const result = validateEnvVars();

      expect(result).toBe(true);
      expect(mockExit).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('Environment validation passed successfully!');
    });

    it('✅ should log database configuration for debugging', () => {
      // Set all required variables
      process.env.PORT = '3001';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'secure_password_123456';
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_NAME = 'test_db';
      process.env.DB_MAX_CONNECTIONS = '10';
      process.env.DB_IDLE_TIMEOUT_MS = '30000';
      process.env.JWT_SECRET = 'a_very_long_and_secure_jwt_secret_key_123456789';
      process.env.JWT_EXPIRES_IN = '1h';
      process.env.CORS_ORIGIN = 'http://localhost:3000';
      process.env.RATE_LIMIT_WINDOW_MS = '900000';
      process.env.RATE_LIMIT_MAX = '100';

      validateEnvVars();

      expect(consoleLogSpy).toHaveBeenCalledWith('Database configuration validation:', {
        DB_USER: 'test_user',
        DB_HOST: 'localhost',
        DB_NAME: 'test_db',
        DB_PORT: '5432',
        hasPassword: true,
        passwordType: 'string'
      });
    });
  });

  describe('❌ Missing Environment Variables', () => {
    it('❌ should fail when all environment variables are missing', () => {
      validateEnvVars();

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Missing required environment variables:');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('PORT'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('DB_USER'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('JWT_SECRET'));
    });

    it('❌ should fail when only PORT is missing', () => {
      // Set all variables except PORT
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'secure_password_123456';
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_NAME = 'test_db';
      process.env.DB_MAX_CONNECTIONS = '10';
      process.env.DB_IDLE_TIMEOUT_MS = '30000';
      process.env.JWT_SECRET = 'a_very_long_and_secure_jwt_secret_key_123456789';
      process.env.JWT_EXPIRES_IN = '1h';
      process.env.CORS_ORIGIN = 'http://localhost:3000';
      process.env.RATE_LIMIT_WINDOW_MS = '900000';
      process.env.RATE_LIMIT_MAX = '100';

      validateEnvVars();

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Missing required environment variables:');
      expect(consoleErrorSpy).toHaveBeenCalledWith('PORT');
    });

    it('❌ should fail when database variables are missing', () => {
      // Set only non-database variables
      process.env.PORT = '3001';
      process.env.JWT_SECRET = 'a_very_long_and_secure_jwt_secret_key_123456789';
      process.env.JWT_EXPIRES_IN = '1h';
      process.env.CORS_ORIGIN = 'http://localhost:3000';
      process.env.RATE_LIMIT_WINDOW_MS = '900000';
      process.env.RATE_LIMIT_MAX = '100';

      validateEnvVars();

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Missing required environment variables:');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('DB_USER'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('DB_PASSWORD'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('DB_HOST'));
    });

    it('❌ should fail when JWT variables are missing', () => {
      // Set all variables except JWT_SECRET and JWT_EXPIRES_IN
      process.env.PORT = '3001';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'secure_password_123456';
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_NAME = 'test_db';
      process.env.DB_MAX_CONNECTIONS = '10';
      process.env.DB_IDLE_TIMEOUT_MS = '30000';
      process.env.CORS_ORIGIN = 'http://localhost:3000';
      process.env.RATE_LIMIT_WINDOW_MS = '900000';
      process.env.RATE_LIMIT_MAX = '100';

      validateEnvVars();

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Missing required environment variables:');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('JWT_SECRET'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('JWT_EXPIRES_IN'));
    });
  });

  describe('🔒 Security Validation', () => {
    beforeEach(() => {
      // Set all required variables with secure defaults
      process.env.PORT = '3001';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'secure_password_123456';
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_NAME = 'test_db';
      process.env.DB_MAX_CONNECTIONS = '10';
      process.env.DB_IDLE_TIMEOUT_MS = '30000';
      process.env.JWT_SECRET = 'a_very_long_and_secure_jwt_secret_key_123456789';
      process.env.JWT_EXPIRES_IN = '1h';
      process.env.CORS_ORIGIN = 'http://localhost:3000';
      process.env.RATE_LIMIT_WINDOW_MS = '900000';
      process.env.RATE_LIMIT_MAX = '100';
    });

    it('❌ should reject JWT_SECRET that is too short', () => {
      process.env.JWT_SECRET = 'short_secret';

      validateEnvVars();

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Insecure environment variable configurations:');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('JWT_SECRET (too short, minimum 32 characters)'));
    });

    it('❌ should reject DB_PASSWORD that is too short', () => {
      process.env.DB_PASSWORD = 'short';

      validateEnvVars();

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Insecure environment variable configurations:');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('DB_PASSWORD (too short, minimum 12 characters)'));
    });

    it('❌ should reject invalid CORS_ORIGIN format', () => {
      process.env.CORS_ORIGIN = 'invalid-url-format';

      validateEnvVars();

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Insecure environment variable configurations:');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('CORS_ORIGIN (must be a valid URL starting with http:// or https://)'));
    });

    it('❌ should reject multiple security issues at once', () => {
      process.env.JWT_SECRET = 'short';
      process.env.DB_PASSWORD = 'weak';
      process.env.CORS_ORIGIN = 'bad-format';

      validateEnvVars();

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Insecure environment variable configurations:');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('JWT_SECRET (too short'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('DB_PASSWORD (too short'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('CORS_ORIGIN (must be a valid URL'));
    });
  });

  describe('🔧 Numeric Value Validation', () => {
    beforeEach(() => {
      // Set all required variables with valid defaults
      process.env.PORT = '3001';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'secure_password_123456';
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_NAME = 'test_db';
      process.env.DB_MAX_CONNECTIONS = '10';
      process.env.DB_IDLE_TIMEOUT_MS = '30000';
      process.env.JWT_SECRET = 'a_very_long_and_secure_jwt_secret_key_123456789';
      process.env.JWT_EXPIRES_IN = '1h';
      process.env.CORS_ORIGIN = 'http://localhost:3000';
      process.env.RATE_LIMIT_WINDOW_MS = '900000';
      process.env.RATE_LIMIT_MAX = '100';
    });

    it('❌ should reject non-numeric PORT value', () => {
      process.env.PORT = 'not-a-number';

      validateEnvVars();

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Insecure environment variable configurations:');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('PORT (must be a number)'));
    });

    it('❌ should reject non-numeric DB_PORT value', () => {
      process.env.DB_PORT = 'invalid-port';

      validateEnvVars();

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Insecure environment variable configurations:');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('DB_PORT (must be a number)'));
    });

    it('❌ should reject non-numeric DB_MAX_CONNECTIONS value', () => {
      process.env.DB_MAX_CONNECTIONS = 'unlimited';

      validateEnvVars();

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Insecure environment variable configurations:');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('DB_MAX_CONNECTIONS (must be a number)'));
    });

    it('❌ should reject non-numeric RATE_LIMIT_MAX value', () => {
      process.env.RATE_LIMIT_MAX = 'no-limit';

      validateEnvVars();

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Insecure environment variable configurations:');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('RATE_LIMIT_MAX (must be a number)'));
    });

    it('❌ should reject multiple non-numeric values', () => {
      process.env.PORT = 'abc';
      process.env.DB_PORT = 'xyz';
      process.env.RATE_LIMIT_MAX = 'none';

      validateEnvVars();

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Insecure environment variable configurations:');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('PORT (must be a number)'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('DB_PORT (must be a number)'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('RATE_LIMIT_MAX (must be a number)'));
    });

    it('✅ should accept valid numeric strings', () => {
      process.env.PORT = '8080';
      process.env.DB_PORT = '5432';
      process.env.DB_MAX_CONNECTIONS = '20';
      process.env.DB_IDLE_TIMEOUT_MS = '60000';
      process.env.RATE_LIMIT_MAX = '200';

      const result = validateEnvVars();

      expect(result).toBe(true);
      expect(mockExit).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('🔧 Edge Cases and Special Scenarios', () => {
    it('🔧 should handle empty string environment variables as missing', () => {
      // Set some variables to empty strings
      process.env.PORT = '';
      process.env.JWT_SECRET = '';
      process.env.DB_PASSWORD = '';
      process.env.CORS_ORIGIN = '';

      validateEnvVars();

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Missing required environment variables:');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('PORT'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('JWT_SECRET'));
    });

    it('🔧 should handle DB_PASSWORD type validation', () => {
      // Set all required variables with valid values
      process.env.PORT = '3001';
      process.env.DB_USER = 'test_user';
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_NAME = 'test_db';
      process.env.DB_MAX_CONNECTIONS = '10';
      process.env.DB_IDLE_TIMEOUT_MS = '30000';
      process.env.JWT_SECRET = 'a_very_long_and_secure_jwt_secret_key_123456789';
      process.env.JWT_EXPIRES_IN = '1h';
      process.env.CORS_ORIGIN = 'http://localhost:3000';
      process.env.RATE_LIMIT_WINDOW_MS = '900000';
      process.env.RATE_LIMIT_MAX = '100';
      
      // Set DB_PASSWORD but as missing
      delete process.env.DB_PASSWORD;

      validateEnvVars();

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Missing required environment variables:');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('DB_PASSWORD'));
    });

    it('🔧 should validate exactly 32 character JWT_SECRET as secure', () => {
      // Set all required variables
      process.env.PORT = '3001';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'secure_password_123456';
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_NAME = 'test_db';
      process.env.DB_MAX_CONNECTIONS = '10';
      process.env.DB_IDLE_TIMEOUT_MS = '30000';
      process.env.JWT_SECRET = '12345678901234567890123456789012'; // Exactly 32 characters
      process.env.JWT_EXPIRES_IN = '1h';
      process.env.CORS_ORIGIN = 'http://localhost:3000';
      process.env.RATE_LIMIT_WINDOW_MS = '900000';
      process.env.RATE_LIMIT_MAX = '100';

      const result = validateEnvVars();

      expect(result).toBe(true);
      expect(mockExit).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('🔧 should validate exactly 12 character DB_PASSWORD as secure', () => {
      // Set all required variables
      process.env.PORT = '3001';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = '123456789012'; // Exactly 12 characters
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_NAME = 'test_db';
      process.env.DB_MAX_CONNECTIONS = '10';
      process.env.DB_IDLE_TIMEOUT_MS = '30000';
      process.env.JWT_SECRET = 'a_very_long_and_secure_jwt_secret_key_123456789';
      process.env.JWT_EXPIRES_IN = '1h';
      process.env.CORS_ORIGIN = 'http://localhost:3000';
      process.env.RATE_LIMIT_WINDOW_MS = '900000';
      process.env.RATE_LIMIT_MAX = '100';

      const result = validateEnvVars();

      expect(result).toBe(true);
      expect(mockExit).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('🔧 should handle numeric zero values correctly', () => {
      // Set all required variables with zero values for numeric fields
      process.env.PORT = '0';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'secure_password_123456';
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '0';
      process.env.DB_NAME = 'test_db';
      process.env.DB_MAX_CONNECTIONS = '0';
      process.env.DB_IDLE_TIMEOUT_MS = '0';
      process.env.JWT_SECRET = 'a_very_long_and_secure_jwt_secret_key_123456789';
      process.env.JWT_EXPIRES_IN = '1h';
      process.env.CORS_ORIGIN = 'http://localhost:3000';
      process.env.RATE_LIMIT_WINDOW_MS = '0';
      process.env.RATE_LIMIT_MAX = '0';

      const result = validateEnvVars();

      expect(result).toBe(true);
      expect(mockExit).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('🚨 Combined Error Scenarios', () => {
    it('🚨 should prioritize missing variables over insecure ones', () => {
      // Missing some required variables AND set insecure values for others
      process.env.JWT_SECRET = 'short'; // Insecure
      process.env.DB_PASSWORD = 'weak'; // Insecure
      process.env.CORS_ORIGIN = 'bad-format'; // Insecure
      // Missing: PORT, DB_USER, DB_HOST, etc.

      validateEnvVars();

      expect(mockExit).toHaveBeenCalledWith(1);
      // Should report missing variables first
      expect(consoleErrorSpy).toHaveBeenCalledWith('Missing required environment variables:');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('PORT'));
      // Should not get to insecurity checks when missing variables exist
    });

    it('🚨 should report only insecure configurations when all variables present', () => {
      // Set all required variables but with insecure values
      process.env.PORT = '3001';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'short'; // Insecure
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = 'invalid'; // Insecure
      process.env.DB_NAME = 'test_db';
      process.env.DB_MAX_CONNECTIONS = '10';
      process.env.DB_IDLE_TIMEOUT_MS = '30000';
      process.env.JWT_SECRET = 'short'; // Insecure
      process.env.JWT_EXPIRES_IN = '1h';
      process.env.CORS_ORIGIN = 'bad-format'; // Insecure
      process.env.RATE_LIMIT_WINDOW_MS = '900000';
      process.env.RATE_LIMIT_MAX = '100';

      validateEnvVars();

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Insecure environment variable configurations:');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('JWT_SECRET (too short'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('DB_PASSWORD (too short'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('DB_PORT (must be a number)'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('CORS_ORIGIN (must be a valid URL'));
    });
  });
});

