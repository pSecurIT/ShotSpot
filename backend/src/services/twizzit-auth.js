/**
 * Twizzit Authentication Service
 * Handles encryption/decryption of API credentials and credential management
 */

import crypto from 'crypto';
import db from '../db.js';

const ALGORITHM = 'aes-256-cbc';
const _ENCRYPTION_KEY_LENGTH = 32; // 256 bits (reserved for validation)

/**
 * Validate and prepare encryption key
 * @param {string} key - Raw encryption key from environment
 * @returns {Buffer} Properly formatted encryption key
 */
function prepareEncryptionKey(key) {
  if (!key) {
    throw new Error('TWIZZIT_ENCRYPTION_KEY environment variable is required');
  }

  // If key is already 32 bytes in hex, use it directly
  if (key.length === 64 && /^[0-9a-f]+$/i.test(key)) {
    return Buffer.from(key, 'hex');
  }

  // Otherwise, hash it to get consistent 32-byte key
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt a password using AES-256-CBC
 * @param {string} password - Plain text password
 * @returns {Object} Encrypted data with IV
 */
export function encryptPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  try {
    const encryptionKey = prepareEncryptionKey(process.env.TWIZZIT_ENCRYPTION_KEY);
    
    // Generate a random initialization vector
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);
    
    // Encrypt the password
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encryptedPassword: encrypted,
      iv: iv.toString('hex')
    };
  } catch (error) {
    throw new Error(`Password encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt a password using AES-256-CBC
 * @param {string} encryptedPassword - Encrypted password in hex format
 * @param {string} ivHex - Initialization vector in hex format
 * @returns {string} Decrypted password
 */
export function decryptPassword(encryptedPassword, ivHex) {
  if (!encryptedPassword || typeof encryptedPassword !== 'string') {
    throw new Error('Encrypted password must be a non-empty string');
  }
  if (!ivHex || typeof ivHex !== 'string') {
    throw new Error('IV must be a non-empty string');
  }

  try {
    const encryptionKey = prepareEncryptionKey(process.env.TWIZZIT_ENCRYPTION_KEY);
    
    // Convert IV from hex
    const iv = Buffer.from(ivHex, 'hex');
    
    // Validate IV length (must be 16 bytes for AES-256-CBC)
    if (iv.length !== 16) {
      throw new Error('IV must be exactly 16 bytes (32 hex characters)');
    }
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
    
    // Decrypt the password
    let decrypted = decipher.update(encryptedPassword, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Password decryption failed: ${error.message}`);
  }
}

/**
 * Store Twizzit credentials in database (with encryption)
 * @param {Object} credentials - Credential data
 * @returns {Promise<Object>} Stored credential record
 */
