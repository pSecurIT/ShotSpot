# ShotSpot Installation Guide

Complete guide for installing and running ShotSpot on your laptop for field testing.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Installation](#detailed-installation)
4. [Running the Application](#running-the-application)
5. [Testing the Installation](#testing-the-installation)
6. [Troubleshooting](#troubleshooting)
7. [Offline Usage](#offline-usage)

---

## Prerequisites

Before installing ShotSpot, ensure your laptop has the following:

### Required Software

1. **Node.js** (v18.0.0 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`
   - Should show v18.0.0 or higher

2. **PostgreSQL** (v14 or higher)
   - Download from: https://www.postgresql.org/download/
   - Verify installation: `psql --version`
   - Should show version 14 or higher

3. **Git** (for cloning the repository)
   - Download from: https://git-scm.com/downloads
   - Verify installation: `git --version`

### System Requirements

- **RAM**: Minimum 4GB (8GB recommended)
- **Storage**: At least 500MB free space
- **OS**: Windows 10/11, macOS 10.15+, or Linux
- **Browser**: Chrome, Firefox, Safari, or Edge (latest version)

---

## Quick Start

For experienced users who want to get started immediately:

```bash
# 1. Clone the repository
git clone https://github.com/pSecurIT/ShotSpot.git
cd ShotSpot

# 2. Install all dependencies
npm run install:all

# 3. Set up environment files
cp backend/.env.example backend/.env

# 4. Configure PostgreSQL password in backend/.env
# Edit backend/.env and set your PostgreSQL password

# 5. Set up the database
npm run setup-db

# 6. Start the application
npm run dev
```

The application will open automatically in your browser at http://localhost:3000

---

## Detailed Installation

### Step 1: Clone the Repository

```bash
# Navigate to where you want to install the app
cd ~/Documents  # or any directory you prefer

# Clone the repository
git clone https://github.com/pSecurIT/ShotSpot.git

# Navigate into the project
cd ShotSpot
```

### Step 2: Install Dependencies

Install all project dependencies (frontend, backend, and root):

```bash
npm run install:all
```

This will:
- Install root dependencies (concurrently for running both servers)
- Install frontend dependencies (React, Vite, etc.)
- Install backend dependencies (Express, PostgreSQL client, etc.)

**Expected output**: You should see "added XXX packages" for each installation.

**If you encounter errors**, try installing individually:
```bash
# Root dependencies
npm install

# Frontend dependencies
cd frontend
npm install
cd ..

# Backend dependencies
cd backend
npm install
cd ..
```

### Step 3: Configure Environment Variables

#### Backend Configuration

1. Copy the example environment file:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. Edit `backend/.env` with your preferred text editor:
   ```bash
   # Windows
   notepad backend\.env

   # macOS
   open backend/.env

   # Linux
   nano backend/.env
   ```

3. **Important**: Update the following variables:

   ```bash
   # Server Configuration
   PORT=3001

   # Database Configuration
   DB_USER=shotspot_user
   DB_PASSWORD=your_secure_password_here    # ← CHANGE THIS!
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=shotspot_db
   DB_MAX_CONNECTIONS=20
   DB_IDLE_TIMEOUT_MS=30000

   # Database Superuser (for setup only)
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_postgres_password  # ← CHANGE THIS if needed!

   # Security (generate secure random strings)
   JWT_SECRET=your-super-secure-jwt-secret-minimum-32-characters
   JWT_EXPIRES_IN=1h
   JWT_REFRESH_EXPIRES_IN=7d

   # API Configuration
   CORS_ORIGIN=http://localhost:3000
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX=100

   # Logging
   LOG_LEVEL=info
   LOG_FORMAT=combined
   ```

4. **Generate secure secrets** (recommended):
   ```bash
   # On macOS/Linux
   openssl rand -base64 32

   # On Windows (PowerShell)
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
   ```

#### Frontend Configuration

The frontend already has a `.env` file with the default API URL:

```bash
VITE_API_URL=http://localhost:3001/api
```

If your backend runs on a different port, create/update `frontend/.env`:
```bash
echo "VITE_API_URL=http://localhost:3001/api" > frontend/.env
```

### Step 4: Set Up PostgreSQL Database

#### Option A: Automatic Setup (Recommended)

Run the automated database setup script:

```bash
npm run setup-db
```

This will:
- Create the database user (`shotspot_user`)
- Create the database (`shotspot_db`)
- Set up all tables and schemas
- Configure proper permissions

**Expected output**:
```
Successfully connected to the database
Database setup completed successfully
```

#### Option B: Manual Setup (If automatic fails)

1. Open PostgreSQL command line:
   ```bash
   # Windows
   psql -U postgres

   # macOS/Linux
   sudo -u postgres psql
   ```

2. Run the following SQL commands:
   ```sql
   -- Create user
   CREATE USER shotspot_user WITH PASSWORD 'your_secure_password_here';

   -- Create database
   CREATE DATABASE shotspot_db WITH OWNER = shotspot_user;

   -- Grant privileges
   GRANT ALL PRIVILEGES ON DATABASE shotspot_db TO shotspot_user;

   -- Exit psql
   \q
   ```

3. Run the schema setup:
   ```bash
   cd backend
   psql -U shotspot_user -d shotspot_db -f scripts/schema.sql
   cd ..
   ```

### Step 5: Verify Installation

Test that everything is properly configured:

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd ../frontend
npm test

# Return to root
cd ..
```

All tests should pass. If any fail, see the [Troubleshooting](#troubleshooting) section.

---

## Running the Application

### Development Mode (For Testing)

Start both frontend and backend servers simultaneously:

```bash
npm run dev
```

This will:
- Start the backend server on http://localhost:3001
- Start the frontend development server on http://localhost:3000
- Automatically open the app in your default browser
- Enable hot-reload (changes reflect immediately)

**You should see**:
```
[backend] Server running on port 3001
[backend] ✓ Database connection established
[frontend] ➜  Local:   http://localhost:3000/
[frontend] ➜  Network: http://192.168.x.x:3000/
```

### Production Mode (For Better Performance)

Build and run the production version:

```bash
# Build the frontend
cd frontend
npm run build
cd ..

# Start the backend in production mode
cd backend
npm start
cd ..
```

Then access the app at http://localhost:3001 (backend serves the built frontend).

### Running Components Separately

If you need to run frontend and backend separately:

```bash
# Terminal 1: Backend
npm run start:backend

# Terminal 2: Frontend
npm run start:frontend
```

---

## Testing the Installation

### Quick Health Check

1. **Check Backend**: Open http://localhost:3001/api/health (or any endpoint)
   - Should return a JSON response (not an error page)

2. **Check Frontend**: Open http://localhost:3000
   - Should show the ShotSpot application interface
   - No console errors in browser DevTools (F12)

3. **Check Database Connection**: Look at backend console output
   - Should show "✓ Database connection established"

### Functional Tests

1. **Create a Team**:
   - Navigate to Team Management
   - Add a new team
   - Verify it appears in the list

2. **Add Players**:
   - Select a team
   - Add multiple players
   - Verify they appear in the roster

3. **Create a Game**:
   - Go to Game Management
   - Create a new game between two teams
   - Verify it appears in the games list

4. **Start a Match**:
   - Click "Prepare Match" on a scheduled game
   - Set up rosters
   - Start the timer
   - Record a shot
   - Verify events appear in the timeline

### Performance Check

The app should:
- Load pages within 1-2 seconds
- Respond to clicks immediately
- Update timers smoothly without lag
- Handle 50+ events without slowdown

---

## Troubleshooting

### Common Issues and Solutions

#### 1. "Cannot connect to database" Error

**Symptoms**: Backend shows database connection errors

**Solutions**:
- Verify PostgreSQL is running:
  ```bash
  # Windows
  Get-Service postgresql*

  # macOS
  brew services list | grep postgresql

  # Linux
  sudo systemctl status postgresql
  ```

- Check credentials in `backend/.env`:
  - Verify `DB_PASSWORD` matches your PostgreSQL user password
  - Verify `DB_USER` exists in PostgreSQL
  - Verify `DB_NAME` database exists

- Test connection manually:
  ```bash
  psql -U shotspot_user -d shotspot_db -h localhost
  ```

- Check PostgreSQL is accepting connections:
  ```bash
  # Edit pg_hba.conf to allow local connections
  # Location varies by OS
  ```

#### 2. "Port already in use" Error

**Symptoms**: "EADDRINUSE: address already in use :::3000" or ":::3001"

**Solutions**:
- Find and kill the process using the port:
  ```bash
  # Windows
  netstat -ano | findstr :3000
  taskkill /PID <PID> /F

  # macOS/Linux
  lsof -ti:3000 | xargs kill -9
  ```

- Or change the port in configuration:
  ```bash
  # Backend: Edit backend/.env
  PORT=3002

  # Frontend: Edit frontend/vite.config.ts
  server: { port: 3001 }
  ```

#### 3. "Module not found" Errors

**Symptoms**: Import errors, missing module errors

**Solutions**:
- Reinstall dependencies:
  ```bash
  # Remove node_modules and package-lock.json
  rm -rf node_modules package-lock.json
  rm -rf frontend/node_modules frontend/package-lock.json
  rm -rf backend/node_modules backend/package-lock.json

  # Reinstall
  npm run install:all
  ```

- Verify Node.js version:
  ```bash
  node --version
  # Should be v18.0.0 or higher
  ```

#### 4. Frontend Shows White Screen

**Symptoms**: Browser shows blank page, no errors in terminal

**Solutions**:
- Check browser console (F12) for errors
- Verify API URL in `frontend/.env`:
  ```bash
  VITE_API_URL=http://localhost:3001/api
  ```
- Clear browser cache and reload (Ctrl+Shift+R or Cmd+Shift+R)
- Try a different browser

#### 5. Database Setup Fails

**Symptoms**: `npm run setup-db` fails with permission errors

**Solutions**:
- Run as PostgreSQL superuser:
  ```bash
  # Set POSTGRES_PASSWORD in backend/.env
  POSTGRES_PASSWORD=your_postgres_password
  ```

- Manually create database:
  ```sql
  psql -U postgres
  CREATE DATABASE shotspot_db;
  CREATE USER shotspot_user WITH PASSWORD 'your_password';
  GRANT ALL PRIVILEGES ON DATABASE shotspot_db TO shotspot_user;
  \q
  ```

- Run schema manually:
  ```bash
  psql -U shotspot_user -d shotspot_db -f backend/scripts/schema.sql
  ```

#### 6. CORS Errors in Browser

**Symptoms**: "Access-Control-Allow-Origin" errors in browser console

**Solutions**:
- Verify `CORS_ORIGIN` in `backend/.env`:
  ```bash
  CORS_ORIGIN=http://localhost:3000
  ```
- If accessing from network (e.g., 192.168.x.x), add that origin:
  ```bash
  CORS_ORIGIN=http://localhost:3000,http://192.168.1.100:3000
  ```

#### 7. Tests Failing

**Symptoms**: `npm test` shows failed tests

**Solutions**:
- Ensure test database is set up:
  ```bash
  cd backend
  npm run setup-test-db
  ```

- Check test database credentials in `backend/.env`
- Run tests with verbose output:
  ```bash
  npm test -- --verbose
  ```

---

## Offline Usage

For using the app in locations with poor internet connectivity:

### Preparation (With Internet)

1. **Complete full installation** following steps above
2. **Build production version**:
   ```bash
   cd frontend
   npm run build
   cd ..
   ```
3. **Test offline mode**:
   - Disconnect from internet
   - Start backend: `npm run start:backend`
   - Access at http://localhost:3001

### Offline Limitations

- ✅ **Works offline**: All core match tracking features
- ✅ **Works offline**: Viewing stored data
- ❌ **Requires internet**: Initial installation
- ❌ **Requires internet**: Software updates
- ❌ **Requires internet**: Syncing between devices

### Offline Best Practices

1. **Keep laptop charged**: Use battery saver mode during matches
2. **Test before match**: Verify everything works offline
3. **Backup data**: Regularly export match data
4. **Multiple devices**: Install on backup laptop if possible

---

## Network Access (Using on Multiple Devices)

To access from tablets/phones on the same network:

### 1. Find Your Laptop's IP Address

```bash
# Windows
ipconfig

# macOS/Linux
ifconfig | grep "inet "
```

Look for your local IP (usually 192.168.x.x or 10.x.x.x)

### 2. Update CORS Settings

Edit `backend/.env`:
```bash
CORS_ORIGIN=http://localhost:3000,http://192.168.1.100:3000
```
(Replace 192.168.1.100 with your actual IP)

### 3. Access from Other Devices

On your tablet/phone, open:
```
http://192.168.1.100:3000
```
(Replace with your laptop's IP address)

### Network Security Note

- Only use on trusted networks (home/club WiFi)
- Don't expose to public internet without proper security
- Consider VPN for remote access

---

## Performance Optimization

### For Slower Laptops

1. **Reduce database connections**:
   ```bash
   # In backend/.env
   DB_MAX_CONNECTIONS=10
   ```

2. **Disable logging in production**:
   ```bash
   # In backend/.env
   LOG_LEVEL=error
   ```

3. **Use production build**:
   ```bash
   cd frontend && npm run build
   ```

### For Multiple Concurrent Matches

1. **Increase connection pool**:
   ```bash
   DB_MAX_CONNECTIONS=50
   ```

2. **Monitor resource usage**:
   - Windows: Task Manager
   - macOS: Activity Monitor
   - Linux: `htop`

---

## Data Backup

### Manual Backup

```bash
# Backup database
pg_dump -U shotspot_user shotspot_db > backup_$(date +%Y%m%d).sql

# Restore database
psql -U shotspot_user shotspot_db < backup_20241019.sql
```

### Automated Backup

Create a backup script (backup.sh):
```bash
#!/bin/bash
BACKUP_DIR="$HOME/shotspot_backups"
mkdir -p "$BACKUP_DIR"
pg_dump -U shotspot_user shotspot_db > "$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
```

Run daily via cron (Linux/macOS) or Task Scheduler (Windows).

---

## Updating the Application

### Check for Updates

```bash
cd ShotSpot
git fetch origin
git status
```

### Install Updates

```bash
# Pull latest changes
git pull origin main

# Update dependencies
npm run install:all

# Update database schema if needed
npm run setup-db

# Restart application
npm run dev
```

---

## Uninstalling

### Remove Application

```bash
# Navigate to parent directory
cd ..

# Remove project folder
rm -rf ShotSpot
```

### Remove Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Drop database and user
DROP DATABASE shotspot_db;
DROP USER shotspot_user;
\q
```

### Remove Software (Optional)

- Uninstall Node.js via system settings
- Uninstall PostgreSQL via system settings
- Remove Git via system settings

---

## Getting Help

### Documentation

- **Main README**: [README.md](README.md)
- **Deployment Guide**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Security Guide**: [SECURITY.md](SECURITY.md)
- **Frontend Guide**: [frontend/README.md](frontend/README.md)

### Support

- **GitHub Issues**: https://github.com/pSecurIT/ShotSpot/issues
- **Email**: support@shotspot.example.com

### Reporting Bugs

When reporting issues, include:
1. Operating system and version
2. Node.js version (`node --version`)
3. PostgreSQL version (`psql --version`)
4. Error messages (full text)
5. Steps to reproduce the issue
6. Screenshots if applicable

---

## Appendix: Command Reference

### Installation Commands
```bash
npm run install:all        # Install all dependencies
npm run setup-db           # Set up database
```

### Running Commands
```bash
npm run dev                # Start development servers
npm run start              # Start production (after build)
npm run start:backend      # Start backend only
npm run start:frontend     # Start frontend only
```

### Testing Commands
```bash
npm test                   # Run backend tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage
cd frontend && npm test    # Run frontend tests
```

### Build Commands
```bash
cd frontend && npm run build    # Build frontend for production
cd frontend && npm run preview  # Preview production build
```

### Database Commands
```bash
npm run setup-db           # Set up database
npm run setup-test-db      # Set up test database
```

### Maintenance Commands
```bash
git pull origin main       # Update application
npm run install:all        # Update dependencies
npm run lint               # Check code quality
cd backend && npm run lint:fix  # Fix linting issues
```

---

**Installation complete! You're ready to use ShotSpot for field testing.** 🎉

For questions or issues, refer to the [Troubleshooting](#troubleshooting) section or contact support.
