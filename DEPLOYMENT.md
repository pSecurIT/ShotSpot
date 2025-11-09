# Deployment Guide

This guide covers deployment strategies for ShotSpot, from local field testing to production environments.

---

## Table of Contents

> **🐳 For Docker deployments, see [DOCKER.md](DOCKER.md)**

1. [Deployment Scenarios](#deployment-scenarios)
2. [Field Testing Deployment](#field-testing-deployment)
3. [Production Deployment](#production-deployment)
4. [Environment Configuration](#environment-configuration)
5. [Database Management](#database-management)
6. [Security Checklist](#security-checklist)
7. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Deployment Scenarios

### Scenario 1: Field Testing (Laptop)

**Use case**: Coach using app during matches on their laptop

**Requirements**:
- Laptop with Node.js and PostgreSQL
- No internet required after installation
- Access from tablets via local network

**Setup**: See [INSTALLATION.md](INSTALLATION.md) for complete guide

**Quick start**:
```bash
npm run install:all
npm run setup-db
npm run dev
```

### Scenario 2: Club Server

**Use case**: Multiple coaches accessing shared server

**Requirements**:
- Server/desktop always running
- Local network access
- Shared database for all matches

**Setup**: Same as field testing, but configure network access

### Scenario 3: Cloud Production

**Use case**: Federation-wide deployment, public access

**Requirements**:
- Cloud hosting (AWS, Azure, DigitalOcean)
- SSL/TLS certificates
- Domain name
- Production database (managed PostgreSQL)
- CDN for static assets

---

## Field Testing Deployment

### Initial Setup (One-time)

**On your laptop**:

1. **Install prerequisites**:
   - Node.js 22.12+: https://nodejs.org/
   - PostgreSQL 14+: https://www.postgresql.org/
   - Git: https://git-scm.com/

2. **Clone and install**:
   ```bash
   git clone https://github.com/pSecurIT/ShotSpot.git
   cd ShotSpot
   npm run install:all
   ```

3. **Configure environment**:
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your passwords and secrets
   ```

4. **Setup database**:
   ```bash
   npm run setup-db
   ```

5. **Test installation**:
   ```bash
   npm run dev
   # Open http://localhost:3000
   # Create test team, players, and game
   ```

### Pre-Match Checklist

Before heading to the field:

- [ ] Laptop fully charged
- [ ] PostgreSQL service running
- [ ] Application tested and working
- [ ] Backup power source available
- [ ] Teams and players already entered
- [ ] Test offline mode (disconnect internet)

### Starting Before Match

1. **Connect to power** (if available)

2. **Start application**:
   ```bash
   cd ShotSpot
   npm run dev
   ```

3. **Wait for startup**:
   ```
   [backend] Server running on port 3001
   [backend] ✓ Database connection established
   [frontend] ➜ Local: http://localhost:3000/
   ```

4. **Open in browser**: http://localhost:3000

### Network Access (For Tablets/Assistants)

1. **Find your laptop's IP**:
   ```bash
   # Windows
   ipconfig

   # macOS
   ifconfig | grep "inet "

   # Linux
   ip addr show
   ```
   Look for `192.168.x.x` or `10.x.x.x`

2. **Update CORS** in `backend/.env`:
   ```bash
   CORS_ORIGIN=http://localhost:3000,http://192.168.1.100:3000
   ```
   (Replace with your IP)

3. **Restart backend**:
   ```bash
   # Stop with Ctrl+C, then:
   npm run dev
   ```

4. **Access from tablet**: http://192.168.1.100:3000

### Post-Match

1. **Export match data** (backup):
   - Use export feature in app
   - Or backup database manually:
   ```bash
   pg_dump -U shotspot_user shotspot_db > match_backup_$(date +%Y%m%d).sql
   ```

2. **Stop application**: Press `Ctrl+C` in terminal

3. **Optional: Shut down PostgreSQL**:
   ```bash
   # Windows
   net stop postgresql-x64-14

   # macOS
   brew services stop postgresql

   # Linux
   sudo systemctl stop postgresql
   ```

---

## Production Deployment

### Architecture

```
Internet → Load Balancer → Web Server(s) → Application Server(s) → Database
                ↓
              CDN (Static Assets)
```

### Prerequisites

1. **Cloud Provider Account** (AWS, Azure, DigitalOcean, etc.)
2. **Domain Name** (e.g., shotspot.yourclub.com)
3. **SSL Certificate** (Let's Encrypt or commercial)
4. **Managed PostgreSQL** (or self-hosted with backups)
5. **CI/CD Pipeline** (GitHub Actions, GitLab CI, etc.)

### Production Build

1. **Build frontend**:
   ```bash
   cd frontend
   npm run build
   ```
   Outputs to `frontend/dist/`

2. **Configure backend to serve frontend**:
   ```javascript
   // backend/src/app.js
   import express from 'express';
   import path from 'path';
   
   const app = express();
   
   // Serve static frontend files
   app.use(express.static(path.join(__dirname, '../../frontend/dist')));
   
   // API routes
   app.use('/api', apiRouter);
   
   // Fallback to index.html for client-side routing
   app.get('*', (req, res) => {
     res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
   });
   ```

3. **Start production server**:
   ```bash
   cd backend
   NODE_ENV=production npm start
   ```

### Environment Variables (Production)

Use a secrets manager (AWS Secrets Manager, HashiCorp Vault) instead of `.env` files:

```bash
# Database
DB_HOST=prod-db.region.rds.amazonaws.com
DB_PORT=5432
DB_NAME=shotspot_prod
DB_USER=shotspot_prod_user
DB_PASSWORD=<from-secrets-manager>
DB_SSL=true

# Security
JWT_SECRET=<secure-random-64-chars>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
SESSION_SECRET=<secure-random-64-chars>

# API
CORS_ORIGIN=https://shotspot.yourclub.com
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000

# Server
NODE_ENV=production
PORT=3001

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/shotspot/app.log
```

### Deployment Steps

1. **Provision infrastructure**:
   - Application server(s)
   - Managed PostgreSQL
   - Load balancer
   - CDN

2. **Deploy database**:
   ```bash
   psql -h prod-db.region.rds.amazonaws.com \
        -U postgres \
        -f backend/scripts/schema.sql \
        shotspot_prod
   ```

3. **Deploy application**:
   ```bash
   # Clone repository
   git clone https://github.com/pSecurIT/ShotSpot.git
   cd ShotSpot
   
   # Install dependencies
   npm run install:all
   
   # Build frontend
   cd frontend && npm run build && cd ..
   
   # Set environment variables (from secrets manager)
   export DB_HOST=...
   export DB_PASSWORD=...
   # ... etc
   
   # Start with process manager (PM2)
   cd backend
   pm2 start src/index.js --name shotspot-backend
   pm2 save
   pm2 startup
   ```

4. **Configure reverse proxy** (Nginx example):
   ```nginx
   server {
       listen 80;
       server_name shotspot.yourclub.com;
       return 301 https://$server_name$request_uri;
   }
   
   server {
       listen 443 ssl http2;
       server_name shotspot.yourclub.com;
       
       ssl_certificate /etc/letsencrypt/live/shotspot.yourclub.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/shotspot.yourclub.com/privkey.pem;
       
       location /api {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
       
       location / {
           root /var/www/shotspot/frontend/dist;
           try_files $uri $uri/ /index.html;
       }
   }
   ```

5. **Setup SSL**:
   ```bash
   # Using Let's Encrypt
   certbot --nginx -d shotspot.yourclub.com
   ```

6. **Configure firewall**:
   ```bash
   # Allow HTTP/HTTPS
   ufw allow 80/tcp
   ufw allow 443/tcp
   
   # Block direct access to app port
   ufw deny 3001/tcp
   ```

---

## Environment Configuration

---

## Environment Configuration

### Development Environment

**File**: `backend/.env`

```bash
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=shotspot_db
DB_USER=shotspot_user
DB_PASSWORD=dev_password_123
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

JWT_SECRET=dev_jwt_secret_min_32_chars
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_MAX=1000
LOG_LEVEL=debug
```

### Field Testing Environment

**File**: `backend/.env`

```bash
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=shotspot_db
DB_USER=shotspot_user
DB_PASSWORD=secure_laptop_password
POSTGRES_PASSWORD=postgres_password

JWT_SECRET=<generated-secure-random-string>
JWT_EXPIRES_IN=8h  # Longer for match days
JWT_REFRESH_EXPIRES_IN=30d

CORS_ORIGIN=http://localhost:3000,http://192.168.1.100:3000
RATE_LIMIT_MAX=500
LOG_LEVEL=info
```

### Production Environment

**Never use `.env` files in production!**

Use environment variables set by:
- Cloud provider (AWS, Azure, DigitalOcean)
- Secret management service
- Container orchestration (Kubernetes secrets)
- CI/CD pipeline

```bash
# Example: AWS Elastic Beanstalk
eb setenv DB_HOST=prod-db.region.rds.amazonaws.com \
         DB_PASSWORD=$(aws secretsmanager get-secret-value ...) \
         JWT_SECRET=$(aws secretsmanager get-secret-value ...)
```

---

## Database Management

### Development Database

```bash
# Setup
npm run setup-db

# Reset
dropdb -U postgres shotspot_db
npm run setup-db

# Backup
pg_dump -U shotspot_user shotspot_db > backup.sql

# Restore
psql -U shotspot_user shotspot_db < backup.sql
```

### Production Database

**Best Practices**:

1. **Use Managed Database** (AWS RDS, Azure Database, etc.)
2. **Enable automated backups** (daily minimum)
3. **Enable point-in-time recovery**
4. **Set up replication** for high availability
5. **Use connection pooling** (PgBouncer)
6. **Monitor performance** (slow queries, connections)

**Backup Strategy**:
```bash
# Daily automated backup
0 2 * * * pg_dump -h prod-db.region.rds.amazonaws.com \
                   -U shotspot_user \
                   shotspot_prod \
                   | gzip > /backups/shotspot_$(date +\%Y\%m\%d).sql.gz

# Keep last 30 days
find /backups -name "shotspot_*.sql.gz" -mtime +30 -delete
```

**Migration Process**:
```bash
# 1. Backup current database
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME > pre_migration_backup.sql

# 2. Test migration on copy
createdb shotspot_test
psql -U $DB_USER shotspot_test < pre_migration_backup.sql
psql -U $DB_USER shotspot_test < migrations/new_migration.sql

# 3. Apply to production (during maintenance window)
psql -h $DB_HOST -U $DB_USER $DB_NAME < migrations/new_migration.sql
```

---

## Security Checklist

### Pre-Deployment Security Audit

- [ ] **Secrets**: All secrets are stored securely (not in code)
- [ ] **Database**: Strong passwords, SSL enabled
- [ ] **JWT**: Secure secret (min 32 chars), short expiry
- [ ] **CORS**: Strict origin whitelist
- [ ] **Rate Limiting**: Enabled and configured appropriately
- [ ] **HTTPS**: SSL/TLS certificates installed and valid
- [ ] **Headers**: Security headers configured (HSTS, CSP, etc.)
- [ ] **Dependencies**: No known vulnerabilities (`npm audit`)
- [ ] **Logging**: Sensitive data not logged
- [ ] **Error Messages**: No stack traces in production
- [ ] **Firewall**: Only necessary ports open
- [ ] **Backups**: Automated and tested
- [ ] **Monitoring**: Alerts configured

### Production Security Configuration

**backend/.env (or environment variables)**:
```bash
# Enable security features
NODE_ENV=production

# Strict CORS
CORS_ORIGIN=https://shotspot.yourclub.com

# Rate limiting (stricter)
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000

# Shorter JWT expiry
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Production logging
LOG_LEVEL=warn
LOG_FILE=/var/log/shotspot/app.log

# Database SSL
DB_SSL=true

# Security headers
HSTS_ENABLED=true
HSTS_MAX_AGE=31536000
CSP_ENABLED=true
```

**Nginx Security Headers**:
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

---

## Monitoring & Maintenance

### Health Checks

**Application Health Endpoint**:
```javascript
// backend/src/routes/health.js
router.get('/health', async (req, res) => {
  const dbHealthy = await checkDatabaseConnection();
  const status = dbHealthy ? 'healthy' : 'unhealthy';
  const statusCode = dbHealthy ? 200 : 503;
  
  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION || '1.0.0',
    database: dbHealthy ? 'connected' : 'disconnected'
  });
});
```

**Monitor**:
```bash
# Check health every minute
* * * * * curl -f https://shotspot.yourclub.com/api/health || alert_team
```

### Logging

**Production Logging Setup**:

1. **Application Logs**:
   ```bash
   # Using PM2
   pm2 logs shotspot-backend
   
   # Log files
   tail -f /var/log/shotspot/app.log
   tail -f /var/log/shotspot/error.log
   ```

2. **Centralized Logging** (Optional):
   - Use services like CloudWatch, Datadog, or ELK stack
   - Aggregate logs from all servers
   - Set up alerts for errors

3. **Log Rotation**:
   ```bash
   # /etc/logrotate.d/shotspot
   /var/log/shotspot/*.log {
       daily
       rotate 14
       compress
       delaycompress
       notifempty
       missingok
       create 0644 shotspot shotspot
   }
   ```

### Performance Monitoring

**Metrics to Track**:
- Response times (p50, p95, p99)
- Database query times
- Memory usage
- CPU usage
- Active connections
- Error rates
- User sessions

**Tools**:
- **PM2 Monitoring**: `pm2 monit`
- **Database**: `pg_stat_statements`
- **APM**: New Relic, Datadog APM
- **Custom Metrics**: Prometheus + Grafana

### Maintenance Tasks

**Daily**:
- [ ] Check error logs
- [ ] Verify backups completed
- [ ] Check disk space

**Weekly**:
- [ ] Review performance metrics
- [ ] Check for security updates
- [ ] Test backup restoration

**Monthly**:
- [ ] Update dependencies (`npm update`)
- [ ] Review access logs for anomalies
- [ ] Rotate secrets (if policy requires)
- [ ] Database maintenance (VACUUM, ANALYZE)

**Quarterly**:
- [ ] Security audit
- [ ] Disaster recovery test
- [ ] Performance optimization review
- [ ] Update SSL certificates (if needed)

### Updates and Rollback

**Update Process**:
```bash
# 1. Backup
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME > pre_update_backup.sql

# 2. Pull changes
git pull origin main

# 3. Update dependencies
npm run install:all

# 4. Build
cd frontend && npm run build && cd ..

# 5. Restart (PM2)
pm2 restart shotspot-backend

# 6. Verify
curl https://shotspot.yourclub.com/api/health
```

**Rollback Process**:
```bash
# 1. Stop application
pm2 stop shotspot-backend

# 2. Revert code
git reset --hard <previous-commit-hash>

# 3. Restore dependencies
npm run install:all

# 4. Rebuild
cd frontend && npm run build && cd ..

# 5. Restore database (if schema changed)
psql -h $DB_HOST -U $DB_USER $DB_NAME < pre_update_backup.sql

# 6. Restart
pm2 start shotspot-backend
```

---

## Disaster Recovery

### Backup Strategy

**What to Backup**:
1. Database (most critical)
2. Application code (Git repository)
3. Environment configuration
4. SSL certificates
5. User-uploaded files (if any)

**Backup Schedule**:
- **Database**: Daily full backup, hourly incremental
- **Files**: Daily
- **Configuration**: After each change

**Backup Storage**:
- Keep multiple copies (3-2-1 rule)
- Store off-site (different region/provider)
- Encrypt backups
- Test restoration monthly

### Recovery Procedures

**Database Corruption**:
```bash
# 1. Stop application
pm2 stop shotspot-backend

# 2. Restore from latest backup
psql -h $DB_HOST -U $DB_USER $DB_NAME < latest_backup.sql

# 3. Verify data integrity
psql -h $DB_HOST -U $DB_USER $DB_NAME -c "SELECT COUNT(*) FROM games;"

# 4. Restart application
pm2 start shotspot-backend
```

**Server Failure**:
```bash
# 1. Provision new server
# 2. Install dependencies
# 3. Clone repository
# 4. Restore database
# 5. Configure environment
# 6. Update DNS (if needed)
# 7. Start application
```

**Recovery Time Objectives (RTO)**:
- Field Testing: 15 minutes (backup laptop)
- Production: 1 hour (full recovery)

**Recovery Point Objectives (RPO)**:
- Field Testing: 0 (no data loss acceptable)
- Production: 1 hour (hourly backups)

---

## Deployment Automation

### Using PM2

**Install**:
```bash
npm install -g pm2
```

**Configuration** (`ecosystem.config.js`):
```javascript
module.exports = {
  apps: [{
    name: 'shotspot-backend',
    script: 'src/index.js',
    cwd: './backend',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/shotspot/error.log',
    out_file: '/var/log/shotspot/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

**Commands**:
```bash
pm2 start ecosystem.config.js
pm2 stop shotspot-backend
pm2 restart shotspot-backend
pm2 logs shotspot-backend
pm2 monit
pm2 save
pm2 startup  # Generate startup script
```

### Using Docker

**Dockerfile** (backend):
```dockerfile
FROM node:22.12-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["node", "src/index.js"]
```

**Docker Compose**:
```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - DB_HOST=db
      - DB_USER=shotspot_user
      - DB_PASSWORD=${DB_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - db
  
  db:
    image: postgres:14-alpine
    environment:
      - POSTGRES_USER=shotspot_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=shotspot_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./frontend/dist:/usr/share/nginx/html
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend

volumes:
  postgres_data:
```

---

## Troubleshooting Deployments

### Common Issues

**1. Database Connection Fails**
```bash
# Check database is accessible
psql -h $DB_HOST -U $DB_USER $DB_NAME

# Check firewall rules
telnet $DB_HOST $DB_PORT

# Verify credentials in environment
echo $DB_PASSWORD | wc -c  # Should not be empty
```

**2. CORS Errors**
```bash
# Check CORS_ORIGIN setting
echo $CORS_ORIGIN

# Verify it matches frontend URL exactly
# Including protocol (http/https) and port
```

**3. SSL Certificate Issues**
```bash
# Check certificate validity
openssl s_client -connect shotspot.yourclub.com:443

# Renew Let's Encrypt
certbot renew

# Check nginx configuration
nginx -t
```

**4. Out of Memory**
```bash
# Check memory usage
free -h

# Increase Node.js memory limit
node --max-old-space-size=2048 src/index.js

# Or in PM2
pm2 start src/index.js --node-args="--max-old-space-size=2048"
```

**5. Database Locks**
```sql
-- Find blocking queries
SELECT * FROM pg_stat_activity WHERE state = 'active';

-- Kill blocking query
SELECT pg_terminate_backend(pid) WHERE pid = <blocking_pid>;
```

---

## Support and Escalation

### Deployment Support

**Documentation**:
- [INSTALLATION.md](INSTALLATION.md) - Full installation guide
- [QUICKSTART.md](QUICKSTART.md) - Quick start guide
- [SECURITY.md](SECURITY.md) - Security guidelines

**Contact**:
- Email: support@shotspot.example.com
- GitHub Issues: https://github.com/pSecurIT/ShotSpot/issues

**Emergency Contacts**:
- Database Issues: DBA team
- Infrastructure: DevOps team
- Security Incidents: Security team

---

## Checklist for Going Live

### Pre-Launch

- [ ] All security measures implemented
- [ ] SSL/TLS certificates installed
- [ ] Database backups configured and tested
- [ ] Monitoring and alerting set up
- [ ] Load testing completed
- [ ] Disaster recovery plan documented
- [ ] Team trained on deployment procedures
- [ ] Rollback procedure tested

### Launch Day

- [ ] Announce maintenance window
- [ ] Backup current production data
- [ ] Deploy new version
- [ ] Run smoke tests
- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Verify all features working
- [ ] Announce successful deployment

### Post-Launch

- [ ] Monitor application for 24 hours
- [ ] Review logs for any issues
- [ ] Verify backup completed successfully
- [ ] Document any issues encountered
- [ ] Schedule post-mortem if needed

---

**For field testing deployment, see [INSTALLATION.md](INSTALLATION.md) for complete guide.**