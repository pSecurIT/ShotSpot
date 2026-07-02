# Contributing to ShotSpot

Thanks for contributing. ShotSpot is built for reliability during live korfball workflows, so contributions should optimize for clarity, correctness, and maintainability over cleverness.

## Before You Start

- Check open issues and existing pull requests before starting overlapping work.
- Prefer small, reviewable pull requests with a single clear goal.
- If your change affects behavior, document the user-facing impact in the pull request.
- If your change affects docs, security, migrations, or deployment, update the relevant documentation in the same branch.

## Local Setup

From the repository root:

```bash
npm run install:all
cp backend/.env.example backend/.env
npm run setup-db
npm run dev
```

The standard local endpoints are:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

## Recommended Workflow

1. Create or pick an issue.
2. Branch from the current mainline.
3. Make the smallest change that solves the underlying problem.
4. Add or update tests when code behavior changes.
5. Run the relevant checks locally before opening a pull request.
6. Write a pull request description that explains motivation, approach, and verification.

## Branch Protection And Merge Gates

ShotSpot uses different merge gates for `main` and protected feature branches.

- `main` is the strict branch. Pull requests to `main` should expect approval, resolved review threads, and the full required check set configured in GitHub.
- Protected feature branches are intentionally lighter. They should only require fast feedback checks and review, not the full `main` security and compliance surface.
- Required checks are defined in GitHub rulesets. Workflow files in `.github/workflows/` must continue to emit the exact check names referenced by those rulesets.
- If a workflow trigger or job name changes, update the matching ruleset and documentation in the same change.

Current working model:

- `main`: backend tests, frontend tests, CodeQL, secret scan, license checks, and external `Trivy` protection.
- Protected feature branches: backend tests and frontend tests, plus approval and review thread resolution.

## Quality Checks

Run these before opening a pull request:

```bash
npm run lint
npm --prefix frontend run test:run
npm --prefix frontend run build
npm --prefix backend run test
```

If your change is limited to documentation or repository metadata, state that clearly in the pull request and run the subset of checks that still applies.

If your change touches GitHub Actions workflows, rulesets, release automation, or repository policy files, also review:

- `.github/workflows/README.md`
- `.github/CODEOWNERS`
- The repository rulesets in GitHub settings

## License Compliance Policy

ShotSpot enforces dependency and container base image license checks in CI.

- Policy configuration lives in `.licenserc.json`.
- CI fails if denied licenses are detected, including GPL/AGPL family licenses.
- License checks run for backend dependencies, frontend dependencies, and Docker base images.

Run license checks locally before opening a pull request:

```bash
# Backend dependencies
npm --prefix backend ci --ignore-scripts
npx --yes license-checker-rseidelsohn \
   --start backend \
   --production \
   --summary \
   --excludePrivatePackages \
   --onlyAllow "$(jq -r '.allowedLicenses | join(";")' .licenserc.json)"

# Frontend dependencies
npm --prefix frontend ci --ignore-scripts
npx --yes license-checker-rseidelsohn \
   --start frontend \
   --production \
   --summary \
   --excludePrivatePackages \
   --onlyAllow "$(jq -r '.allowedLicenses | join(";")' .licenserc.json)"
```

## Frontend Expectations

- Use TypeScript and keep component APIs explicit.
- Preserve loading, error, and offline-aware behavior.
- Add or update Vitest coverage when component or UI behavior changes.
- Keep changes aligned with the existing design language unless the issue explicitly calls for a redesign.

## Backend Expectations

- Use parameterized queries through `backend/src/db.js`.
- Preserve authentication and authorization middleware behavior.
- Keep request validation and security controls intact.
- Add or update Jest coverage when route or service behavior changes.

## Migration Rules

Migration changes have extra requirements. Do not skip them.

1. Add SQL files under `backend/src/migrations/` using sortable names.
2. Keep migration ordering alphabetical and consistent.
3. If you add a new migration file, update all three setup scripts:
   - `backend/scripts/setup-db.js`
   - `backend/scripts/setup-test-db.js`
   - `backend/scripts/setup-parallel-dbs.js`
4. Validate migrations before opening a pull request:

```bash
cd backend
npm run check-migrations
npm run setup-test-db
```

5. Update [docs/MIGRATIONS.md](docs/MIGRATIONS.md) if process or structure changes.

## Documentation Changes

Documentation contributions are first-class work.

- Keep the root [README.md](README.md) accurate and approachable.
- Update feature-specific docs when behavior, APIs, or operational steps change.
- Prefer concrete commands, short examples, and direct links over vague prose.

## Pull Request Guidance

Include:

- What changed
- Why it changed
- How you verified it
- Any follow-up work or known limitations

If screenshots or UI changes are relevant, include before-and-after visuals in the pull request.

## Conduct

Contributors are expected to keep discussions respectful, technically constructive, and focused on improving the project.
