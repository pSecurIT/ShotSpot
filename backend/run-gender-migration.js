import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from './src/db.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);

async function runMigration() {
  try {
    console.log('Reading gender migration file...');
    const migrationPath = join(currentDirPath, 'src', 'migrations', 'add_player_gender.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('Running migration...');
    await db.query(migrationSQL);
    
    console.log('✅ Gender migration completed successfully!');
    
    // Verify the column was added
    const result = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'players'
      ORDER BY ordinal_position
    `);
    
    console.log('\nPlayers table structure:');
    console.table(result.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
