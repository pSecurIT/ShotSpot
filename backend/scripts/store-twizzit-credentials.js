/**
 * Store Twizzit API credentials
 * Usage: node scripts/store-twizzit-credentials.js [organization] [username] [password] [endpoint]
 * 
 * Interactive mode: node scripts/store-twizzit-credentials.js
 * Command line mode: node scripts/store-twizzit-credentials.js "KCOV v.z.w." "svc_ShotSpot" "password123"
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';
import twizzitAuth from '../src/services/twizzit-auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

function question(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  console.log('🔐 Twizzit API Credential Setup\n');
  console.log('This script will securely store your Twizzit API credentials.');
  console.log('The password will be encrypted using AES-256-CBC.\n');

  // Verify encryption key is set
  if (!process.env.TWIZZIT_ENCRYPTION_KEY) {
    console.error('❌ Error: TWIZZIT_ENCRYPTION_KEY not found in .env file');
    console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    process.exit(1);
  }

  try {
    let organizationName, apiUsername, apiPassword, apiEndpoint;

    // Check if arguments provided via command line
    if (process.argv.length >= 5) {
      console.log('📋 Using command-line arguments...\n');
      organizationName = process.argv[2];
      apiUsername = process.argv[3];
      apiPassword = process.argv[4];
      apiEndpoint = process.argv[5] || 'https://api.twizzit.com/v1';
    } else {
      // Interactive mode
      organizationName = await question('Organization Name (e.g., "Belgian Korfball Federation"): ');
      apiUsername = await question('Twizzit API Username: ');
      apiPassword = await question('Twizzit API Password: ');
      const endpoint = await question('API Endpoint (press Enter for default https://api.twizzit.com/v1): ');
      apiEndpoint = endpoint.trim() || 'https://api.twizzit.com/v1';
    }

    console.log('\n🔄 Storing credentials...');

    const result = await twizzitAuth.storeCredentials({
      organizationName: organizationName.trim(),
      apiUsername: apiUsername.trim(),
      apiPassword: apiPassword.trim(),
      apiEndpoint: apiEndpoint.trim()
    });

    console.log('\n✅ Credentials stored successfully!');
    console.log('\n📋 Credential Details:');
    console.log(`  ID: ${result.id}`);
    console.log(`  Organization: ${result.organization_name}`);
    console.log(`  Username: ${result.api_username}`);
    console.log(`  API Endpoint: ${result.api_endpoint}`);
    console.log(`  Created: ${result.created_at}`);

    console.log('\n📝 Next Steps:');
    console.log('  1. Test connection:');
    console.log(`     npm run twizzit:test-connection ${result.id}`);
    console.log('  2. Or via API when backend is running:');
    console.log(`     POST /api/twizzit/verify/${result.id}`);
    console.log('  3. Sync teams:');
    console.log(`     POST /api/twizzit/sync/teams/${result.id}`);

    console.log(`\n💾 Your credential ID is: ${result.id}`);
    console.log('    Save this ID - you\'ll need it for all Twizzit operations!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error storing credentials:', error.message);
    if (error.stack && process.env.NODE_ENV !== 'production') {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
