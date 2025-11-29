# 📱 Mobile App Release Guide

This guide explains how to create packaged mobile releases for non-technical users.

## 📦 What Gets Generated

### Android Packages
- **APK** (Android Package) - Direct install file for Android devices
  - Size: ~10-30 MB
  - Can be installed by enabling "Unknown Sources" in Android settings
  - Best for: Testing, side-loading, direct distribution
  
- **AAB** (Android App Bundle) - Optimized for Google Play Store
  - Size: Smaller than APK (Google optimizes per device)
  - Required for: Google Play Store submissions
  - Users download from: Google Play Store

### iOS Packages
- **IPA** (iOS App Store Package) - Install file for iOS devices
  - Size: ~15-40 MB
  - Requires: Apple Developer account and provisioning profile
  - Users download from: App Store or TestFlight (beta)

## 🚀 How to Create Releases

### Option 1: Automated GitHub Release (Recommended)

1. **Create a new release on GitHub**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **Go to GitHub** → Releases → Draft a new release
   - Tag: `v1.0.0`
   - Title: `ShotSpot v1.0.0`
   - Description: Release notes

3. **Publish the release**
   - GitHub Actions automatically builds both Android and iOS apps
   - Packages are uploaded as release assets
   - Takes ~15-20 minutes to complete

4. **Download the packages**:
   - Android APK: `app-release.apk` (ready to install)
   - Android AAB: `app-release.aab` (for Play Store)
   - iOS IPA: `App.ipa` (for App Store/TestFlight)

### Option 2: Manual Workflow Trigger

1. **Go to GitHub** → Actions → Mobile Release
2. **Click "Run workflow"**
3. **Select options**:
   - Platform: Android, iOS, or Both
   - Release type: Internal, Beta, or Production
4. **Download artifacts** from the workflow run

### Option 3: Local Build (Advanced)

#### Android APK (Debug Build for Testing)
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm ci

# Build web app
npm run build

# Sync Capacitor
npx cap sync android

# Build APK
cd android
./gradlew assembleDebug

# APK location: android/app/build/outputs/apk/debug/app-debug.apk
```

#### Android AAB (Release Build)
```bash
# Prerequisites: Configure signing keys (see MOBILE_DEPLOYMENT.md)

cd frontend
npm ci
npm run build
npx cap sync android
cd android
./gradlew bundleRelease

# AAB location: android/app/build/outputs/bundle/release/app-release.aab
```

#### iOS IPA (Release Build)
```bash
# Prerequisites: macOS, Xcode, Apple Developer account

cd frontend
npm ci
npm run build
npx cap sync ios
cd ios/App

# Open in Xcode
open App.xcworkspace

# In Xcode:
# 1. Product → Archive
# 2. Distribute App → App Store Connect
# 3. Export IPA
```

## 📲 Distribution Methods

### For Testing (Internal)

**Android APK**:
1. Share the APK file via email/cloud storage
2. Users enable "Install from Unknown Sources"
3. Users tap the APK file to install
4. No Google Play Store required

**iOS TestFlight**:
1. Upload IPA to App Store Connect
2. Add testers via email
3. Testers install TestFlight app
4. Testers install your app via TestFlight

### For Beta Testers

**Android Beta (Google Play)**:
1. Upload AAB to Google Play Console
2. Create "Closed Testing" or "Open Testing" track
3. Share beta link with testers
4. Testers join beta program and install via Play Store

**iOS Beta (TestFlight)**:
1. Upload IPA to App Store Connect
2. Submit for Beta App Review (1-2 days)
3. Add external testers (up to 10,000)
4. Testers install via TestFlight app

### For Production

**Google Play Store**:
1. Upload AAB to Google Play Console
2. Fill out store listing (screenshots, description)
3. Submit for review (typically 1-3 days)
4. Users download from Play Store

**Apple App Store**:
1. Upload IPA via Xcode or App Store Connect
2. Fill out store listing
3. Submit for review (typically 1-3 days)
4. Users download from App Store

## 📋 Pre-Release Checklist

Before creating a release:

- [ ] Update version in `frontend/package.json`
- [ ] Update `CHANGELOG.md` with new features/fixes
- [ ] Test on physical Android device
- [ ] Test on physical iOS device (if possible)
- [ ] Run all tests: `npm run test && cd frontend && npm test`
- [ ] Build succeeds locally
- [ ] Update screenshots for store listings
- [ ] Prepare release notes

## 🔐 Required Secrets for Automated Releases

### Android (Google Play)
- `ANDROID_KEYSTORE_BASE64` - Signing key (base64 encoded)
- `ANDROID_KEYSTORE_PASSWORD` - Keystore password
- `ANDROID_KEY_ALIAS` - Key alias
- `ANDROID_KEY_PASSWORD` - Key password
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` - Play Store API credentials

