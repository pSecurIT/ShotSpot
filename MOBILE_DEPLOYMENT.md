# Mobile Deployment Setup

This guide explains how to configure GitHub Actions secrets for automated mobile app deployment.

## Overview

Three GitHub Actions workflows handle mobile deployments:

1. **mobile-ci.yml** - Builds and tests on every push/PR (no secrets needed)
2. **mobile-release.yml** - Production releases to App Store & Google Play
3. **mobile-preview.yml** - Manual preview builds for testing

## 📱 Android Setup

### Prerequisites

1. **Google Play Console Account**
   - Register at https://play.google.com/console
   - Pay one-time $25 registration fee
   - Create app listing for "ShotSpot"

2. **Android Keystore** (for signing releases)
   ```bash
   # Generate keystore (one-time setup)
   keytool -genkey -v -keystore shotspot-release.keystore \
     -alias shotspot -keyalg RSA -keysize 2048 -validity 10000
   
   # Enter passwords and details when prompted
   # Store keystore file securely - NEVER commit to git!
   ```

3. **Service Account for Google Play API**
   - In Play Console: Setup → API access
   - Create service account
   - Grant "Release Manager" permissions
   - Download JSON key file

### Required GitHub Secrets (Android)

Navigate to: `GitHub Repository → Settings → Secrets and variables → Actions`

| Secret Name | Description | How to Generate |
|-------------|-------------|-----------------|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded keystore file | `base64 -w 0 shotspot-release.keystore` (Linux/Mac)<br>`certutil -encode shotspot-release.keystore keystore.txt` (Windows) |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password | Password you set during keystore generation |
| `ANDROID_KEY_ALIAS` | Key alias | Alias you set during keystore generation (e.g., "shotspot") |
| `ANDROID_KEY_PASSWORD` | Key password | Key password from keystore generation |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Service account JSON | Paste entire contents of downloaded JSON file |
| `VITE_API_URL_PRODUCTION` | Production API URL | Your backend URL (e.g., `https://api.shotspot.com`) |
| `VITE_API_URL_PREVIEW` | Preview API URL | Preview backend URL (optional) |

### Android Configuration Files

Create `frontend/android/keystore.properties` locally (DO NOT commit):
```properties
storeFile=release.keystore
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=shotspot
keyPassword=YOUR_KEY_PASSWORD
```

Add to `.gitignore`:
```
frontend/android/keystore.properties
frontend/android/app/release.keystore
```

### Gradle Configuration

Update `frontend/android/app/build.gradle`:

```gradle
android {
    // ... existing config ...
    
    signingConfigs {
        release {
            def keystorePropertiesFile = rootProject.file("../keystore.properties")
            if (keystorePropertiesFile.exists()) {
                def keystoreProperties = new Properties()
                keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
                
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

---

## 🍎 iOS Setup

### Prerequisites

1. **Apple Developer Account**
   - Enroll at https://developer.apple.com/programs/
   - $99/year subscription required
   - Agree to developer agreements

2. **App Store Connect**
   - Create app listing at https://appstoreconnect.apple.com
   - Set bundle ID: `com.psecurit.shotspot`
   - Configure app metadata, screenshots, privacy policy

3. **Xcode & Certificates**
   - Install Xcode from Mac App Store
   - Open `frontend/ios/App/App.xcworkspace` in Xcode
   - Go to Signing & Capabilities
   - Select your team
   - Xcode will auto-generate certificates

### Required GitHub Secrets (iOS)

| Secret Name | Description | How to Generate |
|-------------|-------------|-----------------|
| `IOS_CERTIFICATE_BASE64` | Distribution certificate (.p12) | Export from Keychain → `base64 -w 0 certificate.p12` |
| `IOS_CERTIFICATE_PASSWORD` | Certificate password | Password used when exporting .p12 |
| `IOS_PROVISIONING_PROFILE_BASE64` | Provisioning profile | Download from Developer Portal → `base64 -w 0 profile.mobileprovision` |
| `IOS_PROVISIONING_PROFILE_NAME` | Profile name | Name from Developer Portal (e.g., "ShotSpot Distribution") |
| `IOS_TEAM_ID` | Apple Team ID | Found in Developer Portal membership |
| `APP_STORE_CONNECT_API_KEY_ID` | App Store Connect API Key ID | Create in App Store Connect → Users & Access → Keys |
| `APP_STORE_CONNECT_ISSUER_ID` | App Store Connect Issuer ID | Found on API Keys page |
| `APP_STORE_CONNECT_API_KEY_BASE64` | App Store Connect API Key (.p8) | Download from App Store Connect → `base64 -w 0 AuthKey_XXX.p8` |

### Exporting iOS Certificate

1. Open **Keychain Access** on Mac
2. Select **login** keychain → **My Certificates**
3. Find "Apple Distribution: Your Name"
4. Right-click → Export
5. Save as `.p12` format
6. Set a password
7. Convert to base64:
   ```bash
   base64 -w 0 certificate.p12 | pbcopy
   ```
8. Paste into GitHub secret `IOS_CERTIFICATE_BASE64`

### Creating Provisioning Profile

1. Go to https://developer.apple.com/account/resources/profiles
2. Click **+** to create new profile
3. Select **App Store** (for production)
4. Select App ID: `com.psecurit.shotspot`
5. Select Distribution Certificate
6. Download `.mobileprovision` file
7. Convert to base64:
   ```bash
   base64 -w 0 profile.mobileprovision | pbcopy
   ```
8. Paste into `IOS_PROVISIONING_PROFILE_BASE64`

### Creating App Store Connect API Key

1. Go to https://appstoreconnect.apple.com/access/api
2. Click **+** to create key
3. Name: "GitHub Actions"
4. Access: **App Manager**
5. Download `.p8` file (only available once!)
6. Note the **Key ID** and **Issuer ID**
7. Convert to base64:
   ```bash
   base64 -w 0 AuthKey_ABC123.p8 | pbcopy
   ```

---

## 🚀 Deployment Workflows

### Automatic Release (on Git Tag)

```bash
# Create and push release tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# Or create GitHub Release via web UI
# This automatically triggers mobile-release.yml
```

### Manual Release

1. Go to: `GitHub → Actions → Mobile Release`
2. Click **Run workflow**
3. Select:
   - Platform: `android`, `ios`, or `both`
   - Release type: `internal`, `beta`, or `production`
4. Click **Run workflow**

### Preview Builds

For testing on specific branches:

1. Go to: `GitHub → Actions → Mobile Preview Build`
2. Click **Run workflow**
3. Enter branch name (default: `develop`)
4. Download APK/IPA from artifacts
5. Install on test devices

---

## 📋 Release Checklist

### Before First Release

- [ ] Android keystore generated and backed up
- [ ] iOS certificates and profiles created
- [ ] All GitHub secrets configured
- [ ] Google Play listing created
- [ ] App Store Connect listing created
- [ ] Privacy policy URL published
- [ ] Support email configured
- [ ] App screenshots prepared (5.5", 6.5", 12.9")
- [ ] App description written
- [ ] Release notes prepared

### Before Each Release

- [ ] Version bumped in `frontend/package.json`
- [ ] Changelog updated
- [ ] All tests passing
- [ ] Manual testing completed
- [ ] App icons and splash screens verified
- [ ] Backend API compatibility confirmed

### Testing Release Builds

#### Android
```bash
# Build locally to test
cd frontend
npm run build
npx cap sync android
cd android
./gradlew bundleRelease

# Test signed APK
adb install app/build/outputs/apk/release/app-release.apk
```

#### iOS
```bash
# Build locally to test
cd frontend
npm run build
npx cap sync ios
cd ios/App
open App.xcworkspace

