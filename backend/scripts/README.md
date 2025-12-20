# Backend Scripts Documentation

This directory contains utility scripts for database setup, migrations, testing, and Twizzit integration.

## Database Setup Scripts

### `setup-db.js`
**Purpose**: Initialize or reset the main development database  
**Usage**: `npm run setup-db` (from backend directory)  
**What it does**:
- Drops and recreates the database and user
- Applies baseline schema from `migrations/baseline/v0.1.0.sql`
- Runs all post-baseline migrations in alphabetical order
- Used for local development environment setup

**Required env vars**: `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_HOST`, `DB_PORT`, `POSTGRES_PASSWORD`

### `setup-test-db.js`
**Purpose**: Initialize test database for running test suites  
**Usage**: Automatically run before tests via `npm test`  
**What it does**:
- Creates isolated test database
- Applies schema and migrations via shared migration runner
- Grants permissions to test user
- Ensures trainer_assignments table exists (safety net)

**Required env vars**: `DB_USER`, `DB_PASSWORD`, `DB_NAME` (or uses defaults for testing)

### `setup-parallel-dbs.js`
**Purpose**: Create multiple isolated test databases for parallel test execution  
**Usage**: `npm run setup-parallel-dbs`  
**What it does**:
- Creates 3 separate test databases (main, core-api, game-logic)
- Each database gets full schema + migrations
- Enables running test suites in parallel without interference
- Used in CI/CD pipelines for faster test execution

**Required env vars**: `DB_NAME`, `DB_NAME_CORE_API`, `DB_NAME_GAME_LOGIC`, `POSTGRES_USER`, `POSTGRES_PASSWORD`

## Migration Utilities

### `lib/run-migrations.js`
**Purpose**: Shared migration runner used by all setup scripts  
**What it does**:
- Applies baseline schema (`migrations/baseline/v0.1.0.sql`)
- Reads baseline manifest to skip already-included migrations
- Applies post-baseline migrations in sorted order
- Provides consistent migration behavior across all environments

**Note**: This is a library, not run directly

### `check-migrations.js`
**Purpose**: Verify migration consistency before commits  
**Usage**: `npm run check-migrations` or run automatically before tests  
**What it does**:
- Checks baseline manifest against actual migration files
- Ensures no migrations are missing or orphaned
- Validates baseline file exists and is non-empty
- Prevents deployment of inconsistent migration state

**Used in**: Pre-commit hooks, CI/CD pipelines, pretest script

### `baseline-generate.sh`
**Purpose**: Regenerate schema baseline from a fully migrated database  
**Usage**: `DATABASE_URL=postgres://... ./scripts/baseline-generate.sh`  
**What it does**:
- Exports schema-only dump from a clean, fully migrated DB
- Saves to `migrations/baseline/v0.1.0.sql`
- Used when consolidating migrations or creating major version baseline

**⚠️ Warning**: Only run this when creating a new baseline version. Must be coordinated with team.

## Admin & Deployment

### `init-default-admin.js`
**Purpose**: Create default admin user on first deployment  
**Usage**: Run automatically on server startup, or manually via `node scripts/init-default-admin.js`  
**What it does**:
- Checks if admin user exists
- Creates admin with secure password (auto-generated or from env)
- Forces password change on first login
- Idempotent - safe to run multiple times

**Env vars**: `DEFAULT_ADMIN_USERNAME`, `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD` (optional)

**Security**: Passwords are bcrypt-hashed, auto-generated passwords meet complexity requirements

### `pre-deploy.js`
**Purpose**: Pre-deployment health checks  
**Usage**: `npm run pre-deploy`  
**What it does**:
- Validates environment variables
- Tests database connection
- Verifies required files exist
- Checks dependency installation
- Runs security audit

**Use case**: Run before production deployments to catch issues early

## Twizzit Integration Scripts

### `store-twizzit-credentials.js`
**Purpose**: Store encrypted Twizzit API credentials in database  
**Usage**: `npm run twizzit:store-credentials [org] [username] [password] [endpoint]`  
        or: `node scripts/store-twizzit-credentials.js [org] [username] [password] [endpoint]`  
**What it does**:
- Encrypts password using AES-256-CBC
- Stores credentials in `twizzit_credentials` table
- Returns credential ID for use in API calls

**Required env var**: `TWIZZIT_ENCRYPTION_KEY`

**Interactive mode**: Run without arguments for prompts

**Example**: `npm run twizzit:store-credentials`

### `test-twizzit-connection.js`
**Purpose**: Verify Twizzit API connectivity with stored credentials  
**Usage**: `npm run twizzit:test-connection <credential_id>`  
        or: `node scripts/test-twizzit-connection.js <credential_id>`  
**What it does**:
- Retrieves and decrypts stored credentials
- Tests authentication endpoint
- Fetches organizations and groups to verify API access
- Updates last verification timestamp

**Example**: `npm run twizzit:test-connection 1`

### `diagnose-twizzit.js`
**Purpose**: Troubleshoot Twizzit API connectivity issues  
**Usage**: `npm run twizzit:diagnose <credential_id>`  
        or: `node scripts/diagnose-twizzit.js <credential_id>`  
**What it does**:
- Tests base URL connectivity
- Checks health and auth endpoints
- Tries common API endpoint variations
- Provides troubleshooting recommendations

**Use case**: When API connection fails, run this for detailed diagnostics

**Example**: `npm run twizzit:diagnose 1`

### `update-twizzit-endpoint.js`
**Purpose**: Update API endpoint URL for existing credentials  
**Usage**: `node scripts/update-twizzit-endpoint.js <credential_id> <new_endpoint>`  
**What it does**:
- Updates stored endpoint URL (e.g., if Twizzit changes their API URL)
- Validates credential exists and is active

**Examples**:
```bash
node scripts/update-twizzit-endpoint.js 1 https://app.twizzit.com
node scripts/update-twizzit-endpoint.js 2 https://api.twizzit.be/v1
```

**Note**: This script does not have an npm alias. Use the direct node command.

## Script Maintenance

### Adding New Scripts
1. Add script to `backend/scripts/` directory
2. Add npm script alias in `backend/package.json` if needed
3. Document in this README
4. Add to `.gitignore` if it creates temporary files

### Migration Best Practices
- Always run `check-migrations` before committing migration files
- Test migrations on clean database before deploying
- Never modify existing migration files after they've been deployed
- Keep migrations idempotent when possible
- Add new migrations with descriptive names (e.g., `add_feature_name.sql`)

### Security Notes
- Never commit files with hardcoded credentials
- Use environment variables for all sensitive data
- Encryption keys must be at least 32 bytes (64 hex chars)
- Test scripts should use isolated test databases

## Quick Reference

| Task | Command |
|------|---------|
| Setup dev database | `npm run setup-db` |
| Setup test database | `npm run setup-test-db` |
| Check migration consistency | `npm run check-migrations` |
| Store Twizzit credentials | `npm run twizzit:store-credentials` |
| Test Twizzit connection | `npm run twizzit:test-connection <id>` |
| Diagnose Twizzit issues | `npm run twizzit:diagnose <id>` |
| Pre-deployment checks | `npm run pre-deploy` |

## Troubleshooting

**"Migration check failed"**: Run `npm run check-migrations` to see details. Ensure all migration files listed in `baseline/manifest.json` either exist or are included in the baseline.

**"Database connection failed"**: Check `.env` file has correct credentials. Verify PostgreSQL is running.

**"TWIZZIT_ENCRYPTION_KEY not found"**: Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**"Permission denied on database"**: Ensure `POSTGRES_PASSWORD` is set correctly for setup scripts.
