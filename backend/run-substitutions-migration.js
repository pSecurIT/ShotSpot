import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from './src/db.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);

async function runMigration() {
  try {
    console.log('Reading substitutions migration file...');
    const migrationPath = join(currentDirPath, 'src', 'migrations', 'add_substitutions.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('Running substitutions migration...');
    await db.query(migrationSQL);
    
    console.log('✅ Substitutions migration completed successfully!');
    
    // Verify the table was created
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'substitutions'
      ORDER BY ordinal_position
    `);
    
    console.log('\nSubstitutions table structure:');
    console.table(result.rows);
    
    // Check indexes
    const indexes = await db.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'substitutions'
    `);
    
    console.log('\nIndexes:');
    console.table(indexes.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
