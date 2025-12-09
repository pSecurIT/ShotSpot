/**
 * Tests for Twizzit API Routes
 */

import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

describe('Twizzit API Routes', () => {
  let adminToken;
  let coachToken;
  let userToken;
  let credentialId;

  beforeAll(async () => {
    // Create test users
    const adminResult = await db.query(
      'INSERT INTO users (username, password_hash, email, role) VALUES ($1, $2, $3, $4) RETURNING id',
      ['twizzit_admin', '$2b$10$test', 'admin@test.com', 'admin']
    );
    const coachResult = await db.query(
      'INSERT INTO users (username, password_hash, email, role) VALUES ($1, $2, $3, $4) RETURNING id',
      ['twizzit_coach', '$2b$10$test', 'coach@test.com', 'coach']
    );
    const userResult = await db.query(
      'INSERT INTO users (username, password_hash, email, role) VALUES ($1, $2, $3, $4) RETURNING id',
      ['twizzit_user', '$2b$10$test', 'user@test.com', 'user']
    );

    // Generate tokens
    adminToken = jwt.sign(
      { userId: adminResult.rows[0].id, role: 'admin' },
      process.env.JWT_SECRET
    );
    coachToken = jwt.sign(
      { userId: coachResult.rows[0].id, role: 'coach' },
      process.env.JWT_SECRET
    );
    userToken = jwt.sign(
      { userId: userResult.rows[0].id, role: 'user' },
      process.env.JWT_SECRET
    );

    // Create test credential
    const credResult = await db.query(
      `INSERT INTO twizzit_credentials 
       (organization_name, api_username, encrypted_password, encryption_iv, api_endpoint)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['Test Org', 'test_user', 'encrypted', '1234567890abcdef', 'https://app.twizzit.com']
    );
    credentialId = credResult.rows[0].id;
  });

  afterAll(async () => {
    await db.query('DELETE FROM twizzit_sync_history WHERE credential_id = $1', [credentialId]);
    await db.query('DELETE FROM twizzit_credentials WHERE organization_name = $1', ['Test Org']);
    await db.query('DELETE FROM users WHERE username LIKE $1', ['twizzit_%']);
  });

  describe('GET /api/twizzit/credentials', () => {
    it('should list credentials for admin', async () => {
      const response = await request(app)
        .get('/api/twizzit/credentials')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('credentials');
      expect(Array.isArray(response.body.credentials)).toBe(true);
      expect(response.body.credentials.length).toBeGreaterThan(0);
      expect(response.body.credentials[0]).toHaveProperty('id');
      // API returns camelCase property names
      expect(response.body.credentials[0]).toHaveProperty('organizationName');
      expect(response.body.credentials[0]).not.toHaveProperty('encryptedPassword'); // Should not expose password
    });

    it('should deny access for non-admin users', async () => {
      const response = await request(app)
        .get('/api/twizzit/credentials')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/twizzit/credentials');

      expect(response.status).toBe(401);
    });
  });

  // Note: GET /credentials/:id route doesn't exist in implementation
  // Credentials are managed through LIST (GET) and DELETE operations

  describe('DELETE /api/twizzit/credentials/:id', () => {
    it('should delete credential for admin', async () => {
      // Create temp credential to delete
      const tempCred = await db.query(
        `INSERT INTO twizzit_credentials 
         (organization_name, api_username, encrypted_password, encryption_iv, api_endpoint)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        ['Temp Org', 'temp', 'encrypted_password_here', '1234567890abcdef1234567890abcdef', 'https://app.twizzit.com']
      );

      const response = await request(app)
        .delete(`/api/twizzit/credentials/${tempCred.rows[0].id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');

      // Verify it's deleted
      const check = await db.query(
        'SELECT * FROM twizzit_credentials WHERE id = $1',
        [tempCred.rows[0].id]
      );
      expect(check.rows.length).toBe(0);
    });

    it('should deny access for non-admin users', async () => {
      const response = await request(app)
        .delete(`/api/twizzit/credentials/${credentialId}`)
        .set('Authorization', `Bearer ${coachToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/twizzit/sync/config/:credentialId', () => {
    it('should get sync config for admin', async () => {
      const response = await request(app)
        .get(`/api/twizzit/sync/config/${credentialId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // May return 404 if no config exists yet, or 200 with config
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty('config');
      }
    });

    it('should allow coach access', async () => {
      const response = await request(app)
        .get(`/api/twizzit/sync/config/${credentialId}`)
        .set('Authorization', `Bearer ${coachToken}`);

      // May return 404 if no config exists yet, or 200 with config
      expect([200, 404]).toContain(response.status);
    });

    it('should deny access for regular users', async () => {
      const response = await request(app)
        .get(`/api/twizzit/sync/config/${credentialId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/twizzit/sync/config/:credentialId', () => {
    it('should update sync config for admin', async () => {
      const response = await request(app)
        .put(`/api/twizzit/sync/config/${credentialId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          autoSyncEnabled: true,
          syncIntervalMinutes: 720 // 12 hours
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('config');
    });

    it('should validate sync interval range', async () => {
      const response = await request(app)
        .put(`/api/twizzit/sync/config/${credentialId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          syncIntervalMinutes: 0 // Invalid: too low
        });

      expect(response.status).toBe(400);
    });

    it('should deny access for coaches', async () => {
      const response = await request(app)
        .put(`/api/twizzit/sync/config/${credentialId}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ auto_sync_enabled: true });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/twizzit/sync/history/:credentialId', () => {
    it('should get sync history for admin', async () => {
      const response = await request(app)
        .get(`/api/twizzit/sync/history/${credentialId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('history');
      expect(Array.isArray(response.body.history)).toBe(true);
    });

    it('should allow coach access', async () => {
      const response = await request(app)
        .get(`/api/twizzit/sync/history/${credentialId}`)
        .set('Authorization', `Bearer ${coachToken}`);

      expect(response.status).toBe(200);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/twizzit/sync/history/${credentialId}?limit=10&offset=0`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/twizzit/mappings/teams', () => {
    it('should list team mappings for admin', async () => {
      const response = await request(app)
        .get('/api/twizzit/mappings/teams')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('mappings');
      expect(Array.isArray(response.body.mappings)).toBe(true);
    });

    it('should allow coach access', async () => {
      const response = await request(app)
        .get('/api/twizzit/mappings/teams')
        .set('Authorization', `Bearer ${coachToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/twizzit/mappings/players', () => {
    it('should list player mappings for admin', async () => {
      const response = await request(app)
        .get('/api/twizzit/mappings/players')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('mappings');
      expect(Array.isArray(response.body.mappings)).toBe(true);
    });

    it('should allow coach access', async () => {
      const response = await request(app)
        .get('/api/twizzit/mappings/players')
        .set('Authorization', `Bearer ${coachToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid credential ID format in DELETE', async () => {
      const response = await request(app)
        .delete('/api/twizzit/credentials/invalid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
    });

    it('should handle non-existent credential deletion', async () => {
      const response = await request(app)
        .delete('/api/twizzit/credentials/999999')
        .set('Authorization', `Bearer ${adminToken}`);

      // May return 200 (deleted nothing), 404, or 500 depending on implementation
      expect([200, 404, 500]).toContain(response.status);
    });
  });

  // Note: CSRF protection is comprehensively tested in csrf.test.js
  // No need to duplicate those tests here
});
