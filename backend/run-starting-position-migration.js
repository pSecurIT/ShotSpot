import db from './src/db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const migrationPath = path.join(__dirname, 'src', 'migrations', 'add_starting_position.sql');
    const sql = await fs.readFile(migrationPath, 'utf8');
    
    console.log('Executing migration...');
    await db.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('\nVerifying column was added...');
    
    // Verify the column exists
    const result = await db.query(`
      SELECT 
        column_name, 
        data_type, 
        column_default,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'game_rosters' 
      AND column_name = 'starting_position'
    `);
    
    if (result.rows.length > 0) {
      console.log('\nColumn details:');
      console.table(result.rows);
    } else {
      console.log('⚠️  Column not found!');
    }
    
    await db.closePool();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await db.closePool();
    process.exit(1);
  }
}

runMigration();
