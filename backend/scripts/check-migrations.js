#!/usr/bin/env node
/**
 * Migration Consistency Checker
 * Ensures all migration files are registered in setup scripts
 * Run this before commits to catch missing migrations early
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '../src/migrations');
const SETUP_SCRIPTS = [
  path.join(__dirname, 'setup-db.js'),
  path.join(__dirname, 'setup-test-db.js'),
  path.join(__dirname, 'setup-parallel-dbs.js')
];

console.log('🔍 Checking migration consistency...\n');

// Get all migration files
const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log(`Found ${migrationFiles.length} migration files:`);
migrationFiles.forEach(f => console.log(`  - ${f}`));
console.log('');

let allGood = true;

// Check each setup script
for (const scriptPath of SETUP_SCRIPTS) {
  const scriptName = path.basename(scriptPath);
  const content = fs.readFileSync(scriptPath, 'utf8');
  
  console.log(`Checking ${scriptName}...`);
  
  const missing = [];
  for (const migrationFile of migrationFiles) {
    // Check if migration filename appears in the script
    if (!content.includes(migrationFile)) {
      missing.push(migrationFile);
    }
  }
  
  if (missing.length > 0) {
    console.error(`  ❌ Missing migrations in ${scriptName}:`);
    missing.forEach(m => console.error(`     - ${m}`));
    allGood = false;
  } else {
    console.log(`  ✅ All migrations present`);
  }
  console.log('');
}

if (!allGood) {
  console.error('❌ MIGRATION CHECK FAILED!');
  console.error('\nTo fix this issue:');
  console.error('1. Add missing migrations to the setup scripts in the correct order');
  console.error('2. Ensure migrations are in alphabetical order in the arrays');
  console.error('3. Run this check again: npm run check-migrations\n');
  process.exit(1);
}

console.log('✅ All migration checks passed!\n');
process.exit(0);
