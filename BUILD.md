# Build and Run Guide - Quick Reference

**Last Updated**: October 19, 2025

This is a quick reference for building and running ShotSpot. For complete guides, see the documentation links at the bottom.

---

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **Node.js** | 18.0.0 | 20.x LTS |
| **PostgreSQL** | 14.0 | 15.x |
| **RAM** | 4 GB | 8 GB |
| **Storage** | 500 MB | 2 GB |
| **OS** | Win 10, macOS 10.15, Ubuntu 20.04 | Latest |

---

## Installation Commands

```bash
# 1. Clone repository
git clone https://github.com/pSecurIT/ShotSpot.git
cd ShotSpot

# 2. Install all dependencies
npm run install:all

# 3. Copy environment file
cp backend/.env.example backend/.env

# 4. Edit backend/.env (set passwords and secrets)

# 5. Setup database
npm run setup-db

# 6. Run application
npm run dev
```

---

## Running the Application

### Development Mode (Recommended for Field Testing)

```bash
npm run dev
```

**What it does**:
- Starts backend on port 3001
- Starts frontend on port 3000
- Enables hot-reload (changes reflect immediately)
- Opens browser automatically

**Access**:
- App: http://localhost:3000
- API: http://localhost:3001/api

### Production Mode

```bash
# Build frontend
cd frontend
npm run build
cd ..

# Start backend (serves built frontend)
cd backend
npm start
```

**Access**: http://localhost:3001

### Running Components Separately

```bash
# Terminal 1 - Backend
npm run start:backend

# Terminal 2 - Frontend  
npm run start:frontend
```

---

## Building for Production

### Frontend Build

```bash
cd frontend
npm run build
```

**Output**: `frontend/dist/` directory

**Build includes**:
- Minified JavaScript
- Optimized CSS
- Compressed assets
- Source maps (for debugging)

**Build size**: ~500 KB (gzipped)

### Backend Build

No build step required - Node.js runs the source directly.

For optimization:
```bash
# Install production dependencies only
cd backend
npm ci --only=production
```

---

## Testing

### Run All Tests

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

### Test with Coverage

```bash
# Backend coverage
cd backend && npm run test:coverage

# Frontend coverage
cd frontend && npm run coverage
```

### E2E Tests (Frontend)

```bash
cd frontend

# Interactive mode
npm run cypress:open

# Headless mode
npm run cypress:run
```

### Linting

```bash
# Backend
cd backend && npm run lint

# Frontend
cd frontend && npm run lint

# Auto-fix issues
npm run lint:fix
```

---

## Database Operations

### Setup/Reset Database

```bash
npm run setup-db
```

### Manual Database Operations

```bash
# Connect to database
psql -U shotspot_user -d shotspot_db

# Backup database
pg_dump -U shotspot_user shotspot_db > backup.sql

# Restore database
psql -U shotspot_user shotspot_db < backup.sql

# Drop and recreate
dropdb -U postgres shotspot_db
createdb -U postgres shotspot_db -O shotspot_user
psql -U shotspot_user shotspot_db < backend/scripts/schema.sql
```

---

## Environment Configuration

### Backend (.env)

**Required variables**:
```bash
# Server
PORT=3001

# Database
DB_USER=shotspot_user
DB_PASSWORD=your_secure_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=shotspot_db

# PostgreSQL superuser (for setup)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_postgres_password

# Security
JWT_SECRET=min_32_character_random_string
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# API
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW_MS=300000

# Logging
LOG_LEVEL=info
LOG_FORMAT=combined
```

### Frontend (.env)

```bash
VITE_API_URL=http://localhost:3001/api
```

### Generate Secure Secrets

```bash
# macOS/Linux
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32|%{Get-Random -Min 0 -Max 256}))

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Network Access (Multiple Devices)

### Enable Network Access

1. **Find your IP address**:
   ```bash
   # Windows
   ipconfig
   
   # macOS/Linux
   ifconfig | grep "inet "
   ```

2. **Update CORS** in `backend/.env`:
   ```bash
   CORS_ORIGIN=http://localhost:3000,http://192.168.1.100:3000
   ```
   (Replace with your actual IP)

3. **Restart backend**:
   ```bash
   npm run dev
   ```

4. **Access from other devices**:
   - Tablet/Phone: http://192.168.1.100:3000

---

## Common Build Issues

### Issue: Port Already in Use

```bash
# Find process using port
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9

# Or change port in configuration
```

### Issue: Module Not Found

```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
rm -rf frontend/node_modules frontend/package-lock.json
rm -rf backend/node_modules backend/package-lock.json
npm run install:all
```

### Issue: Database Connection Failed

```bash
# Check PostgreSQL is running
# Windows
Get-Service postgresql*

# macOS
brew services list

# Linux
sudo systemctl status postgresql

# Verify credentials
psql -U shotspot_user -d shotspot_db
```

### Issue: Build Fails (Frontend)

```bash
cd frontend

# Clear cache
rm -rf node_modules .vite dist
npm install

# Build with verbose output
npm run build -- --debug
```

### Issue: Out of Memory During Build

```bash
# Increase Node memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

---

## Performance Optimization

### Development

