import db from './src/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const migrationPath = path.join(__dirname, 'src', 'migrations', 'add_possession_tracking.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing migration...');
    await db.query(migrationSQL);

    console.log('✅ Possession tracking migration completed successfully!');
    
    // Verify the table was created
    console.log('\nVerifying ball_possessions table...');
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'ball_possessions'
      ORDER BY ordinal_position;
    `);

    if (result.rows.length > 0) {
      console.log('\nColumns in ball_possessions table:');
      console.table(result.rows);
    } else {
      console.log('⚠️  Warning: ball_possessions table not found after migration');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error running migration:', error);
    process.exit(1);
  }
}

runMigration();
