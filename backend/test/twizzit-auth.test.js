/**
 * Tests for Twizzit Authentication Service
 */

import crypto from 'crypto';
import db from '../src/db.js';
import twizzitAuth from '../src/services/twizzit-auth.js';

describe('Twizzit Authentication Service', () => {
  let testCredentialId;

  beforeAll(async () => {
    // Set up test encryption key
    if (!process.env.TWIZZIT_ENCRYPTION_KEY) {
      process.env.TWIZZIT_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    }
  });

  afterEach(async () => {
    // Clean up test data
    await db.query('DELETE FROM twizzit_credentials WHERE organization_name LIKE $1', ['Test%']);
  });

  describe('Password Encryption/Decryption', () => {
    it('should encrypt and decrypt a password correctly', () => {
      const originalPassword = 'MySecurePassword123!';
      
      const { encryptedPassword, iv } = twizzitAuth.encryptPassword(originalPassword);
      
      expect(encryptedPassword).toBeDefined();
      expect(iv).toBeDefined();
      expect(encryptedPassword).not.toBe(originalPassword);
      
      const decryptedPassword = twizzitAuth.decryptPassword(encryptedPassword, iv);
      expect(decryptedPassword).toBe(originalPassword);
    });

    it('should generate different encrypted values for same password', () => {
      const password = 'TestPassword';
      
      const result1 = twizzitAuth.encryptPassword(password);
      const result2 = twizzitAuth.encryptPassword(password);
      
      // Different IVs should result in different encrypted values
      expect(result1.iv).not.toBe(result2.iv);
      expect(result1.encryptedPassword).not.toBe(result2.encryptedPassword);
      
      // Both should decrypt to original
      expect(twizzitAuth.decryptPassword(result1.encryptedPassword, result1.iv)).toBe(password);
      expect(twizzitAuth.decryptPassword(result2.encryptedPassword, result2.iv)).toBe(password);
    });

    it('should reject invalid inputs for encryption', () => {
      expect(() => twizzitAuth.encryptPassword('')).toThrow('Password must be a non-empty string');
      expect(() => twizzitAuth.encryptPassword(null)).toThrow('Password must be a non-empty string');
      expect(() => twizzitAuth.encryptPassword(undefined)).toThrow('Password must be a non-empty string');
      expect(() => twizzitAuth.encryptPassword(123)).toThrow('Password must be a non-empty string');
    });

    it('should reject invalid inputs for decryption', () => {
      const { encryptedPassword, iv } = twizzitAuth.encryptPassword('test');
      
      expect(() => twizzitAuth.decryptPassword('', iv)).toThrow('Encrypted password must be a non-empty string');
      expect(() => twizzitAuth.decryptPassword(encryptedPassword, '')).toThrow('IV must be a non-empty string');
      expect(() => twizzitAuth.decryptPassword(null, iv)).toThrow('Encrypted password must be a non-empty string');
      expect(() => twizzitAuth.decryptPassword(encryptedPassword, null)).toThrow('IV must be a non-empty string');
    });

    it('should fail decryption with wrong IV', () => {
      const { encryptedPassword } = twizzitAuth.encryptPassword('test');
      const wrongIv = crypto.randomBytes(16).toString('hex');
      
      expect(() => twizzitAuth.decryptPassword(encryptedPassword, wrongIv)).toThrow();
    });

    it('should handle special characters in password', () => {
      const specialPassword = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~';
      
      const { encryptedPassword, iv } = twizzitAuth.encryptPassword(specialPassword);
      const decrypted = twizzitAuth.decryptPassword(encryptedPassword, iv);
      
      expect(decrypted).toBe(specialPassword);
    });

    it('should handle unicode characters in password', () => {
      const unicodePassword = '密码🔐🎉';
      
      const { encryptedPassword, iv } = twizzitAuth.encryptPassword(unicodePassword);
      const decrypted = twizzitAuth.decryptPassword(encryptedPassword, iv);
      
      expect(decrypted).toBe(unicodePassword);
    });
  });

  describe('Store Credentials', () => {
    it('should store new credentials successfully', async () => {
      const credentials = {
        organizationName: 'Test Organization',
        apiUsername: 'test-user',
        apiPassword: 'test-password-123',
        apiEndpoint: 'https://api.test.com/v1'
      };

      const result = await twizzitAuth.storeCredentials(credentials);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.organization_name).toBe(credentials.organizationName);
      expect(result.api_username).toBe(credentials.apiUsername);
      expect(result.encrypted_password).toBeDefined();
      expect(result.encryption_iv).toBeDefined();
      expect(result.api_endpoint).toBe(credentials.apiEndpoint);
      expect(result.is_active).toBe(true);

      testCredentialId = result.id;
    });

    it('should update existing credentials on conflict', async () => {
      const credentials = {
        organizationName: 'Test Organization 2',
        apiUsername: 'user1',
        apiPassword: 'password1',
        apiEndpoint: 'https://api.test.com/v1'
      };

      // Store initial credentials
      const initial = await twizzitAuth.storeCredentials(credentials);

      // Store with same organization name but different details
      const updated = await twizzitAuth.storeCredentials({
        ...credentials,
        apiUsername: 'user2',
        apiPassword: 'password2'
      });

      expect(updated.id).toBe(initial.id);
      expect(updated.api_username).toBe('user2');
      expect(updated.encrypted_password).not.toBe(initial.encrypted_password);
    });

    it('should use default API endpoint if not provided', async () => {
      const credentials = {
        organizationName: 'Test Organization 3',
        apiUsername: 'test-user',
        apiPassword: 'test-password'
      };

      const result = await twizzitAuth.storeCredentials(credentials);

      expect(result.api_endpoint).toBe('https://app.twizzit.com');
    });

    it('should reject invalid inputs', async () => {
      await expect(twizzitAuth.storeCredentials({
        organizationName: '',
        apiUsername: 'user',
        apiPassword: 'pass'
      })).rejects.toThrow('Organization name is required');

      await expect(twizzitAuth.storeCredentials({
        organizationName: 'Test',
        apiUsername: '',
        apiPassword: 'pass'
      })).rejects.toThrow('API username is required');

      await expect(twizzitAuth.storeCredentials({
        organizationName: 'Test',
        apiUsername: 'user',
        apiPassword: ''
      })).rejects.toThrow('API password is required');
    });
  });

  describe('Get Credentials', () => {
    beforeEach(async () => {
      const credentials = {
        organizationName: 'Test Get Credentials',
        apiUsername: 'get-test-user',
        apiPassword: 'get-test-password',
        apiEndpoint: 'https://api.test.com/v1'
      };
      const result = await twizzitAuth.storeCredentials(credentials);
      testCredentialId = result.id;
    });

    it('should retrieve and decrypt credentials by ID', async () => {
      const credentials = await twizzitAuth.getCredentials(testCredentialId);

      expect(credentials).toBeDefined();
      expect(credentials.id).toBe(testCredentialId);
      expect(credentials.organizationName).toBe('Test Get Credentials');
      expect(credentials.apiUsername).toBe('get-test-user');
      expect(credentials.apiPassword).toBe('get-test-password');
      expect(credentials.apiEndpoint).toBe('https://api.test.com/v1');
    });

    it('should retrieve credentials by organization name', async () => {
      const credentials = await twizzitAuth.getCredentialsByOrganization('Test Get Credentials');

      expect(credentials).toBeDefined();
      expect(credentials.organizationName).toBe('Test Get Credentials');
      expect(credentials.apiPassword).toBe('get-test-password');
    });

    it('should throw error for non-existent credential ID', async () => {
      await expect(twizzitAuth.getCredentials(99999)).rejects.toThrow('Credentials not found or inactive');
    });

    it('should throw error for non-existent organization', async () => {
      await expect(twizzitAuth.getCredentialsByOrganization('Non Existent')).rejects.toThrow('Credentials not found for organization');
    });

    it('should throw error for missing credential ID', async () => {
      await expect(twizzitAuth.getCredentials(null)).rejects.toThrow('Credential ID is required');
    });
  });

  describe('List Credentials', () => {
    beforeEach(async () => {
      // Create multiple test credentials
      await twizzitAuth.storeCredentials({
        organizationName: 'Test List 1',
        apiUsername: 'user1',
        apiPassword: 'pass1'
      });
      await twizzitAuth.storeCredentials({
        organizationName: 'Test List 2',
        apiUsername: 'user2',
        apiPassword: 'pass2'
      });
    });

    it('should list all credentials without passwords', async () => {
      const credentials = await twizzitAuth.listCredentials();

      expect(Array.isArray(credentials)).toBe(true);
      expect(credentials.length).toBeGreaterThanOrEqual(2);

      credentials.forEach(cred => {
        expect(cred.id).toBeDefined();
        expect(cred.organizationName).toBeDefined();
        expect(cred.apiUsername).toBeDefined();
        expect(cred.apiEndpoint).toBeDefined();
        expect(cred.isActive).toBeDefined();
        expect(cred.apiPassword).toBeUndefined(); // Should not include password
      });
    });

    it('should order credentials by organization name', async () => {
      const credentials = await twizzitAuth.listCredentials();
      
      const testCreds = credentials.filter(c => c.organizationName.startsWith('Test List'));
      expect(testCreds[0].organizationName).toBe('Test List 1');
      expect(testCreds[1].organizationName).toBe('Test List 2');
    });
  });

  describe('Update Verification Timestamp', () => {
    beforeEach(async () => {
      const result = await twizzitAuth.storeCredentials({
        organizationName: 'Test Verification',
        apiUsername: 'verify-user',
        apiPassword: 'verify-pass'
      });
      testCredentialId = result.id;
    });

    it('should update verification timestamp', async () => {
      const beforeUpdate = await db.query(
        'SELECT last_verified_at FROM twizzit_credentials WHERE id = $1',
        [testCredentialId]
      );

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));

      await twizzitAuth.updateVerificationTimestamp(testCredentialId);

      const afterUpdate = await db.query(
        'SELECT last_verified_at FROM twizzit_credentials WHERE id = $1',
        [testCredentialId]
      );

      expect(afterUpdate.rows[0].last_verified_at).not.toBe(beforeUpdate.rows[0].last_verified_at);
    });

    it('should reject missing credential ID', async () => {
      await expect(twizzitAuth.updateVerificationTimestamp(null)).rejects.toThrow('Credential ID is required');
    });
  });

  describe('Deactivate Credentials', () => {
    beforeEach(async () => {
      const result = await twizzitAuth.storeCredentials({
        organizationName: 'Test Deactivate',
        apiUsername: 'deactivate-user',
        apiPassword: 'deactivate-pass'
      });
      testCredentialId = result.id;
    });

    it('should deactivate credentials', async () => {
      await twizzitAuth.deactivateCredentials(testCredentialId);

      const result = await db.query(
        'SELECT is_active FROM twizzit_credentials WHERE id = $1',
        [testCredentialId]
      );

      expect(result.rows[0].is_active).toBe(false);
    });

    it('should not retrieve deactivated credentials', async () => {
      await twizzitAuth.deactivateCredentials(testCredentialId);

      await expect(twizzitAuth.getCredentials(testCredentialId)).rejects.toThrow('Credentials not found or inactive');
    });
  });

  describe('Delete Credentials', () => {
    beforeEach(async () => {
      const result = await twizzitAuth.storeCredentials({
        organizationName: 'Test Delete',
        apiUsername: 'delete-user',
        apiPassword: 'delete-pass'
      });
      testCredentialId = result.id;
    });

    it('should delete credentials', async () => {
      await twizzitAuth.deleteCredentials(testCredentialId);

      const result = await db.query(
        'SELECT * FROM twizzit_credentials WHERE id = $1',
        [testCredentialId]
      );

      expect(result.rows.length).toBe(0);
    });

    it('should cascade delete related data', async () => {
      // Create sync config
      await db.query(
        'INSERT INTO twizzit_sync_config (credential_id) VALUES ($1)',
        [testCredentialId]
      );

      await twizzitAuth.deleteCredentials(testCredentialId);

      const configResult = await db.query(
        'SELECT * FROM twizzit_sync_config WHERE credential_id = $1',
        [testCredentialId]
      );

      expect(configResult.rows.length).toBe(0);
    });
  });

  describe('Encryption Key Handling', () => {
    it('should fail without encryption key', () => {
      const originalKey = process.env.TWIZZIT_ENCRYPTION_KEY;
      delete process.env.TWIZZIT_ENCRYPTION_KEY;

      expect(() => twizzitAuth.encryptPassword('test')).toThrow('TWIZZIT_ENCRYPTION_KEY environment variable is required');

      process.env.TWIZZIT_ENCRYPTION_KEY = originalKey;
    });

    it('should handle 64-character hex key', () => {
      const hexKey = crypto.randomBytes(32).toString('hex');
      const originalKey = process.env.TWIZZIT_ENCRYPTION_KEY;
      
      process.env.TWIZZIT_ENCRYPTION_KEY = hexKey;
      
      const password = 'TestPassword';
      const { encryptedPassword, iv } = twizzitAuth.encryptPassword(password);
      const decrypted = twizzitAuth.decryptPassword(encryptedPassword, iv);
      
      expect(decrypted).toBe(password);
      
      process.env.TWIZZIT_ENCRYPTION_KEY = originalKey;
    });

    it('should hash non-hex keys to proper length', () => {
      const shortKey = 'my-short-key';
      const originalKey = process.env.TWIZZIT_ENCRYPTION_KEY;
      
      process.env.TWIZZIT_ENCRYPTION_KEY = shortKey;
      
      const password = 'TestPassword';
      const { encryptedPassword, iv } = twizzitAuth.encryptPassword(password);
      const decrypted = twizzitAuth.decryptPassword(encryptedPassword, iv);
      
      expect(decrypted).toBe(password);
      
      process.env.TWIZZIT_ENCRYPTION_KEY = originalKey;
    });
  });
});
