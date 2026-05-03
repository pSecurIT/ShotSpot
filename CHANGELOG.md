# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- New documentation set for navigation and feature adoption:
	- `docs/USER_GUIDE.md`
	- `docs/NAVIGATION_GUIDE.md`
	- `docs/COMPETITION_MANAGEMENT.md`
- Architecture diagrams for navigation rendering flow and competition lifecycle
- API client documentation for navigation-linked feature modules (clubs, competitions, series, analytics, reports, settings)

### Changed
- Updated `README.md` with navigation/competition enhancements and visual references
- Updated `frontend/README.md` with component-level navigation documentation and API method index
- Updated `QUICKSTART.md` with navigation quick tour and direct links to new guides

## [1.0.0] - 2025-11-29

### ✨ Initial Release

#### Core Features
- **Match Statistics Tracking**: Real-time event recording during korfball matches
- **Shot Location Mapping**: Interactive court with shot placement tracking
- **Player Management**: Comprehensive player and team database
- **Live Timer**: Period management with automatic time tracking
- **Real-time Events**: Shots, fouls, substitutions, timeouts with live updates
- **Analytics Dashboard**: Comprehensive statistics and visualizations
- **Offline Support**: PWA with IndexedDB sync queue for offline matches
- **Export Functionality**: PDF and CSV exports for match reports

#### Mobile Apps
- **Android App**: Native Android application via Capacitor
- **iOS App**: Native iOS application via Capacitor
- **Cross-platform**: Shared codebase between web and mobile

#### Technical Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Node.js + Express 5
- **Database**: PostgreSQL with direct SQL queries
- **Real-time**: WebSocket support via Socket.IO
- **Authentication**: JWT-based auth with role-based access control
- **Testing**: 787 backend tests + 817 frontend tests (comprehensive coverage)

#### Security Features
- Rate limiting and slow-down protection
- CSRF protection
- Content Security Policy (CSP)
- Input validation and sanitization
- Secure password hashing (bcrypt)
- Environment variable validation

#### Documentation
- Complete installation guide (INSTALLATION.md)
- Quick start guide (QUICKSTART.md)
- Security documentation (SECURITY.md)
- Offline mode guide (OFFLINE.md)
- Mobile deployment guide (MOBILE_DEPLOYMENT.md)
- Docker deployment guide (DOCKER.md)

### 🔐 Security
- Implemented comprehensive security middleware
- Added rate limiting for API endpoints
- Configured strict CSP headers
- Enabled HTTPS in production

### 📱 Mobile Deployment
- Automated CI/CD with GitHub Actions
- App Store and Google Play release workflows
- Automatic version bumping
- Debug and release APK/IPA generation

### 🐛 Known Issues
- None reported in initial release

### 📝 Notes
- This is the first stable release of ShotSpot
- Requires Node.js 20+ and PostgreSQL 14+
- Mobile apps require additional signing configuration for production
- See MOBILE_DEPLOYMENT.md for store submission requirements

[1.0.0]: https://github.com/pSecurIT/Korfball-game-statistics/releases/tag/v1.0.0
