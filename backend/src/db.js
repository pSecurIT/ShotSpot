import pkg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
let currentFilePath;
try {
  currentFilePath = fileURLToPath(import.meta.url);
} catch (error) {
  // Fallback for test environment
  currentFilePath = __filename;
}
const currentDirPath = dirname(currentFilePath);
dotenv.config({ path: join(currentDirPath, '..', '.env') });

const { Pool } = pkg;

// Log the configuration (without sensitive data)
console.log('Database configuration:', {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  hasPassword: !!process.env.DB_PASSWORD,
  max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS) || 30000,
});

// Validate required database configuration
const requiredDbConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 5432
};

// Validate all required fields are present
Object.entries(requiredDbConfig).forEach(([key, value]) => {
  if (!value) {
    throw new Error(`Missing required database configuration: ${key}`);
  }
});

const pool = new Pool({
  ...requiredDbConfig,
  max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS) || 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

// Error handling
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Test connection on startup
(async () => {
  try {
    const client = await pool.connect();
    console.log('Successfully connected to the database');
    client.release();
  } catch (err) {
    console.error('Error connecting to the database:', err.message);
    console.error('Connection details:', {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
      hasPassword: !!process.env.DB_PASSWORD
    });
  }
})();

const query = async (text, params) => {
  const client = await pool.connect();
  try {
    const start = Date.now();
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (err) {
    console.error('Error executing query', { text, error: err.message });
    throw err;
  } finally {
    client.release();
  }
};

// Database health check function that throws error on failure
export async function dbHealthCheck() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (err) {
    console.error('Database health check failed:', err);
    throw new Error(`Database connection failed: ${err.message}`);
  }
}

// Function to close all database connections
export async function closePool() {
  try {
    await pool.end();
    console.log('Database pool has been closed');
  } catch (err) {
    console.error('Error closing database pool:', err);
    throw err;
  }
}

export default {
  query,
  healthCheck: dbHealthCheck,
  pool, // Exported for testing purposes
  closePool // Export for test cleanup
};