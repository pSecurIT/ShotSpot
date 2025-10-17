import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment variables (only if .env.test exists)
const envPath = join(__dirname, '../.env.test');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

async function setupTestDb() {
  // Use environment variables directly (works in CI/CD and local)
  const adminUser = process.env.POSTGRES_USER || 'postgres';
  const adminPassword = process.env.POSTGRES_PASSWORD || 'postgres';
  const dbUser = process.env.DB_USER || 'shotspot_test_user';
  const dbPassword = process.env.DB_PASSWORD || 'test_password';
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || '5432';
  const dbName = process.env.DB_NAME || 'shotspot_test_db';

  // Connect as postgres superuser to create test database and user
  const adminPool = new pg.Pool({
    user: adminUser,
    password: String(adminPassword), // Ensure password is a string
    host: dbHost,
    port: parseInt(dbPort),
    database: 'postgres'
  });

  try {
    // Create test user if it doesn't exist
    await adminPool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '${dbUser}') THEN
          CREATE USER ${dbUser} WITH PASSWORD '${dbPassword}';
        END IF;
      END $$;
    `);

    // Drop test database if it exists
    await adminPool.query(`
      DROP DATABASE IF EXISTS ${dbName};
    `);

    // Create test database
    await adminPool.query(`
      CREATE DATABASE ${dbName} OWNER ${dbUser};
    `);

    // Connect to test database
    const testPool = new pg.Pool({
      user: dbUser,
      password: String(dbPassword), // Ensure password is a string
      host: dbHost,
      port: parseInt(dbPort),
      database: dbName
    });

    // Read and execute schema
    const schema = fs.readFileSync(join(__dirname, '../src/schema.sql'), 'utf8');
    await testPool.query(schema);

    console.log('Test database setup completed successfully');

    await testPool.end();
  } catch (error) {
    console.error('Error setting up test database:', error);
    process.exit(1);
  } finally {
    await adminPool.end();
  }
}

setupTestDb();