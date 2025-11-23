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

**3. Add to setup-db.js**
```javascript
const migrations = [
  // ... existing migrations ...
  'add_login_history.sql',
  'add_player_stats_table.sql',  // ← Add here (alphabetical order)
  'add_seasons.sql',
  // ... rest of migrations ...
];
```

**4. Add to setup-test-db.js**
```javascript
const migrations = [
  // ... existing migrations ...
  'add_login_history.sql',
  'add_player_stats_table.sql',  // ← Add here (same order)
  'add_seasons.sql',
  // ... rest of migrations ...
];
```

**5. Add to setup-parallel-dbs.js**
```javascript
const migrations = [
  // ... existing migrations ...
  '../src/migrations/add_login_history.sql',
  '../src/migrations/add_player_stats_table.sql',  // ← Add here (note the path)
  '../src/migrations/add_seasons.sql',
  // ... rest of migrations ...
];
```

**6. Verify consistency**
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

Checking setup-db.js...
  ✅ All migrations present

Checking setup-test-db.js...
  ✅ All migrations present

Checking setup-parallel-dbs.js...
  ✅ All migrations present

✅ All migration checks passed!
```

**7. Test the migration locally**
```bash
npm run setup-test-db  # Recreates test database with all migrations
npm test                # Run tests to ensure nothing broke
```

**8. Commit (pre-commit hook will auto-verify)**
```bash
git add backend/src/migrations/add_player_stats_table.sql
git add backend/scripts/*.js
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
- Commit without adding to all three setup scripts
- Skip the migration consistency check
- Create migrations that depend on specific data existing
- Use DROP TABLE without CASCADE considerations
