import pkg from 'pg';
import dotenv from 'dotenv';
import {
  sanitizeDbError,
  createQueryLogMetadata,
  sanitizeQueryForLogging,
  sanitizeQueryObject
} from './utils/dbSanitizer.js';

// Load environment variables
dotenv.config();

const { Pool } = pkg;

// Construct connection string from individual variables if DATABASE_URL is not provided
const connectionConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
  };

const pool = new Pool({
  ...connectionConfig,
  max: Number(process.env.DB_MAX_CONNECTIONS) || Number(process.env.DB_MAX_CLIENTS) || 20,
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS) || 30000,
  connectionTimeoutMillis: 2000,
});

const query = async (text, params) => {
  const client = await pool.connect();
  const start = Date.now();
  try {
    const res = await client.query(text, params);
    const duration = Date.now() - start;

    // Only log in non-test environments or for slow queries
    // Note: We use sanitized metadata to avoid logging sensitive user data
    if (process.env.NODE_ENV !== 'test' || duration > 100) {
      const sanitizedTextForLogging = sanitizeQueryForLogging(text);
      const sanitizedParamsForLogging = sanitizeQueryObject(params);
      const logMetadata = createQueryLogMetadata(sanitizedTextForLogging, duration, res.rowCount, false);
      console.log('Executed query', { ...logMetadata, params: sanitizedParamsForLogging });
    }
    return res;
  } catch (err) {
    // Log sanitized error information to avoid exposing sensitive data
    const sanitizedError = sanitizeDbError(err);
    console.error('Error executing query', sanitizedError);
    throw err;
  } finally {
    client.release();
  }
};

export async function dbHealthCheck() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (err) {
    // Use sanitized error to avoid exposing sensitive connection details
    const sanitizedError = sanitizeDbError(err);
    console.error('Database health check failed:', sanitizedError);
    throw new Error(`Database connection failed: ${sanitizedError.message}`);
  }
}

export async function closePool() {
  try {
    await pool.end();
  } catch (err) {
    const sanitizedError = sanitizeDbError(err);
    console.error('Error closing DB pool:', sanitizedError);
  }
}

// Re-export sanitizer utilities for use in other modules
export { sanitizeDbError, sanitizeQueryForLogging, sanitizeQueryObject } from './utils/dbSanitizer.js';

export default {
  query,
  healthCheck: dbHealthCheck,
  closePool,
};