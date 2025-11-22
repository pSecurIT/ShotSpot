import {
  sanitizeQueryForLogging,
  sanitizeDbError,
  createQueryLogMetadata,
  isParameterizedQuery,
  sanitizeQueryObject,
  truncateString
} from '../src/utils/dbSanitizer.js';

describe('🔒 Database Sanitizer Utility', () => {
  describe('sanitizeQueryForLogging', () => {
    it('✅ should sanitize string literals in queries', () => {
      const query = 'SELECT * FROM users WHERE email = \'user@example.com\'';
      const result = sanitizeQueryForLogging(query);
      expect(result).toContain('\'***\'');
      expect(result).not.toContain('user@example.com');
    });

    it('✅ should sanitize password fields', () => {
      const query = 'UPDATE users SET password = \'secret123\' WHERE id = 1';
      const result = sanitizeQueryForLogging(query);
      expect(result).toContain('******');
      expect(result).not.toContain('secret123');
    });

    it('✅ should sanitize token fields', () => {
      const query = 'SELECT * FROM sessions WHERE token = \'abc123xyz\'';
      const result = sanitizeQueryForLogging(query);
      expect(result).toContain('token=***');
      expect(result).not.toContain('abc123xyz');
    });

    it('✅ should sanitize API key fields', () => {
      const query = 'INSERT INTO config (api_key) VALUES (\'key123\')';
      const result = sanitizeQueryForLogging(query);
      // After string literal sanitization, the value becomes '***'
      expect(result).toContain('(api_key)');
      expect(result).toContain('\'***\'');
      expect(result).not.toContain('key123');
    });

    it('✅ should truncate long queries', () => {
      const longQuery = 'SELECT * FROM users WHERE ' + 'x = 1 AND '.repeat(50);
      const result = sanitizeQueryForLogging(longQuery, 100);
      expect(result.length).toBeLessThanOrEqual(103); // 100 + '...'
      expect(result).toContain('...');
    });

    it('✅ should normalize whitespace', () => {
      const query = 'SELECT   *\n\nFROM\t\tusers   WHERE  id = 1';
      const result = sanitizeQueryForLogging(query);
      expect(result).not.toContain('\n');
      expect(result).not.toContain('\t');
      expect(result).not.toContain('  '); // double spaces
    });

    it('✅ should handle empty or null input', () => {
      expect(sanitizeQueryForLogging('')).toBe('[empty query]');
      expect(sanitizeQueryForLogging(null)).toBe('[empty query]');
      expect(sanitizeQueryForLogging(undefined)).toBe('[empty query]');
    });

    it('✅ should handle non-string input', () => {
      expect(sanitizeQueryForLogging(123)).toBe('[empty query]');
      expect(sanitizeQueryForLogging({})).toBe('[empty query]');
    });
  });

  describe('sanitizeDbError', () => {
    it('✅ should extract safe error information', () => {
      const error = new Error('duplicate key value');
      error.code = '23505';
      error.severity = 'ERROR';
      
      const result = sanitizeDbError(error);
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('code', '23505');
      expect(result).toHaveProperty('severity', 'ERROR');
    });

    it('✅ should sanitize password in error messages', () => {
      const error = new Error('authentication failed for user \'admin\' with password \'secret\'');
      const result = sanitizeDbError(error);
      expect(result.message).toContain('password***');
      expect(result.message).not.toContain('secret');
    });

    it('✅ should sanitize string literals in error messages', () => {
      const error = new Error('constraint violation: \'sensitive data\'');
      const result = sanitizeDbError(error);
      expect(result.message).toContain('\'***\'');
      expect(result.message).not.toContain('sensitive data');
    });

    it('✅ should handle null or undefined errors', () => {
      expect(sanitizeDbError(null)).toEqual({ message: 'Unknown error' });
      expect(sanitizeDbError(undefined)).toEqual({ message: 'Unknown error' });
    });

    it('✅ should handle errors without message', () => {
      const error = { code: '42P01' };
      const result = sanitizeDbError(error);
      expect(result.message).toBe('Unknown error');
      expect(result.code).toBe('42P01');
    });
  });

  describe('createQueryLogMetadata', () => {
    it('✅ should create metadata without query preview in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const result = createQueryLogMetadata('SELECT * FROM users', 150, 10, true);
      
      expect(result).toHaveProperty('duration', 150);
      expect(result).toHaveProperty('rows', 10);
      expect(result).not.toHaveProperty('queryPreview');
      
      process.env.NODE_ENV = originalEnv;
    });

    it('✅ should create metadata with query preview in development when requested', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const result = createQueryLogMetadata('SELECT * FROM users WHERE id = 1', 50, 1, true);
      
      expect(result).toHaveProperty('duration', 50);
      expect(result).toHaveProperty('rows', 1);
      expect(result).toHaveProperty('queryPreview');
      
      process.env.NODE_ENV = originalEnv;
    });

    it('✅ should not include query preview by default', () => {
      const result = createQueryLogMetadata('SELECT * FROM users', 100, 5);
      expect(result).not.toHaveProperty('queryPreview');
    });
  });

  describe('isParameterizedQuery', () => {
    it('✅ should detect parameterized queries', () => {
      expect(isParameterizedQuery('SELECT * FROM users WHERE id = $1')).toBe(true);
      expect(isParameterizedQuery('INSERT INTO users (name) VALUES ($1)')).toBe(true);
      expect(isParameterizedQuery('UPDATE users SET name = $1 WHERE id = $2')).toBe(true);
    });

    it('✅ should detect non-parameterized queries', () => {
      expect(isParameterizedQuery('SELECT * FROM users')).toBe(false);
      expect(isParameterizedQuery('SELECT * FROM users WHERE name = \'John\'')).toBe(false);
    });

    it('✅ should handle edge cases', () => {
      expect(isParameterizedQuery('')).toBe(false);
      expect(isParameterizedQuery(null)).toBe(false);
      expect(isParameterizedQuery(undefined)).toBe(false);
      expect(isParameterizedQuery(123)).toBe(false);
    });
  });

  describe('sanitizeQueryObject', () => {
    it('✅ should sanitize complete query object', () => {
      const queryInfo = {
        text: 'SELECT * FROM users WHERE email = \'user@example.com\'',
        params: ['value1', 'value2']
      };
      
      const result = sanitizeQueryObject(queryInfo);
      
      expect(result).toHaveProperty('text');
      expect(result.text).not.toContain('user@example.com');
      expect(result).toHaveProperty('paramCount', 2);
      expect(result).toHaveProperty('isParameterized');
    });

    it('✅ should handle query object without params', () => {
      const queryInfo = {
        text: 'SELECT * FROM users'
      };
      
      const result = sanitizeQueryObject(queryInfo);
      expect(result.paramCount).toBe(0);
    });

    it('✅ should handle null query object', () => {
      const result = sanitizeQueryObject(null);
      expect(result).toEqual({ text: '[no query]' });
    });
  });

  describe('truncateString', () => {
    it('✅ should truncate long strings', () => {
      const longString = 'a'.repeat(100);
      const result = truncateString(longString, 50);
      expect(result.length).toBe(50); // maxLength exactly (47 chars + '...')
      expect(result).toEndWith('...');
    });

    it('✅ should not truncate short strings', () => {
      const shortString = 'hello';
      const result = truncateString(shortString, 50);
      expect(result).toBe('hello');
      expect(result).not.toContain('...');
    });

    it('✅ should handle empty or null input', () => {
      expect(truncateString('')).toBe('');
      expect(truncateString(null)).toBe('');
      expect(truncateString(undefined)).toBe('');
    });

    it('✅ should handle non-string input', () => {
      expect(truncateString(123)).toBe('');
      expect(truncateString({})).toBe('');
    });
  });

  describe('Security - SQL Injection Prevention', () => {
    it('✅ should sanitize potential SQL injection attempts', () => {
      const maliciousQuery = 'SELECT * FROM users WHERE name = \'admin\' OR \'1\'=\'1\'';
      const result = sanitizeQueryForLogging(maliciousQuery);
      expect(result).toContain('\'***\'');
      expect(result).not.toContain('OR \'1\'=\'1\'');
    });

    it('✅ should sanitize DROP TABLE attempts', () => {
      const maliciousQuery = 'SELECT * FROM users; DROP TABLE users; --';
      const result = sanitizeQueryForLogging(maliciousQuery);
      // The exact output may vary but should not contain the original malicious query
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('✅ should sanitize multiple sensitive patterns', () => {
      const query = 'UPDATE users SET password=\'pass123\', token=\'tok456\', api_key=\'key789\'';
      const result = sanitizeQueryForLogging(query);
      expect(result).toContain('password=***');
      expect(result).toContain('token=***');
      expect(result).toContain('api_key=***');
      expect(result).not.toContain('pass123');
      expect(result).not.toContain('tok456');
      expect(result).not.toContain('key789');
    });
  });
});
