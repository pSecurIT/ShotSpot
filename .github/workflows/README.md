# GitHub Actions Workflows

This directory contains all CI/CD workflows for ShotSpot.

## 📋 Workflows Overview

| Workflow | Trigger | Purpose | Runtime |
|----------|---------|---------|---------|
| **[node.js.yml](node.js.yml)** | Push, PR | Run backend + frontend tests | ~5 min |
| **[test-coverage.yml](test-coverage.yml)** | Push, PR | Generate coverage reports | ~7 min |
| **[coverage-badge.yml](coverage-badge.yml)** | Push to main | Update coverage badges | ~3 min |
| **[codeql.yml](codeql.yml)** | Push, PR, Schedule | Security scanning | ~10 min |
| **[docker.yml](docker.yml)** | Push, PR | Build & test Docker images | ~8 min |
| **[release.yml](release.yml)** | Release, Tag | Build & push multi-platform Docker | ~20 min |
| **[mobile-ci.yml](mobile-ci.yml)** | Push, PR | Build & test mobile apps | ~15 min |
| **[mobile-release.yml](mobile-release.yml)** | Release, Manual | Deploy to app stores | ~25 min |
| **[mobile-preview.yml](mobile-preview.yml)** | Manual | Generate preview builds | ~10 min |

---

## 🔄 Backend & Frontend Workflows

### node.js.yml - Core Testing
**Triggers**: Push/PR to `main` or `develop`

**Jobs**:
- Install dependencies
- Run backend tests (Jest)
- Run frontend tests (Vitest)
- Lint code (ESLint)

**Secrets Required**: None

**Output**: Test results, lint warnings

---

### test-coverage.yml - Coverage Reports
**Triggers**: Push/PR to `main` or `develop`

**Jobs**:
- Backend coverage (Jest)
- Frontend coverage (Vitest)
- Upload to Codecov
- Generate HTML reports

**Secrets Required**:
- `CODECOV_TOKEN` (optional but recommended)

**Output**: Coverage badges, HTML reports

---

### coverage-badge.yml - Badge Generation
**Triggers**: Push to `main`

**Jobs**:
- Calculate coverage percentages
- Generate SVG badges
- Commit to repository

**Secrets Required**: None (uses `GITHUB_TOKEN`)

**Output**: Updated badges in README

---

## 🔒 Security Workflows

### codeql.yml - Security Scanning
**Triggers**:
- Push/PR to `main`
- Weekly schedule (Mondays at 6am UTC)

**Jobs**:
- Scan JavaScript/TypeScript code
- Detect security vulnerabilities
- Generate SARIF reports

**Secrets Required**: None

**Output**: Security alerts in Security tab

**Status**: "Neutral" result is normal when no issues found

---

## 🐳 Docker Workflows

### docker.yml - Docker Testing
**Triggers**: Push/PR affecting Docker files

**Jobs**:
- Build multi-platform images (amd64, arm64)
- Test container startup
- Verify health checks
- Run integration tests

**Secrets Required**: None

**Output**: Docker build logs

---

### release.yml - Docker Release
**Triggers**:
- GitHub releases
- Git tags (`v*`)
- Manual workflow dispatch

**Jobs**:
- Build production images
- Push to GitHub Container Registry (ghcr.io)
- Multi-platform support (amd64, arm64)
- Tag with version numbers

**Secrets Required**: None (uses `GITHUB_TOKEN`)

**Output**: Published Docker images at `ghcr.io/psecurit/shotspot`

**Registry**: https://github.com/pSecurIT/ShotSpot/pkgs/container/shotspot

---

## 📱 Mobile Workflows

### mobile-ci.yml - Mobile Testing
**Triggers**: Push/PR affecting frontend

**Jobs**:
1. **Android Build**
   - Setup Node.js, Java, Android SDK
   - Build web app
   - Sync Capacitor
   - Build debug APK
   - Run Android lint

2. **iOS Build** (macOS runner)
   - Setup Node.js, Xcode
   - Install CocoaPods
   - Build web app
   - Sync Capacitor
   - Build iOS app

3. **Mobile Tests**
   - Validate Capacitor config
   - Run frontend tests
   - Check for updates

4. **App Size Check**
   - Verify APK size < 50MB
   - Report size metrics

**Secrets Required**: None

**Output**: Debug APK, lint reports, size metrics

**Artifacts Retention**: 7 days

---

### mobile-release.yml - App Store Deployment
**Triggers**:
- GitHub releases
- Manual dispatch with options:
  - Platform: `android`, `ios`, or `both`
  - Release type: `internal`, `beta`, or `production`

**Jobs**:

#### Android Release
- Build production AAB (Android App Bundle)
- Sign with release keystore
- Upload to Google Play Console
- Attach APK to GitHub Release

**Required Secrets**:
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- `VITE_API_URL_PRODUCTION`

#### iOS Release
- Build production IPA
- Sign with distribution certificate
- Upload to App Store Connect
- Attach IPA to GitHub Release

