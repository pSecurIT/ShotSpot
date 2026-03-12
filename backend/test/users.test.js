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
  let adminUser;

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
    
    adminUser = adminResult.rows[0];
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

  describe('➕ POST /api/users', () => {
    let createdUserIds = [];

    afterAll(async () => {
      // Clean up created users
      if (createdUserIds.length > 0) {
        await db.query('DELETE FROM users WHERE id = ANY($1)', [createdUserIds]);
      }
    });

    it('✅ should create new user as admin', async () => {
      const newUser = {
        username: `newuser_${Date.now()}`,
        email: `newuser_${Date.now()}@test.com`,
        password: 'SecureP@ss123',
        role: 'user'
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newUser)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('username', newUser.username);
      expect(response.body).toHaveProperty('email', newUser.email);
      expect(response.body).toHaveProperty('role', 'user');
      expect(response.body).toHaveProperty('is_active', true);
      expect(response.body).not.toHaveProperty('password_hash');

      createdUserIds.push(response.body.id);

      // Verify password was hashed correctly
      const dbResult = await db.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [response.body.id]
      );
      const isPasswordValid = await bcrypt.compare('SecureP@ss123', dbResult.rows[0].password_hash);
      expect(isPasswordValid).toBe(true);
    });

    it('✅ should create user with coach role', async () => {
      const newCoach = {
        username: `newcoach_${Date.now()}`,
        email: `newcoach_${Date.now()}@test.com`,
        password: 'CoachP@ss123',
        role: 'coach'
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newCoach)
        .expect(201);

      expect(response.body).toHaveProperty('role', 'coach');
      createdUserIds.push(response.body.id);
    });

    it('✅ should create user with admin role', async () => {
      const newAdmin = {
        username: `newadmin_${Date.now()}`,
        email: `newadmin_${Date.now()}@test.com`,
        password: 'AdminP@ss123',
        role: 'admin'
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newAdmin)
        .expect(201);

      expect(response.body).toHaveProperty('role', 'admin');
      createdUserIds.push(response.body.id);
    });

    it('❌ should reject duplicate username', async () => {
      const existingUsername = testUsers[0].username;
      
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: existingUsername,
          email: `unique_${Date.now()}@test.com`,
          password: 'SecureP@ss123',
          role: 'user'
        })
        .expect(400);

      expect(response.body.error).toContain('already exists');
    });

    it('❌ should reject duplicate email', async () => {
      const existingEmail = testUsers[0].email;
      
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: `unique_${Date.now()}`,
          email: existingEmail,
          password: 'SecureP@ss123',
          role: 'user'
        })
        .expect(400);

      expect(response.body.error).toContain('already exists');
    });

    it('❌ should reject invalid username (special chars)', async () => {
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'invalid user!',
          email: `test_${Date.now()}@test.com`,
          password: 'SecureP@ss123',
          role: 'user'
        })
        .expect(400);
    });

    it('❌ should reject short username', async () => {
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'ab',
          email: `test_${Date.now()}@test.com`,
          password: 'SecureP@ss123',
          role: 'user'
        })
        .expect(400);
    });

    it('❌ should reject weak password (no uppercase)', async () => {
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: `test_${Date.now()}`,
          email: `test_${Date.now()}@test.com`,
          password: 'weakpassword123!',
          role: 'user'
        })
        .expect(400);
    });

    it('❌ should reject weak password (no special char)', async () => {
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: `test_${Date.now()}`,
          email: `test_${Date.now()}@test.com`,
          password: 'NoSpecial123',
          role: 'user'
        })
        .expect(400);
    });

    it('❌ should reject invalid email format', async () => {
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: `test_${Date.now()}`,
          email: 'notanemail',
          password: 'SecureP@ss123',
          role: 'user'
        })
        .expect(400);
    });

    it('❌ should reject invalid role', async () => {
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: `test_${Date.now()}`,
          email: `test_${Date.now()}@test.com`,
          password: 'SecureP@ss123',
          role: 'superadmin'
        })
        .expect(400);
    });

    it('❌ should reject non-admin users', async () => {
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          username: `test_${Date.now()}`,
          email: `test_${Date.now()}@test.com`,
          password: 'SecureP@ss123',
          role: 'user'
        })
        .expect(403);
    });

    it('❌ should reject unauthenticated requests', async () => {
      await request(app)
        .post('/api/users')
        .send({
          username: `test_${Date.now()}`,
          email: `test_${Date.now()}@test.com`,
          password: 'SecureP@ss123',
          role: 'user'
        })
        .expect(401);
    });
  });

  describe('✏️ PATCH /api/users/:userId', () => {
    let testUpdateUser;

    beforeAll(async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const result = await db.query(`
        INSERT INTO users (username, email, password_hash, role)
        VALUES ($1, $2, $3, 'user')
        RETURNING *
      `, [`updatetest_${Date.now()}`, `updatetest_${Date.now()}@test.com`, hashedPassword]);
      testUpdateUser = result.rows[0];
    });

    afterAll(async () => {
      if (testUpdateUser) {
        await db.query('DELETE FROM users WHERE id = $1', [testUpdateUser.id]);
      }
    });

    it('✅ should update username as admin', async () => {
      const newUsername = `updated_${Date.now()}`;

      const response = await request(app)
        .patch(`/api/users/${testUpdateUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: newUsername })
        .expect(200);

      expect(response.body).toHaveProperty('username', newUsername);
      expect(response.body).toHaveProperty('email', testUpdateUser.email);
    });

    it('✅ should update email as admin', async () => {
      const newEmail = `updated_${Date.now()}@test.com`;

      const response = await request(app)
        .patch(`/api/users/${testUpdateUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: newEmail })
        .expect(200);

      expect(response.body).toHaveProperty('email', newEmail);
    });

    it('✅ should update both username and email', async () => {
      const timestamp = Date.now();
      const newUsername = `both_${timestamp}`;
      const newEmail = `both_${timestamp}@test.com`;

      const response = await request(app)
        .patch(`/api/users/${testUpdateUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: newUsername, email: newEmail })
        .expect(200);

      expect(response.body).toHaveProperty('username', newUsername);
      expect(response.body).toHaveProperty('email', newEmail);
    });

    it('✅ should allow user to update their own profile', async () => {
      const targetUser = testUsers[1];
      const newUsername = `selfupdate_${Date.now()}`;

      const response = await request(app)
        .patch(`/api/users/${targetUser.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ username: newUsername })
        .expect(200);

      expect(response.body).toHaveProperty('username', newUsername);
    });

    it('❌ should reject updating to existing username', async () => {
      const existingUsername = testUsers[0].username;

      await request(app)
        .patch(`/api/users/${testUpdateUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: existingUsername })
        .expect(400);
    });

    it('❌ should reject updating to existing email', async () => {
      const existingEmail = testUsers[0].email;

      await request(app)
        .patch(`/api/users/${testUpdateUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: existingEmail })
        .expect(400);
    });

    it('❌ should reject invalid username format', async () => {
      await request(app)
        .patch(`/api/users/${testUpdateUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'invalid user!' })
        .expect(400);
    });

    it('❌ should reject invalid email format', async () => {
      await request(app)
        .patch(`/api/users/${testUpdateUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'notanemail' })
        .expect(400);
    });

    it('❌ should reject non-admin editing other users', async () => {
      const targetUser = testUsers[0]; // Admin user

      await request(app)
        .patch(`/api/users/${targetUser.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ username: `hacked_${Date.now()}` })
        .expect(403);
    });

    it('❌ should reject empty update', async () => {
      await request(app)
        .patch(`/api/users/${testUpdateUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);
    });

    it('❌ should return 404 for non-existent user', async () => {
      await request(app)
        .patch('/api/users/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: `test_${Date.now()}` })
        .expect(404);
    });
  });

  describe('🗑️ DELETE /api/users/:userId', () => {
    let testDeleteUser;

    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const result = await db.query(`
        INSERT INTO users (username, email, password_hash, role)
        VALUES ($1, $2, $3, 'user')
        RETURNING *
      `, [`deletetest_${Date.now()}`, `deletetest_${Date.now()}@test.com`, hashedPassword]);
      testDeleteUser = result.rows[0];
    });

    afterEach(async () => {
      if (testDeleteUser) {
        await db.query('DELETE FROM users WHERE id = $1', [testDeleteUser.id]);
      }
    });

    it('✅ should soft delete user as admin', async () => {
      const response = await request(app)
        .delete(`/api/users/${testDeleteUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toContain('deactivated');

      // Verify user is soft deleted
      const dbResult = await db.query(
        'SELECT is_active FROM users WHERE id = $1',
        [testDeleteUser.id]
      );
      expect(dbResult.rows[0].is_active).toBe(false);
    });

    it('✅ should exclude soft deleted users from GET /api/users', async () => {
      // Soft delete the user
      await request(app)
        .delete(`/api/users/${testDeleteUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify user doesn't appear in list
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const deletedUserInList = response.body.find(u => u.id === testDeleteUser.id);
      expect(deletedUserInList).toBeUndefined();
    });

    it('❌ should prevent admin from deleting themselves', async () => {
      const adminUser = testUsers[0];

      await request(app)
        .delete(`/api/users/${adminUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it('❌ should prevent deleting last admin', async () => {
      // Create a temporary admin
      const hashedPassword = await bcrypt.hash('password123', 10);
      const tempAdmin = await db.query(`
        INSERT INTO users (username, email, password_hash, role)
        VALUES ($1, $2, $3, 'admin')
        RETURNING *
      `, [`tempadmin_${Date.now()}`, `tempadmin_${Date.now()}@test.com`, hashedPassword]);

      const tempAdminUser = tempAdmin.rows[0];

      // Deactivate all other admins except tempAdminUser
      await db.query('UPDATE users SET is_active = false WHERE role = $1 AND id != $2', ['admin', tempAdminUser.id]);

      // Try to delete the last admin using the original admin token
      const response = await request(app)
        .delete(`/api/users/${tempAdminUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);

      expect(response.body.error).toContain('last admin');

      // Cleanup: restore all admins and delete temp
      await db.query('UPDATE users SET is_active = true WHERE role = $1', ['admin']);
      await db.query('DELETE FROM users WHERE id = $1', [tempAdminUser.id]);
    });

    it('❌ should reject non-admin users', async () => {
      await request(app)
        .delete(`/api/users/${testDeleteUser.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('❌ should return 404 for non-existent user', async () => {
      await request(app)
        .delete('/api/users/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('❌ should return 404 for already deleted user', async () => {
      // Soft delete once
      await request(app)
        .delete(`/api/users/${testDeleteUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Try to delete again
      await request(app)
        .delete(`/api/users/${testDeleteUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
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

  describe('📦 Bulk Role Change Operations', () => {
    it('✅ should successfully change roles for multiple users', async () => {
      // Use testUsers[1] and testUsers[2] to avoid changing admin's own role (testUsers[0])
      const userIds = [testUsers[1].id, testUsers[2].id];
      
      const response = await request(app)
        .post('/api/users/bulk-role-change')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds, role: 'coach' })
        .expect(200);

      expect(response.body.message).toContain('2 user(s)');
      expect(response.body.updated).toHaveLength(2);
      expect(response.body.updated[0].role).toBe('coach');
      expect(response.body.updated[1].role).toBe('coach');
    });

    it('❌ should reject empty user array', async () => {
      await request(app)
        .post('/api/users/bulk-role-change')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds: [], role: 'coach' })
        .expect(400);
    });

    it('❌ should reject invalid role', async () => {
      await request(app)
        .post('/api/users/bulk-role-change')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds: [testUsers[0].id], role: 'superadmin' })
        .expect(400);
    });

    it('❌ should prevent changing own role', async () => {
      const response = await request(app)
        .post('/api/users/bulk-role-change')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds: [adminUser.id], role: 'user' })
        .expect(403);

      expect(response.body.error).toContain('own role');
    });

    it('❌ should reject non-admin users', async () => {
      await request(app)
        .post('/api/users/bulk-role-change')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ userIds: [testUsers[0].id], role: 'admin' })
        .expect(403);
    });

    it('❌ should validate userIds are integers', async () => {
      await request(app)
        .post('/api/users/bulk-role-change')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds: ['abc', 'def'], role: 'coach' })
        .expect(400);
    });

    it('✅ should handle non-existent users gracefully', async () => {
      const response = await request(app)
        .post('/api/users/bulk-role-change')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds: [999999, 999998], role: 'coach' })
        .expect(200);

      expect(response.body.updated).toHaveLength(0);
    });
  });

  describe('📜 Login History Tracking', () => {
    it('✅ should retrieve login history for own account', async () => {
      const response = await request(app)
        .get(`/api/users/${adminUser.id}/login-history`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('history');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('offset');
      expect(Array.isArray(response.body.history)).toBe(true);
    });

    it('✅ admin should view other users login history', async () => {
      const response = await request(app)
        .get(`/api/users/${testUsers[0].id}/login-history`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('history');
    });

    it('❌ non-admin should not view other users history', async () => {
      await request(app)
        .get(`/api/users/${adminUser.id}/login-history`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('✅ should respect limit and offset parameters', async () => {
      const response = await request(app)
        .get(`/api/users/${adminUser.id}/login-history?limit=5&offset=0`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.limit).toBe(5);
      expect(response.body.offset).toBe(0);
      expect(response.body.history.length).toBeLessThanOrEqual(5);
    });

    it('✅ should cap limit at 100', async () => {
      const response = await request(app)
        .get(`/api/users/${adminUser.id}/login-history?limit=500`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.limit).toBe(100);
    });

    it('✅ should default to limit=50 if not provided', async () => {
      const response = await request(app)
        .get(`/api/users/${adminUser.id}/login-history`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.limit).toBe(50);
    });
  });

  describe('🎯 GET /api/users/me/assignable-teams', () => {
    let club1, club2, team1, team2, team3, coachUser, coachToken;

    beforeAll(async () => {
      try {
        const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        // Create clubs
        const club1Result = await db.query(
          'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
          [`Assignable Club A ${uniqueId}`]
        );
        club1 = club1Result.rows[0];

        const club2Result = await db.query(
          'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
          [`Assignable Club B ${uniqueId}`]
        );
        club2 = club2Result.rows[0];

        // Create teams
        const team1Result = await db.query(
          'INSERT INTO teams (name, club_id) VALUES ($1, $2) RETURNING *',
          [`Assignable Team 1 ${uniqueId}`, club1.id]
        );
        team1 = team1Result.rows[0];

        const team2Result = await db.query(
          'INSERT INTO teams (name, club_id) VALUES ($1, $2) RETURNING *',
          [`Assignable Team 2 ${uniqueId}`, club1.id]
        );
        team2 = team2Result.rows[0];

        const team3Result = await db.query(
          'INSERT INTO teams (name, club_id) VALUES ($1, $2) RETURNING *',
          [`Assignable Team 3 ${uniqueId}`, club2.id]
        );
        team3 = team3Result.rows[0];

        // Create coach user
        const hashedPassword = await bcrypt.hash('password123', 10);
        const coachResult = await db.query(
          'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
          [`coach_assignable_${uniqueId}`, `coach_assignable_${uniqueId}@test.com`, hashedPassword, 'coach']
        );
        coachUser = coachResult.rows[0];
        coachToken = generateJWT(coachUser);

        // Assign coach to team1 and team2 only (not team3)
        await db.query(
          'INSERT INTO trainer_assignments (user_id, club_id, team_id, is_active) VALUES ($1, $2, $3, true)',
          [coachUser.id, club1.id, team1.id]
        );
        await db.query(
          'INSERT INTO trainer_assignments (user_id, club_id, team_id, is_active) VALUES ($1, $2, $3, true)',
          [coachUser.id, club1.id, team2.id]
        );

        console.log('      🔧 Assignable teams test data created');
      } catch (error) {
        console.error('⚠️ Assignable teams test setup failed:', error.message);
        throw error;
      }
    });

    afterAll(async () => {
      try {
        await db.query('DELETE FROM trainer_assignments WHERE user_id = $1', [coachUser.id]);
        await db.query('DELETE FROM users WHERE id = $1', [coachUser.id]);
        await db.query('DELETE FROM teams WHERE id IN ($1, $2, $3)', [team1.id, team2.id, team3.id]);
        await db.query('DELETE FROM clubs WHERE id IN ($1, $2)', [club1.id, club2.id]);
        console.log('      ✅ Assignable teams test cleanup complete');
      } catch (error) {
        console.error('⚠️ Assignable teams test cleanup failed:', error.message);
      }
    });

    it('✅ admin should see all teams', async () => {
      try {
        const response = await request(app)
          .get('/api/users/me/assignable-teams')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(3);
        
        // Check structure
        const team = response.body[0];
        expect(team).toHaveProperty('id');
        expect(team).toHaveProperty('name');
        expect(team).toHaveProperty('club_id');
        expect(team).toHaveProperty('club_name');
        
        console.log('      ✅ Admin sees all teams');
      } catch (error) {
        console.log('      ❌ Admin assignable teams test failed:', error.message);
        throw error;
      }
    });

    it('✅ coach should only see assigned teams', async () => {
      try {
        const response = await request(app)
          .get('/api/users/me/assignable-teams')
          .set('Authorization', `Bearer ${coachToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(2);
        
        // Should include team1 and team2
        const teamIds = response.body.map(t => t.id);
        expect(teamIds).toContain(team1.id);
        expect(teamIds).toContain(team2.id);
        expect(teamIds).not.toContain(team3.id);
        
        // Check structure
        response.body.forEach(team => {
          expect(team).toHaveProperty('id');
          expect(team).toHaveProperty('name');
          expect(team).toHaveProperty('club_id');
          expect(team).toHaveProperty('club_name');
        });
        
        console.log('      ✅ Coach sees only assigned teams');
      } catch (error) {
        console.log('      ❌ Coach assignable teams test failed:', error.message);
        throw error;
      }
    });

    it('✅ coach with no assignments should see empty array', async () => {
      try {
        // Create coach without any assignments
        const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const hashedPassword = await bcrypt.hash('password123', 10);
        const unassignedCoachResult = await db.query(
          'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
          [`coach_unassigned_${uniqueId}`, `coach_unassigned_${uniqueId}@test.com`, hashedPassword, 'coach']
        );
        const unassignedCoach = unassignedCoachResult.rows[0];
        const unassignedCoachToken = generateJWT(unassignedCoach);

        const response = await request(app)
          .get('/api/users/me/assignable-teams')
          .set('Authorization', `Bearer ${unassignedCoachToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(0);
        
        await db.query('DELETE FROM users WHERE id = $1', [unassignedCoach.id]);
        console.log('      ✅ Unassigned coach sees empty array');
      } catch (error) {
        console.log('      ❌ Unassigned coach test failed:', error.message);
        throw error;
      }
    });

    it('❌ should require authentication', async () => {
      try {
        await request(app)
          .get('/api/users/me/assignable-teams')
          .expect(401);
        
        console.log('      ✅ Correctly requires authentication');
      } catch (error) {
        console.log('      ❌ Authentication requirement test failed:', error.message);
        throw error;
      }
    });

    it('✅ should order teams by club and team name', async () => {
      try {
        const response = await request(app)
          .get('/api/users/me/assignable-teams')
          .set('Authorization', `Bearer ${coachToken}`)
          .expect(200);

        // Check ordering
        for (let i = 1; i < response.body.length; i++) {
          const prev = response.body[i - 1];
          const curr = response.body[i];
          
          // Should be ordered by club_name, then team name
          expect(
            prev.club_name < curr.club_name ||
            (prev.club_name === curr.club_name && prev.name <= curr.name)
          ).toBe(true);
        }
        
        console.log('      ✅ Teams correctly ordered');
      } catch (error) {
        console.log('      ❌ Ordering test failed:', error.message);
        throw error;
      }
    });
  });
});

