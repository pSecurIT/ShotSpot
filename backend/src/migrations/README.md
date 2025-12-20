# Database Migrations

## Overview
ShotSpot uses SQL migration files to manage database schema changes. All migrations are stored in `backend/src/migrations/` and applied alphabetically.

## ⚠️ Critical Rule: Register Migrations in ALL Setup Scripts

**Every new migration MUST be added to these three files:**
1. `backend/scripts/setup-db.js` - Production/Docker database
2. `backend/scripts/setup-test-db.js` - Local test database  
3. `backend/scripts/setup-parallel-dbs.js` - Parallel test databases for CI/CD

### Why Three Scripts?
- **setup-db.js**: Used for production deployments and Docker containers
- **setup-test-db.js**: Used for local development testing
- **setup-parallel-dbs.js**: Used in GitHub Actions for isolated parallel test execution

Forgetting to add migrations to any script causes:
- ❌ Test failures in CI/CD (missing tables)
- ❌ Production deployment errors
- ❌ Inconsistent database schemas across environments

## Automated Safety Checks

### 1. Migration Consistency Checker
```bash
cd backend
npm run check-migrations
```

This script:
- Scans all `.sql` files in `backend/src/migrations/`
- Verifies each migration is registered in all three setup scripts
- **Runs automatically** before tests and in CI/CD
- **Blocks commits** via pre-commit hook if migrations are missing

### 2. Pre-Commit Hook
Located at `.git/hooks/pre-commit`, this hook:
- Detects when migration files are added/modified
- Runs `npm run check-migrations`
- **Prevents commit** if migrations aren't registered in all scripts

### 3. GitHub Actions Integration
The `test-coverage.yml` workflow includes:
```yaml
- name: Check migration consistency
  run: cd backend && npm run check-migrations
```

This runs before tests, catching missing migrations early in CI/CD.

## ⚠️ UPDATE: Auto-Discovery Now Enabled

**Good news!** The setup scripts now **automatically discover** all migration files in `backend/src/migrations/`. You no longer need to manually register migrations in the three setup scripts.

The migration discovery logic:
- Scans `backend/src/migrations/` for all `.sql` files
- Excludes the `baseline/` directory
- Applies migrations in alphabetical order (non-numeric first, then dated)
- Uses `IF NOT EXISTS` protection to skip already-applied migrations

You still need to run `npm run check-migrations` before committing to ensure the migration system is healthy.

## Creating a New Migration

### Step-by-Step Guide

**1. Create the migration file**
```bash
cd backend/src/migrations
# Use descriptive name with action prefix
touch add_player_stats_table.sql
```

**2. Write the migration SQL**
```sql
-- Add player statistics table
CREATE TABLE IF NOT EXISTS player_stats (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
    points INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_player_stats_player_id ON player_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_game_id ON player_stats(game_id);
```

**3. Verify consistency** (auto-discovery means no manual registration needed!)
```bash
cd backend
npm run check-migrations
```

Expected output:
```
🔍 Checking migration consistency...

Found 16 migration files:
  - add_achievements_system.sql
  - add_attacking_side.sql
  ...
  - add_player_stats_table.sql  ← Your new migration
  ...

✅ All migration checks passed!
```

**4. Test the migration locally**
```bash
npm run setup-test-db  # Recreates test database with all migrations
npm test                # Run tests to ensure nothing broke
```

**5. Commit (pre-commit hook will auto-verify)**
```bash
git add backend/src/migrations/add_player_stats_table.sql
git commit -m "feat: add player stats table"
# Pre-commit hook runs npm run check-migrations
# Commit proceeds only if check passes
```

## Migration Naming Conventions

Use descriptive prefixes to indicate the type of change:

- `add_*.sql` - Adding new columns to existing tables
- `create_*.sql` - Creating new tables
- `modify_*.sql` - Modifying existing columns (type changes, constraints)
- `remove_*.sql` - Removing columns or tables
- `seed_*.sql` - Inserting seed/reference data
- `index_*.sql` - Adding indexes for performance

