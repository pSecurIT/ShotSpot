import jwt from 'jsonwebtoken';

export const generateTestToken = (role = 'admin') => {
  // Default to admin role for test cases
  // Valid roles are: admin, coach, viewer
  // Convert role to lowercase and verify it's one of the allowed roles
  const allowedRoles = ['admin', 'coach', 'viewer'];
  const normalizedRole = role.toLowerCase();

  if (!allowedRoles.includes(normalizedRole)) {
    throw new Error(`Invalid role "${role}". Must be one of: ${allowedRoles.join(', ')}`);
  }

  const payload = {
    userId: 1,
    username: 'testuser',
    id: 1,
    role: normalizedRole,
    permissions: normalizedRole === 'admin' || normalizedRole === 'coach' ? ['write'] : ['read']
  };

  console.log('Generating test token:', { role, normalizedRole, payload });

  return jwt.sign(
    payload,
    process.env.JWT_SECRET || 'test_jwt_secret_key_min_32_chars_long_for_testing',
    { expiresIn: '1h' }
  );
};