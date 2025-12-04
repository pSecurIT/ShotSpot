# Twizzit Integration Guide

## Overview

Twizzit is the official member management and team synchronization platform used by KBKB (Belgian Korfball Federation). This integration allows ShotSpot to sync player, team, and schedule data from Twizzit's API.

**API Version**: v2  
**Authentication**: JWT Bearer Token  
**Base URL**: `https://api.twizzit.com`  
**Rate Limiting**: Monthly API call limit (monitor 429 responses)

## Architecture

### Data Flow
```
Twizzit API → ShotSpot Backend → Database → Frontend UI
     ↑                                ↓
     └────── Scheduled Sync ──────────┘
```

### Key Components
1. **Authentication Service** (`backend/src/services/twizzit-auth.js`)
   - Handles JWT token management
   - Token refresh logic
   - Credential storage

2. **API Client** (`backend/src/services/twizzit-client.js`)
   - Wrapper for all Twizzit API operations
   - Rate limiting and retry logic
   - Error handling

3. **Sync Engine** (`backend/src/services/twizzit-sync.js`)
   - Orchestrates data synchronization
   - Conflict resolution
   - Mapping between Twizzit and ShotSpot schemas

4. **API Routes** (`backend/src/routes/twizzit.js`)
   - Admin endpoints for manual sync
   - Status and configuration endpoints

5. **Database Schema** (see below)
   - Mapping tables
   - Sync logs
   - Configuration storage

## API Endpoints Summary

### Authentication
**POST** `/v2/api/authenticate`
- **Auth**: None
- **Body**: `username`, `password` (form-urlencoded)
- **Returns**: JWT token with expiry timestamps
- **Errors**: 401 (invalid credentials), 429 (rate limit)

### Core Data Endpoints

#### Organizations
**GET** `/v2/api/organizations`
- **Purpose**: Get list of organizations user has access to
- **Returns**: `[{ id, name }]`
- **Usage**: First step - determine organization IDs for subsequent calls

#### Seasons
**GET** `/v2/api/seasons`
- **Required**: `organization-ids[]`
- **Optional**: `season-ids[]`, `is-current-season` (boolean)
- **Returns**: Seasons with start/end dates, active status
- **Usage**: Filter teams and players by season

#### Groups (Teams)
**GET** `/v2/api/groups`
- **Required**: `organization-ids[]`
- **Optional**: 
  - `group-ids[]` - specific teams
  - `season-id` - filter by season
  - `group-type` - team classification
  - `group-category-ids[]` - age divisions, skill levels
  - `series-ids[]` - competition series
  - `club-ids[]` - filter by club
  - `limit` (max 250), `offset` - pagination
- **Returns**: Teams with name, category, club, season, extra fields
- **Key Fields**:
  - `id` - Twizzit group ID (map to ShotSpot team)
  - `name`, `short-name` - team names
  - `club` - parent club ID
  - `season` - embedded season object
  - `category` - group category ID
  - `image` - team logo URL (nullable)
  - `extra-field-values` - custom fields

#### Contacts (Players/Members)
**GET** `/v2/api/contacts`
- **Required**: `organization-ids[]`
- **Optional**:
  - `contact-ids[]` - specific players
  - `membership-type-ids[]` - filter by membership type
  - `membership-season-ids[]` - filter by season
  - `current-membership` (boolean) - active members only
  - `limit` (max 100), `offset` - pagination
- **Returns**: Player data including personal info, contact details, address
- **Key Fields**:
  - `id` - Twizzit contact ID (map to ShotSpot player)
  - `first-name`, `last-name`, `name` - player names
  - `date-of-birth` - for age calculations
  - `gender` - for team assignments
  - `number` - jersey number
  - `email-1/2/3` - email contacts with target (personal/work)
  - `mobile-1/2/3`, `home` - phone numbers with country code
  - `address` - full address object
  - `registry-number` - official player registration number
  - `has-profile-image` - boolean flag
  - `extra-field-values` - custom fields

