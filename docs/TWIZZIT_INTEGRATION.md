# Twizzit Integration Documentation

## Overview

The Twizzit integration enables ShotSpot to synchronize team and player data with the Belgian Korfball Federation API. This integration provides automated data synchronization, secure credential storage, and comprehensive audit logging.

## Features

- ✅ **Secure Credential Storage**: AES-256-CBC encryption for API passwords
- ✅ **Automated Synchronization**: Scheduled sync for teams, players, and competitions
- ✅ **Data Mapping**: Bidirectional mapping between Twizzit and ShotSpot entities
- ✅ **Audit Logging**: Complete history of all sync operations
- ✅ **Error Handling**: Robust error tracking and recovery
- ✅ **Role-Based Access**: Admin and coach permissions for sync operations

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Twizzit Integration                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │  API Client    │  │  Auth Service  │  │ Sync Service │  │
│  │                │  │                │  │              │  │
│  │ • HTTP calls   │  │ • Encryption   │  │ • Teams      │  │
│  │ • Auth tokens  │  │ • Decryption   │  │ • Players    │  │
│  │ • Pagination   │  │ • Key mgmt     │  │ • Mappings   │  │
│  └────────────────┘  └────────────────┘  └──────────────┘  │
│                                                               │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │  API Routes    │  │  Database      │  │ Audit Log    │  │
│  │                │  │                │  │              │  │
│  │ • Credentials  │  │ • Credentials  │  │ • History    │  │
│  │ • Sync ops     │  │ • Mappings     │  │ • Status     │  │
│  │ • Config       │  │ • Config       │  │ • Errors     │  │
│  └────────────────┘  └────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

#### Tables Created

1. **twizzit_credentials** - Encrypted API credentials
2. **twizzit_sync_config** - Sync configuration and scheduling
3. **twizzit_team_mappings** - Links local teams to Twizzit teams
4. **twizzit_player_mappings** - Links local players to Twizzit players
5. **twizzit_competition_mappings** - Links local competitions to Twizzit competitions
6. **twizzit_sync_history** - Audit log of all sync operations

## Setup Guide

### 1. Environment Configuration

Add the following to your `.env` file:

```bash
# Generate a secure encryption key:
# openssl rand -hex 32
TWIZZIT_ENCRYPTION_KEY=your-64-character-hex-encryption-key-here
```

**Important**: The encryption key must be:
- 64 hexadecimal characters (256 bits)
- Stored securely and never committed to version control
- Backed up safely (lost key = lost access to encrypted passwords)

### 2. Database Migration

The Twizzit schema is automatically applied when running database setup:

```bash
cd backend
npm run setup-db        # Production database
npm run setup-test-db   # Test database
```

### 3. Store API Credentials

#### Via API (Recommended)

```bash
POST /api/twizzit/credentials
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "organizationName": "Belgian Korfball Federation",
  "apiUsername": "your-api-username",
  "apiPassword": "your-api-password",
  "apiEndpoint": "https://api.twizzit.com/v1"
}
```

#### Via Direct Database (Advanced)

```javascript
import { storeCredentials } from './services/twizzit-auth.js';

await storeCredentials({
  organizationName: 'Belgian Korfball Federation',
  apiUsername: 'your-username',
  apiPassword: 'your-password',
  apiEndpoint: 'https://api.twizzit.com/v1'
});
```

### 4. Verify Connection

```bash
POST /api/twizzit/verify/:credentialId
Authorization: Bearer <admin-or-coach-token>
```

Response:
```json
{
  "success": true,
  "message": "Connection verified successfully"
}
```

## API Reference

### Credential Management

#### Store Credentials
```
POST /api/twizzit/credentials
Roles: admin
Body: { organizationName, apiUsername, apiPassword, apiEndpoint? }
```

#### List Credentials
```
GET /api/twizzit/credentials
Roles: admin
```

#### Delete Credentials
```
DELETE /api/twizzit/credentials/:id
Roles: admin
```

#### Verify Connection
```
POST /api/twizzit/verify/:id
Roles: admin, coach
```

### Synchronization

#### Sync Teams
```
POST /api/twizzit/sync/teams/:credentialId
Roles: admin, coach
Body: { includePlayers?: boolean }
```

#### Sync Players
```
POST /api/twizzit/sync/players/:credentialId
Roles: admin, coach
```

