# Contributing — ShotSpot

This file highlights contribution practices for repository structure and database migrations.

## Migrations: Authoring & Validation

1. Create incremental migrations under `backend/src/migrations/incremental/` using sortable names, e.g. `2025-12-21-add-match-index.sql`.
2. Keep data seeds separate and prefix them with `seed_` (e.g. `seed_default_reports.sql`). Seeds must be idempotent.
3. Run the repository checks before opening a PR:

```bash
# from repo root
cd backend
npm ci
npm run check-migrations
node backend/scripts/setup-test-db.js
```

4. If generating a new baseline for a release, follow:

```bash
# Ensure a clean DB has all incrementals applied
export DATABASE_URL=postgres://user:pass@host:5432/shotspot
./backend/scripts/baseline-generate.sh
```

Commit the generated `backend/src/migrations/baseline/vX.Y.Z.sql` and `manifest.json`, then run `node backend/scripts/setup-test-db.js` to verify fresh-install behavior.

## Pre-commit / Pre-push checks (recommendation)
Add a lightweight hook that scans for `.sql` files outside of `backend/src/migrations/` and fails the commit if found.

Example shell check (for `husky` or CI):

```bash
#!/usr/bin/env bash
set -e
bad=$(git ls-files '*.sql' | grep -vE '^backend/src/migrations/|^backend/src/migrations/baseline/' || true)
if [ -n "$bad" ]; then
  echo "SQL files must reside under backend/src/migrations or backend/src/migrations/baseline:"
  echo "$bad"
  exit 1
fi
```

## CI Requirements
- A job that runs `node backend/scripts/setup-test-db.js` to validate migrations end-to-end.
- Run `npm run check-migrations` and linting as part of PR validation.

## Docs & Domain
- Keep `docs/MIGRATIONS.md` and `docs/DOMAIN.md` up to date when changing migration behavior or domain concepts.

Thanks for contributing — please reference issue #175 when updating docs for structure/migrations/domain.