#### Group-Contacts (Team Rosters)
**GET** `/v2/api/group-contacts`
- **Required**: `organization-ids[]`, `group-ids[]`
- **Returns**: Relationships between groups and contacts
- **Key Fields**:
  - `groupId` - team ID
  - `contactId` - player ID
  - `contactFunctionId` - role (player, coach, etc.)
- **Usage**: Build team rosters by linking groups to contacts

### Metadata Endpoints

#### Group Types
**GET** `/v2/api/group-types`
- **Purpose**: Team type classifications
- **Returns**: `[{ id, name }]`

#### Group Categories
**GET** `/v2/api/group-categories`
- **Purpose**: Age divisions, skill levels
- **Returns**: Categories with multilingual names (EN/NL/FR), colors

#### Contact Functions
**GET** `/v2/api/contact-functions`
- **Purpose**: Role types (player, coach, referee, etc.)
- **Returns**: Functions with multilingual names, type, active status

#### Event Types & Sub-Types
**GET** `/v2/api/event-types`
**GET** `/v2/api/event-sub-types`
- **Purpose**: Event/match classifications
- **Returns**: Types with multilingual names, colors, active status

## Data Mapping

### Twizzit Contact → ShotSpot Player

| Twizzit Field | ShotSpot Field | Notes |
|---------------|----------------|-------|
| `id` | `twizzit_id` | Store in mapping table |
| `first-name` | `first_name` | |
| `last-name` | `last_name` | |
| `date-of-birth` | `date_of_birth` | Parse date string |
| `gender` | `gender` | Normalize values |
| `number` | `jersey_number` | |
| `email-1.email` | `email` | Use primary email |
| `mobile-1.number` | `phone` | Format: +{cc}{number} |
| `registry-number` | `registration_number` | Official ID |
| `has-profile-image` | Profile fetch flag | Fetch image separately |

### Twizzit Group → ShotSpot Team

| Twizzit Field | ShotSpot Field | Notes |
|---------------|----------------|-------|
| `id` | `twizzit_id` | Store in mapping table |
| `name` | `name` | |
| `short-name` | `short_name` | |
| `season.name` | Season context | Create/link to season |
| `category` | Team category | Map to ShotSpot categories |
| `club` | Club association | May need club table |
| `image` | `logo_url` | Store URL or fetch image |

### Twizzit Group-Contact → ShotSpot Game Roster

| Twizzit Field | ShotSpot Field | Notes |
|---------------|----------------|-------|
| `groupId` | `team_id` | Via mapping table |
| `contactId` | `player_id` | Via mapping table |
| `contactFunctionId` | `role` | Map function to role (player/coach) |

## Database Schema

### Migration: `add_twizzit_integration.sql`

