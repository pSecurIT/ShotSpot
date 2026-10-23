import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const androidRoot = path.resolve(process.argv[2] || 'frontend/android');
const reportPath = path.join(androidRoot, 'build', 'dependencyUpdates', 'report.json');
const strictMode = (process.env.STRICT_ANDROID_UPDATES || 'false').toLowerCase() === 'true';
const summaryPath = process.env.GITHUB_STEP_SUMMARY;

const directDependencyConfigurations = new Set([
  'api',
  'annotationProcessor',
  'androidTestImplementation',
  'classpath',
  'compileOnly',
  'debugImplementation',
  'implementation',
  'kapt',
  'ksp',
  'releaseImplementation',
  'runtimeOnly',
  'testImplementation'
]);

// Majors held back until a stable Capacitor 9 release supports AGP 9 and Cordova 15.
const deferredMajorUpdates = {
  'com.android.tools.build:gradle': 8,
  'org.apache.cordova:framework': 14
};

function isDeferredMajorUpdate(key, currentVersion, targetVersion) {
  const pinnedMajor = deferredMajorUpdates[key];
  if (pinnedMajor === undefined) {
    return false;
  }

  const currentMajor = Number.parseInt(currentVersion, 10);
  const targetMajor = Number.parseInt(targetVersion, 10);
  return currentMajor === pinnedMajor && targetMajor > pinnedMajor;
}

function isNonStableVersion(version) {
  const upperVersion = version.toUpperCase();
  const hasStableKeyword = ['RELEASE', 'FINAL', 'GA'].some((keyword) => upperVersion.includes(keyword));
  return !hasStableKeyword && !/^[0-9,.v-]+(-r)?$/.test(version);
}

function getGradleFiles(dirPath) {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === 'build' || entry.name === '.gradle') {
      continue;
    }

    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...getGradleFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.gradle')) {
      files.push(entryPath);
    }
  }

  return files;
}

function getDirectDependencyCoordinates(rootPath) {
  const dependencyPattern = /\b([A-Za-z][A-Za-z0-9]*)\s+["']([^"':\s]+):([^"':\s]+):([^"'\s]+)["']/g;
  const coordinates = new Set();

  for (const gradleFile of getGradleFiles(rootPath)) {
    const fileContents = readFileSync(gradleFile, 'utf8');
    for (const match of fileContents.matchAll(dependencyPattern)) {
      const configuration = match[1];
      if (!directDependencyConfigurations.has(configuration)) {
        continue;
      }

      coordinates.add(`${match[2]}:${match[3]}`);
    }
  }

  return coordinates;
}

function getStableTargetVersion(available = {}) {
  for (const candidate of [available.release, available.milestone, available.integration]) {
    if (candidate && !isNonStableVersion(candidate)) {
      return candidate;
    }
  }

  return null;
}

function appendSummary(lines) {
  if (!summaryPath) {
    return;
  }

  const summaryText = `${lines.join('\n')}\n`;
  appendFileSync(summaryPath, summaryText, 'utf8');
}

if (!existsSync(reportPath)) {
  console.error(`Missing dependency updates report at ${reportPath}`);
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const directCoordinates = getDirectDependencyCoordinates(androidRoot);

const directOutdatedDependencies = (report.outdated?.dependencies || [])
  .map((dependency) => {
    const key = `${dependency.group}:${dependency.name}`;
    if (!directCoordinates.has(key)) {
      return null;
    }

    const targetVersion = getStableTargetVersion(dependency.available);
    if (!targetVersion || targetVersion === dependency.version) {
      return null;
    }

    if (isDeferredMajorUpdate(key, dependency.version, targetVersion)) {
      return null;
    }

    return {
      key,
      currentVersion: dependency.version,
      targetVersion,
      projectUrl: dependency.projectUrl
    };
  })
  .filter(Boolean)
  .sort((left, right) => left.key.localeCompare(right.key));

const summaryLines = ['## Android Dependency Freshness', ''];

if (directOutdatedDependencies.length === 0) {
  console.log('Android direct Gradle dependencies are up to date.');
  summaryLines.push('- No stable updates detected for direct Android Gradle dependencies.');
  appendSummary(summaryLines);
  process.exit(0);
}

console.log('Outdated direct Android Gradle dependencies detected:');
for (const dependency of directOutdatedDependencies) {
  const detail = `- ${dependency.key}: ${dependency.currentVersion} -> ${dependency.targetVersion}`;
  console.log(detail);
  if (dependency.projectUrl) {
    console.log(`  ${dependency.projectUrl}`);
  }
  summaryLines.push(detail);
}

if (!strictMode) {
  console.log('Advisory mode: not failing this run.');
  summaryLines.splice(2, 0, '- Advisory mode: updates detected but this event is non-blocking.');
  appendSummary(summaryLines);
  process.exit(0);
}

summaryLines.splice(2, 0, '- Blocking mode: stable updates detected for direct Android Gradle dependencies.');
appendSummary(summaryLines);
console.error('Blocking mode enabled: Android direct Gradle dependencies have stable updates available.');
process.exit(1);