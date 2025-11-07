// Setup file for Core API tests - uses separate database
const dotenv = require('dotenv');
const path = require('path');

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '.env.test') });

// Override database name for Core API tests isolation
process.env.DB_NAME = process.env.DB_NAME_CORE_API || 'shotspot_test_db_core_api';

console.log('🔧 Core API Tests - Database:', process.env.DB_NAME);

// Add cleanup handler for graceful shutdown
process.on('beforeExit', async () => {
  console.log('🔧 Core API Tests - Cleaning up before exit...');
});

process.on('SIGTERM', async () => {
  console.log('🔧 Core API Tests - Received SIGTERM, cleaning up...');
  process.exit(0);
});