// Setup file for Game Logic tests - uses separate database  
const dotenv = require('dotenv');
const path = require('path');

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '.env.test') });

// Override database name for Game Logic tests isolation
process.env.DB_NAME = process.env.DB_NAME_GAME_LOGIC || 'shotspot_test_db_game_logic';

console.log('🎮 Game Logic Tests - Database:', process.env.DB_NAME);

// Add cleanup handler for graceful shutdown
process.on('beforeExit', async () => {
  console.log('🎮 Game Logic Tests - Cleaning up before exit...');
});

process.on('SIGTERM', async () => {
  console.log('🎮 Game Logic Tests - Received SIGTERM, cleaning up...');
  process.exit(0);
});