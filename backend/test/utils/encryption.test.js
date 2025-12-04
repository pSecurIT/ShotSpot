/**
 * Tests for encryption utility
 * Validates AES-256-GCM encryption/decryption with proper key handling
 */

import { encrypt, decrypt, generateKey, testKey } from '../../src/utils/encryption.js';

describe('Encryption Utility', () => {
  const validKey = generateKey();
  const testData = 'sensitive-api-password-123';
  
  describe('generateKey', () => {
    it('should generate a 32-byte hex key', () => {
      const key = generateKey();
      expect(typeof key).toBe('string');
      expect(key.length).toBe(64); // 32 bytes = 64 hex chars
      expect(/^[0-9a-f]+$/.test(key)).toBe(true);
    });
    
    it('should generate unique keys', () => {
      const key1 = generateKey();
      const key2 = generateKey();
      expect(key1).not.toBe(key2);
    });
  });
  
  describe('encrypt', () => {
    it('should encrypt plaintext successfully', () => {
      const encrypted = encrypt(testData, validKey);
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(testData);
      
      // Validate format: iv:authTag:ciphertext
      const parts = encrypted.split(':');
      expect(parts.length).toBe(3);
      expect(parts[0].length).toBe(32); // 16 bytes IV = 32 hex chars
      expect(parts[1].length).toBe(32); // 16 bytes auth tag = 32 hex chars
      expect(parts[2].length).toBeGreaterThan(0);
    });
    
    it('should produce different ciphertext with same input (random IV)', () => {
      const encrypted1 = encrypt(testData, validKey);
      const encrypted2 = encrypt(testData, validKey);
      expect(encrypted1).not.toBe(encrypted2);
    });
    
    it('should throw error for missing plaintext', () => {
      expect(() => encrypt(null, validKey)).toThrow('Plaintext is required');
      expect(() => encrypt(undefined, validKey)).toThrow('Plaintext is required');
    });
    
    it('should throw error for non-string plaintext', () => {
      expect(() => encrypt(123, validKey)).toThrow('Plaintext must be a string');
      expect(() => encrypt({}, validKey)).toThrow('Plaintext must be a string');
    });
    
    it('should throw error for missing key', () => {
      expect(() => encrypt(testData, '')).toThrow('Encryption key is required');
      expect(() => encrypt(testData, null)).toThrow('Encryption key is required');
      expect(() => encrypt(testData, undefined)).toThrow('Encryption key is required');
    });
    
    it('should throw error for invalid key format', () => {
      expect(() => encrypt(testData, 'not-hex')).toThrow('valid hex string');
      expect(() => encrypt(testData, 'gg' + validKey.slice(2))).toThrow('valid hex string');
    });
    
    it('should throw error for wrong key length', () => {
      const shortKey = 'a'.repeat(30); // 15 bytes instead of 32
      expect(() => encrypt(testData, shortKey)).toThrow('must be 32 bytes');
      
      const longKey = 'a'.repeat(70); // 35 bytes instead of 32
      expect(() => encrypt(testData, longKey)).toThrow('must be 32 bytes');
    });
    
    it('should accept key with 0x prefix', () => {
      const keyWithPrefix = '0x' + validKey;
      const encrypted = encrypt(testData, keyWithPrefix);
      expect(encrypted).toBeTruthy();
      
      // Should decrypt correctly
      const decrypted = decrypt(encrypted, validKey);
      expect(decrypted).toBe(testData);
    });
    
    it('should encrypt empty string', () => {
      const encrypted = encrypt('', validKey);
      expect(encrypted).toBeTruthy();
      const decrypted = decrypt(encrypted, validKey);
      expect(decrypted).toBe('');
    });
    
    it('should handle special characters', () => {
      const specialData = 'password@#$%^&*(){}[]|\\:";\'<>?,./~`+=\n\t\r';
      const encrypted = encrypt(specialData, validKey);
      const decrypted = decrypt(encrypted, validKey);
      expect(decrypted).toBe(specialData);
    });
    
    it('should handle unicode characters', () => {
      const unicodeData = 'Héllo Wørld 你好世界 🎉🔒';
      const encrypted = encrypt(unicodeData, validKey);
      const decrypted = decrypt(encrypted, validKey);
      expect(decrypted).toBe(unicodeData);
    });
  });
  
  describe('decrypt', () => {
    it('should decrypt ciphertext successfully', () => {
      const encrypted = encrypt(testData, validKey);
      const decrypted = decrypt(encrypted, validKey);
      expect(decrypted).toBe(testData);
    });
    
    it('should throw error for missing encrypted data', () => {
      expect(() => decrypt('', validKey)).toThrow('Encrypted data is required');
      expect(() => decrypt(null, validKey)).toThrow('Encrypted data is required');
      expect(() => decrypt(undefined, validKey)).toThrow('Encrypted data is required');
    });
    
    it('should throw error for non-string encrypted data', () => {
      expect(() => decrypt(123, validKey)).toThrow('Encrypted data must be a string');
      expect(() => decrypt({}, validKey)).toThrow('Encrypted data must be a string');
    });
    
    it('should throw error for invalid encrypted format', () => {
      expect(() => decrypt('invalid', validKey)).toThrow('Invalid encrypted data format');
      expect(() => decrypt('a:b', validKey)).toThrow('Invalid encrypted data format');
      expect(() => decrypt('a:b:c:d', validKey)).toThrow('Invalid encrypted data format');
    });
    
    it('should throw error for wrong key', () => {
      const encrypted = encrypt(testData, validKey);
      const wrongKey = generateKey();
      
      expect(() => decrypt(encrypted, wrongKey)).toThrow('Authentication failed');
    });
    
    it('should throw error for corrupted data', () => {
      const encrypted = encrypt(testData, validKey);
      const parts = encrypted.split(':');
      
      // Corrupt ciphertext
      const corrupted = `${parts[0]}:${parts[1]}:aaaabbbbccccdddd`;
      expect(() => decrypt(corrupted, validKey)).toThrow('Authentication failed');
    });
    
    it('should throw error for corrupted IV', () => {
      const encrypted = encrypt(testData, validKey);
      const parts = encrypted.split(':');
      
      // Corrupt IV
      const corrupted = `${'a'.repeat(32)}:${parts[1]}:${parts[2]}`;
      expect(() => decrypt(corrupted, validKey)).toThrow('Authentication failed');
    });
    
    it('should throw error for corrupted auth tag', () => {
      const encrypted = encrypt(testData, validKey);
      const parts = encrypted.split(':');
      
      // Corrupt auth tag
      const corrupted = `${parts[0]}:${'b'.repeat(32)}:${parts[2]}`;
      expect(() => decrypt(corrupted, validKey)).toThrow('Authentication failed');
    });
    
    it('should throw error for invalid IV length', () => {
      const encrypted = encrypt(testData, validKey);
      const parts = encrypted.split(':');
      
      // Short IV
      const corrupted = `${'a'.repeat(10)}:${parts[1]}:${parts[2]}`;
      expect(() => decrypt(corrupted, validKey)).toThrow('Invalid IV length');
    });
    
    it('should throw error for invalid auth tag length', () => {
      const encrypted = encrypt(testData, validKey);
      const parts = encrypted.split(':');
      
      // Short auth tag
      const corrupted = `${parts[0]}:${'b'.repeat(10)}:${parts[2]}`;
      expect(() => decrypt(corrupted, validKey)).toThrow('Invalid auth tag length');
    });
    
    it('should handle long plaintext', () => {
      const longData = 'A'.repeat(10000);
      const encrypted = encrypt(longData, validKey);
      const decrypted = decrypt(encrypted, validKey);
      expect(decrypted).toBe(longData);
    });
  });
  
  describe('testKey', () => {
    it('should return true for valid key', () => {
      expect(testKey(validKey)).toBe(true);
    });
    
    it('should return false for invalid key', () => {
      expect(testKey('invalid')).toBe(false);
      expect(testKey('')).toBe(false);
      expect(testKey(null)).toBe(false);
      expect(testKey(undefined)).toBe(false);
    });
    
    it('should return false for wrong length key', () => {
      expect(testKey('a'.repeat(30))).toBe(false);
      expect(testKey('a'.repeat(70))).toBe(false);
    });
  });
  
  describe('round-trip encryption', () => {
    it('should encrypt and decrypt multiple times consistently', () => {
      let data = testData;
      
      for (let i = 0; i < 10; i++) {
        const encrypted = encrypt(data, validKey);
        const decrypted = decrypt(encrypted, validKey);
        expect(decrypted).toBe(data);
      }
    });
    
    it('should work with multiple different keys', () => {
      const key1 = generateKey();
      const key2 = generateKey();
      
      const encrypted1 = encrypt(testData, key1);
      const encrypted2 = encrypt(testData, key2);
      
      // Different keys produce different ciphertext
      expect(encrypted1).not.toBe(encrypted2);
      
      // Each decrypts with its own key
      expect(decrypt(encrypted1, key1)).toBe(testData);
      expect(decrypt(encrypted2, key2)).toBe(testData);
      
      // Cannot decrypt with wrong key
      expect(() => decrypt(encrypted1, key2)).toThrow();
      expect(() => decrypt(encrypted2, key1)).toThrow();
    });
  });
  
  describe('security properties', () => {
    it('should not leak plaintext in ciphertext', () => {
      const plaintext = 'secret-password-12345';
      const encrypted = encrypt(plaintext, validKey);
      
      // Ciphertext should not contain plaintext
      expect(encrypted.toLowerCase()).not.toContain(plaintext.toLowerCase());
      expect(encrypted).not.toContain('password');
      expect(encrypted).not.toContain('12345');
    });
    
    it('should produce different IV for each encryption', () => {
      const encrypted1 = encrypt(testData, validKey);
      const encrypted2 = encrypt(testData, validKey);
      
      const iv1 = encrypted1.split(':')[0];
      const iv2 = encrypted2.split(':')[0];
      
      expect(iv1).not.toBe(iv2);
    });
    
    it('should produce unpredictable ciphertext', () => {
      const ciphertexts = new Set();
      
      // Generate 100 encryptions of same data
      for (let i = 0; i < 100; i++) {
        const encrypted = encrypt(testData, validKey);
        ciphertexts.add(encrypted);
      }
      
      // All should be unique (due to random IV)
      expect(ciphertexts.size).toBe(100);
    });
  });
});
