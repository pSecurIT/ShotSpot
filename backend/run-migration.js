import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from './src/db.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const migrationPath = join(currentDirPath, 'src', 'migrations', 'add_game_rosters.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('Running migration...');
    await db.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the table was created
    const result = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'game_rosters'
      ORDER BY ordinal_position
    `);
    
    console.log('\nTable structure:');
    console.table(result.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
