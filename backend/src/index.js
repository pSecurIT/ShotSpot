import dotenv from 'dotenv';
import validateEnv from './utils/validateEnv.js';
import app from './app.js';

// Load and validate environment variables
dotenv.config();
validateEnv();

// Test database connection before starting server
import db from './db.js';

try {
  await db.healthCheck();
  console.log('✓ Database connection established');
} catch (err) {
  console.error('✗ Failed to connect to database:', err.message);
  console.error('  Connection details:', {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'not set'
  });
  console.error('  Please check your database configuration and ensure PostgreSQL is running.');
  process.exit(1);
}

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});