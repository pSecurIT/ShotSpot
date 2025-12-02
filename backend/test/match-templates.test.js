import request from 'supertest';
import app from '../src/app.js';
import pool from '../src/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

describe('Match Templates API', () => {
  let authToken;
  let userId;
  let coachToken;
  let coachId;
  let userToken;
  let regularUserId;
  
  beforeAll(async () => {
    // Create an admin user
    const hashedPassword = await bcrypt.hash('adminpassword', 10);
    const userResult = await pool.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      ['templateadmin', 'templateadmin@test.com', hashedPassword, 'admin']
    );
    userId = userResult.rows[0].id;
    authToken = jwt.sign(
      { id: userId, username: 'templateadmin', role: 'admin' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create a coach user
    const coachResult = await pool.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      ['templatecoach', 'templatecoach@test.com', hashedPassword, 'coach']
    );
    coachId = coachResult.rows[0].id;
    coachToken = jwt.sign(
      { id: coachId, username: 'templatecoach', role: 'coach' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create a regular user
    const regularUserResult = await pool.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      ['templateuser', 'templateuser@test.com', hashedPassword, 'user']
    );
    regularUserId = regularUserResult.rows[0].id;
    userToken = jwt.sign(
      { id: regularUserId, username: 'templateuser', role: 'user' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Clean up
    await pool.query('DELETE FROM match_templates WHERE created_by IN ($1, $2, $3)', [userId, coachId, regularUserId]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [userId, coachId, regularUserId]);
    await pool.end();
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
          overtime_enabled: true,
          overtime_period_duration_minutes: 5,
          max_overtime_periods: 2,
          golden_goal_overtime: true,
          competition_type: 'cup'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.name).toBe('Test Admin Template');
      expect(res.body.number_of_periods).toBe(2);
      expect(res.body.period_duration_minutes).toBe(15);
      expect(res.body.overtime_enabled).toBe(true);
      expect(res.body.golden_goal_overtime).toBe(true);
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
        .set('Authorization', `Bearer ${authToken}`)
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
          overtime_enabled: true
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.name).toBe('Updated Template Name');
      expect(res.body.overtime_enabled).toBe(true);
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

    beforeAll(async () => {
      // Create teams
      const homeTeamRes = await pool.query(
        'INSERT INTO teams (name) VALUES ($1) RETURNING id',
        ['Template Test Home']
      );
      homeTeamId = homeTeamRes.rows[0].id;

      const awayTeamRes = await pool.query(
        'INSERT INTO teams (name) VALUES ($1) RETURNING id',
        ['Template Test Away']
      );
      awayTeamId = awayTeamRes.rows[0].id;

      // Create a game
      const gameRes = await pool.query(
        `INSERT INTO games (home_team_id, away_team_id, date, status) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [homeTeamId, awayTeamId, new Date().toISOString(), 'scheduled']
      );
      gameId = gameRes.rows[0].id;

      // Create a template
      const res = await request(app)
        .post('/api/match-templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Apply Test Template',
          number_of_periods: 2,
          period_duration_minutes: 15,
          overtime_enabled: true,
          overtime_period_duration_minutes: 7,
          max_overtime_periods: 3,
          golden_goal_overtime: true
        });
      templateId = res.body.id;
    });

    afterAll(async () => {
      await pool.query('DELETE FROM games WHERE id = $1', [gameId]);
      await pool.query('DELETE FROM teams WHERE id IN ($1, $2)', [homeTeamId, awayTeamId]);
    });

    it('should apply template to a scheduled game', async () => {
      const res = await request(app)
        .post(`/api/match-templates/${templateId}/apply-to-game/${gameId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Template applied successfully');
      expect(res.body.game.number_of_periods).toBe(2);
      expect(res.body.game.overtime_enabled).toBe(true);
      expect(res.body.game.max_overtime_periods).toBe(3);
      expect(res.body.game.golden_goal_overtime).toBe(true);
    });

    it('should not apply template to game in progress', async () => {
      // Update game to in_progress
      await pool.query('UPDATE games SET status = $1 WHERE id = $2', ['in_progress', gameId]);

      const res = await request(app)
        .post(`/api/match-templates/${templateId}/apply-to-game/${gameId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('in progress');

      // Reset game status
      await pool.query('UPDATE games SET status = $1 WHERE id = $2', ['scheduled', gameId]);
    });

    it('should return 404 for non-existent template', async () => {
      const res = await request(app)
        .post(`/api/match-templates/99999/apply-to-game/${gameId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('should return 404 for non-existent game', async () => {
      const res = await request(app)
        .post(`/api/match-templates/${templateId}/apply-to-game/99999`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
    });
  });
});
