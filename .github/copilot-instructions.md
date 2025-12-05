# Copilot Instructions for ShotSpot

## Project Overview
**Korfball match statistics tracking app** - React 19 (TypeScript) + Node.js/Express + PostgreSQL monorepo with offline-first PWA capabilities and native mobile apps (iOS/Android via Capacitor).

**Core Purpose**: Real-time event tracking during korfball matches with shot location mapping, player statistics, timer management, and live analytics. Built for coaches to use on tablets/phones during live games. Includes Twizzit API integration for team/player synchronization with Belgian Korfball Federation.

## Architecture Essentials

### Stack & Structure
- **Frontend**: React 19 + TypeScript (Vite), Service Worker + IndexedDB for offline support
- **Backend**: Express 5 API with ES modules (import/export), JWT auth, role-based access
- **Database**: PostgreSQL with direct pg Pool queries (no ORM)
- **Mobile**: Capacitor.js for native iOS/Android builds from shared React codebase
- **Deployment**: Docker multi-stage builds, GitHub Actions CI/CD for web + mobile app stores
- **Monorepo**: Root package.json runs both via concurrently

### Critical Data Flows
1. **Authentication**: JWT in `Authorization: Bearer <token>` → auth middleware → requireRole(['admin', 'coach'])
2. **Database Access**: Always parameterized queries via `db.query(text, params)` - see backend/src/db.js
3. **Offline Sync**: Service worker caches API responses → IndexedDB queues writes → background sync on reconnect
4. **Twizzit Integration**: External API → backend/src/services/twizzit-*.js → encrypted DB storage → sync scheduler
5. **Real-time Reports**: GET /api/reports/* endpoints → live game data aggregation → frontend dashboards
6. **Migrations**: SQL files in backend/src/migrations/*.sql run alphabetically on DB init

### ⚠️ CRITICAL: Database Migration Protocol
**EVERY new migration file MUST be added to ALL three setup scripts:**
1. `backend/scripts/setup-db.js` - Production database setup
2. `backend/scripts/setup-test-db.js` - Test database setup
3. `backend/scripts/setup-parallel-dbs.js` - Parallel test databases

**Automated Safeguards:**
- Pre-commit hook: Blocks commits if migrations are missing from setup scripts
- GitHub Actions: `npm run check-migrations` runs before tests
- Local check: `cd backend && npm run check-migrations`

**When creating a new migration:**
1. Create SQL file in `backend/src/migrations/` (use descriptive name with prefix like `add_`, `create_`, `modify_`)
2. Add filename to migration arrays in ALL three setup scripts (alphabetical order)
3. Run `npm run check-migrations` to verify
4. Test locally with `npm run setup-test-db`
5. Commit will auto-verify via pre-commit hook

**If migration check fails:**
```bash
cd backend
npm run check-migrations  # See which migrations are missing
# Add missing migrations to all three scripts
npm run check-migrations  # Verify fix
```

### Key Architectural Decisions
- **No ORM**: Direct SQL for transparency and performance (see backend/src/routes/teams.js for patterns)
- **Serial Testing**: Jest `maxWorkers: 1` prevents DB race conditions in integration tests
- **Environment Logging**: All logs wrapped in `if (process.env.NODE_ENV !== 'test')` to reduce noise during testing
- **CSP Security**: Strict Content Security Policy with inline styles allowed for React (see backend/src/app.js)
- **Encrypted Credentials**: Twizzit API passwords encrypted using AES-256-CBC with `TWIZZIT_ENCRYPTION_KEY` env var
- **Mobile Native**: Capacitor.js generates native apps without code duplication - single React codebase serves web + iOS + Android

## Developer Workflows

### First-Time Setup
npm run install:all
cp backend/.env.example backend/.env
npm run setup-db
npm run dev

### Daily Development
```bash
npm run dev              # Concurrent backend (3001) + frontend (3000) with hot reload
npm run setup-db         # Reset database (clears all data!)

# Mobile development
cd frontend
npm run mobile:sync      # Sync web build to native projects
npm run mobile:android   # Open Android Studio
npm run mobile:ios       # Open Xcode (macOS only)

# Docker deployment (production-like)
docker-compose up -d     # Requires .env with DB_PASSWORD + JWT_SECRET
docker-compose logs -f   # View logs
```

**Important**: Backend serves built frontend in production. Must run `cd frontend && npm run build` before deploying.

### Testing Workflow
```bash
# Backend (Jest + Babel for ES modules)
cd backend
npm test                 # Serial execution, auto-creates shotspot_test_db
npm run test:coverage    # Requires 80%+ (90%+ for auth/validation)
npm run test:unit        # Unit tests only (fast)
npm run test:core-api    # Core API tests only
npm run test:game-logic  # Game logic tests only

# Frontend (Vitest + jsdom)
cd frontend
npm test                 # Watch mode
npm run coverage         # Generate report

# Linting
npm run lint             # Both frontend + backend
npm run lint:fix         # Auto-fix issues
```

### Test Structure Convention
Use emoji prefixes for test discoverability:
describe('Team Routes', () => {
  it('should create team with valid data', ...);      // Success path
  it('should reject duplicate team names', ...);      // Error handling
  it('should handle concurrent team creation', ...);  // Edge cases
});

**Coverage Mandate**: ALL new functionality requires 80%+ coverage before merge. Security-critical code (auth, validation) requires 90%+.

## Security Patterns

### Middleware Stack (order critical!)
In backend/src/app.js - applied in this exact order:
1. helmet()                    // CSP, HSTS, X-Frame-Options
2. rateLimit()                 // 1000 req/5min (skipped in tests)
3. cors()                      // CORS_ORIGIN validation
4. express.json()              // Body parser (10kb limit)
5. csrf.middleware             // CSRF protection
6. Custom headers              // Cache-Control for auth endpoints

### Authentication Implementation
Pattern from backend/src/routes/teams.js
import { auth, requireRole } from '../middleware/auth.js';

router.use(auth);  // All routes require authentication
router.post('/', requireRole(['admin', 'coach']), handler);  // Role-based access

**Role Hierarchy**: admin > coach > user (normalized to lowercase in middleware)

### Security Checklist for New Endpoints
- Use parameterized queries: db.query('SELECT * FROM x WHERE id = ', [id])
- Apply auth middleware to all routes
- Use requireRole() for write operations (POST/PUT/DELETE)
- Validate input with express-validator
- Never log tokens/passwords (use process.env.NODE_ENV !== 'test' guards)
- Return generic error messages in production (detailed in dev only)

## Documentation Quick Reference
- **Quick Start**: QUICKSTART.md - 5-minute setup guide
- **Installation**: INSTALLATION.md - Complete setup + 15+ troubleshooting solutions
- **Build Commands**: BUILD.md - Full command reference
- **Security Details**: SECURITY.md - Rate limits, CSRF, CSP headers, error handling
- **Offline Mode**: OFFLINE.md - Service worker, IndexedDB, sync queue architecture
- **Mobile Deployment**: MOBILE_DEPLOYMENT.md - iOS/Android app store releases, signing config
- **Twizzit Integration**: docs/TWIZZIT_INTEGRATION.md - External API sync, auth, mapping
- **Reports API**: REPORTS_API.md - Real-time analytics endpoints (live, period, momentum)
- **Docker Guide**: DOCKER.md - Container deployment, multi-stage builds, security hardening
