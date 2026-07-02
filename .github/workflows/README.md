# GitHub Actions Workflows

This directory contains the repository CI, security, release, and mobile automation.

## Branch Policy

ShotSpot uses two merge-gate levels:

- `main`: stricter merge gate with approval, code-owner review, resolved threads, and the full required check set.
- Protected feature branches: lighter gate with approval, resolved threads, and fast feedback checks only.

Current intended required checks:

- `main`: `Backend Tests (22.x)`, `Frontend Tests (22.x)`, `Analyze (actions)`, `Analyze (javascript-typescript)`, `Scan for Secrets`, `Dependency License Check (backend)`, `Dependency License Check (frontend)`, external-app `Trivy`
- Protected feature branches: `Backend Tests (22.x)`, `Frontend Tests (22.x)`

If a workflow job name, matrix expansion, or trigger scope changes, verify the matching GitHub ruleset still references emitted check names.

## Code Scanning Policy

Code-scanning results should represent the default branch and scheduled/manual security baselines, not temporary PR state.

- Pull requests should still run blocking security checks where appropriate.
- SARIF uploads should be stable and category-based.
- SARIF uploads should prefer `push` to `main`, `schedule`, and `workflow_dispatch` over PR refs.
- The external-app `Trivy` integration remains the canonical required Trivy signal for branch protection.

## Workflow Summary

### Core CI

- `node.js.yml`: backend tests, frontend tests, and scheduled/mainline Snyk security checks.
- `test-coverage.yml`: coverage reporting and Codecov uploads.
- `validate-migrations.yml`: targeted migration validation.

### Security

- `codeql.yml`: CodeQL analysis for JavaScript/TypeScript and GitHub Actions.
- `secret-scan.yml`: Gitleaks-based secret scanning.
- `security-scan.yml`: Trivy-based container and filesystem scanning.
- `verify-action-pins.yml`: workflow action pin and SARIF category hygiene.

### Docker And Release

- `docker.yml`: Docker build validation, dependency lockfile checks, container scanning, and compose verification.
- `release.yml`: multi-platform production image publishing.
- `dependency-remediation.yml`: scheduled dependency remediation support.

### Mobile

- `mobile-ci.yml`: mobile validation scoped to `main` and mobile-relevant changes.
- `mobile-preview.yml`: manual preview builds.
- `mobile-release.yml`: mobile store release automation.
- `sync-dependabot-android.yml`: Android dependency automation support.

## Operational Notes

- Expensive mobile and Docker workflows should stay narrow in trigger scope.
- Checks used in GitHub rulesets must have stable names.
- Advisory workflows are useful, but only a small, dependable subset should block merges.
- If a code-scanning category is renamed, confirm old findings are intentionally retired or manually dismissed.

## When Updating Workflows

1. Keep action pins updated.
2. Preserve stable SARIF categories unless there is an intentional migration.
3. Re-check the repository rulesets after renaming any blocking job.
4. Update [e:\code\ShotSpot\CONTRIBUTING.md](e:\code\ShotSpot\CONTRIBUTING.md) if branch policy or merge gates change.
5. Prefer small, reviewable workflow changes over large CI rewrites.
