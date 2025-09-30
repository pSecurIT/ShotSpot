import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { promisify } from 'util';
import readline from 'readline';

// Set up proper paths for environment file
const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = dirname(scriptPath);
const envPath = path.join(scriptDir, '..', '.env');

// Load environment variables from the correct path
dotenv.config({ path: envPath });

// Verify environment variables are loaded
if (!process.env.DB_USER || !process.env.DB_NAME) {
  console.error('Failed to load environment variables from:', envPath);
  console.error('Please ensure the .env file exists and contains the required variables.');
  process.exit(1);
}
const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get environment variables
const {
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  DB_HOST,
  DB_PORT,
  POSTGRES_PASSWORD
} = process.env;

// Function to prompt for password if not in environment
async function getPostgresPassword() {
  if (POSTGRES_PASSWORD) {
    return POSTGRES_PASSWORD;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const password = await new Promise(resolve => {
    rl.question('Enter PostgreSQL superuser (postgres) password: ', resolve);
  });
  
  rl.close();
  return password;
}



// Extract database configuration from environment
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  name: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT
};

// Verify required configuration
if (!dbConfig.user || !dbConfig.password || !dbConfig.name) {
  console.error('Missing required database configuration');
  process.exit(1);
}

// Create temporary SQL file with the password from environment
const setupSQL = `
-- Terminate existing connections to the database
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${dbConfig.name}'
  AND pid <> pg_backend_pid();

-- Drop and recreate database
DROP DATABASE IF EXISTS ${DB_NAME};

-- Attempt to drop user if exists (ignore error if user owns objects)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    -- Reassign owned objects to postgres user first
    REASSIGN OWNED BY ${DB_USER} TO postgres;
    -- Drop owned objects
    DROP OWNED BY ${DB_USER};
    -- Now drop the role
    DROP USER IF EXISTS ${DB_USER};
  END IF;
END
$$;

-- Drop existing connections and recreate user with new password
DO $$
BEGIN
  -- Terminate existing connections
  PERFORM pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE usename = '${dbConfig.user}';

  -- Recreate user with new password
  DROP USER IF EXISTS ${dbConfig.user};
  CREATE USER ${dbConfig.user} WITH PASSWORD '${dbConfig.password}' LOGIN;
END
$$;

-- Recreate database
DROP DATABASE IF EXISTS ${dbConfig.name};
CREATE DATABASE ${dbConfig.name} WITH OWNER = ${dbConfig.user};

-- Connect to the new database and set up permissions
\\c ${DB_NAME}

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
ALTER USER ${DB_USER} WITH SUPERUSER;

-- Connect to the new database
\\c ${DB_NAME}

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES FOR USER ${DB_USER} IN SCHEMA public 
GRANT ALL ON TABLES TO ${DB_USER};

ALTER DEFAULT PRIVILEGES FOR USER ${DB_USER} IN SCHEMA public 
GRANT ALL ON SEQUENCES TO ${DB_USER};
`;

// Function to execute a SQL file
async function executeSqlFile(file, password) {
  const filePath = path.join(__dirname, file);
  try {
    await fs.access(filePath);
  } catch {
    console.log(`File ${file} does not exist, skipping`);
    return;
  }
  
  // Use environment variable instead of setting it in command
  const options = {
    env: {
      ...process.env,
      PGPASSWORD: password
    }
  };
  const command = `psql -U postgres -d ${DB_NAME} -f "${filePath}"`;
  const { stdout, stderr } = await execPromise(command, options);
  
  if (stderr && !stderr.includes('NOTICE')) {
    console.warn(`Warnings while executing ${file}:`, stderr);
  }
}

async function main() {
  try {
    // Get environment variables
    const postgresPassword = process.env.POSTGRES_PASSWORD;
    const appDbUser = process.env.APP_DB_USER;
    const appDbPassword = process.env.APP_DB_PASSWORD;

    // Validate environment variables
    const missingVars = [];
    if (!postgresPassword) missingVars.push('POSTGRES_PASSWORD');
    if (!appDbUser) missingVars.push('APP_DB_USER');
    if (!appDbPassword) missingVars.push('APP_DB_PASSWORD');

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Validate credential format
    if (typeof postgresPassword !== 'string' || postgresPassword.length === 0) {
      throw new Error('POSTGRES_PASSWORD must be a non-empty string');
    }
    if (typeof appDbPassword !== 'string' || appDbPassword.length === 0) {
      throw new Error('APP_DB_PASSWORD must be a non-empty string');
    }
    if (typeof appDbUser !== 'string' || appDbUser.length === 0) {
      throw new Error('APP_DB_USER must be a non-empty string');
    }
    const tempFile = path.join(__dirname, 'temp-setup.sql');
    
    // Create temporary setup file
    await fs.writeFile(tempFile, setupSQL);

    // Execute the setup SQL
    try {
      const options = {
        env: {
          ...process.env,
          PGPASSWORD: postgresPassword
        }
      };
      const command = `psql -U postgres -f "${tempFile}"`;
      const { stdout, stderr } = await execPromise(command, options);
      if (stderr && !stderr.includes('NOTICE')) {
        console.warn('Database setup warnings:', stderr);
      }
    } finally {
      // Always clean up the temporary file
      try {
        await fs.access(tempFile);
        await fs.unlink(tempFile);
      } catch {
        // File doesn't exist, nothing to clean up
      }
    }

    // Execute schema files in sequence
    const schemaFiles = [
      'schema.sql'  // This is our main schema file
    ];

    for (const file of schemaFiles) {
      await executeSqlFile(file, postgresPassword);
    }

    console.log('Database setup completed successfully');
  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
main();