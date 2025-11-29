# ShotSpot

[![Security Rating](https://img.shields.io/security-headers?url=https%3A%2F%2Fshotspot-demo.example.com)](https://securityheaders.com)
[![Code Coverage](https://img.shields.io/codecov/c/github/pSecurIT/ShotSpot)](https://codecov.io/gh/pSecurIT/ShotSpot)
[![Frontend Coverage](https://img.shields.io/codecov/c/github/pSecurIT/ShotSpot/main?flag=frontend&label=Frontend%20Coverage)](https://codecov.io/gh/pSecurIT/ShotSpot)
[![Backend Coverage](https://img.shields.io/codecov/c/github/pSecurIT/ShotSpot/main?flag=backend&label=Backend%20Coverage)](https://codecov.io/gh/pSecurIT/ShotSpot)
[![Build Status](https://github.com/pSecurIT/ShotSpot/workflows/Test%20Coverage/badge.svg)](https://github.com/pSecurIT/ShotSpot/actions)
[![Docker Image](https://img.shields.io/badge/docker-ghcr.io-blue?logo=docker)](https://ghcr.io/psecurit/shotspot)
[![Docker Pulls](https://img.shields.io/badge/docker-multi--platform-success?logo=docker)](https://github.com/pSecurIT/ShotSpot/pkgs/container/shotspot)
[![License](https://img.shields.io/github/license/pSecurIT/ShotSpot)](LICENSE)

## ✅ App Summary

- A web-based or cross-platform mobile app for live match event tracking in korfball. The app allows:
- Pre-match: Input teams, players, bench, lineups.
- In-match: Real-time event tracking:
- Shot attempts (location, result: goal/miss/korf hit)
- Time tracking (game clock)
- Faults (offensive, defensive, out-of-bounds)
- Post-match: Data export for analysis or sharing.

## 🧱 Core Features (MVP)
### 1. Team & Player Management

- Add players, assign to teams
- Set starting lineup and substitutes
- Edit players’ info

### 2. Live Match Dashboard

- Game timer (with periods and pause)
- Real-time event buttons:
- Shot attempt → pick player → select location → result (goal/miss/hit korf)
- Faults → player/team → fault type
- Substitution → in/out player
- Visual half-court or full-court map for shot tracking

### 3. Event History / Match Log

- Timeline of all events
- Ability to edit/delete events in real-time

### 4. Analytics & Export

- Summarized match stats (per player, team)
- Download/export CSV or PDF report

## 🎯 Target Users

- Coaches and assistant coaches
- Team analysts
- Statisticians for clubs or federations

## 📱 Tech stack

- Front-end: 
  - React.js with TypeScript
  - Vite (build tool & dev server)
  - Vitest for unit testing
  - Cypress for E2E testing
  - **Capacitor.js** for native mobile apps (iOS & Android)
- Back-end: Node.js + Express
- Database: PostgreSQL

## 🎨 UX/UI Considerations

- Touch-optimized buttons (for tablets on the sideline)     
- Quick-access event buttons (e.g. drag & drop player to court to log a shot)
- Court visualization to tap/click shot locations
- Undo/Edit options for fast corrections during live play
- **✅ Offline support**: Full functionality without internet connection (see [OFFLINE.md](OFFLINE.md))
- **📱 Native mobile apps**: Available for iOS and Android (see [MOBILE.md](MOBILE.md))
- **🚀 Automated deployment**: CI/CD pipelines for App Store and Google Play (see [MOBILE_DEPLOYMENT.md](MOBILE_DEPLOYMENT.md))
- Auto-saving and data persistence

## 📊 Real-Time Match Reports (NEW!)

ShotSpot now includes comprehensive real-time match reporting capabilities:

- **Live Match Dashboard**: Real-time game state snapshots with scores, shot summaries, and top scorers
- **Period Reports**: Detailed statistics for each game period
- **Momentum Tracker**: Real-time momentum calculations based on recent performance
- **Player Comparison**: Side-by-side player performance analysis
- **Substitution Suggestions**: Data-driven recommendations based on player performance
- **Downloadable Reports**: Export complete game data in JSON format

📖 **Full API Documentation**: See [REPORTS_API.md](REPORTS_API.md) for complete endpoint details, examples, and integration guides.

## Next up (features to come)

- Heatmaps & shot charts (partially implemented)
- Player performance over time (available via reports API)

## 📊 Match Reports

Generate comprehensive PDF reports for post-match analysis:

- **Post-Match Summary**: Game statistics, period-by-period scoring, team comparison, top performers, and shot chart visualization
- **Player Performance**: Individual stats, zone-based shooting efficiency, substitutions, and season comparison
- **Coach's Analysis**: Tactical insights, possession stats, substitution patterns, momentum analysis, and custom notes

See [REPORTS_API.md](REPORTS_API.md) for detailed API documentation.

## Next up (features to come)

- ✅ Heatmaps & shot charts (implemented in reports)
- ✅ Player performance over time (implemented in player report)
- Sync across multiple devices
- Video tagging integration
- Integration with competition platforms or league databases

## 🚀 Quick Start

> **🐳 Docker Users**: See [DOCKER.md](DOCKER.md) for containerized deployment

### Prerequisites

- **Node.js** 18+ and npm ([Download here](https://nodejs.org/))
- **PostgreSQL** 14+ ([Download here](https://www.postgresql.org/download/))
- **Git** ([Download here](https://git-scm.com/downloads))

**OR** use **Docker** for zero-config setup:
- **Docker** 20.10+ ([Download here](https://docs.docker.com/get-docker/))
- **Docker Compose** 2.0+ (included with Docker Desktop)

### Docker Installation (Recommended - 2 minutes)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/pSecurIT/ShotSpot.git
   cd ShotSpot
   ```

2. **Configure environment**:
   ```bash
   cp .env.docker.example .env
   # Edit .env and set DB_PASSWORD and JWT_SECRET
   ```

3. **Start with Docker**:
   ```bash
   docker-compose up -d
   ```

**That's it!** Access at http://localhost:3001

For full Docker documentation, see [DOCKER.md](DOCKER.md)

---

### Manual Installation (5 minutes)

1. **Clone and install**:
   ```bash
   git clone https://github.com/pSecurIT/ShotSpot.git
   cd ShotSpot
   npm run install:all
   ```

2. **Set up environment**:
   ```bash
   # Copy example environment file
   cp backend/.env.example backend/.env
   
   # Edit backend/.env and set your PostgreSQL password:
   # - DB_PASSWORD=your_secure_password
   # - POSTGRES_PASSWORD=your_postgres_password (if needed)
   # - JWT_SECRET=generate_a_random_32_character_string
   ```

3. **Set up database**:
   ```bash
   npm run setup-db
   ```

4. **Start the application**:
   ```bash
   npm run dev
   ```

The app will automatically open at http://localhost:3000 🎉

### Running the Application

**Development mode** (with hot-reload):
```bash
npm run dev
```

**Production mode** (optimized):
```bash
# Build frontend
cd frontend && npm run build && cd ..

# Start backend
cd backend && npm start
```

Access at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api
- **Network Access**: http://[your-ip]:3000 (for tablets/phones)

### Testing

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# Frontend tests with coverage
cd frontend && npm run coverage

# Run linting
npm run lint
```

## 📖 Documentation

### Quick Navigation

**👋 Getting Started**
- 🚀 **New User?** Start with [QUICKSTART.md](QUICKSTART.md) (5 minutes)
- 💻 **Installing for field testing?** See [INSTALLATION.md](INSTALLATION.md) (Complete guide)
- 🔧 **Need commands?** Check [BUILD.md](BUILD.md) (Command reference)

**🎯 By Use Case**
- **Coach/Field Testing**: [INSTALLATION.md](INSTALLATION.md) → Everything you need for match day
- **Developer**: [BUILD.md](BUILD.md) + [frontend/README.md](frontend/README.md) → Dev workflow
- **Production Deployment**: [DEPLOYMENT.md](DEPLOYMENT.md) → Server deployment guide
- **Having Issues?**: [INSTALLATION.md#troubleshooting](INSTALLATION.md#troubleshooting) → 15+ solutions

### All Documentation

📚 **Complete Documentation Set**:

| Document | Purpose | Time to Read |
|----------|---------|--------------|
| **[QUICKSTART.md](QUICKSTART.md)** | Get running in 5 minutes | 5 min |
| **[INSTALLATION.md](INSTALLATION.md)** | Complete installation & troubleshooting | 15 min |
| **[BUILD.md](BUILD.md)** | Build/run command reference | 10 min |
| **[DEPLOYMENT.md](DEPLOYMENT.md)** | Production deployment guide | 20 min |
| **[OFFLINE.md](OFFLINE.md)** | Offline functionality guide | 15 min |
| **[MOBILE.md](MOBILE.md)** | Mobile app development | 20 min |
| **[MOBILE_DEPLOYMENT.md](MOBILE_DEPLOYMENT.md)** | Mobile CI/CD & app store deployment | 30 min |
| **[SECURITY.md](SECURITY.md)** | Security best practices | 10 min |
| **[SECRETS.md](SECRETS.md)** | Secrets management | 5 min |
| **[REPORTS_API.md](REPORTS_API.md)** | Real-Time Match Reports API | 15 min |
| **[frontend/README.md](frontend/README.md)** | Frontend development | 10 min |

**Total Documentation**: 120 minutes of comprehensive guides

For detailed installation instructions (including troubleshooting), see **[INSTALLATION.md](INSTALLATION.md)**.

## 🔒 Security

### Authentication & Authorization

- JWT-based authentication with secure token handling
- Role-based access control (Admin, Coach, User)
- Secure password hashing with bcrypt (12 rounds)
- Session management with secure cookie options
- Login history tracking with IP address and user agent logging
- Password strength validation (uppercase, lowercase, number, special character)
- Forced password change on first login for admin-created users

### API Security

- Rate limiting: 1000 requests per 5 minutes per IP
- Request throttling for brute force prevention
- CORS configuration with strict origin validation
- Request size limits to prevent DoS attacks

### Data Protection

- Input validation on all API endpoints
- SQL injection prevention with parameterized queries
- XSS protection via Content Security Policy
- HTTPS enforced in production

### Headers & Policies

- Strict security headers configuration:
  - Content Security Policy (CSP)
  - HSTS preloading
  - X-Frame-Options
  - X-Content-Type-Options
  - Referrer-Policy
  - Permissions-Policy

### Auditing

- Comprehensive error logging
- Login history tracking (success/failure, IP, user agent)
- User activity monitoring (last login timestamps)
- Authentication attempt tracking
- Regular security dependency scanning
- Automated vulnerability testing

### Admin User Management

- **User Creation**: Admin panel for creating new users with role assignment
- **Role Management**: Change user roles (admin/coach/user) with hierarchy enforcement
- **User Deactivation**: Soft delete users while preserving data integrity
- **Bulk Operations**: Select multiple users for bulk role changes
- **Profile Editing**: Update user details (username, email) with validation
- **Activity Monitoring**: View login history and last login timestamps
- **Data Export**: Export user lists to CSV for reporting
- **Security Controls**: 
  - Prevent self-demotion/deletion for admins
  - Prevent deletion of last admin
  - Audit trail for all user management actions

For detailed security information, see [SECURITY.md](./SECURITY.md).

## 🔑 Secrets Management

### Environment Variables

#### Security Variables
```bash
# Authentication & Session
JWT_SECRET=your-super-secure-jwt-secret
SESSION_SECRET=your-super-secure-session-secret
CSRF_SECRET=your-super-secure-csrf-secret

# API Security
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW_MS=300000
RATE_LIMIT_MAX=1000
RATE_LIMIT_SKIP_TRUSTED=true
API_MAX_PAYLOAD_SIZE=10kb
TRUSTED_IPS=127.0.0.1

# Security Headers
ENABLE_HSTS=true
HSTS_MAX_AGE=31536000
CSP_REPORT_URI=/api/csp-report

# Error Handling & Logging
LOG_LEVEL=info
LOG_FORMAT=combined
LOG_FILE_PATH=logs/app.log
ENABLE_REQUEST_LOGGING=true
ENABLE_ERROR_LOGGING=true
ENABLE_SECURITY_LOGGING=true
ERROR_NOTIFICATION_WEBHOOK=https://your-webhook
ERROR_NOTIFICATION_EMAIL=admin@example.com
```

- Production secrets managed via secure environment variables
- Local development uses .env files (not committed to git)
- Required variables documented in .env.example
- Separate configurations for development/testing/production
- Regular secret rotation in production

### Sensitive Data

The following files should NEVER be committed to git:
- .env files (except .env.example)
- Private keys or certificates
- Database credentials
- JWT secrets
- API keys

### Production Secrets

For production deployment:
1. Use a secure secrets management service
2. Rotate credentials regularly
3. Use least-privilege access principles
4. Monitor for secret exposure
5. Implement secret rotation procedures

See [SECRETS.md](./SECRETS.md) for detailed secrets management procedures.