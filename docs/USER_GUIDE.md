# ShotSpot User Guide

This guide explains the day-to-day user flow with the updated navigation and feature set.

## 1. Navigation Overview

After login, ShotSpot groups features by intent:

- Dashboard: high-level status and quick access
- Matches: game management, live match capture, templates
- Analytics: game analytics, achievements, advanced analytics, team analytics
- Data: players, teams, clubs, competitions, series/divisions
- Settings: exports, report templates, scheduled reports, Twizzit, profile/security

## 2. Role-Based Access

- user:
  - Can access operational pages (games, live match, players/teams)
  - Can access personal profile and achievements
- coach:
  - Includes user access plus data/reporting pages
  - Can access clubs, competitions, series, report templates, scheduled reports
- admin:
  - Includes coach access plus admin-only pages
  - Can access user management and UX observability dashboard

## 3. Common Workflows

### Start match-day tracking

1. Open Matches -> All Games
2. Create or select a game
3. Open Live Match to track shots, fouls, substitutions, and events
4. Open Analytics for post-game review

### Build competition structure

1. Open Data -> Competitions
2. Create competition (league or tournament)
3. Add teams and configure format
4. Open bracket/standings views for progression and ranking

### Configure recurring reports

1. Open Settings -> Report Templates
2. Create template and section layout
3. Open Scheduled Reports
4. Configure cadence and recipients

## 4. Screenshots And GIFs

The repository includes base visuals used by the navigation documentation:

![ShotSpot logo](../frontend/src/img/shotspot-mark.svg)
![ShotSpot icon](../frontend/public/favicon.svg)
![Korfball court context](../frontend/src/img/Korfbalveld-breed.PNG)

Suggested capture list for release notes and onboarding GIFs:

- Desktop navigation dropdown interactions (Matches, Analytics, Data, Settings)
- Mobile hamburger menu expansion and role-aware item visibility
- Competition setup flow (create competition -> add teams -> open bracket)
- Scheduled report creation flow

## 5. Troubleshooting

- Missing menu item: verify your role and assignment in the current environment
- Live match not opening from menu: open Matches -> All Games and start from a selected game
- Permission error on competitions/reports: coach or admin role is required

## 6. Related Docs

- [NAVIGATION_GUIDE.md](NAVIGATION_GUIDE.md)
- [COMPETITION_MANAGEMENT.md](COMPETITION_MANAGEMENT.md)
- [ACCESSIBILITY_AUDIT.md](ACCESSIBILITY_AUDIT.md)
- [../QUICKSTART.md](../QUICKSTART.md)

## 7. Accessibility Quick Tips

ShotSpot includes accessibility support for keyboard and assistive-technology workflows.

- Use the "Skip to main content" link at the top of the page to bypass repeated navigation.
- Open top navigation dropdowns with Enter or Space, then move through items with Arrow keys.
- Close dropdowns, dialogs, and the mobile menu with Escape.
- In mobile menu and dialogs, focus stays within the open panel until you close it.
- Form errors are announced in alert regions where available, and most status updates use polite live regions.

If you are validating with assistive technology, use the checklist in [ACCESSIBILITY_AUDIT.md](ACCESSIBILITY_AUDIT.md).