export async function storeCredentials(credentials) {
  const { organizationName, apiUsername, apiPassword, apiEndpoint } = credentials;

  // Validate inputs
  if (!organizationName || typeof organizationName !== 'string') {
    throw new Error('Organization name is required');
  }
  if (!apiUsername || typeof apiUsername !== 'string') {
    throw new Error('API username is required');
  }
  if (!apiPassword || typeof apiPassword !== 'string') {
    throw new Error('API password is required');
  }

  // Encrypt the password
  const { encryptedPassword, iv } = encryptPassword(apiPassword);

  try {
    const result = await db.query(
      `INSERT INTO twizzit_credentials 
       (organization_name, api_username, encrypted_password, encryption_iv, api_endpoint, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (organization_name) 
       DO UPDATE SET 
         api_username = EXCLUDED.api_username,
         encrypted_password = EXCLUDED.encrypted_password,
         encryption_iv = EXCLUDED.encryption_iv,
         api_endpoint = EXCLUDED.api_endpoint,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        organizationName,
        apiUsername,
        encryptedPassword,
        iv,
        apiEndpoint || 'https://app.twizzit.com'
      ]
    );

    return result.rows[0];
  } catch (error) {
    throw new Error(`Failed to store credentials: ${error.message}`);
  }
}

/**
 * Retrieve and decrypt Twizzit credentials
 * @param {number} credentialId - Credential ID
 * @returns {Promise<Object>} Decrypted credentials
 */
export async function getCredentials(credentialId) {
  if (!credentialId) {
    throw new Error('Credential ID is required');
  }

  try {
    const result = await db.query(
      'SELECT * FROM twizzit_credentials WHERE id = $1 AND is_active = true',
      [credentialId]
    );

    if (result.rows.length === 0) {
      throw new Error('Credentials not found or inactive');
    }

    const credential = result.rows[0];

    // Decrypt the password
    const decryptedPassword = decryptPassword(
      credential.encrypted_password,
      credential.encryption_iv
    );

    return {
      id: credential.id,
      organizationName: credential.organization_name,
      apiUsername: credential.api_username,
      apiPassword: decryptedPassword,
      apiEndpoint: credential.api_endpoint,
      lastVerifiedAt: credential.last_verified_at,
      createdAt: credential.created_at,
      updatedAt: credential.updated_at
    };
  } catch (error) {
    throw new Error(`Failed to retrieve credentials: ${error.message}`);
  }
}

/**
 * Get credentials by organization name
 * @param {string} organizationName - Organization name
 * @returns {Promise<Object>} Decrypted credentials
 */
export async function getCredentialsByOrganization(organizationName) {
  if (!organizationName) {
    throw new Error('Organization name is required');
  }

  try {
    const result = await db.query(
      'SELECT * FROM twizzit_credentials WHERE organization_name = $1 AND is_active = true',
      [organizationName]
    );

    if (result.rows.length === 0) {
      throw new Error('Credentials not found for organization');
    }

    const credential = result.rows[0];

    // Decrypt the password
    const decryptedPassword = decryptPassword(
      credential.encrypted_password,
      credential.encryption_iv
    );

    return {
      id: credential.id,
      organizationName: credential.organization_name,
      apiUsername: credential.api_username,
      apiPassword: decryptedPassword,
      apiEndpoint: credential.api_endpoint,
      lastVerifiedAt: credential.last_verified_at,
      createdAt: credential.created_at,
      updatedAt: credential.updated_at
    };
  } catch (error) {
    throw new Error(`Failed to retrieve credentials: ${error.message}`);
  }
}

/**
 * List all stored credentials (without decrypted passwords)
 * @returns {Promise<Array>} List of credentials
 */
export async function listCredentials() {
  try {
    const result = await db.query(
      `SELECT id, organization_name, api_username, api_endpoint, 
              is_active, last_verified_at, created_at, updated_at
       FROM twizzit_credentials
       ORDER BY organization_name`
    );

    return result.rows.map(row => ({
      id: row.id,
      organizationName: row.organization_name,
      apiUsername: row.api_username,
      apiEndpoint: row.api_endpoint,
      isActive: row.is_active,
      lastVerifiedAt: row.last_verified_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  } catch (error) {
    throw new Error(`Failed to list credentials: ${error.message}`);
  }
}

/**
 * Update credential verification timestamp
 * @param {number} credentialId - Credential ID
 * @returns {Promise<void>}
 */
export async function updateVerificationTimestamp(credentialId) {
  if (!credentialId) {
    throw new Error('Credential ID is required');
  }

  try {
    await db.query(
      'UPDATE twizzit_credentials SET last_verified_at = CURRENT_TIMESTAMP WHERE id = $1',
      [credentialId]
    );
  } catch (error) {
    throw new Error(`Failed to update verification timestamp: ${error.message}`);
  }
}

/**
 * Deactivate credentials
 * @param {number} credentialId - Credential ID
 * @returns {Promise<void>}
 */
export async function deactivateCredentials(credentialId) {
  if (!credentialId) {
    throw new Error('Credential ID is required');
  }

  try {
    await db.query(
      'UPDATE twizzit_credentials SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [credentialId]
    );
  } catch (error) {
    throw new Error(`Failed to deactivate credentials: ${error.message}`);
  }
}

/**
 * Delete credentials
 * @param {number} credentialId - Credential ID
 * @returns {Promise<void>}
 */
export async function deleteCredentials(credentialId) {
  if (!credentialId) {
    throw new Error('Credential ID is required');
  }

  try {
    await db.query(
      'DELETE FROM twizzit_credentials WHERE id = $1',
      [credentialId]
    );
  } catch (error) {
    throw new Error(`Failed to delete credentials: ${error.message}`);
  }
}

export default {
  encryptPassword,
  decryptPassword,
  storeCredentials,
  getCredentials,
  getCredentialsByOrganization,
  listCredentials,
  updateVerificationTimestamp,
  deactivateCredentials,
  deleteCredentials
};
