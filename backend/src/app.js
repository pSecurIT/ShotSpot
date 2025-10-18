import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import csrf from './middleware/csrf.js';
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

const app = express();

// Security middleware with enhanced configuration
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      manifestSrc: ["'none'"],
      workerSrc: ["'none'"],
      sandbox: [
        'allow-forms',
        'allow-scripts',
        'allow-same-origin',
        'allow-downloads'
      ],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [""] : null,
      reportUri: process.env.CSP_REPORT_URI || '/api/csp-report',
      reportTo: 'csp-endpoint'
    },
    reportOnly: false
  },
  crossOriginEmbedderPolicy: { policy: 'require-corp' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-site' },
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

// Rate limiting with enhanced security
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
    // Skip rate limiting for certain trusted IPs, health checks, and timer endpoints (frequent polling)
    const trustedIPs = (process.env.TRUSTED_IPS || '').split(',');
    const isTimerEndpoint = req.path.startsWith('/api/timer');
    const isHealthCheck = req.path === '/health';
    const isTrustedIP = trustedIPs.includes(req.ip);
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // In development, skip rate limiting for timer endpoints and localhost
    return isHealthCheck || isTrustedIP || (isDevelopment && (isTimerEndpoint || req.ip === '127.0.0.1' || req.ip === '::1'));
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

// CORS configuration with enhanced security
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isTest = process.env.NODE_ENV === 'test';
    
    // Allow all requests in test environment
    if (isTest) {
      callback(null, true);
      return;
    }
    
    // In production, require origin and match against allowed origins
    if (!isDevelopment && !isTest && !origin) {
      callback(new Error('Origin header is required'), false);
      return;
    }
    
    // Allow requests with no origin in development only
    if (isDevelopment && !origin) {
      callback(null, true);
      return;
    }

    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Origin not allowed by CORS'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-CSRF-Token'  // Added CSRF token header
  ],
  exposedHeaders: ['Authorization'],
  credentials: true,
  maxAge: 3600, // 1 hour
  preflightContinue: false,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

// Debug middleware
app.use((req, res, next) => {
  console.log('Request:', {
    method: req.method,
    path: req.path,
    headers: {
      authorization: req.headers.authorization ? 'present' : 'missing',
      'content-type': req.headers['content-type']
    }
  });
  next();
});

// Session configuration
app.use(cookieParser());
// Session configuration with security settings from environment
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true, // Changed to true to create session for CSRF token
  name: 'sessionId', // Change from default 'connect.sid'
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // Allow cross-site in development
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
    domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined
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
app.use('/health', healthRoutes); // Health check endpoint should be before other routes
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/match-events', matchEventsRoutes);
app.use('/api/shots', shotsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/timer', timerRoutes);
app.use('/api/possessions', possessionsRoutes);
app.use('/api/game-rosters', gameRostersRoutes);

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
  
  // Log based on environment configuration
  if (process.env.ENABLE_ERROR_LOGGING === 'true') {
    if (process.env.NODE_ENV === 'production') {
      // Production logging to file
      const logPath = process.env.LOG_FILE_PATH || 'logs/app.log';
      const logLevel = process.env.LOG_LEVEL || 'error';
      
      // Ensure log directory exists
      const logDir = require('path').dirname(logPath);
      require('fs').mkdirSync(logDir, { recursive: true });
      
      // Write to log file
      require('fs').appendFileSync(
        logPath,
        JSON.stringify({ ...logError, level: logLevel }) + '\n'
      );
      
      // Send notification for critical errors if webhook is configured
      if (error.status === 500 && process.env.ERROR_NOTIFICATION_WEBHOOK) {
        fetch(process.env.ERROR_NOTIFICATION_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logError)
        }).catch(webhookErr => {
          // Log webhook failures but don't crash the app
          console.error('Failed to send error notification to webhook:', webhookErr.message);
        });
      }
    } else {
      // Development logging
      console.error(logError);
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
  if (error.status === 500) {
    // TODO: Implement error notification system
    // notifyTeam(logError);
  }
});

// 404 handler - must be after all other routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

export default app;