Examples:
- `add_player_gender.sql` - Adds gender column to players table
- `create_seasons_table.sql` - Creates new seasons table
- `modify_games_period_constraint.sql` - Changes period check constraint
- `seed_achievements.sql` - Inserts default achievement data

## Troubleshooting

### Error: Migration not found in script
```
❌ Missing migrations in setup-test-db.js:
   - add_player_stats_table.sql
```

**Fix:** Add the migration filename to the `migrations` array in the specified script.

### Error: Database already exists
```
Error: database "shotspot_test_db" already exists
```

**Fix:** Run setup script with force recreate:
```bash
npm run setup-test-db  # This drops and recreates the database
```

### Error: Relation already exists
```
ERROR: relation "player_stats" already exists
```

**Fix:** Your migration file should use `CREATE TABLE IF NOT EXISTS` to be idempotent. Update your migration:
```sql
CREATE TABLE IF NOT EXISTS player_stats ( ... );
```

### Pre-commit hook not working
```bash
# Make the hook executable
chmod +x .git/hooks/pre-commit

# Test it manually
.git/hooks/pre-commit
```

## Current Migration List

Run this to see all registered migrations:
```bash
cd backend
npm run check-migrations
```

As of last update (2025-11-23):
1. add_achievements_system.sql
2. add_attacking_side.sql
3. add_enhanced_events.sql
4. add_game_rosters.sql
5. add_login_history.sql
6. add_match_configuration_columns.sql
7. add_password_must_change.sql
8. add_player_gender.sql
9. add_possession_tracking.sql
10. add_seasons.sql
11. add_starting_position.sql
12. add_substitutions.sql
13. add_timer_fields.sql
14. add_user_activity_tracking.sql
15. seed_achievements.sql

## Docker Deployment

For Docker, migrations are applied via the base `schema.sql` file during container initialization. The Dockerfile includes migrations in the final schema, so no additional setup is needed after container start.

## Best Practices

✅ **DO:**
- Use `IF NOT EXISTS` for idempotent migrations
- Add indexes for foreign keys and frequently queried columns
- Include comments explaining complex changes
- Test migrations locally before committing
- Run `npm run check-migrations` before pushing
- Keep migrations small and focused on one change

❌ **DON'T:**
- Modify existing migration files (create a new one instead)
- Commit without running `npm run check-migrations`
- Skip the migration consistency check
- Create migrations that depend on specific data existing
- Use DROP TABLE without CASCADE considerations

## Safety Nets in Test Setup Scripts

The test database setup scripts (`backend/scripts/setup-test-db.js`, `backend/scripts/setup-parallel-dbs.js`) include embedded SQL that creates the `trainer_assignments` table if it's not present:

```javascript
// Safety net: ensure trainer_assignments exists even if a migration was skipped
await testPool.query(`
  CREATE TABLE IF NOT EXISTS trainer_assignments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    ...
  );
`);
```

**Why?** This is a defensive measure to ensure test databases work even if:
- A developer accidentally skips registering a migration
- A migration file is deleted but the table is still needed
- A CI/CD environment is missing a migration

**Important:** This embedded SQL only runs in test environments, NOT in production. It uses `IF NOT EXISTS` to be idempotent. When the corresponding migration (`20251216_add_trainer_assignments.sql`) is already applied, this code safely does nothing.

**Future developers:** If you find similar `CREATE TABLE IF NOT EXISTS` statements in setup scripts, this is intentional defensive programming. Don't be alarmed—it's a safety net, not a bug.

## Seed Data Files

Seed files (like `seed_achievements.sql`, `seed_default_report_templates.sql`) insert reference data and configuration into the database. They differ from schema migrations:

- **Schema migrations** alter table structure, add/remove columns, create indexes
- **Seed files** insert data (achievements, templates, default values, reference data)

