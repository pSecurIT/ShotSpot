# ShotSpot

## ✅ App Summary

- A web-based or cross-platform mobile app for live match event tracking in korfball. The app allows:
- Pre-match: Input teams, players, bench, lineups.
- In-match: Real-time event tracking:
- Shot attempts (location, result: goal/miss/korf hit)
- Time tracking (game clock)
- Faults (offensive, defensive, out-of-bounds)
- Post-match: Data export for analysis or sharing.

## 🧱 Core Features (MVP)
### 1. Team & Player Management

Add players, assign to teams

Set starting lineup and substitutes

Edit players’ info

### 2. Live Match Dashboard

Game timer (with periods and pause)

Real-time event buttons:

Shot attempt → pick player → select location → result (goal/miss/hit korf)

Faults → player/team → fault type

Substitution → in/out player

Visual half-court or full-court map for shot tracking

### 3. Event History / Match Log

Timeline of all events

Ability to edit/delete events in real-time

### 4. Analytics & Export

Summarized match stats (per player, team)

Download/export CSV or PDF report

## 🎯 Target Users

- Coaches and assistant coaches
- Team analysts
- Statisticians for clubs or federations

## 📱 Tech stack

- Front-end: 
  - React.js with TypeScript
  - Vite (build tool & dev server)
  - Vitest for unit testing
  - Cypress for E2E testing
- Back-end: Node.js + Express
- Database: PostgreSQL

## 🎨 UX/UI Considerations

- Touch-optimized buttons (for tablets on the sideline)     
- Quick-access event buttons (e.g. drag & drop player to court to log a shot)
- Court visualization to tap/click shot locations
- Undo/Edit options for fast corrections during live play
- Auto-saving and offline support (essential for unstable connections)

## Next up (features to come)

- Heatmaps & shot charts
- Player performance over time
- Sync across multiple devices
- Video tagging integration
- Integration with competition platforms or league databases