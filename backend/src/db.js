import pkg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
let currentFilePath;
try {
  currentFilePath = fileURLToPath(import.meta.url);
} catch (_error) {
  // Fallback for test environment
  currentFilePath = __filename;
}
const currentDirPath = dirname(currentFilePath);
dotenv.config({ path: join(currentDirPath, '..', '.env') });

const { Pool } = pkg;

// Log the configuration (without sensitive data) - silent in test environment
if (process.env.NODE_ENV !== 'test') {
  console.log('Database configuration:', {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    hasPassword: !!process.env.DB_PASSWORD,
    max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS) || 30000,
  });
}

// Database configuration with explicit fallbacks (never default to "root")
const requiredDbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost', 
  database: process.env.DB_NAME || (process.env.NODE_ENV === 'test' ? 'shotspot_test_db' : 'shotspot_db'),
  password: process.env.DB_PASSWORD || (process.env.NODE_ENV === 'test' ? 'postgres' : ''),
  port: parseInt(process.env.DB_PORT) || 5432
};

// Validate all required fields are present
Object.entries(requiredDbConfig).forEach(([key, value]) => {
  if (!value && key !== 'password') { // Password can be empty in some setups
    throw new Error(`Missing required database configuration: ${key}. Current value: "${value}"`);
  }
});

// Determine SSL configuration
let sslConfig;
if (process.env.DB_SSL === 'false' || process.env.DB_SSL === '0') {
  // Explicitly disabled
  sslConfig = false;
} else if (process.env.NODE_ENV === 'production') {
  // Production default: require SSL with cert validation
  sslConfig = { rejectUnauthorized: true };
} else {
  // Development/test: no SSL
  sslConfig = false;
}

const pool = new Pool({
  ...requiredDbConfig,
  // Optimize connection pool for test environment
  max: process.env.NODE_ENV === 'test' ? 5 : (parseInt(process.env.DB_MAX_CONNECTIONS) || 20),
  idleTimeoutMillis: process.env.NODE_ENV === 'test' ? 1000 : (parseInt(process.env.DB_IDLE_TIMEOUT_MS) || 30000),
  connectionTimeoutMillis: process.env.NODE_ENV === 'test' ? 1000 : 2000,
  acquireTimeoutMillis: process.env.NODE_ENV === 'test' ? 1000 : 30000,
  ssl: sslConfig
});

// Error handling
pool.on('error', (err, _client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Test connection on startup - silent in test environment
(async () => {
  try {
    const client = await pool.connect();
    if (process.env.NODE_ENV !== 'test') {
      console.log('Successfully connected to the database');
    }
    client.release();
  } catch (err) {
    console.error('Error connecting to the database:', err.message);
    if (process.env.NODE_ENV !== 'test') {
      console.error('Connection details:', {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        hasPassword: !!process.env.DB_PASSWORD
      });
    }
  }
})();

const query = async (text, params) => {
  const client = await pool.connect();
  try {
    const start = Date.now();
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    
    // Only log in non-test environments or for slow queries
    // Note: We don't log the query text to avoid logging sensitive user data
    if (process.env.NODE_ENV !== 'test' || duration > 100) {
      console.log('Executed query', { duration, rows: res.rowCount });
    }
    return res;
  } catch (err) {
    // Log error without exposing full query text to avoid logging sensitive data
    console.error('Error executing query', { error: err.message, code: err.code });
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