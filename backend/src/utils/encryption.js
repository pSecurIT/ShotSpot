/**
 * Encryption utilities for secure credential storage
 * Uses AES-256-GCM for authenticated encryption with proper IV generation
 * 
 * Used for encrypting Twizzit API passwords before storing in database
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Validates encryption key format and length
 * @param {string} key - Hex-encoded encryption key
 * @throws {Error} If key is invalid
 */
function validateKey(key) {
  if (!key) {
    throw new Error('Encryption key is required');
  }
  
  if (typeof key !== 'string') {
    throw new Error('Encryption key must be a string');
  }
  
  // Remove potential 0x prefix
  const cleanKey = key.startsWith('0x') ? key.slice(2) : key;
  
  if (!/^[0-9a-fA-F]+$/.test(cleanKey)) {
    throw new Error('Encryption key must be a valid hex string');
  }
  
  const keyBuffer = Buffer.from(cleanKey, 'hex');
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`Encryption key must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex characters), got ${keyBuffer.length} bytes`);
  }
  
  return keyBuffer;
}

/**
 * Encrypts plaintext using AES-256-GCM
 * @param {string} plaintext - Text to encrypt
 * @param {string} keyHex - Hex-encoded 32-byte encryption key
 * @returns {string} Encrypted data in format: iv:authTag:ciphertext (all hex-encoded)
 * @throws {Error} If encryption fails or key is invalid
 */
export function encrypt(plaintext, keyHex) {
  if (plaintext === null || plaintext === undefined) {
    throw new Error('Plaintext is required');
  }
  
  if (typeof plaintext !== 'string') {
    throw new Error('Plaintext must be a string');
  }
  
  try {
    const key = validateKey(keyHex);
    
    // Generate random IV for each encryption
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt data
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag
    const authTag = cipher.getAuthTag();
    
    // Return combined format: iv:authTag:ciphertext
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypts ciphertext using AES-256-GCM
 * @param {string} encrypted - Encrypted data in format: iv:authTag:ciphertext (hex-encoded)
 * @param {string} keyHex - Hex-encoded 32-byte encryption key
 * @returns {string} Decrypted plaintext
 * @throws {Error} If decryption fails, authentication fails, or key is invalid
 */
export function decrypt(encrypted, keyHex) {
  if (encrypted === null || encrypted === undefined || encrypted === '') {
    throw new Error('Encrypted data is required');
  }
  
  if (typeof encrypted !== 'string') {
    throw new Error('Encrypted data must be a string');
  }
  
  try {
    const key = validateKey(keyHex);
    
    // Parse encrypted data format: iv:authTag:ciphertext
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format. Expected: iv:authTag:ciphertext');
    }
    
    const [ivHex, authTagHex, ciphertextHex] = parts;
    
    // Convert from hex
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');
    
    // Validate lengths
    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
    }
    
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}`);
    }
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt data
    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    if (error.message.includes('Unsupported state or unable to authenticate data')) {
      throw new Error('Decryption failed: Authentication failed. Data may be corrupted or key is incorrect.');
    }
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Generates a secure random encryption key
 * @returns {string} Hex-encoded 32-byte key
 */
export function generateKey() {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Tests if encryption/decryption works with given key
 * @param {string} keyHex - Hex-encoded encryption key to test
 * @returns {boolean} True if key works correctly
 */
export function testKey(keyHex) {
  try {
    const testData = 'test-encryption-key-validation';
    const encrypted = encrypt(testData, keyHex);
    const decrypted = decrypt(encrypted, keyHex);
    return decrypted === testData;
  } catch (_error) {
    return false;
  }
}
