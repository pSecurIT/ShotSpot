# ShotSpot v1.0.0 Release Readiness - GitHub Issue Breakdown

Use this document to create one parent issue and multiple subissues (one per phase). Each issue below includes a description and acceptance criteria.

---

## Main Issue (Parent)

### Title
Release Readiness: ShotSpot v1.0.0 Public Beta

### Description
Prepare ShotSpot for the first public beta release (v1.0.0) by closing key gaps in security hardening, feature completeness, documentation/version alignment, and test baseline quality.

This issue tracks four phase subissues:
- Phase 1: Security hardening
- Phase 2: Feature completion and behavior alignment
- Phase 3: Documentation and versioning cleanup
- Phase 4: Test coverage baseline improvements

Out of scope for v1.0.0:
- localStorage to httpOnly cookie migration
- CSP unsafe-inline removal requiring nonce/hash infrastructure
- Full password reset flow
- Native iOS/Android feature development beyond Capacitor wrapper

### Acceptance Criteria
- All four subissues are completed and linked to this parent issue.
- Backend rate limiting and auth protections are verified by tests/manual checks.
- Twizzit sync persists fetched data to database correctly.
- Series RBAC behavior is consistent between frontend and backend (coach + admin writes).
- Archived navigation proposal docs are removed.
- Versioning and changelog are aligned to v1.0.0 release date.
- Coverage targets are met: backend >= 80% statements, LiveMatch test coverage improved to >= 60%.
- Final verification checklist passes (lint, coverage, critical flows, E2E smoke confidence).

---

## Subissue 1 (Phase 1)

### Title
Phase 1: Security Hardening for v1.0.0

### Description
Fix security-critical and high-priority backend safeguards before release:

1. Fix global rate limiter skip logic in `backend/src/app.js` so it is not silently disabled in non-production environments.
2. Add auth-specific brute-force protection (`POST /api/auth/login`, `POST /api/auth/change-password`).
3. Remove `SESSION_SECRET` fallback to `JWT_SECRET` and enforce explicit `SESSION_SECRET` validation.
4. Harden CORS behavior by rejecting missing `Origin` in production while preserving valid dev/mobile behavior.

Target files:
- `backend/src/app.js`
- `backend/src/routes/auth.js`
- `backend/src/utils/validateEnv.js`

### Acceptance Criteria
- Rate limiter skip logic no longer uses `NODE_ENV !== 'production'` shortcut and is only bypassed where explicitly intended.
- Login and change-password endpoints have dedicated brute-force rate limiting.
- App startup fails with a clear validation error if `SESSION_SECRET` is missing.
- In production mode, requests with missing/invalid origin are rejected according to CORS policy.
- Existing auth and health flows continue to work in development and tests.
- Relevant automated tests are added/updated and passing.

---

## Subissue 2 (Phase 2)

### Title
Phase 2: Feature Completion and Behavior Alignment for v1.0.0

### Description
Resolve known functional gaps and inconsistent behavior:

1. Implement Twizzit sync persistence in `backend/src/services/twizzitService.js` for clubs, players, and seasons (currently TODO stubs).
2. Align Series RBAC to product decision: coach + admin can create/update/delete series (`backend/src/routes/series.js`).
3. Replace `MyAchievements` placeholder behavior with redirect to the existing achievements page.

Target files:
- `backend/src/services/twizzitService.js`
- `backend/src/routes/series.js`
- `frontend/src/components/MyAchievements.tsx`

### Acceptance Criteria
- `syncClubs()`, `syncPlayers()`, and `syncSeasons()` persist normalized data to DB using parameterized queries.
- Twizzit sync endpoints no longer behave as silent no-ops; sync results reflect persisted records.
- Coach users can perform series write actions end-to-end without backend 403 errors.
- `MyAchievements` route no longer shows placeholder/stub content and redirects cleanly to `/achievements`.
- Regression checks for Twizzit sync and Series RBAC are added/updated and passing.

---

## Subissue 3 (Phase 3)

### Title
Phase 3: Documentation and Versioning Cleanup for v1.0.0

### Description
Clean outdated docs and align release metadata:

1. Remove archived navigation historical files:
	- `NAVIGATION_PROPOSAL.md`
	- `NAVIGATION_IMPLEMENTATION_ISSUES.md`
2. Align frontend version to release:
	- `frontend/package.json` version `0.1.0` -> `1.0.0`
3. Resolve changelog release entry:
	- Merge `[Unreleased]` items into `[1.0.0]`
	- Set v1.0.0 release date to `2026-05-15`
	- Remove stale `[Unreleased]` header

Target files:
- `NAVIGATION_PROPOSAL.md` (delete)
- `NAVIGATION_IMPLEMENTATION_ISSUES.md` (delete)
- `frontend/package.json`
- `CHANGELOG.md`

### Acceptance Criteria
- Both archived navigation files are removed from the repository.
- `frontend/package.json` version equals `1.0.0`.
- `CHANGELOG.md` has a single coherent v1.0.0 section dated `2026-05-15` with merged release notes.
- No documentation references broken links to removed archived files.
- Lint/docs checks (if any) pass.

---

## Subissue 4 (Phase 4)

### Title
Phase 4: Test Coverage Baseline for v1.0.0

### Description
Raise confidence and enforce minimum quality gates:

1. Backend: increase statement coverage from 79.83% to >= 80% with targeted meaningful tests.
2. Frontend: increase `LiveMatch` coverage from ~34% to >= 60% by testing critical user flows:
	- shot submission
	- substitution capture
	- timer start/stop/next period
	- offline queue trigger

Target files:
- `backend/test/**`
- `frontend/src/test/LiveMatch.test.tsx`

### Acceptance Criteria
- Running backend coverage reports >= 80% statements.
- `LiveMatch` coverage reaches >= 60%.
- New tests validate real behavior (not shallow snapshot-only coverage gains).
- No regressions introduced in existing test suites.
- CI-relevant test commands complete successfully.

---

## Suggested Final Verification Checklist (for closing parent issue)

1. `npm run lint` passes at repo level.
2. `cd backend && npm run test:coverage` passes with >= 80% statements.
3. `cd frontend && npm run coverage` passes with `LiveMatch` >= 60%.
4. Manual auth rate-limit checks confirm 429 behavior for repeated failed login attempts.
5. Manual Twizzit sync check confirms database persistence for clubs/players/seasons.
6. Manual Series RBAC check confirms coach write operations succeed.
7. Route check confirms `/my-achievements` redirects to `/achievements`.
8. Changelog/version/docs cleanup is visible in final diff.
