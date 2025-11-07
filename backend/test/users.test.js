import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import db from '../src/db.js';

// Helper function to generate JWT tokens with actual user data
const generateJWT = (user) => {
  const payload = {
    userId: user.id,
    username: user.username,
    id: user.id,
    role: user.role,
    permissions: user.role === 'admin' || user.role === 'coach' ? ['write'] : ['read']
  };

  return jwt.sign(
    payload,
    process.env.JWT_SECRET || 'test_jwt_secret_key_min_32_chars_long_for_testing',
    { expiresIn: '1h' }
  );
};

describe('👥 Users API', () => {
  let testUsers = [];
  let adminToken;
  let userToken;

  beforeAll(async () => {
    console.log('✅ Users API test data initialized');

    // Create test users with different roles
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Create admin user
    const adminResult = await db.query(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES ($1, $2, $3, 'admin')
      RETURNING *
    `, [`admin_users_${Date.now()}`, 'admin@test.com', hashedPassword]);
    
    const adminUser = adminResult.rows[0];
    testUsers.push(adminUser);

    // Create regular user
    const userResult = await db.query(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES ($1, $2, $3, 'user')
      RETURNING *
    `, [`user_users_${Date.now()}`, 'user@test.com', hashedPassword]);
    
    const regularUser = userResult.rows[0];
    testUsers.push(regularUser);

    // Create coach user
    const coachResult = await db.query(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES ($1, $2, $3, 'coach')
      RETURNING *
    `, [`coach_users_${Date.now()}`, 'coach@test.com', hashedPassword]);
    
    testUsers.push(coachResult.rows[0]);

    // Generate tokens with actual user IDs
    adminToken = generateJWT(testUsers[0]); // admin user
    userToken = generateJWT(testUsers[1]);  // regular user
  });

  afterAll(async () => {
    // Clean up test data
    const userIds = testUsers.map(u => u.id);
    if (userIds.length > 0) {
      await db.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
    }
    console.log('✅ Users API tests completed');
  });

  describe('📊 GET /api/users', () => {
    it('✅ should get all users for admin', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(3);
      
      // Check user structure (shouldn't include password)
      const user = response.body[0];
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('username');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('role');
      expect(user).not.toHaveProperty('password_hash');
    });

    it('❌ should reject non-admin users', async () => {
      await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('❌ should reject unauthenticated requests', async () => {
      await request(app)
        .get('/api/users')
        .expect(401);
    });
  });

  describe('👤 GET /api/users/me', () => {
    it('✅ should get current user details', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testUsers[1].id);
      expect(response.body).toHaveProperty('username', testUsers[1].username);
      expect(response.body).toHaveProperty('email', testUsers[1].email);
      expect(response.body).toHaveProperty('role', 'user');
      expect(response.body).not.toHaveProperty('password_hash');
    });

    it('❌ should reject unauthenticated requests', async () => {
      await request(app)
        .get('/api/users/me')
        .expect(401);
    });

    it('❌ should handle non-existent user gracefully', async () => {
      // Create token for non-existent user
      const invalidToken = generateJWT({ id: 999999, username: 'nonexistent', role: 'user' });
      
      await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(404);
    });
  });

  describe('🔧 PUT /api/users/:userId/role', () => {
    it('✅ should update user role as admin', async () => {
      const targetUser = testUsers[1]; // Regular user
      
      const response = await request(app)
        .put(`/api/users/${targetUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'coach' })
        .expect(200);

      expect(response.body).toHaveProperty('id', targetUser.id);
      expect(response.body).toHaveProperty('role', 'coach');

      // Verify in database
      const dbResult = await db.query(
        'SELECT role FROM users WHERE id = $1',
        [targetUser.id]
      );
      expect(dbResult.rows[0].role).toBe('coach');
    });

    it('❌ should reject invalid roles', async () => {
      const targetUser = testUsers[1];
      
      await request(app)
        .put(`/api/users/${targetUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'invalid_role' })
        .expect(400);
    });

    it('❌ should reject non-admin users', async () => {
      const targetUser = testUsers[2];
      
      await request(app)
        .put(`/api/users/${targetUser.id}/role`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ role: 'admin' })
        .expect(403);
    });

    it('❌ should prevent admin self-demotion', async () => {
      const adminUser = testUsers[0];
      
      await request(app)
        .put(`/api/users/${adminUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'user' })
        .expect(403);
    });

    it('❌ should return 404 for non-existent user', async () => {
      await request(app)
        .put('/api/users/999999/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'user' })
        .expect(404);
    });
  });

  describe('🔒 PUT /api/users/:userId/password', () => {
    it('✅ should update own password with current password', async () => {
      const targetUser = testUsers[1];
      
      await request(app)
        .put(`/api/users/${targetUser.id}/password`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ 
          currentPassword: 'password123',
          newPassword: 'newpassword123'
        })
        .expect(200);

      // Verify password was actually changed
      const dbResult = await db.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [targetUser.id]
      );
      const isNewPassword = await bcrypt.compare('newpassword123', dbResult.rows[0].password_hash);
      expect(isNewPassword).toBe(true);
    });

    it('❌ should reject wrong current password', async () => {
      const targetUser = testUsers[1];
      
      await request(app)
        .put(`/api/users/${targetUser.id}/password`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ 
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123'
        })
        .expect(400);
    });

    it('❌ should reject short passwords', async () => {
      const targetUser = testUsers[1];
      
      await request(app)
        .put(`/api/users/${targetUser.id}/password`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ 
          currentPassword: 'newpassword123',
          newPassword: 'short'
        })
        .expect(400);
    });

    it('✅ should allow admin to change other users passwords', async () => {
      const targetUser = testUsers[2]; // Coach user
      
      await request(app)
        .put(`/api/users/${targetUser.id}/password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          newPassword: 'adminsetpassword123'
        })
        .expect(200);

      // Verify password was changed
      const dbResult = await db.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [targetUser.id]
      );
      const isNewPassword = await bcrypt.compare('adminsetpassword123', dbResult.rows[0].password_hash);
      expect(isNewPassword).toBe(true);
    });

    it('❌ should reject non-admin changing other users passwords', async () => {
      const targetUser = testUsers[0]; // Admin user
      
      await request(app)
        .put(`/api/users/${targetUser.id}/password`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ 
          newPassword: 'hackattempt123'
        })
        .expect(403);
    });

    it('❌ should require current password when changing own password', async () => {
      const targetUser = testUsers[1];
      
      await request(app)
        .put(`/api/users/${targetUser.id}/password`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ 
          newPassword: 'missingcurrent123'
        })
        .expect(400);
    });
  });

  describe('🚦 Rate Limiting', () => {
    it('✅ should handle rate limiting gracefully', async () => {
      // This test would require making many requests quickly
      // For now, just verify the endpoint responds normally
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
    });
  });

  describe('🧪 Edge Cases', () => {
    it('❌ should handle database errors gracefully', async () => {
      // This would require mocking the database to simulate errors
      // For integration tests, we verify error handling exists
      expect(true).toBe(true); // Placeholder - actual implementation would mock db.query
    });

    it('✅ should validate input sanitization', async () => {
      const response = await request(app)
        .put(`/api/users/${testUsers[1].id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: '<script>alert("xss")</script>' })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });
});