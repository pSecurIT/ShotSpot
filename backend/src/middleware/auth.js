import { logError, logInfo } from '../utils/logger.js';
import { extractBearerToken, getJwtSecret, verifyAccessTokenClaims } from '../utils/authToken.js';

const auth = (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      logError('auth: Missing or malformed Bearer token');
      return res.status(401).json({ error: 'Invalid token format' });
    }

    const reqUser = verifyAccessTokenClaims(token, getJwtSecret());
    req.user = reqUser;
    logInfo('Auth: Verified token payload:', reqUser);
    logInfo('Auth: Final user object:', req.user);

    // Check if password must be changed (allow only change-password and logout endpoints)
    if (req.user.passwordMustChange) {
      const allowedPaths = [
        '/api/auth/change-password',
        '/api/auth/logout',
        '/api/health',
        '/change-password',
        '/logout'
      ];
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
    logInfo('requireRole: Checking request', {
      path: req.path,
      method: req.method,
      user: req.user,
      requestedRoles: roles
    });

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
    logInfo('requireRole: Role validation:', {
      userRole,
      allowedRoles,
      hasRequiredRole: allowedRoles.includes(userRole),
      userObject: req.user
    });

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
  const decoded = verifyAccessTokenClaims(token, getJwtSecret());
  return {
    userId: decoded.userId,
    role: decoded.role
  };
};

export { auth, requireRole, verifyToken };