```sql
-- Twizzit configuration (per organization/club)
CREATE TABLE twizzit_config (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL UNIQUE, -- Twizzit organization ID
  api_username VARCHAR(255) NOT NULL,
  api_password_encrypted TEXT NOT NULL, -- Encrypted credential
  jwt_token TEXT, -- Current JWT token
  token_expires_at TIMESTAMP, -- Token expiry
  sync_enabled BOOLEAN DEFAULT false,
  auto_sync_frequency VARCHAR(20) DEFAULT 'daily', -- 'hourly', 'daily', 'weekly', 'manual'
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sync history log
CREATE TABLE twizzit_sync_log (
  id SERIAL PRIMARY KEY,
  config_id INTEGER REFERENCES twizzit_config(id) ON DELETE CASCADE,
  sync_type VARCHAR(50) NOT NULL, -- 'players', 'teams', 'rosters', 'full'
  status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'partial'
  records_fetched INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  errors TEXT, -- JSON array of error messages
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  duration_ms INTEGER
);

-- Player ID mapping
CREATE TABLE twizzit_player_mapping (
  id SERIAL PRIMARY KEY,
  shotspot_player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  twizzit_contact_id INTEGER NOT NULL,
  organization_id INTEGER NOT NULL,
  last_synced_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(twizzit_contact_id, organization_id)
);
CREATE INDEX idx_twizzit_player_mapping_contact ON twizzit_player_mapping(twizzit_contact_id);
CREATE INDEX idx_twizzit_player_mapping_player ON twizzit_player_mapping(shotspot_player_id);

-- Team ID mapping
CREATE TABLE twizzit_team_mapping (
  id SERIAL PRIMARY KEY,
  shotspot_team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  twizzit_group_id INTEGER NOT NULL,
  organization_id INTEGER NOT NULL,
  season_id INTEGER, -- Twizzit season ID
  last_synced_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(twizzit_group_id, organization_id)
);
CREATE INDEX idx_twizzit_team_mapping_group ON twizzit_team_mapping(twizzit_group_id);
CREATE INDEX idx_twizzit_team_mapping_team ON twizzit_team_mapping(shotspot_team_id);

-- Sync conflict resolution
CREATE TABLE twizzit_sync_conflicts (
  id SERIAL PRIMARY KEY,
  config_id INTEGER REFERENCES twizzit_config(id) ON DELETE CASCADE,
  entity_type VARCHAR(20) NOT NULL, -- 'player', 'team'
  shotspot_id INTEGER NOT NULL,
  twizzit_id INTEGER NOT NULL,
  conflict_type VARCHAR(50) NOT NULL, -- 'duplicate', 'data_mismatch', 'deleted'
  shotspot_data JSONB, -- Current ShotSpot data
  twizzit_data JSONB, -- Incoming Twizzit data
  resolution VARCHAR(20), -- 'twizzit_wins', 'shotspot_wins', 'manual', 'pending'
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_twizzit_conflicts_pending ON twizzit_sync_conflicts(config_id, resolution) WHERE resolution = 'pending';
```

## Implementation Plan

### Phase 1: Authentication & Configuration (Tasks 1-3)
1. **Create authentication service**
   - File: `backend/src/services/twizzit-auth.js`
   - Functions: `authenticate()`, `refreshToken()`, `isTokenValid()`
   - Store credentials encrypted in `twizzit_config` table
   - Handle token expiry and refresh

2. **Create API client wrapper**
   - File: `backend/src/services/twizzit-client.js`
   - Implement methods for all endpoints (see API Reference below)
   - Add retry logic with exponential backoff
   - Handle 429 rate limiting (monthly limit tracking)
   - Comprehensive error handling

3. **Database schema migration**
   - Create migration file: `backend/src/migrations/add_twizzit_integration.sql`
   - Add to all three setup scripts (see Migration Protocol)
   - Test with `npm run setup-test-db`

### Phase 2: Core Sync Logic (Tasks 4-7)
4. **Implement player sync**
   - File: `backend/src/services/twizzit-sync.js` → `syncPlayers()`
   - Fetch contacts from Twizzit (`/v2/api/contacts`)
   - Map to ShotSpot players schema
   - Handle duplicates (match by registry-number, email, name+DOB)
   - Create/update players table
   - Update mapping table

5. **Implement team sync**
   - Function: `syncTeams()`
   - Fetch groups from Twizzit (`/v2/api/groups`)
   - Fetch seasons first to associate teams
   - Map to ShotSpot teams schema
   - Handle club hierarchies
   - Create/update teams table
   - Update mapping table

6. **Implement roster sync**
   - Function: `syncRosters()`
   - Fetch group-contacts (`/v2/api/group-contacts`)
   - Match groups → ShotSpot teams via mapping
   - Match contacts → ShotSpot players via mapping
   - Create game_rosters entries
   - Handle role mapping (contact-function → player/coach)

7. **API endpoints**
   - File: `backend/src/routes/twizzit.js`
   - `POST /api/twizzit/configure` - Set credentials, enable sync
   - `GET /api/twizzit/config` - Get current config
   - `POST /api/twizzit/sync/players` - Manual player sync
   - `POST /api/twizzit/sync/teams` - Manual team sync
   - `POST /api/twizzit/sync/rosters` - Manual roster sync
   - `POST /api/twizzit/sync/full` - Full sync (all data)
   - `GET /api/twizzit/status` - Sync status, last run, conflicts
   - `GET /api/twizzit/logs` - Sync history with pagination
   - All endpoints require `requireRole(['admin'])`

