/**
 * Update Twizzit API endpoint for existing credentials
 * Usage: node scripts/update-twizzit-endpoint.js <credential_id> <new_endpoint>
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from '../src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

async function main() {
  const credentialId = process.argv[2];
  const newEndpoint = process.argv[3] || 'https://app.twizzit.com';

  if (!credentialId) {
    console.error('Usage: node scripts/update-twizzit-endpoint.js <credential_id> [new_endpoint]');
    console.error('Example: node scripts/update-twizzit-endpoint.js 1 https://app.twizzit.com');
    process.exit(1);
  }

  console.log('🔄 Updating Twizzit API Endpoint...\n');

  try {
    // Update the endpoint
    console.log(`📝 Updating credential ${credentialId}...`);
    const result = await db.query(
      `UPDATE twizzit_credentials 
       SET api_endpoint = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND is_active = true
       RETURNING id, organization_name, api_endpoint`,
      [newEndpoint, parseInt(credentialId)]
    );

    if (result.rows.length === 0) {
      console.error(`❌ No active credential found with ID ${credentialId}`);
      process.exit(1);
    }

    const updated = result.rows[0];
    console.log('✅ Endpoint updated successfully!');
    console.log('\nCredential Details:');
    console.log(`  ID: ${updated.id}`);
    console.log(`  Organization: ${updated.organization_name}`);
    console.log(`  New Endpoint: ${updated.api_endpoint}`);

  } catch (error) {
    console.error('\n❌ Update failed:', error.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

main();