### iOS (App Store)
- `IOS_CERTIFICATE_BASE64` - Distribution certificate (base64 encoded)
- `IOS_CERTIFICATE_PASSWORD` - Certificate password
- `IOS_PROVISIONING_PROFILE_BASE64` - Provisioning profile
- `IOS_PROVISIONING_PROFILE_NAME` - Profile name
- `IOS_TEAM_ID` - Apple Team ID
- `APP_STORE_CONNECT_API_KEY_ID` - App Store Connect API key
- `APP_STORE_CONNECT_ISSUER_ID` - API issuer ID
- `APP_STORE_CONNECT_API_KEY_BASE64` - API key file

See `MOBILE_DEPLOYMENT.md` for detailed setup instructions.

## 📊 Release Artifacts

Each release creates the following downloadable artifacts:

| File | Size | Use Case | Retention |
|------|------|----------|-----------|
| `app-debug.apk` | ~15-25 MB | Testing on Android | 7 days |
| `app-release.apk` | ~10-20 MB | Side-loading on Android | 30 days |
| `app-release.aab` | ~8-15 MB | Google Play Store | 30 days |
| `App.ipa` | ~15-30 MB | iOS installation | 30 days |
| `App.xcarchive` | ~50-100 MB | Xcode archive (backup) | 30 days |

## 🎯 Quick Distribution URLs

Once released, share these links with users:

**Google Play** (after approval):
```
https://play.google.com/store/apps/details?id=com.psecurit.shotspot
```

**Apple App Store** (after approval):
```
https://apps.apple.com/app/shotspot/id[YOUR_APP_ID]
```

**TestFlight Beta** (iOS):
```
https://testflight.apple.com/join/[BETA_CODE]
```

**Direct APK Download** (Android):
```
https://github.com/pSecurIT/Korfball-game-statistics/releases/latest/download/app-release.apk
```

## 🔄 Version Numbering

We use semantic versioning with automatic build numbers:

- **Version Name**: `1.2.3` (from package.json)
  - Major: Breaking changes
  - Minor: New features
  - Patch: Bug fixes

- **Version Code**: GitHub run number (auto-incremented)
  - Android: `versionCode` in build.gradle
  - iOS: `CFBundleVersion` in Info.plist

Example:
- Version 1.0.0 → Build 42
- Version 1.1.0 → Build 43
- Version 1.1.1 → Build 44

## 🆘 Troubleshooting

### APK won't install on Android
- Enable "Install from Unknown Sources" in Settings
- Check Android version (requires Android 5.1+)
- Uninstall previous version if needed
- Verify APK isn't corrupted (re-download)

### IPA won't install on iOS
- Device must be registered in provisioning profile
- iOS version must be 13.0 or higher
- Use TestFlight for easier distribution
- Check certificate hasn't expired

### Build fails in GitHub Actions
- Check workflow logs for specific error
- Verify all secrets are configured
- Ensure platform was added: `npx cap add android/ios`
- Check Java version (21 required for Android)

### App crashes on launch
- Check logs: `adb logcat` (Android) or Xcode Console (iOS)
- Verify API URL is correct in environment
- Ensure backend is accessible from device
- Check for missing native permissions

## 📞 Support

For detailed mobile deployment setup, see:
- `MOBILE_DEPLOYMENT.md` - Complete deployment guide
- `MOBILE_DEPLOYMENT_QUICKSTART.md` - Quick start guide
- `.github/workflows/README.md` - Workflow documentation

For issues:
1. Check GitHub Actions logs
2. Review error messages in workflow output
3. Create issue on GitHub repository
