import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import csrf from './middleware/csrf.js';
import { errorNotificationService } from './utils/errorNotification.js';
import authRoutes from './routes/auth.js';
import teamRoutes from './routes/teams.js';
import playerRoutes from './routes/players.js';
import matchEventsRoutes from './routes/match-events.js';
import gamesRoutes from './routes/games.js';
import shotsRoutes from './routes/shots.js';
import eventsRoutes from './routes/events.js';
import timerRoutes from './routes/timer.js';
import possessionsRoutes from './routes/possessions.js';
import gameRostersRoutes from './routes/game-rosters.js';
import substitutionsRoutes from './routes/substitutions.js';
import freeShotsRoutes from './routes/free-shots.js';
import timeoutsRoutes from './routes/timeouts.js';
import matchCommentaryRoutes from './routes/match-commentary.js';
import userRoutes from './routes/users.js';
import analyticsRoutes from './routes/analytics.js';
import achievementsRoutes from './routes/achievements.js';
import reportTemplatesRoutes from './routes/report-templates.js';
import exportSettingsRoutes from './routes/export-settings.js';
import scheduledReportsRoutes from './routes/scheduled-reports.js';
import reportsRoutes from './routes/reports.js';
import exportsRoutes from './routes/exports.js';
import exportRoutes from './routes/export.js';


const app = express();

// Security middleware with enhanced configuration
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ['\'self\''],
      scriptSrc: ['\'self\'', '\'unsafe-inline\''], // Allow inline scripts for SPA
      styleSrc: ['\'self\'', '\'unsafe-inline\'', 'https://fonts.googleapis.com'], // Allow inline styles and Google Fonts
      imgSrc: ['\'self\'', 'data:', 'blob:'], // Allow data URIs and blobs for images
      connectSrc: ['\'self\'', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'], // API calls + Google Fonts for service worker
      fontSrc: ['\'self\'', 'data:', 'https://fonts.gstatic.com'], // Allow Google Fonts
      objectSrc: ['\'none\''],
      mediaSrc: ['\'self\''],
      frameSrc: ['\'none\''],
      baseUri: ['\'self\''],
      formAction: ['\'self\''],
      frameAncestors: ['\'none\''],
      manifestSrc: ['\'self\''], // Allow manifest.json
      workerSrc: ['\'self\'', 'blob:'], // Allow service workers
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      reportUri: process.env.CSP_REPORT_URI || '/api/csp-report'
    },
    reportOnly: process.env.NODE_ENV !== 'production' // Report-only in development
  },
  crossOriginEmbedderPolicy: false, // Disable for SPA compatibility
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' }, // Allow resources from same origin
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hsts: process.env.ENABLE_HSTS === 'true' ? {
    maxAge: parseInt(process.env.HSTS_MAX_AGE) || 31536000,
    includeSubDomains: true,
    preload: true
  } : false,
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
}));

// Custom CSP report handler
app.post('/api/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  console.error('CSP Violation:', req.body);
  res.status(204).end();
});

// Rate limiting with enhanced security (disabled in test to prevent timer leaks)
if (process.env.NODE_ENV !== 'test') {
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX) || 5000, // Increased for development with timer polling
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skipSuccessfulRequests: false, // Count all requests
    skipFailedRequests: false,     // Count failed requests too
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too many requests, please try again later.',
        retryAfter: Math.ceil(req.rateLimit.resetTime / 1000) - Date.now() / 1000
      });
    },
    skip: (req) => {
      // Skip rate limiting in development mode entirely to avoid issues during rapid dev cycles
      const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';
      if (isDevelopment) {
        return true; // Skip all rate limiting in development
      }
      
      // In production, skip only for trusted IPs and health checks
      const trustedIPs = (process.env.TRUSTED_IPS || '').split(',');
      const isHealthCheck = req.path === '/api/health';
      const isTrustedIP = trustedIPs.includes(req.ip);
      
      return isHealthCheck || isTrustedIP;
    }
  });

  // Speed limiter - gradually slow down responses based on number of requests
  const speedLimiter = slowDown({
    windowMs: 900000, // 15 minutes
    delayAfter: 50, // allow 50 requests per 15 minutes, then...
    delayMs: (hits) => hits * 100, // add 100ms of delay per hit
    maxDelayMs: 3000 // maximum delay of 3 seconds
  });

  // Apply rate limiting and speed limiting to all routes
  app.use(limiter);
  app.use(speedLimiter);
}