Seed files:
- ✅ Live in `backend/src/migrations/` alongside migrations
- ✅ Can use descriptive names without dates (e.g., `seed_achievements.sql`)
- ✅ Run AFTER all schema migrations are applied
- ✅ Use `INSERT ... ON CONFLICT` for idempotency when possible
- ✅ Should never depend on other seeds running first

Example seed file pattern:
```sql
-- Seed achievements data
-- This file can be safely run multiple times (idempotent)

INSERT INTO achievements (name, description, category)
VALUES ('Sharpshooter', 'Score 10+ goals in a game', 'shooting')
ON CONFLICT (name) DO NOTHING;  -- ← Prevents duplicate key errors
```

## Baseline Versioning & Regeneration

The `baseline/v0.1.0.sql` file is a snapshot of the complete database schema as it existed at version 0.1.0. The corresponding `baseline/manifest.json` tracks which migrations are already included in that snapshot.

### When to Regenerate Baseline

Consider regenerating the baseline when:
- You've accumulated 50+ migration files (easier to track with baseline)
- You're preparing a major release
- You want to clean up migration history
- Performance: faster to restore from baseline than apply 50+ migrations

### How to Regenerate Baseline

1. **Snapshot the current schema**
   ```bash
   cd backend/scripts
   # Dump the production database schema
   pg_dump -U admin -d shotspot --schema-only > ../src/migrations/baseline/v0.1.0.sql
   ```

2. **Update the manifest**
   ```bash
   node baseline-generate.sh
   # This will:
   # - Scan all migration files
   # - Create/update baseline/manifest.json with list of migrations to exclude
   # - Verify baseline is syntactically correct
   ```

3. **Remove old migration files from disk** (optional)
   - The migrations are now captured in baseline, so you can remove them if they're cluttering the directory
   - They'll still be tracked in manifest.json for historical reference

4. **Commit the updated baseline**
   ```bash
   git add backend/src/migrations/baseline/
   git commit -m "chore: regenerate baseline at v0.1.0"
   ```

5. **Verify baseline works**
   ```bash
   npm run setup-test-db  # Ensure baseline loads without errors
   npm test
   ```

### Baseline Safety Rules

- ❌ Never manually edit baseline/v0.1.0.sql
- ❌ Don't add new migrations to baseline/ directory
- ✅ Always keep baseline/manifest.json in sync with baseline/v0.1.0.sql
- ✅ Document the date when baseline was generated (in a comment in v0.1.0.sql)

## Schema.sql Reference File

`backend/src/schema.sql` is a **documentation reference** and fallback schema. It shows the complete database schema but should not be edited manually.

### When Schema.sql is Used

1. **Fallback:** If baseline/v0.1.0.sql is missing or empty, setup-db.js applies schema.sql instead
2. **Reference:** Developers can read schema.sql to understand the database structure without applying migrations
3. **Documentation:** IDE type hints and schema exploration tools may use schema.sql

### Keeping Schema.sql in Sync

When you regenerate the baseline, also update schema.sql:

```bash
cd backend/src
# Dump the schema as it should be at latest state
pg_dump -U admin -d shotspot --schema-only -o schema.sql
# Or manually verify it matches baseline/v0.1.0.sql
```

Then add a comment at the top:
```sql
-- ==============================================================================
-- SHOTSPOT DATABASE SCHEMA - Reference snapshot
-- ==============================================================================
-- This represents the complete schema after all migrations.
-- Last synchronized with baseline: 2025-12-20
-- For the authoritative schema, see baseline/v0.1.0.sql and incremental migrations
-- ==============================================================================
```

---

## Best Practices

✅ **DO:**
- Use `IF NOT EXISTS` for idempotent migrations
- Add indexes for foreign keys and frequently queried columns
- Include comments explaining complex changes
- Test migrations locally before committing
- Run `npm run check-migrations` before pushing
- Keep migrations small and focused on one change

❌ **DON'T:**
- Modify existing migration files (create a new one instead)
- Commit without running `npm run check-migrations`
- Skip the migration consistency check
- Create migrations that depend on specific data existing
- Use DROP TABLE without CASCADE considerations
