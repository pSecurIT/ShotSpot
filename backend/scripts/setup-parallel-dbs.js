#!/usr/bin/env node

/**
 * Setup parallel test databases for isolated test execution
 */

import { Client } from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

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
      
      const dbClient = new Client({
        ...superuserConfig,
        database: dbName
      });
      
      try {
        await dbClient.connect();
        
        // Read and execute schema with fail-fast error handling
        const schemaPath = join(__dirname, '..', 'src', 'schema.sql');
        if (!schemaPath) {
          console.error(`❌ Schema path resolved to empty value: ${schemaPath}`);
          process.exit(1);
        }
        
        let schema;
        try {
          schema = readFileSync(schemaPath, 'utf8');
          if (!schema || schema.trim().length === 0) {
            console.error(`❌ Schema file is empty: ${schemaPath}`);
            process.exit(1);
          }
          console.log(`📄 Read schema.sql (${schema.length} bytes)`);
        } catch (err) {
          console.error(`❌ Failed to read schema file at ${schemaPath}:`, err.message);
          console.error(err);
          process.exit(1);
        }

        try {
          // Execute schema; if this fails, stop immediately so tests aren't run against an empty DB
          await dbClient.query(schema);
          console.log(`✅ Executed schema.sql for ${dbName}`);
        } catch (err) {
          console.error(`❌ Failed to apply schema.sql for ${dbName}:`, err.message);
          console.error('Full error:', err);
          process.exit(1);
        }
        
        // Apply all migrations in order with fail-fast error handling
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
          '../src/migrations/add_export_configuration.sql',
          '../src/migrations/add_password_must_change.sql',
          '../src/migrations/add_user_activity_tracking.sql',
          '../src/migrations/add_login_history.sql',
          '../src/migrations/add_seasons.sql',
          '../src/migrations/seed_achievements.sql',
          '../src/migrations/seed_default_report_templates.sql',
          '../src/migrations/add_competition_management.sql'
        ];

        console.log('📦 Applying migrations...');
        for (const migrationFile of migrations) {
          const migrationPath = join(__dirname, migrationFile);
          try {
            const migrationContent = readFileSync(migrationPath, 'utf8');
            if (!migrationContent || migrationContent.trim().length === 0) {
              console.warn(`⚠️  Migration file empty, skipping: ${basename(migrationFile)}`);
              continue;
            }
            await dbClient.query(migrationContent);
            console.log(`✅ Applied migration: ${basename(migrationFile)}`);
          } catch (err) {
            if (err.code === 'ENOENT') {
              console.warn(`⚠️  Migration file not found: ${basename(migrationFile)}, skipping`);
              continue;
            }
            console.error(`❌ Migration failed (${basename(migrationFile)}) for ${dbName}:`, err.message);
            console.error('Full error:', err);
            process.exit(1);
          }
        }
        
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