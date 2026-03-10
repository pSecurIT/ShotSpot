import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

describe('🎮 Games API', () => {
  let authToken;
  let coachToken;
  let userToken;
  let adminUser;
  let coachUser;
  let regularUser;
  let club1;
  let club2;

  beforeAll(async () => {
    console.log('🔧 Setting up Games API tests...');
    try {
      // Use unique identifiers to prevent conflicts in CI
      const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Create test users with different roles and unique names
      const adminResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [`admin_games_${uniqueId}`, `admin_games_${uniqueId}@test.com`, 'hash', 'admin']
      );
      adminUser = adminResult.rows[0];
      authToken = jwt.sign({ userId: adminUser.id, role: 'admin' }, process.env.JWT_SECRET);

      const coachResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [`coach_games_${uniqueId}`, `coach_games_${uniqueId}@test.com`, 'hash', 'coach']
      );
      coachUser = coachResult.rows[0];
      coachToken = jwt.sign({ userId: coachUser.id, role: 'coach' }, process.env.JWT_SECRET);

      const userResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [`user_games_${uniqueId}`, `user_games_${uniqueId}@test.com`, 'hash', 'user']
      );
      regularUser = userResult.rows[0];
      userToken = jwt.sign({ userId: regularUser.id, role: 'user' }, process.env.JWT_SECRET);

      // Validate tokens were created successfully
      if (!authToken || !coachToken || !userToken) {
        throw new Error('Failed to create one or more JWT tokens for test users');
      }

      // Create test clubs with unique names
      const club1Result = await db.query(
        'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
        [`Test Club Alpha ${uniqueId}`]
      );
      club1 = club1Result.rows[0];

      const club2Result = await db.query(
        'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
        [`Test Club Beta ${uniqueId}`]
      );
      club2 = club2Result.rows[0];

      // Create trainer_assignments for the coach to both clubs
      // This is required for coach access to games involving these clubs
      await db.query(
        'INSERT INTO trainer_assignments (user_id, club_id, is_active) VALUES ($1, $2, true)',
        [coachUser.id, club1.id]
      );
      await db.query(
        'INSERT INTO trainer_assignments (user_id, club_id, is_active) VALUES ($1, $2, true)',
        [coachUser.id, club2.id]
      );
    } catch (error) {
      global.testContext.logTestError(error, 'Games API setup failed');
      throw error;
    }
  });

  afterAll(async () => {
    console.log('✅ Games API tests completed');
    try {
      // Clean up test data
      await db.query('DELETE FROM games WHERE home_club_id IN ($1, $2) OR away_club_id IN ($1, $2)', [club1.id, club2.id]);
      await db.query('DELETE FROM trainer_assignments WHERE user_id = $1', [coachUser.id]);
      await db.query('DELETE FROM clubs WHERE id IN ($1, $2)', [club1.id, club2.id]);
      await db.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [adminUser.id, coachUser.id, regularUser.id]);
    } catch (error) {
      console.error('⚠️ Games API cleanup failed:', error.message);
    }
    // Note: Don't call db.end() as it's a singleton that might be needed by other tests
  });

  describe('📝 POST /api/games', () => {
    it('✅ should create a new game with admin token', async () => {
      try {
        const gameData = {
          home_club_id: club1.id,
          away_club_id: club2.id,
          date: new Date('2025-11-01T14:00:00Z').toISOString()
        };

        const response = await request(app)
          .post('/api/games')
          .set('Authorization', `Bearer ${authToken}`)
          .send(gameData);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body.home_club_id).toBe(club1.id);
        expect(response.body.away_club_id).toBe(club2.id);
        expect(response.body.home_club_name).toBe(club1.name);
        expect(response.body.away_club_name).toBe(club2.name);
        expect(response.body.status).toBe('scheduled');
        expect(response.body.home_score).toBe(0);
        expect(response.body.away_score).toBe(0);
      } catch (error) {
        global.testContext.logTestError(error, 'POST create game with admin token failed');
        throw error;
      }
    });

    it('✅ should create a new game with coach token', async () => {
      try {
        const gameData = {
          home_club_id: club1.id,
          away_club_id: club2.id,
          date: new Date('2025-11-02T14:00:00Z').toISOString()
        };

        const response = await request(app)
          .post('/api/games')
          .set('Authorization', `Bearer ${coachToken}`)
          .send(gameData);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
      } catch (error) {
        global.testContext.logTestError(error, 'POST create game with coach token failed');
        throw error;
      }
    });

    it('❌ should reject creation with regular user token', async () => {
      try {
        const gameData = {
          home_club_id: club1.id,
          away_club_id: club2.id,
          date: new Date('2025-11-03T14:00:00Z').toISOString()
        };

        const response = await request(app)
          .post('/api/games')
          .set('Authorization', `Bearer ${userToken}`)
          .send(gameData);

        expect(response.status).toBe(403);
      } catch (error) {
        global.testContext.logTestError(error, 'POST user authorization rejection failed');
        throw error;
      }
    });

    it('❌ should reject creation without authentication', async () => {
      try {
        const gameData = {
          home_club_id: club1.id,
          away_club_id: club2.id,
          date: new Date('2025-11-04T14:00:00Z').toISOString()
        };

        const response = await request(app)
          .post('/api/games')
          .send(gameData);

        expect(response.status).toBe(401);
      } catch (error) {
        global.testContext.logTestError(error, 'POST unauthenticated request rejection failed');
        throw error;
      }
    });

    it('❌ should reject when home and away teams are the same', async () => {
      try {
        const gameData = {
          home_club_id: club1.id,
          away_club_id: club1.id,
          date: new Date('2025-11-05T14:00:00Z').toISOString()
        };

        const response = await request(app)
          .post('/api/games')
          .set('Authorization', `Bearer ${authToken}`)
          .send(gameData);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('different');
      } catch (error) {
        global.testContext.logTestError(error, 'POST same team validation failed');
        throw error;
      }
    });

    it('❌ should reject when teams do not exist', async () => {
      try {
        const gameData = {
          home_club_id: 99999,
          away_club_id: 99998,
          date: new Date('2025-11-06T14:00:00Z').toISOString()
        };

        const response = await request(app)
          .post('/api/games')
          .set('Authorization', `Bearer ${authToken}`)
          .send(gameData);

        expect(response.status).toBe(404);
        expect(response.body.error).toContain('not found');
      } catch (error) {
        global.testContext.logTestError(error, 'POST non-existent teams validation failed');
        throw error;
      }
    });

    it('❌ should reject invalid date format', async () => {
      try {
        const gameData = {
          home_club_id: club1.id,
          away_club_id: club2.id,
          date: 'invalid-date'
        };

        const response = await request(app)
          .post('/api/games')
          .set('Authorization', `Bearer ${authToken}`)
          .send(gameData);

        expect(response.status).toBe(400);
      } catch (error) {
        global.testContext.logTestError(error, 'POST invalid date format validation failed');
        throw error;
      }
    });
  });

  describe('📊 GET /api/games', () => {
    let _scheduledGame;
    let _inProgressGame;
    let _completedGame;

    beforeAll(async () => {
      // Create games with different statuses
      const scheduled = await db.query(
        `INSERT INTO games (home_club_id, away_club_id, date, status)
         VALUES ($1, $2, $3, 'scheduled') RETURNING *`,
        [club1.id, club2.id, new Date('2025-12-01T14:00:00Z')]
      );
      _scheduledGame = scheduled.rows[0];

      const inProgress = await db.query(
        `INSERT INTO games (home_club_id, away_club_id, date, status)
         VALUES ($1, $2, $3, 'in_progress') RETURNING *`,
        [club1.id, club2.id, new Date('2025-12-02T14:00:00Z')]
      );
      _inProgressGame = inProgress.rows[0];

      const completed = await db.query(
        `INSERT INTO games (home_club_id, away_club_id, date, status, home_score, away_score)
         VALUES ($1, $2, $3, 'completed', 15, 12) RETURNING *`,
        [club1.id, club2.id, new Date('2025-11-30T14:00:00Z')]
      );
      _completedGame = completed.rows[0];
    });

    it('✅ should support limit and sort=recent query params', async () => {
      const response = await request(app)
        .get('/api/games')
        .query({ limit: 2, sort: 'recent' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(2);
    });

    it('✅ should support status=upcoming pseudo-status', async () => {
      // Insert a future scheduled game
      const futureGame = await db.query(
        `INSERT INTO games (home_club_id, away_club_id, date, status)
         VALUES ($1, $2, $3, 'scheduled') RETURNING *`,
        [club1.id, club2.id, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
      );

      const response = await request(app)
        .get('/api/games')
        .query({ status: 'upcoming' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.some((g) => g.id === futureGame.rows[0].id)).toBe(true);

      await db.query('DELETE FROM games WHERE id = $1', [futureGame.rows[0].id]);
    });

    it('✅ should get all games', async () => {
      try {
        const response = await request(app)
          .get('/api/games')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(3);
        
        // Check that games include team names
        const game = response.body[0];
        expect(game).toHaveProperty('home_club_name');
        expect(game).toHaveProperty('away_club_name');
      } catch (error) {
        global.testContext.logTestError(error, 'GET all games failed');
        throw error;
      }
    });

    it('✅ should filter games by status', async () => {
      try {
        const response = await request(app)
          .get('/api/games?status=in_progress')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        response.body.forEach(game => {
          expect(game.status).toBe('in_progress');
        });
      } catch (error) {
        global.testContext.logTestError(error, 'GET games by status filter failed');
        throw error;
      }
    });

    it('✅ should filter games by team', async () => {
      try {
        const response = await request(app)
          .get(`/api/games?club_id=${club1.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        response.body.forEach(game => {
          expect(
            game.home_club_id === club1.id || game.away_club_id === club1.id
          ).toBe(true);
        });
      } catch (error) {
        global.testContext.logTestError(error, 'GET games by team filter failed');
        throw error;
      }
    });

    it('❌ should reject invalid status filter', async () => {
      try {
        const response = await request(app)
          .get('/api/games?status=invalid_status')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(400);
      } catch (error) {
        global.testContext.logTestError(error, 'GET invalid status filter rejection failed');
        throw error;
      }
    });
  });

  describe('📊 GET /api/games/:id', () => {
    let testGame;

    beforeAll(async () => {
      const result = await db.query(
        `INSERT INTO games (home_club_id, away_club_id, date, status)
         VALUES ($1, $2, $3, 'scheduled') RETURNING *`,
        [club1.id, club2.id, new Date('2025-12-10T14:00:00Z')]
      );
      testGame = result.rows[0];
    });

    it('✅ should get a specific game by ID', async () => {
      try {
        const response = await request(app)
          .get(`/api/games/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.id).toBe(testGame.id);
        expect(response.body).toHaveProperty('home_club_name');
        expect(response.body).toHaveProperty('away_club_name');
      } catch (error) {
        global.testContext.logTestError(error, 'GET game by ID failed');
        throw error;
      }
    });

    it('❌ should return 404 for non-existent game', async () => {
      try {
        const response = await request(app)
          .get('/api/games/99999')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(404);
      } catch (error) {
        global.testContext.logTestError(error, 'GET non-existent game 404 failed');
        throw error;
      }
    });
  });

  describe('🚀 POST /api/games/:id/start', () => {
    let testGame;

    beforeEach(async () => {
      const result = await db.query(
        `INSERT INTO games (home_club_id, away_club_id, date, status)
         VALUES ($1, $2, $3, 'scheduled') RETURNING *`,
        [club1.id, club2.id, new Date('2025-12-15T14:00:00Z')]
      );
      testGame = result.rows[0];
    });

    it('✅ should start a scheduled game', async () => {
      try {
        const response = await request(app)
          .post(`/api/games/${testGame.id}/start`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('in_progress');
      } catch (error) {
        global.testContext.logTestError(error, 'POST start scheduled game failed');
        throw error;
      }
    });

    it('❌ should reject starting an already in-progress game', async () => {
      try {
        // Start the game first
        await request(app)
          .post(`/api/games/${testGame.id}/start`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json');

        // Try to start again
        const response = await request(app)
          .post(`/api/games/${testGame.id}/start`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json');

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('already in progress');
      } catch (error) {
        global.testContext.logTestError(error, 'POST start in-progress game rejection failed');
        throw error;
      }
    });

    it('❌ should require coach or admin role', async () => {
      try {
        const response = await request(app)
          .post(`/api/games/${testGame.id}/start`)
          .set('Authorization', `Bearer ${userToken}`)
          .set('Content-Type', 'application/json');

        expect(response.status).toBe(403);
      } catch (error) {
        global.testContext.logTestError(error, 'POST start game user authorization rejection failed');
        throw error;
      }
    });
  });

  describe('🏁 POST /api/games/:id/end', () => {
    let testGame;

    beforeEach(async () => {
      const result = await db.query(
        `INSERT INTO games (home_club_id, away_club_id, date, status)
         VALUES ($1, $2, $3, 'in_progress') RETURNING *`,
        [club1.id, club2.id, new Date('2025-12-16T14:00:00Z')]
      );
      testGame = result.rows[0];
    });

    it('✅ should end an in-progress game', async () => {
      try {
        const response = await request(app)
          .post(`/api/games/${testGame.id}/end`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('completed');
      } catch (error) {
        global.testContext.logTestError(error, 'POST end in-progress game failed');
        throw error;
      }
    });

    it('❌ should reject ending an already completed game', async () => {
      try {
        // End the game first
        await request(app)
          .post(`/api/games/${testGame.id}/end`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json');

        // Try to end again
        const response = await request(app)
          .post(`/api/games/${testGame.id}/end`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json');

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('already completed');
      } catch (error) {
        global.testContext.logTestError(error, 'POST end completed game rejection failed');
        throw error;
      }
    });
  });

  describe('❌ POST /api/games/:id/cancel', () => {
    let testGame;

    beforeEach(async () => {
      const result = await db.query(
        `INSERT INTO games (home_club_id, away_club_id, date, status)
         VALUES ($1, $2, $3, 'scheduled') RETURNING *`,
        [club1.id, club2.id, new Date('2025-12-17T14:00:00Z')]
      );
      testGame = result.rows[0];
    });

    it('✅ should cancel a scheduled game', async () => {
      try {
        const response = await request(app)
          .post(`/api/games/${testGame.id}/cancel`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('cancelled');
      } catch (error) {
        global.testContext.logTestError(error, 'POST cancel scheduled game failed');
        throw error;
      }
    });

    it('❌ should reject cancelling a completed game', async () => {
      try {
        // Complete the game first
        await db.query(
          'UPDATE games SET status = \'completed\' WHERE id = $1',
          [testGame.id]
        );

        const response = await request(app)
          .post(`/api/games/${testGame.id}/cancel`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json');

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Cannot cancel a completed game');
      } catch (error) {
        global.testContext.logTestError(error, 'POST cancel completed game rejection failed');
        throw error;
      }
    });
  });

  describe('✏️ PUT /api/games/:id', () => {
    let testGame;

    beforeEach(async () => {
      const result = await db.query(
        `INSERT INTO games (home_club_id, away_club_id, date, status)
         VALUES ($1, $2, $3, 'scheduled') RETURNING *`,
        [club1.id, club2.id, new Date('2025-12-18T14:00:00Z')]
      );
      testGame = result.rows[0];
    });

    it('✅ should update game scores', async () => {
      try {
        const response = await request(app)
          .put(`/api/games/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            home_score: 10,
            away_score: 8
          });

        expect(response.status).toBe(200);
        expect(response.body.home_score).toBe(10);
        expect(response.body.away_score).toBe(8);
      } catch (error) {
        global.testContext.logTestError(error, 'PUT update game scores failed');
        throw error;
      }
    });

    it('✅ should update game status', async () => {
      try {
        const response = await request(app)
          .put(`/api/games/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            status: 'in_progress'
          });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('in_progress');
      } catch (error) {
        global.testContext.logTestError(error, 'PUT update game status failed');
        throw error;
      }
    });

    it('❌ should reject negative scores', async () => {
      try {
        const response = await request(app)
          .put(`/api/games/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            home_score: -5
          });

        expect(response.status).toBe(400);
      } catch (error) {
        global.testContext.logTestError(error, 'PUT negative score validation failed');
        throw error;
      }
    });
  });

  describe('🗑️ DELETE /api/games/:id', () => {
    let testGame;

    beforeEach(async () => {
      const result = await db.query(
        `INSERT INTO games (home_club_id, away_club_id, date, status)
         VALUES ($1, $2, $3, 'scheduled') RETURNING *`,
        [club1.id, club2.id, new Date('2025-12-19T14:00:00Z')]
      );
      testGame = result.rows[0];
    });

    it('✅ should delete a game as admin', async () => {
      try {
        const response = await request(app)
          .delete(`/api/games/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(204);

        // Verify game is deleted
        const checkResponse = await request(app)
          .get(`/api/games/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(checkResponse.status).toBe(404);
      } catch (error) {
        global.testContext.logTestError(error, 'DELETE game as admin failed');
        throw error;
      }
    });

    it('✅ should allow deletion by coach', async () => {
      try {
        const response = await request(app)
          .delete(`/api/games/${testGame.id}`)
          .set('Authorization', `Bearer ${coachToken}`);

        expect(response.status).toBe(204);
        
        // Verify game was deleted
        const checkResponse = await request(app)
          .get(`/api/games/${testGame.id}`)
          .set('Authorization', `Bearer ${coachToken}`);
        
        expect(checkResponse.status).toBe(404);
      } catch (error) {
        global.testContext.logTestError(error, 'DELETE game as coach failed');
        throw error;
      }
    });

    it('❌ should reject deletion by regular user', async () => {
      try {
        const response = await request(app)
          .delete(`/api/games/${testGame.id}`)
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(403);
      } catch (error) {
        global.testContext.logTestError(error, 'DELETE game user authorization rejection failed');
        throw error;
      }
    });
  });

  describe('📅 POST /api/games/:id/reschedule', () => {
    let testGame;

    beforeEach(async () => {
      const result = await db.query(
        `INSERT INTO games (home_club_id, away_club_id, date, status)
         VALUES ($1, $2, $3, 'scheduled') RETURNING *`,
        [club1.id, club2.id, new Date('2025-12-20T14:00:00Z')]
      );
      testGame = result.rows[0];
    });

    it('✅ should mark game as to_reschedule without date', async () => {
      try {
        const response = await request(app)
          .post(`/api/games/${testGame.id}/reschedule`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send({});

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('to_reschedule');
        expect(response.body.date).toBe(testGame.date.toISOString());
      } catch (error) {
        global.testContext.logTestError(error, 'POST reschedule game without date failed');
        throw error;
      }
    });

    it('✅ should reschedule game to specific date', async () => {
      try {
        const newDate = '2025-12-25T15:00:00Z';
        const response = await request(app)
          .post(`/api/games/${testGame.id}/reschedule`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send({ game_date: newDate });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('scheduled');
        expect(new Date(response.body.date).getTime()).toBe(new Date(newDate).getTime());
      } catch (error) {
        global.testContext.logTestError(error, 'POST reschedule game to specific date failed');
        throw error;
      }
    });

    it('✅ should allow reschedule by coach', async () => {
      try {
        const response = await request(app)
          .post(`/api/games/${testGame.id}/reschedule`)
          .set('Authorization', `Bearer ${coachToken}`)
          .set('Content-Type', 'application/json')
          .send({});

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('to_reschedule');
      } catch (error) {
        global.testContext.logTestError(error, 'POST reschedule game as coach failed');
        throw error;
      }
    });

    it('❌ should reject rescheduling completed game', async () => {
      try {
        await db.query(
          'UPDATE games SET status = \'completed\' WHERE id = $1',
          [testGame.id]
        );

        const response = await request(app)
          .post(`/api/games/${testGame.id}/reschedule`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Cannot reschedule a completed game');
      } catch (error) {
        global.testContext.logTestError(error, 'POST reschedule completed game rejection failed');
        throw error;
      }
    });

    it('❌ should reject rescheduling in_progress game', async () => {
      try {
        await db.query(
          'UPDATE games SET status = \'in_progress\' WHERE id = $1',
          [testGame.id]
        );

        const response = await request(app)
          .post(`/api/games/${testGame.id}/reschedule`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Cannot reschedule a game in progress');
      } catch (error) {
        global.testContext.logTestError(error, 'POST reschedule in-progress game rejection failed');
        throw error;
      }
    });

    it('❌ should reject invalid date format', async () => {
      try {
        const response = await request(app)
          .post(`/api/games/${testGame.id}/reschedule`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send({ game_date: 'invalid-date' });

        expect(response.status).toBe(400);
      } catch (error) {
        global.testContext.logTestError(error, 'POST reschedule invalid date format rejection failed');
        throw error;
      }
    });

    it('❌ should reject reschedule by regular user', async () => {
      try {
        const response = await request(app)
          .post(`/api/games/${testGame.id}/reschedule`)
          .set('Authorization', `Bearer ${userToken}`)
          .set('Content-Type', 'application/json')
          .send({});

        expect(response.status).toBe(403);
      } catch (error) {
        global.testContext.logTestError(error, 'POST reschedule user authorization rejection failed');
        throw error;
      }
    });
  });

  describe('🏀 Practice Match Support', () => {
    let team1, team2;

    beforeAll(async () => {
      try {
        // Create teams for practice match testing
        const team1Result = await db.query(
          'INSERT INTO teams (name, club_id) VALUES ($1, $2) RETURNING *',
          ['Practice Team A', club1.id]
        );
        team1 = team1Result.rows[0];

        const team2Result = await db.query(
          'INSERT INTO teams (name, club_id) VALUES ($1, $2) RETURNING *',
          ['Practice Team B', club1.id]
        );
        team2 = team2Result.rows[0];
      } catch (error) {
        console.error('⚠️ Practice match test setup failed:', error.message);
        throw error;
      }
    });

    afterAll(async () => {
      try {
        await db.query('DELETE FROM teams WHERE id IN ($1, $2)', [team1.id, team2.id]);
      } catch (error) {
        console.error('⚠️ Practice match test cleanup failed:', error.message);
      }
    });

    it('✅ should allow creating practice match with same club (team-level)', async () => {
      try {
        const gameData = {
          home_club_id: club1.id,
          away_club_id: club1.id, // Same club
          home_team_id: team1.id,
          away_team_id: team2.id,
          date: new Date('2026-03-15T14:00:00Z').toISOString()
        };

        const response = await request(app)
          .post('/api/games')
          .set('Authorization', `Bearer ${authToken}`)
          .send(gameData);

        expect(response.status).toBe(201);
        expect(response.body.home_club_id).toBe(club1.id);
        expect(response.body.away_club_id).toBe(club1.id);
        expect(response.body.home_team_id).toBe(team1.id);
        expect(response.body.away_team_id).toBe(team2.id);
        console.log('      ✅ Practice match created successfully with same club');
      } catch (error) {
        console.log('      ❌ Practice match creation test failed:', error.message);
        global.testContext.logTestError(error, 'Practice match creation failed');
        throw error;
      }
    });

    it('✅ should allow practice match with same team (home vs away)', async () => {
      try {
        const gameData = {
          home_club_id: club1.id,
          away_club_id: club1.id,
          home_team_id: team1.id,
          away_team_id: team1.id, // Same team!
          date: new Date('2026-03-16T14:00:00Z').toISOString()
        };

        const response = await request(app)
          .post('/api/games')
          .set('Authorization', `Bearer ${authToken}`)
          .send(gameData);

        expect(response.status).toBe(201);
        expect(response.body.home_team_id).toBe(team1.id);
        expect(response.body.away_team_id).toBe(team1.id);
        console.log('      ✅ Same team practice match created successfully');
      } catch (error) {
        console.log('      ❌ Same team practice match test failed:', error.message);
        global.testContext.logTestError(error, 'Same team practice match failed');
        throw error;
      }
    });

    it('❌ should reject same club without team IDs (club-level)', async () => {
      try {
        const gameData = {
          home_club_id: club1.id,
          away_club_id: club1.id, // Same club
          // No team IDs - should fail
          date: new Date('2026-03-17T14:00:00Z').toISOString()
        };

        const response = await request(app)
          .post('/api/games')
          .set('Authorization', `Bearer ${authToken}`)
          .send(gameData);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Home and away clubs must be different');
        console.log('      ✅ Same club without teams correctly rejected');
      } catch (error) {
        console.log('      ❌ Same club rejection test failed:', error.message);
        global.testContext.logTestError(error, 'Same club rejection failed');
        throw error;
      }
    });

    it('✅ should validate club exists for practice matches', async () => {
      try {
        const gameData = {
          home_club_id: club1.id,
          away_club_id: club1.id,
          home_team_id: team1.id,
          away_team_id: team2.id,
          date: new Date('2026-03-18T14:00:00Z').toISOString()
        };

        const response = await request(app)
          .post('/api/games')
          .set('Authorization', `Bearer ${authToken}`)
          .send(gameData);

        expect(response.status).toBe(201);
        console.log('      ✅ Practice match club validation working');
      } catch (error) {
        console.log('      ❌ Practice match club validation test failed:', error.message);
        global.testContext.logTestError(error, 'Club validation failed');
        throw error;
      }
    });
  });
});


