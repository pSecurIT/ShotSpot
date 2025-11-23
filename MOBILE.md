# ShotSpot Mobile App

## Overview

ShotSpot is now available as a native mobile application for iOS and Android! The mobile app is built using [Capacitor](https://capacitorjs.com/), which wraps the existing React web application into native mobile applications while maintaining full offline support and native device capabilities.

## Features

- ✅ **Native iOS and Android apps** - Installable from App Store and Google Play
- ✅ **Full offline support** - Works without internet connection via Service Worker and IndexedDB
- ✅ **Native splash screen** - Professional loading screen on app launch
- ✅ **Touch-optimized interface** - Perfect for tablets on the sideline
- ✅ **Access to device APIs** - Camera, geolocation, and more (via Capacitor plugins)
- ✅ **Single codebase** - Same React codebase for web, iOS, and Android

## Prerequisites

### For All Platforms
- Node.js >= 18
- npm >= 8
- Capacitor CLI (installed as dependency)

### For Android Development
- [Android Studio](https://developer.android.com/studio) (Arctic Fox or later)
- Android SDK (API 22+ recommended)
- Java Development Kit (JDK) 11 or later

### For iOS Development (macOS only)
- [Xcode](https://developer.apple.com/xcode/) 13 or later
- Xcode Command Line Tools
- CocoaPods: `sudo gem install cocoapods`
- Apple Developer Account (for device testing and App Store distribution)

## Quick Start

### 1. Install Dependencies

```bash
# From repository root
npm run install:all

# Install Capacitor dependencies (already included in package.json)
cd frontend
npm install
```

### 2. Build the Web App

```bash
cd frontend
npm run build
```

This creates an optimized production build in the `dist/` directory that will be used by the mobile apps.

### 3. Sync Native Projects

After building, sync the web assets to the native platforms:

```bash
npx cap sync
```

This command:
- Copies the built web app to native projects
- Updates native dependencies
- Syncs Capacitor configuration

### 4. Open in Native IDE

#### Android
```bash
npx cap open android
```
Opens Android Studio where you can:
- Run on emulator or connected device
- Build APK/AAB for distribution
- Debug with native tools

#### iOS
```bash
npx cap open ios
```
Opens Xcode where you can:
- Run on simulator or connected device
- Build IPA for distribution
- Configure signing and provisioning

## Development Workflow

### Standard Development Cycle

1. **Make changes to React code** in `frontend/src/`
2. **Test in browser** during development:
   ```bash
   cd frontend
   npm run dev
   ```
3. **Build for mobile** when ready:
   ```bash
   npm run build
   npx cap sync
   ```
4. **Test on device/emulator** via Android Studio or Xcode

### Live Reload (Optional)

For faster development, you can use Capacitor's live reload feature:

1. Find your computer's local IP address:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet "
   # Windows
   ipconfig
   ```

2. Update `capacitor.config.ts`:
   ```typescript
   server: {
     url: 'http://YOUR_IP:3000',
     cleartext: true
   }
   ```

3. Run dev server: `npm run dev`
4. Run `npx cap sync`
5. Open native IDE and run on device

**Important**: Remove the `server.url` configuration before building for production!

## Scripts Reference

Add these scripts to `frontend/package.json` for convenient mobile development:

```json
{
  "scripts": {
    "mobile:sync": "npm run build && npx cap sync",
    "mobile:android": "npm run mobile:sync && npx cap open android",
    "mobile:ios": "npm run mobile:sync && npx cap open ios",
    "mobile:run:android": "npm run mobile:sync && npx cap run android",
    "mobile:run:ios": "npm run mobile:sync && npx cap run ios"
  }
}
```

## Configuration

### capacitor.config.ts

The Capacitor configuration is located at `frontend/capacitor.config.ts`:

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.psecurit.shotspot',
  appName: 'ShotSpot',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#1a73e8",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
```

### Important Configuration Notes

- **appId**: Must be unique (reverse domain notation)
- **appName**: Displayed under the app icon
- **webDir**: Points to Vite's build output (`dist`)
- **server.androidScheme/iosScheme**: Use HTTPS for production

## Backend Integration

The mobile app needs to connect to your backend API. There are several approaches:

### Option 1: Cloud Deployment (Recommended for Production)

Deploy the backend to a cloud service and configure the API URL:

1. Deploy backend to Heroku, AWS, Azure, etc.
2. Update API base URL in `frontend/src/utils/api.ts`:
   ```typescript
   const API_BASE_URL = process.env.VITE_API_URL || 'https://your-backend.com/api';
   ```
3. Set `VITE_API_URL` environment variable before building

### Option 2: Local Network (Development)

For testing on local network:

1. Ensure backend is running and accessible on your network
2. Use your computer's local IP instead of `localhost`
3. Update API calls to use `http://YOUR_IP:3001/api`

### Option 3: Bundled Backend (Advanced)

Package a lightweight backend with the mobile app:
- Use SQLite for local data storage
- Sync with cloud when online
- Requires significant refactoring

## App Icons and Splash Screens

### Generating Icons

Use the Capacitor Asset Generator or create icons manually:

1. **Using Capacitor Asset Generator** (Recommended):
   ```bash
   npm install -g @capacitor/assets
   # Place icon.png (1024x1024) in frontend/resources/
   npx capacitor-assets generate --iconBackgroundColor="#1a73e8"
   ```

2. **Manual Creation**:
   - Android: Place icons in `android/app/src/main/res/mipmap-*/`
   - iOS: Use Xcode's Asset Catalog in `ios/App/App/Assets.xcassets/`

### Icon Specifications

- **Icon**: 1024x1024px PNG with transparency
- **Android**: Adaptive icon with foreground and background layers
- **iOS**: Rounded corners applied automatically by iOS

### Splash Screen

The splash screen configuration is in `capacitor.config.ts`. Customize:

```typescript
SplashScreen: {
  launchShowDuration: 2000,        // Duration in ms
  backgroundColor: "#1a73e8",       // Background color
  androidScaleType: "CENTER_CROP",  // Image scaling
  showSpinner: false,               // Loading spinner
}
```

## Testing

### Testing Offline Functionality

The mobile app includes full offline support:

1. Launch app while online
2. Enable airplane mode on device
3. Continue using the app normally
4. Actions are queued and synced when back online

Test the offline indicator and sync queue in both online and offline modes.

### Testing on Devices

#### Android
- Enable USB Debugging on your Android device
- Connect via USB
- Select device in Android Studio and click Run

#### iOS
- Connect iPhone/iPad via USB
- Select device in Xcode
- Sign with Apple Developer account
- Click Run

### Debugging

#### Android
- Use Chrome DevTools: `chrome://inspect`
- View logs in Android Studio Logcat

#### iOS
- Use Safari Web Inspector: Develop → Device Name
- View logs in Xcode Console

## Building for Production

### Android APK/AAB

1. Open Android Studio: `npx cap open android`
2. Build → Generate Signed Bundle/APK
3. Follow the wizard to create keystore and sign
4. For Play Store: Build AAB (Android App Bundle)
5. For direct distribution: Build APK

### iOS IPA

1. Open Xcode: `npx cap open ios`
2. Select "Any iOS Device" as target
3. Product → Archive
4. Distribute App → App Store Connect or Ad Hoc
5. Follow code signing and provisioning steps

### Environment-Specific Builds

Use environment variables for different builds:

```bash
# Development
VITE_API_URL=http://localhost:3001/api npm run build

# Staging
VITE_API_URL=https://staging.example.com/api npm run build

# Production
VITE_API_URL=https://api.example.com/api npm run build
```

## Updating the Mobile App

When you update the React codebase:

```bash
cd frontend

# 1. Make your changes to source files
# 2. Test in browser
npm run dev

# 3. Build and sync to native projects
npm run build
npx cap sync

# 4. Test on devices/emulators
npx cap open android  # or ios
```

## Adding Capacitor Plugins

Capacitor provides many native device APIs through plugins:

### Available Plugins

- **@capacitor/camera** - Take photos and access gallery
- **@capacitor/geolocation** - GPS location
- **@capacitor/filesystem** - File system access
- **@capacitor/storage** - Native key-value storage
- **@capacitor/network** - Network status
- **@capacitor/push-notifications** - Push notifications
- **@capacitor/share** - Native share dialog
- And many more...

### Installing a Plugin

```bash
# Install the plugin
npm install @capacitor/camera

# Sync to native projects
npx cap sync

# Import and use in React
import { Camera } from '@capacitor/camera';

async function takePicture() {
  const photo = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: 'uri'
  });
  // Use photo.webPath
}
```

## Troubleshooting

### Build Errors

**Problem**: Capacitor sync fails with "web dir not found"
```
Solution: Run npm run build first to create the dist directory
```

**Problem**: Android build fails with Gradle errors
```
Solution:
1. Delete android/build and android/app/build directories
2. Run npx cap sync android
3. Rebuild in Android Studio
```

**Problem**: iOS build fails with CocoaPods errors
```
Solution:
1. cd ios/App
2. pod deintegrate
3. pod install
4. Open in Xcode and clean build folder
```

### Runtime Errors

**Problem**: White screen on app launch
```
Solution:
1. Check that service-worker.js is in dist/
2. Verify capacitor.config.ts has correct webDir
3. Check browser console in Chrome DevTools/Safari Inspector
```

**Problem**: API requests failing
```
Solution:
1. Verify backend URL is correct
2. Check CORS settings on backend
3. Ensure androidScheme/iosScheme are set to 'https'
4. Test API endpoint in browser first
```

**Problem**: Offline sync not working
```
Solution:
1. Check IndexedDB in Chrome DevTools
2. Verify service worker is registered
3. Test sync queue with manual sync button
4. Check console for sync errors
```

### Platform-Specific Issues

**Android**: App crashes on launch
- Check Android Studio Logcat for native errors
- Verify minimum SDK version (API 22+)
- Ensure all permissions are declared in AndroidManifest.xml

**iOS**: App rejected by App Store
- Review Apple's App Store guidelines
- Ensure privacy descriptions are in Info.plist
- Test on multiple iOS versions
- Validate with App Store Connect

## Continuous Integration

### GitHub Actions Example

Add mobile build to your CI/CD pipeline:

```yaml
name: Mobile Build

on:
  push:
    branches: [main, develop]

jobs:
  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-java@v3
        with:
          distribution: 'temurin'
          java-version: '11'
      - name: Setup Android SDK
        uses: android-actions/setup-android@v2
      - name: Install dependencies
        run: |
          cd frontend
          npm install
      - name: Build web app
        run: |
          cd frontend
          npm run build
      - name: Sync to Android
        run: |
          cd frontend
          npx cap sync android
      - name: Build APK
        run: |
          cd frontend/android
          ./gradlew assembleDebug

  build-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install dependencies
        run: |
          cd frontend
          npm install
      - name: Build web app
        run: |
          cd frontend
          npm run build
      - name: Sync to iOS
        run: |
          cd frontend
          npx cap sync ios
      # Additional steps for Xcode build and code signing
```

## Distribution

### Google Play Store

1. Create a Google Play Developer account ($25 one-time fee)
2. Build signed AAB in Android Studio
3. Create app listing in Play Console
4. Upload AAB and complete store listing
5. Submit for review

### Apple App Store

1. Enroll in Apple Developer Program ($99/year)
2. Create App ID and provisioning profiles
3. Archive and sign IPA in Xcode
4. Upload to App Store Connect via Xcode or Transporter
5. Complete app listing and submit for review

### Alternative Distribution

- **Android**: Direct APK distribution, Firebase App Distribution, Amazon Appstore
- **iOS**: TestFlight (beta testing), Enterprise distribution (requires Enterprise account)

## Best Practices

1. **Always test on real devices** - Emulators don't catch all issues
2. **Use environment variables** - Never hardcode API URLs or secrets
3. **Test offline mode thoroughly** - Critical for ShotSpot's use case
4. **Monitor app size** - Large apps deter downloads
5. **Handle permissions gracefully** - Request only when needed, explain why
6. **Version your app** - Use semantic versioning and track releases
7. **Keep Capacitor updated** - Regular updates include bug fixes and new features
8. **Test across devices** - Different screen sizes, OS versions, and manufacturers

## Resources

- **Capacitor Docs**: https://capacitorjs.com/docs
- **Capacitor React Guide**: https://capacitorjs.com/solution/react
- **Android Developer Docs**: https://developer.android.com/
- **iOS Developer Docs**: https://developer.apple.com/documentation/
- **Capacitor Community Plugins**: https://github.com/capacitor-community

## Support

For issues related to mobile app development:

1. Check this documentation
2. Review Capacitor documentation
3. Check browser/native console for errors
4. Open an issue on GitHub with:
   - Platform (iOS/Android)
   - OS version
   - Device model
   - Steps to reproduce
   - Console errors
   - Screenshots if applicable

## Future Enhancements

Potential mobile-specific features to implement:

- **Push notifications** - Notify coaches of game events
- **Camera integration** - Take team photos, scan QR codes for quick player selection
- **Biometric authentication** - Touch ID/Face ID for quick login
- **Native share** - Share match reports via native share dialog
- **Haptic feedback** - Vibration on shot recorded
- **Background sync** - Sync data even when app is backgrounded
- **App shortcuts** - Quick actions from home screen (e.g., "Start New Game")
- **Widgets** - Display ongoing game score on home screen
