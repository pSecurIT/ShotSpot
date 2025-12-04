import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

describe('Match Templates API', () => {
  let authToken;
  let userId;
  let coachToken;
  let coachId;
  let userToken;
  let regularUserId;
  // Unique suffix to avoid duplicate key constraint errors across test runs
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  beforeAll(async () => {
    // Create an admin user
    const hashedPassword = await bcrypt.hash('adminpassword', 10);
    const userResult = await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [`templateadmin_${uniqueSuffix}`, `templateadmin_${uniqueSuffix}@test.com`, hashedPassword, 'admin']
    );
    userId = userResult.rows[0].id;
    authToken = jwt.sign(
      { id: userId, username: `templateadmin_${uniqueSuffix}`, role: 'admin' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create a coach user
    const coachResult = await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [`templatecoach_${uniqueSuffix}`, `templatecoach_${uniqueSuffix}@test.com`, hashedPassword, 'coach']
    );
    coachId = coachResult.rows[0].id;
    coachToken = jwt.sign(
      { id: coachId, username: `templatecoach_${uniqueSuffix}`, role: 'coach' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create a regular user
    const regularUserResult = await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [`templateuser_${uniqueSuffix}`, `templateuser_${uniqueSuffix}@test.com`, hashedPassword, 'user']
    );
    regularUserId = regularUserResult.rows[0].id;
    userToken = jwt.sign(
      { id: regularUserId, username: `templateuser_${uniqueSuffix}`, role: 'user' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Seed a system template if none exist (for deterministic tests)
    await db.query(
      `INSERT INTO match_templates 
        (name, description, is_system_template, number_of_periods, period_duration_minutes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [`__CI_System_Template_${uniqueSuffix}__`, 'Seeded for tests', true, 2, 15]
    );
  });

  afterAll(async () => {
    // Clean up
    await db.query('DELETE FROM match_templates WHERE created_by IN ($1, $2, $3)', [userId, coachId, regularUserId]);
    await db.query('DELETE FROM match_templates WHERE name = $1', [`__CI_System_Template_${uniqueSuffix}__`]);
    await db.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [userId, coachId, regularUserId]);
    // Note: Don't call db.closePool() as it's a singleton that might be needed by other tests
  });

  describe('GET /api/match-templates', () => {
    it('should return system templates when authenticated', async () => {
      const res = await request(app)
        .get('/api/match-templates')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Check that system templates exist
      const systemTemplates = res.body.filter(t => t.is_system_template);
      expect(systemTemplates.length).toBeGreaterThan(0);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/match-templates');

      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/match-templates', () => {
    it('should create a new template as admin', async () => {
      const res = await request(app)
        .post('/api/match-templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Admin Template',
          description: 'A test template',
          number_of_periods: 2,
          period_duration_minutes: 15,
          competition_type: 'cup'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.name).toBe('Test Admin Template');
      expect(res.body.number_of_periods).toBe(2);
      expect(res.body.period_duration_minutes).toBe(15);
      expect(res.body.is_system_template).toBe(false);
    });

    it('should create a new template as coach', async () => {
      const res = await request(app)
        .post('/api/match-templates')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          name: 'Test Coach Template',
          description: 'A coach template',
          number_of_periods: 4,
          period_duration_minutes: 10
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.name).toBe('Test Coach Template');
      expect(res.body.created_by).toBe(coachId);
    });

    it('should reject template creation from regular user', async () => {
      const res = await request(app)
        .post('/api/match-templates')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'User Template',
          number_of_periods: 4
        });

      expect(res.statusCode).toBe(403);
    });

    it('should validate required name field', async () => {
      const res = await request(app)
        .post('/api/match-templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          number_of_periods: 4
        });

      expect(res.statusCode).toBe(400);
    });

    it('should validate number_of_periods range', async () => {
      const res = await request(app)
        .post('/api/match-templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Template',
          number_of_periods: 15 // Max is 10
        });

      expect(res.statusCode).toBe(400);
    });

    it('should validate competition_type values', async () => {
      const res = await request(app)
        .post('/api/match-templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Competition Template',
          competition_type: 'invalid_type'
        });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/match-templates/:id', () => {
    let templateId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/match-templates')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          name: 'Get Test Template',
          number_of_periods: 3
        });
      templateId = res.body.id;
    });

    it('should get a specific template by ID', async () => {
      const res = await request(app)
        .get(`/api/match-templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(templateId);
      expect(res.body.name).toBe('Get Test Template');
    });

    it('should return 404 for non-existent template', async () => {
      const res = await request(app)
        .get('/api/match-templates/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /api/match-templates/:id', () => {
    let templateId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/match-templates')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          name: 'Update Test Template',
          number_of_periods: 4
        });
      templateId = res.body.id;
    });

    it('should update own template as coach', async () => {
      const res = await request(app)
        .put(`/api/match-templates/${templateId}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          name: 'Updated Template Name',
          period_duration_minutes: 12
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.name).toBe('Updated Template Name');
      expect(res.body.period_duration_minutes).toBe(12);
    });

    it('should allow admin to update any template', async () => {
      const res = await request(app)
        .put(`/api/match-templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Admin updated this'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.description).toBe('Admin updated this');
    });

    it('should prevent coach from updating system templates', async () => {
      // Get a system template ID
      const templatesRes = await request(app)
        .get('/api/match-templates')
        .set('Authorization', `Bearer ${coachToken}`);
      
      const systemTemplate = templatesRes.body.find(t => t.is_system_template);
      
      const res = await request(app)
        .put(`/api/match-templates/${systemTemplate.id}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          name: 'Trying to update system template'
        });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('DELETE /api/match-templates/:id', () => {
    let templateId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/match-templates')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          name: 'Delete Test Template'
        });
      templateId = res.body.id;
    });

    it('should delete own template as coach', async () => {
      const res = await request(app)
        .delete(`/api/match-templates/${templateId}`)
        .set('Authorization', `Bearer ${coachToken}`);

      expect(res.statusCode).toBe(204);

      // Verify it's deleted
      const getRes = await request(app)
        .get(`/api/match-templates/${templateId}`)
        .set('Authorization', `Bearer ${coachToken}`);
      expect(getRes.statusCode).toBe(404);
    });

    it('should prevent deletion of system templates', async () => {
      const templatesRes = await request(app)
        .get('/api/match-templates')
        .set('Authorization', `Bearer ${authToken}`);
      
      const systemTemplate = templatesRes.body.find(t => t.is_system_template);
      
      const res = await request(app)
        .delete(`/api/match-templates/${systemTemplate.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /api/match-templates/:id/apply-to-game/:gameId', () => {
    let templateId;
    let gameId;
    let homeTeamId;
    let awayTeamId;
    // Use unique names to avoid duplicate key constraint errors
    const applyTestSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    beforeAll(async () => {
      // Create teams with unique names
      const homeTeamRes = await db.query(
        'INSERT INTO teams (name) VALUES ($1) RETURNING id',
        [`Template Test Home_${applyTestSuffix}`]
      );
      homeTeamId = homeTeamRes.rows[0].id;

      const awayTeamRes = await db.query(
        'INSERT INTO teams (name) VALUES ($1) RETURNING id',
        [`Template Test Away_${applyTestSuffix}`]
      );
      awayTeamId = awayTeamRes.rows[0].id;

      // Create a game
      const gameRes = await db.query(
        `INSERT INTO games (home_team_id, away_team_id, date, status) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [homeTeamId, awayTeamId, new Date().toISOString(), 'scheduled']
      );
      gameId = gameRes.rows[0].id;

      // Create a template with unique name
      const res = await request(app)
        .post('/api/match-templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: `Apply Test Template_${applyTestSuffix}`,
          number_of_periods: 2,
          period_duration_minutes: 15
        });
      templateId = res.body.id;
    });

    afterAll(async () => {
      // Clean up in order (games first, then teams, then template)
      if (gameId) {
        await db.query('DELETE FROM games WHERE id = $1', [gameId]);
      }
      if (homeTeamId && awayTeamId) {
        await db.query('DELETE FROM teams WHERE id IN ($1, $2)', [homeTeamId, awayTeamId]);
      }
      if (templateId) {
        await db.query('DELETE FROM match_templates WHERE id = $1', [templateId]);
      }
    });

    it('should apply template to a scheduled game', async () => {
      const res = await request(app)
        .post(`/api/match-templates/${templateId}/apply-to-game/${gameId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json');

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Template applied successfully');
      expect(res.body.game.number_of_periods).toBe(2);
    });

    it('should not apply template to game in progress', async () => {
      // Update game to in_progress
      await db.query('UPDATE games SET status = $1 WHERE id = $2', ['in_progress', gameId]);

      const res = await request(app)
        .post(`/api/match-templates/${templateId}/apply-to-game/${gameId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json');

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('in progress');

      // Reset game status
      await db.query('UPDATE games SET status = $1 WHERE id = $2', ['scheduled', gameId]);
    });

    it('should return 404 for non-existent template', async () => {
      const res = await request(app)
        .post(`/api/match-templates/99999/apply-to-game/${gameId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json');

      expect(res.statusCode).toBe(404);
    });

    it('should return 404 for non-existent game', async () => {
      const res = await request(app)
        .post(`/api/match-templates/${templateId}/apply-to-game/99999`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json');

      expect(res.statusCode).toBe(404);
    });
  });
});
