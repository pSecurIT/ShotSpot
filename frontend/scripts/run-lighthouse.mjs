import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';

const targetUrl = process.env.LIGHTHOUSE_URL || 'http://localhost:4173/login';
const resultsDir = resolve(process.cwd(), 'cypress/results');
const reportPath = resolve(resultsDir, 'lighthouse-report.json');
const summaryPath = resolve(resultsDir, 'lighthouse-summary.json');

mkdirSync(resultsDir, { recursive: true });

const chrome = await launch({
  chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage']
});

try {
  const result = await lighthouse(targetUrl, {
    port: chrome.port,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance'],
    formFactor: 'desktop',
    throttlingMethod: 'provided',
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false
    }
  });

  if (!result) {
    throw new Error('No Lighthouse result was returned.');
  }

  const reportJson = result.report;
  const lhr = result.lhr;

  const summary = {
    url: targetUrl,
    generatedAt: new Date().toISOString(),
    performanceScore: Math.round((lhr.categories.performance.score || 0) * 100),
    firstContentfulPaintMs: Math.round(lhr.audits['first-contentful-paint'].numericValue || 0),
    timeToInteractiveMs: Math.round(lhr.audits.interactive.numericValue || 0)
  };

  writeFileSync(reportPath, typeof reportJson === 'string' ? reportJson : JSON.stringify(reportJson, null, 2));
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log('Lighthouse performance summary');
  console.log(`- Score: ${summary.performanceScore}`);
  console.log(`- FCP: ${summary.firstContentfulPaintMs} ms`);
  console.log(`- TTI: ${summary.timeToInteractiveMs} ms`);
  console.log(`- Report: ${reportPath}`);
  console.log(`- Summary: ${summaryPath}`);
} finally {
  await chrome.kill();
}
