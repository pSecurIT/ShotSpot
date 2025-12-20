/* Shared migration runner for ShotSpot
   - Applies baseline (v0.1.0) automatically
   - Applies post-baseline migrations in sorted order
   - Compatible with existing migration discovery pattern
*/
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.resolve(__dirname, '../../src/migrations');
const BASELINE_DIR = path.join(MIGRATIONS_DIR, 'baseline');
const BASELINE_FILE = path.join(BASELINE_DIR, 'v0.1.0.sql');
const BASELINE_MANIFEST = path.join(BASELINE_DIR, 'manifest.json');

/**
 * Apply migrations to a database
 * @param {Object} options
 * @param {string} options.connectionString - PostgreSQL connection string
 * @param {Object} [options.logger=console] - Logger instance with info/error methods
 */
export async function runMigrations({
  connectionString,
  logger = console,
}) {
  const client = new Client({ connectionString });
  await client.connect();
  
  try {
    // Load baseline manifest to know which migrations are already in baseline
    const baselineIncluded = new Set(
      fs.existsSync(BASELINE_MANIFEST)
        ? JSON.parse(fs.readFileSync(BASELINE_MANIFEST, 'utf8'))
        : []
    );

    // Check if baseline exists and is not empty
    const hasBaseline = fs.existsSync(BASELINE_FILE) && fs.statSync(BASELINE_FILE).size > 0;

    if (hasBaseline) {
      logger.info('[migrations] Applying baseline v0.1.0...');
      const baselineSql = fs.readFileSync(BASELINE_FILE, 'utf8');
      await client.query(baselineSql);
      logger.info('[migrations] Applied baseline v0.1.0');
    } else {
      logger.info('[migrations] Baseline missing or empty; skipping baseline application');
    }

    // Discover all migration files in migrations directory
    const numericPrefix = /^\d/;
    const migrationSorter = (a, b) => {
      const aIsNumeric = numericPrefix.test(a);
      const bIsNumeric = numericPrefix.test(b);
      if (aIsNumeric !== bIsNumeric) {
        return aIsNumeric ? 1 : -1; // run non-numeric migrations before numeric ones
      }
      return a.localeCompare(b);
    };

    const allMigrations = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .filter(f => f !== 'baseline')
      .sort(migrationSorter);

    // Filter out migrations already included in baseline
    const postBaselineMigrations = hasBaseline
      ? allMigrations.filter(m => !baselineIncluded.has(m))
      : allMigrations;

    if (postBaselineMigrations.length === 0) {
      logger.info('[migrations] No post-baseline migrations to apply');
    } else {
      logger.info(`[migrations] Applying ${postBaselineMigrations.length} post-baseline migrations...`);
    }

    // Apply each post-baseline migration
    for (const migrationFile of postBaselineMigrations) {
      const migrationPath = path.join(MIGRATIONS_DIR, migrationFile);
      try {
        if (fs.existsSync(migrationPath)) {
          const migrationSql = fs.readFileSync(migrationPath, 'utf8');
          if (migrationSql.trim().length > 0) {
            await client.query(migrationSql);
            logger.info(`[migrations] Applied migration: ${migrationFile}`);
          } else {
            logger.info(`[migrations] Skipped empty migration: ${migrationFile}`);
          }
        } else {
          logger.info(`[migrations] Migration file not found, skipping: ${migrationFile}`);
        }
      } catch (err) {
        logger.error(`[migrations] Warning: Migration ${migrationFile} failed: ${err.message}`);
        // Continue with other migrations instead of failing completely
      }
    }

    logger.info('[migrations] Migration process completed');
  } finally {
    await client.end();
  }
}
