import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import { generateTestToken } from './helpers/testHelpers.js';

describe('⚙️ Export Settings Routes', () => {
  let viewerToken;
  let userId;

  beforeAll(async () => {
    console.log('🔧 Setting up Export Settings tests...');
    viewerToken = generateTestToken('viewer');
    userId = 1; // Assuming default viewer ID
    
    // Ensure test user exists
    try {
      await db.query(`
        INSERT INTO users (id, username, email, password_hash, role)
        VALUES (1, 'testuser', 'testuser@test.com', '$2b$10$test', 'viewer')
        ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username
      `);
    } catch (error) {
      console.log('Test user setup:', error.message);
    }
  });

  beforeEach(async () => {
    try {
      // Clear test data
      await db.query('DELETE FROM export_settings WHERE user_id = $1', [userId]);
    } catch (error) {
      global.testContext.logTestError(error, 'Database cleanup failed');
      throw error;
    }
  });

  afterAll(async () => {
    console.log('✅ Export Settings tests completed');
  });

  describe('📋 GET /api/export-settings - Get User Settings', () => {
    it('✅ should create default settings if none exist', async () => {
      try {
        const response = await request(app)
          .get('/api/export-settings')
          .set('Authorization', `Bearer ${viewerToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('id');
        expect(response.body.user_id).toBe(userId);
        expect(response.body.default_format).toBe('pdf');
        expect(response.body.anonymize_opponents).toBe(false);
        expect(response.body.include_sensitive_data).toBe(true);
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to get default settings');
        throw error;
      }
    });

    it('✅ should return existing settings', async () => {
      try {
        // Create settings first
        await db.query(`
          INSERT INTO export_settings (
            user_id, default_format, anonymize_opponents
          ) VALUES ($1, $2, $3)
        `, [userId, 'csv', true]);

        const response = await request(app)
          .get('/api/export-settings')
          .set('Authorization', `Bearer ${viewerToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body.default_format).toBe('csv');
        expect(response.body.anonymize_opponents).toBe(true);
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to get existing settings');
        throw error;
      }
    });

    it('❌ should require authentication', async () => {
      try {
        await request(app)
          .get('/api/export-settings')
          .expect(401);
      } catch (error) {
        global.testContext.logTestError(error, 'Authentication check failed');
        throw error;
      }
    });
  });

  describe('📝 PUT /api/export-settings - Update Settings', () => {
    it('✅ should update existing settings', async () => {
      try {
        // Create initial settings
        await db.query(`
          INSERT INTO export_settings (user_id, default_format)
          VALUES ($1, $2)
        `, [userId, 'pdf']);

        const updates = {
          default_format: 'json',
          anonymize_opponents: true,
          auto_delete_after_days: 30
        };

        const response = await request(app)
          .put('/api/export-settings')
          .set('Authorization', `Bearer ${viewerToken}`)
          .send(updates)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body.default_format).toBe(updates.default_format);
        expect(response.body.anonymize_opponents).toBe(updates.anonymize_opponents);
        expect(response.body.auto_delete_after_days).toBe(updates.auto_delete_after_days);
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to update settings');
        throw error;
      }
    });

    it('✅ should create settings if none exist', async () => {
      try {
        const newSettings = {
          default_format: 'csv',
          anonymize_opponents: true
        };

        const response = await request(app)
          .put('/api/export-settings')
          .set('Authorization', `Bearer ${viewerToken}`)
          .send(newSettings)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('id');
        expect(response.body.default_format).toBe(newSettings.default_format);
        expect(response.body.anonymize_opponents).toBe(newSettings.anonymize_opponents);
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to create settings');
        throw error;
      }
    });

    it('❌ should validate format field', async () => {
      try {
        await request(app)
          .put('/api/export-settings')
          .set('Authorization', `Bearer ${viewerToken}`)
          .send({ default_format: 'invalid_format' })
          .expect(400);
      } catch (error) {
        global.testContext.logTestError(error, 'Format validation failed');
        throw error;
      }
    });

    it('❌ should validate auto_delete_after_days', async () => {
      try {
        await request(app)
          .put('/api/export-settings')
          .set('Authorization', `Bearer ${viewerToken}`)
          .send({ auto_delete_after_days: -5 })
          .expect(400);
      } catch (error) {
        global.testContext.logTestError(error, 'Auto delete validation failed');
        throw error;
      }
    });

    it('✅ should allow null for auto_delete_after_days', async () => {
      try {
        const response = await request(app)
          .put('/api/export-settings')
          .set('Authorization', `Bearer ${viewerToken}`)
          .send({ auto_delete_after_days: null })
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body.auto_delete_after_days).toBeNull();
      } catch (error) {
        global.testContext.logTestError(error, 'Null auto_delete_after_days failed');
        throw error;
      }
    });
  });

  describe('🔄 POST /api/export-settings/reset - Reset to Defaults', () => {
    it('✅ should reset settings to defaults', async () => {
      try {
        // Create custom settings first
        await db.query(`
          INSERT INTO export_settings (
            user_id, default_format, anonymize_opponents, auto_delete_after_days
          ) VALUES ($1, $2, $3, $4)
        `, [userId, 'csv', true, 30]);

        const response = await request(app)
          .post('/api/export-settings/reset')
          .set('Authorization', `Bearer ${viewerToken}`)
          .set('Content-Type', 'application/json')
          .send({})
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body.default_format).toBe('pdf');
        expect(response.body.anonymize_opponents).toBe(false);
        expect(response.body.include_sensitive_data).toBe(true);
        expect(response.body.auto_delete_after_days).toBeNull();
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to reset settings');
        throw error;
      }
    });

    it('✅ should create default settings if none exist', async () => {
      try {
        const response = await request(app)
          .post('/api/export-settings/reset')
          .set('Authorization', `Bearer ${viewerToken}`)
          .set('Content-Type', 'application/json')
          .send({})
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('id');
        expect(response.body.default_format).toBe('pdf');
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to create default settings');
        throw error;
      }
    });
  });

  describe('🔗 Template Reference Validation', () => {
    it('✅ should allow setting valid template_id', async () => {
      try {
        // Get a default template
        const template = await db.query(
          'SELECT id FROM report_templates WHERE is_default = true LIMIT 1'
        );
        
        if (template.rows.length > 0) {
          const response = await request(app)
            .put('/api/export-settings')
            .set('Authorization', `Bearer ${viewerToken}`)
            .send({ default_template_id: template.rows[0].id })
            .expect('Content-Type', /json/)
            .expect(200);

          expect(response.body.default_template_id).toBe(template.rows[0].id);
        }
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to set valid template');
        throw error;
      }
    });

    it('❌ should reject non-existent template_id', async () => {
      try {
        await request(app)
          .put('/api/export-settings')
          .set('Authorization', `Bearer ${viewerToken}`)
          .send({ default_template_id: 99999 })
          .expect(404);
      } catch (error) {
        global.testContext.logTestError(error, 'Template validation failed');
        throw error;
      }
    });
  });
});


