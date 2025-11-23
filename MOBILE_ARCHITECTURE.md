# ShotSpot Mobile Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ShotSpot Application                      │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │            React Frontend (TypeScript)              │    │
│  │                                                      │    │
│  │  ├─ Components (Teams, Players, Live Match, etc.)  │    │
│  │  ├─ Hooks (useOfflineStatus, useAuth, etc.)        │    │
│  │  ├─ Contexts (AuthContext, WebSocketContext)       │    │
│  │  ├─ Utils (api.ts, indexedDB.ts, offlineSync.ts)   │    │
│  │  └─ Service Worker (offline support)               │    │
│  │                                                      │    │
│  └──────────────────┬───────────────────────────────────┘    │
│                     │                                         │
│                     ▼                                         │
│         ┌───────────────────────┐                           │
│         │   Capacitor Bridge    │                           │
│         │   (Native Runtime)    │                           │
│         └───────┬───────────────┘                           │
│                 │                                             │
│        ┌────────┴─────────┐                                 │
│        ▼                  ▼                                  │
│  ┌──────────┐      ┌──────────┐                            │
│  │ Android  │      │   iOS    │                             │
│  │  Native  │      │  Native  │                             │
│  └──────────┘      └──────────┘                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
   ┌──────────┐        ┌──────────┐
   │  Google  │        │  Apple   │
   │   Play   │        │   App    │
   │  Store   │        │  Store   │
   └──────────┘        └──────────┘
```

## Technology Stack

### Frontend Layer
```
┌─────────────────────────────────────────┐
│  React 19 + TypeScript                  │
│  ├─ Vite (Build Tool)                   │
│  ├─ React Router (Navigation)           │
│  ├─ Axios (HTTP Client)                 │
│  ├─ Socket.IO (WebSocket)               │
│  ├─ Recharts (Visualizations)           │
│  └─ Service Worker (Offline)            │
└─────────────────────────────────────────┘
```

### Mobile Bridge Layer
```
┌─────────────────────────────────────────┐
│  Capacitor 7.4.4                        │
│  ├─ Core APIs                           │
│  ├─ Splash Screen Plugin                │
│  ├─ Platform Adapters                   │
│  └─ Native Bridge                       │
└─────────────────────────────────────────┘
```

### Native Platform Layers
```
┌──────────────────┐    ┌──────────────────┐
│  Android Platform│    │   iOS Platform   │
│  ├─ Gradle Build │    │  ├─ Xcode Build  │
│  ├─ API 22+      │    │  ├─ iOS 13+      │
│  ├─ WebView      │    │  ├─ WKWebView    │
│  └─ Native APIs  │    │  └─ Native APIs  │
└──────────────────┘    └──────────────────┘
```

## Data Flow Architecture

### User Interaction Flow
```
User Action (Touch/Click)
    ↓
React Component Handler
    ↓
State Management (React Context/Hooks)
    ↓
API Call (Axios)
    ↓
┌─────────────┐
│  Online?    │
└─────┬───────┘
      │
   Yes│No
      │
    ┌─┴─────────────┐
    ▼               ▼
Backend API    IndexedDB Queue
    │               │
    ▼               ▼
PostgreSQL    Wait for Online
    │               │
    └───────┬───────┘
            ▼
    Update UI State
            ▼
    Re-render Component
```

### Offline Sync Flow
```
Device Goes Online
    ↓
Service Worker Detects Connection
    ↓
Trigger Sync Event
    ↓
Process Queue (offlineSync.ts)
    ↓
┌─────────────────────┐
│  For Each Action:   │
│  1. Get CSRF Token  │
│  2. Send to Backend │
│  3. Handle Response │
│  4. Update IndexedDB│
│  5. Mark as Synced  │
└─────────────────────┘
    ↓
Clean Up Old Entries (7 days)
    ↓
