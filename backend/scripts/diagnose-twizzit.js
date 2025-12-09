/**
 * Diagnose Twizzit API connectivity issues
 * Usage: node scripts/diagnose-twizzit.js <credential_id>
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import twizzitAuth from '../src/services/twizzit-auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

function testUrl(url) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'GET',
      timeout: 5000,
      rejectUnauthorized: false // For testing purposes
    };

    const req = client.request(options, (res) => {
      resolve({
        success: true,
        statusCode: res.statusCode,
        headers: res.headers
      });
    });

    req.on('error', (error) => {
      resolve({
        success: false,
        error: error.message,
        code: error.code
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Request timeout'
      });
    });

    req.end();
  });
}

async function main() {
  const credentialId = process.argv[2];

  if (!credentialId) {
    console.error('Usage: node scripts/diagnose-twizzit.js <credential_id>');
    process.exit(1);
  }

  console.log('🔍 Twizzit API Connectivity Diagnostics\n');

  try {
    // Get credentials
    console.log('1️⃣  Retrieving stored credentials...');
    const credentials = await twizzitAuth.getCredentials(parseInt(credentialId));
    console.log(`   Organization: ${credentials.organizationName}`);
    console.log(`   Username: ${credentials.apiUsername}`);
    console.log(`   API Endpoint: ${credentials.apiEndpoint}\n`);

    // Parse endpoint
    const urlObj = new URL(credentials.apiEndpoint);
    console.log('2️⃣  Endpoint details:');
    console.log(`   Protocol: ${urlObj.protocol}`);
    console.log(`   Hostname: ${urlObj.hostname}`);
    console.log(`   Port: ${urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80)}`);
    console.log(`   Path: ${urlObj.pathname}\n`);

    // Test base URL connectivity
    console.log('3️⃣  Testing base URL connectivity...');
    const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
    const baseResult = await testUrl(baseUrl);
    if (baseResult.success) {
      console.log(`   ✅ Connected to ${urlObj.hostname}`);
      console.log(`   Status: ${baseResult.statusCode}`);
      if (baseResult.headers.server) {
        console.log(`   Server: ${baseResult.headers.server}`);
      }
    } else {
      console.log(`   ❌ Failed to connect: ${baseResult.error}`);
      if (baseResult.code) {
        console.log(`   Error code: ${baseResult.code}`);
      }
    }
    console.log();

    // Test health endpoint
    console.log('4️⃣  Testing health endpoint...');
    const healthUrl = `${credentials.apiEndpoint}/health`;
    const healthResult = await testUrl(healthUrl);
    if (healthResult.success) {
      console.log('   ✅ Health endpoint accessible');
      console.log(`   Status: ${healthResult.statusCode}`);
    } else {
      console.log(`   ❌ Health endpoint failed: ${healthResult.error}`);
    }
    console.log();

    // Test auth endpoint
    console.log('5️⃣  Testing auth endpoint...');
    const authUrl = `${credentials.apiEndpoint}/auth/login`;
    const authResult = await testUrl(authUrl);
    if (authResult.success) {
      console.log('   ✅ Auth endpoint accessible');
      console.log(`   Status: ${authResult.statusCode}`);
    } else {
      console.log(`   ❌ Auth endpoint failed: ${authResult.error}`);
    }
    console.log();

    // Common alternatives
    console.log('6️⃣  Testing common API endpoint variations...');
    const alternatives = [
      'https://api.twizzit.com',
      'https://twizzit.com/api',
      'https://www.twizzit.com/api',
      'https://api.twizzit.be/v1',
      'https://api.korfbal.be/v1'
    ];

    for (const alt of alternatives) {
      const result = await testUrl(alt);
      if (result.success) {
        console.log(`   ✅ ${alt} - Status: ${result.statusCode}`);
      } else {
        console.log(`   ❌ ${alt} - ${result.error}`);
      }
    }
    console.log();

    console.log('📝 Recommendations:');
    console.log('   1. Verify the correct API endpoint URL with Twizzit support');
    console.log('   2. Check if your IP needs to be whitelisted');
    console.log('   3. Confirm the service account has API access enabled');
    console.log('   4. Test from a different network if behind corporate firewall\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error.message);
    process.exit(1);
  }
}

main();
