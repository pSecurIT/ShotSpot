import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import { generateTestToken } from './helpers/testHelpers.js';

describe('📊 Report Templates Routes', () => {
  let adminToken;
  let coachToken;
  let viewerToken;
  let testTemplateId;

  beforeAll(async () => {
    console.log('🔧 Setting up Report Templates tests...');
    adminToken = generateTestToken('admin');
    coachToken = generateTestToken('coach');
    viewerToken = generateTestToken('viewer');
  });

  beforeEach(async () => {
    try {
      // Clear test data
      await db.query('DELETE FROM report_exports');
      await db.query('DELETE FROM scheduled_reports');
      await db.query('DELETE FROM export_settings');
      await db.query('DELETE FROM report_templates WHERE is_default = false');
    } catch (error) {
      global.testContext.logTestError(error, 'Database cleanup failed');
      throw error;
    }
  });

  afterAll(async () => {
    console.log('✅ Report Templates tests completed');
  });

  describe('📋 GET /api/report-templates - Get All Templates', () => {
    it('✅ should return default templates for authenticated users', async () => {
      try {
        const response = await request(app)
          .get('/api/report-templates')
          .set('Authorization', `Bearer ${viewerToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        
        // All returned templates should be default templates for regular users
        response.body.forEach(template => {
          expect(template).toHaveProperty('id');
          expect(template).toHaveProperty('name');
          expect(template).toHaveProperty('type');
          expect(template).toHaveProperty('is_default');
        });
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to get default templates');
        throw error;
      }
    });

    it('✅ should filter templates by type', async () => {
      try {
        const response = await request(app)
          .get('/api/report-templates?type=summary')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        response.body.forEach(template => {
          expect(template.type).toBe('summary');
        });
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to filter templates by type');
        throw error;
      }
    });

    it('✅ should require authentication', async () => {
      try {
        await request(app)
          .get('/api/report-templates')
          .expect(401);
      } catch (error) {
        global.testContext.logTestError(error, 'Authentication check failed');
        throw error;
      }
    });
  });

  describe('🆕 POST /api/report-templates - Create Custom Template', () => {
    it('✅ should allow coaches to create custom templates', async () => {
      try {
        const templateData = {
          name: 'My Custom Template',
          type: 'custom',
          description: 'A custom template for my needs',
          sections: ['game_info', 'shot_chart', 'player_stats'],
          metrics: ['goals', 'field_goal_percentage'],
          branding: { primary_color: '#ff0000' }
        };

        const response = await request(app)
          .post('/api/report-templates')
          .set('Authorization', `Bearer ${coachToken}`)
          .send(templateData)
          .expect('Content-Type', /json/)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.name).toBe(templateData.name);
        expect(response.body.type).toBe(templateData.type);
        expect(response.body.is_default).toBe(false);
        expect(response.body.is_active).toBe(true);

        testTemplateId = response.body.id;
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to create custom template');
        throw error;
      }
    });

    it('✅ should allow admins to create custom templates', async () => {
      try {
        const templateData = {
          name: 'Admin Custom Template',
          type: 'custom',
          description: 'Admin template',
          sections: ['game_info'],
          metrics: ['goals']
        };

        const response = await request(app)
          .post('/api/report-templates')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(templateData)
          .expect('Content-Type', /json/)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.name).toBe(templateData.name);
      } catch (error) {
        global.testContext.logTestError(error, 'Admin failed to create template');
        throw error;
      }
    });

    it('❌ should not allow regular users to create templates', async () => {
      try {
        const templateData = {
          name: 'Viewer Template',
          type: 'custom',
          sections: ['game_info'],
          metrics: ['goals']
        };

        await request(app)
          .post('/api/report-templates')
          .set('Authorization', `Bearer ${viewerToken}`)
          .send(templateData)
          .expect(403);
      } catch (error) {
        global.testContext.logTestError(error, 'User role check failed');
        throw error;
      }
    });

    it('❌ should validate required fields', async () => {
      try {
        await request(app)
          .post('/api/report-templates')
          .set('Authorization', `Bearer ${coachToken}`)
          .send({
            name: 'Test',
            type: 'custom'
            // Missing sections and metrics
          })
          .expect(400);
      } catch (error) {
        global.testContext.logTestError(error, 'Validation check failed');
        throw error;
      }
    });
  });

  describe('📝 PUT /api/report-templates/:id - Update Template', () => {
    beforeEach(async () => {
      // Create a test user
      const userResult = await db.query(`
        INSERT INTO users (username, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
        RETURNING id
      `, ['testcoach', 'testcoach@test.com', '$2b$10$test', 'coach']);
      const userId = userResult.rows[0].id;
      
      // Create a test template
      const result = await db.query(`
        INSERT INTO report_templates (
          name, type, is_default, is_active, created_by,
          sections, metrics
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        'Test Template',
        'custom',
        false,
        true,
        userId,
        JSON.stringify(['game_info']),
        JSON.stringify(['goals'])
      ]);
      testTemplateId = result.rows[0].id;
    });

    it('✅ should allow creator to update their template', async () => {
      try {
        const updates = {
          name: 'Updated Template Name',
          description: 'Updated description'
        };

        const response = await request(app)
          .put(`/api/report-templates/${testTemplateId}`)
          .set('Authorization', `Bearer ${coachToken}`)
          .send(updates)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body.name).toBe(updates.name);
        expect(response.body.description).toBe(updates.description);
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to update template');
        throw error;
      }
    });

    it('❌ should not allow updating default templates', async () => {
      try {
        // Get a default template ID
        const defaultTemplate = await db.query(
          'SELECT id FROM report_templates WHERE is_default = true LIMIT 1'
        );
        
        if (defaultTemplate.rows.length > 0) {
          await request(app)
            .put(`/api/report-templates/${defaultTemplate.rows[0].id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Modified Default' })
            .expect(403);
        }
      } catch (error) {
        global.testContext.logTestError(error, 'Default template protection failed');
        throw error;
      }
    });

    it('❌ should return 404 for non-existent template', async () => {
      try {
        await request(app)
          .put('/api/report-templates/99999')
          .set('Authorization', `Bearer ${coachToken}`)
          .send({ name: 'Updated' })
          .expect(404);
      } catch (error) {
        global.testContext.logTestError(error, '404 check failed');
        throw error;
      }
    });
  });

  describe('🗑️ DELETE /api/report-templates/:id - Delete Template', () => {
    beforeEach(async () => {
      // Create a test user
      const userResult = await db.query(`
        INSERT INTO users (username, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
        RETURNING id
      `, ['testcoach2', 'testcoach2@test.com', '$2b$10$test', 'coach']);
      const userId = userResult.rows[0].id;
      
      // Create a test template
      const result = await db.query(`
        INSERT INTO report_templates (
          name, type, is_default, is_active, created_by,
          sections, metrics
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        'Deletable Template',
        'custom',
        false,
        true,
        userId,
        JSON.stringify(['game_info']),
        JSON.stringify(['goals'])
      ]);
      testTemplateId = result.rows[0].id;
    });

    it('✅ should allow creator to delete their template', async () => {
      try {
        await request(app)
          .delete(`/api/report-templates/${testTemplateId}`)
          .set('Authorization', `Bearer ${coachToken}`)
          .expect(200);

        // Verify deletion
        const check = await db.query(
          'SELECT id FROM report_templates WHERE id = $1',
          [testTemplateId]
        );
        expect(check.rows.length).toBe(0);
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to delete template');
        throw error;
      }
    });

    it('❌ should not allow deleting default templates', async () => {
      try {
        // Get a default template ID
        const defaultTemplate = await db.query(
          'SELECT id FROM report_templates WHERE is_default = true LIMIT 1'
        );
        
        if (defaultTemplate.rows.length > 0) {
          await request(app)
            .delete(`/api/report-templates/${defaultTemplate.rows[0].id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(403);
        }
      } catch (error) {
        global.testContext.logTestError(error, 'Default template deletion check failed');
        throw error;
      }
    });

    it('❌ should return 404 for non-existent template', async () => {
      try {
        await request(app)
          .delete('/api/report-templates/99999')
          .set('Authorization', `Bearer ${coachToken}`)
          .expect(404);
      } catch (error) {
        global.testContext.logTestError(error, '404 check failed');
        throw error;
      }
    });
  });

  describe('🔍 GET /api/report-templates/:id - Get Single Template', () => {
    it('✅ should return template details', async () => {
      try {
        // Get a default template
        const templates = await db.query(
          'SELECT id FROM report_templates WHERE is_default = true LIMIT 1'
        );
        
        if (templates.rows.length > 0) {
          const templateId = templates.rows[0].id;
          
          const response = await request(app)
            .get(`/api/report-templates/${templateId}`)
            .set('Authorization', `Bearer ${viewerToken}`)
            .expect('Content-Type', /json/)
            .expect(200);

          expect(response.body).toHaveProperty('id');
          expect(response.body.id).toBe(templateId);
        }
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to get single template');
        throw error;
      }
    });

    it('❌ should return 404 for non-existent template', async () => {
      try {
        await request(app)
          .get('/api/report-templates/99999')
          .set('Authorization', `Bearer ${viewerToken}`)
          .expect(404);
      } catch (error) {
        global.testContext.logTestError(error, '404 check failed');
        throw error;
      }
    });
  });
});
