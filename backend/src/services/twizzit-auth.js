/**
 * Twizzit Authentication Service
 * Handles JWT token management for Twizzit API integration
 * 
 * Features:
 * - Authenticate with username/password and obtain JWT token
 * - Store encrypted credentials in database
 * - Auto-refresh expired tokens
 * - Handle 401 (unauthorized) and 429 (rate limit) errors
 */

import db from '../db.js';
import { encrypt, decrypt } from '../utils/encryption.js';

const TWIZZIT_API_BASE_URL = process.env.TWIZZIT_API_BASE_URL || 'https://api.twizzit.com';
const ENCRYPTION_KEY = process.env.TWIZZIT_ENCRYPTION_KEY;

// Token expiry buffer - refresh if token expires within 5 minutes
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

/**
 * Custom error for Twizzit authentication failures
 */
export class TwizzitAuthError extends Error {
  constructor(message, statusCode, response) {
    super(message);
    this.name = 'TwizzitAuthError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

/**
 * Custom error for rate limiting
 */
export class TwizzitRateLimitError extends Error {
  constructor(message, response) {
    super(message);
    this.name = 'TwizzitRateLimitError';
    this.response = response;
  }
}

/**
 * Validates encryption key is configured
 * @throws {Error} If encryption key is not set
 */
function validateEncryptionKey() {
  if (!ENCRYPTION_KEY) {
    throw new Error('TWIZZIT_ENCRYPTION_KEY environment variable is not configured');
  }
}

/**
 * Authenticates with Twizzit API and obtains JWT token
 * @param {string} username - Twizzit API username
 * @param {string} password - Twizzit API password
 * @returns {Promise<{token: string, createdOn: number, validTill: number}>} JWT token with expiry timestamps
 * @throws {TwizzitAuthError} If authentication fails (401)
 * @throws {TwizzitRateLimitError} If rate limit exceeded (429)
 * @throws {Error} For network or other errors
 */
export async function authenticate(username, password) {
  if (!username || !password) {
    throw new Error('Username and password are required');
  }

  try {
    const response = await fetch(`${TWIZZIT_API_BASE_URL}/v2/api/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username,
        password,
      }),
    });

    const data = await response.json();

    if (response.status === 401) {
      throw new TwizzitAuthError(
        data.error || 'Invalid credentials',
        401,
        data
      );
    }

    if (response.status === 429) {
      throw new TwizzitRateLimitError(
        data.error || 'Monthly API call limit exceeded',
        data
      );
    }

    if (!response.ok) {
      throw new TwizzitAuthError(
        `Authentication failed: ${response.statusText}`,
        response.status,
        data
      );
    }

    if (!data.token) {
      throw new Error('No token returned from authentication');
    }

    return {
      token: data.token,
      createdOn: data['created-on'],
      validTill: data['valid-till'],
    };
  } catch (error) {
    if (error instanceof TwizzitAuthError || error instanceof TwizzitRateLimitError) {
      throw error;
    }
    throw new Error(`Twizzit authentication request failed: ${error.message}`);
  }
}

/**
 * Checks if a JWT token is still valid
 * @param {string} token - JWT token to check
 * @param {number} validTill - Unix timestamp (seconds) when token expires
 * @returns {boolean} True if token is valid and not expiring soon
 */
export function isTokenValid(token, validTill) {
  if (!token || !validTill) {
    return false;
  }

  const now = Date.now();
  const expiryMs = validTill * 1000; // Convert to milliseconds
  const timeUntilExpiry = expiryMs - now;

  // Token is valid if it doesn't expire within the buffer period
  return timeUntilExpiry > TOKEN_EXPIRY_BUFFER_MS;
}

/**
 * Gets a valid JWT token for a Twizzit config, refreshing if needed
 * @param {number} configId - Twizzit config ID from twizzit_config table
 * @returns {Promise<string>} Valid JWT token
 * @throws {Error} If config not found or credentials invalid
 */
export async function getValidToken(configId) {
  validateEncryptionKey();

  // Fetch config from database
  const configResult = await db.query(
    'SELECT jwt_token, token_expires_at, api_username, api_password_encrypted FROM twizzit_config WHERE id = $1',
    [configId]
  );

  if (configResult.rows.length === 0) {
    throw new Error(`Twizzit config not found: ${configId}`);
  }

  const config = configResult.rows[0];
  const { jwt_token, token_expires_at, api_username, api_password_encrypted } = config;

  // Check if current token is still valid
  if (jwt_token && token_expires_at) {
    const validTillTimestamp = Math.floor(new Date(token_expires_at).getTime() / 1000);
    if (isTokenValid(jwt_token, validTillTimestamp)) {
      return jwt_token;
    }
  }

  // Token expired or missing, refresh it
  if (process.env.NODE_ENV !== 'test') {
    console.log(`Twizzit token expired for config ${configId}, refreshing...`);
  }

  return await refreshToken(configId, api_username, api_password_encrypted);
}

/**
 * Refreshes JWT token by re-authenticating with stored credentials
 * @param {number} configId - Twizzit config ID
 * @param {string} username - Twizzit username
 * @param {string} encryptedPassword - Encrypted password from database
 * @returns {Promise<string>} New JWT token
 * @throws {Error} If decryption or authentication fails
 */
export async function refreshToken(configId, username, encryptedPassword) {
  validateEncryptionKey();

  // Decrypt password
  let password;
  try {
    password = decrypt(encryptedPassword, ENCRYPTION_KEY);
  } catch (error) {
    throw new Error(`Failed to decrypt Twizzit password: ${error.message}`);
  }

  // Authenticate to get new token
  const authResult = await authenticate(username, password);

  // Update database with new token
  const expiresAt = new Date(authResult.validTill * 1000);
  await db.query(
    `UPDATE twizzit_config 
     SET jwt_token = $1, token_expires_at = $2, updated_at = NOW()
     WHERE id = $3`,
    [authResult.token, expiresAt, configId]
  );

  if (process.env.NODE_ENV !== 'test') {
    console.log(`Twizzit token refreshed for config ${configId}, valid until ${expiresAt.toISOString()}`);
  }

  return authResult.token;
}

/**
 * Saves Twizzit configuration with encrypted credentials
 * @param {Object} params - Configuration parameters
 * @param {number} params.organizationId - Twizzit organization ID
 * @param {string} params.organizationName - Organization name (optional)
 * @param {string} params.username - Twizzit API username
 * @param {string} params.password - Twizzit API password (will be encrypted)
 * @param {boolean} params.syncEnabled - Enable automatic sync
 * @param {string} params.autoSyncFrequency - Sync frequency (manual/hourly/daily/weekly)
 * @returns {Promise<number>} Config ID (created or updated)
 * @throws {Error} If encryption or database operation fails
 */
export async function saveConfig({ organizationId, organizationName, username, password, syncEnabled = false, autoSyncFrequency = 'manual' }) {
  validateEncryptionKey();

  if (!organizationId || !username || !password) {
    throw new Error('organizationId, username, and password are required');
  }

  // Encrypt password
  const encryptedPassword = encrypt(password, ENCRYPTION_KEY);

  // Authenticate to validate credentials and get initial token
  const authResult = await authenticate(username, password);
  const expiresAt = new Date(authResult.validTill * 1000);

  // Check if config already exists for this organization
  const existingResult = await db.query(
    'SELECT id FROM twizzit_config WHERE organization_id = $1',
    [organizationId]
  );

  let configId;

  if (existingResult.rows.length > 0) {
    // Update existing config
    configId = existingResult.rows[0].id;
    await db.query(
      `UPDATE twizzit_config 
       SET organization_name = $1, 
           api_username = $2, 
           api_password_encrypted = $3,
           jwt_token = $4,
           token_expires_at = $5,
           sync_enabled = $6,
           auto_sync_frequency = $7,
           updated_at = NOW()
       WHERE id = $8`,
      [organizationName, username, encryptedPassword, authResult.token, expiresAt, syncEnabled, autoSyncFrequency, configId]
    );
  } else {
    // Create new config
    const insertResult = await db.query(
      `INSERT INTO twizzit_config (
        organization_id, organization_name, api_username, api_password_encrypted,
        jwt_token, token_expires_at, sync_enabled, auto_sync_frequency
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [organizationId, organizationName, username, encryptedPassword, authResult.token, expiresAt, syncEnabled, autoSyncFrequency]
    );
    configId = insertResult.rows[0].id;
  }

  return configId;
}

/**
 * Tests connection to Twizzit API with provided credentials (does not save)
 * @param {string} username - Twizzit API username
 * @param {string} password - Twizzit API password
 * @returns {Promise<{success: boolean, organizationId?: number, error?: string}>} Test result
 */
export async function testConnection(username, password) {
  try {
    await authenticate(username, password);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      statusCode: error.statusCode,
    };
  }
}

/**
 * Deletes Twizzit configuration
 * @param {number} configId - Config ID to delete
 * @returns {Promise<boolean>} True if deleted
 */
export async function deleteConfig(configId) {
  const result = await db.query(
    'DELETE FROM twizzit_config WHERE id = $1',
    [configId]
  );
  return result.rowCount > 0;
}

/**
 * Gets Twizzit configuration (without sensitive data)
 * @param {number} organizationId - Twizzit organization ID
 * @returns {Promise<Object|null>} Config object or null if not found
 */
export async function getConfig(organizationId) {
  const result = await db.query(
    `SELECT id, organization_id, organization_name, api_username,
            sync_enabled, auto_sync_frequency, last_sync_at, 
            sync_in_progress, created_at, updated_at
     FROM twizzit_config
     WHERE organization_id = $1`,
    [organizationId]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Gets all Twizzit configurations (without sensitive data)
 * @returns {Promise<Array>} Array of config objects
 */
export async function getAllConfigs() {
  const result = await db.query(
    `SELECT id, organization_id, organization_name, api_username,
            sync_enabled, auto_sync_frequency, last_sync_at, 
            sync_in_progress, created_at, updated_at
     FROM twizzit_config
     ORDER BY organization_name, organization_id`
  );

  return result.rows;
}

/**
 * Updates sync status for a config
 * @param {number} configId - Config ID
 * @param {boolean} inProgress - Whether sync is in progress
 * @param {Date} lastSyncAt - Last sync timestamp (optional)
 * @returns {Promise<void>}
 */
export async function updateSyncStatus(configId, inProgress, lastSyncAt = null) {
  const params = [inProgress, configId];
  let query = 'UPDATE twizzit_config SET sync_in_progress = $1';
  
  if (lastSyncAt) {
    query += ', last_sync_at = $3';
    params.push(lastSyncAt);
  }
  
  query += ' WHERE id = $2';
  
  await db.query(query, params);
}