#### Get Sync Configuration
```
GET /api/twizzit/sync/config/:credentialId
Roles: admin, coach
```

#### Update Sync Configuration
```
PUT /api/twizzit/sync/config/:credentialId
Roles: admin
Body: {
  syncTeams?: boolean,
  syncPlayers?: boolean,
  syncCompetitions?: boolean,
  syncIntervalMinutes?: number,
  autoSyncEnabled?: boolean
}
```

#### Get Sync History
```
GET /api/twizzit/sync/history/:credentialId?limit=50&offset=0
Roles: admin, coach
```

### Data Mappings

#### Get Team Mappings
```
GET /api/twizzit/mappings/teams
Roles: admin, coach
```

#### Get Player Mappings
```
GET /api/twizzit/mappings/players?teamId=<id>
Roles: admin, coach
```

## Usage Examples

### Basic Sync Workflow

```javascript
// 1. Store credentials
const credResponse = await fetch('/api/twizzit/credentials', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    organizationName: 'My Korfball Club',
    apiUsername: 'api-user',
    apiPassword: 'secure-password',
    apiEndpoint: 'https://api.twizzit.com/v1'
  })
});
const { credential } = await credResponse.json();

// 2. Verify connection
await fetch(`/api/twizzit/verify/${credential.id}`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});

// 3. Sync teams (with players)
const syncResponse = await fetch(`/api/twizzit/sync/teams/${credential.id}`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ includePlayers: true })
});

const result = await syncResponse.json();
console.log(`Synced ${result.succeeded} teams`);

// 4. View sync history
const historyResponse = await fetch(
  `/api/twizzit/sync/history/${credential.id}`,
  { headers: { 'Authorization': `Bearer ${token}` } }
);
const { history } = await historyResponse.json();
```

### Configure Automated Sync

```javascript
// Enable automatic synchronization every 60 minutes
await fetch(`/api/twizzit/sync/config/${credentialId}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    syncTeams: true,
    syncPlayers: true,
    syncCompetitions: false,
    syncIntervalMinutes: 60,
    autoSyncEnabled: true
  })
});
```

## Data Flow

### Team Synchronization

```
Twizzit API                  ShotSpot Database
    │                              │
    │  1. Fetch teams              │
    │─────────────────────────────>│
    │                              │
    │  2. Check mappings           │
    │<─────────────────────────────│
    │                              │
    │  3. Create/update teams      │
    │─────────────────────────────>│
    │                              │
    │  4. Update mappings          │
    │─────────────────────────────>│
    │                              │
    │  5. Log sync history         │
    │─────────────────────────────>│
```

### Player Synchronization

```
Twizzit API                  ShotSpot Database
    │                              │
    │  1. Get team mappings        │
    │<─────────────────────────────│
    │                              │
    │  2. For each team:           │
    │     Fetch players            │
    │─────────────────────────────>│
    │                              │
    │  3. Check player mappings    │
    │<─────────────────────────────│
    │                              │
    │  4. Create/update players    │
    │─────────────────────────────>│
    │                              │
    │  5. Update mappings          │
    │─────────────────────────────>│
```

## Security Considerations

### Encryption

- **Algorithm**: AES-256-CBC (industry standard)
- **Key**: 256-bit derived from `TWIZZIT_ENCRYPTION_KEY`
- **IV**: Unique 128-bit random IV per password
- **Storage**: Encrypted password + IV stored separately

### Access Control

- **Admin**: Full access to credentials, sync config, operations
- **Coach**: Read-only credentials, trigger syncs, view history
- **User**: No access to Twizzit integration

### Best Practices

1. **Rotate encryption key periodically**
   - Generate new key
   - Re-encrypt all passwords
   - Update environment variable

2. **Monitor sync failures**
   - Check sync history regularly
   - Set up error notifications
   - Review failed items

3. **Backup credentials**
   - Export credentials (encrypted)
   - Store securely offline
   - Document recovery procedure

4. **Rate limiting**
   - Respect Twizzit API rate limits
   - Implement exponential backoff
   - Queue sync operations

## Troubleshooting

### Connection Fails

**Problem**: Verification returns 401 or connection error

**Solutions**:
1. Verify credentials are correct
2. Check API endpoint URL
3. Ensure network connectivity to Twizzit API
4. Verify Twizzit account is active

### Sync Fails Partially

**Problem**: Some teams/players sync, others fail

**Solutions**:
1. Check sync history for specific error messages
2. Review failed items in sync response
3. Verify data format from Twizzit matches expectations
4. Check for duplicate names or invalid data

### Decryption Error

**Problem**: "Password decryption failed"

**Solutions**:
1. Verify `TWIZZIT_ENCRYPTION_KEY` is set correctly
2. Check key hasn't changed since passwords were encrypted
3. Ensure key is 64 hexadecimal characters
4. Re-store credentials if key was lost

### Migration Not Applied

**Problem**: Tables not found

**Solutions**:
```bash
# Verify migration is in setup scripts
cd backend
npm run check-migrations

