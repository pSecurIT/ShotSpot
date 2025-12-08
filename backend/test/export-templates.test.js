/**
 * Export Templates CRUD Tests
 * Tests for creating, reading, updating, and deleting export templates
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import db from '../src/db.js';

describe('📋 Export Templates CRUD', () => {
  let adminToken, coachToken, userToken;
  let adminUser, coachUser, regularUser;
  let testTeamId;
  const uniqueId = Date.now();

  beforeAll(async () => {
    // Create test users
    const adminResult = await db.query(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES ($1, $2, $3, 'admin') RETURNING *
    `, [`templateadmin_${uniqueId}`, `templateadmin_${uniqueId}@test.com`, 'hash']);
    adminUser = adminResult.rows[0];
    adminToken = jwt.sign({ userId: adminUser.id, role: 'admin' }, process.env.JWT_SECRET);

    const coachResult = await db.query(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES ($1, $2, $3, 'coach') RETURNING *
    `, [`templatecoach_${uniqueId}`, `templatecoach_${uniqueId}@test.com`, 'hash']);
    coachUser = coachResult.rows[0];
    coachToken = jwt.sign({ userId: coachUser.id, role: 'coach' }, process.env.JWT_SECRET);

    const userResult = await db.query(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES ($1, $2, $3, 'user') RETURNING *
    `, [`templateuser_${uniqueId}`, `templateuser_${uniqueId}@test.com`, 'hash']);
    regularUser = userResult.rows[0];
    userToken = jwt.sign({ userId: regularUser.id, role: 'user' }, process.env.JWT_SECRET);

    // Create test team
    const teamResult = await db.query(`
      INSERT INTO teams (name)
      VALUES ($1) RETURNING id
    `, [`TestTeam_${uniqueId}`]);
    testTeamId = teamResult.rows[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    await db.query('DELETE FROM report_exports WHERE generated_by IN ($1, $2, $3)', 
      [adminUser.id, coachUser.id, regularUser.id]);
    await db.query('DELETE FROM report_templates WHERE created_by IN ($1, $2, $3)', 
      [adminUser.id, coachUser.id, regularUser.id]);
    await db.query('DELETE FROM teams WHERE id = $1', [testTeamId]);
    await db.query('DELETE FROM users WHERE id IN ($1, $2, $3)', 
      [adminUser.id, coachUser.id, regularUser.id]);
  });

  describe('✅ GET /api/exports/templates', () => {
    it('should return default templates and user templates', async () => {
      const response = await request(app)
        .get('/api/exports/templates')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Check structure of returned templates
      const template = response.body[0];
      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('description');
      expect(template).toHaveProperty('format');
      expect(template).toHaveProperty('options');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/exports/templates')
        .expect(401);
    });
  });

  describe('✅ POST /api/exports/templates', () => {
    it('should create a new template as coach', async () => {
      const templateData = {
        name: `Test Template ${uniqueId}`,
        description: 'Test template for automated testing',
        format: 'pdf-detailed',
        options: {
          includeCharts: true,
          includePlayerStats: true,
          includeTimeline: false
        }
      };

      const response = await request(app)
        .post('/api/exports/templates')
        .set('Authorization', `Bearer ${coachToken}`)
        .send(templateData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(templateData.name);
      expect(response.body.format).toBe(templateData.format);
    });

    it('should create a new template as admin', async () => {
      const templateData = {
        name: `Admin Template ${uniqueId}`,
        description: 'Admin test template',
        format: 'csv',
        options: {
          includeCharts: false
        }
      };

      const response = await request(app)
        .post('/api/exports/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(templateData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(templateData.name);
    });

    it('should reject template creation by regular user', async () => {
      const templateData = {
        name: `User Template ${uniqueId}`,
        description: 'Should fail',
        format: 'pdf-summary',
        options: {}
      };

      await request(app)
        .post('/api/exports/templates')
        .set('Authorization', `Bearer ${userToken}`)
        .send(templateData)
        .expect(403);
    });

    it('should validate required fields', async () => {
      await request(app)
        .post('/api/exports/templates')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({})
        .expect(400);
    });

    it('should validate format field', async () => {
      await request(app)
        .post('/api/exports/templates')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          name: 'Invalid Format',
          format: 'invalid-format'
        })
        .expect(400);
    });
  });

  describe('✅ PUT /api/exports/templates/:id', () => {
    let templateId;

    beforeEach(async () => {
      // Create a template for testing updates
      const result = await db.query(`
        INSERT INTO report_templates (name, description, type, created_by, is_default)
        VALUES ($1, $2, $3, $4, false) RETURNING id
      `, [`Update Test ${uniqueId}`, 'Test desc', 'pdf-summary', coachUser.id]);
      templateId = result.rows[0].id;
    });

    it('should update own template', async () => {
      const updates = {
        name: `Updated Template ${uniqueId}`,
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/exports/templates/${templateId}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.name).toBe(updates.name);
      expect(response.body.description).toBe(updates.description);
    });

    it('should not update another user template', async () => {
      await request(app)
        .put(`/api/exports/templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`) // Different user
        .send({ name: 'Hacked name' })
        .expect(404); // Should not find template for this user
    });

    it('should not update default template', async () => {
      // Get a default template ID
      const defaultTemplate = await db.query(
        'SELECT id FROM report_templates WHERE is_default = true LIMIT 1'
      );
      
      if (defaultTemplate.rows.length > 0) {
        await request(app)
          .put(`/api/exports/templates/${defaultTemplate.rows[0].id}`)
          .set('Authorization', `Bearer ${coachToken}`)
          .send({ name: 'Try to update default' })
          .expect(404);
      }
    });

    it('should reject invalid template ID', async () => {
      await request(app)
        .put('/api/exports/templates/99999')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ name: 'New name' })
        .expect(404);
    });
  });

  describe('✅ DELETE /api/exports/templates/:id', () => {
    let templateId;

    beforeEach(async () => {
      // Create a template for testing deletion
      const result = await db.query(`
        INSERT INTO report_templates (name, description, type, created_by, is_default)
        VALUES ($1, $2, $3, $4, false) RETURNING id
      `, [`Delete Test ${uniqueId}`, 'Test desc', 'csv', coachUser.id]);
      templateId = result.rows[0].id;
    });

    it('should delete own template', async () => {
      await request(app)
        .delete(`/api/exports/templates/${templateId}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      // Verify deletion
      const check = await db.query('SELECT id FROM report_templates WHERE id = $1', [templateId]);
      expect(check.rows.length).toBe(0);
    });

    it('should not delete another user template', async () => {
      await request(app)
        .delete(`/api/exports/templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`) // Different user
        .expect(404);

      // Verify template still exists
      const check = await db.query('SELECT id FROM report_templates WHERE id = $1', [templateId]);
      expect(check.rows.length).toBe(1);
    });

    it('should not delete default template', async () => {
      const defaultTemplate = await db.query(
        'SELECT id FROM report_templates WHERE is_default = true LIMIT 1'
      );
      
      if (defaultTemplate.rows.length > 0) {
        await request(app)
          .delete(`/api/exports/templates/${defaultTemplate.rows[0].id}`)
          .set('Authorization', `Bearer ${coachToken}`)
          .expect(404);
      }
    });
  });

  describe('✅ POST /api/exports/from-template', () => {
    let templateId;

    beforeAll(async () => {
      const result = await db.query(
        'SELECT id FROM report_templates WHERE is_default = true LIMIT 1'
      );
      templateId = result.rows[0].id;
    });

    it('should create export from template', async () => {
      const response = await request(app)
        .post('/api/exports/from-template')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          templateId,
          dataType: 'game',
          teamId: testTeamId
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('processing');
    });

    it('should reject invalid template ID', async () => {
      await request(app)
        .post('/api/exports/from-template')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          templateId: 99999,
          dataType: 'game',
          teamId: testTeamId
        })
        .expect(404);
    });

    it('should reject regular users', async () => {
      await request(app)
        .post('/api/exports/from-template')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          templateId,
          dataType: 'game'
        })
        .expect(403);
    });
  });
});
