#!/bin/sh
# Health check script for Docker container
# This script performs comprehensive health checks

set -e

# Check if Node.js process is running
if ! pgrep -f "node.*src/index.js" > /dev/null 2>&1; then
    echo "ERROR: Node.js process not running"
    exit 1
fi

# Check if application responds to health endpoint
if command -v wget > /dev/null 2>&1; then
    wget -q --spider --timeout=5 http://localhost:3001/api/health || {
        echo "ERROR: Health endpoint not responding"
        exit 1
    }
elif command -v curl > /dev/null 2>&1; then
    curl -sf --max-time 5 http://localhost:3001/api/health > /dev/null || {
        echo "ERROR: Health endpoint not responding"
        exit 1
    }
else
    # Fallback: Use Node.js built-in http
    node -e "
        const http = require('http');
        const req = http.get({
            host: 'localhost',
            port: 3001,
            path: '/api/health',
            timeout: 5000
        }, (res) => {
            process.exit(res.statusCode === 200 ? 0 : 1);
        });
        req.on('error', () => process.exit(1));
        req.on('timeout', () => {
            req.destroy();
            process.exit(1);
        });
    " || {
        echo "ERROR: Health endpoint check failed"
        exit 1
    }
fi

# Check memory usage (optional warning)
if [ -f /proc/meminfo ]; then
    MEM_TOTAL=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    MEM_AVAILABLE=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
    MEM_USED_PERCENT=$((100 - (MEM_AVAILABLE * 100 / MEM_TOTAL)))
    
    if [ $MEM_USED_PERCENT -gt 90 ]; then
        echo "WARNING: Memory usage at ${MEM_USED_PERCENT}%"
    fi
fi

echo "OK: Health check passed"
exit 0
