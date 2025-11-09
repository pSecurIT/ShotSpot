# ShotSpot Quick Start Guide

**Get up and running in 2-5 minutes!**

---

## 🐳 Docker Quick Start (Recommended - 2 minutes)

**Easiest way!** Just Docker and go:

```bash
# 1. Clone
git clone https://github.com/pSecurIT/ShotSpot.git
cd ShotSpot

# 2. Configure
cp .env.docker.example .env
# Edit .env: Set DB_PASSWORD and JWT_SECRET

# 3. Start!
docker-compose up -d
```

Open http://localhost:3001 in your browser 🎉

**Full Docker guide**: [DOCKER.md](DOCKER.md)

---

## ⚡ Manual Installation (5 minutes)

Without Docker? No problem:

```bash
# 1. Clone
git clone https://github.com/pSecurIT/ShotSpot.git
cd ShotSpot

# 2. Install
npm run install:all

# 3. Configure (edit backend/.env with your PostgreSQL password)
cp backend/.env.example backend/.env

# 4. Setup Database
npm run setup-db

# 5. Run!
npm run dev
```

Open http://localhost:3000 in your browser 🎉

---

## 📋 Checklist

**For Docker installation:**
- [ ] Docker 20.10+ installed (`docker --version`)
- [ ] Docker Compose 2.0+ installed (`docker-compose --version`)
- [ ] Port 3001 and 5432 available

**For manual installation:**
- [ ] Node.js 22.12+ installed (`node --version`)
- [ ] PostgreSQL 14+ installed and running
- [ ] PostgreSQL password ready
- [ ] Port 3000 and 3001 available

---

## 🎯 First Time Setup

### 1. Install Prerequisites

**Node.js**:
- Download: https://nodejs.org/
- Install LTS version (22.12 or higher)
- Verify: `node --version`

**PostgreSQL**:
- Download: https://www.postgresql.org/download/
- Install with default settings
- Remember the postgres superuser password!
- Verify: `psql --version`

### 2. Configure Environment

Edit `backend/.env` (created from `.env.example`):

```bash
# Change these two passwords:
DB_PASSWORD=your_secure_password_here
POSTGRES_PASSWORD=your_postgres_superuser_password

# Generate a random 32+ character string for JWT_SECRET:
JWT_SECRET=generate_random_32_characters_here
```

**Generate secure JWT secret**:
```bash
# macOS/Linux:
openssl rand -base64 32

# Windows (PowerShell):
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### 3. Verify Installation

Check that everything works:
```bash
# Should see no errors
cd backend && npm test && cd ..
cd frontend && npm test && cd ..
```

---

## 🖥️ Usage

### Daily Use

Start both servers:
```bash
npm run dev
```

Stop servers: Press `Ctrl+C` in the terminal

### Access URLs

- **Main App**: http://localhost:3000
- **API**: http://localhost:3001/api
- **From Phone/Tablet**: http://[your-laptop-ip]:3000

Find your laptop IP:
```bash
# Windows: ipconfig
# macOS/Linux: ifconfig
```

---

## 🔥 Common Commands

```bash
# Development (auto-reload on changes)
npm run dev

# Production build
cd frontend && npm run build && cd ..
cd backend && npm start

# Run tests
npm test                    # Backend tests
cd frontend && npm test     # Frontend tests

# Database
npm run setup-db           # Reset/setup database
```

---

## 🆘 Troubleshooting

### "Cannot connect to database"
1. Check PostgreSQL is running
2. Verify passwords in `backend/.env`
3. Try: `psql -U postgres` to test connection

### "Port already in use"
1. Kill process on port 3000/3001
2. Or change ports in `backend/.env` and `frontend/vite.config.ts`

### "Module not found"
1. Delete `node_modules` folders
2. Run `npm run install:all` again

### White screen in browser
1. Check browser console (F12) for errors
2. Verify `VITE_API_URL` in `frontend/.env`
3. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

---

## 📖 Full Documentation

- **Complete Guide**: [INSTALLATION.md](INSTALLATION.md)
- **Deployment**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Security**: [SECURITY.md](SECURITY.md)

---

## ✅ Testing Your Installation

1. **Create a team**: Team Management → Add New Team
2. **Add players**: Select team → Add players
3. **Create a game**: Game Management → Create Game
4. **Start match**: Click "Prepare Match" → Set rosters → Start

If all steps work, you're good to go! 🎊

---

**Need Help?** 
- Check [INSTALLATION.md](INSTALLATION.md) for detailed troubleshooting
- Open an issue on GitHub
- Email: support@shotspot.example.com
