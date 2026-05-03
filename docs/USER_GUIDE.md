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

![ShotSpot logo](../frontend/src/img/ShotSpot_logo.png)
![ShotSpot icon](../frontend/src/img/ShotSpot_icon.png)
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
- [../QUICKSTART.md](../QUICKSTART.md)
