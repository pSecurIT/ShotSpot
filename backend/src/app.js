import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import authRoutes from './routes/auth.js';
import teamRoutes from './routes/teams.js';
import playerRoutes from './routes/players.js';
import matchEventsRoutes from './routes/match-events.js';

const app = express();

// Security middleware with enhanced configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      sandbox: ['allow-forms', 'allow-scripts', 'allow-same-origin'],
      reportUri: '/api/csp-report',
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-site" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: "deny" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true
}));

// Custom CSP report handler
app.post('/api/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  console.error('CSP Violation:', req.body);
  res.status(204).end();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests, please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000) - Date.now() / 1000
    });
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

// CORS configuration with strict origin validation
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Origin not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['Authorization'],
  credentials: true,
  maxAge: 3600, // 1 hour
  preflightContinue: false,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

// Body parser with size limits and sanitization
app.use(express.json({
  limit: '10kb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch(e) {
      res.status(400).json({ error: 'Invalid JSON' });
      throw new Error('Invalid JSON');
    }
  }
}));

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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/match-events', matchEventsRoutes);

// Global error handling middleware
app.use((err, req, res, next) => {
  // Log error details for debugging
  console.error(err.stack);
  
  // Don't leak error details in production
  const isProd = process.env.NODE_ENV === 'production';
  const error = {
    status: err.status || 500,
    message: isProd ? 'Internal server error' : err.message,
    ...(isProd ? {} : { stack: err.stack })
  };
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    error.status = 400;
    error.message = isProd ? 'Invalid input' : err.message;
  } else if (err.name === 'UnauthorizedError') {
    error.status = 401;
    error.message = 'Authentication required';
  }
  
  res.status(error.status).json({ error });
});

// 404 handler - must be after all other routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

export default app;