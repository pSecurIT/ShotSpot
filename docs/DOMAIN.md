# Domain Concepts: Belgian Korfball Context

## Purpose
This document defines the key domain concepts used in ShotSpot, with specific context for Belgian korfball as managed through the official KBKB (Koninklijke Belgische Korfbal Bond / Royal Belgian Korfball Federation) systems.

## Core Entities

### Twizzit
**Official KBKB software system** used to register and manage all official Belgian korfball entities including clubs, series, seasons, teams, players, and official matches.

**Key characteristics:**
- Authoritative source for player eligibility
- Players not registered in Twizzit are **not eligible to play** in official matches
- Provides unique identifiers for teams, players, and matches
- Manages season registrations and series assignments
- ShotSpot integrates with Twizzit API to sync official data (see `docs/TWIZZIT_INTEGRATION.md`)

**ShotSpot Integration:**
- Credentials stored securely with AES-256-CBC encryption (requires `TWIZZIT_ENCRYPTION_KEY`)
- Automatic sync of teams, players, and match schedules
- Bidirectional mapping between ShotSpot entities and Twizzit IDs
- See backend services: `backend/src/services/twizzit-*.js`

### Club
An **organization** (e.g., KCOV Korfbal Club Overpelt-Neerpelt) that organizes korfball activities including trainings, friendly matches, and tournaments.

**Key characteristics:**
- Legal entity registered with KBKB
- Has one or more teams
- Can field multiple teams per age category depending on membership size
- Manages club-level resources, coaches, and administrative staff
- Associated with a physical location/facility

**ShotSpot Implementation:**
- Database table: `clubs`
- Managed via `/api/clubs` endpoints
- Links to teams, players (through team membership), and coaches

### Team
An **age-bound or skill-bound group of players** representing a club in competitions.

**Key characteristics:**
- Typically organized by age category (e.g., U12, U14, U17, Seniors)
- A club can field multiple teams per age group (e.g., "U17 A", "U17 B") depending on membership
- Registered for specific series (divisions) which may differ between indoor and outdoor seasons
- Roster managed through Twizzit for official matches
- Advancement/relegation between series based on seasonal performance

**ShotSpot Implementation:**
- Database table: `teams`
- Managed via `/api/teams` endpoints
- Links to club, players (via roster), games, and Twizzit mappings

### Player
A **person registered with KBKB via Twizzit** who is a member of a team within a club.

**Key characteristics:**
- Must be registered in Twizzit to participate in official matches
- Associated with one primary team per season (can play for multiple teams in some circumstances)
- Has a unique Twizzit player ID
- Eligibility rules enforced by KBKB (age, transfers, suspensions)

**ShotSpot Implementation:**
- Database table: `players`
- Managed via `/api/players` endpoints
- Links to team, match events (shots, fouls), and Twizzit player ID
- Performance tracked across games and seasons

### Season
A **competitive period** in the korfball calendar. Belgian korfball has two distinct seasons per year:

#### Indoor Season
- Typically September to March
- Played in sports halls
- Smaller court dimensions
- Different tactical considerations

#### Outdoor Season
- Typically April to August
- Played on grass or artificial turf fields
- Larger playing area
- Different rules for weather conditions

**Key characteristics:**
- Teams register separately for indoor and outdoor seasons
- Series (division) assignments may differ between seasons
- Different competition structures and schedules
- Performance in one season affects next season's series placement

**ShotSpot Implementation:**
- Season context tracked via timestamps and competition metadata
- Separate analytics for indoor vs. outdoor performance
- Series assignments linked to specific seasons

### Series
**Competitive divisions** based on skill level and performance. Teams are assigned to a series for each season.

**Key characteristics:**
- Hierarchical structure (e.g., National Division, 1st Provincial, 2nd Provincial, etc.)
- Teams compete within their series
- Promotion and relegation based on season performance (league standings)
- Series assignments can differ between indoor and outdoor seasons
- Higher series = higher skill level and competition

**Advancement mechanism:**
- Top teams in a series are promoted to higher series next season
- Bottom teams are relegated to lower series
- Points accumulated through match results determine standings

