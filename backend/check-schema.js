import db from './src/db.js';

async function checkSchema() {
  try {
    const result = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'players'
      ORDER BY ordinal_position
    `);
    
    console.log('Players table structure:');
    console.table(result.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkSchema();
