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
    
    // Get list of tables that exist
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `;
    const tablesResult = await pool.query(tableQuery);
    const existingTables = tablesResult.rows.map(row => row.table_name);
    
    // Define tables to truncate in the correct order (child tables first due to foreign keys)
    const tablesToTruncate = [
      'substitutions', 'game_rosters', 'ball_possessions', 
      'shots', 'game_events', 'players', 'games', 'teams', 'users'
    ];
    
    // Only truncate tables that exist
    for (const table of tablesToTruncate) {
      if (existingTables.includes(table)) {
        await pool.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
        console.log(`🧹 GLOBAL SETUP: Truncated ${table}`);
      } else {
        console.log(`⚠️  GLOBAL SETUP: Table ${table} does not exist, skipping`);
      }
    }
    
    console.log('✅ GLOBAL SETUP: Test database cleaned successfully');
  } catch (error) {
    console.error('❌ GLOBAL SETUP: Error cleaning test database:', error);
    throw error;
  } finally {
    await pool.end();
    console.log('🧹 GLOBAL SETUP: Database connection closed');
  }
};