# Multi-stage build for ShotSpot application
# Security: Use Node 22.12 with Alpine for minimal attack surface
# Stage 1: Build frontend
FROM node:22.12-alpine AS frontend-builder

WORKDIR /app/frontend

# Security: Copy only package files first for better layer caching
COPY frontend/package*.json ./

# Security: Use npm ci for reproducible builds and verify checksums
RUN npm ci --ignore-scripts && \
    npm cache clean --force

# Copy frontend source
COPY frontend/ ./

# Security: Create non-root user and ensure ownership of entire /app directory
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Security: Build as non-root user
USER nodejs

# Build frontend for production
RUN npm run build

# Stage 2: Build backend
FROM node:22.12-alpine AS backend-builder

WORKDIR /app/backend

# Security: Copy package files for dependency installation
COPY backend/package*.json ./

# Security: Use npm ci with --ignore-scripts to prevent malicious postinstall scripts
RUN npm ci --ignore-scripts && \
    npm cache clean --force

# Copy backend source
COPY backend/ ./

# Security: Create non-root user and ensure ownership of entire /app directory
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Security: Switch to non-root user for any build operations
USER nodejs

# Stage 3: Production image
FROM node:22.12-alpine

# Security: Update packages and install only necessary tools
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
    dumb-init \
    tini && \
    rm -rf /var/cache/apk/*

# Security: Create non-root user with minimal privileges
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    mkdir -p /app && \
    chown -R nodejs:nodejs /app

WORKDIR /app

# Security: Set file permissions before copying
USER root

# Copy backend from builder with restricted permissions
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend ./backend

# Copy built frontend from builder with restricted permissions
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/dist ./frontend/dist

# Copy health check script
COPY --chown=nodejs:nodejs healthcheck.sh /usr/local/bin/healthcheck
RUN chmod +x /usr/local/bin/healthcheck

# Install only production dependencies for backend
WORKDIR /app/backend
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force && \
    # Security: Remove unnecessary files
    find . -name "*.md" -type f -delete && \
    find . -name "*.ts" -type f -delete && \
    find . -name "*.map" -type f -delete

# Security: Set read-only filesystem for application files
RUN chmod -R 555 /app/backend/src && \
    chmod -R 555 /app/frontend/dist && \
    # Keep node_modules executable for binary scripts
    chmod -R 555 /app/backend/node_modules/.bin || true

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
