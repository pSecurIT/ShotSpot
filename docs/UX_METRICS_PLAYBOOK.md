# UX Metrics Playbook

## Goal

Prevent silent UI regressions by tracking UX performance and friction across key user flows and exposing metrics in an admin-only dashboard.

## What We Track

### 1) Flow timing

Event type: `flow_timing`

Metric name: `route_load_ms`

Tracked flows:
- `login_to_dashboard` (`/dashboard`)
- `open_games_list` (`/games`)
- `start_live_match` (`/match/:gameId`)
- `open_match_analytics` (`/analytics/:gameId`)

### 2) API latency impact

Event type: `api_latency`

Metric name: `api_latency_ms`

Tracked API surface (high impact on key flows):
- endpoints containing `/games`
- endpoints containing `/analytics`
- endpoints containing `/dashboard`
- endpoints containing `/achievements`
- login endpoint (`/auth/login`)

### 3) Client friction indicators

Event type: `long_task`
- Captured through `PerformanceObserver` for long tasks when browser support is available.

Event type: `slow_render`
- Captured when measured flow timing exceeds threshold.
- Current threshold: `1200 ms`.

### 4) Lightweight user feedback

Event type: `feedback`

Metric name: `smoothness_rating`

UI prompt appears in tracked pages (initial rollout: games and analytics) with two actions:
- `Yes` (rating 5)
- `Report issue` (rating 2)

Feedback metadata includes optional message and basic user context.

## Initial "Good" Baseline

Use these values as an operational starting point (not hard fail gates):

- P95 flow time (`route_load_ms`) < `1500 ms`
- P95 API latency (`api_latency_ms`) < `700 ms`
- Long-task count trend: non-increasing week-over-week
- Slow-render count trend: non-increasing week-over-week
- Negative feedback ratio (ratings <= 2): < `20%` of feedback events

## Dashboard Usage

Admin route:
- Frontend: `/ux-observability`
- Backend aggregates: `/api/dashboard/ux/*`

Recommended review cadence:
- Check 7-day window for daily operations.
- Check 30-day window before release cut or after major UI/API changes.

## Data Notes

- Data is persisted in `ux_metric_events`.
- Events are batched client-side and sent asynchronously.
- Payload failures are non-blocking to user interactions.

## Known Limits

- Long-task observer availability depends on browser support.
- Route timing is based on tracked flow start/end markers and may not include every async post-render operation.
- Feedback prompt is intentionally lightweight and currently scoped to key flow pages.

## Next Improvements

- Add richer feedback categories (navigation, clarity, responsiveness).
- Add endpoint-level percentile trend charts in the admin dashboard.
- Add release-over-release benchmark snapshots.
