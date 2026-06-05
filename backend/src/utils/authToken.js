import jwt from 'jsonwebtoken';

const BEARER_TOKEN_REGEX = /^Bearer\s+([A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+)$/;

const createJwtClaimError = (message) => {
  const error = new Error(message);
  error.name = 'JsonWebTokenError';
  return error;
};

export const extractBearerToken = (authorizationHeader) => {
  if (typeof authorizationHeader !== 'string') {
    return null;
  }

  const match = authorizationHeader.match(BEARER_TOKEN_REGEX);
  return match ? match[1] : null;
};

export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET must be set');
  }
  return secret;
};

export const verifyAccessTokenClaims = (token, jwtSecret = getJwtSecret()) => {
  if (!token || typeof token !== 'string') {
    throw createJwtClaimError('Missing or malformed Bearer token');
  }
  const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
  if (!decoded || typeof decoded !== 'object') {
    throw createJwtClaimError('Invalid token payload');
  }

  const rawUserId = decoded.userId ?? decoded.id;
  const normalizedUserId = Number(rawUserId);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0 || typeof decoded.role !== 'string') {
    throw createJwtClaimError('Invalid token claims');
  }

  return {
    ...decoded,
    userId: normalizedUserId,
    role: decoded.role.toLowerCase(),
    passwordMustChange: decoded.passwordMustChange === true
  };
};