```bash
# Reduce database connections
# In backend/.env:
DB_MAX_CONNECTIONS=10

# Disable verbose logging
LOG_LEVEL=error
```

### Production

```bash
# Use production build
cd frontend && npm run build

# Enable gzip compression in nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript;

# Enable caching
Cache-Control: public, max-age=31536000

# Use CDN for static assets
```

---

## Deployment Checklist

### Pre-Flight (Before Match Day)

- [ ] Application installed and tested
- [ ] Database setup complete
- [ ] Teams and players entered
- [ ] Laptop fully charged
- [ ] PostgreSQL service running
- [ ] Backup power source available
- [ ] Tested offline mode
- [ ] Network access configured (if needed)

### Starting Application

```bash
# 1. Open terminal/command prompt
cd ShotSpot

# 2. Start application
npm run dev

# 3. Wait for confirmation
[backend] Server running on port 3001
[backend] ✓ Database connection established
[frontend] ➜ Local: http://localhost:3000/

# 4. Open browser
# Automatically opens or go to http://localhost:3000
```

### Post-Match

```bash
# 1. Export match data (via app UI)

# 2. Backup database
pg_dump -U shotspot_user shotspot_db > match_$(date +%Y%m%d).sql

# 3. Stop application
# Press Ctrl+C in terminal

# 4. Optionally stop PostgreSQL
# Windows: net stop postgresql-x64-14
# macOS: brew services stop postgresql
# Linux: sudo systemctl stop postgresql
```

---

## Monitoring

### Check Application Status

```bash
# Check if backend is running
curl http://localhost:3001/api/health

# Check database connection
psql -U shotspot_user -d shotspot_db -c "SELECT 1;"

# Monitor logs (if using PM2)
pm2 logs shotspot-backend
```

### Performance Metrics

```bash
# Database stats
psql -U shotspot_user shotspot_db -c "
  SELECT 
    schemaname, 
    tablename, 
    n_tup_ins as inserts, 
    n_tup_upd as updates, 
    n_tup_del as deletes 
  FROM pg_stat_user_tables;
"

# Application memory
# Windows: Task Manager
# macOS: Activity Monitor
# Linux: htop or top
```

---

## Backup and Recovery

### Quick Backup

```bash
# Backup everything important
mkdir -p backups/$(date +%Y%m%d)

# Database
pg_dump -U shotspot_user shotspot_db > backups/$(date +%Y%m%d)/database.sql

# Environment config (without passwords!)
cp backend/.env.example backups/$(date +%Y%m%d)/env.example

# Custom config
cp backend/.env backups/$(date +%Y%m%d)/.env.backup
```

### Quick Recovery

```bash
# Restore database
psql -U shotspot_user shotspot_db < backups/20241019/database.sql

# Verify
psql -U shotspot_user shotspot_db -c "SELECT COUNT(*) FROM games;"
```

---

## Quick Command Reference

```bash
# Installation
npm run install:all                    # Install all dependencies
npm run setup-db                       # Setup database

# Running
npm run dev                           # Development mode
npm start                             # Production mode
npm run start:backend                 # Backend only
npm run start:frontend                # Frontend only

# Building
cd frontend && npm run build          # Build frontend
cd frontend && npm run preview        # Preview build

# Mobile Apps (see MOBILE.md for details)
npm run mobile:sync                   # Build and sync to mobile
npm run mobile:android                # Open Android Studio
npm run mobile:ios                    # Open Xcode (macOS)

# Testing
npm test                              # Run tests
npm run test:watch                    # Watch mode
npm run test:coverage                 # With coverage

# Linting
npm run lint                          # Check code
npm run lint:fix                      # Fix issues

# Database
npm run setup-db                      # Setup/reset
pg_dump -U shotspot_user shotspot_db  # Backup
psql -U shotspot_user shotspot_db     # Connect

# Updating
git pull origin main                  # Update code
npm run install:all                   # Update dependencies

# Maintenance
npm audit                             # Check vulnerabilities
npm audit fix                         # Fix vulnerabilities
npm outdated                          # Check for updates
```

---

## Documentation Links

📚 **Full Documentation**:

- **[QUICKSTART.md](QUICKSTART.md)** - 5-minute quick start
- **[INSTALLATION.md](INSTALLATION.md)** - Complete installation guide
- **[MOBILE.md](MOBILE.md)** - Build native iOS & Android apps
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment
- **[SECURITY.md](SECURITY.md)** - Security guidelines
- **[README.md](README.md)** - Project overview

🔧 **Development**:

- **[frontend/README.md](frontend/README.md)** - Frontend development
- **[.github/copilot-instructions.md](.github/copilot-instructions.md)** - Development guidelines

---

## Support

**Issues?** Check:
1. [Troubleshooting section](INSTALLATION.md#troubleshooting)
2. [GitHub Issues](https://github.com/pSecurIT/ShotSpot/issues)
3. Email: support@shotspot.example.com

**Emergency Support**:
- Database: dba@shotspot.example.com
- Infrastructure: devops@shotspot.example.com
- Security: security@shotspot.example.com

---

**Version**: 1.0.0  
**Last Updated**: October 19, 2025  
**Maintained by**: pSecurIT Team
