import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { promisify } from 'util';

// Set up proper paths for environment files
const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = dirname(scriptPath);
const rootEnvPath = path.join(scriptDir, '..', '..', '.env');
const backendEnvPath = path.join(scriptDir, '..', '.env');

// Load environment variables - root first, then backend overrides
dotenv.config({ path: rootEnvPath });
dotenv.config({ path: backendEnvPath, override: true });

// Verify environment variables are loaded
if (!process.env.DB_USER || !process.env.DB_NAME) {
  console.error('Failed to load environment variables from:');
  console.error('  Root:', rootEnvPath);
  console.error('  Backend:', backendEnvPath);
  console.error('Please ensure the .env files exist and contain the required variables.');
  process.exit(1);
}
const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get environment variables
const {
  DB_USER,
  DB_NAME
} = process.env;

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
  const { stderr } = await execPromise(command, options);
  
  if (stderr && !stderr.includes('NOTICE')) {
    console.warn(`Warnings while executing ${file}:`, stderr);
  }
}

async function main() {
  try {
    // Get environment variables
    const postgresPassword = process.env.POSTGRES_PASSWORD;
    const appDbUser = dbConfig.user; // Use DB_USER from dbConfig
    const appDbPassword = dbConfig.password; // Use DB_PASSWORD from dbConfig

    // Validate environment variables
    const missingVars = [];
    if (!postgresPassword) missingVars.push('POSTGRES_PASSWORD');
    if (!appDbUser) missingVars.push('DB_USER');
    if (!appDbPassword) missingVars.push('DB_PASSWORD');

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Validate credential format
    if (typeof postgresPassword !== 'string' || postgresPassword.length === 0) {
      throw new Error('POSTGRES_PASSWORD must be a non-empty string');
    }
    if (typeof appDbPassword !== 'string' || appDbPassword.length === 0) {
      throw new Error('DB_PASSWORD must be a non-empty string');
    }
    if (typeof appDbUser !== 'string' || appDbUser.length === 0) {
      throw new Error('DB_USER must be a non-empty string');
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
      const { stderr } = await execPromise(command, options);
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
      '../src/schema.sql'  // Use the complete schema file from src/
    ];

    for (const file of schemaFiles) {
      await executeSqlFile(file, postgresPassword);
    }

    // Apply all migrations in order
    const migrations = [
      '../src/migrations/add_player_gender.sql',
      '../src/migrations/add_timer_fields.sql', 
      '../src/migrations/add_game_rosters.sql',
      '../src/migrations/add_substitutions.sql',
      '../src/migrations/add_possession_tracking.sql',
      '../src/migrations/add_enhanced_events.sql',
      '../src/migrations/add_match_configuration_columns.sql',
      '../src/migrations/add_attacking_side.sql',
      '../src/migrations/add_starting_position.sql',
      '../src/migrations/add_achievements_system.sql',
      '../src/migrations/add_advanced_analytics.sql',
      '../src/migrations/seed_achievements.sql',
      '../src/migrations/add_password_must_change.sql',
      '../src/migrations/add_user_activity_tracking.sql',
      '../src/migrations/add_login_history.sql',
      '../src/migrations/add_export_configuration.sql',
      '../src/migrations/seed_default_report_templates.sql',
      '../src/migrations/add_seasons.sql',
      '../src/migrations/add_competition_management.sql',
      '../src/migrations/add_match_templates.sql',
      '../src/migrations/add_twizzit_integration.sql',
      '../src/migrations/rename_teams_to_clubs_add_age_group_teams.sql',
      '../src/migrations/add_club_jersey_number_constraint.sql',
      '../src/migrations/update_timeouts_club_id.sql',
      '../src/migrations/20251214_update_ball_possessions_team_to_club.sql',
      '../src/migrations/20251214_update_game_rosters_team_to_club.sql',
      '../src/migrations/20251214_update_games_team_to_club.sql',
      '../src/migrations/20251214_update_players_team_to_club.sql',
      '../src/migrations/20251214_update_substitutions_team_to_club.sql',
      '../src/migrations/20251214_add_seasons_and_series.sql',
      '../src/migrations/20251216_add_trainer_assignments.sql',
      '../src/migrations/20251217_add_player_team_link.sql',
      '../src/migrations/20251218_add_game_team_links.sql',
      '../src/migrations/20251219_add_twizzit_player_registration.sql',
      '../src/migrations/20251220_add_game_competition_link.sql',
      '../src/migrations/20251221_drop_matches_add_series_to_competitions.sql',
      '../src/migrations/20251222_fix_games_status_constraint.sql'
    ];

    console.log('Applying database migrations...');
    for (const migrationFile of migrations) {
      try {
        await executeSqlFile(migrationFile, postgresPassword);
        console.log(`Applied migration: ${path.basename(migrationFile)}`);
      } catch (err) {
        console.warn(`Warning: Migration ${path.basename(migrationFile)} failed:`, err.message);
        // Continue with other migrations - some may have already been applied
      }
    }

    console.log('Database setup completed successfully');
  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
main();