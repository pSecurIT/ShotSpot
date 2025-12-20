# Migration Baseline (v0.1.0)

## Overview
- Fresh installs should apply the baseline schema dump, then only migrations created after v0.1.0.
- Existing databases continue with incremental migrations; baseline is skipped when the migrations table already exists.

## Files
- `backend/src/migrations/baseline/v0.1.0.sql`: Schema-only baseline (generate against a clean, fully migrated DB).
- `backend/src/migrations/baseline/manifest.json`: Migrations covered by the v0.1.0 baseline.
- `backend/scripts/baseline-generate.sh`: Helper to regenerate the baseline from a live database.

## Generating the Baseline
```bash
# Point DATABASE_URL to a clean DB that has all migrations applied
export DATABASE_URL=postgres://user:pass@host:5432/shotspot
./backend/scripts/baseline-generate.sh
```
Commit the updated `v0.1.0.sql` and rerun setup scripts to verify fresh-install behavior.

## Setup Flow (dev/test/CI)
- If `v0.1.0.sql` is present and non-empty, setup scripts apply it, then run post-baseline migrations.
- If baseline is missing/empty, scripts fall back to `schema.sql` + all migrations.

## Adding New Migrations
1) Add a new `.sql` file to `backend/src/migrations/` (alphabetical naming).
2) Do **not** add it to `baseline/manifest.json` (baseline is frozen at v0.1.0).
3) Run `npm run check-migrations` from `backend/` to ensure consistency.

## File Organization Rules

### Canonical Locations
- **Active migrations**: `backend/src/migrations/*.sql`
  - Schema changes: Use dated format `YYYYMMDD_description.sql` or descriptive `add_feature_name.sql`
  - Data seeds: Prefix with `seed_*.sql` (e.g., `seed_achievements.sql`)
- **Baseline schema**: `backend/src/migrations/baseline/v0.1.0.sql`
- **Baseline metadata**: `backend/src/migrations/baseline/manifest.json`
- **Fallback schema**: `backend/src/schema.sql` (used when baseline is missing)

### Forbidden Locations
- **No SQL files in `backend/scripts/`** (only JavaScript and bash scripts)
- Exception: Temporary files like `temp-setup.sql` (auto-cleaned by scripts)

### Seed Migration Conventions
- Prefix all data seed files with `seed_*`
- Must be idempotent (use `ON CONFLICT DO NOTHING` or `WHERE NOT EXISTS`)
- Excluded from baseline (data, not schema)
- Always run after baseline on fresh installs

## Notes
- Baseline is schema-only; no data is included.
- Legacy schema migrations up to v0.1.0 are pruned from disk and captured in the baseline; `manifest.json` lists what the baseline contains.
- Seed migrations (e.g., `seed_achievements.sql`, `seed_default_report_templates.sql`) remain on disk and run after the baseline since they populate data, not schema.
- The `backend/src/schema.sql` file serves as a critical fallback when the baseline is missing and must be maintained.
