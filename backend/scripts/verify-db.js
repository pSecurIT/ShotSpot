import pkg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables - root first, then backend overrides
dotenv.config({ path: join(__dirname, '..', '..', '.env') });
dotenv.config({ path: join(__dirname, '..', '.env'), override: true });

async function verifyConnection() {
  const config = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT) || 5432
  };

  console.log('Testing connection with config:', {
    ...config,
    password: config.password ? '(set)' : '(not set)'
  });

  const pool = new Pool(config);

  try {
    const client = await pool.connect();
    console.log('Successfully connected to database!');
    
    // Test permissions
    await client.query('CREATE TABLE _test_ (id int); DROP TABLE _test_;');
    console.log('Successfully tested write permissions');

    client.release();
    await pool.end();
    
    return true;
  } catch (err) {
    console.error('Failed to connect to database:', err.message);
    if (err.code === '28P01') {
      console.error('This is a password authentication error. Please check:');
      console.error('1. The DB_PASSWORD in your .env file matches what was set during setup');
      console.error('2. The database user exists and has the correct password');
      console.error('3. The pg_hba.conf file is configured to allow password authentication');
    }
    return false;
  }
}

// Run verification if this file is run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyConnection().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export default verifyConnection;