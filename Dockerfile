# Multi-stage build for ShotSpot application
# Security: Use Node LTS with Alpine for minimal attack surface and multi-arch support
# Stage 1: Build frontend
FROM node:lts-alpine AS frontend-builder

RUN npm install -g npm@latest

WORKDIR /app/frontend

# Security: Copy only package files first for better layer caching
COPY frontend/package*.json ./

# Multi-arch: Configure npm via environment variables (compatible across npm versions)
# Note: unsafe-perm removed in npm 9+ (now default behavior when running as root)
ENV NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=15000 \
    NPM_CONFIG_FETCH_RETRIES=10

# Security: Use npm ci for reproducible builds and verify checksums
# Install as root for speed (no chown needed on node_modules)
# Note: Keep optional deps for build tools like Rollup that need platform-specific binaries
# Include optional dependencies explicitly to avoid missing peer dependency errors
RUN npm ci --include=optional --ignore-scripts && \
    npm cache clean --force

# Copy frontend source (already owned by root, no chown needed yet)
COPY frontend/ ./

# Build frontend for production (can run as root, it's just a build)
RUN npm run build

# Stage 2: Build backend
FROM node:lts-alpine AS backend-builder

RUN npm install -g npm@latest

WORKDIR /app/backend

# Security: Copy package files for dependency installation
COPY backend/package*.json ./

# Multi-arch: Configure npm via environment variables (compatible across npm versions)
# Note: unsafe-perm removed in npm 9+ (now default behavior when running as root)
ENV NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=15000 \
    NPM_CONFIG_FETCH_RETRIES=10

# Security: Use npm ci with --ignore-scripts to prevent malicious postinstall scripts
# Install as root for speed (no chown needed on node_modules)
# Note: Keep optional deps - backend may need platform-specific modules
# Include optional dependencies explicitly to avoid missing peer dependency errors
RUN npm ci --include=optional --ignore-scripts && \
    npm cache clean --force

# Copy backend source (already owned by root)
COPY backend/ ./

# Stage 3: Production image
FROM node:lts-alpine

# Security: Update packages, npm, and install only necessary tools
RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache \
    dumb-init \
    tini && \
    rm -rf /var/cache/apk/* && \
    npm install -g npm@latest

# Security: Create non-root user (no chown on /app yet - faster)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    mkdir -p /app

WORKDIR /app

# Copy backend from builder with ownership set during copy (much faster than chown -R after)
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend ./backend

# Copy built frontend from builder with ownership set during copy
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/dist ./frontend/dist

# Copy health check script
COPY --chown=nodejs:nodejs healthcheck.sh /usr/local/bin/healthcheck
RUN chmod +x /usr/local/bin/healthcheck

# Install only production dependencies for backend
WORKDIR /app/backend

# Multi-arch: Configure npm via environment variables (compatible across npm versions)
# Note: unsafe-perm removed in npm 9+ (now default behavior when running as root)
ENV NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_FETCH_RETRIES=10

# Multi-arch: Use --no-optional to avoid problematic native dependencies
RUN npm ci --only=production --ignore-scripts --no-optional && \
    npm cache clean --force && \
    # Security: Remove unnecessary files
    find . -name "*.md" -type f -delete && \
    find . -name "*.ts" -type f -delete && \
    find . -name "*.map" -type f -delete

# Security: Set read-only permissions (only on source files, skip node_modules for speed)
RUN chmod -R 555 /app/backend/src && \
    chmod -R 555 /app/frontend/dist

# Security: Create temp directory with write permissions for app user
RUN mkdir -p /tmp/app && \
    chown -R nodejs:nodejs /tmp/app && \
    chmod 700 /tmp/app

# Security: Switch to non-root user
USER nodejs

# Security: Set environment variables for hardening
ENV NODE_ENV=production \
    NODE_OPTIONS="--no-warnings --max-old-space-size=512" \
    NPM_CONFIG_LOGLEVEL=error \
    TMPDIR=/tmp/app

# Expose backend port (non-privileged port)
EXPOSE 3001

# Security: Enhanced health check with custom script
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD ["/usr/local/bin/healthcheck"]

# Security: Use tini for proper signal handling and zombie reaping
ENTRYPOINT ["/sbin/tini", "--"]

# Security: Start with explicit working directory
CMD ["node", "--no-warnings", "src/index.js"]
