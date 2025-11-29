#!/usr/bin/env node
/**
 * Changelog Generator
 * Generates changelog from git commits
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

function exec(command, options = {}) {
  try {
    return execSync(command, { 
      encoding: 'utf-8', 
      cwd: options.cwd || rootDir,
      ...options 
    }).trim();
  } catch (error) {
    if (options.ignoreError) return '';
    throw error;
  }
}

function getCurrentVersion() {
  const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
  return packageJson.version;
}

function getLatestTag() {
  return exec('git describe --tags --abbrev=0', { ignoreError: true }) || '';
}

function getCommitsSinceTag(tag) {
  const command = tag 
    ? `git log ${tag}..HEAD --pretty=format:"%s|%an|%ae|%ad" --date=short --no-merges`
    : `git log --pretty=format:"%s|%an|%ae|%ad" --date=short --no-merges -50`;
  
  return exec(command, { ignoreError: true })
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      const [subject, author, email, date] = line.split('|');
      return { subject, author, email, date };
    });
}

function categorizeCommits(commits) {
  const categories = {
    breaking: [],
    features: [],
    fixes: [],
    performance: [],
    docs: [],
    tests: [],
    chore: [],
    other: []
  };

  commits.forEach(commit => {
    const lower = commit.subject.toLowerCase();
    const subject = commit.subject;

    if (lower.includes('breaking') || lower.includes('break:')) {
      categories.breaking.push(commit);
    } else if (lower.startsWith('feat') || lower.includes('feature')) {
      categories.features.push(commit);
    } else if (lower.startsWith('fix') || lower.includes('bug')) {
      categories.fixes.push(commit);
    } else if (lower.startsWith('perf') || lower.includes('performance')) {
      categories.performance.push(commit);
    } else if (lower.startsWith('docs') || lower.includes('documentation')) {
      categories.docs.push(commit);
    } else if (lower.startsWith('test') || lower.includes('testing')) {
      categories.tests.push(commit);
    } else if (lower.startsWith('chore') || lower.startsWith('ci') || lower.startsWith('build')) {
      categories.chore.push(commit);
    } else {
      categories.other.push(commit);
    }
  });

  return categories;
}

function generateMarkdown(version, categories, commits) {
  const date = new Date().toISOString().split('T')[0];
  let markdown = `## [${version}] - ${date}\n\n`;

  if (categories.breaking.length > 0) {
    markdown += '### ⚠️ BREAKING CHANGES\n\n';
    categories.breaking.forEach(commit => {
      markdown += `- ${commit.subject}\n`;
    });
    markdown += '\n';
  }

  if (categories.features.length > 0) {
    markdown += '### ✨ Features\n\n';
    categories.features.forEach(commit => {
      markdown += `- ${commit.subject}\n`;
    });
    markdown += '\n';
  }

  if (categories.fixes.length > 0) {
    markdown += '### 🐛 Bug Fixes\n\n';
    categories.fixes.forEach(commit => {
      markdown += `- ${commit.subject}\n`;
    });
    markdown += '\n';
  }

  if (categories.performance.length > 0) {
    markdown += '### ⚡ Performance\n\n';
    categories.performance.forEach(commit => {
      markdown += `- ${commit.subject}\n`;
    });
    markdown += '\n';
  }

  if (categories.docs.length > 0) {
    markdown += '### 📝 Documentation\n\n';
    categories.docs.forEach(commit => {
      markdown += `- ${commit.subject}\n`;
    });
    markdown += '\n';
  }

  if (categories.tests.length > 0) {
    markdown += '### ✅ Tests\n\n';
    categories.tests.forEach(commit => {
      markdown += `- ${commit.subject}\n`;
    });
    markdown += '\n';
  }

  if (categories.other.length > 0) {
    markdown += '### 🔧 Other Changes\n\n';
    categories.other.forEach(commit => {
      markdown += `- ${commit.subject}\n`;
    });
    markdown += '\n';
  }

  // Add statistics
  const totalCommits = commits.length;
  const contributors = [...new Set(commits.map(c => c.author))];
  
  markdown += '### 📊 Statistics\n\n';
  markdown += `- **Total commits**: ${totalCommits}\n`;
  markdown += `- **Contributors**: ${contributors.length}\n`;
  markdown += `- **New features**: ${categories.features.length}\n`;
  markdown += `- **Bug fixes**: ${categories.fixes.length}\n`;
  
  if (contributors.length > 0) {
    markdown += `\n**Contributors**: ${contributors.join(', ')}\n`;
  }

  markdown += '\n';

  return markdown;
}

function main() {
  console.log('📝 Generating Changelog\n');

  const version = getCurrentVersion();
  const latestTag = getLatestTag();
  
  console.log(`Current version: ${version}`);
  console.log(`Latest tag: ${latestTag || '(none)'}`);
  console.log(`Analyzing commits since ${latestTag || 'start'}...\n`);

  const commits = getCommitsSinceTag(latestTag);
  
  if (commits.length === 0) {
    console.log('No commits found since last release.');
    return;
  }

  const categories = categorizeCommits(commits);
  const changelog = generateMarkdown(version, categories, commits);

  console.log('Generated Changelog:');
  console.log('─'.repeat(80));
  console.log(changelog);
  console.log('─'.repeat(80));
  
  console.log('\nTo update CHANGELOG.md, run: npm run release:create');
}

main();
