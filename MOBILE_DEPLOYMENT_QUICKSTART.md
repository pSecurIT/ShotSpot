# Mobile Deployment - Quick Start

## ✅ What You Have Now

- ✅ **iOS project initialized** (`frontend/ios/`)
- ✅ **Android project initialized** (`frontend/android/`)
- ✅ **GitHub Actions workflows created**:
  - `mobile-ci.yml` - Automated builds on every push/PR
  - `mobile-release.yml` - Production releases to stores
  - `mobile-preview.yml` - Manual preview builds for testing

## 🎯 Next Steps (Priority Order)

### 1. Test Local Builds First (30 mins)

**Android:**
```bash
cd frontend
npm run build
npx cap sync android
npx cap open android
# Android Studio will open - click "Run" to test on emulator
```

**iOS (macOS only):**
```bash
cd frontend
npm run build
npx cap sync ios
npx cap open ios
# Xcode will open - select simulator and click "Run"
```

### 2. Add App Icons (1 hour)

Generate professional icons at https://icon.kitchen/ or use:

```bash
npm install -D @capacitor/assets
# Place icon.png (1024x1024) and splash.png (2732x2732) in frontend/resources/
npx capacitor-assets generate
```

### 3. Configure GitHub Secrets (2 hours)

Before you can use automated deployment, set up secrets:

**Priority Secrets (for testing CI builds):**
- None needed! The `mobile-ci.yml` workflow works without secrets

**Required for Production Releases:**

See **[MOBILE_DEPLOYMENT.md](MOBILE_DEPLOYMENT.md)** for complete setup instructions.

**Android (Google Play):**
1. Generate keystore
2. Create Google Play Console account
3. Set up service account
4. Add 6 GitHub secrets (keystore, passwords, API key)

**iOS (App Store):**
1. Enroll in Apple Developer Program ($99/year)
2. Export certificates and profiles
3. Create App Store Connect API key
4. Add 8 GitHub secrets (certificates, keys, team ID)

### 4. Test CI Build (10 mins)

Push code to trigger automated build:

```bash
git add .github/workflows/
git commit -m "Add mobile CI/CD workflows"
git push
```

Go to **GitHub → Actions → Mobile CI** to watch build progress.

### 5. Create Preview Build (20 mins)

1. Go to **GitHub → Actions → Mobile Preview Build**
2. Click **Run workflow**
3. Select branch (e.g., `develop`)
4. Wait 5-10 minutes
5. Download APK/IPA from artifacts
6. Test on real device

### 6. Production Release (When Ready)

After thorough testing:

```bash
# Bump version
cd frontend
npm version patch  # or minor/major
git push --tags

# Or manually trigger via GitHub Actions UI
```

---

## 📊 Workflow Status

| Workflow | Purpose | Secrets Required | Status |
|----------|---------|------------------|--------|
| **Mobile CI** | Build & test on push/PR | None ❌ | ✅ Ready |
| **Mobile Preview** | Manual test builds | None ❌ | ✅ Ready |
| **Mobile Release** | Deploy to stores | Yes ⚠️ | ⏳ Needs secrets |

---

## 🔧 Immediate Action Items

### High Priority
- [ ] Test local Android build
- [ ] Test local iOS build (if on macOS)
- [ ] Generate app icons with proper branding
- [ ] Push workflows to trigger first CI build
- [ ] Review build logs for any issues

### Medium Priority (Before Production)
- [ ] Create Google Play Console account
- [ ] Create Apple Developer account
- [ ] Generate Android keystore
- [ ] Export iOS certificates
- [ ] Set up all GitHub secrets
- [ ] Test preview builds on real devices

