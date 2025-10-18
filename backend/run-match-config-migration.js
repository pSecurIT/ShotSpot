import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const migrationPath = path.join(__dirname, 'src', 'migrations', 'add_match_configuration_columns.sql');
    const sql = await fs.readFile(migrationPath, 'utf8');
    
    console.log('Executing migration...');
    await db.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('\nVerifying columns were added...');
    
    // Verify the columns exist
    const result = await db.query(`
      SELECT 
        column_name, 
        data_type, 
        column_default,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'games' 
      AND column_name IN (
        'home_attacking_side', 
        'number_of_periods', 
        'current_period',
        'period_duration',
        'time_remaining',
        'timer_state',
        'timer_started_at',
        'timer_paused_at'
      )
      ORDER BY column_name
    `);
    
    console.log('\nColumns in games table:');
    console.table(result.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
