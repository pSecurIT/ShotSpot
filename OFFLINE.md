# Offline Support Documentation

## Overview

ShotSpot includes comprehensive offline support, allowing coaches and assistants to track match statistics even when internet connectivity is unstable or unavailable. The app automatically caches data and queues actions for synchronization when the connection is restored.

## How It Works

The offline support system consists of four main components:

### 1. Service Worker (Caching)
- **Network-first strategy for APIs**: Always tries to fetch fresh data from the server when online
- **Cache-first strategy for static assets**: Loads CSS, JavaScript, and images from cache for fast performance
- **Automatic caching**: Critical API endpoints (teams, players, games, timer) are cached automatically
- **Background sync**: Queued actions sync automatically when connection is restored

### 2. IndexedDB (Local Storage)
- Stores match data, shots, events, and player information locally
- Persists data across browser sessions
- Separate stores for: games, shots, events, substitutions, teams, players, and sync queue

### 3. Offline Sync Manager
- Queues write operations (POST, PUT, DELETE) when offline
- Automatically processes the queue when connection is restored
- Tracks sync status and retries failed operations
- Cleans up old synced actions after 7 days
- Replays match-event create, edit, and confirm flows by stable `client_uuid` so follow-up review actions can collapse onto the same logical record during reconnect

### 4. UI Indicator
- Visual indicator in top-right corner shows connection status:
  - **🚫 Red**: Offline - no internet connection
  - **⏳ Orange**: Online with pending actions waiting to sync
  - **🔄 Yellow**: Currently syncing data
  - **✓ Green**: Online and fully synced (indicator hidden)
- "Sync Now" button appears when there are pending actions

## What Works Offline

### ✅ Fully Functional Offline
- **Viewing**: Teams, players, games, and match statistics
- **Recording**: Shots, events, substitutions during live matches
- **Navigation**: All pages and UI elements
- **Timer**: Match timer continues to work

### ⚠️ Queued for Later (Syncs when online)
- Creating new teams or players
- Updating team/player information
- Recording shots and events (stored locally, synced when online)
- Reviewing match events after creation, including edit-later and confirm flows for records that carry a stable `client_uuid`
- Deleting records

### ❌ Requires Internet Connection
- Initial login/authentication
- Fetching CSRF tokens
- Real-time collaboration (if multiple devices)
- Downloading fresh data from server

## Testing Offline Mode

### Using Chrome DevTools
1. Open Chrome DevTools (F12)
2. Go to the **Network** tab
3. Click the dropdown that says "No throttling"
4. Select **Offline**
5. Test the app - actions should queue for sync
6. Change back to **Online** to trigger auto-sync

### Using Firefox DevTools
1. Open Firefox DevTools (F12)
2. Go to the **Network** tab
3. Click the throttling dropdown
4. Select **Offline**

### Manual Network Disconnect
1. Disable WiFi/Ethernet on your device
2. Use the app normally
3. Re-enable network connection
4. Watch the sync indicator as actions sync

## Technical Architecture

### Data Flow

```
User Action (e.g., record shot)
    ↓
Check: Online?
    ↓
  Yes → Send to API → Success → Done
    ↓
  No → Queue in IndexedDB → Show "queued" indicator
         ↓
    Connection restored
         ↓
    Background Sync triggers
         ↓
    Process queue → Merge match-event create/edit/confirm steps by `client_uuid` when possible → Send to API → Mark synced

  ### Match Event Replay Contract

  - Match-event creates generate a stable `client_uuid` in the frontend before sync.
  - The backend stores both `client_uuid` and `event_status` for shots, events, substitutions, possessions, free shots, timeouts, and commentary.
  - If a queued record is edited or confirmed before reconnect, the replay layer folds those follow-up mutations back into the original create action when they share the same `client_uuid`.
  - Confirmed-only consumers such as score, analytics, reports, and exports still ignore unconfirmed items until the replayed or online confirmation step sets `event_status` to `confirmed`.
```

### File Structure

