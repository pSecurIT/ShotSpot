/**
 * Simple test of Twizzit authentication without full client
 */

import dotenv from 'dotenv';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function testAuth() {
  console.log('Testing Twizzit Authentication...\n');
  
  const endpoint = 'https://app.twizzit.com';
  const username = 'svc_ShotSpot';
  const password = 'pTz50GJS9HbzhUixAhoO3WTjiZxZCj';
  
  try {
    console.log(`Endpoint: ${endpoint}/v2/api/authenticate`);
    console.log(`Username: ${username}`);
    console.log(`Password: ${password.substring(0, 5)}...`);
    console.log('\nSending request...\n');
    
    const response = await axios.post(
      `${endpoint}/v2/api/authenticate`,
      { username, password },
      { 
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    console.log('✅ Authentication successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Authentication failed!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received');
      console.error('Error:', error.message);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testAuth();
