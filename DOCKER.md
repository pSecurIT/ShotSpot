# 🐳 Docker Deployment Guide

This guide covers deploying ShotSpot using Docker and Docker Compose.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Production Deployment](#production-deployment)
- [Development with Docker](#development-with-docker)
- [Configuration](#configuration)
- [Advanced Topics](#advanced-topics)
- [Troubleshooting](#troubleshooting)
- [Security](#security)

---

## Prerequisites

### Required Software
- **Docker**: Version 20.10 or later
- **Docker Compose**: Version 2.0 or later

### Installation

#### Windows
1. Download and install [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
2. Docker Compose is included with Docker Desktop

#### macOS
1. Download and install [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
2. Docker Compose is included with Docker Desktop

#### Linux
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add your user to docker group (optional, avoids using sudo)
sudo usermod -aG docker $USER
```

Verify installation:
```bash
docker --version
docker-compose --version
```

---

## Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/pSecurIT/ShotSpot.git
cd ShotSpot
```

### 2. Configure Environment
```bash
# Copy the Docker environment template
cp .env.docker.example .env

# Edit .env and set secure values
# IMPORTANT: Change DB_PASSWORD and JWT_SECRET!
```

**Required Environment Variables:**
```env
DB_PASSWORD=your_secure_database_password
JWT_SECRET=your_secure_jwt_secret
CORS_ORIGIN=http://localhost:3000
```

### 3. Start the Application
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service health
docker-compose ps
```

### 4. Access the Application
- **Frontend**: http://localhost:3001 (served by backend)
- **API**: http://localhost:3001/api
- **Health Check**: http://localhost:3001/api/health
- **Database**: localhost:5432 (for external access)

### 5. Stop the Application
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes all data!)
docker-compose down -v
```

---

## Production Deployment

### Architecture Overview

The production deployment uses three services:
1. **PostgreSQL Database** (`db`) - Data persistence
2. **ShotSpot Application** (`app`) - Backend API + Frontend
3. **Nginx Reverse Proxy** (`nginx`) - Load balancing, SSL, caching (optional)

### Production Setup

#### 1. Prepare Environment

```bash
# Create production environment file
cp .env.docker.example .env.production

# Edit with production values
nano .env.production
```

**Production Environment Variables:**
```env
# Server
NODE_ENV=production
PORT=3001

# Database - USE STRONG PASSWORDS
DB_HOST=db
DB_PORT=5432
DB_NAME=shotspot_db
DB_USER=shotspot_user
DB_PASSWORD=CHANGE_THIS_TO_A_SECURE_PASSWORD

# Security - GENERATE SECURE SECRETS
# Generate with: openssl rand -base64 32
JWT_SECRET=CHANGE_THIS_TO_A_SECURE_RANDOM_STRING
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# CORS - Set to your domain
CORS_ORIGIN=https://shotspot.example.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=info
LOG_FORMAT=combined

# Optional: Error Notifications
ENABLE_ERROR_NOTIFICATIONS=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

#### 2. Generate Secure Secrets

```bash
# Generate JWT secret
openssl rand -base64 32

# Generate database password
openssl rand -base64 24
```

#### 3. Deploy Application

```bash
# Build images
docker-compose --env-file .env.production build

# Start services
docker-compose --env-file .env.production up -d

# Verify deployment
docker-compose --env-file .env.production ps
docker-compose --env-file .env.production logs -f app
```

#### 4. Set Up Nginx (Optional but Recommended)

The nginx service provides:
- SSL/TLS termination
- Reverse proxy
- Static file caching
- Rate limiting
- Security headers

**Enable Nginx:**
```bash
# Start with nginx profile
docker-compose --profile production up -d
```

**Configure SSL:**
```bash
# Create SSL directory
mkdir -p ssl

# Copy your SSL certificates
cp /path/to/cert.pem ssl/
cp /path/to/key.pem ssl/

# Update nginx.conf to enable HTTPS (uncomment lines 42-47)
```

#### 5. Database Backup

```bash
# Backup database
docker-compose exec db pg_dump -U shotspot_user shotspot_db > backup.sql

# Restore database
docker-compose exec -T db psql -U shotspot_user shotspot_db < backup.sql
```

#### 6. Monitoring

```bash
# View logs
docker-compose logs -f app
docker-compose logs -f db
docker-compose logs -f nginx

# Check resource usage
docker stats

# Health checks
curl http://localhost:3001/api/health
```

---

## Development with Docker

### Development Setup

Development mode provides:
- Hot reload for frontend and backend
- Separate frontend/backend containers
- Debug port access
- Volume mounts for live code updates

#### 1. Start Development Environment

```bash
# Copy development environment
cp .env.docker.example .env.dev

# Start development services
docker-compose -f docker-compose.dev.yml up

# Run in background
docker-compose -f docker-compose.dev.yml up -d
```

#### 2. Access Services

- **Frontend**: http://localhost:3000 (Vite dev server)
- **Backend**: http://localhost:3001 (Node.js with nodemon)
- **Database**: localhost:5432
- **Debugger**: localhost:9229 (Node.js inspector)

#### 3. Development Workflow

```bash
# View logs
docker-compose -f docker-compose.dev.yml logs -f frontend
docker-compose -f docker-compose.dev.yml logs -f backend

# Restart a service
docker-compose -f docker-compose.dev.yml restart backend

# Run commands in containers
docker-compose -f docker-compose.dev.yml exec backend npm test
docker-compose -f docker-compose.dev.yml exec frontend npm run lint

# Install new dependencies
docker-compose -f docker-compose.dev.yml exec backend npm install package-name
docker-compose -f docker-compose.dev.yml exec frontend npm install package-name

# Stop development environment
docker-compose -f docker-compose.dev.yml down
```

#### 4. Database Management

```bash
# Access PostgreSQL shell
docker-compose -f docker-compose.dev.yml exec db psql -U shotspot_user -d shotspot_db

# Run migrations
docker-compose -f docker-compose.dev.yml exec backend npm run migrate

# Seed database
docker-compose -f docker-compose.dev.yml exec backend npm run seed
```

---

## Configuration

### Environment Variables

#### Server Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `NODE_ENV` | `production` | Node environment (`development`, `production`, `test`) |

#### Database Configuration
| Variable | Required | Description |
|----------|----------|-------------|
| `DB_HOST` | Yes | Database hostname (`db` in Docker) |
| `DB_PORT` | No | Database port (default: `5432`) |
| `DB_NAME` | Yes | Database name |
| `DB_USER` | Yes | Database user |
| `DB_PASSWORD` | Yes | Database password |
| `DB_MAX_CONNECTIONS` | No | Connection pool size (default: `20`) |
| `DB_IDLE_TIMEOUT_MS` | No | Idle connection timeout (default: `30000`) |

#### Security Configuration
| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `JWT_EXPIRES_IN` | No | Access token expiration (default: `1h`) |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh token expiration (default: `7d`) |
| `CORS_ORIGIN` | Yes | Allowed CORS origins (comma-separated) |

#### Rate Limiting
| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 minutes) |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |

#### Logging
| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Logging level (`error`, `warn`, `info`, `debug`) |
| `LOG_FORMAT` | `combined` | Log format (`combined`, `common`, `dev`) |

### Docker Compose Profiles

| Profile | Services | Use Case |
|---------|----------|----------|
| Default | `db`, `app` | Basic deployment without nginx |
| `production` | `db`, `app`, `nginx` | Full production with reverse proxy |

```bash
# Use specific profile
docker-compose --profile production up -d
```

### Volume Management

#### Persistent Volumes
- `postgres_data`: Database data (survives container restarts)
- `nginx_cache`: Nginx cache (optional, can be removed)

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect shotspot_postgres_data

# Backup volume
docker run --rm -v shotspot_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz /data

# Restore volume
docker run --rm -v shotspot_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres_backup.tar.gz -C /
```

---

## Advanced Topics

### Multi-Stage Build Optimization

The Dockerfile uses a multi-stage build:

1. **frontend-builder**: Builds React app with Vite
2. **backend-builder**: Prepares backend dependencies
3. **production**: Minimal runtime image

Benefits:
- Smaller final image (~200MB vs ~1GB)
- Faster deployments
- Better security (fewer attack surfaces)

### Health Checks

All services include health checks:

```yaml
# Application health check
healthcheck:
  test: ["CMD-SHELL", "wget -q --spider http://localhost:3001/api/health || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

Check health status:
```bash
docker-compose ps
docker inspect --format='{{.State.Health.Status}}' shotspot-app
```

### Scaling

```bash
# Scale application instances (requires load balancer)
docker-compose up -d --scale app=3

# Note: Database cannot be scaled without clustering
```

### Custom Network Configuration

```bash
# Use custom network
docker network create shotspot-custom
docker-compose --env-file .env.production up -d
```

### SSL/TLS Configuration

For production with SSL:

1. Obtain SSL certificates (Let's Encrypt, purchased, etc.)
2. Place certificates in `ssl/` directory:
   ```
   ssl/
   ├── cert.pem
   └── key.pem
   ```
3. Edit `nginx.conf` and uncomment HTTPS section (lines 42-47)
4. Restart nginx:
   ```bash
   docker-compose restart nginx
   ```

### Environment-Specific Builds

```bash
# Build for specific environment
docker-compose --env-file .env.staging build
docker-compose --env-file .env.staging up -d
```

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed

**Symptom**: `Failed to connect to database`

**Solutions**:
```bash
# Check if database is healthy
docker-compose ps

# View database logs
docker-compose logs db

# Verify environment variables
docker-compose exec app env | grep DB_

# Test database connection
docker-compose exec db psql -U shotspot_user -d shotspot_db -c "SELECT 1;"
```

#### 2. Port Already in Use

**Symptom**: `Bind for 0.0.0.0:3001 failed: port is already allocated`

**Solutions**:
```bash
# Find process using port
# Windows
netstat -ano | findstr :3001

# Linux/Mac
lsof -i :3001

# Change port in .env
PORT=3002
```

#### 3. Frontend Not Loading

**Symptom**: Blank page or 404 errors

**Solutions**:
```bash
# Check if frontend was built
docker-compose exec app ls -la /app/frontend/dist

# Rebuild application
docker-compose build --no-cache app
docker-compose up -d app

# Check logs
docker-compose logs app
```

#### 4. High Memory Usage

**Solutions**:
```bash
# Check resource usage
docker stats

# Limit memory in docker-compose.yml
services:
  app:
    mem_limit: 512m
    mem_reservation: 256m
```

#### 5. Database Data Lost

**Prevention**:
```bash
# Always use named volumes
# Never use docker-compose down -v in production

# Regular backups
0 2 * * * docker-compose exec db pg_dump -U shotspot_user shotspot_db > /backups/shotspot_$(date +\%Y\%m\%d).sql
```

### Debug Mode

```bash
# Run with verbose output
docker-compose --verbose up

# Interactive container shell
docker-compose exec app sh

# Check container filesystem
docker-compose exec app ls -la /app
docker-compose exec app cat /app/backend/.env
```

### Logs Analysis

```bash
# Follow all logs
docker-compose logs -f

# Filter by service
docker-compose logs -f app

# Last 100 lines
docker-compose logs --tail=100 app

# Since timestamp
docker-compose logs --since 2024-01-01T00:00:00 app
```

### Performance Tuning

#### Database
```env
# Increase connection pool
DB_MAX_CONNECTIONS=50

# Adjust timeout
DB_IDLE_TIMEOUT_MS=60000
```

#### Application
```env
# Increase rate limits
RATE_LIMIT_MAX=500

# Adjust cache headers in nginx.conf
expires 1y;
```

### Clean Up

```bash
# Remove stopped containers
docker-compose down

# Remove all containers and networks
docker-compose down --remove-orphans

# Remove volumes (WARNING: data loss!)
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Full cleanup
docker system prune -a --volumes
```

---

## Security Best Practices

### 1. Use Strong Secrets
```bash
# Generate secure secrets
openssl rand -base64 32
```

### 2. Regular Updates
```bash
# Update base images
docker-compose pull
docker-compose build --no-cache
docker-compose up -d
```

### 3. Scan for Vulnerabilities
```bash
# Scan images
docker scan shotspot-app
```

### 4. Network Isolation
```bash
# Use internal networks for database
networks:
  db-network:
    internal: true
```

### 5. Run as Non-Root
The Dockerfile already uses a non-root user (`nodejs:1001`)

### 6. Limit Resources
```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
```

---

## Security

### 🔒 Security Features

ShotSpot Docker deployment includes enterprise-grade security:

1. **Specific Version Pinning** - Prevents supply chain attacks
2. **Non-Root User** - Containers run as UID 1001 (nodejs)
3. **Read-Only Filesystem** - Immutable root filesystem
4. **Dropped Capabilities** - Minimal Linux capabilities
5. **No New Privileges** - Prevents privilege escalation
6. **Resource Limits** - DoS prevention
7. **Network Isolation** - Database not exposed to host
8. **Secret Validation** - Required secrets enforced at startup

### Security Best Practices

```bash
# Generate strong secrets
openssl rand -base64 32 > .env.jwt
openssl rand -base64 24 > .env.db

# Set restrictive permissions
chmod 600 .env

# Scan for vulnerabilities
docker scan shotspot-app

# Regular updates
docker-compose pull
docker-compose build --no-cache
```

### Comprehensive Security Guide

For detailed security information, see: **[DOCKER_SECURITY.md](./DOCKER_SECURITY.md)**

Topics covered:
- Security features explained
- Secret generation and rotation
- SSL/TLS configuration
- Vulnerability scanning
- Incident response procedures
- Security checklist

---

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [PostgreSQL Docker Hub](https://hub.docker.com/_/postgres)
- [Nginx Docker Hub](https://hub.docker.com/_/nginx)
- [ShotSpot Repository](https://github.com/pSecurIT/ShotSpot)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)

---

## Support

For issues or questions:
1. Check this documentation
2. Review [DEPLOYMENT.md](./DEPLOYMENT.md)
3. Security concerns: [DOCKER_SECURITY.md](./DOCKER_SECURITY.md)
4. Open an issue on [GitHub](https://github.com/pSecurIT/ShotSpot/issues)
5. Security vulnerabilities: security@shotspot.example.com (private disclosure)

---

**Last Updated**: January 2025
