# Copilot Instructions for ShotSpot

## What This Is
Korfball match stats app (web + mobile) with offline-first React 19 frontend, Express/PostgreSQL backend, and Capacitor-native builds. Goal: fast sideline event capture, live analytics, Twizzit sync.

## Architecture Map
- Monorepo: React 19 + TypeScript via Vite in frontend/, Express 5 ESM API in backend/, PostgreSQL with direct pg Pool (no ORM).
- Offline flow: service worker caches + IndexedDB write queue → background sync when online (see OFFLINE.md).
- AuthZ: JWT bearer → auth middleware → requireRole; role order admin > coach > user. Middleware order in backend/src/app.js is fixed (helmet → rateLimit → cors → json → csrf → custom headers).
- Reporting: /api/reports/* aggregations power live/period/momentum dashboards (see REPORTS_API.md).
- Twizzit: backend/src/services/twizzit-*.js integrates Belgian federation API with AES-256-CBC secrets (TWIZZIT_ENCRYPTION_KEY) and scheduled syncs (docs/TWIZZIT_INTEGRATION.md).

## Setup & Run
- Install all: npm run install:all from repo root.
- Env: copy backend/.env.example to backend/.env and set DB_PASSWORD, JWT_SECRET, TWIZZIT_ENCRYPTION_KEY.
- DB init/reset: npm run setup-db (drops data).
- Dev servers: npm run dev (root) runs backend on 3001 + frontend on 3000 concurrently.
- Prod-ish: cd frontend && npm run build, then cd backend && npm start (backend serves built frontend). Docker: docker-compose up -d using .env.docker.example template.
- Mobile: in frontend/ use npm run mobile:sync, npm run mobile:android, npm run mobile:ios for Capacitor targets.

## Testing & Quality
- Backend Jest runs serially (maxWorkers: 1). Commands: npm test, npm run test:unit, npm run test:core-api, npm run test:game-logic, npm run test:coverage (80%+ overall, 90%+ auth/validation).
- Frontend Vitest: npm test, npm run coverage. E2E via npm run cypress:open / cypress:run.
- Lint: npm run lint (root) or npm run lint:fix.
- Tests use emoji prefixes for describe/it blocks for quick scanning.

## Migrations (Do Not Break This)
- SQL lives in backend/src/migrations/ and is applied alphabetically.
- Every new migration filename must be added to all three scripts: backend/scripts/setup-db.js, backend/scripts/setup-test-db.js, backend/scripts/setup-parallel-dbs.js (paths differ; keep alphabetical).
- Safety net: cd backend && npm run check-migrations (runs in CI and pre-commit). Use npm run setup-test-db to recreate test DB after adding migrations.

## Backend Patterns
- Always parameterize queries via backend/src/db.js (`db.query(text, params)`); no ORM.
- Apply auth + requireRole on routes (see backend/src/routes/teams.js for pattern) and keep logging wrapped in if (process.env.NODE_ENV !== 'test').
- Security headers/CSP configured in backend/src/app.js; keep body parser limit 10kb and rateLimit skip in tests.

## Frontend Patterns
- React + TS with Vite; feature-based structure in frontend/src. Use axios for API calls, type responses, and keep loading/error UI.
- Offline data comes from IndexedDB cache/queue; ensure API changes consider sync queue durability.

## Documentation Pointers
- Root overview: README.md. Offline details: OFFLINE.md. Security/CSP/rate limits: SECURITY.md. Commands: BUILD.md. Twizzit: docs/TWIZZIT_INTEGRATION.md. Reports: REPORTS_API.md. Mobile: MOBILE_DEPLOYMENT.md and MOBILE_RELEASE.md.
