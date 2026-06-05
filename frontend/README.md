# Frontend Development Guide

This guide documents the current ShotSpot frontend architecture, including the new navigation model and API client surface.

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Run tests:

```bash
npm test
npm run coverage
```

4. Build for production:

```bash
npm run build
npm run preview
```

## Project Structure

```text
frontend/
|- src/App.tsx                 Route map and protected route wiring
|- src/components/Navigation.tsx
|- src/components/NavigationDropdown.tsx
|- src/components/NavigationItem.tsx
|- src/components/MobileMenu.tsx
|- src/config/navigation.ts    Role-based navigation tree
|- src/hooks/useNavigation.ts  Role filtering and badge/divider logic
|- src/services/*.ts           Domain API clients
|- src/utils/api.ts            Shared axios client, CSRF, offline queueing, cache helpers
|- src/styles/Navigation.css   Navigation styling
```

## Navigation Structure

Navigation is configured in `src/config/navigation.ts` and rendered by `src/components/Navigation.tsx`.

- Top-level groups: Dashboard, Matches, Analytics, Data, Settings
- Role filtering: user, coach, admin
- Desktop behavior: grouped dropdowns with badges and active-state detection
- Tablet/mobile behavior: hamburger-triggered `MobileMenu` with the same role-filtered tree
- Utility flows: profile, password change, achievements, help/onboarding

### Navigation Components

- `Navigation.tsx`: responsive shell, user actions, mobile/desktop switching
- `NavigationDropdown.tsx`: reusable grouped dropdown menus
- `NavigationItem.tsx`: item-level rendering and states
- `MobileMenu.tsx`: small-screen navigation drawer
- `useNavigation.ts`: filters the tree by role and normalizes dividers/admin badges

## Route Coverage

`src/App.tsx` includes route entries for the navigation update:

- Matches: `/games`, `/match/:gameId`, `/templates`
- Analytics: `/analytics/:gameId`, `/advanced-analytics`, `/team-analytics`, `/ux-observability`
- Data: `/players`, `/teams`, `/clubs`, `/competitions`, `/series`
- Settings: `/exports`, `/report-templates`, `/scheduled-reports`, `/settings`, `/twizzit`, `/users`

## API Client Methods

The following API clients back the new navigation and feature pages.

### Core Client (`src/utils/api.ts`)

- `getWithCache(url, config, options)`
- `prefetchGet(url, config, options)`
- `clearGetCache()`
- `resetCsrfToken()`
- `getCsrfToken()`

### Competition And Data APIs

- `clubsApi`: `getAll`, `getById`, `create`, `update`, `delete`, `getTeams`, `getPlayers`
- `competitionsApi`: `list`, `getById`, `create`, `update`, `delete`, `getTeams`, `addTeam`, `removeTeam`, `getBracket`, `generateBracket`, `updateBracketMatch`, `getStandings`, `initializeStandings`, `updateStandings`, `updateStandingPoints`
- `seriesApi`: `list`, `getById`, `create`, `update`, `delete`
- `seasonsApi`: `list`

### Analytics APIs

- `advancedAnalyticsApi`: `formTrends`, `fatigue`, `nextGame`, `playerComparison`, `leagueAverages`, `historicalBenchmarks`, `linkVideoEvent`, `videoEvents`, `videoHighlights`, `videoReportData`
- `teamAnalyticsApi`: `seasonOverview`, `momentum`, `strengthsWeaknesses`

### Reporting And Settings APIs

- `reportTemplatesApi`: `getAll`, `create`, `update`, `remove`
- `scheduledReportsApi`: `getAll`, `create`, `update`, `remove`, `runNow`, `getHistory`
- `settingsApi`: `getExportSettings`, `updateExportSettings`, `resetExportSettings`

## Testing

- Unit and component tests: Vitest + React Testing Library
- E2E tests: Cypress
- Navigation test coverage: `src/test/Navigation.test.tsx`
- API client test coverage: `src/test/*.test.ts`

## Visual Assets

Screenshots and GIF references for the navigation update are documented in:

- `docs/USER_GUIDE.md`
- `docs/NAVIGATION_GUIDE.md`