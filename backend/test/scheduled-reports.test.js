import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import app from '../src/app.js';
import db from '../src/db.js';
import { generateTestToken } from './helpers/testHelpers.js';

const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = path.dirname(currentFilename);
const exportsDir = path.join(currentDirname, '../exports');

const generateOtherCoachToken = () => jwt.sign(
  {
    userId: 2,
    username: 'otheruser',
    id: 2,
    role: 'coach',
    permissions: ['write'],
  },
  process.env.JWT_SECRET || 'test_jwt_secret_key_min_32_chars_long_for_testing',
  { expiresIn: '1h' }
);

describe('📅 Scheduled Reports Routes', () => {
  let coachToken;
  let adminToken;
  let templateId;
  let teamId;
  let clubId;
  let reportFilePaths;

  beforeAll(async () => {
    console.log('🔧 Setting up Scheduled Reports tests...');
    coachToken = generateTestToken('coach');
    adminToken = generateTestToken('admin');
    
    // Ensure test user exists
    try {
      await db.query(`
        INSERT INTO users (id, username, email, password_hash, role)
        VALUES (1, 'testuser', 'testuser@test.com', '$2b$10$test', 'coach')
        ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username
      `);

      await db.query(`
        INSERT INTO users (id, username, email, password_hash, role)
        VALUES (2, 'otheruser', 'otheruser@test.com', '$2b$10$test', 'coach')
        ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username
      `);
    } catch (error) {
      console.log('Test user setup:', error.message);
    }
  });

  beforeEach(async () => {
    try {
      reportFilePaths = [];

      // Clear test data
      await db.query('DELETE FROM report_exports');
      await db.query('DELETE FROM scheduled_reports');
      await db.query('DELETE FROM shots WHERE player_id IN (SELECT id FROM players WHERE first_name = \'Schedule\')');
      await db.query('DELETE FROM players WHERE first_name = \'Schedule\'');
      await db.query('DELETE FROM report_templates WHERE name = \'Scheduled Structured Template\'');
      
      const clubResult = await db.query('INSERT INTO clubs (name) VALUES ($1) RETURNING id', ['Test Club']);
      clubId = clubResult.rows[0].id;
      const opponentClubResult = await db.query('INSERT INTO clubs (name) VALUES ($1) RETURNING id', ['Opponent Club']);
      const opponentClubId = opponentClubResult.rows[0].id;
      const teamResult = await db.query('INSERT INTO teams (club_id, name) VALUES ($1, $2) RETURNING id', [clubId, 'Test Team']);
      teamId = teamResult.rows[0].id;

      const playerResult = await db.query(`
        INSERT INTO players (club_id, team_id, first_name, last_name, jersey_number)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [clubId, teamId, 'Schedule', 'Shooter', 7]);

      const gameResult = await db.query(`
        INSERT INTO games (home_club_id, away_club_id, date, status, home_team_id)
        VALUES ($1, $2, NOW(), 'completed', $3)
        RETURNING id
      `, [clubId, opponentClubId, teamId]);

      await db.query(`
        INSERT INTO shots (game_id, player_id, club_id, x_coord, y_coord, result, period)
        VALUES ($1, $2, $3, 12, 18, 'goal', 1), ($1, $2, $3, 8, 20, 'miss', 2)
      `, [gameResult.rows[0].id, playerResult.rows[0].id, clubId]);

      const template = await db.query(`
        INSERT INTO report_templates (name, description, type, sections, created_by, is_default, is_active)
        VALUES ($1, $2, $3, $4, $5, false, true)
        RETURNING id
      `, [
        'Scheduled Structured Template',
        'Template for scheduled report execution tests',
        'custom',
        JSON.stringify([
          { id: 'summary-1', type: 'summary', title: 'Scheduled Summary', config: { summaryFocus: 'performance' } },
          { id: 'stats-1', type: 'stats', title: 'Scheduled Metrics', config: { metrics: ['goals', 'shots', 'accuracy'] } },
        ]),
        1,
      ]);
      templateId = template.rows[0].id;
    } catch (error) {
      global.testContext.logTestError(error, 'Database setup failed');
      throw error;
    }
  });

  afterEach(async () => {
    try {
      for (const relativePath of reportFilePaths) {
        if (!relativePath) {
          continue;
        }

        await fs.unlink(path.join(exportsDir, relativePath.replace('/exports/', ''))).catch(() => {});
      }

      await db.query('DELETE FROM report_templates WHERE name = \'Scheduled Structured Template\'');
      await db.query('DELETE FROM shots WHERE player_id IN (SELECT id FROM players WHERE first_name = \'Schedule\')');
      await db.query('DELETE FROM players WHERE first_name = \'Schedule\'');
      await db.query('DELETE FROM games');
      await db.query('DELETE FROM teams WHERE id = $1', [teamId]);
      await db.query('DELETE FROM clubs WHERE name = $1', ['Opponent Club']);
      await db.query('DELETE FROM clubs WHERE name = $1', ['Test Club']);
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

    it('✅ should only return reports owned by the coach user', async () => {
      await db.query(
        `INSERT INTO scheduled_reports (name, created_by, template_id, schedule_type)
         VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
        ['Own Schedule', 1, templateId, 'weekly', 'Other Schedule', 2, templateId, 'monthly']
      );

      const response = await request(app)
        .get('/api/scheduled-reports')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Own Schedule');
    });

    it('✅ should apply active and schedule type filters', async () => {
      await db.query(
        `INSERT INTO scheduled_reports (name, created_by, template_id, schedule_type, is_active)
         VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)`,
        ['Weekly Active', 1, templateId, 'weekly', true, 'Monthly Inactive', 1, templateId, 'monthly', false]
      );

      const response = await request(app)
        .get('/api/scheduled-reports?is_active=true&schedule_type=weekly')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Weekly Active');
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

    it('❌ should validate schedule_type query params', async () => {
      const response = await request(app)
        .get('/api/scheduled-reports?schedule_type=bad-type')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(400);

      expect(response.body.error).toBe('Invalid schedule type');
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
        expect(response.body.next_run_at).toBeTruthy();
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

    it('❌ should validate recipient email addresses', async () => {
      const response = await request(app)
        .post('/api/scheduled-reports')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          name: 'Email Validation Report',
          template_id: templateId,
          schedule_type: 'weekly',
          email_recipients: ['not-an-email'],
        })
        .expect(400);

      expect(response.body.error).toBe('Invalid email address in recipients list');
    });

    it('❌ should return 404 when team does not exist', async () => {
      const response = await request(app)
        .post('/api/scheduled-reports')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          name: 'Missing Team Report',
          template_id: templateId,
          schedule_type: 'weekly',
          team_id: 999999,
        })
        .expect(404);

      expect(response.body.error).toBe('Team not found');
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

    it('❌ should return 404 for invalid team_id', async () => {
      await request(app)
        .put(`/api/scheduled-reports/${reportId}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ team_id: 999999 })
        .expect(404)
        .expect((response) => {
          expect(response.body.error).toBe('Team not found');
        });
    });

    it('❌ should reject updates from a different coach user', async () => {
      const otherCoachToken = generateOtherCoachToken();

      const response = await request(app)
        .put(`/api/scheduled-reports/${reportId}`)
        .set('Authorization', `Bearer ${otherCoachToken}`)
        .send({ name: 'Unauthorized Update' })
        .expect(403);

      expect(response.body.error).toBe('You do not have permission to update this scheduled report');
    });

    it('❌ should reject update requests with no valid fields', async () => {
      const response = await request(app)
        .put(`/api/scheduled-reports/${reportId}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('No valid fields to update');
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

    it('❌ should reject deletes from a different coach user', async () => {
      const otherCoachToken = generateOtherCoachToken();

      const response = await request(app)
        .delete(`/api/scheduled-reports/${reportId}`)
        .set('Authorization', `Bearer ${otherCoachToken}`)
        .expect(403);

      expect(response.body.error).toBe('You do not have permission to delete this scheduled report');
    });
  });

  describe('▶️ POST /api/scheduled-reports/:id/run', () => {
    let reportId;

    beforeEach(async () => {
      const userId = 1;

      const result = await db.query(`
        INSERT INTO scheduled_reports (
          name, created_by, template_id, schedule_type, team_id, game_filters
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        'Runnable Schedule',
        userId,
        templateId,
        'weekly',
        teamId,
        JSON.stringify({
          schedule_options: { weeklyDay: 2, hour: 9, minute: 30 }
        })
      ]);

      reportId = result.rows[0].id;
    });

    it('✅ should manually run a scheduled report and update run metadata', async () => {
      const response = await request(app)
        .post(`/api/scheduled-reports/${reportId}/run`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('execution');
      expect(response.body.execution).toHaveProperty('id');
      expect(response.body.execution.report_name).toContain('Runnable Schedule');
      expect(response.body.execution.file_path).toMatch(/\.json$/);
      expect(response.body.execution.file_size_bytes).toBeGreaterThan(0);
      expect(response.body.data.sections[0].title).toBe('Scheduled Summary');
      expect(response.body.data.sections[1].data.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: 'Goals', value: 1 }),
          expect.objectContaining({ label: 'Shots', value: 2 }),
          expect.objectContaining({ label: 'Accuracy', value: '50%' }),
        ])
      );
      reportFilePaths.push(response.body.execution.file_path);

      const updatedSchedule = await db.query(
        'SELECT run_count, last_run_at FROM scheduled_reports WHERE id = $1',
        [reportId]
      );

      expect(updatedSchedule.rows[0].run_count).toBe(1);
      expect(updatedSchedule.rows[0].last_run_at).toBeTruthy();

      const exportsResult = await db.query(
        'SELECT id, file_path FROM report_exports WHERE scheduled_report_id = $1',
        [reportId]
      );

      expect(exportsResult.rows.length).toBe(1);
      expect(exportsResult.rows[0].file_path).toMatch(/\.json$/);
    });

    it('❌ should forbid running a report owned by another user', async () => {
      const otherReport = await db.query(`
        INSERT INTO scheduled_reports (
          name, created_by, template_id, schedule_type
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `, ['Other User Schedule', 2, templateId, 'weekly']);

      await request(app)
        .post(`/api/scheduled-reports/${otherReport.rows[0].id}/run`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(403);

      await request(app)
        .post(`/api/scheduled-reports/${otherReport.rows[0].id}/run`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('📜 GET /api/scheduled-reports/:id/history', () => {
    let reportId;

    beforeEach(async () => {
      const userId = 1;

      const reportResult = await db.query(`
        INSERT INTO scheduled_reports (
          name, created_by, template_id, schedule_type
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `, ['History Schedule', userId, templateId, 'monthly']);

      reportId = reportResult.rows[0].id;

      await db.query(`
        INSERT INTO report_exports (
          template_id,
          scheduled_report_id,
          generated_by,
          report_name,
          report_type,
          format
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [templateId, reportId, userId, 'History Export #1', 'team', 'json']);
    });

    it('✅ should return execution history for a scheduled report', async () => {
      const response = await request(app)
        .get(`/api/scheduled-reports/${reportId}/history`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('history');
      expect(Array.isArray(response.body.history)).toBe(true);
      expect(response.body.history.length).toBeGreaterThan(0);
      expect(response.body.history[0].report_name).toBe('History Export #1');
    });

    it('✅ should respect history limit query parameter', async () => {
      await db.query(`
        INSERT INTO report_exports (
          template_id,
          scheduled_report_id,
          generated_by,
          report_name,
          report_type,
          format
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [templateId, reportId, 1, 'History Export #2', 'team', 'json']);

      const response = await request(app)
        .get(`/api/scheduled-reports/${reportId}/history?limit=1`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      expect(response.body.history).toHaveLength(1);
    });

    it('❌ should forbid history access to reports owned by another user', async () => {
      const otherReport = await db.query(`
        INSERT INTO scheduled_reports (
          name, created_by, template_id, schedule_type
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `, ['Hidden History Schedule', 2, templateId, 'monthly']);

      await request(app)
        .get(`/api/scheduled-reports/${otherReport.rows[0].id}/history`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(403);
    });

    it('❌ should validate history limit bounds', async () => {
      const response = await request(app)
        .get(`/api/scheduled-reports/${reportId}/history?limit=101`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(400);

      expect(response.body.error).toBe('Limit must be between 1 and 100');
    });
  });
});


