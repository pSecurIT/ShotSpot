import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

describe('Games API', () => {
  let authToken;
  let coachToken;
  let userToken;
  let adminUser;
  let coachUser;
  let regularUser;
  let team1;
  let team2;

  beforeAll(async () => {
    // Create test users with different roles
    const adminResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      ['admin_games', 'admin_games@test.com', 'hash', 'admin']
    );
    adminUser = adminResult.rows[0];
    authToken = jwt.sign({ id: adminUser.id, role: 'admin' }, process.env.JWT_SECRET);

    const coachResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      ['coach_games', 'coach_games@test.com', 'hash', 'coach']
    );
    coachUser = coachResult.rows[0];
    coachToken = jwt.sign({ id: coachUser.id, role: 'coach' }, process.env.JWT_SECRET);

    const userResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      ['user_games', 'user_games@test.com', 'hash', 'user']
    );
    regularUser = userResult.rows[0];
    userToken = jwt.sign({ id: regularUser.id, role: 'user' }, process.env.JWT_SECRET);

    // Create test teams
    const team1Result = await db.query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING *',
      ['Test Team Alpha']
    );
    team1 = team1Result.rows[0];

    const team2Result = await db.query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING *',
      ['Test Team Beta']
    );
    team2 = team2Result.rows[0];
  });

  afterAll(async () => {
    // Clean up test data
    await db.query('DELETE FROM games WHERE home_team_id IN ($1, $2) OR away_team_id IN ($1, $2)', [team1.id, team2.id]);
    await db.query('DELETE FROM teams WHERE id IN ($1, $2)', [team1.id, team2.id]);
    await db.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [adminUser.id, coachUser.id, regularUser.id]);
    // Note: Don't call db.end() as it's a singleton that might be needed by other tests
  });

  describe('POST /api/games', () => {
    it('should create a new game with admin token', async () => {
      const gameData = {
        home_team_id: team1.id,
        away_team_id: team2.id,
        date: new Date('2025-11-01T14:00:00Z').toISOString()
      };

      const response = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${authToken}`)
        .send(gameData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.home_team_id).toBe(team1.id);
      expect(response.body.away_team_id).toBe(team2.id);
      expect(response.body.home_team_name).toBe('Test Team Alpha');
      expect(response.body.away_team_name).toBe('Test Team Beta');
      expect(response.body.status).toBe('scheduled');
      expect(response.body.home_score).toBe(0);
      expect(response.body.away_score).toBe(0);
    });

    it('should create a new game with coach token', async () => {
      const gameData = {
        home_team_id: team1.id,
        away_team_id: team2.id,
        date: new Date('2025-11-02T14:00:00Z').toISOString()
      };

      const response = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${coachToken}`)
        .send(gameData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
    });

    it('should reject creation with regular user token', async () => {
      const gameData = {
        home_team_id: team1.id,
        away_team_id: team2.id,
        date: new Date('2025-11-03T14:00:00Z').toISOString()
      };

      const response = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${userToken}`)
        .send(gameData);

      expect(response.status).toBe(403);
    });

    it('should reject creation without authentication', async () => {
      const gameData = {
        home_team_id: team1.id,
        away_team_id: team2.id,
        date: new Date('2025-11-04T14:00:00Z').toISOString()
      };

      const response = await request(app)
        .post('/api/games')
        .send(gameData);

      expect(response.status).toBe(401);
    });

    it('should reject when home and away teams are the same', async () => {
      const gameData = {
        home_team_id: team1.id,
        away_team_id: team1.id,
        date: new Date('2025-11-05T14:00:00Z').toISOString()
      };

      const response = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${authToken}`)
        .send(gameData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('different');
    });

    it('should reject when teams do not exist', async () => {
      const gameData = {
        home_team_id: 99999,
        away_team_id: 99998,
        date: new Date('2025-11-06T14:00:00Z').toISOString()
      };

      const response = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${authToken}`)
        .send(gameData);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should reject invalid date format', async () => {
      const gameData = {
        home_team_id: team1.id,
        away_team_id: team2.id,
        date: 'invalid-date'
      };

      const response = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${authToken}`)
        .send(gameData);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/games', () => {
    let _scheduledGame;
    let _inProgressGame;
    let _completedGame;

    beforeAll(async () => {
      // Create games with different statuses
      const scheduled = await db.query(
        `INSERT INTO games (home_team_id, away_team_id, date, status)
         VALUES ($1, $2, $3, 'scheduled') RETURNING *`,
        [team1.id, team2.id, new Date('2025-12-01T14:00:00Z')]
      );
      _scheduledGame = scheduled.rows[0];

      const inProgress = await db.query(
        `INSERT INTO games (home_team_id, away_team_id, date, status)
         VALUES ($1, $2, $3, 'in_progress') RETURNING *`,
        [team1.id, team2.id, new Date('2025-12-02T14:00:00Z')]
      );
      _inProgressGame = inProgress.rows[0];

      const completed = await db.query(
        `INSERT INTO games (home_team_id, away_team_id, date, status, home_score, away_score)
         VALUES ($1, $2, $3, 'completed', 15, 12) RETURNING *`,
        [team1.id, team2.id, new Date('2025-11-30T14:00:00Z')]
      );
      _completedGame = completed.rows[0];
    });

    it('should get all games', async () => {
      const response = await request(app)
        .get('/api/games')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(3);
      
      // Check that games include team names
      const game = response.body[0];
      expect(game).toHaveProperty('home_team_name');
      expect(game).toHaveProperty('away_team_name');
    });

    it('should filter games by status', async () => {
      const response = await request(app)
        .get('/api/games?status=in_progress')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach(game => {
        expect(game.status).toBe('in_progress');
      });
    });

    it('should filter games by team', async () => {
      const response = await request(app)
        .get(`/api/games?team_id=${team1.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach(game => {
        expect(
          game.home_team_id === team1.id || game.away_team_id === team1.id
        ).toBe(true);
      });
    });

    it('should reject invalid status filter', async () => {
      const response = await request(app)
        .get('/api/games?status=invalid_status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/games/:id', () => {
    let testGame;

    beforeAll(async () => {
      const result = await db.query(
        `INSERT INTO games (home_team_id, away_team_id, date, status)
         VALUES ($1, $2, $3, 'scheduled') RETURNING *`,
        [team1.id, team2.id, new Date('2025-12-10T14:00:00Z')]
      );
      testGame = result.rows[0];
    });

    it('should get a specific game by ID', async () => {
      const response = await request(app)
        .get(`/api/games/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testGame.id);
      expect(response.body).toHaveProperty('home_team_name');
      expect(response.body).toHaveProperty('away_team_name');
    });

    it('should return 404 for non-existent game', async () => {
      const response = await request(app)
        .get('/api/games/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/games/:id/start', () => {
    let testGame;

    beforeEach(async () => {
      const result = await db.query(
        `INSERT INTO games (home_team_id, away_team_id, date, status)
         VALUES ($1, $2, $3, 'scheduled') RETURNING *`,
        [team1.id, team2.id, new Date('2025-12-15T14:00:00Z')]
      );
      testGame = result.rows[0];
    });

    it('should start a scheduled game', async () => {
      const response = await request(app)
        .post(`/api/games/${testGame.id}/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('in_progress');
    });

    it('should reject starting an already in-progress game', async () => {
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
    });

    it('should require coach or admin role', async () => {
      const response = await request(app)
        .post(`/api/games/${testGame.id}/start`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/games/:id/end', () => {
    let testGame;

    beforeEach(async () => {
      const result = await db.query(
        `INSERT INTO games (home_team_id, away_team_id, date, status)
         VALUES ($1, $2, $3, 'in_progress') RETURNING *`,
        [team1.id, team2.id, new Date('2025-12-16T14:00:00Z')]
      );
      testGame = result.rows[0];
    });

    it('should end an in-progress game', async () => {
      const response = await request(app)
        .post(`/api/games/${testGame.id}/end`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');
    });

    it('should reject ending an already completed game', async () => {
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
    });
  });

  describe('POST /api/games/:id/cancel', () => {
    let testGame;

    beforeEach(async () => {
      const result = await db.query(
        `INSERT INTO games (home_team_id, away_team_id, date, status)
         VALUES ($1, $2, $3, 'scheduled') RETURNING *`,
        [team1.id, team2.id, new Date('2025-12-17T14:00:00Z')]
      );
      testGame = result.rows[0];
    });

    it('should cancel a scheduled game', async () => {
      const response = await request(app)
        .post(`/api/games/${testGame.id}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('cancelled');
    });

    it('should reject cancelling a completed game', async () => {
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
    });
  });

  describe('PUT /api/games/:id', () => {
    let testGame;

    beforeEach(async () => {
      const result = await db.query(
        `INSERT INTO games (home_team_id, away_team_id, date, status)
         VALUES ($1, $2, $3, 'scheduled') RETURNING *`,
        [team1.id, team2.id, new Date('2025-12-18T14:00:00Z')]
      );
      testGame = result.rows[0];
    });

    it('should update game scores', async () => {
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
    });

    it('should update game status', async () => {
      const response = await request(app)
        .put(`/api/games/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'in_progress'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('in_progress');
    });

    it('should reject negative scores', async () => {
      const response = await request(app)
        .put(`/api/games/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          home_score: -5
        });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/games/:id', () => {
    let testGame;

    beforeEach(async () => {
      const result = await db.query(
        `INSERT INTO games (home_team_id, away_team_id, date, status)
         VALUES ($1, $2, $3, 'scheduled') RETURNING *`,
        [team1.id, team2.id, new Date('2025-12-19T14:00:00Z')]
      );
      testGame = result.rows[0];
    });

    it('should delete a game as admin', async () => {
      const response = await request(app)
        .delete(`/api/games/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(204);

      // Verify game is deleted
      const checkResponse = await request(app)
        .get(`/api/games/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(checkResponse.status).toBe(404);
    });

    it('should allow deletion by coach', async () => {
      const response = await request(app)
        .delete(`/api/games/${testGame.id}`)
        .set('Authorization', `Bearer ${coachToken}`);

      expect(response.status).toBe(204);
      
      // Verify game was deleted
      const checkResponse = await request(app)
        .get(`/api/games/${testGame.id}`)
        .set('Authorization', `Bearer ${coachToken}`);
      
      expect(checkResponse.status).toBe(404);
    });

    it('should reject deletion by regular user', async () => {
      const response = await request(app)
        .delete(`/api/games/${testGame.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/games/:id/reschedule', () => {
    let testGame;

    beforeEach(async () => {
      const result = await db.query(
        `INSERT INTO games (home_team_id, away_team_id, date, status)
         VALUES ($1, $2, $3, 'scheduled') RETURNING *`,
        [team1.id, team2.id, new Date('2025-12-20T14:00:00Z')]
      );
      testGame = result.rows[0];
    });

    it('should mark game as to_reschedule without date', async () => {
      const response = await request(app)
        .post(`/api/games/${testGame.id}/reschedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('to_reschedule');
      expect(response.body.date).toBe(testGame.date.toISOString());
    });

    it('should reschedule game to specific date', async () => {
      const newDate = '2025-12-25T15:00:00Z';
      const response = await request(app)
        .post(`/api/games/${testGame.id}/reschedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({ game_date: newDate });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('scheduled');
      expect(new Date(response.body.date).getTime()).toBe(new Date(newDate).getTime());
    });

    it('should reject rescheduling completed game', async () => {
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
    });

    it('should reject rescheduling in_progress game', async () => {
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
    });

    it('should reject invalid date format', async () => {
      const response = await request(app)
        .post(`/api/games/${testGame.id}/reschedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({ game_date: 'invalid-date' });

      expect(response.status).toBe(400);
    });

    it('should reject reschedule by regular user', async () => {
      const response = await request(app)
        .post(`/api/games/${testGame.id}/reschedule`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'application/json')
        .send({});

      expect(response.status).toBe(403);
    });

    it('should allow reschedule by coach', async () => {
      const response = await request(app)
        .post(`/api/games/${testGame.id}/reschedule`)
        .set('Authorization', `Bearer ${coachToken}`)
        .set('Content-Type', 'application/json')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('to_reschedule');
    });
  });
});
