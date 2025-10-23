import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function checkTable() {
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'substitutions'
      )
    `);
    
    console.log('Substitutions table exists:', result.rows[0].exists);
    
    if (!result.rows[0].exists) {
      console.log('\nThe substitutions table does not exist. You need to run the schema migration.');
      console.log('Run: psql -d <database_name> -f src/schema.sql');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkTable();
