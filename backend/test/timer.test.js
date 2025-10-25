import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

describe('Timer API', () => {
  let adminToken, coachToken, userToken;
  let adminUser, coachUser, regularUser;
  let team1, team2, game;

  beforeAll(async () => {
    // Use unique identifiers to prevent conflicts in CI
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Create test users with unique names (no password needed for JWT-based tests)
    const adminResult = await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [`admin_timer_${uniqueId}`, `admin_timer_${uniqueId}@test.com`, 'hash', 'admin']
    );
    adminUser = adminResult.rows[0];

    const coachResult = await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [`coach_timer_${uniqueId}`, `coach_timer_${uniqueId}@test.com`, 'hash', 'coach']
    );
    coachUser = coachResult.rows[0];

    const userResult = await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [`user_timer_${uniqueId}`, `user_timer_${uniqueId}@test.com`, 'hash', 'user']
    );
    regularUser = userResult.rows[0];

    // Create JWT tokens directly (no dependency on login endpoint)
    const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_key_min_32_chars_long_for_testing';
    adminToken = jwt.sign({ id: adminUser.id, role: adminUser.role }, jwtSecret, { expiresIn: '1h' });
    coachToken = jwt.sign({ id: coachUser.id, role: coachUser.role }, jwtSecret, { expiresIn: '1h' });
    userToken = jwt.sign({ id: regularUser.id, role: regularUser.role }, jwtSecret, { expiresIn: '1h' });

    // Create teams with unique names
    const team1Result = await db.query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING *',
      [`Test Team Timer 1 ${uniqueId}`]
    );
    team1 = team1Result.rows[0];

    const team2Result = await db.query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING *',
      [`Test Team Timer 2 ${uniqueId}`]
    );
    team2 = team2Result.rows[0];

    // Create an in_progress game
    const gameResult = await db.query(
      'INSERT INTO games (home_team_id, away_team_id, date, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [team1.id, team2.id, new Date(), 'in_progress']
    );
    game = gameResult.rows[0];
  });

  afterAll(async () => {
    try {
      // Clean up in reverse order of dependencies, with null checks
      if (game && game.id) {
        await db.query('DELETE FROM game_events WHERE game_id = $1', [game.id]);
        await db.query('DELETE FROM games WHERE id = $1', [game.id]);
      }

      const teamIds = [team1?.id, team2?.id].filter(Boolean);
      if (teamIds.length > 0) {
        await db.query('DELETE FROM teams WHERE id = ANY($1::int[])', [teamIds]);
      }

      const userIds = [adminUser?.id, coachUser?.id, regularUser?.id].filter(Boolean);
      if (userIds.length > 0) {
        await db.query('DELETE FROM users WHERE id = ANY($1::int[])', [userIds]);
      }
    } catch (err) {
      // Log and continue cleanup, don't throw from afterAll
      console.error('Cleanup error in timer test afterAll:', err.message);
    }
  });

  describe('GET /api/timer/:gameId', () => {
    it('should get timer state for a game', async () => {
      const response = await request(app)
        .get(`/api/timer/${game.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('game_id', game.id);
      expect(response.body).toHaveProperty('current_period', 1);
      expect(response.body).toHaveProperty('timer_state', 'stopped');
      expect(response.body).toHaveProperty('period_duration');
    });

    it('should return 404 for non-existent game', async () => {
      const response = await request(app)
        .get('/api/timer/99999')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Game not found');
    });
  });

  describe('POST /api/timer/:gameId/start', () => {
    beforeEach(async () => {
      // Reset timer state before each test
      await db.query(
        `UPDATE games 
         SET timer_state = 'stopped', 
             time_remaining = NULL, 
             timer_started_at = NULL,
             timer_paused_at = NULL,
             current_period = 1
         WHERE id = $1`,
        [game.id]
      );
    });

    it('should start timer as admin', async () => {
      const response = await request(app)
        .post(`/api/timer/${game.id}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Timer started');
      expect(response.body.timer_state).toBe('running');
      expect(response.body.timer_started_at).toBeDefined();
    });

    it('should start timer as coach', async () => {
      const response = await request(app)
        .post(`/api/timer/${game.id}/start`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.timer_state).toBe('running');
    });

    it('should reject start by regular user', async () => {
      const response = await request(app)
        .post(`/api/timer/${game.id}/start`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(response.status).toBe(403);
    });

    it('should reject start if already running', async () => {
      // Start timer first
      await request(app)
        .post(`/api/timer/${game.id}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      // Try to start again
      const response = await request(app)
        .post(`/api/timer/${game.id}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Timer is already running');
    });

    it('should reject start for non in-progress game', async () => {
      // Create a scheduled game
      const scheduledGame = await db.query(
        'INSERT INTO games (home_team_id, away_team_id, date, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [team1.id, team2.id, new Date(), 'scheduled']
      );

      const response = await request(app)
        .post(`/api/timer/${scheduledGame.rows[0].id}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot start timer for game that is not in progress');

      // Cleanup
      await db.query('DELETE FROM games WHERE id = $1', [scheduledGame.rows[0].id]);
    });
  });

  describe('POST /api/timer/:gameId/pause', () => {
    beforeEach(async () => {
      // Reset and start timer
      await db.query(
        `UPDATE games 
         SET timer_state = 'stopped', 
             time_remaining = NULL, 
             timer_started_at = NULL,
             timer_paused_at = NULL
         WHERE id = $1`,
        [game.id]
      );
    });

    it('should pause running timer', async () => {
      // Start timer first
      await request(app)
        .post(`/api/timer/${game.id}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Pause timer
      const response = await request(app)
        .post(`/api/timer/${game.id}/pause`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Timer paused');
      expect(response.body.timer_state).toBe('paused');
      expect(response.body.time_remaining).toBeDefined();
    });

    it('should reject pause if timer not running', async () => {
      const response = await request(app)
        .post(`/api/timer/${game.id}/pause`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Timer is not running');
    });

    it('should reject pause by regular user', async () => {
      // Start timer
      await request(app)
        .post(`/api/timer/${game.id}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      // Try to pause as regular user
      const response = await request(app)
        .post(`/api/timer/${game.id}/pause`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/timer/:gameId/stop', () => {
    it('should stop timer', async () => {
      // Start timer
      await request(app)
        .post(`/api/timer/${game.id}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      // Stop timer
      const response = await request(app)
        .post(`/api/timer/${game.id}/stop`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Timer stopped');
      expect(response.body.timer_state).toBe('stopped');
    });

    it('should reject stop by regular user', async () => {
      const response = await request(app)
        .post(`/api/timer/${game.id}/stop`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/timer/:gameId/next-period', () => {
    beforeEach(async () => {
      // Reset to period 1
      await db.query(
        `UPDATE games 
         SET current_period = 1,
             timer_state = 'stopped'
         WHERE id = $1`,
        [game.id]
      );
      // Clean up events
      await db.query('DELETE FROM game_events WHERE game_id = $1', [game.id]);
    });

    it('should move to next period', async () => {
      const response = await request(app)
        .post(`/api/timer/${game.id}/next-period`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Moved to next period');
      expect(response.body.current_period).toBe(2);
      expect(response.body.timer_state).toBe('stopped');

      // Verify period events were created
      const eventsResult = await db.query(
        'SELECT * FROM game_events WHERE game_id = $1 AND event_type IN ($2, $3) ORDER BY created_at',
        [game.id, 'period_end', 'period_start']
      );
      expect(eventsResult.rows.length).toBe(2);
      expect(eventsResult.rows[0].event_type).toBe('period_end');
      expect(eventsResult.rows[1].event_type).toBe('period_start');
    });

    it('should reject moving past period 4', async () => {
      // Set to period 4
      await db.query('UPDATE games SET current_period = 4 WHERE id = $1', [game.id]);

      const response = await request(app)
        .post(`/api/timer/${game.id}/next-period`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Already at final period');
    });

    it('should reject by regular user', async () => {
      const response = await request(app)
        .post(`/api/timer/${game.id}/next-period`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/timer/:gameId/period', () => {
    it('should set period manually', async () => {
      const response = await request(app)
        .put(`/api/timer/${game.id}/period`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ period: 3 });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Period updated');
      expect(response.body.current_period).toBe(3);
      expect(response.body.timer_state).toBe('stopped');
    });

    it('should reject invalid period', async () => {
      const response = await request(app)
        .put(`/api/timer/${game.id}/period`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ period: 5 });

      expect(response.status).toBe(400);
    });

    it('should reject by regular user', async () => {
      const response = await request(app)
        .put(`/api/timer/${game.id}/period`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ period: 2 });

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/timer/:gameId/duration', () => {
    it('should set period duration', async () => {
      const response = await request(app)
        .put(`/api/timer/${game.id}/duration`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ minutes: 12 });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Period duration updated');
      expect(response.body.period_duration).toMatchObject({ minutes: 12 });
    });

    it('should reject invalid duration', async () => {
      const response = await request(app)
        .put(`/api/timer/${game.id}/duration`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ minutes: 0 });

      expect(response.status).toBe(400);
    });

    it('should reject by regular user', async () => {
      const response = await request(app)
        .put(`/api/timer/${game.id}/duration`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ minutes: 15 });

      expect(response.status).toBe(403);
    });
  });

  describe('Resume timer after pause', () => {
    it('should resume timer with correct remaining time', async () => {
      // Start timer
      await request(app)
        .post(`/api/timer/${game.id}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      // Wait 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Pause timer
      const pauseResponse = await request(app)
        .post(`/api/timer/${game.id}/pause`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      const pausedTime = pauseResponse.body.time_remaining;
      expect(pausedTime).toBeDefined();

      // Resume timer
      const resumeResponse = await request(app)
        .post(`/api/timer/${game.id}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(resumeResponse.status).toBe(200);
      expect(resumeResponse.body.timer_state).toBe('running');
      
      // Verify time_remaining was preserved
      expect(resumeResponse.body.time_remaining).toMatchObject(pausedTime);
    });
  });
});
