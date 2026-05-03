import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = new Set(process.argv.slice(2));
const strictMode = !args.has('--soft');

const metricsPath = resolve(process.cwd(), 'cypress/results/performance-baseline-424.json');
const lighthouseSummaryPath = resolve(process.cwd(), 'cypress/results/lighthouse-summary.json');

const expectations = [
  {
    metric: 'dashboard_route_ready',
    scenario: 'warm',
    description: 'Dashboard warm route ready',
    check: (value) => value <= 1200,
    target: '<= 1200 ms',
  },
  {
    metric: 'livematch_focus_toggle_latency',
    scenario: 'interaction',
    description: 'LiveMatch focus toggle latency',
    check: (value) => value <= 200,
    target: '<= 200 ms',
  },
  {
    metric: 'livematch_long_tasks_over_50ms',
    scenario: 'interaction',
    description: 'LiveMatch long tasks > 50 ms',
    check: (value) => value <= 6,
    target: '<= 6',
  },
];

let parsed;
try {
  parsed = JSON.parse(readFileSync(metricsPath, 'utf8'));
} catch (error) {
  console.error(`Could not read metrics file at ${metricsPath}`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const findMetric = (metricName, scenarioName) =>
  parsed.find((entry) => entry.metric === metricName && entry.scenario === scenarioName);

const getComparableValue = (result) => {
  if (typeof result?.median === 'number') {
    return result.median;
  }

  return result?.value;
};

const failures = [];
const warnings = [];

console.log('Performance budget assertions');
console.log(`Metrics file: ${metricsPath}`);

for (const rule of expectations) {
  const result = findMetric(rule.metric, rule.scenario);

  if (!result) {
    failures.push(`${rule.description}: missing metric ${rule.metric} (${rule.scenario})`);
    continue;
  }

  const comparableValue = getComparableValue(result);
  if (typeof comparableValue !== 'number') {
    failures.push(`${rule.description}: metric ${rule.metric} (${rule.scenario}) has no comparable value`);
    continue;
  }

  const ok = rule.check(comparableValue);
  const status = ok ? 'PASS' : 'FAIL';
  const sampleSuffix = result.sampleCount ? `, n=${result.sampleCount}` : '';
  const percentileSuffix = typeof result.p90 === 'number' ? `, p90=${result.p90} ${result.unit}` : '';
  console.log(`- ${status}: ${rule.description} -> median ${comparableValue} ${result.unit}${percentileSuffix}${sampleSuffix} (target ${rule.target})`);

  if (!ok) {
    failures.push(`${rule.description}: got median ${comparableValue} ${result.unit}, expected ${rule.target}`);
  }
}

let lighthouseSummary = null;
try {
  lighthouseSummary = JSON.parse(readFileSync(lighthouseSummaryPath, 'utf8'));
} catch {
  warnings.push(`Lighthouse summary not found at ${lighthouseSummaryPath}. Run npm run perf:lighthouse to include Lighthouse/FCP/TTI checks.`);
}

if (lighthouseSummary) {
  const lighthouseScore = lighthouseSummary.performanceScore;
  const firstContentfulPaintMs = lighthouseSummary.firstContentfulPaintMs;
  const timeToInteractiveMs = lighthouseSummary.timeToInteractiveMs;

  if (typeof lighthouseScore === 'number') {
    const scorePass = lighthouseScore >= 90;
    console.log(`- ${scorePass ? 'PASS' : 'FAIL'}: Lighthouse performance score -> ${lighthouseScore} (target >= 90)`);
    if (!scorePass) {
      failures.push(`Lighthouse performance score: got ${lighthouseScore}, expected >= 90`);
    }
  } else {
    warnings.push('Lighthouse performance score missing from summary output.');
  }

  if (typeof firstContentfulPaintMs === 'number') {
    const fcpPass = firstContentfulPaintMs < 1500;
    console.log(`- ${fcpPass ? 'PASS' : 'WARN'}: First Contentful Paint -> ${firstContentfulPaintMs} ms (target < 1500 ms)`);
    if (!fcpPass) {
      warnings.push(`FCP exceeded target: ${firstContentfulPaintMs} ms (target < 1500 ms)`);
    }
  } else {
    warnings.push('FCP metric missing from Lighthouse summary output.');
  }

  if (typeof timeToInteractiveMs === 'number') {
    const ttiPass = timeToInteractiveMs < 3500;
    console.log(`- ${ttiPass ? 'PASS' : 'WARN'}: Time to Interactive -> ${timeToInteractiveMs} ms (target < 3500 ms)`);
    if (!ttiPass) {
      warnings.push(`TTI exceeded target: ${timeToInteractiveMs} ms (target < 3500 ms)`);
    }
  } else {
    warnings.push('TTI metric missing from Lighthouse summary output.');
  }
}

if (failures.length > 0) {
  console.error('\nBudget failures:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  if (strictMode) {
    process.exit(1);
  }

  console.warn('\nSoft mode enabled (--soft): failing budgets are reported but do not fail the process.');
}

if (warnings.length > 0) {
  console.warn('\nPerformance warnings:');
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

console.log('\nBudget assertion run complete.');