```
frontend/
├── public/
│   └── service-worker.js          # Service Worker for caching
├── src/
│   ├── utils/
│   │   ├── indexedDB.ts           # Local database operations
│   │   ├── offlineSync.ts         # Sync queue management
│   │   └── api.ts                 # Modified to handle offline
│   ├── hooks/
│   │   └── useOfflineStatus.ts    # React hook for offline state
│   └── components/
│       └── OfflineIndicator.tsx   # UI indicator component
```

### Key Technologies

- **Service Workers**: Browser API for offline caching and background sync
- **IndexedDB**: Browser database for structured data storage
- **Background Sync API**: Automatic sync when connection restored
- **Navigator.onLine**: Browser API to detect online/offline status

## Troubleshooting

### Service Worker Not Registering

**Problem**: Console shows "Service Worker registration failed"

**Solutions**:
- Ensure you're running on `localhost` or HTTPS (Service Workers don't work on HTTP)
- Check browser console for specific error messages
- Clear browser cache and reload: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

### Actions Not Syncing

**Problem**: Pending actions counter stays high even when online

**Solutions**:
- Click the "Sync Now" button manually
- Check browser console for sync errors
- Verify server is accessible
- Check if authentication token is still valid

### Offline Indicator Not Showing

**Problem**: Connection indicator doesn't appear when offline

**Solutions**:
- Verify `OfflineIndicator` component is imported in `App.tsx`
- Check browser console for React errors
- Ensure `useOfflineStatus` hook is functioning
- Try hard refresh: Ctrl+Shift+R

### Old Data Showing

**Problem**: Seeing outdated information from cache

**Solutions**:
- Pull down to refresh (mobile) or reload page
- Clear site data: DevTools → Application → Clear storage
- Service Worker will fetch fresh data when online

### Cache Taking Too Much Space

**Problem**: Browser warns about storage quota

**Solutions**:
- Clear old caches: Open DevTools → Application → Cache Storage → Delete old versions
- The app automatically cleans up synced actions older than 7 days
- Limit cached games to recent matches only

## Developer Notes

### Updating Service Worker

When you modify `service-worker.js`, increment the `CACHE_NAME` version:

```javascript
const CACHE_NAME = 'shotspot-v2'; // Changed from v1
```

This ensures old caches are cleared and new assets are cached.

### Adding New API Endpoints to Cache

Edit `service-worker.js` to add endpoints to the cache list:

```javascript
const CACHEABLE_API_ENDPOINTS = [
  '/api/teams',
  '/api/players',
  '/api/games',
  '/api/timer',
  '/api/your-new-endpoint'  // Add here
];
```

### Debugging IndexedDB

Use Chrome DevTools:
1. Open DevTools → **Application** tab
2. Expand **IndexedDB** → **ShotSpotOfflineDB**
3. Click on stores (games, shots, events, etc.) to view data
4. Right-click on entries to delete or inspect

### Forcing a Sync

In browser console, run:

```javascript
// Get pending actions count
const offlineSync = await import('./utils/offlineSync');
const count = await offlineSync.getPendingActionsCount();
console.log(`${count} pending actions`);

// Force sync
await offlineSync.processQueue();
```

## Security Considerations

- **Authentication tokens** are stored in localStorage and sent with synced requests
- **CSRF tokens** are obtained fresh when syncing (not cached)
- **Sensitive data** in IndexedDB is cleared when user logs out
- **Service Worker** only caches public assets and API responses, not credentials

## Performance Impact

- **Initial load**: ~50KB additional JavaScript for offline support
- **Storage**: ~5-10MB for typical match data (varies by usage)
- **CPU**: Minimal - sync operations run in background
- **Battery**: Service Worker is efficient, minimal battery impact

## Future Enhancements

Potential improvements for offline support:

- **Conflict resolution**: Handle cases where same data is modified on multiple devices
- **Selective sync**: Allow users to choose which data to sync
- **Offline analytics**: Generate match reports entirely offline
- **Progressive sync**: Prioritize important data (shots) over less critical data
- **Export offline**: Download match data as CSV/PDF without internet

## Support

For issues or questions about offline support:
1. Check browser console for error messages
2. Review this documentation
3. Open an issue on GitHub with:
   - Browser and version
   - Steps to reproduce
   - Console errors
   - Network conditions when issue occurred
