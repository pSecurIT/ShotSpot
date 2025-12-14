import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import { generateTestToken } from './helpers/testHelpers.js';

describe('📄 Reports Routes', () => {
  let coachToken;
  let templateId;
  let gameId;
  let teamId;

  beforeAll(async () => {
    console.log('🔧 Setting up Reports tests...');
    coachToken = generateTestToken('coach');
    
    // Ensure test user exists
    try {
      await db.query(`
        INSERT INTO users (id, username, email, password_hash, role)
        VALUES (1, 'testuser', 'testuser@test.com', '$2b$10$test', 'coach')
        ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username
      `);
    } catch (error) {
      console.log('Test user setup:', error.message);
    }
  });

  beforeEach(async () => {
    try {
      // Clear test data in correct order (respecting foreign keys)
      await db.query('DELETE FROM report_exports');
      await db.query('DELETE FROM games');
      await db.query('DELETE FROM clubs');
      
      // Setup test data
      const template = await db.query('SELECT id FROM report_templates WHERE is_default = true LIMIT 1');
      templateId = template.rows[0]?.id;
      
      const club1 = await db.query('INSERT INTO clubs (name) VALUES ($1) RETURNING id', ['Home Team']);
      const club2 = await db.query('INSERT INTO clubs (name) VALUES ($1) RETURNING id', ['Away Team']);
      teamId = club1.rows[0].id;
      
      const game = await db.query(`
        INSERT INTO games (home_club_id, away_club_id, date, status)
        VALUES ($1, $2, NOW(), 'completed')
        RETURNING id
      `, [club1.rows[0].id, club2.rows[0].id]);
      gameId = game.rows[0].id;
    } catch (error) {
      global.testContext.logTestError(error, 'Database setup failed');
      throw error;
    }
  });

  afterEach(async () => {
    try {
      await db.query('DELETE FROM games WHERE id = $1', [gameId]);
      await db.query('DELETE FROM clubs');
    } catch (error) {
      global.testContext.logTestError(error, 'Database cleanup failed');
    }
  });

  afterAll(async () => {
    console.log('✅ Reports tests completed');
  });

  describe('📋 GET /api/reports', () => {
    it('✅ should return empty array when no reports exist', async () => {
      try {
        const response = await request(app)
          .get('/api/reports')
          .set('Authorization', `Bearer ${coachToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to get empty reports');
        throw error;
      }
    });

    it('❌ should require authentication', async () => {
      try {
        await request(app)
          .get('/api/reports')
          .expect(401);
      } catch (error) {
        global.testContext.logTestError(error, 'Authentication check failed');
        throw error;
      }
    });
  });

  describe('🆕 POST /api/reports/generate', () => {
    it('✅ should generate a game report', async () => {
      try {
        const reportData = {
          template_id: templateId,
          report_type: 'game',
          format: 'json',
          game_id: gameId,
          report_name: 'Test Game Report'
        };

        const response = await request(app)
          .post('/api/reports/generate')
          .set('Authorization', `Bearer ${coachToken}`)
          .send(reportData)
          .expect('Content-Type', /json/)
          .expect(201);

        expect(response.body).toHaveProperty('report');
        expect(response.body).toHaveProperty('data');
        expect(response.body.report.report_name).toBe(reportData.report_name);
        expect(response.body.report.report_type).toBe('game');
        expect(response.body.report.format).toBe('json');
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to generate game report');
        throw error;
      }
    });

    it('✅ should generate a team report', async () => {
      try {
        const reportData = {
          template_id: templateId,
          report_type: 'team',
          format: 'json',
          club_id: teamId,
          report_name: 'Test Team Report'
        };

        const response = await request(app)
          .post('/api/reports/generate')
          .set('Authorization', `Bearer ${coachToken}`)
          .send(reportData)
          .expect('Content-Type', /json/)
          .expect(201);

        expect(response.body.report.report_type).toBe('team');
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to generate team report');
        throw error;
      }
    });

    it('❌ should validate required fields', async () => {
      try {
        await request(app)
          .post('/api/reports/generate')
          .set('Authorization', `Bearer ${coachToken}`)
          .send({
            template_id: templateId,
            report_type: 'game'
            // Missing format and report_name
          })
          .expect(400);
      } catch (error) {
        global.testContext.logTestError(error, 'Validation check failed');
        throw error;
      }
    });

    it('❌ should reject invalid template_id', async () => {
      try {
        await request(app)
          .post('/api/reports/generate')
          .set('Authorization', `Bearer ${coachToken}`)
          .send({
            template_id: 99999,
            report_type: 'game',
            format: 'json',
            game_id: gameId,
            report_name: 'Test'
          })
          .expect(404);
      } catch (error) {
        global.testContext.logTestError(error, 'Template validation failed');
        throw error;
      }
    });

    it('❌ should require coach or admin role', async () => {
      try {
        const viewerToken = generateTestToken('viewer');
        
        await request(app)
          .post('/api/reports/generate')
          .set('Authorization', `Bearer ${viewerToken}`)
          .send({
            template_id: templateId,
            report_type: 'game',
            format: 'json',
            game_id: gameId,
            report_name: 'Test'
          })
          .expect(403);
      } catch (error) {
        global.testContext.logTestError(error, 'Role check failed');
        throw error;
      }
    });
  });

  describe('🔍 GET /api/reports/:id', () => {
    let reportId;

    beforeEach(async () => {
      // Use the test user that was created in beforeAll (ID 1)
      const userId = 1;
      
      const result = await db.query(`
        INSERT INTO report_exports (
          template_id, generated_by, report_name, report_type, format, game_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [templateId, userId, 'Test Report', 'game', 'json', gameId]);
      reportId = result.rows[0].id;
    });

    it('✅ should return report details', async () => {
      try {
        const response = await request(app)
          .get(`/api/reports/${reportId}`)
          .set('Authorization', `Bearer ${coachToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('id');
        expect(response.body.id).toBe(reportId);
        expect(response.body.report_name).toBe('Test Report');
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to get report details');
        throw error;
      }
    });

    it('❌ should return 404 for non-existent report', async () => {
      try {
        await request(app)
          .get('/api/reports/99999')
          .set('Authorization', `Bearer ${coachToken}`)
          .expect(404);
      } catch (error) {
        global.testContext.logTestError(error, '404 check failed');
        throw error;
      }
    });
  });

  describe('🗑️ DELETE /api/reports/:id', () => {
    let reportId;

    beforeEach(async () => {
      // Use the test user that was created in beforeAll (ID 1)
      const userId = 1;
      
      const result = await db.query(`
        INSERT INTO report_exports (
          template_id, generated_by, report_name, report_type, format
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [templateId, userId, 'Deletable Report', 'season', 'pdf']);
      reportId = result.rows[0].id;
    });

    it('✅ should delete report', async () => {
      try {
        await request(app)
          .delete(`/api/reports/${reportId}`)
          .set('Authorization', `Bearer ${coachToken}`)
          .expect(200);

        // Verify deletion
        const check = await db.query('SELECT id FROM report_exports WHERE id = $1', [reportId]);
        expect(check.rows.length).toBe(0);
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to delete report');
        throw error;
      }
    });
  });
});


