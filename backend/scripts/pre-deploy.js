#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const validateEnv = require('../src/utils/validateEnv');

function checkDatabaseConnection() {
  try {
    const db = require('../src/db');
    return db.healthCheck();
  } catch (error) {
    console.error('Database connection check failed:', error.message);
    return false;
  }
}

async function runPreDeploymentChecks() {
  console.log('Running pre-deployment checks...\n');
  
  // Check 1: Environment Variables
  console.log('1. Checking environment variables...');
  try {
    validateEnv();
    console.log('✅ Environment variables validated successfully\n');
  } catch (error) {
    console.error('❌ Environment validation failed:', error.message);
    process.exit(1);
  }

  // Check 2: Database Connection
  console.log('2. Checking database connection...');
  const dbHealth = await checkDatabaseConnection();
  if (dbHealth) {
    console.log('✅ Database connection successful\n');
  } else {
    console.error('❌ Database connection failed\n');
    process.exit(1);
  }

  // Check 3: Required Files
  console.log('3. Checking required files...');
  const requiredFiles = [
    'package.json',
    'src/index.js',
    'src/db.js',
    'src/schema.sql'
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Missing required file: ${file}`);
      process.exit(1);
    }
  }
  console.log('✅ All required files present\n');

  // Check 4: Dependencies
  console.log('4. Checking dependencies...');
  try {
    execSync('npm list --prod --json', { stdio: 'pipe' });
    console.log('✅ All dependencies are installed correctly\n');
  } catch (error) {
    console.error('❌ Dependency check failed:', error.message);
    process.exit(1);
  }

  // Check 5: Security
  console.log('5. Running security checks...');
  try {
    // Run npm audit
    execSync('npm audit --production --json', { stdio: 'pipe' });
    console.log('✅ Security audit passed\n');
  } catch (error) {
    console.error('❌ Security vulnerabilities found');
    console.error('Run npm audit for details');
    process.exit(1);
  }

  console.log('🎉 All pre-deployment checks passed successfully!');
  process.exit(0);
}

runPreDeploymentChecks().catch(error => {
  console.error('Pre-deployment checks failed:', error);
  process.exit(1);
});