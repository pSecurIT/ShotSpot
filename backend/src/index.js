import dotenv from 'dotenv';
import validateEnv from './utils/validateEnv.js';
import app from './app.js';

// Load and validate environment variables
dotenv.config();
validateEnv();

// Test database connection before starting server
import db from './db.js';
await db.healthCheck().catch(err => {
  console.error('Failed to connect to database:', err);
  process.exit(1);
});

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});