import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import bcrypt from 'bcrypt';

describe('Events API', () => {
  let adminToken, coachToken, userToken;
  let adminUser, coachUser, regularUser;
  let team1, team2, player1, player2, game;

  beforeAll(async () => {
    // Use unique identifiers to prevent conflicts in CI
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Create test users with unique names
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const adminResult = await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [`admin_events_${uniqueId}`, `admin_events_${uniqueId}@test.com`, hashedPassword, 'admin']
    );
    adminUser = adminResult.rows[0];

    const coachResult = await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [`coach_events_${uniqueId}`, `coach_events_${uniqueId}@test.com`, hashedPassword, 'coach']
    );
    coachUser = coachResult.rows[0];

    const userResult = await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [`user_events_${uniqueId}`, `user_events_${uniqueId}@test.com`, hashedPassword, 'user']
    );
    regularUser = userResult.rows[0];

    // Get auth tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: `admin_events_${uniqueId}`, password: 'password123' });
    adminToken = adminLogin.body.token;

    const coachLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: `coach_events_${uniqueId}`, password: 'password123' });
    coachToken = coachLogin.body.token;

    const userLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: `user_events_${uniqueId}`, password: 'password123' });
    userToken = userLogin.body.token;

    // Validate tokens were acquired successfully
    if (!adminToken || !coachToken || !userToken) {
      throw new Error('Failed to acquire one or more JWT tokens for test users');
    }

    // Create teams with unique names
    const team1Result = await db.query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING *',
      [`Test Team Events 1 ${uniqueId}`]
    );
    team1 = team1Result.rows[0];

    const team2Result = await db.query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING *',
      [`Test Team Events 2 ${uniqueId}`]
    );
    team2 = team2Result.rows[0];

    // Create players
    const player1Result = await db.query(
      'INSERT INTO players (team_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4) RETURNING *',
      [team1.id, 'Event', 'Player1', 10]
    );
    player1 = player1Result.rows[0];

    const player2Result = await db.query(
      'INSERT INTO players (team_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4) RETURNING *',
      [team2.id, 'Event', 'Player2', 20]
    );
    player2 = player2Result.rows[0];

    // Create an in_progress game
    const gameResult = await db.query(
      'INSERT INTO games (home_team_id, away_team_id, date, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [team1.id, team2.id, new Date(), 'in_progress']
    );
    game = gameResult.rows[0];
  });

  afterAll(async () => {
    // Cleanup in reverse order of dependencies
    await db.query('DELETE FROM game_events WHERE game_id = $1', [game.id]);
    await db.query('DELETE FROM games WHERE id = $1', [game.id]);
    await db.query('DELETE FROM players WHERE id IN ($1, $2)', [player1.id, player2.id]);
    await db.query('DELETE FROM teams WHERE id IN ($1, $2)', [team1.id, team2.id]);
    await db.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [adminUser.id, coachUser.id, regularUser.id]);
  });

  describe('POST /api/events/:gameId', () => {
    beforeEach(async () => {
      // Clean up events before each test
      await db.query('DELETE FROM game_events WHERE game_id = $1', [game.id]);
    });

    it('should create a foul event as admin', async () => {
      const response = await request(app)
        .post(`/api/events/${game.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          event_type: 'foul',
          player_id: player1.id,
          team_id: team1.id,
          period: 1,
          time_remaining: '00:08:30',
          details: { foul_type: 'offensive', description: 'Pushing opponent' }
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        event_type: 'foul',
        player_id: player1.id,
        team_id: team1.id,
        period: 1,
        first_name: 'Event',
        last_name: 'Player1',
        team_name: team1.name
      });
      expect(response.body.details).toMatchObject({
        foul_type: 'offensive',
        description: 'Pushing opponent'
      });
    });

    it('should create a substitution event as coach', async () => {
      const response = await request(app)
        .post(`/api/events/${game.id}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          event_type: 'substitution',
          player_id: player1.id,
          team_id: team1.id,
          period: 2,
          details: { player_in: player2.id, player_out: player1.id }
        });

      expect(response.status).toBe(201);
      expect(response.body.event_type).toBe('substitution');
      expect(response.body.team_id).toBe(team1.id);
    });

    it('should create a timeout event without player', async () => {
      const response = await request(app)
        .post(`/api/events/${game.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          event_type: 'timeout',
          team_id: team1.id,
          period: 3,
          time_remaining: '00:05:00'
        });

      expect(response.status).toBe(201);
      expect(response.body.event_type).toBe('timeout');
      expect(response.body.player_id).toBeNull();
    });

    it('should create period_start event', async () => {
      const response = await request(app)
        .post(`/api/events/${game.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          event_type: 'period_start',
          team_id: team1.id,
          period: 1,
          details: { period_number: 1 }
        });

      expect(response.status).toBe(201);
      expect(response.body.event_type).toBe('period_start');
    });

    it('should reject creation by regular user', async () => {
      const response = await request(app)
        .post(`/api/events/${game.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          event_type: 'foul',
          player_id: player1.id,
          team_id: team1.id,
          period: 1
        });

      expect(response.status).toBe(403);
    });

    it('should reject event for non-existent game', async () => {
      const response = await request(app)
        .post('/api/events/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          event_type: 'foul',
          player_id: player1.id,
          team_id: team1.id,
          period: 1
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Game not found');
    });

    it('should reject event for game not in progress', async () => {
      // Create a scheduled game
      const scheduledGame = await db.query(
        'INSERT INTO games (home_team_id, away_team_id, date, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [team1.id, team2.id, new Date(), 'scheduled']
      );

      const response = await request(app)
        .post(`/api/events/${scheduledGame.rows[0].id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          event_type: 'foul',
          player_id: player1.id,
          team_id: team1.id,
          period: 1
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot add events to game that is not in progress');

      // Cleanup
      await db.query('DELETE FROM games WHERE id = $1', [scheduledGame.rows[0].id]);
    });

    it('should reject invalid event type', async () => {
      const response = await request(app)
        .post(`/api/events/${game.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          event_type: 'invalid_type',
          team_id: team1.id,
          period: 1
        });

      expect(response.status).toBe(400);
    });

    it('should reject invalid period', async () => {
      const response = await request(app)
        .post(`/api/events/${game.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          event_type: 'foul',
          team_id: team1.id,
          period: 5 // Invalid, max is 4
        });

      expect(response.status).toBe(400);
    });

    it('should reject player from non-participating team', async () => {
      // Create a third team not in the game
      const team3 = await db.query(
        'INSERT INTO teams (name) VALUES ($1) RETURNING *',
        ['Test Team Events 3']
      );
      const player3 = await db.query(
        'INSERT INTO players (team_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4) RETURNING *',
        [team3.rows[0].id, 'Other', 'Player', 99]
      );

      const response = await request(app)
        .post(`/api/events/${game.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          event_type: 'foul',
          player_id: player3.rows[0].id,
          team_id: team3.rows[0].id,
          period: 1
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Team is not participating in this game');

      // Cleanup
      await db.query('DELETE FROM players WHERE id = $1', [player3.rows[0].id]);
      await db.query('DELETE FROM teams WHERE id = $1', [team3.rows[0].id]);
    });

    it('should reject player from different team', async () => {
      const response = await request(app)
        .post(`/api/events/${game.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          event_type: 'foul',
          player_id: player2.id, // Player from team2
          team_id: team1.id,      // But claiming team1
          period: 1
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Player does not belong to the specified team');
    });
  });

  describe('GET /api/events/:gameId', () => {
    beforeEach(async () => {
      // Clean up and create test events
      await db.query('DELETE FROM game_events WHERE game_id = $1', [game.id]);
      
      // Create multiple events
      await db.query(
        'INSERT INTO game_events (game_id, event_type, player_id, team_id, period) VALUES ($1, $2, $3, $4, $5)',
        [game.id, 'foul', player1.id, team1.id, 1]
      );
      await db.query(
        'INSERT INTO game_events (game_id, event_type, player_id, team_id, period) VALUES ($1, $2, $3, $4, $5)',
        [game.id, 'substitution', player2.id, team2.id, 2]
      );
      await db.query(
        'INSERT INTO game_events (game_id, event_type, team_id, period) VALUES ($1, $2, $3, $4)',
        [game.id, 'timeout', team1.id, 3]
      );
    });

    it('should get all events for a game', async () => {
      const response = await request(app)
        .get(`/api/events/${game.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(3);
      expect(response.body[0]).toHaveProperty('event_type');
      expect(response.body[0]).toHaveProperty('team_name');
    });

    it('should filter events by event_type', async () => {
      const response = await request(app)
        .get(`/api/events/${game.id}?event_type=foul`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].event_type).toBe('foul');
    });

    it('should filter events by team_id', async () => {
      const response = await request(app)
        .get(`/api/events/${game.id}?team_id=${team1.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2); // foul and timeout
      expect(response.body.every(e => e.team_id === team1.id)).toBe(true);
    });

    it('should filter events by period', async () => {
      const response = await request(app)
        .get(`/api/events/${game.id}?period=2`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].period).toBe(2);
    });

    it('should filter events by player_id', async () => {
      const response = await request(app)
        .get(`/api/events/${game.id}?player_id=${player1.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].player_id).toBe(player1.id);
    });

    it('should reject invalid event_type filter', async () => {
      const response = await request(app)
        .get(`/api/events/${game.id}?event_type=invalid`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/events/:gameId/:eventId', () => {
    let testEvent;

    beforeEach(async () => {
      // Clean up and create a test event
      await db.query('DELETE FROM game_events WHERE game_id = $1', [game.id]);
      
      const result = await db.query(
        'INSERT INTO game_events (game_id, event_type, player_id, team_id, period) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [game.id, 'foul', player1.id, team1.id, 1]
      );
      testEvent = result.rows[0];
    });

    it('should update event type', async () => {
      const response = await request(app)
        .put(`/api/events/${game.id}/${testEvent.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ event_type: 'timeout' });

      expect(response.status).toBe(200);
      expect(response.body.event_type).toBe('timeout');
    });

    it('should update event details', async () => {
      const response = await request(app)
        .put(`/api/events/${game.id}/${testEvent.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          details: { foul_type: 'defensive', severity: 'yellow_card' }
        });

      expect(response.status).toBe(200);
      expect(response.body.details).toMatchObject({
        foul_type: 'defensive',
        severity: 'yellow_card'
      });
    });

    it('should update time_remaining', async () => {
      const response = await request(app)
        .put(`/api/events/${game.id}/${testEvent.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ time_remaining: '00:03:45' });

      expect(response.status).toBe(200);
      expect(response.body.time_remaining).toBeDefined();
      // PostgreSQL INTERVAL type is returned as an object
      expect(response.body.time_remaining).toMatchObject({ minutes: 3, seconds: 45 });
    });

    it('should reject update for non-existent event', async () => {
      const response = await request(app)
        .put(`/api/events/${game.id}/99999`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ event_type: 'timeout' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Event not found');
    });

    it('should reject update by regular user', async () => {
      const response = await request(app)
        .put(`/api/events/${game.id}/${testEvent.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ event_type: 'timeout' });

      expect(response.status).toBe(403);
    });

    it('should reject update with no fields', async () => {
      const response = await request(app)
        .put(`/api/events/${game.id}/${testEvent.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No fields to update');
    });
  });

  describe('DELETE /api/events/:gameId/:eventId', () => {
    let testEvent;

    beforeEach(async () => {
      // Clean up and create a test event
      await db.query('DELETE FROM game_events WHERE game_id = $1', [game.id]);
      
      const result = await db.query(
        'INSERT INTO game_events (game_id, event_type, player_id, team_id, period) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [game.id, 'foul', player1.id, team1.id, 1]
      );
      testEvent = result.rows[0];
    });

    it('should delete an event', async () => {
      const response = await request(app)
        .delete(`/api/events/${game.id}/${testEvent.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Event deleted successfully');

      // Verify deletion
      const checkResult = await db.query('SELECT * FROM game_events WHERE id = $1', [testEvent.id]);
      expect(checkResult.rows.length).toBe(0);
    });

    it('should reject deletion for non-existent event', async () => {
      const response = await request(app)
        .delete(`/api/events/${game.id}/99999`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Event not found');
    });

    it('should reject deletion by regular user', async () => {
      const response = await request(app)
        .delete(`/api/events/${game.id}/${testEvent.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });
});