// CORS configuration with enhanced security
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(origin => origin.trim());

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Log but don't crash - just deny the request
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`⚠️  CORS: Blocked request from origin: ${origin}`);
      }
      // Return false to deny, but DON'T throw error (causes crash)
      callback(null, false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-CSRF-Token'
  ],
  exposedHeaders: ['Authorization'],
  credentials: true,
  maxAge: 3600,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

try {
  app.use(cors(corsOptions));
} catch (corsError) {
  console.error('❌ CORS middleware error:', corsError);
  throw corsError;
}

// Debug middleware (silent in test environment)
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log('Request:', {
      method: req.method,
      path: req.path,
      headers: {
        authorization: req.headers.authorization ? 'present' : 'missing',
        'content-type': req.headers['content-type']
      }
    });
  }
  next();
});

// Session configuration
app.use(cookieParser());
// Session configuration with security settings from environment
app.use(session({
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: true, // Changed to true to create session for CSRF token
  name: 'sessionId', // Change from default 'connect.sid'
  cookie: {
    // Allow SESSION_SECURE env var to override (useful for Docker/local testing on HTTP)
    // In Docker without HTTPS, secure must be false
    secure: process.env.SESSION_SECURE === 'true' ? true : false,
    httpOnly: true,
    // Use 'lax' for Docker compatibility - allows cookies to be sent on initial navigation
    sameSite: process.env.SESSION_SAME_SITE || 'lax',
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
    // Don't set domain in Docker - let browser handle it
    domain: process.env.COOKIE_DOMAIN || undefined
  },
  rolling: true, // Refresh session with each request
  unset: 'destroy'
}));

// Request body security middleware
app.use((req, res, next) => {
  // Validate Content-Type for POST/PUT/PATCH requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(415).json({ 
        error: 'Unsupported Media Type. Content-Type must be application/json' 
      });
    }
  }
  next();
});

// Body parser with enhanced security
app.use(express.json({
  limit: process.env.API_MAX_PAYLOAD_SIZE || '10kb',
  strict: true // Reject payloads that are not arrays or objects
}));

// CSRF protection
app.use(csrf);

// Security headers middleware
app.use((req, res, next) => {
  // Remove potentially sensitive headers
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Permissions-Policy', 
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );
  
  // Prevent browsers from performing MIME type sniffing
  res.setHeader('X-Download-Options', 'noopen');
  
  // Disable client-side caching for authenticated requests
  if (req.headers.authorization) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  
  next();
});

// Import health check routes
import healthRoutes from './routes/health.js';

// Routes
app.use('/api/health', healthRoutes); // Health check endpoint should be before other routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/match-events', matchEventsRoutes);
app.use('/api/shots', shotsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/achievements', achievementsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/timer', timerRoutes);
app.use('/api/possessions', possessionsRoutes);
app.use('/api/game-rosters', gameRostersRoutes);
app.use('/api/substitutions', substitutionsRoutes);
app.use('/api/free-shots', freeShotsRoutes);
app.use('/api/timeouts', timeoutsRoutes);
app.use('/api/match-commentary', matchCommentaryRoutes);
app.use('/api/report-templates', reportTemplatesRoutes);
app.use('/api/export-settings', exportSettingsRoutes);
app.use('/api/scheduled-reports', scheduledReportsRoutes);
app.use('/api/exports', exportsRoutes);

