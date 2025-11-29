#!/usr/bin/env node
/**
 * Release Creation Helper Script
 * Creates a new release tag and generates changelog
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function exec(command, options = {}) {
  try {
    return execSync(command, { 
      encoding: 'utf-8', 
      stdio: options.silent ? 'pipe' : 'inherit',
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

function updateVersion(newVersion) {
  // Update root package.json
  const rootPackage = join(rootDir, 'package.json');
  const rootPkg = JSON.parse(readFileSync(rootPackage, 'utf-8'));
  rootPkg.version = newVersion;
  writeFileSync(rootPackage, JSON.stringify(rootPkg, null, 2) + '\n');

  // Update frontend package.json
  const frontendPackage = join(rootDir, 'frontend', 'package.json');
  const frontendPkg = JSON.parse(readFileSync(frontendPackage, 'utf-8'));
  frontendPkg.version = newVersion;
  writeFileSync(frontendPackage, JSON.stringify(frontendPkg, null, 2) + '\n');

  // Update backend package.json
  const backendPackage = join(rootDir, 'backend', 'package.json');
  const backendPkg = JSON.parse(readFileSync(backendPackage, 'utf-8'));
  backendPkg.version = newVersion;
  writeFileSync(backendPackage, JSON.stringify(backendPkg, null, 2) + '\n');

  console.log(`✅ Updated version to ${newVersion} in all package.json files`);
}

function incrementVersion(version, type) {
  const parts = version.split('.').map(Number);
  switch (type) {
    case 'major':
      return `${parts[0] + 1}.0.0`;
    case 'minor':
      return `${parts[0]}.${parts[1] + 1}.0`;
    case 'patch':
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    default:
      return version;
  }
}

function getGitLog(fromTag) {
  const command = fromTag 
    ? `git log ${fromTag}..HEAD --pretty=format:"%s" --no-merges`
    : `git log --pretty=format:"%s" --no-merges -20`;
  
  return exec(command, { silent: true, ignoreError: true })
    .split('\n')
    .filter(line => line.trim());
}

function categorizeCommits(commits) {
  const categories = {
    features: [],
    fixes: [],
    breaking: [],
    other: []
  };

  commits.forEach(commit => {
    const lower = commit.toLowerCase();
    if (lower.includes('breaking') || lower.includes('break:')) {
      categories.breaking.push(commit);
    } else if (lower.startsWith('feat') || lower.includes('feature')) {
      categories.features.push(commit);
    } else if (lower.startsWith('fix') || lower.includes('bug')) {
      categories.fixes.push(commit);
    } else if (!lower.startsWith('chore') && !lower.startsWith('docs')) {
      categories.other.push(commit);
    }
  });

  return categories;
}

function generateChangelog(version, categories) {
  const date = new Date().toISOString().split('T')[0];
  let changelog = `\n## [${version}] - ${date}\n\n`;

  if (categories.breaking.length > 0) {
    changelog += '### ⚠️ Breaking Changes\n\n';
    categories.breaking.forEach(commit => {
      changelog += `- ${commit}\n`;
    });
    changelog += '\n';
  }

  if (categories.features.length > 0) {
    changelog += '### ✨ New Features\n\n';
    categories.features.forEach(commit => {
      changelog += `- ${commit}\n`;
    });
    changelog += '\n';
  }

  if (categories.fixes.length > 0) {
    changelog += '### 🐛 Bug Fixes\n\n';
    categories.fixes.forEach(commit => {
      changelog += `- ${commit}\n`;
    });
    changelog += '\n';
  }

  if (categories.other.length > 0) {
    changelog += '### 🔧 Other Changes\n\n';
    categories.other.forEach(commit => {
      changelog += `- ${commit}\n`;
    });
    changelog += '\n';
  }

  return changelog;
}

function updateChangelogFile(changelog) {
  const changelogPath = join(rootDir, 'CHANGELOG.md');
  let existingChangelog = '';
  
  try {
    existingChangelog = readFileSync(changelogPath, 'utf-8');
  } catch (error) {
    existingChangelog = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n';
  }

  // Insert new changelog after the header
  const lines = existingChangelog.split('\n');
  const headerEnd = lines.findIndex(line => line.startsWith('## '));
  
  if (headerEnd === -1) {
    existingChangelog += '\n' + changelog;
  } else {
    lines.splice(headerEnd, 0, changelog);
    existingChangelog = lines.join('\n');
  }

  writeFileSync(changelogPath, existingChangelog);
  console.log('✅ Updated CHANGELOG.md');
}

async function main() {
  console.log('🚀 ShotSpot Release Creator\n');

  // Check git status
  const gitStatus = exec('git status --porcelain', { silent: true });
  if (gitStatus) {
    console.log('⚠️  Warning: You have uncommitted changes:');
    console.log(gitStatus);
    const proceed = await question('Do you want to continue? (y/N): ');
    if (proceed.toLowerCase() !== 'y') {
      console.log('❌ Aborted');
      rl.close();
      process.exit(0);
    }
  }

  // Get current version
  const currentVersion = getCurrentVersion();
  console.log(`Current version: ${currentVersion}\n`);

  // Ask for release type
  console.log('Select release type:');
  console.log('1. Major (breaking changes)');
  console.log('2. Minor (new features)');
  console.log('3. Patch (bug fixes)');
  console.log('4. Custom version\n');

  const choice = await question('Enter choice (1-4): ');
  
  let newVersion;
  switch (choice) {
    case '1':
      newVersion = incrementVersion(currentVersion, 'major');
      break;
    case '2':
      newVersion = incrementVersion(currentVersion, 'minor');
      break;
    case '3':
      newVersion = incrementVersion(currentVersion, 'patch');
      break;
    case '4':
      newVersion = await question('Enter custom version (x.y.z): ');
      if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
        console.log('❌ Invalid version format');
        rl.close();
        process.exit(1);
      }
      break;
    default:
      console.log('❌ Invalid choice');
      rl.close();
      process.exit(1);
  }

  console.log(`\nNew version will be: ${newVersion}`);

  // Get latest tag
  const latestTag = exec('git describe --tags --abbrev=0', { silent: true, ignoreError: true }) || '';
  
  // Get commits since last tag
  const commits = getGitLog(latestTag);
  const categories = categorizeCommits(commits);

  // Generate changelog
  const changelog = generateChangelog(newVersion, categories);
  console.log('\n📝 Generated Changelog:');
  console.log(changelog);

  // Confirm
  const confirm = await question('\nProceed with release? (y/N): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('❌ Aborted');
    rl.close();
    process.exit(0);
  }

  // Update versions
  updateVersion(newVersion);

  // Update changelog
  updateChangelogFile(changelog);

  // Commit changes
  exec('git add package.json frontend/package.json backend/package.json CHANGELOG.md');
  exec(`git commit -m "chore: release version ${newVersion}"`);
  console.log('✅ Committed version updates');

  // Create tag
  exec(`git tag -a v${newVersion} -m "Release version ${newVersion}"`);
  console.log(`✅ Created tag v${newVersion}`);

  console.log('\n🎉 Release prepared successfully!\n');
  console.log('Next steps:');
  console.log(`1. Push changes: git push origin main`);
  console.log(`2. Push tag: git push origin v${newVersion}`);
  console.log('3. Create GitHub release from the tag');
  console.log('4. GitHub Actions will automatically build mobile packages\n');

  const pushNow = await question('Push to remote now? (y/N): ');
  if (pushNow.toLowerCase() === 'y') {
    exec('git push origin main');
    exec(`git push origin v${newVersion}`);
    console.log('✅ Pushed to remote');
    console.log('\n🚀 GitHub Actions will now build the mobile packages!');
    console.log('Check: https://github.com/pSecurIT/Korfball-game-statistics/actions');
  }

  rl.close();
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
