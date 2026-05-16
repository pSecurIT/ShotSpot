#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const thresholdArg = args.find((arg) => arg.startsWith('--threshold='));
const threshold = thresholdArg ? Number(thresholdArg.split('=')[1]) : 80;

if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
  console.error('Invalid --threshold value. Use a number between 0 and 100.');
  process.exit(2);
}

const summaryPath = path.resolve(process.cwd(), 'coverage', 'coverage-summary.json');

if (!fs.existsSync(summaryPath)) {
  console.error('Coverage summary not found at coverage/coverage-summary.json.');
  console.error('Run npm run test:coverage first.');
  process.exit(2);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const sourceRoot = path.join(path.resolve(process.cwd(), 'src'), path.sep);

const failingFiles = Object.entries(summary)
  .filter(([filePath]) => filePath !== 'total')
  .map(([filePath, metrics]) => {
    const normalizedPath = path.normalize(filePath);
    return {
      filePath: normalizedPath,
      statements: metrics?.statements?.pct
    };
  })
  .filter((entry) => typeof entry.statements === 'number')
  .filter((entry) => entry.filePath.startsWith(sourceRoot))
  .filter((entry) => entry.statements < threshold)
  .sort((a, b) => a.statements - b.statements);

if (failingFiles.length === 0) {
  console.log(`Coverage gate passed: all backend source files have statements >= ${threshold}%.`);
  process.exit(0);
}

console.error(`Coverage gate failed: ${failingFiles.length} backend source files are below ${threshold}% statements.`);
for (const entry of failingFiles) {
  const relativePath = path.relative(process.cwd(), entry.filePath);
  console.error(` - ${relativePath}: ${entry.statements.toFixed(2)}%`);
}

process.exit(1);
