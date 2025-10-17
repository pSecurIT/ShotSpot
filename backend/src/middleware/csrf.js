const Tokens = require('csrf');
const tokens = new Tokens();

// Initialize CSRF middleware
const csrf = (req, res, next) => {
  // Skip CSRF check for the CSRF token endpoint itself
  if (req.path === '/api/auth/csrf') {
    return next();
  }

  // Verify CSRF token for all other POST/PUT/DELETE requests
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const csrfToken = req.headers['x-csrf-token'];
    if (!csrfToken || !tokens.verify(req.session.csrfSecret, csrfToken)) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
  }
  next();
};

module.exports = csrf;