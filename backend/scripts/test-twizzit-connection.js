/**
 * Test Twizzit API connection
 * Usage: node scripts/test-twizzit-connection.js <credential_id>
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import twizzitAuth from '../src/services/twizzit-auth.js';
import TwizzitApiClient from '../src/services/twizzit-api-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

async function main() {
  const credentialId = process.argv[2];

  if (!credentialId) {
    console.error('Usage: node scripts/test-twizzit-connection.js <credential_id>');
    process.exit(1);
  }

  console.log('🔍 Testing Twizzit API Connection...\n');

  try {
    // Retrieve credentials
    console.log('1️⃣  Retrieving credentials...');
    const credentials = await twizzitAuth.getCredentials(parseInt(credentialId));
    console.log(`   ✅ Found credentials for: ${credentials.organizationName}`);

    // Create API client
    console.log('\n2️⃣  Creating API client...');
    const apiClient = new TwizzitApiClient({
      apiEndpoint: credentials.apiEndpoint,
      username: credentials.apiUsername,
      password: credentials.apiPassword
    });
    console.log(`   ✅ API client configured for: ${credentials.apiEndpoint}`);

    // Test authentication
    console.log('\n3️⃣  Testing authentication...');
    const token = await apiClient.authenticate();
    console.log(`   ✅ Authentication successful! Token received: ${token.substring(0, 20)}...`);

    // Test connection
    console.log('\n4️⃣  Verifying connection...');
    const isConnected = await apiClient.verifyConnection();
    if (isConnected) {
      console.log('   ✅ Connection verified successfully!');
    } else {
      console.log('   ❌ Connection verification failed');
      process.exit(1);
    }

    // Fetch organizations first
    console.log('\n5️⃣  Fetching organizations...');
    try {
      const orgsResponse = await apiClient.client.get('/v2/api/organizations');
      const organizations = Array.isArray(orgsResponse.data) ? orgsResponse.data : [];
      console.log(`   ✅ Found ${organizations.length} organization(s)`);
      organizations.slice(0, 3).forEach((org, index) => {
        console.log(`      ${index + 1}. ${org.name || org.organization_name} (ID: ${org.id || org.organization_id})`);
      });

      // Try fetching teams for first organization
      if (organizations.length > 0) {
        const orgId = organizations[0].id || organizations[0].organization_id;
        console.log(`\n6️⃣  Fetching groups (teams) for organization ${orgId}...`);
        try {
          const groupsResponse = await apiClient.client.get('/v2/api/groups', {
            params: { organization_id: orgId, limit: 5 }
          });
          const groups = Array.isArray(groupsResponse.data) ? groupsResponse.data : [];
          console.log(`   ✅ Found ${groups.length} group(s)`);
          groups.slice(0, 3).forEach((group, index) => {
            console.log(`      ${index + 1}. ${group.name || group.group_name} (ID: ${group.id || group.group_id})`);
          });
        } catch (error) {
          console.log(`   ⚠️  Could not fetch groups: ${error.message}`);
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Could not fetch organizations: ${error.message}`);
    }

    // Update verification timestamp
    console.log('\n7️⃣  Updating verification timestamp...');
    await twizzitAuth.updateVerificationTimestamp(parseInt(credentialId));
    console.log('   ✅ Verification timestamp updated');

    console.log('\n🎉 Connection test completed successfully!\n');
    console.log('Next steps:');
    console.log(`  • Sync teams: POST /api/twizzit/sync/teams/${credentialId}`);
    console.log(`  • Configure auto-sync: PUT /api/twizzit/sync/config/${credentialId}`);
    console.log('  • View documentation: docs/TWIZZIT_INTEGRATION.md');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Connection test failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  • Verify credentials are correct');
    console.error('  • Check API endpoint URL');
    console.error('  • Ensure network connectivity to Twizzit API');
    console.error('  • Verify Twizzit account is active');
    process.exit(1);
  }
}

main();