**ShotSpot Implementation:**
- Database table: `series`
- Managed via `/api/series` endpoints
- Links teams to competitive divisions
- Tracks historical series assignments for performance analysis

### Match (Game)
An **official competitive event** between two teams (home and away).

**Key characteristics:**
- Scheduled through Twizzit for series competitions
- Result contributes to series standings
- Points awarded based on outcome:
  - **Win:** 2 points
  - **Draw:** 1 point each team
  - **Loss:** 0 points
- Can be friendly (non-series) or official (series competition)
- Consists of periods (typically 2 halves or 4 quarters depending on competition rules)

**ShotSpot Implementation:**
- Database table: `games`
- Managed via `/api/games` endpoints
- Links to teams (home/away), players (rosters), match events, and Twizzit match ID
- Detailed event tracking: shots, goals, fouls, timeouts, substitutions, possessions
- Live analytics and reporting during matches
- Offline-first capture with sync when online (see `OFFLINE.md`)

## Data Relationships

```
Twizzit (External System)
  ↓ (sync/mapping)
Club
  ├── Team(s)
  │   ├── Player(s)
  │   └── Series Assignment (per Season)
  └── Coach(es)

Match (Game)
  ├── Home Team
  ├── Away Team
  ├── Series Context
  ├── Season Context (Indoor/Outdoor)
  └── Events
      ├── Shots (by Player)
      ├── Goals (by Player)
      ├── Fouls (by Player)
      ├── Timeouts (by Team)
      ├── Substitutions (Player in/out)
      └── Possessions (by Team)
```

## Belgian Korfball Rules Context

### Scoring System
- **Goal:** 1 point (shot successfully through the basket)
- **Match points:** Win=2, Draw=1, Loss=0 (for series standings)

### Match Structure
- Typically 2 halves or 4 quarters (duration varies by age category and competition)
- Teams switch between attack and defense zones periodically
- Mixed-gender teams (equal male/female players)

### Player Eligibility
- Must be registered in Twizzit before match date
- Age categories enforced (birth year determines category)
- Transfer rules apply when changing clubs
- Suspensions tracked and enforced

### Series Competition
- Round-robin format within each series
- Home and away matches
- Final standings determine promotion/relegation
- Tie-breaking rules: head-to-head, goal difference, goals scored

## Integration Points

### Twizzit API
- **Authentication:** Username/password stored encrypted in ShotSpot DB
- **Sync operations:** Teams, players, match schedules
- **Mapping tables:** Link ShotSpot entities to Twizzit IDs
- **Scheduled sync:** Configurable intervals (default: daily)
- See: `docs/TWIZZIT_INTEGRATION.md`

### Match Analytics
- Real-time shot tracking and analytics
- Performance metrics per player and team
- Momentum analysis (scoring runs, turnovers)
- Period-by-period breakdowns
- See: `REPORTS_API.md` for analytics endpoints

### Offline Capability
- Match events captured offline (sideline without internet)
- Queue stored in IndexedDB
- Background sync when connection restored
- See: `OFFLINE.md` for implementation details

## Common Workflows

### 1. Team Setup
1. Create/sync Club from Twizzit
2. Sync Teams for Club (linked to Twizzit team IDs)
3. Sync Players for Team (linked to Twizzit player IDs)
4. Assign Series for current Season

### 2. Match Day
1. Create Match (linked to Twizzit match if official)
2. Define rosters (starting lineups)
3. Start match timer
4. Capture events in real-time (shots, goals, fouls, subs)
5. Generate live analytics
6. Finalize and sync result to Twizzit (if official)

### 3. Season Management
1. Register teams for new season in Twizzit
2. Sync team registrations and series assignments to ShotSpot
3. Import match schedule from Twizzit
4. Track results throughout season
5. Analyze performance for series placement

## References

- **KBKB Official Site:** https://www.korfbal.be/
- **Twizzit Integration:** `docs/TWIZZIT_INTEGRATION.md`
- **Match Analytics:** `REPORTS_API.md`
- **Offline Sync:** `OFFLINE.md`
- **Database Schema:** `backend/src/schema.sql` and `backend/src/migrations/`
