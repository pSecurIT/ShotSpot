import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment variables
dotenv.config({ path: join(__dirname, '../.env.test') });

async function setupTestDb() {
  // Connect as postgres superuser to create test database and user
  const adminPool = new pg.Pool({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: 'localhost',
    port: 5432,
    database: 'postgres'
  });

  try {
    // Create test user if it doesn't exist
    await adminPool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '${process.env.DB_USER}') THEN
          CREATE USER ${process.env.DB_USER} WITH PASSWORD '${process.env.DB_PASSWORD}';
        END IF;
      END $$;
    `);

    // Drop test database if it exists
    await adminPool.query(`
      DROP DATABASE IF EXISTS ${process.env.DB_NAME};
    `);

    // Create test database
    await adminPool.query(`
      CREATE DATABASE ${process.env.DB_NAME} OWNER ${process.env.DB_USER};
    `);

    // Connect to test database
    const testPool = new pg.Pool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME
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