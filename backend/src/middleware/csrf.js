import Tokens from 'csrf';

const tokens = new Tokens();

// Initialize CSRF middleware
const csrf = (req, res, next) => {
  // Skip CSRF check in test environment
  if (process.env.NODE_ENV === 'test') {
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