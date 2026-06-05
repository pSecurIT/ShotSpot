# Issue 424 Performance Baseline and Checkpoints

## Scope
Target screens for first-wave optimization:
- LiveMatch
- LiveDashboard
- Dashboard

Phase-1 scope is frontend-only.

## Budgets
Use these as pass/fail thresholds during implementation:

| Metric | Target |
|---|---|
| LiveMatch interaction latency (tap to visual response) | <= 100 ms |
| LiveMatch long tasks during rapid event entry | none > 50 ms |
| LiveMatch timer-related React commit duration | median <= 12 ms |
| LiveDashboard refresh commit duration | median <= 16 ms |
| Dashboard route revisit data ready (cached path) | <= 300 ms |
| List/timeline scroll smoothness | no visible stutter at 60 Hz |

## Baseline Capture Procedure
1. Build and run in normal dev mode.
2. Open Chrome DevTools Performance and React Profiler.
3. Record each target screen in two scenarios:
   - cold navigation (first load)
   - warm navigation (return visit)
4. For LiveMatch, record a 30-second rapid-capture sequence:
   - shot entries
   - substitutions
   - period controls
   - focus mode toggle in/out
5. Export traces and keep filenames with timestamp and scenario.

## Measurement Checklist
For each screen, capture:
- Time to first usable interaction
- Number of long tasks (> 50 ms)
- Median React commit duration
- Max React commit duration
- Notable rerender hotspots (component names)

## Automated Sampling Policy
The Cypress baseline now records repeated samples for warm-route and interaction metrics and stores:

- `samples`: raw measured values
- `median`: primary comparison value used for budgets
- `p90`: tail-latency reference
- `min` / `max`
- `sampleCount`

Use medians for regression decisions. Single-run values are too noisy for reliable comparisons.

## Before/After Table
Fill this table after each optimization slice.

| Screen | Scenario | Before | After | Delta | Notes |
|---|---|---:|---:|---:|---|
| LiveMatch | rapid-capture latency | TBD | 91.2 ms | TBD | Cypress electron proxy: focus-mode toggle median across 5 samples |
| LiveMatch | long tasks count | TBD | 19 | TBD | Cypress long-task observer during 25 rapid tab switches (over budget) |
| LiveMatch | median commit | TBD | N/A | TBD | Needs React Profiler capture |
| LiveDashboard | refresh median commit | TBD | N/A | TBD | Needs React Profiler capture |
| Dashboard | warm revisit data ready | TBD | 545 ms | TBD | Cypress route-ready proxy (over budget vs 300 ms target) |

## Automated Checkpoint (2026-04-12)
Executed headless Cypress baseline spec:

- Command: `npx cypress run --spec cypress/e2e/performance-baseline-424.cy.ts --browser electron`
- Results file: `frontend/cypress/results/performance-baseline-424.json`
- Scope: mocked API responses, frontend render and interaction timings only

Captured values:

| Metric | Value |
|---|---:|
| Dashboard route ready (cold) | 600 ms |
| Dashboard route ready (warm) | 545 ms |
| Games route ready (cold) | 555 ms |
| Games route ready (warm) | 537 ms |
| LiveMatch route ready (cold) | 754 ms |
| LiveMatch route ready (warm) | 790 ms |
| LiveMatch focus toggle latency (median) | 91.2 ms |
| LiveMatch long tasks > 50 ms | 19 |

## CI Budget Gate
Automated performance checks now include a budget assertion step:

- Baseline capture: `npm run perf:baseline` (runs the dedicated Cypress baseline spec)
- Strict budget checks: `npm run perf:assert`
- Combined CI command: `npm run perf:ci`
- Optional non-blocking check for local diagnostics: `npm run perf:assert:soft`

Issue #245 additions:

- Bundle analysis report: `npm --prefix frontend run build:analyze` (outputs `frontend/dist/stats.html`)
- Lighthouse/FCP/TTI capture: `npm --prefix frontend run perf:lighthouse`
- Hybrid policy in `perf:assert`:
   - Blocking: Lighthouse score must be >= 90
   - Non-blocking warnings: FCP < 1.5s and TTI < 3.5s targets are reported in output

Budget checks now evaluate `median` when available, and fall back to legacy `value` only for older result files.

Current status from the latest median-based run:

- Pass: Dashboard warm route ready (median 220 ms <= 300 ms, p90 234 ms)
- Pass: LiveMatch focus toggle latency (median 63.5 ms <= 100 ms, p90 112.7 ms)
- Fail: LiveMatch long tasks > 50 ms (median 54 > 0, p90 56)

## Issue #245 Verification Snapshot (2026-05-03)

Performance optimization implementation added:

- Expanded route-level lazy loading in `frontend/src/App.tsx` (Dashboard, Games, LiveMatch)
- Granular route/vendor chunking and analyzer support in `frontend/vite.config.ts`
- Virtual scrolling on large lists:
   - `frontend/src/components/AchievementGallery.tsx`
   - `frontend/src/components/Leaderboard.tsx`
   - `frontend/src/components/LeagueStandings.tsx`
