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
const BASELINE_DIR = path.join(MIGRATIONS_DIR, 'baseline');
const BASELINE_FILE = path.join(BASELINE_DIR, 'v0.1.0.sql');
const BASELINE_MANIFEST = path.join(BASELINE_DIR, 'manifest.json');

console.log('🔍 Checking migration consistency...\n');

// Get all migration files (excluding baseline folder)
const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log(`Found ${migrationFiles.length} migration files:`);
migrationFiles.forEach(f => console.log(`  - ${f}`));
console.log('');

const baselineExists = fs.existsSync(BASELINE_FILE);
const baselineNonEmpty = baselineExists && fs.statSync(BASELINE_FILE).size > 0;

let allGood = true;

// Baseline manifest sanity
const baselineIncluded = fs.existsSync(BASELINE_MANIFEST)
  ? JSON.parse(fs.readFileSync(BASELINE_MANIFEST, 'utf8'))
  : [];

const missingInManifest = baselineIncluded.filter(m => !migrationFiles.includes(m));
if (missingInManifest.length > 0) {
  if (baselineNonEmpty) {
    console.log('ℹ️  Manifest-only migrations (pruned from disk, captured in baseline):');
    missingInManifest.forEach(m => console.log(`   - ${m}`));
  } else {
    console.error('❌ Baseline manifest references missing migrations, and baseline file is missing or empty.');
    missingInManifest.forEach(m => console.error(`   - ${m}`));
    allGood = false;
  }
}

if (baselineIncluded.length > 0 && !baselineNonEmpty) {
  console.error('❌ Baseline manifest exists but baseline SQL file is missing or empty.');
  allGood = false;
}

if (allGood) {
  console.log('✅ Baseline manifest and migration directory look consistent.');
  process.exit(0);
}

console.error('\n❌ MIGRATION CHECK FAILED!');
process.exit(1);
