# ShotSpot Docker Release

This directory contains files for deploying ShotSpot using the pre-built Docker image from GitHub Container Registry.

## 📦 Files

- **`docker-compose.yml`** - Docker Compose configuration for local testing and deployment
- **`deployment.sh`** - Automated deployment script with backup and update features

## 🚀 Quick Start

### 1. Pull and Run

```bash
# Pull the latest image
docker pull ghcr.io/psecurit/shotspot:latest

# Use deployment script (recommended)
./deployment.sh deploy

# Or manually with docker-compose
docker-compose up -d
```

### 2. Access Application

- **Application**: http://localhost:3001
- **API**: http://localhost:3001/api
- **Health Check**: http://localhost:3001/api/health

## 🔧 Configuration

Create a `.env` file in this directory with your configuration:

```env
# Database
POSTGRES_USER=shotspot_user
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=shotspot_db

# Application
PORT=3001
NODE_ENV=production
DB_HOST=db
DB_PORT=5432
DB_NAME=shotspot_db
DB_USER=shotspot_user
DB_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret_min_32_chars
CORS_ORIGIN=http://localhost:3001
```

## 📜 Deployment Script Usage

The `deployment.sh` script provides convenient commands for managing your deployment:

```bash
# Deploy (pull image, start, and wait for health)
./deployment.sh deploy

# Deploy specific version
./deployment.sh deploy v1.2.3

# Update to latest version (with backup)
./deployment.sh update

# Backup database
./deployment.sh backup

# Start containers (without pulling)
./deployment.sh start

# Stop containers
./deployment.sh stop

# Restart containers
./deployment.sh restart

# View status
./deployment.sh status

# Follow logs
./deployment.sh logs
```

## 🔄 Updating

To update to a new version:

```bash
# Automatic update with backup
./deployment.sh update

# Or manually
docker-compose down
docker pull ghcr.io/psecurit/shotspot:latest
docker-compose up -d
```

## 💾 Database Backups

### Automatic Backup

```bash
./deployment.sh backup
```

Backups are saved to `./backups/shotspot_YYYYMMDD_HHMMSS.sql`

### Manual Backup

```bash
docker-compose exec db pg_dump -U shotspot_user shotspot_db > backup.sql
```

### Restore Backup

```bash
docker-compose exec -T db psql -U shotspot_user shotspot_db < backup.sql
```

## 🐛 Troubleshooting

### Check Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f db
```

### Check Status

```bash
docker-compose ps
```

### Reset Everything

```bash
docker-compose down -v
rm -rf backups/*
# Edit .env with new configuration
docker-compose up -d
```

## 📋 Available Image Tags

- `latest` - Latest stable release
- `v1.2.3` - Specific version
- `v1.2` - Minor version
- `v1` - Major version
- `sha-abc123` - Specific commit

Pull specific version:
```bash
docker pull ghcr.io/psecurit/shotspot:v1.2.3
```

## 🔒 Security Notes

1. **Never use default passwords** in production
2. **Set file permissions**: `chmod 600 .env`
3. **Regular backups**: Schedule daily backups
4. **Update regularly**: Check for new versions weekly
5. **Monitor logs**: Watch for security events

## 📖 Documentation

- [Full Docker Guide](../DOCKER.md)
- [Security Guide](../DOCKER_SECURITY.md)
- [Deployment Guide](../DEPLOYMENT.md)
- [Main README](../README.md)

## 🆘 Support

- GitHub Issues: https://github.com/pSecurIT/ShotSpot/issues
- Security: security@shotspot.example.com (private disclosure)

---

**For building your own image from source, see the main [DOCKER.md](../DOCKER.md) guide.**