**Required Secrets**:
- `IOS_CERTIFICATE_BASE64`
- `IOS_CERTIFICATE_PASSWORD`
- `IOS_PROVISIONING_PROFILE_BASE64`
- `IOS_PROVISIONING_PROFILE_NAME`
- `IOS_TEAM_ID`
- `APP_STORE_CONNECT_API_KEY_ID`
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_API_KEY_BASE64`
- `VITE_API_URL_PRODUCTION`

**Output**: Signed APK/AAB, IPA, GitHub Release assets

**Artifacts Retention**: 30 days

**Setup Guide**: See [MOBILE_DEPLOYMENT.md](../MOBILE_DEPLOYMENT.md)

---

### mobile-preview.yml - Preview Builds
**Triggers**: Manual workflow dispatch

**Inputs**:
- `branch`: Branch to build from (default: `develop`)

**Jobs**:
- Build debug APK (Android)
- Build debug app (iOS)
- Generate download instructions
- Create QR codes for distribution

**Secrets Required**:
- `VITE_API_URL_PREVIEW` (optional)

**Output**: Debug APK/IPA for testing

**Artifacts Retention**: 14 days

**Use Case**: Test specific branches on real devices before merging

---

## 🔐 Secrets Management

### Public Workflows (No Secrets)
- `node.js.yml`
- `codeql.yml`
- `docker.yml`
- `coverage-badge.yml`
- `mobile-ci.yml`
- `mobile-preview.yml` (optional secret)

### Protected Workflows (Secrets Required)
- `test-coverage.yml` - `CODECOV_TOKEN`
- `release.yml` - Uses `GITHUB_TOKEN` (automatic)
- `mobile-release.yml` - See mobile secrets list above

### Setting Secrets
1. Go to: **Repository → Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Add name and value
4. Save

**Important**: Secrets are encrypted and not visible after creation

---

## 🚀 Workflow Triggers

### Automatic Triggers
```yaml
# On push to main/develop
on:
  push:
    branches: [ main, develop ]

# On pull request
on:
  pull_request:
    branches: [ main, develop ]

# On release publish
on:
  release:
    types: [published]

# Scheduled (cron)
on:
  schedule:
    - cron: '0 6 * * 1'  # Mondays at 6am UTC
```

### Manual Triggers
```yaml
on:
  workflow_dispatch:
    inputs:
      platform:
        description: 'Platform to build'
        type: choice
        options: [android, ios, both]
```

**To Run Manually**:
1. Go to **Actions** tab
2. Select workflow
3. Click **Run workflow**
4. Select branch and options
5. Click **Run workflow**

---

## 📊 Monitoring Workflows

### Viewing Logs
1. Go to **Actions** tab
2. Click on workflow run
3. Click on job to see logs
4. Expand steps to see details

### Downloading Artifacts
1. Go to workflow run
2. Scroll to **Artifacts** section
3. Click artifact name to download

### Troubleshooting Failed Workflows
1. Check error message in logs
2. Review changed files in commit
3. Test locally first
4. Re-run workflow if transient failure

---

## ⚡ Optimization Tips

### Caching
All workflows use dependency caching:
```yaml
- uses: actions/setup-node@v4
  with:
    cache: 'npm'
```

### Parallel Jobs
Most workflows run jobs in parallel:
- Backend tests + Frontend tests
- Android build + iOS build
- Docker build + Test

### Conditional Execution
```yaml
# Only run on specific file changes
on:
  push:
    paths:
      - 'frontend/**'
      - '.github/workflows/mobile-ci.yml'
```

---

## 📈 Workflow Status Badges

Add to README:
```markdown
[![Build Status](https://github.com/pSecurIT/ShotSpot/workflows/Test%20Coverage/badge.svg)](https://github.com/pSecurIT/ShotSpot/actions)
```

Available badges:
- Build Status
- Test Coverage
- Docker Image
- CodeQL
- License

---

## 🔄 Workflow Dependencies

```
node.js.yml → test-coverage.yml → coverage-badge.yml
     ↓                                    ↓
mobile-ci.yml                        README badges
     ↓
mobile-preview.yml
     ↓
mobile-release.yml
```

---

## 📝 Adding New Workflows

1. Create `.github/workflows/new-workflow.yml`
2. Define triggers and jobs
3. Add secrets (if needed)
4. Test with workflow dispatch first
5. Document in this README

**Template**:
```yaml
name: My New Workflow

on:
  workflow_dispatch:

jobs:
  my-job:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - name: Run something
        run: echo "Hello World"
```

---

## 🆘 Getting Help

- **Workflow syntax**: https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions
- **Action marketplace**: https://github.com/marketplace?type=actions
- **Mobile deployment**: [MOBILE_DEPLOYMENT.md](../MOBILE_DEPLOYMENT.md)
- **Docker deployment**: [DOCKER.md](../DOCKER.md)

---

## 📊 Workflow Statistics

| Category | Count | Total Runtime |
|----------|-------|---------------|
| Testing | 3 | ~15 min |
| Security | 1 | ~10 min |
| Docker | 2 | ~28 min |
| Mobile | 3 | ~50 min |
| **Total** | **9** | **~103 min** |

**All workflows combined**: ~103 minutes of compute time per full CI/CD cycle

**Optimization**: Workflows run in parallel, so total wall-clock time is much lower (~25 minutes for full pipeline)

---

**Last Updated**: November 29, 2025  
**Maintained By**: ShotSpot Development Team