### Before First Store Submission
- [ ] Write app description
- [ ] Take required screenshots (5.5", 6.5", 12.9")
- [ ] Create privacy policy page
- [ ] Set up support email
- [ ] Prepare release notes
- [ ] Complete store listings

---

## 📱 Recommended Development Workflow

### Daily Development
```bash
# Work on web version
cd frontend
npm run dev

# Test changes in browser first
# When ready for mobile testing:
npm run mobile:sync
npx cap open android  # or ios
```

### Before Merging PR
```bash
# GitHub Actions will automatically:
# 1. Build Android app
# 2. Build iOS app
# 3. Run all tests
# 4. Check app size

# Review build artifacts in Actions tab
```

### Creating Preview Build
```bash
# Option 1: Manual workflow dispatch (GitHub UI)
# Go to Actions → Mobile Preview Build → Run workflow

# Option 2: Local build
npm run mobile:android  # Opens Android Studio
npm run mobile:ios      # Opens Xcode (macOS only)
```

### Production Release
```bash
# Update version
cd frontend
npm version patch  # 1.0.0 → 1.0.1

# Create release
git tag -a v1.0.1 -m "Release 1.0.1"
git push origin v1.0.1

# Or use GitHub Releases UI
# Workflow automatically deploys to stores
```

---

## 🐛 Common Issues & Solutions

### "Capacitor not found" error
```bash
cd frontend
npm install @capacitor/core @capacitor/cli
```

### "Android SDK not found"
- Install Android Studio
- Open Android Studio → SDK Manager → Install SDK
- Set `ANDROID_HOME` environment variable

### "Xcode command line tools not found"
```bash
xcode-select --install
```

### "Pod install fails" (iOS)
```bash
cd frontend/ios/App
sudo gem install cocoapods
pod install
```

### "Build fails on GitHub Actions"
- Check Actions tab for specific error
- Most common: Missing secrets for release builds
- CI builds don't need secrets, release builds do

---

## 📚 Documentation Links

- **Complete Setup**: [MOBILE_DEPLOYMENT.md](MOBILE_DEPLOYMENT.md)
- **Mobile Dev Guide**: [MOBILE.md](MOBILE.md)
- **Architecture**: [MOBILE_ARCHITECTURE.md](MOBILE_ARCHITECTURE.md)
- **Quick Reference**: [MOBILE_QUICK_REFERENCE.md](MOBILE_QUICK_REFERENCE.md)

---

## 🚀 What Happens Automatically

### On Every Push/PR (Mobile CI)
✅ Build Android debug APK  
✅ Build iOS debug app  
✅ Run all tests  
✅ Check app size  
✅ Upload build artifacts  
✅ Run lint checks  

**No secrets needed** - works immediately!

### On Git Tag/Release (Mobile Release)
🔐 Requires secrets configured  
📱 Build signed Android AAB  
📱 Build signed iOS IPA  
🚀 Upload to Google Play Console  
🚀 Upload to App Store Connect  
📦 Attach APK/AAB/IPA to GitHub Release  

### Manual Preview Build
🎮 Build debug APK/IPA  
📥 Upload as artifacts  
🧪 Test on devices  

---

## 💡 Pro Tips

1. **Start with CI builds** - They work without any setup and validate your workflows
2. **Test locally first** - Faster feedback loop than waiting for GitHub Actions
3. **Use preview builds** - Test specific branches before merging
4. **Version bump strategy** - Use semantic versioning (major.minor.patch)
5. **Monitor build times** - Optimize if builds take >15 minutes
6. **Store artifacts** - Keep release builds for at least 30 days

---

## 🎉 Success Criteria

You'll know everything is working when:

- ✅ GitHub Actions shows green checkmarks on Mobile CI
- ✅ You can download and install preview APK on Android device
- ✅ You can run iOS app on simulator/device
- ✅ App launches with ShotSpot branding and splash screen
- ✅ All features work as expected on mobile
- ✅ Offline mode works on device (test by enabling airplane mode)

---

## ⏱️ Time Estimates

| Task | Time Required |
|------|--------------|
| Local build testing | 30 mins |
| App icons generation | 1 hour |
| CI build verification | 10 mins |
| Preview build testing | 20 mins |
| Store account setup | 2-3 hours |
| GitHub secrets config | 1 hour |
| First production release | 2-3 hours |
| **Total (to production)** | **7-9 hours** |

---

## 🆘 Need Help?

1. Check workflow logs in GitHub Actions
2. Review [MOBILE_DEPLOYMENT.md](MOBILE_DEPLOYMENT.md) troubleshooting section
3. Test locally with `npx cap doctor` to diagnose issues
4. Open GitHub issue with error logs

---

**Ready to deploy? Start with step 1 (Test Local Builds)!** 🚀
