# Migration Baseline & Incremental Migrations

## Purpose
This document describes how ShotSpot applies schema changes for fresh installs and for existing installations, the repository layout for migrations, how to author new migrations, and how CI and developer tooling validate the migration flow.

## Key Concepts
- Baseline: a single schema-only SQL dump representing all historic schema up to a major release (example: `baseline/v0.1.0.sql`). Applied only once on fresh installs.
- Incremental migrations: ordered SQL files applied after the baseline (or when baseline is absent). Stored in `backend/src/migrations/incremental/`.
- `_migrations` table: runtime table that records applied migration identifiers (baseline versions and incremental filenames).

## How it works (runner & scripts)
- Setup scripts (`backend/scripts/setup-*.js`) call the shared runner `backend/scripts/lib/run-migrations.js`.
- The runner ensures `_migrations` exists, detects fresh DBs (no rows), and:
  - On a fresh DB: applies the baseline `baseline/vX.Y.Z.sql` (if present) and inserts a recorded baseline version like `vX.Y.Z-baseline` into `_migrations`, then applies any incremental migrations.
  - On existing DB: skips baseline and applies only pending incremental migrations (in lexicographic order).
- Each applied incremental migration is recorded using the filename (without `.sql`).

## Repository layout (recommended)
- Baseline files: `backend/src/migrations/baseline/` (e.g., `v0.1.0.sql`, `manifest.json`).
- Incremental migrations: `backend/src/migrations/incremental/` (use sortable names: `YYYY-MM-DD-description.sql`).
- Fallback schema: `backend/src/schema.sql` used only when no baseline exists.

## Authoring incremental migrations (developer steps)
1. Create a new `.sql` file under `backend/src/migrations/incremental/`.
   - Use sortable names (e.g., `2025-12-21-add-match-index.sql`).
   - Prefer additive changes and avoid in-place destructive operations; when unavoidable, include safe migration steps and a clear rollback note in the migration file header.
2. Keep data seeds separate and prefix with `seed_` (e.g., `seed_default_reports.sql`). Seeds must be idempotent (`ON CONFLICT DO NOTHING` / `WHERE NOT EXISTS`).
3. Run local validation: from `backend/` run `npm run check-migrations` (this script mirrors CI checks and verifies migration placement and manifest consistency).
4. Validate end-to-end by running the setup script against a test DB: `node backend/scripts/setup-test-db.js` (CI runs a similar job).

## Generating a new baseline (major releases)
- Ensure a clean DB has all incrementals applied.
- Run the baseline generator (script may vary on platforms):

```bash
# On Windows PowerShell (example):
$env:DATABASE_URL="postgres://user:pass@host:5432/shotspot"
./backend/scripts/baseline-generate.sh

# On UNIX / bash:
export DATABASE_URL=postgres://user:pass@host:5432/shotspot
./backend/scripts/baseline-generate.sh
```

- Commit the generated `baseline/vX.Y.Z.sql` and update `baseline/manifest.json` as needed.
- After committing, run `node backend/scripts/setup-test-db.js` locally to validate the fresh-install path.

## CI and pre-commit checks
- CI should include a job that:
  - Runs `node backend/scripts/setup-test-db.js` against a disposable test DB to validate baseline + incremental application.
  - Runs `npm run check-migrations` to assert migration naming and placement rules.
- Pre-commit or pre-push hooks should reject `.sql` files placed outside `backend/src/migrations/` or `backend/src/migrations/baseline/`.
  - Example: a simple check script can scan the repo for `*.sql` files and fail if any are outside the allowed paths.

## Adding a migration checklist (summary)
1. Add `backend/src/migrations/incremental/YYYY-MM-DD-description.sql`.
2. Keep seeds as `seed_*.sql` and idempotent.
3. Run `npm run check-migrations`.
4. Run `node backend/scripts/setup-test-db.js` to validate the flow.
5. Open a PR referencing this change and link to the issue that required it.

## Conventions & constraints
- Do not keep destructive DROP operations in normal incremental migrations; prefer explicit migration steps with safety checks.
- Avoid creating SQL files in `backend/scripts/` or other non-migrations folders.
- Keep the baseline schema schema-only (no runtime data).

## Troubleshooting
- If setup scripts apply an unexpected migration order, verify filenames sort lexicographically and contain an ISO-like date prefix where appropriate.
- If baseline is not being applied on fresh installs, verify `baseline/vX.Y.Z.sql` exists and is non-empty and that the runner's detection logic recognizes an empty `_migrations` table.

## Example CI job (concept)
This is a conceptual snippet to run in GitHub Actions (implement as needed in `.github/workflows`):

```yaml
# name: validate-migrations
# runs-on: ubuntu-latest
# steps:
#   - uses: actions/checkout@v4
#   - name: Start postgres
#     uses: harmon758/postgres-action@v1
#     with:
#       postgresql version: '15'
#   - name: Install Node
#     uses: actions/setup-node@v4
#     with:
#       node-version: '20'
#   - name: Install deps
#     run: npm ci --workspace=backend
#   - name: Validate migrations
#     run: node backend/scripts/setup-test-db.js
```

---
Updated: Clarified baseline vs incremental behavior, added developer checklist, CI and pre-commit recommendations.
