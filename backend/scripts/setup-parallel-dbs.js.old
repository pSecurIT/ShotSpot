#!/usr/bin/env node

/**
 * Setup parallel test databases for isolated test execution
 */

import { Client } from 'pg';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from './lib/run-migrations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.test') });

const superuserConfig = {
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: 'postgres' // Connect to default postgres database
};

const testUser = process.env.DB_USER || 'postgres';
const testPassword = process.env.DB_PASSWORD || 'postgres';

const databases = [
  process.env.DB_NAME || 'shotspot_test_db',
  process.env.DB_NAME_CORE_API || 'shotspot_test_db_core_api',
  process.env.DB_NAME_GAME_LOGIC || 'shotspot_test_db_game_logic'
];

async function setupParallelDatabases() {
  const client = new Client(superuserConfig);
  
  try {
    await client.connect();
    console.log('🔌 Connected to PostgreSQL as superuser');

    // Create test user if not exists and different from superuser
    if (testUser !== superuserConfig.user) {
      try {
        await client.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${testUser}') THEN
              CREATE ROLE ${testUser} LOGIN PASSWORD '${testPassword}';
            END IF;
          END
          $$;
        `);
        console.log(`✅ Test user '${testUser}' ready`);
      } catch (_error) {
        console.log(`ℹ️  User '${testUser}' already exists`);
      }
    } else {
      console.log(`ℹ️  Using superuser '${testUser}' as test user (CI mode)`);
    }

    // Create and setup each database
    for (const dbName of databases) {
      console.log(`\n🗄️  Setting up database: ${dbName}`);
      
      // Drop database if exists (for clean slate)
      try {
        await client.query(`DROP DATABASE IF EXISTS ${dbName}`);
        console.log(`🗑️  Dropped existing database: ${dbName}`);
      } catch (_error) {
        console.log(`ℹ️  No existing database to drop: ${dbName}`);
      }

      // Create database with appropriate owner
      const owner = (testUser !== superuserConfig.user) ? testUser : superuserConfig.user;
      await client.query(`CREATE DATABASE ${dbName} OWNER ${owner}`);
      console.log(`📦 Created database: ${dbName} with owner: ${owner}`);
      
      // Grant permissions (only if different user)
      if (testUser !== superuserConfig.user) {
        await client.query(`GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${testUser}`);
        console.log(`🔑 Granted privileges to ${testUser} on ${dbName}`);
      }
    }

    // Setup schema for each database
    for (const dbName of databases) {
      console.log(`\n🏗️  Setting up schema for: ${dbName}`);
      
      // Build connection string for migrations
      const connectionUser = (testUser !== superuserConfig.user) ? testUser : superuserConfig.user;
      const connectionPassword = (testUser !== superuserConfig.user) ? testPassword : superuserConfig.password;
      const connectionString = `postgresql://${connectionUser}:${connectionPassword}@${superuserConfig.host}:${superuserConfig.port}/${dbName}`;

      // Apply migrations using shared migration runner
      await runMigrations({ 
        connectionString,
        logger: {
          info: (msg) => console.log(msg),
          error: (msg) => console.error(msg)
        }
      });

      // Connect to database for post-migration setup
      const dbClient = new Client({
        ...superuserConfig,
        database: dbName
      });
      
      try {
        await dbClient.connect();

        // Safety net: ensure trainer_assignments exists even if a migration was skipped
        await dbClient.query(`
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
        
        // Sanity check: ensure core tables exist after schema/migrations
        try {
          const sanityCheck = await dbClient.query('SELECT to_regclass(\'public.users\') AS users_exists');
          if (!sanityCheck.rows[0].users_exists) {
            console.error(`❌ Sanity check failed: table public.users not found after schema/migrations for ${dbName}`);
            process.exit(1);
          }
          console.log(`✅ Sanity check passed: core tables exist in ${dbName}`);
        } catch (err) {
          console.error(`❌ Sanity check failed for ${dbName}:`, err.message);
          process.exit(1);
        }
        
        // Grant additional permissions on tables and sequences (only if different user)
        if (testUser !== superuserConfig.user) {
          await dbClient.query(`GRANT ALL ON ALL TABLES IN SCHEMA public TO ${testUser}`);
          await dbClient.query(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${testUser}`);
          await dbClient.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${testUser}`);
          await dbClient.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${testUser}`);
          
          // Change ownership of all tables and sequences to test user
          const tablesResult = await dbClient.query(`
            SELECT tablename FROM pg_tables WHERE schemaname = 'public'
          `);
          for (const row of tablesResult.rows) {
            await dbClient.query(`ALTER TABLE ${row.tablename} OWNER TO ${testUser}`);
          }
          
          const sequencesResult = await dbClient.query(`
            SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'
          `);
          for (const row of sequencesResult.rows) {
            await dbClient.query(`ALTER SEQUENCE ${row.sequence_name} OWNER TO ${testUser}`);
          }
          
          console.log(`🔑 Set ownership and permissions for ${testUser}`);
        } else {
          console.log('ℹ️  Skipping permission grants (using superuser)');
        }
        
        // Verify schema was created successfully by listing tables
        try {
          const tablesResult = await dbClient.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public' 
            ORDER BY tablename
          `);
          
          if (tablesResult.rows.length === 0) {
            console.error(`❌ No tables found in ${dbName} after schema setup!`);
            process.exit(1);
          }
          
          console.log(`📊 Verified ${tablesResult.rows.length} tables in ${dbName}:`);
          tablesResult.rows.forEach(row => console.log(`   - ${row.tablename}`));
        } catch (err) {
          console.error(`❌ Failed to verify tables in ${dbName}:`, err.message);
          process.exit(1);
        }
        
        console.log(`✅ Schema setup complete for: ${dbName}`);
      } finally {
        await dbClient.end();
      }
    }

    console.log('\n🎉 All parallel test databases setup complete!');
    console.log('\nDatabases created:');
    databases.forEach(db => console.log(`  📚 ${db}`));
    
  } catch (error) {
    console.error('❌ Error setting up parallel databases:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run setup
setupParallelDatabases();