# In Xcode: Product → Archive → Distribute
```

---

## 🔒 Security Best Practices

1. **Never commit secrets to git**
   - Add keystore files to `.gitignore`
   - Add `keystore.properties` to `.gitignore`
   - Keep `.p12` and `.p8` files out of repository

2. **Backup critical files securely**
   - Store keystore in encrypted vault
   - Save certificates to secure password manager
   - Document all passwords in secure location

3. **Rotate secrets regularly**
   - Update App Store Connect API keys annually
   - Rotate service account keys periodically

4. **Use environment-specific API URLs**
   - Production: Points to production backend
   - Preview: Points to staging backend
   - Never hardcode URLs in source code

5. **Review workflow permissions**
   - GitHub Actions only have necessary permissions
   - Service accounts have minimal required access

---

## 🐛 Troubleshooting

### Android Build Fails with "Keystore not found"

**Solution**: Ensure `ANDROID_KEYSTORE_BASE64` is properly base64-encoded:
```bash
base64 -w 0 shotspot-release.keystore > keystore.txt
# Copy contents of keystore.txt to GitHub secret
```

### iOS Build Fails with "No matching provisioning profile"

**Solution**: 
1. Verify bundle ID matches: `com.psecurit.shotspot`
2. Ensure provisioning profile includes distribution certificate
3. Check profile hasn't expired
4. Re-download and re-encode profile

### Google Play Upload Fails

**Solution**:
1. Verify service account has "Release Manager" role
2. Check API access is enabled in Play Console
3. Ensure version code is incremented
4. Verify AAB is properly signed

### App Store Connect Upload Fails

**Solution**:
1. Verify API key has "App Manager" access
2. Check Team ID matches developer account
3. Ensure app listing exists in App Store Connect
4. Verify bundle ID matches

---

## 📊 Monitoring Releases

### Android
- **Google Play Console**: https://play.google.com/console
- View: Production → Releases
- Monitor: Install stats, crash reports, ratings

### iOS
- **App Store Connect**: https://appstoreconnect.apple.com
- View: My Apps → ShotSpot → Activity
- Monitor: TestFlight feedback, crash analytics

### GitHub Actions
- **Workflow Runs**: Repository → Actions tab
- Monitor build times, success rates
- Download artifacts for manual testing

---

## 📱 Distribution Tracks

### Android (Google Play)

1. **Internal Testing** (up to 100 testers)
   - Fastest review (minutes)
   - Use for QA team

2. **Closed Beta** (up to 1000 testers)
   - Requires review (~few hours)
   - Use for beta testers

3. **Open Beta** (unlimited)
   - Public but opt-in
   - Gather user feedback

4. **Production**
   - Full review (~1-2 days)
   - Available to all users

### iOS (App Store)

1. **TestFlight** (up to 10,000 testers)
   - Internal: Team members (instant)
   - External: Beta testers (~24 hours review)

2. **App Store**
   - Full review (~24-48 hours)
   - Available to all users

---

## 🔄 Version Management

Versions are automatically managed by GitHub Actions:

- **Version Name**: From `frontend/package.json` → `"version": "1.0.0"`
- **Version Code** (Android): GitHub run number
- **Build Number** (iOS): GitHub run number

To bump version:
```bash
cd frontend
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.1 → 1.1.0
npm version major  # 1.1.0 → 2.0.0
git push --tags
```

---

## 📞 Support

For deployment issues:
1. Check GitHub Actions logs
2. Review this documentation
3. Check platform-specific consoles (Play Console, App Store Connect)
4. Open issue on GitHub with logs and error messages

---

## 🎯 Next Steps

1. **Configure all secrets** in GitHub repository settings
2. **Test preview builds** with manual workflow dispatch
3. **Deploy to internal track** for initial testing
4. **Gather feedback** from beta testers
5. **Deploy to production** when ready

Remember: First-time setup is complex, but subsequent releases are automated! 🚀
