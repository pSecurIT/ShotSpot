/**
 * Series Routes Tests
 * Belgian korfball division levels (Eerste Klasse, Tweede Klasse, etc.)
 */

import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

describe('📊 Series Routes', () => {
  let authToken;
  let adminToken;
  let testSeries1;
  let testSeries2;
  let testSeason;
  let testCompetition;

  beforeAll(async () => {
    try {
      // Create test admin user
      const adminResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        ['seriesadmin', 'admin@test.com', 'hashedpassword', 'admin']
      );
      adminToken = jwt.sign(
        { userId: adminResult.rows[0].id, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Create test coach user
      const userResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        ['seriescoach', 'coach@test.com', 'hashedpassword', 'coach']
      );
      authToken = jwt.sign(
        { userId: userResult.rows[0].id, role: 'coach' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Create test season
      const seasonResult = await db.query(
        `INSERT INTO seasons (name, start_date, end_date, season_type) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        ['2024-2025', '2024-09-01', '2025-05-31', 'indoor']
      );
      testSeason = seasonResult.rows[0];

    } catch (error) {
      global.testContext.logTestError(error, 'beforeAll failed');
      throw error;
    }
  });

  afterAll(async () => {
    try {
      await db.query('DELETE FROM competitions WHERE season_id = $1', [testSeason.id]);
      await db.query('DELETE FROM seasons WHERE id = $1', [testSeason.id]);
      await db.query('DELETE FROM series WHERE id IN ($1, $2)', [testSeries1?.id, testSeries2?.id]);
      await db.query('DELETE FROM users WHERE username IN (\'seriesadmin\', \'seriescoach\')');
    } catch (error) {
      global.testContext.logTestError(error, 'afterAll cleanup failed');
    }
  });

  describe('📝 POST /api/series', () => {
    it('✅ should create a new series as admin', async () => {
      try {
        const response = await request(app)
          .post('/api/series')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Eerste Klasse',
            level: 1
          });

        expect(response.status).toBe(201);
        expect(response.body.name).toBe('Eerste Klasse');
        expect(response.body.level).toBe(1);
        expect(response.body.id).toBeDefined();
        
        testSeries1 = response.body;
      } catch (error) {
        global.testContext.logTestError(error, 'POST series as admin failed');
        throw error;
      }
    });

    it('✅ should create another series with different level', async () => {
      try {
        const response = await request(app)
          .post('/api/series')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Tweede Klasse',
            level: 2
          });

        expect(response.status).toBe(201);
        expect(response.body.name).toBe('Tweede Klasse');
        expect(response.body.level).toBe(2);
        
        testSeries2 = response.body;
      } catch (error) {
        global.testContext.logTestError(error, 'POST second series failed');
        throw error;
      }
    });

    it('❌ should reject series creation without admin role', async () => {
      try {
        const response = await request(app)
          .post('/api/series')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Derde Klasse',
            level: 3
          });

        expect(response.status).toBe(403);
      } catch (error) {
        global.testContext.logTestError(error, 'POST series role check failed');
        throw error;
      }
    });

    it('❌ should reject duplicate level', async () => {
      try {
        const response = await request(app)
          .post('/api/series')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Another First Division',
            level: 1  // Duplicate level
          });

        expect(response.status).toBe(409);
        expect(response.body.error).toContain('level already exists');
      } catch (error) {
        global.testContext.logTestError(error, 'POST duplicate level check failed');
        throw error;
      }
    });

    it('❌ should reject invalid data', async () => {
      try {
        const response = await request(app)
          .post('/api/series')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: '',  // Empty name
            level: 0   // Invalid level
          });

        expect(response.status).toBe(400);
      } catch (error) {
        global.testContext.logTestError(error, 'POST validation check failed');
        throw error;
      }
    });
  });

  describe('📋 GET /api/series', () => {
    it('✅ should get all series ordered by level', async () => {
      try {
        const response = await request(app)
          .get('/api/series')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(2);
        
        // Check ordering
        expect(response.body[0].level).toBe(1);
        expect(response.body[1].level).toBe(2);
        
        // Check competition count field exists
        expect(response.body[0]).toHaveProperty('competition_count');
      } catch (error) {
        global.testContext.logTestError(error, 'GET all series failed');
        throw error;
      }
    });
  });

  describe('🔍 GET /api/series/:id', () => {
    it('✅ should get single series with competitions', async () => {
      try {
        const response = await request(app)
          .get(`/api/series/${testSeries1.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.id).toBe(testSeries1.id);
        expect(response.body.name).toBe('Eerste Klasse');
        expect(response.body.competitions).toBeDefined();
        expect(Array.isArray(response.body.competitions)).toBe(true);
      } catch (error) {
        global.testContext.logTestError(error, 'GET single series failed');
        throw error;
      }
    });

    it('❌ should return 404 for non-existent series', async () => {
      try {
        const response = await request(app)
          .get('/api/series/99999')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(404);
      } catch (error) {
        global.testContext.logTestError(error, 'GET non-existent series check failed');
        throw error;
      }
    });
  });

  describe('✏️ PUT /api/series/:id', () => {
    it('✅ should update series name', async () => {
      try {
        const response = await request(app)
          .put(`/api/series/${testSeries1.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Eerste Klasse A'
          });

        expect(response.status).toBe(200);
        expect(response.body.name).toBe('Eerste Klasse A');
        expect(response.body.level).toBe(1); // Unchanged
      } catch (error) {
        global.testContext.logTestError(error, 'PUT update name failed');
        throw error;
      }
    });

    it('✅ should update series level', async () => {
      try {
        const response = await request(app)
          .put(`/api/series/${testSeries1.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            level: 10
          });

        expect(response.status).toBe(200);
        expect(response.body.level).toBe(10);
        expect(response.body.name).toBe('Eerste Klasse A'); // Unchanged from previous update
      } catch (error) {
        global.testContext.logTestError(error, 'PUT update level failed');
        throw error;
      }
    });

    it('❌ should reject update without admin role', async () => {
      try {
        const response = await request(app)
          .put(`/api/series/${testSeries1.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Should Fail'
          });

        expect(response.status).toBe(403);
      } catch (error) {
        global.testContext.logTestError(error, 'PUT role check failed');
        throw error;
      }
    });

    it('❌ should reject duplicate level on update', async () => {
      try {
        const response = await request(app)
          .put(`/api/series/${testSeries1.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            level: 2  // Already used by testSeries2
          });

        expect(response.status).toBe(409);
        expect(response.body.error).toContain('level already exists');
      } catch (error) {
        global.testContext.logTestError(error, 'PUT duplicate level check failed');
        throw error;
      }
    });
  });

  describe('🗑️ DELETE /api/series/:id', () => {
    it('❌ should not delete series with competitions', async () => {
      try {
        // Create competition linked to series
        const compResult = await db.query(
          `INSERT INTO competitions (name, competition_type, start_date, season_id, series_id) 
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          ['Test League in Series', 'league', '2024-09-01', testSeason.id, testSeries2.id]
        );
        testCompetition = compResult.rows[0];

        const response = await request(app)
          .delete(`/api/series/${testSeries2.id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(409);
        expect(response.body.error).toContain('existing competitions');
        
        // Cleanup
        await db.query('DELETE FROM competitions WHERE id = $1', [testCompetition.id]);
      } catch (error) {
        global.testContext.logTestError(error, 'DELETE with competitions check failed');
        throw error;
      }
    });

    it('✅ should delete series without competitions', async () => {
      try {
        const response = await request(app)
          .delete(`/api/series/${testSeries1.id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('deleted successfully');
        
        // Verify deletion
        const checkResult = await db.query('SELECT id FROM series WHERE id = $1', [testSeries1.id]);
        expect(checkResult.rows.length).toBe(0);
      } catch (error) {
        global.testContext.logTestError(error, 'DELETE series failed');
        throw error;
      }
    });

    it('❌ should reject delete without admin role', async () => {
      try {
        const response = await request(app)
          .delete(`/api/series/${testSeries2.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(403);
      } catch (error) {
        global.testContext.logTestError(error, 'DELETE role check failed');
        throw error;
      }
    });

    it('❌ should return 404 for non-existent series', async () => {
      try {
        const response = await request(app)
          .delete('/api/series/99999')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(404);
      } catch (error) {
        global.testContext.logTestError(error, 'DELETE non-existent series check failed');
        throw error;
      }
    });
  });
});
