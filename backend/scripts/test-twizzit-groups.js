#!/usr/bin/env node
/**
 * Test script to debug Twizzit groups/seasons API calls
 * Usage: TWIZZIT_DEBUG=1 node scripts/test-twizzit-groups.js <credentialId>
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

import TwizzitApiClient from '../src/services/twizzit-api-client.js';
import twizzitAuth from '../src/services/twizzit-auth.js';
import { closePool } from '../src/db.js';

async function testTwizzitGroups() {
  const credentialId = process.argv[2];
  
  if (!credentialId) {
    console.error('Usage: TWIZZIT_DEBUG=1 node scripts/test-twizzit-groups.js <credentialId>');
    process.exit(1);
  }

  try {
    console.log('📋 Loading credentials...');
    const credentials = await twizzitAuth.getCredentials(parseInt(credentialId));
    
    console.log('✅ Credentials loaded:', {
      organizationName: credentials.organizationName,
      apiEndpoint: credentials.apiEndpoint,
      username: credentials.apiUsername
    });

    console.log('\n🔧 Creating API client...');
    const apiClient = new TwizzitApiClient({
      apiEndpoint: credentials.apiEndpoint,
      username: credentials.apiUsername,
      password: credentials.apiPassword,
      organizationName: credentials.organizationName
    });

    console.log('\n🔐 Testing authentication...');
    await apiClient.authenticate();
    console.log('✅ Authentication successful');

    console.log('\n🏢 Getting organizations...');
    const organizations = await apiClient.getOrganizations();
    console.log('✅ Organizations:', organizations.map(o => ({
      id: o.id || o.organization_id,
      name: o.name || o.organization_name
    })));

    const orgId = await apiClient.getDefaultOrganizationId();
    console.log('✅ Default organization ID:', orgId);

    console.log('\n👥 Fetching groups (without season filter)...');
    const groups = await apiClient.getGroups({});
    console.log('✅ Fetched', groups.groups.length, 'groups');
    if (groups.groups.length > 0) {
      console.log('Sample group:', {
        id: groups.groups[0].id,
        name: groups.groups[0].name,
        'short-name': groups.groups[0]['short-name'],
        season: groups.groups[0].season
      });
    } else {
      console.log('⚠️  No groups found. This could mean:');
      console.log('   - Your organization has no teams/groups');
      console.log('   - Your account doesn\'t have access to groups API');
      console.log('   - Groups are season-specific and you need to provide a season ID');
    }

    // Extract seasons
    console.log('\n📅 Extracting seasons from groups...');
    const seasonsMap = new Map();
    groups.groups.forEach(group => {
      if (group.season && group.season.id) {
        const seasonKey = String(group.season.id);
        if (!seasonsMap.has(seasonKey)) {
          seasonsMap.set(seasonKey, {
            id: group.season.id,
            name: group.season.name,
            active: group.season.active
          });
        }
      }
    });
    const seasons = Array.from(seasonsMap.values());
    
    if (seasons.length === 0) {
      console.log('⚠️  No seasons found in groups. This could mean:');
      console.log('   - Groups don\'t have season information attached');
      console.log('   - You need to fetch seasons from a different endpoint');
    } else {
      console.log('✅ Found', seasons.length, 'unique seasons:');
      seasons.forEach(s => console.log('  -', s.name, `(id: ${s.id}, active: ${s.active})`));
    }

    // Test with a season filter if seasons exist
    if (seasons.length > 0) {
      const activeSeason = seasons.find(s => s.active) || seasons[0];
      console.log('\n👥 Fetching groups for season:', activeSeason.name, `(${activeSeason.id})`);
      const seasonGroups = await apiClient.getGroups({ seasonId: String(activeSeason.id) });
      console.log('✅ Fetched', seasonGroups.groups.length, 'groups for this season');
      if (seasonGroups.groups.length > 0) {
        console.log('Sample season group:', {
          id: seasonGroups.groups[0].id,
          name: seasonGroups.groups[0].name,
          'short-name': seasonGroups.groups[0]['short-name'],
          season: seasonGroups.groups[0].season
        });
      }
    }

    console.log('\n✅ All tests passed!');
    
    // Close database connection
    await closePool();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    // Provide specific troubleshooting based on error type
    if (error.message?.includes('Authentication failed') || error.message?.includes('Invalid Twizzit API credentials')) {
      console.error('\n💡 Authentication failed. Check:');
      console.error('   - Username and password are correct');
      console.error('   - Password hasn\'t expired or been changed in Twizzit');
      console.error('   - Credentials have API access enabled');
    } else if (error.message?.includes('Twizzit returned an error page')) {
      console.error('\n💡 Twizzit returned an HTML error page. This usually means:');
      console.error('   - The API endpoint is incorrect');
      console.error('   - Your account doesn\'t have access to the /v2/api/groups endpoint');
      console.error('   - Authentication succeeded but the specific endpoint is unavailable');
      console.error('\n   Try:');
      console.error('   1. Verify your account has API access in Twizzit');
      console.error('   2. Contact Twizzit support to enable groups API access');
      console.error('   3. Check that API endpoint is set to: https://app.twizzit.com');
    } else if (error.message?.includes('No organizations returned')) {
      console.error('\n💡 No organizations found. This means:');
      console.error('   - Your account isn\'t associated with any organizations');
      console.error('   - Or doesn\'t have permission to view organizations');
    }
    
    if (error.response) {
      console.error('\nResponse status:', error.response.status);
      const data = error.response.data;
      if (typeof data === 'string' && data.includes('<!DOCTYPE html>')) {
        console.error('Response: [HTML error page - endpoint may not exist]');
      } else {
        console.error('Response data:', error.response.data);
      }
    }
    console.error('\nStack:', error.stack);
    
    // Close database connection
    await closePool();
    process.exit(1);
  }
}

testTwizzitGroups();