Update UI Indicator (Green checkmark)
```

## File Structure

### Repository Structure
```
ShotSpot/
├── frontend/
│   ├── src/                    # React source code
│   │   ├── components/         # React components
│   │   ├── contexts/           # React contexts
│   │   ├── hooks/              # Custom hooks
│   │   ├── utils/              # Utility functions
│   │   │   ├── api.ts          # API client
│   │   │   ├── indexedDB.ts    # Offline storage
│   │   │   └── offlineSync.ts  # Sync queue
│   │   ├── main.tsx            # Entry point
│   │   └── App.tsx             # Root component
│   │
│   ├── public/
│   │   └── service-worker.js   # PWA offline support
│   │
│   ├── dist/                   # Built web app (generated)
│   │   ├── index.html
│   │   ├── assets/
│   │   └── service-worker.js
│   │
│   ├── android/                # Android project (generated)
│   │   ├── app/
│   │   │   └── src/main/
│   │   │       ├── assets/public/  # Web app copy
│   │   │       ├── res/            # Android resources
│   │   │       └── AndroidManifest.xml
│   │   ├── gradle/
│   │   └── build.gradle
│   │
│   ├── ios/                    # iOS project (generated)
│   │   ├── App/
│   │   │   ├── App/
│   │   │   │   ├── public/         # Web app copy
│   │   │   │   ├── Assets.xcassets/
│   │   │   │   └── Info.plist
│   │   │   ├── App.xcodeproj/
│   │   │   └── Podfile
│   │   └── Pods/
│   │
│   ├── capacitor.config.ts     # Capacitor configuration
│   ├── package.json            # Dependencies & scripts
│   ├── vite.config.ts          # Build configuration
│   └── tsconfig.json           # TypeScript config
│
├── backend/                    # Node.js/Express API
│   └── src/
│
├── MOBILE.md                   # Complete mobile guide
├── MOBILE_QUICK_REFERENCE.md   # Quick reference
└── MOBILE_ARCHITECTURE.md      # This file
```

## Build Process Flow

### Development Build
```
1. Source Code Change
   ↓
2. npm run dev
   ↓
3. Vite Dev Server (Port 3000)
   ↓
4. Hot Module Replacement
   ↓
5. Browser Auto-Refresh
```

### Mobile Production Build
```
1. Source Code Ready
   ↓
2. npm run build
   │  ├─ TypeScript Compilation
   │  ├─ Vite Build
   │  ├─ Code Minification
   │  ├─ Asset Optimization
   │  └─ Output to dist/
   ↓
3. npx cap sync
   │  ├─ Copy dist/ to android/app/src/main/assets/public/
   │  ├─ Copy dist/ to ios/App/App/public/
   │  ├─ Update native dependencies
   │  └─ Sync configuration
   ↓
4. Platform-Specific Build
   │
   ├─ Android:
   │  └─ Gradle Build
   │     ├─ Compile Java/Kotlin
   │     ├─ Package Web Assets
   │     ├─ Sign APK/AAB
   │     └─ Output: app-release.apk
   │
   └─ iOS:
      └─ Xcode Build
         ├─ Compile Swift/Objective-C
         ├─ Package Web Assets
         ├─ Code Signing
         └─ Output: ShotSpot.ipa
```

## Communication Patterns

### API Communication
```
Mobile App
    ↓ HTTPS
Backend API (Express)
    ↓
PostgreSQL Database
```

### Real-Time Updates
```
Mobile App
    ↓ WebSocket (Socket.IO)
Backend Server
    ↓ Broadcast
All Connected Clients
```

### Offline Storage
```
User Action
    ↓
IndexedDB Write
    ↓
Service Worker Cache
    ↓
Local Storage
```

## Security Architecture

### Authentication Flow
```
1. User Login
   ↓
2. Backend validates credentials
   ↓
3. Generate JWT token
   ↓
4. Store in localStorage (mobile secure storage recommended)
   ↓
5. Include in Authorization header for all requests
   ↓
6. Backend validates JWT on each request
```

### Security Layers
```
┌─────────────────────────────────────┐
│  1. HTTPS/TLS Encryption            │
│     (androidScheme: 'https')        │
├─────────────────────────────────────┤
│  2. JWT Authentication              │
│     (Bearer token in headers)       │
├─────────────────────────────────────┤
│  3. CSRF Protection                 │
│     (Backend validation)            │
├─────────────────────────────────────┤
│  4. Rate Limiting                   │
│     (1000 req/5min)                 │
├─────────────────────────────────────┤
│  5. Content Security Policy         │
│     (Helmet.js middleware)          │
├─────────────────────────────────────┤
│  6. CORS Protection                 │
│     (Whitelist-based)               │
└─────────────────────────────────────┘
```

## Offline Support Architecture

### Service Worker Caching Strategy
```
┌──────────────────────────────────────┐
│  Network First (API Endpoints)       │
│  1. Try network request              │
│  2. If fails, serve from cache       │
│  3. Update cache with response       │
├──────────────────────────────────────┤
│  Cache First (Static Assets)         │
│  1. Check cache                      │
│  2. Serve from cache if available    │
│  3. If not, fetch from network       │
│  4. Update cache                     │
└──────────────────────────────────────┘
```

### IndexedDB Schema
```
Database: ShotSpotOfflineDB
├── Store: games
│   └── Key: gameId
├── Store: shots
│   └── Key: shotId
├── Store: events
│   └── Key: eventId
├── Store: substitutions
│   └── Key: substitutionId
├── Store: teams
│   └── Key: teamId
├── Store: players
│   └── Key: playerId
└── Store: syncQueue
    └── Key: actionId
        ├── method (POST/PUT/DELETE)
        ├── url
        ├── data
        ├── timestamp
        └── synced (boolean)