### Phase 3: UI & Automation (Tasks 8-11)
8. **Configuration UI**
   - Component: `frontend/src/components/TwizzitSettings.tsx`
   - Form to enter Twizzit credentials
   - Test connection button
   - Enable/disable auto-sync toggle
   - Select sync frequency (hourly/daily/weekly/manual)
   - View last sync timestamp
   - Trigger manual sync buttons

9. **Sync status indicators**
   - Add `sync_source` column to players/teams tables (`'manual' | 'twizzit'`)
   - Badge on PlayerManagement: "Synced from Twizzit"
   - Badge on TeamManagement: "Synced from Twizzit"
   - Last sync time tooltip
   - Conflict warnings

10. **Automated scheduler**
    - Install `node-cron` package
    - File: `backend/src/services/twizzit-scheduler.js`
    - Initialize in `backend/src/index.js`
    - Read config from database (frequency setting)
    - Run sync at specified intervals
    - Log all sync runs to `twizzit_sync_log`

11. **Conflict resolution UI**
    - Component: `frontend/src/components/TwizzitConflicts.tsx`
    - List pending conflicts
    - Show side-by-side comparison
    - Radio buttons: Keep ShotSpot / Use Twizzit / Manual Edit
    - Resolve and apply changes

### Phase 4: Testing & Documentation (Tasks 12-14)
12. **Backend tests**
    - File: `backend/test/twizzit.test.js`
    - Mock Twizzit API responses
    - Test authentication flow (success, 401, 429)
    - Test sync logic (create, update, duplicates)
    - Test conflict detection
    - Test pagination handling
    - Test error recovery

13. **Frontend tests**
    - File: `frontend/src/test/TwizzitSettings.test.tsx`
    - Test configuration form
    - Test manual sync triggers
    - Test status display
    - File: `frontend/src/test/TwizzitConflicts.test.tsx`
    - Test conflict resolution UI

14. **Documentation**
    - File: `docs/TWIZZIT.md`
    - Setup instructions for admins
    - How to get Twizzit API credentials
    - Configuration walkthrough with screenshots
    - Data mapping reference
    - Troubleshooting common issues
    - Rate limit management

### Phase 5: Advanced Features (Task 15)
15. **Webhook support (optional)**
    - If Twizzit provides webhooks for real-time updates
    - Endpoint: `POST /api/twizzit/webhook`
    - Verify webhook signature (if available)
    - Trigger sync for specific entity updates
    - Reduces polling frequency

## API Client Reference

```javascript
// backend/src/services/twizzit-client.js

class TwizzitClient {
  constructor(token) {
    this.token = token;
    this.baseURL = 'https://api.twizzit.com';
  }

  // Core methods
  async getOrganizations()
  async getSeasons(orgIds, { seasonIds, isCurrentSeason })
  async getGroups(orgIds, { groupIds, seasonId, groupType, categoryIds, seriesIds, clubIds, limit, offset })
  async getGroupTypes(orgIds)
  async getGroupCategories(orgIds, { categoryIds, groupType })
  async getContacts(orgIds, { contactIds, membershipTypeIds, membershipSeasonIds, currentMembership, limit, offset })
  async getGroupContacts(orgIds, groupIds)
  async getContactFunctions(orgIds, { functionIds, functionType })
  async getEventTypes(orgIds)
  async getEventSubTypes(orgIds, { subTypeIds })
  
  // Pagination helper
  async getAllPages(endpoint, params, limit = 100)
  
  // Error handling
  async request(method, path, params)
}
```

## Error Handling

### API Errors
- **401 Unauthorized**: Token expired → refresh token
- **429 Rate Limit**: Monthly limit exceeded → notify admin, pause sync
- **500 Server Error**: Retry with exponential backoff (max 3 retries)

### Sync Errors
- **Duplicate Detection**: Match by registry-number first, then email, then name+DOB
- **Data Conflicts**: Log to `twizzit_sync_conflicts` table, require manual resolution
- **Missing References**: If player has no matching team, skip roster entry, log warning
- **Partial Sync Failures**: Continue sync, log errors, mark sync as 'partial'

