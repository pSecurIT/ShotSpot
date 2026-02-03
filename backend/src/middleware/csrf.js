import Tokens from 'csrf';

const tokens = new Tokens();

// Initialize CSRF middleware
const csrf = (req, res, next) => {
  // Skip CSRF check in test environment
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  // For APIs authenticated via Authorization: Bearer <jwt>, CSRF protection is
  // not required because the browser will not attach the token automatically.
  // This also prevents dev-time issues after server restarts (in-memory session reset).
  const authHeader = req.headers?.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return next();
  }

  // Skip CSRF check for GET requests (they should be safe operations)
  if (req.method === 'GET') {
    return next();
  }

  // Skip CSRF check for the CSRF token endpoint itself
  if (req.path === '/api/auth/csrf') {
    return next();
  }

  // Login creates a JWT and does not rely on cookie-based auth.
  // Skipping CSRF here improves dev ergonomics (e.g., VS Code Simple Browser)
  // without weakening protections for cookie-authenticated routes.
  if (req.path === '/api/auth/login') {
    return next();
  }

  // Verify CSRF token for all POST/PUT/DELETE/PATCH requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const csrfToken = req.headers['x-csrf-token'];
    
    // Check if session has a CSRF secret
    if (!req.session || !req.session.csrfSecret) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('CSRF validation failed: No CSRF secret in session', {
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
      console.error('CSRF validation failed:', {
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