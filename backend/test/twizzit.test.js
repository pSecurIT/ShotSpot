import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import { encrypt, generateKey } from '../src/utils/encryption.js';
import * as twizzitAuth from '../src/services/twizzit-auth.js';
import * as twizzitSync from '../src/services/twizzit-sync.js';

// Mock the Twizzit services
jest.mock('../src/services/twizzit-auth.js');
jest.mock('../src/services/twizzit-sync.js');

describe('🔄 Twizzit Integration API', () => {
  let adminToken;
  let coachToken;
  let userToken;
  let adminUser;
  let coachUser;
  let regularUser;
  let testConfigId;
  const testOrgId = 12345;
  const encryptionKey = generateKey();

  beforeAll(async () => {
    console.log('🔧 Setting up Twizzit API tests...');
    
    // Set encryption key for tests
    process.env.TWIZZIT_ENCRYPTION_KEY = encryptionKey;
    process.env.TWIZZIT_API_BASE_URL = 'https://api.twizzit.com';

    // Create test users
    const adminResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING id, username, email, role`,
      ['twizzit_admin', 'twizzit_admin@test.com', 'hash', 'admin']
    );
    adminUser = adminResult.rows[0];

    const coachResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING id, username, email, role`,
      ['twizzit_coach', 'twizzit_coach@test.com', 'hash', 'coach']
    );
    coachUser = coachResult.rows[0];

    const userResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING id, username, email, role`,
      ['twizzit_user', 'twizzit_user@test.com', 'hash', 'user']
    );
    regularUser = userResult.rows[0];

    // Generate tokens
    const jwt = await import('jsonwebtoken');
    adminToken = jwt.default.sign(
      { userId: adminUser.id, username: adminUser.username, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    coachToken = jwt.default.sign(
      { userId: coachUser.id, username: coachUser.username, role: 'coach' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    userToken = jwt.default.sign(
      { userId: regularUser.id, username: regularUser.username, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  beforeEach(async () => {
    // Clean up Twizzit tables
    await db.query('DELETE FROM twizzit_sync_conflicts');
    await db.query('DELETE FROM twizzit_sync_log');
    await db.query('DELETE FROM twizzit_team_mapping');
    await db.query('DELETE FROM twizzit_player_mapping');
    await db.query('DELETE FROM twizzit_config');
    
    // Reset mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Clean up test data
    await db.query('DELETE FROM twizzit_sync_conflicts');
    await db.query('DELETE FROM twizzit_sync_log');
    await db.query('DELETE FROM twizzit_team_mapping');
    await db.query('DELETE FROM twizzit_player_mapping');
    await db.query('DELETE FROM twizzit_config');
    await db.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [
      adminUser.id,
      coachUser.id,
      regularUser.id
    ]);
    console.log('✅ Twizzit API tests completed');
  });

  // =====================================================
  // Configuration Routes Tests
  // =====================================================

  describe('🔐 POST /api/twizzit/configure', () => {
    it('✅ should save new Twizzit configuration as admin', async () => {
      const mockConfigId = 1;
      twizzitAuth.saveConfig.mockResolvedValue(mockConfigId);

      const response = await request(app)
        .post('/api/twizzit/configure')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          organizationId: testOrgId,
          organizationName: 'Test Organization',
          username: 'testuser',
          password: 'testpass123',
          syncEnabled: true,
          autoSyncFrequency: 'daily'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.configId).toBe(mockConfigId);
      expect(twizzitAuth.saveConfig).toHaveBeenCalledWith({
        organizationId: testOrgId,
        organizationName: 'Test Organization',
        username: 'testuser',
        password: 'testpass123',
        syncEnabled: true,
        autoSyncFrequency: 'daily'
      });
    });

    it('❌ should reject non-admin users', async () => {
      const response1 = await request(app)
        .post('/api/twizzit/configure')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          organizationId: testOrgId,
          username: 'testuser',
          password: 'testpass123'
        })
        .expect(403);
      expect(response1.body).toHaveProperty('error');

      const response2 = await request(app)
        .post('/api/twizzit/configure')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          organizationId: testOrgId,
          username: 'testuser',
          password: 'testpass123'
        })
        .expect(403);
      expect(response2.body).toHaveProperty('error');
    });

    it('❌ should reject unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/twizzit/configure')
        .send({
          organizationId: testOrgId,
          username: 'testuser',
          password: 'testpass123'
        })
        .expect(401);
      expect(response.body).toHaveProperty('error');
    });

    it('❌ should validate required fields', async () => {
      const response = await request(app)
        .post('/api/twizzit/configure')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          organizationId: testOrgId
          // Missing username and password
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('❌ should validate organizationId is integer', async () => {
      const response = await request(app)
        .post('/api/twizzit/configure')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          organizationId: 'invalid',
          username: 'testuser',
          password: 'testpass123'
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('❌ should handle saveConfig errors', async () => {
      twizzitAuth.saveConfig.mockRejectedValue(new Error('Authentication failed'));

      const response = await request(app)
        .post('/api/twizzit/configure')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          organizationId: testOrgId,
          username: 'testuser',
          password: 'wrongpass'
        })
        .expect(500);

      expect(response.body.error).toBe('Failed to save configuration');
    });
  });

  describe('🔍 GET /api/twizzit/config', () => {
    it('✅ should get specific organization config', async () => {
      const mockConfig = {
        id: 1,
        organization_id: testOrgId,
        organization_name: 'Test Org',
        sync_enabled: true,
        auto_sync_frequency: 'daily',
        last_sync_at: new Date()
      };
      twizzitAuth.getConfig.mockResolvedValue(mockConfig);

      const response = await request(app)
        .get(`/api/twizzit/config?organizationId=${testOrgId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Compare without date since it will be serialized
      expect(response.body.config.id).toBe(mockConfig.id);
      expect(response.body.config.organization_id).toBe(mockConfig.organization_id);
      expect(response.body.config.sync_enabled).toBe(mockConfig.sync_enabled);
      expect(twizzitAuth.getConfig).toHaveBeenCalledWith(testOrgId);
    });

    it('✅ should get all configs when no organizationId provided', async () => {
      const mockConfigs = [
        { id: 1, organization_id: 123, organization_name: 'Org 1' },
        { id: 2, organization_id: 456, organization_name: 'Org 2' }
      ];
      twizzitAuth.getAllConfigs.mockResolvedValue(mockConfigs);

      const response = await request(app)
        .get('/api/twizzit/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.configs).toEqual(mockConfigs);
      expect(twizzitAuth.getAllConfigs).toHaveBeenCalled();
    });

    it('❌ should reject non-admin users', async () => {
      const response = await request(app)
        .get('/api/twizzit/config')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(403);
      expect(response.body).toHaveProperty('error');
    });

    it('❌ should handle getConfig errors', async () => {
      twizzitAuth.getConfig.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get(`/api/twizzit/config?organizationId=${testOrgId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to get configuration');
    });
  });

  describe('🧪 POST /api/twizzit/test-connection', () => {
    it('✅ should test connection successfully', async () => {
      twizzitAuth.testConnection.mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/twizzit/test-connection')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'testuser',
          password: 'testpass123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(twizzitAuth.testConnection).toHaveBeenCalledWith('testuser', 'testpass123');
    });

    it('❌ should return 401 for invalid credentials', async () => {
      twizzitAuth.testConnection.mockResolvedValue({
        success: false,
        error: 'Invalid credentials'
      });

      const response = await request(app)
        .post('/api/twizzit/test-connection')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'testuser',
          password: 'wrongpass'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Authentication failed');
    });

    it('❌ should validate required fields', async () => {
      const response = await request(app)
        .post('/api/twizzit/test-connection')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'testuser'
          // Missing password
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });

  describe('🗑️ DELETE /api/twizzit/config/:organizationId', () => {
    it('✅ should delete configuration', async () => {
      const mockConfig = { id: 1, organization_id: testOrgId };
      twizzitAuth.getConfig.mockResolvedValue(mockConfig);
      twizzitAuth.deleteConfig.mockResolvedValue(true);

      const response = await request(app)
        .delete(`/api/twizzit/config/${testOrgId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(twizzitAuth.deleteConfig).toHaveBeenCalledWith(1);
    });

    it('❌ should return 404 if config not found', async () => {
      twizzitAuth.getConfig.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/twizzit/config/${testOrgId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
      expect(response.body).toHaveProperty('error');
    });

    it('❌ should reject non-admin users', async () => {
      const response = await request(app)
        .delete(`/api/twizzit/config/${testOrgId}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(403);
      expect(response.body).toHaveProperty('error');
    });
  });

  // =====================================================
  // Sync Operation Routes Tests
  // =====================================================

  describe('🔄 POST /api/twizzit/sync/players', () => {
    it('✅ should start player sync', async () => {
      const mockConfig = {
        id: 1,
        organization_id: testOrgId,
        sync_in_progress: false
      };
      twizzitAuth.getConfig.mockResolvedValue(mockConfig);
      twizzitSync.syncPlayers.mockResolvedValue({
        recordsCreated: 10,
        recordsUpdated: 5,
        recordsSkipped: 2
      });

      const response = await request(app)
        .post('/api/twizzit/sync/players')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ organizationId: testOrgId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Player sync started');
    });

    it('❌ should return 404 if config not found', async () => {
      twizzitAuth.getConfig.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/twizzit/sync/players')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ organizationId: testOrgId })
        .expect(404);
      expect(response.body).toHaveProperty('error');
    });

    it('❌ should return 409 if sync already in progress', async () => {
      const mockConfig = {
        id: 1,
        organization_id: testOrgId,
        sync_in_progress: true
      };
      twizzitAuth.getConfig.mockResolvedValue(mockConfig);

      const response = await request(app)
        .post('/api/twizzit/sync/players')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ organizationId: testOrgId })
        .expect(409);

      expect(response.body.error).toBe('Sync already in progress');
    });

    it('❌ should validate organizationId', async () => {
      const response = await request(app)
        .post('/api/twizzit/sync/players')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ organizationId: 'invalid' })
        .expect(400);
      expect(response.body).toHaveProperty('errors');
    });

    it('❌ should reject non-admin users', async () => {
      const response = await request(app)
        .post('/api/twizzit/sync/players')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ organizationId: testOrgId })
        .expect(403);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('🔄 POST /api/twizzit/sync/teams', () => {
    it('✅ should start team sync', async () => {
      const mockConfig = {
        id: 1,
        organization_id: testOrgId,
        sync_in_progress: false
      };
      twizzitAuth.getConfig.mockResolvedValue(mockConfig);
      twizzitSync.syncTeams.mockResolvedValue({
        recordsCreated: 5,
        recordsUpdated: 3,
        recordsSkipped: 1
      });

      const response = await request(app)
        .post('/api/twizzit/sync/teams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ organizationId: testOrgId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Team sync started');
    });

    it('❌ should return 409 if sync already in progress', async () => {
      const mockConfig = {
        id: 1,
        organization_id: testOrgId,
        sync_in_progress: true
      };
      twizzitAuth.getConfig.mockResolvedValue(mockConfig);

      const response = await request(app)
        .post('/api/twizzit/sync/teams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ organizationId: testOrgId })
        .expect(409);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('🔄 POST /api/twizzit/sync/full', () => {
    it('✅ should start full sync', async () => {
      const mockConfig = {
        id: 1,
        organization_id: testOrgId,
        sync_in_progress: false
      };
      twizzitAuth.getConfig.mockResolvedValue(mockConfig);
      twizzitSync.syncFull.mockResolvedValue({
        players: { recordsCreated: 10, recordsUpdated: 5 },
        teams: { recordsCreated: 5, recordsUpdated: 3 }
      });

      const response = await request(app)
        .post('/api/twizzit/sync/full')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ organizationId: testOrgId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Full sync started');
    });

    it('❌ should return 409 if sync already in progress', async () => {
      const mockConfig = {
        id: 1,
        organization_id: testOrgId,
        sync_in_progress: true
      };
      twizzitAuth.getConfig.mockResolvedValue(mockConfig);

      const response = await request(app)
        .post('/api/twizzit/sync/full')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ organizationId: testOrgId })
        .expect(409);
      expect(response.body).toHaveProperty('error');
    });
  });

  // =====================================================
  // Status and Logging Routes Tests
  // =====================================================

  describe('📊 GET /api/twizzit/status', () => {
    beforeEach(async () => {
      // Create test config
      const configResult = await db.query(
        `INSERT INTO twizzit_config (organization_id, organization_name, api_username, api_password_encrypted, sync_enabled)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [testOrgId, 'Test Org', 'testuser', encrypt('testpass', encryptionKey), true]
      );
      testConfigId = configResult.rows[0].id;
    });

    it('✅ should get sync status with latest log', async () => {
      // Insert sync log
      await db.query(
        `INSERT INTO twizzit_sync_log (config_id, sync_type, status, records_created, records_updated, started_at, completed_at)
         VALUES ($1, 'players', 'success', 10, 5, NOW() - INTERVAL '1 hour', NOW())`,
        [testConfigId]
      );

      const mockConfig = {
        id: testConfigId,
        organization_id: testOrgId,
        organization_name: 'Test Org',
        sync_enabled: true,
        auto_sync_frequency: 'daily',
        sync_in_progress: false,
        last_sync_at: new Date()
      };
      twizzitAuth.getConfig.mockResolvedValue(mockConfig);

      const response = await request(app)
        .get(`/api/twizzit/status?organizationId=${testOrgId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.config).toBeDefined();
      expect(response.body.latestSync).toBeDefined();
      expect(response.body.latestSync.sync_type).toBe('players');
      expect(response.body.latestSync.status).toBe('success');
      expect(response.body.pendingConflicts).toBe(0);
    });

    it('✅ should count pending conflicts', async () => {
      // Insert conflict
      await db.query(
        `INSERT INTO twizzit_sync_conflicts (config_id, entity_type, shotspot_id, twizzit_id, conflict_type, resolution)
         VALUES ($1, 'player', 1, 123, 'duplicate', 'pending')`,
        [testConfigId]
      );

      const mockConfig = {
        id: testConfigId,
        organization_id: testOrgId,
        sync_enabled: true
      };
      twizzitAuth.getConfig.mockResolvedValue(mockConfig);

      const response = await request(app)
        .get(`/api/twizzit/status?organizationId=${testOrgId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.pendingConflicts).toBe(1);
    });

    it('❌ should return 404 if config not found', async () => {
      twizzitAuth.getConfig.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/twizzit/status?organizationId=${testOrgId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('📋 GET /api/twizzit/logs', () => {
    beforeEach(async () => {
      // Create test config
      const configResult = await db.query(
        `INSERT INTO twizzit_config (organization_id, organization_name, api_username, api_password_encrypted, sync_enabled)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [testOrgId, 'Test Org', 'testuser', encrypt('testpass', encryptionKey), true]
      );
      testConfigId = configResult.rows[0].id;
    });

    it('✅ should get paginated sync logs', async () => {
      // Insert multiple logs
      for (let i = 0; i < 5; i++) {
        await db.query(
          `INSERT INTO twizzit_sync_log (config_id, sync_type, status, records_created, started_at, completed_at)
           VALUES ($1, 'players', 'success', $2, NOW() - INTERVAL '${i} hours', NOW() - INTERVAL '${i} hours' + INTERVAL '5 minutes')`,
          [testConfigId, i * 2]
        );
      }

      const mockConfig = { id: testConfigId };
      twizzitAuth.getConfig.mockResolvedValue(mockConfig);

      const response = await request(app)
        .get(`/api/twizzit/logs?organizationId=${testOrgId}&limit=3&offset=0`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.logs).toHaveLength(3);
      expect(response.body.pagination.total).toBe(5);
      expect(response.body.pagination.limit).toBe(3);
      expect(response.body.pagination.offset).toBe(0);
      expect(response.body.pagination.hasMore).toBe(true);
    });

    it('✅ should use default pagination values', async () => {
      const mockConfig = { id: testConfigId };
      twizzitAuth.getConfig.mockResolvedValue(mockConfig);

      const response = await request(app)
        .get(`/api/twizzit/logs?organizationId=${testOrgId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.pagination.limit).toBe(50);
      expect(response.body.pagination.offset).toBe(0);
    });

    it('❌ should validate limit max value', async () => {
      const response = await request(app)
        .get(`/api/twizzit/logs?organizationId=${testOrgId}&limit=200`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('📄 GET /api/twizzit/logs/:logId', () => {
    let testLogId;

    beforeEach(async () => {
      // Create test config
      const configResult = await db.query(
        `INSERT INTO twizzit_config (organization_id, organization_name, api_username, api_password_encrypted, sync_enabled)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [testOrgId, 'Test Org', 'testuser', encrypt('testpass', encryptionKey), true]
      );
      testConfigId = configResult.rows[0].id;

      // Create test log
      const logResult = await db.query(
        `INSERT INTO twizzit_sync_log (config_id, sync_type, status, records_created, errors, started_at, completed_at)
         VALUES ($1, 'players', 'partial', 10, $2, NOW(), NOW())
         RETURNING id`,
        [testConfigId, JSON.stringify([{ entity: 'player-123', error: 'Duplicate found' }])]
      );
      testLogId = logResult.rows[0].id;
    });

    it('✅ should get detailed log with errors', async () => {
      const response = await request(app)
        .get(`/api/twizzit/logs/${testLogId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.log).toBeDefined();
      expect(response.body.log.id).toBe(testLogId);
      expect(response.body.log.sync_type).toBe('players');
      expect(response.body.log.status).toBe('partial');
      expect(response.body.log.errors).toBeDefined();
    });

    it('❌ should return 404 for non-existent log', async () => {
      const response = await request(app)
        .get('/api/twizzit/logs/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('⚠️ GET /api/twizzit/conflicts', () => {
    beforeEach(async () => {
      // Create test config
      const configResult = await db.query(
        `INSERT INTO twizzit_config (organization_id, organization_name, api_username, api_password_encrypted, sync_enabled)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [testOrgId, 'Test Org', 'testuser', encrypt('testpass', encryptionKey), true]
      );
      testConfigId = configResult.rows[0].id;
    });

    it('✅ should get pending conflicts', async () => {
      // Insert conflicts
      await db.query(
        `INSERT INTO twizzit_sync_conflicts (config_id, entity_type, shotspot_id, twizzit_id, conflict_type, shotspot_data, twizzit_data, resolution)
         VALUES ($1, 'player', 1, 123, 'duplicate', $2, $3, 'pending')`,
        [
          testConfigId,
          JSON.stringify({ id: 1, name: 'John Doe' }),
          JSON.stringify({ id: 123, name: 'John Doe' })
        ]
      );

      const mockConfig = { id: testConfigId };
      twizzitAuth.getConfig.mockResolvedValue(mockConfig);

      const response = await request(app)
        .get(`/api/twizzit/conflicts?organizationId=${testOrgId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.conflicts).toHaveLength(1);
      expect(response.body.conflicts[0].entity_type).toBe('player');
      expect(response.body.conflicts[0].conflict_type).toBe('duplicate');
    });

    it('✅ should only return pending conflicts', async () => {
      // Insert resolved conflict
      await db.query(
        `INSERT INTO twizzit_sync_conflicts (config_id, entity_type, shotspot_id, twizzit_id, conflict_type, resolution)
         VALUES ($1, 'player', 1, 123, 'duplicate', 'twizzit_wins')`,
        [testConfigId]
      );

      const mockConfig = { id: testConfigId };
      twizzitAuth.getConfig.mockResolvedValue(mockConfig);

      const response = await request(app)
        .get(`/api/twizzit/conflicts?organizationId=${testOrgId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.conflicts).toHaveLength(0);
    });

    it('❌ should return 404 if config not found', async () => {
      twizzitAuth.getConfig.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/twizzit/conflicts?organizationId=${testOrgId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
      expect(response.body).toHaveProperty('error');
    });
  });
});