# Apply migrations manually
npm run setup-db
```

## Performance Optimization

### Pagination

The API client handles pagination automatically:

```javascript
// Fetches all teams across multiple pages
const result = await apiClient.getTeams({ limit: 100 });
// Returns: { teams, total, page, hasMore }
```

### Batch Operations

Sync operations process items in batches:

```javascript
// Syncs all teams, then all players
await syncTeamsFromTwizzit(credentialId, { 
  includePlayers: true  // Syncs players immediately after each team
});
```

### Concurrent Syncs

Avoid running multiple syncs simultaneously:

```javascript
// Check if sync is already running
const recentHistory = await getSyncHistory(credentialId, { limit: 1 });
const lastSync = recentHistory[0];

if (lastSync?.status === 'in_progress') {
  throw new Error('Sync already in progress');
}
```

## Monitoring

### Sync Status

```sql
-- Recent sync operations
SELECT 
  sync_type,
  sync_direction,
  status,
  items_processed,
  items_succeeded,
  items_failed,
  started_at,
  completed_at
FROM twizzit_sync_history
ORDER BY started_at DESC
LIMIT 10;
```

### Success Rate

```sql
-- Success rate by sync type
SELECT 
  sync_type,
  COUNT(*) as total_syncs,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
  ROUND(AVG(items_succeeded::float / NULLIF(items_processed, 0) * 100), 2) as success_rate_pct
FROM twizzit_sync_history
WHERE completed_at >= NOW() - INTERVAL '30 days'
GROUP BY sync_type;
```

### Failed Items

```sql
-- Recent sync errors
SELECT 
  sync_type,
  status,
  error_message,
  items_failed,
  started_at
FROM twizzit_sync_history
WHERE status IN ('failed', 'partial_success')
ORDER BY started_at DESC
LIMIT 20;
```

## Development

### Testing Locally

```bash
# Set up test environment
export TWIZZIT_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Run integration tests
cd backend
npm test -- twizzit
```

### Mock API for Development

```javascript
// For development without Twizzit access
const mockApiClient = {
  async getTeams() {
    return {
      teams: [
        { id: '1', name: 'Test Team A' },
        { id: '2', name: 'Test Team B' }
      ],
      total: 2,
      hasMore: false
    };
  },
  async getTeamPlayers(teamId) {
    return {
      players: [
        { 
          id: '1', 
          firstName: 'John', 
          lastName: 'Doe',
          jerseyNumber: 10
        }
      ],
      total: 1,
      hasMore: false
    };
  }
};
```

## Future Enhancements

### Planned Features

- [ ] **Bidirectional Sync**: Push ShotSpot data to Twizzit
- [ ] **Competition Sync**: Synchronize competition schedules
- [ ] **Webhook Support**: Real-time updates from Twizzit
- [ ] **Conflict Resolution**: Handle conflicting data updates
- [ ] **Batch Import**: Bulk import from CSV/Excel
- [ ] **Data Validation**: Pre-sync validation rules
- [ ] **Scheduled Jobs**: Automated sync via cron/scheduler

## Support

### Resources

- **API Documentation**: Contact Belgian Korfball Federation
- **Issue Tracker**: GitHub Issues
- **Discussion**: GitHub Discussions

### Common Questions

**Q: Can I sync multiple organizations?**  
A: Yes, store separate credentials for each organization.

**Q: Is sync real-time?**  
A: No, sync is triggered manually or on schedule. Webhook support is planned.

**Q: What happens if Twizzit API changes?**  
A: Update the API client to match new endpoints/formats.

**Q: Can I undo a sync?**  
A: No, syncs are permanent. Backup database before large syncs.

## License

This integration is part of ShotSpot and follows the same license terms.

---

**Last Updated**: December 2025  
**Version**: 1.0.0  
**Status**: Production Ready
