# 🚀 Docker Deployment Cheat Sheet

Quick reference for common Docker deployment tasks.

## 📦 Pull & Run

```bash
# Pull latest image
docker pull ghcr.io/psecurit/shotspot:latest

# Run standalone (without database)
docker run -d \
  -p 3001:3001 \
  -e DB_HOST=your-db-host \
  -e DB_PASSWORD=your-password \
  -e JWT_SECRET=your-secret \
  ghcr.io/psecurit/shotspot:latest

# Run with docker-compose (recommended)
cd release
./deployment.sh deploy
```

## 🔍 Inspect & Debug

```bash
# Check running containers
docker ps

# View logs
docker logs shotspot-app -f

# Check health status
docker inspect shotspot-app | jq '.[0].State.Health'

# Execute commands in container
docker exec -it shotspot-app sh

# Check image details
docker inspect ghcr.io/psecurit/shotspot:latest
```

## 📊 Resource Monitoring

```bash
# Real-time resource usage
docker stats shotspot-app

# Memory usage
docker stats shotspot-app --no-stream --format "Memory: {{.MemUsage}}"

# Disk usage
docker system df
```

## 🔄 Updates & Rollbacks

```bash
# Update to latest
cd release
./deployment.sh update

# Update to specific version
./deployment.sh deploy v1.2.3

# Rollback (using docker-compose)
docker-compose down
docker pull ghcr.io/psecurit/shotspot:v1.2.2
docker-compose up -d

# Rollback using digest (immutable)
docker pull ghcr.io/psecurit/shotspot@sha256:abc123...
```

## 💾 Backup & Restore

```bash
# Backup database
docker exec shotspot-db pg_dump -U shotspot_user shotspot_db > backup.sql

# Backup with script
cd release
./deployment.sh backup

# Restore from backup
cat backup.sql | docker exec -i shotspot-db psql -U shotspot_user shotspot_db

# Backup volumes
docker run --rm \
  -v shotspot_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz /data
```

## 🔒 Security Operations

```bash
# Scan image for vulnerabilities
docker scan ghcr.io/psecurit/shotspot:latest

# Using Trivy
trivy image ghcr.io/psecurit/shotspot:latest

# Check image signatures
docker trust inspect ghcr.io/psecurit/shotspot:latest

# View SBOM (Software Bill of Materials)
docker sbom ghcr.io/psecurit/shotspot:latest
```

## 🧹 Cleanup

```bash
# Stop and remove containers
docker-compose down

# Remove with volumes (⚠️ data loss)
docker-compose down -v

# Remove old images
docker image prune -a

# Full cleanup (⚠️ removes everything)
docker system prune -a --volumes
```

## 🐛 Troubleshooting

### Container won't start

```bash
# Check logs for errors
docker logs shotspot-app

# Check if port is in use
netstat -tulpn | grep 3001

# Verify environment variables
docker exec shotspot-app env | grep -E "DB_|JWT_"
```

### Health check failing

```bash
# Manual health check
curl http://localhost:3001/api/health

# Check inside container
docker exec shotspot-app /usr/local/bin/healthcheck

# Check process
docker exec shotspot-app ps aux | grep node
```

### Database connection issues

```bash
# Test database connectivity
docker exec shotspot-app nc -zv db 5432

# Check database logs
docker logs shotspot-db

# Test from container
docker exec shotspot-app psql -h db -U shotspot_user -d shotspot_db -c "SELECT 1;"
```

### High memory usage

```bash
# Check memory limits
docker inspect shotspot-app | jq '.[0].HostConfig.Memory'

# Adjust limits in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 1G

# Restart with new limits
docker-compose up -d
```

### Slow performance

```bash
# Check resource usage
docker stats shotspot-app --no-stream

# Check CPU throttling
docker inspect shotspot-app | jq '.[0].HostConfig.CpuQuota'

# Increase resources
# Edit docker-compose.yml and adjust cpu/memory limits
```

## 📝 Environment Variables Reference

### Required
- `DB_HOST` - Database hostname
- `DB_PASSWORD` - Database password
- `JWT_SECRET` - JWT signing secret (min 32 chars)

### Optional
- `PORT` - Application port (default: 3001)
- `NODE_ENV` - Environment (production/development)
- `DB_PORT` - Database port (default: 5432)
- `DB_NAME` - Database name (default: shotspot_db)
- `DB_USER` - Database user (default: shotspot_user)
- `CORS_ORIGIN` - Allowed CORS origins
- `RATE_LIMIT_MAX` - Max requests per window
- `LOG_LEVEL` - Logging level (error/warn/info/debug)

## 🔗 Quick Links

- [Full Docker Guide](./DOCKER.md)
- [Security Guide](./DOCKER_SECURITY.md)
- [Release Directory](./release/)
- [GitHub Packages](https://github.com/pSecurIT/ShotSpot/pkgs/container/shotspot)

## 🆘 Emergency Commands

```bash
# Force restart
docker-compose restart app

# Emergency stop
docker-compose kill

# View last 100 log lines
docker logs shotspot-app --tail=100

# Export logs for debugging
docker logs shotspot-app > debug.log 2>&1

# Check disk space
df -h
docker system df
```

---

**Pro Tip**: Bookmark this page for quick reference during deployments!
