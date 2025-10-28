const dotenv = require('dotenv');
const path = require('path');
const { Pool } = require('pg');

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '.env.test') });

module.exports = async () => {
  console.log('🧹 GLOBAL SETUP: Starting database cleanup...');
  
  // Create a temporary database connection for setup
  const pool = new Pool({
    user: process.env.DB_USER || 'shotspot_test_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'shotspot_test_db',
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    max: 5,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log('🧹 GLOBAL SETUP: Connected to test database, truncating tables...');
    
    // Truncate all tables in the correct order (child tables first due to foreign keys)
    await pool.query('TRUNCATE TABLE substitutions RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE game_rosters RESTART IDENTITY CASCADE'); 
    await pool.query('TRUNCATE TABLE ball_possessions RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE shots RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE game_events RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE games RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE players RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE teams RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    
    console.log('✅ GLOBAL SETUP: Test database cleaned successfully');
  } catch (error) {
    console.error('❌ GLOBAL SETUP: Error cleaning test database:', error);
    throw error;
  } finally {
    await pool.end();
    console.log('🧹 GLOBAL SETUP: Database connection closed');
  }
};