### Logging
All errors logged to:
1. `twizzit_sync_log` table (structured data)
2. Backend console (if `NODE_ENV !== 'test'`)
3. Admin notification system (future enhancement)

## Security Considerations

1. **Credential Storage**: Encrypt API password in database using `crypto` module
2. **Token Security**: Store JWT in backend only, never expose to frontend
3. **Admin-Only Access**: All Twizzit endpoints require `requireRole(['admin'])`
4. **Rate Limiting**: Track API calls, pause sync if approaching monthly limit
5. **Data Validation**: Validate all incoming Twizzit data before database insert
6. **HTTPS Only**: Ensure all Twizzit API calls use HTTPS

## Deployment Instructions

### 1. Environment Setup

Add to `backend/.env`:
```bash
# Twizzit Integration
TWIZZIT_ENCRYPTION_KEY=<32-byte hex key for encrypting credentials>
TWIZZIT_RATE_LIMIT_MONTHLY=<monthly API call limit from Twizzit>
SCHEDULER_TIMEZONE=Europe/Brussels  # Optional, defaults to UTC
```

**Generate encryption key**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Database Migration

Run migration to create Twizzit tables:
```bash
cd backend
npm run setup-db  # Production database
npm run setup-test-db  # Test database
```

**Verify migration**:
```bash
npm run check-migrations  # Ensures all migrations are registered
```

### 3. Install Dependencies

Backend scheduler dependency:
```bash
cd backend
npm install node-cron
```

### 4. Restart Server

The Twizzit scheduler will auto-start on server boot (production mode only):
```bash
npm run dev  # Development (scheduler disabled in test mode)
# OR
npm start    # Production (scheduler enabled)
```

**Verify scheduler**:
Look for console output:
```
[Twizzit Scheduler] Starting automated sync scheduler...
[Twizzit Scheduler] Hourly sync: Every hour at :00
[Twizzit Scheduler] Daily sync: Every day at 2:00 AM
[Twizzit Scheduler] Weekly sync: Every Sunday at 2:00 AM
```

## Admin UI Usage Guide

### Initial Configuration

1. **Navigate to Twizzit Settings** (admin-only page)
2. **Enter Organization Details**:
   - Organization ID: Obtain from Twizzit dashboard (e.g., 123)
   - Organization Name: Friendly name for identification (e.g., "KBKB")
   - Username: Your Twizzit API username
   - Password: Your Twizzit API password (encrypted at rest)
3. **Test Connection**: Click "Test Connection" to verify credentials before saving
4. **Enable Sync**:
   - Check "Enable Automatic Sync"
   - Select frequency: Manual, Hourly, Daily, or Weekly
5. **Save Configuration**

### Manual Sync Operations

Use `TwizzitSyncControls` component for on-demand syncs:

- **Sync Players Only**: Imports/updates all contacts from Twizzit
- **Sync Teams Only**: Imports/updates all groups (teams) from Twizzit
- **Full Sync**: Players + Teams + Rosters in one operation

**Sync Status Display**:
- Real-time progress indicator while sync is running
- Latest sync results: Created, Updated, Skipped, Errors
- Sync duration and timestamp
- Pending conflicts warning (if any)

### Viewing Sync History

`TwizzitSyncHistory` component shows:
- Paginated log of all sync operations (20 per page)
- Filters: Type (Players/Teams/Full), Status (Success/Failed/Partial)
- Expandable rows with detailed error information
- Statistics: Created, Updated, Skipped, Errors
- Duration and timestamps

### Resolving Conflicts

`TwizzitConflicts` component (admin-only):
- Displays pending conflicts with side-by-side data comparison
- Conflict types: Duplicate, Data Mismatch, Deleted in Twizzit, Deleted in ShotSpot
- Resolution options:
  - **Use Twizzit Data**: Overwrite ShotSpot with Twizzit values
  - **Use ShotSpot Data**: Keep current ShotSpot values, ignore Twizzit
  - **Ignore Conflict**: Mark as resolved without changes

