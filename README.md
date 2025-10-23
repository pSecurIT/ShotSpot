# ShotSpot

[![Security Rating](https://img.shields.io/security-headers?url=https%3A%2F%2Fshotspot-demo.example.com)](https://securityheaders.com)
[![Code Coverage](https://img.shields.io/codecov/c/github/pSecurIT/Korfball-game-statistics)](https://codecov.io/gh/pSecurIT/Korfball-game-statistics)

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
- Back-end: Node.js + Express
- Database: PostgreSQL

## 🎨 UX/UI Considerations

- Touch-optimized buttons (for tablets on the sideline)     
- Quick-access event buttons (e.g. drag & drop player to court to log a shot)
- Court visualization to tap/click shot locations
- Undo/Edit options for fast corrections during live play
- Auto-saving and offline support (essential for unstable connections)

## Next up (features to come)

- Heatmaps & shot charts
- Player performance over time
- Sync across multiple devices
- Video tagging integration
- Integration with competition platforms or league databases

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm ([Download here](https://nodejs.org/))
- **PostgreSQL** 14+ ([Download here](https://www.postgresql.org/download/))
- **Git** ([Download here](https://git-scm.com/downloads))

### Installation (5 minutes)

1. **Clone and install**:
   ```bash
   git clone https://github.com/pSecurIT/Korfball-game-statistics.git
   cd Korfball-game-statistics
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
| **[SECURITY.md](SECURITY.md)** | Security best practices | 10 min |
| **[SECRETS.md](SECRETS.md)** | Secrets management | 5 min |
| **[frontend/README.md](frontend/README.md)** | Frontend development | 10 min |

**Total Documentation**: 90 minutes of comprehensive guides

For detailed installation instructions (including troubleshooting), see **[INSTALLATION.md](INSTALLATION.md)**.

## 🔒 Security

### Authentication & Authorization

- JWT-based authentication with refresh token rotation
- Role-based access control (Coach, Assistant, Viewer)
- Secure password hashing with bcrypt
- Session management with secure cookie options

### API Security

- Rate limiting: 100 requests per 15 minutes per IP
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
- Authentication attempt tracking
- Regular security dependency scanning
- Automated vulnerability testing

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
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
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