// Global error handling middleware with enhanced security
app.use((err, req, res, _next) => {
  // Log error details securely
  const errorId = crypto.randomUUID();
  const logError = {
    id: errorId,
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip: req.ip,
    userId: req.user?.id,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack
    }
  };
  
  // Always log errors to console for debugging
  console.error('Error caught by global handler:', logError);
  
  // Log based on environment configuration
  if (process.env.ENABLE_ERROR_LOGGING === 'true') {
    if (process.env.NODE_ENV === 'production') {
      // Production logging to file
      const logPath = process.env.LOG_FILE_PATH || 'logs/app.log';
      const logLevel = process.env.LOG_LEVEL || 'error';
      
      // Ensure log directory exists
      const logDir = path.dirname(logPath);
      fs.mkdirSync(logDir, { recursive: true });
      
      // Write to log file
      fs.appendFileSync(
        logPath,
        JSON.stringify({ ...logError, level: logLevel }) + '\n'
      );
      
      // Send notification for critical errors if webhook is configured
      if (err.status === 500 && process.env.ERROR_NOTIFICATION_WEBHOOK) {
        fetch(process.env.ERROR_NOTIFICATION_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logError)
        }).catch(webhookErr => {
          // Log webhook failures but don't crash the app
          console.error('Failed to send error notification to webhook:', webhookErr.message);
        });
      }
    }
  }
  
  // Don't leak error details in production
  const isProd = process.env.NODE_ENV === 'production';
  const error = {
    id: errorId, // Include error ID for tracking
    status: err.status || 500,
    message: isProd ? 'Internal server error' : err.message,
    ...(isProd ? {} : { stack: err.stack })
  };
  
  // Handle specific error types
  switch (err.name) {
  case 'ValidationError':
    error.status = 400;
    error.message = isProd ? 'Invalid input' : err.message;
    break;
  case 'UnauthorizedError':
    error.status = 401;
    error.message = 'Authentication required';
    break;
  case 'ForbiddenError':
    error.status = 403;
    error.message = 'Access denied';
    break;
  case 'NotFoundError':
    error.status = 404;
    error.message = 'Resource not found';
    break;
  case 'ConflictError':
    error.status = 409;
    error.message = 'Resource conflict';
    break;
  case 'PayloadTooLargeError':
    error.status = 413;
    error.message = 'Request entity too large';
    break;
  case 'UnsupportedMediaTypeError':
    error.status = 415;
    error.message = 'Unsupported media type';
    break;
  case 'TooManyRequestsError':
    error.status = 429;
    error.message = 'Too many requests';
    break;
  }
  
  // Clear any sensitive headers
  res.removeHeader('X-Powered-By');
  
  // Send error response
  res.status(error.status).json({ error });
  
  // If this is a critical error, notify the team
  if (error.status >= 500 || error.status === 429 || error.status === 401) {
    errorNotificationService.notifyTeam(logError).catch(notifyErr => {
      // Don't crash the app if notification fails
      console.error('Failed to send error notification:', notifyErr.message);
    });
  }
});

// Serve static frontend files in both production and development
// Get __dirname equivalent for ES modules
const currentFileUrl = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFileUrl);
const frontendDistPath = path.join(currentDir, '../../frontend/dist');

// Check if frontend dist folder exists
let serveFrontend = false;
try {
  fs.accessSync(frontendDistPath);
  serveFrontend = true;
  console.log('Frontend dist folder found, serving static files from:', frontendDistPath);
} catch {
  console.log('Frontend dist folder not found. Run "npm run build" in frontend directory to build.');
}

if (serveFrontend) {
  // Serve static files
  app.use(express.static(frontendDistPath, {
    maxAge: process.env.NODE_ENV === 'production' ? '1y' : '0',
    setHeaders: (res, filepath) => {
      // Don't cache index.html and service-worker.js
      if (filepath.endsWith('index.html') || filepath.endsWith('service-worker.js')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      }
    }
  }));
  
  // SPA fallback - serve index.html for all non-API, non-asset routes
  // Use middleware instead of route pattern for path-to-regexp v8 compatibility
  app.use((req, res) => {
    // Don't serve index.html for API routes (includes /api/health)
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Route not found' });
    }
    // Don't serve index.html for static assets (express.static already handled these)
    if (req.path.startsWith('/assets/') || req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    // Serve index.html for all other GET requests (SPA routing)
    if (req.method === 'GET') {
      return res.sendFile(path.join(frontendDistPath, 'index.html'));
    }
    // Non-GET requests that aren't API calls
    res.status(404).json({ error: 'Route not found' });
  });
} else {
  // 404 handler when frontend is not built
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Route not found' });
    }
    res.status(503).json({ 
      error: 'Frontend not available', 
      message: 'Run "npm run build" in the frontend directory to build the application' 
    });
  });
}

export default app;