### Sync Badges

Players and teams synced from Twizzit show a **🔄 Twizzit** badge with tooltip displaying last sync timestamp.

## Automated Sync Configuration

### Cron Schedules

| Frequency | Cron Pattern | Description |
|-----------|--------------|-------------|
| Hourly | `0 * * * *` | Every hour on the hour (e.g., 1:00, 2:00) |
| Daily | `0 2 * * *` | Every day at 2:00 AM server time |
| Weekly | `0 2 * * 0` | Every Sunday at 2:00 AM server time |
| Manual | N/A | No automatic sync, manual triggers only |

**Timezone**: Set via `SCHEDULER_TIMEZONE` environment variable (defaults to UTC).

### Scheduler Behavior

- Only configs with `sync_enabled=true` AND `sync_in_progress=false` are synced
- Processes configurations sequentially to avoid API rate limiting
- Logs all operations to `twizzit_sync_logs` table
- Continues to next config if one fails (non-blocking)
- Skipped in test environments (`NODE_ENV=test`)

### Monitoring Scheduler

**Check scheduler status**:
```javascript
// In backend code or API endpoint
import { getSchedulerStatus } from './services/twizzit-scheduler.js';
const status = getSchedulerStatus();
console.log(status);
// { running: true, jobs: { hourly: {...}, daily: {...}, weekly: {...} } }
```

**Manually trigger scheduled sync** (for testing):
```javascript
import { triggerManualScheduledSync } from './services/twizzit-scheduler.js';
await triggerManualScheduledSync('hourly'); // or 'daily', 'weekly'
```

## API Endpoint Reference

### Configuration Endpoints

#### POST `/api/twizzit/configure`
**Auth**: Admin only  
**Purpose**: Create or update Twizzit configuration  
**Body**:
```json
{
  "organizationId": 123,
  "organizationName": "KBKB",
  "username": "api_user",
  "password": "secret",
  "syncEnabled": true,
  "autoSyncFrequency": "daily"
}
```
**Returns**: `{ config: {...} }`

#### GET `/api/twizzit/config`
**Auth**: Admin only  
**Purpose**: Get all Twizzit configurations  
**Returns**: `{ configs: [{...}] }`

#### DELETE `/api/twizzit/configure/:organizationId`
**Auth**: Admin only  
**Purpose**: Delete configuration and all mappings  
**Returns**: `{ success: true }`

#### POST `/api/twizzit/test-connection`
**Auth**: Admin only  
**Purpose**: Test credentials without saving  
**Body**: `{ organizationId, username, password }`  
**Returns**: `{ success: true }` or `{ error: "..." }`

### Sync Operations

#### POST `/api/twizzit/sync/players`
**Auth**: Admin only  
**Purpose**: Sync all players from Twizzit  
**Body**: `{ organizationId }`  
**Returns**:
```json
{
  "status": "success",
  "stats": { "created": 5, "updated": 3, "skipped": 2, "errors": 0 },
  "duration": 5000
}
```

#### POST `/api/twizzit/sync/teams`
**Auth**: Admin only  
**Purpose**: Sync all teams from Twizzit  
**Body**: `{ organizationId }`  
**Returns**: Same as players sync

#### POST `/api/twizzit/sync/full`
**Auth**: Admin only  
**Purpose**: Full sync (players + teams + rosters)  
**Body**: `{ organizationId }`  
**Returns**:
```json
{
  "status": "success",
  "stats": {
    "players": { "created": 5, "updated": 3, "skipped": 2, "errors": 0 },
    "teams": { "created": 2, "updated": 1, "skipped": 0, "errors": 0 }
  },
  "duration": 8000
}
```

### Status & Logs

#### GET `/api/twizzit/status?organizationId=123`
**Auth**: Admin only  
**Purpose**: Get current sync status  
**Returns**:
```json
{
  "organizationId": 123,
  "syncInProgress": false,
  "lastSync": {
    "timestamp": "2024-12-01T10:00:00Z",
    "status": "success",
    "duration": 5000,
    "stats": {...}
  },
  "pendingConflicts": 3
}
```

