import jwt from 'jsonwebtoken';

// Helper to log errors only in non-test environments
const isTest = process.env.NODE_ENV === 'test';
const logError = (...args) => {
  if (!isTest) console.error(...args);
};

const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      logError('auth: No authorization header');
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1]; // Bearer <token>
    if (!token) {
      logError('auth: Missing token in authorization header');
      return res.status(401).json({ error: 'Invalid token format' });
    }

    // Validate JWT token structure (must have 3 parts: header.payload.signature)
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      logError('auth: Malformed JWT token - expected 3 parts, got', tokenParts.length);
      return res.status(401).json({ error: 'Invalid token format' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_key_min_32_chars_long_for_testing';
    
    // Decode token payload for logging (without verification)
    const payloadB64 = tokenParts[1];
    let rawPayload;
    try {
      if (!payloadB64 || payloadB64.length === 0) {
        throw new Error('Empty payload');
      }
      rawPayload = Buffer.from(payloadB64, 'base64').toString();
      // Only log in non-test environments
      if (process.env.NODE_ENV !== 'test') {
        console.log('Auth: Raw token payload:', rawPayload);
      }
    } catch (err) {
      logError('auth: Error decoding token payload:', err.message);
      return res.status(401).json({ error: 'Invalid token format' });
    }

    // Verify and decode token
    const decoded = jwt.verify(token, jwtSecret);
    if (process.env.NODE_ENV !== 'test') {
      console.log('Auth: Verified token payload:', decoded);
    }
    
    req.user = {
      ...decoded,
      role: decoded.role.toLowerCase(), // Normalize role here
      passwordMustChange: decoded.passwordMustChange || false
    };

    if (process.env.NODE_ENV !== 'test') {
      console.log('Auth: Final user object:', req.user);
    }

    // Check if password must be changed (allow only change-password and logout endpoints)
    if (req.user.passwordMustChange) {
      const allowedPaths = ['/api/auth/change-password', '/api/auth/logout', '/api/health'];
      const isAllowedPath = allowedPaths.some(path => req.path === path || req.path.startsWith(path));
      
      if (!isAllowedPath) {
        return res.status(403).json({
          error: 'Password change required',
          message: 'You must change your password before accessing other resources',
          passwordMustChange: true
        });
      }
    }

    next();
  } catch (error) {
    // Don't expose JWT error details to client (security best practice)
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', expired: true });
    } else if (error.name === 'JsonWebTokenError') {
      logError('JWT verification failed:', error.message);
      return res.status(401).json({ error: 'Invalid token' });
    } else {
      logError('Authentication error:', error);
      return res.status(401).json({ error: 'Authentication failed' });
    }
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    // Debug info for request (only in non-test environments)
    if (process.env.NODE_ENV !== 'test') {
      console.log('requireRole: Checking request', {
        path: req.path,
        method: req.method,
        user: req.user,
        requestedRoles: roles
      });
    }

    if (!req.user) {
      logError('requireRole: No user object found in request');
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.user.role) {
      logError('requireRole: No role found in user object:', req.user);
      return res.status(403).json({ error: 'No role assigned to user' });
    }

    // Always normalize roles to lowercase for comparison
    const userRole = req.user.role.toLowerCase();
    const allowedRoles = Array.isArray(roles) 
      ? roles.map(r => r.toLowerCase()) 
      : [roles.toLowerCase()];

    // Debug information for role check (only in non-test environments)
    if (process.env.NODE_ENV !== 'test') {
      console.log('requireRole: Role validation:', {
        userRole,
        allowedRoles,
        hasRequiredRole: allowedRoles.includes(userRole),
        userObject: req.user
      });
    }

    if (!allowedRoles.includes(userRole)) {
      logError(`requireRole: User role ${userRole} not in allowed roles:`, allowedRoles);
      return res.status(403).json({
        error: 'Insufficient permissions',
        details: `Required role(s): ${roles.join(', ')}. Current role: ${userRole}`
      });
    }

    next();
  };
};

// Export token verification function for WebSocket auth
const verifyToken = (token) => {
  const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_key_min_32_chars_long_for_testing';
  const decoded = jwt.verify(token, jwtSecret);
  return {
    userId: decoded.userId,
    role: decoded.role.toLowerCase()
  };
};

export { auth, requireRole, verifyToken };