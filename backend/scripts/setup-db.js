import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import readline from 'readline';

dotenv.config();
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

// Create temporary SQL file with the password from environment
const setupSQL = `
-- Terminate existing connections to the database
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${DB_NAME}'
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

-- Create new user and database
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
CREATE DATABASE ${DB_NAME} WITH OWNER = ${DB_USER};

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
  
  console.log(`Executing ${file}...`);
  // Use environment variable instead of setting it in command
  const options = {
    env: {
      ...process.env,
      PGPASSWORD: password
    }
  };
  const command = `psql -U postgres -d ${DB_NAME} -f "${filePath}"`;
  const { stdout, stderr } = await execPromise(command, options);
  
  if (stderr) {
    console.warn(`Warnings while executing ${file}:`, stderr);
  }
  console.log(`Successfully executed ${file}:`, stdout);
}

async function main() {
  try {
    // Get postgres password once
    const postgresPassword = await getPostgresPassword();
    const tempFile = path.join(__dirname, 'temp-setup.sql');
    
    // Create temporary setup file
    await fs.writeFile(tempFile, setupSQL);

    // Execute the setup SQL
    console.log('Setting up database...');
    try {
      const options = {
        env: {
          ...process.env,
          PGPASSWORD: postgresPassword
        }
      };
      const command = `psql -U postgres -f "${tempFile}"`;
      const { stdout, stderr } = await execPromise(command, options);
      if (stderr) {
        console.warn('Database setup warnings:', stderr);
      }
      console.log('Database setup complete:', stdout);
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