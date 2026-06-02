import Tokens from 'csrf';

import { logError } from '../utils/logger.js';

const tokens = new Tokens();

// Initialize CSRF middleware
const csrf = (req, res, next) => {
  // Skip CSRF check in test environment
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  // Skip CSRF check for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF check for the CSRF token endpoint itself
  if (req.path === '/api/auth/csrf') {
    return next();
  }

  // Verify CSRF token for all POST/PUT/DELETE/PATCH requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const csrfToken = req.headers['x-csrf-token'];
    
    // Check if session has a CSRF secret
    if (!req.session || !req.session.csrfSecret) {
      if (process.env.NODE_ENV !== 'test') {
        logError('CSRF validation failed: No CSRF secret in session', {
          hasSession: !!req.session,
          sessionId: req.sessionID,
          hasSecret: !!(req.session && req.session.csrfSecret),
          path: req.path,
          cookies: Object.keys(req.cookies || {}),
          method: req.method
        });
      }
      return res.status(403).json({ 
        error: 'Invalid CSRF token',
        details: 'Session not initialized. Please refresh and try again.'
      });
    }

    // Verify the token
    if (!csrfToken || !tokens.verify(req.session.csrfSecret, csrfToken)) {
      logError('CSRF validation failed:', {
        hasToken: !!csrfToken,
        hasSecret: !!req.session.csrfSecret,
        path: req.path,
        method: req.method
      });
      return res.status(403).json({ 
        error: 'Invalid CSRF token',
        details: 'Please refresh the page and try again.'
      });
    }
  }
  
  next();
};

export default csrf;