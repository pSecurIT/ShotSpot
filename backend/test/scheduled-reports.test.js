import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import { generateTestToken } from './helpers/testHelpers.js';

describe('📅 Scheduled Reports Routes', () => {
  let coachToken;
  let templateId;
  let teamId;

  beforeAll(async () => {
    console.log('🔧 Setting up Scheduled Reports tests...');
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
      // Clear test data
      await db.query('DELETE FROM scheduled_reports');
      
      // Get a template and team for testing
      const template = await db.query('SELECT id FROM report_templates WHERE is_default = true LIMIT 1');
      templateId = template.rows[0]?.id;
      
      const teamResult = await db.query('INSERT INTO clubs (name) VALUES ($1) RETURNING id', ['Test Club']);
      teamId = teamResult.rows[0].id;
    } catch (error) {
      global.testContext.logTestError(error, 'Database setup failed');
      throw error;
    }
  });

  afterEach(async () => {
    try {
      await db.query('DELETE FROM clubs WHERE id = $1', [teamId]);
    } catch (error) {
      global.testContext.logTestError(error, 'Database cleanup failed');
    }
  });

  afterAll(async () => {
    console.log('✅ Scheduled Reports tests completed');
  });

  describe('📋 GET /api/scheduled-reports', () => {
    it('✅ should return empty array when no reports exist', async () => {
      try {
        const response = await request(app)
          .get('/api/scheduled-reports')
          .set('Authorization', `Bearer ${coachToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(0);
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to get empty scheduled reports');
        throw error;
      }
    });

    it('❌ should require authentication', async () => {
      try {
        await request(app)
          .get('/api/scheduled-reports')
          .expect(401);
      } catch (error) {
        global.testContext.logTestError(error, 'Authentication check failed');
        throw error;
      }
    });
  });

  describe('🆕 POST /api/scheduled-reports', () => {
    it('✅ should create a new scheduled report', async () => {
      try {
        const scheduleData = {
          name: 'Weekly Team Report',
          template_id: templateId,
          schedule_type: 'weekly',
          team_id: teamId,
          send_email: true,
          email_recipients: ['coach@example.com'],
          email_subject: 'Weekly Report'
        };

        const response = await request(app)
          .post('/api/scheduled-reports')
          .set('Authorization', `Bearer ${coachToken}`)
          .send(scheduleData)
          .expect('Content-Type', /json/)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.name).toBe(scheduleData.name);
        expect(response.body.schedule_type).toBe(scheduleData.schedule_type);
        expect(response.body.is_active).toBe(true);
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to create scheduled report');
        throw error;
      }
    });

    it('❌ should validate schedule_type', async () => {
      try {
        await request(app)
          .post('/api/scheduled-reports')
          .set('Authorization', `Bearer ${coachToken}`)
          .send({
            name: 'Test',
            template_id: templateId,
            schedule_type: 'invalid_type'
          })
          .expect(400);
      } catch (error) {
        global.testContext.logTestError(error, 'Schedule type validation failed');
        throw error;
      }
    });

    it('❌ should require coach or admin role', async () => {
      try {
        const viewerToken = generateTestToken('viewer');
        
        await request(app)
          .post('/api/scheduled-reports')
          .set('Authorization', `Bearer ${viewerToken}`)
          .send({
            name: 'Test Report',
            template_id: templateId,
            schedule_type: 'weekly'
          })
          .expect(403);
      } catch (error) {
        global.testContext.logTestError(error, 'Role check failed');
        throw error;
      }
    });
  });

  describe('📝 PUT /api/scheduled-reports/:id', () => {
    let reportId;

    beforeEach(async () => {
      // Use the test user that was created in beforeAll (ID 1)
      const userId = 1;
      
      const result = await db.query(`
        INSERT INTO scheduled_reports (
          name, created_by, template_id, schedule_type
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `, ['Test Schedule', userId, templateId, 'weekly']);
      reportId = result.rows[0].id;
    });

    it('✅ should update scheduled report', async () => {
      try {
        const updates = {
          name: 'Updated Schedule Name',
          is_active: false
        };

        const response = await request(app)
          .put(`/api/scheduled-reports/${reportId}`)
          .set('Authorization', `Bearer ${coachToken}`)
          .send(updates)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body.name).toBe(updates.name);
        expect(response.body.is_active).toBe(updates.is_active);
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to update scheduled report');
        throw error;
      }
    });
  });

  describe('🗑️ DELETE /api/scheduled-reports/:id', () => {
    let reportId;

    beforeEach(async () => {
      // Use the test user that was created in beforeAll (ID 1)
      const userId = 1;
      
      const result = await db.query(`
        INSERT INTO scheduled_reports (
          name, created_by, template_id, schedule_type
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `, ['Deletable Schedule', userId, templateId, 'monthly']);
      reportId = result.rows[0].id;
    });

    it('✅ should delete scheduled report', async () => {
      try {
        await request(app)
          .delete(`/api/scheduled-reports/${reportId}`)
          .set('Authorization', `Bearer ${coachToken}`)
          .expect(200);

        // Verify deletion
        const check = await db.query('SELECT id FROM scheduled_reports WHERE id = $1', [reportId]);
        expect(check.rows.length).toBe(0);
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to delete scheduled report');
        throw error;
      }
    });
  });
});


