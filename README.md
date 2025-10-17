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

## 🚀 Deployment

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Git

### Environment Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/pSecurIT/Korfball-game-statistics.git
   cd Korfball-game-statistics
   ```

2. Install dependencies:
   ```bash
   # Backend
   cd backend
   npm install

   # Frontend
   cd ../frontend
   npm install
   ```

3. Configure environment variables:
   ```bash
   # Backend
   cp backend/.env.example backend/.env
   # Frontend
   cp frontend/.env.example frontend/.env
   ```

### Database Setup

1. Create PostgreSQL database and user:
   ```bash
   cd backend/scripts
   node setup-db.js
   ```

2. Run migrations:
   ```bash
   cd ..
   npm run migrate
   ```

### Production Deployment

1. Build frontend:
   ```bash
   cd frontend
   npm run build
   ```

2. Start production server:
   ```bash
   cd ../backend
   npm start
   ```

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

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