#### GET `/api/twizzit/logs?organizationId=123&page=1&limit=20`
**Auth**: Admin only  
**Purpose**: Paginated sync logs  
**Returns**:
```json
{
  "logs": [{
    "id": 1,
    "sync_type": "players",
    "status": "success",
    "started_at": "2024-12-01T10:00:00Z",
    "completed_at": "2024-12-01T10:05:00Z",
    "duration": 300000,
    "stats": {...}
  }],
  "pagination": { "total": 50, "page": 1, "limit": 20, "hasMore": true }
}
```

#### GET `/api/twizzit/logs/:logId`
**Auth**: Admin only  
**Purpose**: Detailed log with errors  
**Returns**:
```json
{
  "log": {
    ...basicLogFields,
    "errors": [
      { "entity": "John Doe", "error": "Invalid email format" }
    ]
  }
}
```

### Conflicts

#### GET `/api/twizzit/conflicts?organizationId=123`
**Auth**: Admin only  
**Purpose**: Get pending conflicts  
**Returns**:
```json
{
  "conflicts": [{
    "id": 1,
    "entity_type": "player",
    "shotspot_id": 10,
    "twizzit_id": 1001,
    "conflict_type": "data_mismatch",
    "shotspot_data": {...},
    "twizzit_data": {...},
    "created_at": "2024-12-01T10:00:00Z"
  }]
}
```

#### PUT `/api/twizzit/conflicts/:conflictId/resolve`
**Auth**: Admin only  
**Purpose**: Resolve conflict (Note: Not yet implemented in backend)  
**Body**: `{ resolution: "twizzit_wins" | "shotspot_wins" | "ignored" }`  
**Returns**: `{ success: true }`

## Troubleshooting

### Sync Errors

#### "Invalid credentials" (401)
- **Cause**: Wrong username/password or expired token
- **Fix**: Re-enter credentials in Twizzit Settings, click "Test Connection"

#### "Sync already in progress" (409)
- **Cause**: Another sync operation is running
- **Fix**: Wait for current sync to complete (check status), or restart server to clear stuck sync

#### "Rate limit exceeded" (429)
- **Cause**: Monthly API call limit reached
- **Fix**: 
  - Reduce sync frequency (weekly instead of hourly)
  - Contact Twizzit to increase limit
  - Monitor `TWIZZIT_RATE_LIMIT_MONTHLY` environment variable

#### "Network timeout"
- **Cause**: Twizzit API slow or unreachable
- **Fix**: Retry manually, check https://status.twizzit.com

### Conflict Issues

#### High conflict rate (>10%)
- **Likely Cause**: Data edited in both systems simultaneously
- **Solution**: 
  - Establish data ownership (Twizzit as source of truth for member data)
  - Train users to edit player data only in Twizzit
  - Use "Twizzit Wins" resolution as default

#### Duplicate players created
- **Cause**: Player record changed in Twizzit (new ID assigned)
- **Fix**: 
  - Manually merge duplicates in ShotSpot
  - Update `twizzit_player_mapping` to point to correct ShotSpot ID
  - Archive old player record

### Scheduler Issues

#### Scheduler not running
- **Check**: Console logs on server start for "[Twizzit Scheduler] Starting..."
- **Verify**: `NODE_ENV` is not set to 'test' (scheduler disabled in test mode)
- **Fix**: Restart server, check logs for errors

#### Scheduled sync not triggering
- **Check**: `twizzit_sync_logs` table for recent entries
- **Verify**: Config has `sync_enabled=true` and correct `auto_sync_frequency`
- **Timezone**: Ensure `SCHEDULER_TIMEZONE` matches your server timezone
- **Manual trigger** (for testing):
  ```javascript
  import { triggerManualScheduledSync } from './services/twizzit-scheduler.js';
  await triggerManualScheduledSync('daily');
  ```

### Database Issues