```

## Performance Optimization

### Bundle Optimization
```
Input: React Source Code
    ↓
Tree Shaking (Remove unused code)
    ↓
Code Splitting (Separate chunks)
    ↓
Minification (Reduce size)
    ↓
Gzip Compression
    ↓
Output: ~316 KB gzipped
```

### Runtime Performance
```
First Load:
  - Service Worker Registration
  - IndexedDB Initialization
  - Initial Data Fetch
  - Cache Static Assets
  
Subsequent Loads:
  - Load from Cache (instant)
  - Background sync check
  - Update if needed
```

## Deployment Pipeline

### Development → Production
```
1. Code Changes
   ↓
2. Git Commit & Push
   ↓
3. CI/CD Pipeline (GitHub Actions)
   │  ├─ Run tests
   │  ├─ Run linters
   │  ├─ Security scan (CodeQL)
   │  └─ Build check
   ↓
4. Manual Build for Mobile
   │  ├─ npm run mobile:sync
   │  ├─ Open Android Studio/Xcode
   │  └─ Build signed release
   ↓
5. App Store Submission
   │  ├─ Google Play Console
   │  └─ App Store Connect
   ↓
6. Review & Approval
   ↓
7. Published to Stores
```

## Plugin Architecture

### Current Plugins
```
@capacitor/splash-screen
├── Android Implementation
├── iOS Implementation
└── Web Fallback
```

### Adding New Plugins (Future)
```
Example: Camera Plugin

1. Install:
   npm install @capacitor/camera

2. Sync:
   npx cap sync

3. Use in React:
   import { Camera } from '@capacitor/camera';
   
   const photo = await Camera.getPhoto({
     quality: 90,
     resultType: 'uri'
   });

4. Auto-linked to native projects
```

## Monitoring & Analytics (Future)

### Potential Integrations
```
┌────────────────────────────────┐
│  Performance Monitoring        │
│  - Firebase Performance        │
│  - Sentry                      │
└────────────────────────────────┘
         ↓
┌────────────────────────────────┐
│  Analytics                     │
│  - Firebase Analytics          │
│  - Google Analytics            │
└────────────────────────────────┘
         ↓
┌────────────────────────────────┐
│  Crash Reporting               │
│  - Firebase Crashlytics        │
│  - Sentry                      │
└────────────────────────────────┘
```

## Version Management

### App Versioning
```
Frontend: 1.0.0
├── capacitor.config.ts (appName, appId)
├── android/app/build.gradle
│   ├── versionCode: 1
│   └── versionName: "1.0"
└── ios/App/App/Info.plist
    ├── CFBundleShortVersionString: 1.0
    └── CFBundleVersion: 1
```

## Future Enhancements

### Planned Features
```
1. Push Notifications
   - @capacitor/push-notifications
   - Firebase Cloud Messaging

2. Camera Integration
   - @capacitor/camera
   - Team photos
   - QR code scanning

3. Biometric Auth
   - @capacitor/biometric-auth
   - Touch ID / Face ID

4. Native Share
   - @capacitor/share
   - Share match reports

5. Background Sync
   - @capacitor/background-sync
   - Sync while app is backgrounded

6. Geolocation
   - @capacitor/geolocation
   - Match location tracking

7. App Widgets
   - iOS/Android home screen widgets
   - Live match score display
```

## Capacity Planning

### Resource Requirements

**Development:**
- Android Studio: 8 GB RAM, 10 GB disk
- Xcode: 16 GB RAM, 40 GB disk
- Node.js: 1 GB RAM, 500 MB disk

**Runtime:**
- Android App: ~50-100 MB RAM
- iOS App: ~50-100 MB RAM
- Storage: ~20-50 MB (app + data)

**Network:**
- Initial download: ~15-20 MB
- Match data sync: ~1-5 MB per match
- Real-time updates: ~10-50 KB/minute

## Conclusion

This architecture provides:
- ✅ Single codebase for web, iOS, and Android
- ✅ Native performance and features
- ✅ Full offline support
- ✅ Scalable and maintainable
- ✅ Security-first design
- ✅ Production-ready
