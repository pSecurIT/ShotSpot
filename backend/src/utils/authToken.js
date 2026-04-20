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

export const getJwtSecret = () => process.env.JWT_SECRET || 'test_jwt_secret_key_min_32_chars_long_for_testing';

export const verifyAccessTokenClaims = (token, jwtSecret = getJwtSecret()) => {
  const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
  if (!decoded || typeof decoded !== 'object') {
    throw createJwtClaimError('Invalid token payload');
  }

  const normalizedUserId = Number(decoded.userId);
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