- Memoization improvements in high-frequency list/filter code:
   - `frontend/src/components/PlayerManagement.tsx`
   - `frontend/src/components/LeagueStandings.tsx`
   - `frontend/src/components/StandingsRow.tsx`
- Image lazy-loading on court-heavy views:
   - `frontend/src/components/CourtVisualization.tsx`
   - `frontend/src/components/InteractiveShotChart.tsx`
   - `frontend/src/components/ShotAnalytics.tsx`
- Navigation/runtime cache updates in `frontend/public/service-worker.js`

Lighthouse desktop-profile checkpoint from `frontend/cypress/results/lighthouse-summary.json`:

- Score: 100 (pass)
- FCP: 117 ms (pass vs < 1500 ms)
- TTI: 117 ms (pass vs < 3500 ms)

Notes:

- Cypress baseline route/long-task budgets can still fail independently of Lighthouse because they measure separate runtime interaction paths.
- Keep both checks: Lighthouse for initial-load quality, Cypress baseline for interaction regressions.

## Temporary Rollback A/B (2026-04-12)
To validate net impact, performance app changes were temporarily rolled back, measured, and then restored.

Snapshot files:

- Optimized snapshot before rollback: `frontend/cypress/results/performance-baseline-424.optimized.json`
- Reverted snapshot (temporary rollback): `frontend/cypress/results/performance-baseline-424.reverted.json`
- Restored optimized snapshot (current): `frontend/cypress/results/performance-baseline-424.json`

### Optimized (pre-rollback) vs Reverted

| Metric | Optimized | Reverted | Delta (optimized - reverted) |
|---|---:|---:|---:|
| Dashboard route ready (cold) | 584 ms | 585 ms | -1 ms |
| Dashboard route ready (warm) | 565 ms | 557 ms | +8 ms |
| Games route ready (cold) | 528 ms | 528 ms | 0 ms |
| Games route ready (warm) | 520 ms | 526 ms | -6 ms |
| LiveMatch route ready (cold) | 707 ms | 683 ms | +24 ms |
| LiveMatch route ready (warm) | 837 ms | 691 ms | +146 ms |
| LiveMatch focus toggle latency | 72.9 ms | 31 ms | +41.9 ms |
| LiveMatch long tasks > 50 ms | 9 | 0 | +9 |

### Restored Optimized (current)

| Metric | Restored optimized |
|---|---:|
| Dashboard route ready (cold) | 600 ms |
| Dashboard route ready (warm) | 518 ms |
| Games route ready (cold) | 520 ms |
| Games route ready (warm) | 530 ms |
| LiveMatch route ready (cold) | 717 ms |
| LiveMatch route ready (warm) | 773 ms |
| LiveMatch focus toggle latency | 69.3 ms |
| LiveMatch long tasks > 50 ms | 6 |

Interpretation:

- Dashboard warm route remains significantly above the 300 ms budget in all snapshots.
- LiveMatch long-task counts are highly sensitive to runtime conditions, but remain over budget in restored optimized state.
- The rollback experiment indicates current Cypress proxy metrics do not yet show a consistent net win from all frontend optimizations, so the next iteration should focus on hotspot-level profiling (React Profiler + Chrome Performance) before further refactors.

## Post-Do-Both Run (2026-04-16)
After tightening the Cypress harness, applying an additional Dashboard warm-path deferral for Quick Actions, switching the baseline to repeated-sample median/p90 reporting, and adding per-tab long-task diagnostics:

| Metric | Value |
|---|---:|
| Dashboard route ready (warm, median / p90) | 220 ms / 234 ms |
| Games route ready (warm, median / p90) | 514 ms / 553 ms |
| LiveMatch route ready (warm, median / p90) | 944 ms / 986 ms |
| LiveMatch focus toggle latency (median / p90) | 63.5 ms / 112.7 ms |
| LiveMatch long tasks > 50 ms (median / p90) | 54 / 56 |

Per-tab LiveMatch long-task medians (interaction diagnostics):

| Tab | Median long tasks > 50 ms | P90 |
|---|---:|---:|
| Timeline | 10 | 12 |
| Faults | 11 | 13 |
| Timeouts | 10 | 12 |
| Free Shots | 10 | 12 |
| Commentary | 9 | 11 |

Status:

- Dashboard warm route is now within budget (median 220 ms <= 300 ms)
- LiveMatch focus toggle remains within budget on median (63.5 ms <= 100 ms), with moderate tail pressure (p90 112.7 ms)
- LiveMatch long tasks remain over budget (median 54 > 0), with pressure distributed across all tab switches rather than a single dominant tab

## Implemented in First Slice
- Added GET cache + in-flight request dedupe + prefetch helpers in frontend API utility.
- Wired Dashboard reads to cached path with fallback-safe behavior.
- Added live-route prefetch for hot endpoints in LiveMatch.
- Reduced LiveMatch roster validation lookup cost with memoized player maps.
- Reduced MatchTimeline polling churn by:
  - skipping state writes when normalized data signatures are unchanged
  - avoiding loading-state toggles for background interval refreshes

## Guardrails
- Do not change live event ordering semantics.
- Do not change offline queue behavior.
- Do not regress focus-mode state continuity.
- Prefer measured improvements over speculative refactors.
