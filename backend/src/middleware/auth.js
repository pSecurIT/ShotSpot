import jwt from 'jsonwebtoken';

const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.error('auth: No authorization header');
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1]; // Bearer <token>
    if (!token) {
      console.error('auth: Missing token in authorization header');
      return res.status(401).json({ error: 'Invalid token format' });
    }

    // Validate JWT token structure (must have 3 parts: header.payload.signature)
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      console.error('auth: Malformed JWT token - expected 3 parts, got', tokenParts.length);
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
      console.error('auth: Error decoding token payload:', err.message);
      return res.status(401).json({ error: 'Invalid token format' });
    }

    // Verify and decode token
    const decoded = jwt.verify(token, jwtSecret);
    if (process.env.NODE_ENV !== 'test') {
      console.log('Auth: Verified token payload:', decoded);
    }
    
    req.user = {
      ...decoded,
      role: decoded.role.toLowerCase() // Normalize role here
    };

    if (process.env.NODE_ENV !== 'test') {
      console.log('Auth: Final user object:', req.user);
    }
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid token' });
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
      console.error('requireRole: No user object found in request');
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.user.role) {
      console.error('requireRole: No role found in user object:', req.user);
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
      console.error(`requireRole: User role ${userRole} not in allowed roles:`, allowedRoles);
      return res.status(403).json({
        error: 'Insufficient permissions',
        details: `Required role(s): ${roles.join(', ')}. Current role: ${userRole}`
      });
    }

    next();
  };
};

export { auth, requireRole };