#### Migration not applied
- **Check**: Run `npm run check-migrations` to verify all migrations are registered
- **Fix**: Add migration file to ALL three setup scripts:
  - `backend/scripts/setup-db.js`
  - `backend/scripts/setup-test-db.js`
  - `backend/scripts/setup-parallel-dbs.js`

#### Foreign key constraint errors
- **Cause**: Player/team deleted in ShotSpot but still mapped in Twizzit tables
- **Fix**: Mappings use `ON DELETE CASCADE`, should auto-delete. If not:
  ```sql
  DELETE FROM twizzit_player_mapping WHERE shotspot_player_id NOT IN (SELECT id FROM players);
  DELETE FROM twizzit_team_mapping WHERE shotspot_team_id NOT IN (SELECT id FROM teams);
  ```

### Performance Issues

#### Sync takes >10 minutes
- **Likely Cause**: Large dataset (>1000 players/teams)
- **Solutions**:
  - Increase `limit` parameter in pagination (max 250 for groups, 100 for contacts)
  - Run syncs during off-peak hours (2-4 AM)
  - Consider incremental sync (future enhancement)

#### High memory usage during sync
- **Cause**: Loading all records into memory before processing
- **Fix**: Sync service uses pagination, but ensure `limit` is reasonable (50-100 records per page)

## Common Questions

**Q: Can I sync from multiple Twizzit organizations?**  
A: Yes, create separate configurations for each organization ID. Each will sync independently.

**Q: What happens if I delete a player in ShotSpot?**  
A: The mapping is deleted (CASCADE), but player remains in Twizzit. Next sync will detect as "new" player and recreate.

**Q: Can I push ShotSpot match results back to Twizzit?**  
A: Not yet. Bidirectional sync is a future enhancement (Phase 6).

**Q: How do I stop syncing temporarily?**  
A: Uncheck "Enable Automatic Sync" in Twizzit Settings. Manual sync buttons will still work.

**Q: What data is NOT synced from Twizzit?**  
A: Match schedules, match results, training events. Only member/team roster data is synced.

## Environment Variables

Add to `backend/.env`:
```bash
# Twizzit Integration
TWIZZIT_ENCRYPTION_KEY=<32-byte hex key for encrypting credentials>
TWIZZIT_RATE_LIMIT_MONTHLY=<monthly API call limit from Twizzit>
SCHEDULER_TIMEZONE=Europe/Brussels  # Optional, defaults to UTC
```

## Testing Strategy

### Mock Data
- Create realistic Twizzit API response fixtures
- Cover edge cases: empty results, pagination, malformed data

### Test Scenarios
1. **First-time sync**: Empty database → creates all records
2. **Incremental sync**: Updates existing records
3. **Duplicate handling**: Same player in multiple teams
4. **Conflict resolution**: ShotSpot data differs from Twizzit
5. **Error recovery**: API failure mid-sync
6. **Token expiry**: Automatic token refresh
7. **Rate limiting**: Graceful handling of 429 responses

## Rollout Plan

1. **Development**: Implement all features in feature branch
2. **Staging**: Test with real Twizzit credentials (sandbox account)
3. **Pilot**: Enable for 1-2 clubs, monitor logs
4. **Production**: Roll out to all Belgian clubs
5. **Monitoring**: Track sync success rate, error types, performance

## Success Metrics

- **Sync Success Rate**: >95% of scheduled syncs complete successfully
- **Data Accuracy**: <1% conflict rate requiring manual resolution
- **Performance**: Full sync completes in <5 minutes for 500 players/50 teams
- **User Adoption**: >50% of Belgian clubs enable Twizzit sync within 3 months

## Future Enhancements

1. **Bidirectional Sync**: Push ShotSpot match results back to Twizzit
2. **Smart Sync**: Only sync changed records (requires Twizzit change tracking)
3. **Bulk Import**: UI to preview and approve sync before applying
4. **Conflict Auto-Resolution**: ML model to predict correct resolution
5. **Multi-Organization**: Support syncing from multiple Twizzit organizations
6. **Match Schedule Import**: Sync Twizzit events to ShotSpot games table
