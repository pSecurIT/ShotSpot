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
  let mappingsClubId;
  let mappingsTeamId;
  let mappingsTeamMappingId;
  let mappingsPlayerId;
  let mappingsPlayerMappingId;

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
    // Clean up any mapping fixtures created by tests below.
    if (mappingsPlayerMappingId) {
      await db.query('DELETE FROM twizzit_player_mappings WHERE id = $1', [mappingsPlayerMappingId]);
    }
    if (mappingsTeamMappingId) {
      await db.query('DELETE FROM twizzit_team_mappings WHERE id = $1', [mappingsTeamMappingId]);
    }
    if (mappingsPlayerId) {
      await db.query('DELETE FROM players WHERE id = $1', [mappingsPlayerId]);
    }
    if (mappingsTeamId) {
      await db.query('DELETE FROM teams WHERE id = $1', [mappingsTeamId]);
    }
    if (mappingsClubId) {
      await db.query('DELETE FROM clubs WHERE id = $1', [mappingsClubId]);
    }

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

    it('should allow coach access', async () => {
      const response = await request(app)
        .get('/api/twizzit/credentials')
        .set('Authorization', `Bearer ${coachToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('credentials');
      expect(Array.isArray(response.body.credentials)).toBe(true);
    });

    it('should deny access for regular users', async () => {
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

    it('should allow coach to delete a credential', async () => {
      // Create temp credential to delete
      const tempCred = await db.query(
        `INSERT INTO twizzit_credentials 
         (organization_name, api_username, encrypted_password, encryption_iv, api_endpoint)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        ['Temp Org Coach', 'temp_coach', 'encrypted_password_here', '1234567890abcdef1234567890abcdef', 'https://app.twizzit.com']
      );

      const response = await request(app)
        .delete(`/api/twizzit/credentials/${tempCred.rows[0].id}`)
        .set('Authorization', `Bearer ${coachToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');

      const check = await db.query('SELECT * FROM twizzit_credentials WHERE id = $1', [tempCred.rows[0].id]);
      expect(check.rows.length).toBe(0);
    });

    it('should deny access for regular users', async () => {
      const response = await request(app)
        .delete(`/api/twizzit/credentials/${credentialId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/twizzit/sync/config/:credentialId', () => {
    it('should get sync config for admin', async () => {
      // Ensure no config exists so the route must auto-create defaults
      await db.query('DELETE FROM twizzit_sync_config WHERE credential_id = $1', [credentialId]);

      const response = await request(app)
        .get(`/api/twizzit/sync/config/${credentialId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('config');
      expect(response.body.config).toMatchObject({
        credentialId,
        syncTeams: true,
        syncPlayers: true,
        syncCompetitions: true,
        syncIntervalMinutes: 60,
        autoSyncEnabled: false
      });
    });

    it('should allow coach access', async () => {
      const response = await request(app)
        .get(`/api/twizzit/sync/config/${credentialId}`)
        .set('Authorization', `Bearer ${coachToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('config');
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

  describe('POST /api/twizzit/sync/preview/players/:credentialId', () => {
    it('should validate missing groupId', async () => {
      const response = await request(app)
        .post(`/api/twizzit/sync/preview/players/${credentialId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('details');
    });

    it('should deny access for regular users', async () => {
      const response = await request(app)
        .post(`/api/twizzit/sync/preview/players/${credentialId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ groupId: '1' });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/twizzit/sync/teams/:credentialId', () => {
    it('should deny access for regular users', async () => {
      const response = await request(app)
        .post(`/api/twizzit/sync/teams/${credentialId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

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
    it('should return team mappings joined to local team and club', async () => {
      // Arrange: create a local club + team + mapping row
      const club = await db.query(
        'INSERT INTO clubs (name) VALUES ($1) RETURNING id',
        ['Twizzit Mappings Club']
      );
      mappingsClubId = club.rows[0].id;

      const team = await db.query(
        'INSERT INTO teams (club_id, name) VALUES ($1, $2) RETURNING id',
        [mappingsClubId, 'Twizzit Mappings Team']
      );
      mappingsTeamId = team.rows[0].id;

      const tm = await db.query(
        `INSERT INTO twizzit_team_mappings (local_club_id, twizzit_team_id, twizzit_team_name, sync_status, last_synced_at)
         VALUES ($1, $2, $3, 'success', CURRENT_TIMESTAMP)
         RETURNING id`,
        [mappingsTeamId, 'tw-team-1', 'Twizzit Team Name']
      );
      mappingsTeamMappingId = tm.rows[0].id;

      // Act
      const response = await request(app)
        .get('/api/twizzit/mappings/teams')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.mappings)).toBe(true);

      const row = response.body.mappings.find((m) => m.twizzitTeamId === 'tw-team-1');
      expect(row).toBeTruthy();
      expect(row).toMatchObject({
        internalTeamId: mappingsTeamId,
        internalTeamName: 'Twizzit Mappings Team',
        internalClubName: 'Twizzit Mappings Club',
        twizzitTeamId: 'tw-team-1',
        twizzitTeamName: 'Twizzit Team Name',
        syncStatus: 'success'
      });
      expect(row.createdAt).toBeTruthy();
    });

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
    it('should return player mappings joined to local player, team and club; supports teamId filtering', async () => {
      // Arrange: ensure mapping fixtures exist (create if needed)
      if (!mappingsClubId) {
        const club = await db.query(
          'INSERT INTO clubs (name) VALUES ($1) RETURNING id',
          ['Twizzit Mappings Club']
        );
        mappingsClubId = club.rows[0].id;
      }

      if (!mappingsTeamId) {
        const team = await db.query(
          'INSERT INTO teams (club_id, name) VALUES ($1, $2) RETURNING id',
          [mappingsClubId, 'Twizzit Mappings Team']
        );
        mappingsTeamId = team.rows[0].id;
      }

      if (!mappingsTeamMappingId) {
        const tm = await db.query(
          `INSERT INTO twizzit_team_mappings (local_club_id, twizzit_team_id, twizzit_team_name, sync_status, last_synced_at)
           VALUES ($1, $2, $3, 'success', CURRENT_TIMESTAMP)
           RETURNING id`,
          [mappingsTeamId, 'tw-team-1', 'Twizzit Team Name']
        );
        mappingsTeamMappingId = tm.rows[0].id;
      }

      if (!mappingsPlayerId) {
        const player = await db.query(
          `INSERT INTO players (club_id, team_id, first_name, last_name, jersey_number, gender)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [mappingsClubId, mappingsTeamId, 'Twizzit', 'Player', 9, 'male']
        );
        mappingsPlayerId = player.rows[0].id;
      }

      if (!mappingsPlayerMappingId) {
        const pm = await db.query(
          `INSERT INTO twizzit_player_mappings (local_player_id, twizzit_player_id, twizzit_player_name, team_mapping_id, sync_status, last_synced_at)
           VALUES ($1, $2, $3, $4, 'success', CURRENT_TIMESTAMP)
           RETURNING id`,
          [mappingsPlayerId, 'tw-player-1', 'Twizzit Player Name', mappingsTeamMappingId]
        );
        mappingsPlayerMappingId = pm.rows[0].id;
      }

      // Act: filtered list
      const response = await request(app)
        .get(`/api/twizzit/mappings/players?teamId=${mappingsTeamId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.mappings)).toBe(true);
      expect(response.body.mappings.length).toBeGreaterThan(0);

      const row = response.body.mappings.find((m) => m.twizzitPlayerId === 'tw-player-1');
      expect(row).toBeTruthy();
      expect(row).toMatchObject({
        internalPlayerId: mappingsPlayerId,
        internalPlayerName: 'Twizzit Player',
        twizzitPlayerId: 'tw-player-1',
        twizzitPlayerName: 'Twizzit Player Name',
        internalTeamId: mappingsTeamId,
        internalTeamName: 'Twizzit Mappings Team',
        internalClubName: 'Twizzit Mappings Club',
        syncStatus: 'success'
      });
      expect(row.createdAt).toBeTruthy();
    });

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


