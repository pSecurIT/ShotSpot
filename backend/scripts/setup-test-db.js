import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment variables (only if .env.test exists)
const envPath = join(__dirname, '../.env.test');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

async function setupTestDb() {
  // Use environment variables directly (works in CI/CD and local)
  const adminUser = process.env.POSTGRES_USER || 'postgres';
  const adminPassword = process.env.POSTGRES_PASSWORD || 'postgres';
  const dbUser = process.env.DB_USER || 'shotspot_test_user';
  const dbPassword = process.env.DB_PASSWORD || 'test_password';
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || '5432';
  const dbName = process.env.DB_NAME || 'shotspot_test_db';

  console.log('Setting up test database with config:', {
    adminUser,
    dbUser,
    dbHost,
    dbPort,
    dbName,
    hasAdminPassword: !!adminPassword,
    hasDbPassword: !!dbPassword,
    usingSameUser: dbUser === adminUser
  });

  // Connect as postgres superuser to create test database and user
  const adminPool = new pg.Pool({
    user: adminUser,
    password: String(adminPassword), // Ensure password is a string
    host: dbHost,
    port: parseInt(dbPort),
    database: 'postgres'
  });

  try {
    // Terminate any existing connections to the database
    try {
      await adminPool.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = '${dbName}'
          AND pid <> pg_backend_pid();
      `);
      console.log('Terminated existing connections to database');
    } catch (_err) {
      // Database might not exist yet, which is fine
      console.log('No existing connections to terminate');
    }

    // Create test user if it doesn't exist (only if different from admin user)
    if (dbUser !== adminUser) {
      await adminPool.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '${dbUser}') THEN
            CREATE USER ${dbUser} WITH PASSWORD '${dbPassword}';
          END IF;
        END $$;
      `);
      console.log(`Ensured user ${dbUser} exists`);
    } else {
      console.log('Using admin user for database operations (CI/CD mode)');
    }

    // Drop test database if it exists
    await adminPool.query(`
      DROP DATABASE IF EXISTS ${dbName};
    `);
    console.log(`Dropped database ${dbName} if it existed`);

    // Create test database with appropriate owner
    const owner = (dbUser !== adminUser) ? dbUser : adminUser;
    await adminPool.query(`
      CREATE DATABASE ${dbName} OWNER ${owner};
    `);
    console.log(`Created database ${dbName} with owner ${owner}`);

    // Connect to test database (use admin credentials if dbUser is same as admin)
    const testPool = new pg.Pool({
      user: (dbUser === adminUser) ? adminUser : dbUser,
      password: String((dbUser === adminUser) ? adminPassword : dbPassword),
      host: dbHost,
      port: parseInt(dbPort),
      database: dbName
    });

    // Read and execute schema
    const schema = fs.readFileSync(join(__dirname, '../src/schema.sql'), 'utf8');
    await testPool.query(schema);

    // Apply all migrations in order
    const migrations = [
      'add_player_gender.sql',
      'add_timer_fields.sql', 
      'add_game_rosters.sql',
      'add_substitutions.sql',
      'add_possession_tracking.sql',
      'add_enhanced_events.sql',
      'add_match_configuration_columns.sql',
      'add_attacking_side.sql',
      'add_starting_position.sql',
      'add_achievements_system.sql',
      'add_advanced_analytics.sql',
      'add_password_must_change.sql',
      'add_user_activity_tracking.sql',
      'add_login_history.sql',
      'add_export_configuration.sql',
      'seed_default_report_templates.sql',
      'add_seasons.sql',
      'seed_achievements.sql',
      'add_competition_management.sql',
      'add_match_templates.sql',
      'add_twizzit_integration.sql',
      'rename_teams_to_clubs_add_age_group_teams.sql',
      'add_club_jersey_number_constraint.sql',
      'update_timeouts_club_id.sql',
      '20251214_update_ball_possessions_team_to_club.sql',
      '20251214_update_game_rosters_team_to_club.sql',
      '20251214_update_games_team_to_club.sql',
      '20251214_update_players_team_to_club.sql',
      '20251214_update_substitutions_team_to_club.sql',
      '20251214_add_seasons_and_series.sql',
      '20251216_add_trainer_assignments.sql',
      '20251217_add_player_team_link.sql',
      '20251218_add_game_team_links.sql',
      '20251219_add_twizzit_player_registration.sql',
      '20251220_add_game_competition_link.sql',
      '20251221_drop_matches_add_series_to_competitions.sql',
      '20251222_fix_games_status_constraint.sql'
    ];

    for (const migrationFile of migrations) {
      const migrationPath = join(__dirname, '../src/migrations', migrationFile);
      if (fs.existsSync(migrationPath)) {
        try {
          const migration = fs.readFileSync(migrationPath, 'utf8');
          await testPool.query(migration);
          console.log(`Applied migration: ${migrationFile}`);
        } catch (err) {
          console.warn(`Warning: Migration ${migrationFile} failed:`, err.message);
          // Continue with other migrations - some may have already been applied
        }
      } else {
        console.warn(`Migration file not found: ${migrationFile}`);
      }
    }

    // Safety net: ensure trainer_assignments exists even if a migration was skipped
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS trainer_assignments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
        team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
        active_from DATE DEFAULT CURRENT_DATE,
        active_to DATE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT trainer_assignments_active_dates CHECK (active_to IS NULL OR active_to >= active_from)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uniq_trainer_assignment_active
        ON trainer_assignments (user_id, club_id, COALESCE(team_id, -1))
        WHERE is_active = true AND active_to IS NULL;

      CREATE INDEX IF NOT EXISTS idx_trainer_assignments_user ON trainer_assignments(user_id);
      CREATE INDEX IF NOT EXISTS idx_trainer_assignments_club ON trainer_assignments(club_id);
      CREATE INDEX IF NOT EXISTS idx_trainer_assignments_team ON trainer_assignments(team_id);

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'update_trainer_assignments_updated_at'
        ) THEN
          CREATE TRIGGER update_trainer_assignments_updated_at
            BEFORE UPDATE ON trainer_assignments
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END
      $$;
    `);

    // Grant permissions to test user on all tables (if different from admin)
    if (dbUser !== adminUser) {
      await testPool.query(`
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${dbUser};
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${dbUser};
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${dbUser};
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${dbUser};
      `);
      console.log(`Granted all privileges to user ${dbUser}`);
    }

    console.log('Test database setup completed successfully');

    await testPool.end();
  } catch (error) {
    console.error('Error setting up test database:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    process.exit(1);
  } finally {
    await adminPool.end();
  }
}

setupTestDb();
