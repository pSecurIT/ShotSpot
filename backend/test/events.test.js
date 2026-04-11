import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

describe('🎯 Events API', () => {
  let adminToken, coachToken, userToken;
  let adminUser, coachUser, regularUser;
  let club1, club2, player1, player2, game;

  beforeAll(async () => {
    console.log('🔧 Setting up Events API tests...');
    try {
      // Use unique identifiers to prevent conflicts in CI
      const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Create test users with unique names (no password needed for JWT-based tests)
      const adminResult = await db.query(
        'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
        [`admin_events_${uniqueId}`, `admin_events_${uniqueId}@test.com`, 'hash', 'admin']
      );
      adminUser = adminResult.rows[0];

      const coachResult = await db.query(
        'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
        [`coach_events_${uniqueId}`, `coach_events_${uniqueId}@test.com`, 'hash', 'coach']
      );
      coachUser = coachResult.rows[0];

      const userResult = await db.query(
        'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
        [`user_events_${uniqueId}`, `user_events_${uniqueId}@test.com`, 'hash', 'user']
      );
      regularUser = userResult.rows[0];

      // Create JWT tokens directly (no dependency on login endpoint)
      const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_key_min_32_chars_long_for_testing';
      adminToken = jwt.sign({ userId: adminUser.id, role: adminUser.role }, jwtSecret, { expiresIn: '1h' });
      coachToken = jwt.sign({ userId: coachUser.id, role: coachUser.role }, jwtSecret, { expiresIn: '1h' });
      userToken = jwt.sign({ userId: regularUser.id, role: regularUser.role }, jwtSecret, { expiresIn: '1h' });

      // Create teams with unique names
      const club1Result = await db.query(
        'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
        [`Test Team Events 1 ${uniqueId}`]
      );
      club1 = club1Result.rows[0];

      const club2Result = await db.query(
        'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
        [`Test Team Events 2 ${uniqueId}`]
      );
      club2 = club2Result.rows[0];

      // Create players
      const player1Result = await db.query(
        'INSERT INTO players (club_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4) RETURNING *',
        [club1.id, 'Event', 'Player1', 10]
      );
      player1 = player1Result.rows[0];

      const player2Result = await db.query(
        'INSERT INTO players (club_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4) RETURNING *',
        [club2.id, 'Event', 'Player2', 20]
      );
      player2 = player2Result.rows[0];

      // Create an in_progress game
      const gameResult = await db.query(
        'INSERT INTO games (home_club_id, away_club_id, date, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [club1.id, club2.id, new Date(), 'in_progress']
      );
      game = gameResult.rows[0];

      // Give coach trainer access to both clubs so existing coach tests pass
      // (events route now enforces trainer assignments for coaches)
      await db.query(
        'INSERT INTO trainer_assignments (user_id, club_id, is_active) VALUES ($1, $2, true)',
        [coachUser.id, club1.id]
      );
      await db.query(
        'INSERT INTO trainer_assignments (user_id, club_id, is_active) VALUES ($1, $2, true)',
        [coachUser.id, club2.id]
      );
    } catch (error) {
      global.testContext.logTestError(error, 'Events API setup failed');
      throw error;
    }
  });

  afterAll(async () => {
    console.log('✅ Events API tests completed');
    try {
      // Cleanup in reverse order of dependencies (Enhanced Events first)
      await db.query('DELETE FROM match_commentary WHERE game_id = $1', [game.id]);
      await db.query('DELETE FROM timeouts WHERE game_id = $1', [game.id]);
      await db.query('DELETE FROM free_shots WHERE game_id = $1', [game.id]);
      await db.query('DELETE FROM game_events WHERE game_id = $1', [game.id]);
      await db.query('DELETE FROM games WHERE id = $1', [game.id]);
      await db.query('DELETE FROM players WHERE id IN ($1, $2)', [player1.id, player2.id]);
      await db.query('DELETE FROM trainer_assignments WHERE user_id = $1 AND club_id IN ($2, $3)', [coachUser.id, club1.id, club2.id]);
      await db.query('DELETE FROM clubs WHERE id IN ($1, $2)', [club1.id, club2.id]);
      await db.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [adminUser.id, coachUser.id, regularUser.id]);
    } catch (error) {
      console.error('⚠️ Events API cleanup failed:', error.message);
    }
  });

  describe('📝 POST /api/events/:gameId', () => {
    beforeEach(async () => {
      // Clean up events before each test
      await db.query('DELETE FROM game_events WHERE game_id = $1', [game.id]);
    });

    it('✅ should create a foul event as admin', async () => {
      try {
        const response = await request(app)
          .post(`/api/events/${game.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            event_type: 'foul',
            player_id: player1.id,
            club_id: club1.id,
            period: 1,
            time_remaining: '00:08:30',
            details: { foul_type: 'offensive', description: 'Pushing opponent' }
          });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          event_type: 'foul',
          player_id: player1.id,
          club_id: club1.id,
          period: 1,
          first_name: 'Event',
          last_name: 'Player1',
          club_name: club1.name
        });
        expect(response.body.details).toMatchObject({
          foul_type: 'offensive',
          description: 'Pushing opponent'
        });
      } catch (error) {
        global.testContext.logTestError(error, 'POST create foul event failed');
        throw error;
      }
    });

    it('✅ should create a substitution event as coach', async () => {
      try {
        const response = await request(app)
          .post(`/api/events/${game.id}`)
          .set('Authorization', `Bearer ${coachToken}`)
          .send({
            event_type: 'substitution',
            player_id: player1.id,
            club_id: club1.id,
            period: 2,
            details: { player_in: player2.id, player_out: player1.id }
          });

        expect(response.status).toBe(201);
        expect(response.body.event_type).toBe('substitution');
        expect(response.body.club_id).toBe(club1.id);
      } catch (error) {
        global.testContext.logTestError(error, 'POST create substitution event failed');
        throw error;
      }
    });

    it('✅ should create a timeout event without player', async () => {
      try {
        const response = await request(app)
          .post(`/api/events/${game.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            event_type: 'timeout',
            club_id: club1.id,
            period: 3,
            time_remaining: '00:05:00'
          });

        expect(response.status).toBe(201);
        expect(response.body.event_type).toBe('timeout');
        expect(response.body.player_id).toBeNull();
      } catch (error) {
        global.testContext.logTestError(error, 'POST create timeout event failed');
        throw error;
      }
    });

    it('✅ should create period_start event', async () => {
      try {
        const response = await request(app)
          .post(`/api/events/${game.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            event_type: 'period_start',
            club_id: club1.id,
            period: 1,
            details: { period_number: 1 }
          });

        expect(response.status).toBe(201);
        expect(response.body.event_type).toBe('period_start');
      } catch (error) {
        global.testContext.logTestError(error, 'POST create period_start event failed');
        throw error;
      }
    });

    it('✅ should create unconfirmed event with explicit status', async () => {
      try {
        const response = await request(app)
          .post(`/api/events/${game.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            event_type: 'foul',
            player_id: player1.id,
            club_id: club1.id,
            period: 1,
            event_status: 'unconfirmed'
          });

        expect(response.status).toBe(201);
        expect(response.body.event_status).toBe('unconfirmed');
      } catch (error) {
        global.testContext.logTestError(error, 'POST unconfirmed event status failed');
        throw error;
      }
    });

    it('✅ should be idempotent when posting same client_uuid twice', async () => {
      try {
        const eventData = {
          event_type: 'timeout',
          club_id: club1.id,
          period: 2,
          client_uuid: '53d20c31-4e71-4264-9fbc-9f68353cd6a9'
        };

        const firstResponse = await request(app)
          .post(`/api/events/${game.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(eventData);

        expect(firstResponse.status).toBe(201);
        expect(firstResponse.body.client_uuid).toBe(eventData.client_uuid);

        const secondResponse = await request(app)
          .post(`/api/events/${game.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(eventData);

        expect(secondResponse.status).toBe(200);
        expect(secondResponse.body.id).toBe(firstResponse.body.id);
        expect(secondResponse.body.client_uuid).toBe(eventData.client_uuid);

        const duplicateCheck = await db.query(
          'SELECT COUNT(*)::int AS count FROM game_events WHERE game_id = $1 AND client_uuid = $2',
          [game.id, eventData.client_uuid]
        );

        expect(duplicateCheck.rows[0].count).toBe(1);
      } catch (error) {
        global.testContext.logTestError(error, 'POST idempotent event client_uuid behavior failed');
        throw error;
      }
    });

    it('❌ should reject creation by regular user', async () => {
      try {
        const response = await request(app)
          .post(`/api/events/${game.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            event_type: 'foul',
            player_id: player1.id,
            club_id: club1.id,
            period: 1
          });

        expect(response.status).toBe(403);
      } catch (error) {
        global.testContext.logTestError(error, 'POST user authorization rejection failed');
        throw error;
      }
    });

    it('should reject event for non-existent game', async () => {
      const response = await request(app)
        .post('/api/events/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          event_type: 'foul',
          player_id: player1.id,
          club_id: club1.id,
          period: 1
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Game not found');
    });

    it('should reject event for game not in progress', async () => {
      // Create a scheduled game
      const scheduledGame = await db.query(
        'INSERT INTO games (home_club_id, away_club_id, date, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [club1.id, club2.id, new Date(), 'scheduled']
      );

      const response = await request(app)
        .post(`/api/events/${scheduledGame.rows[0].id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          event_type: 'foul',
          player_id: player1.id,
          club_id: club1.id,
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
          club_id: club1.id,
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
          club_id: club1.id,
          period: 5 // Invalid, max is 4
        });

      expect(response.status).toBe(400);
    });

    it('should reject player from non-participating team', async () => {
      // Create a third team not in the game
      const team3 = await db.query(
        'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
        ['Test Team Events 3']
      );
      const player3 = await db.query(
        'INSERT INTO players (club_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4) RETURNING *',
        [team3.rows[0].id, 'Other', 'Player', 99]
      );

      const response = await request(app)
        .post(`/api/events/${game.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          event_type: 'foul',
          player_id: player3.rows[0].id,
          club_id: team3.rows[0].id,
          period: 1
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Team is not participating in this game');

      // Cleanup
      await db.query('DELETE FROM players WHERE id = $1', [player3.rows[0].id]);
      await db.query('DELETE FROM clubs WHERE id = $1', [team3.rows[0].id]);
    });

    it('should reject player from different team', async () => {
      const response = await request(app)
        .post(`/api/events/${game.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          event_type: 'foul',
          player_id: player2.id, // Player from team2
          club_id: club1.id,      // But claiming team1
          period: 1
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Player does not belong to the specified team');
    });
  });

  describe('✅ POST /api/events/:gameId/:eventId/confirm', () => {
    it('should confirm an unconfirmed event', async () => {
      const createdEvent = await db.query(
        `INSERT INTO game_events (game_id, event_type, player_id, club_id, period, event_status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [game.id, 'foul', player1.id, club1.id, 1, 'unconfirmed']
      );

      const response = await request(app)
        .post(`/api/events/${game.id}/${createdEvent.rows[0].id}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.event_status).toBe('confirmed');
    });
  });

  describe('📊 GET /api/events/:gameId', () => {
    beforeEach(async () => {
      // Clean up and create test events
      await db.query('DELETE FROM game_events WHERE game_id = $1', [game.id]);
      
      // Create multiple events
      await db.query(
        'INSERT INTO game_events (game_id, event_type, player_id, club_id, period) VALUES ($1, $2, $3, $4, $5)',
        [game.id, 'foul', player1.id, club1.id, 1]
      );
      await db.query(
        'INSERT INTO game_events (game_id, event_type, player_id, club_id, period) VALUES ($1, $2, $3, $4, $5)',
        [game.id, 'substitution', player2.id, club2.id, 2]
      );
      await db.query(
        'INSERT INTO game_events (game_id, event_type, club_id, period) VALUES ($1, $2, $3, $4)',
        [game.id, 'timeout', club1.id, 3]
      );
    });

    it('✅ should get all events for a game', async () => {
      try {
        const response = await request(app)
          .get(`/api/events/${game.id}`)
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body.length).toBe(3);
        expect(response.body[0]).toHaveProperty('event_type');
        expect(response.body[0]).toHaveProperty('club_name');
      } catch (error) {
        global.testContext.logTestError(error, 'GET all events failed');
        throw error;
      }
    });

    it('✅ should filter events by event_type', async () => {
      try {
        const response = await request(app)
          .get(`/api/events/${game.id}?event_type=foul`)
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body.length).toBe(1);
        expect(response.body[0].event_type).toBe('foul');
      } catch (error) {
        global.testContext.logTestError(error, 'GET events by event_type filter failed');
        throw error;
      }
    });

    it('✅ should filter events by club_id', async () => {
      try {
        const response = await request(app)
          .get(`/api/events/${game.id}?club_id=${club1.id}`)
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body.length).toBe(2); // foul and timeout
        expect(response.body.every(e => e.club_id === club1.id)).toBe(true);
      } catch (error) {
        global.testContext.logTestError(error, 'GET events by club_id filter failed');
        throw error;
      }
    });

    it('✅ should filter events by period', async () => {
      try {
        const response = await request(app)
          .get(`/api/events/${game.id}?period=2`)
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body.length).toBe(1);
        expect(response.body[0].period).toBe(2);
      } catch (error) {
        global.testContext.logTestError(error, 'GET events by period filter failed');
        throw error;
      }
    });

    it('✅ should filter events by player_id', async () => {
      try {
        const response = await request(app)
          .get(`/api/events/${game.id}?player_id=${player1.id}`)
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body.length).toBe(1);
        expect(response.body[0].player_id).toBe(player1.id);
      } catch (error) {
        global.testContext.logTestError(error, 'GET events by player_id filter failed');
        throw error;
      }
    });

    it('❌ should reject invalid event_type filter', async () => {
      try {
        const response = await request(app)
          .get(`/api/events/${game.id}?event_type=invalid`)
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(400);
      } catch (error) {
        global.testContext.logTestError(error, 'GET invalid event_type rejection failed');
        throw error;
      }
    });
  });

  describe('✏️ PUT /api/events/:gameId/:eventId', () => {
    let testEvent;

    beforeEach(async () => {
      // Clean up and create a test event
      await db.query('DELETE FROM game_events WHERE game_id = $1', [game.id]);
      
      const result = await db.query(
        'INSERT INTO game_events (game_id, event_type, player_id, club_id, period) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [game.id, 'foul', player1.id, club1.id, 1]
      );
      testEvent = result.rows[0];
    });

    it('✅ should update event type', async () => {
      try {
        const response = await request(app)
          .put(`/api/events/${game.id}/${testEvent.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ event_type: 'timeout' });

        expect(response.status).toBe(200);
        expect(response.body.event_type).toBe('timeout');
      } catch (error) {
        global.testContext.logTestError(error, 'PUT update event type failed');
        throw error;
      }
    });

    it('✅ should update event details', async () => {
      try {
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
      } catch (error) {
        global.testContext.logTestError(error, 'PUT update event details failed');
        throw error;
      }
    });

    it('✅ should update time_remaining', async () => {
      try {
        const response = await request(app)
          .put(`/api/events/${game.id}/${testEvent.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ time_remaining: '00:03:45' });

        expect(response.status).toBe(200);
        expect(response.body.time_remaining).toBeDefined();
        // PostgreSQL INTERVAL type is returned as an object
        expect(response.body.time_remaining).toMatchObject({ minutes: 3, seconds: 45 });
      } catch (error) {
        global.testContext.logTestError(error, 'PUT update time_remaining failed');
        throw error;
      }
    });

    it('✅ should update event_status for review workflow', async () => {
      const response = await request(app)
        .put(`/api/events/${game.id}/${testEvent.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ event_status: 'unconfirmed' });

      expect(response.status).toBe(200);
      expect(response.body.event_status).toBe('unconfirmed');
    });

    it('❌ should reject update for non-existent event', async () => {
      try {
        const response = await request(app)
          .put(`/api/events/${game.id}/99999`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ event_type: 'timeout' });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Event not found');
      } catch (error) {
        global.testContext.logTestError(error, 'PUT non-existent event 404 failed');
        throw error;
      }
    });

    it('❌ should reject update by regular user', async () => {
      try {
        const response = await request(app)
          .put(`/api/events/${game.id}/${testEvent.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ event_type: 'timeout' });

        expect(response.status).toBe(403);
      } catch (error) {
        global.testContext.logTestError(error, 'PUT user authorization rejection failed');
        throw error;
      }
    });

    it('❌ should reject update with no fields', async () => {
      try {
        const response = await request(app)
          .put(`/api/events/${game.id}/${testEvent.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('No fields to update');
      } catch (error) {
        global.testContext.logTestError(error, 'PUT no fields validation failed');
        throw error;
      }
    });
  });

  describe('🗑️ DELETE /api/events/:gameId/:eventId', () => {
    let testEvent;

    beforeEach(async () => {
      // Clean up and create a test event
      await db.query('DELETE FROM game_events WHERE game_id = $1', [game.id]);
      
      const result = await db.query(
        'INSERT INTO game_events (game_id, event_type, player_id, club_id, period) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [game.id, 'foul', player1.id, club1.id, 1]
      );
      testEvent = result.rows[0];
    });

    it('✅ should delete an event', async () => {
      try {
        const response = await request(app)
          .delete(`/api/events/${game.id}/${testEvent.id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Event deleted successfully');

        // Verify deletion
        const checkResult = await db.query('SELECT * FROM game_events WHERE id = $1', [testEvent.id]);
        expect(checkResult.rows.length).toBe(0);
      } catch (error) {
        global.testContext.logTestError(error, 'DELETE event failed');
        throw error;
      }
    });

    it('❌ should reject deletion for non-existent event', async () => {
      try {
        const response = await request(app)
          .delete(`/api/events/${game.id}/99999`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Event not found');
      } catch (error) {
        global.testContext.logTestError(error, 'DELETE non-existent event 404 failed');
        throw error;
      }
    });

    it('❌ should reject deletion by regular user', async () => {
      try {
        const response = await request(app)
          .delete(`/api/events/${game.id}/${testEvent.id}`)
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(403);
      } catch (error) {
        global.testContext.logTestError(error, 'DELETE user authorization rejection failed');
        throw error;
      }
    });
  });

  // Enhanced Match Events Tests
  describe('⚠️ Enhanced Match Events - Fault Events', () => {
    beforeEach(async () => {
      await db.query('DELETE FROM game_events WHERE game_id = $1', [game.id]);
    });

    it('✅ should create fault_offensive event with detailed information', async () => {
      try {
        const response = await request(app)
          .post(`/api/events/${game.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            event_type: 'fault_offensive',
            player_id: player1.id,
            club_id: club1.id,
            period: 1,
            time_remaining: '00:08:30',
            details: { 
              reason: 'running_with_ball', 
              description: 'Player took more than 3 steps with ball',
              location: 'center_court'
            }
          });

        expect(response.status).toBe(201);
        expect(response.body.event_type).toBe('fault_offensive');
        expect(response.body.details).toMatchObject({
          reason: 'running_with_ball',
          description: 'Player took more than 3 steps with ball',
          location: 'center_court'
        });
      } catch (error) {
        global.testContext.logTestError(error, 'CREATE fault_offensive event failed');
        throw error;
      }
    });

    it('✅ should create fault_defensive event', async () => {
      try {
        const response = await request(app)
          .post(`/api/events/${game.id}`)
          .set('Authorization', `Bearer ${coachToken}`)
          .send({
            event_type: 'fault_defensive',
            player_id: player2.id,
            club_id: club2.id,
            period: 2,
            details: { 
              reason: 'hindering_shot',
              description: 'Defended player too closely during shot attempt'
            }
          });

        expect(response.status).toBe(201);
        expect(response.body.event_type).toBe('fault_defensive');
      } catch (error) {
        global.testContext.logTestError(error, 'CREATE fault_defensive event failed');
        throw error;
      }
    });

    it('✅ should create fault_out_of_bounds event', async () => {
      try {
        const response = await request(app)
          .post(`/api/events/${game.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            event_type: 'fault_out_of_bounds',
            player_id: player1.id,
            club_id: club1.id,
            period: 1,
            details: { 
              reason: 'ball_out',
              description: 'Ball went out of bounds on sideline'
            }
          });

        expect(response.status).toBe(201);
        expect(response.body.event_type).toBe('fault_out_of_bounds');
      } catch (error) {
        global.testContext.logTestError(error, 'CREATE fault_out_of_bounds event failed');
        throw error;
      }
    });

    it('❌ should reject fault event with invalid reason', async () => {
      try {
        const response = await request(app)
          .post(`/api/events/${game.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            event_type: 'fault_offensive',
            player_id: player1.id,
            club_id: club1.id,
            period: 1,
            details: { reason: 'invalid_reason' }
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid fault reason');
      } catch (error) {
        global.testContext.logTestError(error, 'REJECT invalid fault reason failed');
        throw error;
      }
    });
  });

  describe('Enhanced Match Events - Free Shots API', () => {
    beforeEach(async () => {
      await db.query('DELETE FROM free_shots WHERE game_id = $1', [game.id]);
    });

    it('should create a free shot event', async () => {
      const response = await request(app)
        .post('/api/free-shots')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: game.id,
          player_id: player1.id,
          club_id: club1.id,
          period: 1,
          time_remaining: '00:05:30',
          free_shot_type: 'free_shot',
          reason: 'Defensive fault',
          x_coord: 15.5,
          y_coord: 10.2,
          result: 'goal',
          distance: 8.5
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        free_shot_type: 'free_shot',
        result: 'goal',
        distance: 8.5,
        reason: 'Defensive fault'
      });
    });

    it('should create a penalty shot', async () => {
      const response = await request(app)
        .post('/api/free-shots')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          game_id: game.id,
          player_id: player2.id,
          club_id: club2.id,
          period: 2,
          free_shot_type: 'penalty',
          reason: 'Serious foul',
          result: 'miss'
        });

      expect(response.status).toBe(201);
      expect(response.body.free_shot_type).toBe('penalty');
      expect(response.body.result).toBe('miss');
    });

    it('should create an unconfirmed free shot idempotently and confirm it later', async () => {
      const payload = {
        game_id: game.id,
        player_id: player1.id,
        club_id: club1.id,
        period: 1,
        free_shot_type: 'free_shot',
        result: 'goal',
        client_uuid: '10000000-0000-4000-8000-000000000001',
        event_status: 'unconfirmed'
      };

      const createResponse = await request(app)
        .post('/api/free-shots')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.event_status).toBe('unconfirmed');

      const duplicateResponse = await request(app)
        .post('/api/free-shots')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(duplicateResponse.status).toBe(200);
      expect(duplicateResponse.body.id).toBe(createResponse.body.id);

      const filteredResponse = await request(app)
        .get(`/api/free-shots/${game.id}?event_status=unconfirmed`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(filteredResponse.status).toBe(200);
      expect(filteredResponse.body.some(shot => shot.id === createResponse.body.id)).toBe(true);
      expect(filteredResponse.body.every(shot => shot.event_status === 'unconfirmed')).toBe(true);

      const confirmResponse = await request(app)
        .post(`/api/free-shots/${createResponse.body.id}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ game_id: game.id });

      expect(confirmResponse.status).toBe(200);
      expect(confirmResponse.body.event_status).toBe('confirmed');
    });

    it('should get all free shots for a game', async () => {
      // Create test data
      await request(app)
        .post('/api/free-shots')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: game.id,
          player_id: player1.id,
          club_id: club1.id,
          period: 1,
          free_shot_type: 'free_shot',
          result: 'goal'
        });

      const response = await request(app)
        .get(`/api/free-shots/${game.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0]).toHaveProperty('club_name');
      expect(response.body[0]).toHaveProperty('first_name');
    });

    it('should reject invalid free shot type', async () => {
      const response = await request(app)
        .post('/api/free-shots')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: game.id,
          player_id: player1.id,
          club_id: club1.id,
          period: 1,
          free_shot_type: 'invalid_type',
          result: 'goal'
        });

      expect(response.status).toBe(400);
    });

    it('should reject invalid result', async () => {
      const response = await request(app)
        .post('/api/free-shots')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: game.id,
          player_id: player1.id,
          club_id: club1.id,
          period: 1,
          free_shot_type: 'free_shot',
          result: 'invalid_result'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Enhanced Match Events - Timeouts API', () => {
    beforeEach(async () => {
      await db.query('DELETE FROM timeouts WHERE game_id = $1', [game.id]);
    });

    it('should create a team timeout', async () => {
      const response = await request(app)
        .post('/api/timeouts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: game.id,
          club_id: club1.id,
          timeout_type: 'team',
          period: 1,
          time_remaining: '00:05:00',
          duration: '00:01:00',
          reason: 'Strategic timeout',
          called_by: 'Head Coach Smith'
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        timeout_type: 'team',
        reason: 'Strategic timeout',
        called_by: 'Head Coach Smith'
      });
    });

    it('should create an injury timeout', async () => {
      const response = await request(app)
        .post('/api/timeouts')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          game_id: game.id,
          club_id: club2.id,
          timeout_type: 'injury',
          period: 2,
          duration: '00:03:00',
          reason: 'Player ankle injury',
          called_by: 'Referee'
        });

      expect(response.status).toBe(201);
      expect(response.body.timeout_type).toBe('injury');
    });

    it('should create an official timeout without team', async () => {
      const response = await request(app)
        .post('/api/timeouts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: game.id,
          timeout_type: 'official',
          period: 3,
          duration: '00:02:00',
          reason: 'Equipment check',
          called_by: 'Head Referee'
        });

      expect(response.status).toBe(201);
      expect(response.body.timeout_type).toBe('official');
      expect(response.body.club_id).toBeNull();
    });

    it('should get all timeouts for a game', async () => {
      // Create test data
      await request(app)
        .post('/api/timeouts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: game.id,
          club_id: club1.id,
          timeout_type: 'team',
          period: 1
        });

      const response = await request(app)
        .get(`/api/timeouts/${game.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0]).toHaveProperty('timeout_type');
    });

    it('should reject invalid timeout type', async () => {
      const response = await request(app)
        .post('/api/timeouts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: game.id,
          timeout_type: 'invalid_type',
          period: 1
        });

      expect(response.status).toBe(400);
    });

    it('should require club_id for team timeouts', async () => {
      const response = await request(app)
        .post('/api/timeouts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: game.id,
          timeout_type: 'team',
          period: 1
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('club_id is required for team timeouts');
    });
  });

  describe('Enhanced Match Events - Match Commentary API', () => {
    beforeEach(async () => {
      await db.query('DELETE FROM match_commentary WHERE game_id = $1', [game.id]);
    });

    it('should create a general note commentary', async () => {
      const response = await request(app)
        .post('/api/match-commentary')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: game.id,
          period: 1,
          time_remaining: '00:08:30',
          commentary_type: 'note',
          title: 'Game Flow',
          content: 'Both teams showing good ball movement and defensive positioning.',
          created_by: adminUser.id
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        commentary_type: 'note',
        title: 'Game Flow',
        content: 'Both teams showing good ball movement and defensive positioning.'
      });
    });

    it('should create a highlight commentary', async () => {
      const response = await request(app)
        .post('/api/match-commentary')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          game_id: game.id,
          period: 2,
          commentary_type: 'highlight',
          title: 'Spectacular Shot',
          content: 'Amazing long-distance goal from the 18-meter line!',
          created_by: coachUser.id
        });

      expect(response.status).toBe(201);
      expect(response.body.commentary_type).toBe('highlight');
    });

    it('should create an injury commentary', async () => {
      const response = await request(app)
        .post('/api/match-commentary')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: game.id,
          period: 3,
          commentary_type: 'injury',
          title: 'Player Injury',
          content: 'Player #10 appears to have twisted ankle, receiving medical attention.',
          created_by: adminUser.id
        });

      expect(response.status).toBe(201);
      expect(response.body.commentary_type).toBe('injury');
    });

    it('should create unconfirmed commentary idempotently and confirm it later', async () => {
      const commentaryData = {
        game_id: game.id,
        period: 2,
        commentary_type: 'note',
        title: 'Pending note',
        content: 'Needs confirmation after review.',
        client_uuid: '20000000-0000-4000-8000-000000000001',
        event_status: 'unconfirmed'
      };

      const createResponse = await request(app)
        .post('/api/match-commentary')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(commentaryData);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.event_status).toBe('unconfirmed');
      expect(createResponse.body.client_uuid).toBe(commentaryData.client_uuid);

      const duplicateResponse = await request(app)
        .post('/api/match-commentary')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(commentaryData);

      expect(duplicateResponse.status).toBe(200);
      expect(duplicateResponse.body.id).toBe(createResponse.body.id);

      const filteredResponse = await request(app)
        .get(`/api/match-commentary/${game.id}?event_status=unconfirmed`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(filteredResponse.status).toBe(200);
      expect(filteredResponse.body).toHaveLength(1);
      expect(filteredResponse.body[0].event_status).toBe('unconfirmed');

      const confirmResponse = await request(app)
        .post(`/api/match-commentary/${createResponse.body.id}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(confirmResponse.status).toBe(200);
      expect(confirmResponse.body.event_status).toBe('confirmed');
    });

    it('should get all commentary for a game', async () => {
      // Create test data
      await request(app)
        .post('/api/match-commentary')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: game.id,
          period: 1,
          commentary_type: 'note',
          title: 'Test Note',
          content: 'Test content',
          created_by: adminUser.id
        });

      const response = await request(app)
        .get(`/api/match-commentary/${game.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0]).toHaveProperty('commentary_type');
      expect(response.body[0]).toHaveProperty('title');
    });

    it('should update commentary', async () => {
      // Create commentary
      const createResponse = await request(app)
        .post('/api/match-commentary')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: game.id,
          period: 1,
          commentary_type: 'note',
          title: 'Original Title',
          content: 'Original content',
          created_by: adminUser.id
        });

      const commentaryId = createResponse.body.id;

      // Update commentary
      const updateResponse = await request(app)
        .put(`/api/match-commentary/${commentaryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Updated Title',
          content: 'Updated content with more details'
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.title).toBe('Updated Title');
      expect(updateResponse.body.content).toBe('Updated content with more details');
    });

    it('should reject invalid commentary type', async () => {
      const response = await request(app)
        .post('/api/match-commentary')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: game.id,
          period: 1,
          commentary_type: 'invalid_type',
          title: 'Test',
          content: 'Test content',
          created_by: adminUser.id
        });

      expect(response.status).toBe(400);
    });

    it('should require title and content', async () => {
      const response = await request(app)
        .post('/api/match-commentary')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: game.id,
          period: 1,
          commentary_type: 'note',
          created_by: adminUser.id
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Enhanced Match Events - Comprehensive Events API', () => {
    beforeEach(async () => {
      // Clean up all event types
      await db.query('DELETE FROM match_commentary WHERE game_id = $1', [game.id]);
      await db.query('DELETE FROM timeouts WHERE game_id = $1', [game.id]);
      await db.query('DELETE FROM free_shots WHERE game_id = $1', [game.id]);
      await db.query('DELETE FROM game_events WHERE game_id = $1', [game.id]);
    });

    it('should get comprehensive events from all tables', async () => {
      // Create events of different types in parallel for better performance
      await Promise.all([
        request(app)
          .post(`/api/events/${game.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            event_type: 'fault_offensive',
            player_id: player1.id,
            club_id: club1.id,
            period: 1
          }),

        request(app)
          .post('/api/free-shots')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: game.id,
            player_id: player2.id,
            club_id: club2.id,
            period: 1,
            free_shot_type: 'free_shot',
            result: 'goal'
          }),

        request(app)
          .post('/api/timeouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: game.id,
            club_id: club1.id,
            timeout_type: 'team',
            period: 2
          }),

        request(app)
          .post('/api/match-commentary')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: game.id,
            period: 2,
            commentary_type: 'highlight',
            title: 'Great Play',
            content: 'Excellent team coordination',
            created_by: adminUser.id
          })
      ]);

      const response = await request(app)
        .get(`/api/events/comprehensive/${game.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(4);
      
      // Check that we have all event types
      const eventTypes = response.body.map(event => event.type);
      expect(eventTypes).toContain('fault_offensive');
      expect(eventTypes).toContain('free_shot_free_shot');
      expect(eventTypes).toContain('timeout_team');
      expect(eventTypes).toContain('commentary_highlight');
    }, 30000);

    it('should filter comprehensive events by type', async () => {
      // Create test events in parallel for better performance
      await Promise.all([
        request(app)
          .post('/api/free-shots')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: game.id,
            player_id: player1.id,
            club_id: club1.id,
            period: 1,
            free_shot_type: 'free_shot',
            result: 'goal'
          }),

        request(app)
          .post('/api/timeouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: game.id,
            club_id: club1.id,
            timeout_type: 'team',
            period: 1
          })
      ]);

      const response = await request(app)
        .get(`/api/events/comprehensive/${game.id}?type=free_shot_free_shot`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].type).toBe('free_shot_free_shot');
    }, 30000);

    it('should filter comprehensive events by period', async () => {
      // Create events in different periods in parallel for better performance
      await Promise.all([
        request(app)
          .post('/api/timeouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: game.id,
            club_id: club1.id,
            timeout_type: 'team',
            period: 1
          }),

        request(app)
          .post('/api/timeouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: game.id,
            club_id: club2.id,
            timeout_type: 'team',
            period: 2
          })
      ]);

      const response = await request(app)
        .get(`/api/events/comprehensive/${game.id}?period=1`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].period).toBe(1);
    }, 30000);

    it('should include unconfirmed commentary in comprehensive pending review filtering', async () => {
      await request(app)
        .post('/api/match-commentary')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: game.id,
          period: 2,
          commentary_type: 'technical',
          title: 'Pending technical note',
          content: 'Clock review required.',
          client_uuid: '20000000-0000-4000-8000-000000000002',
          event_status: 'unconfirmed'
        });

      const response = await request(app)
        .get(`/api/events/comprehensive/${game.id}?event_status=unconfirmed`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        type: 'commentary_technical',
        source_table: 'commentary',
        event_status: 'unconfirmed',
        client_uuid: '20000000-0000-4000-8000-000000000002'
      });
    }, 30000);
  });

  describe('🎯 Team Restriction for Recording Events', () => {
    let restrictedClub, restrictedTeam, restrictedPlayer, otherClub, otherTeam, otherPlayer, restrictedGame;

    beforeAll(async () => {
      try {
        const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // Create club and team that coach has access to
        const restrictedClubResult = await db.query(
          'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
          [`Event Restricted Club ${uniqueId}`]
        );
        restrictedClub = restrictedClubResult.rows[0];

        const restrictedTeamResult = await db.query(
          'INSERT INTO teams (name, club_id) VALUES ($1, $2) RETURNING *',
          [`Event Restricted Team ${uniqueId}`, restrictedClub.id]
        );
        restrictedTeam = restrictedTeamResult.rows[0];

        // Assign coach to this team
        await db.query(
          'INSERT INTO trainer_assignments (user_id, club_id, team_id, is_active) VALUES ($1, $2, $3, true)',
          [coachUser.id, restrictedClub.id, restrictedTeam.id]
        );

        // Create player in assigned team
        const restrictedPlayerResult = await db.query(
          'INSERT INTO players (club_id, team_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [restrictedClub.id, restrictedTeam.id, 'Assigned', 'EventPlayer', 99]
        );
        restrictedPlayer = restrictedPlayerResult.rows[0];

        // Create another club/team that coach does NOT have access to
        const otherClubResult = await db.query(
          'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
          [`Event Other Club ${uniqueId}`]
        );
        otherClub = otherClubResult.rows[0];

        const otherTeamResult = await db.query(
          'INSERT INTO teams (name, club_id) VALUES ($1, $2) RETURNING *',
          [`Event Other Team ${uniqueId}`, otherClub.id]
        );
        otherTeam = otherTeamResult.rows[0];

        // Create player in other team
        const otherPlayerResult = await db.query(
          'INSERT INTO players (club_id, team_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [otherClub.id, otherTeam.id, 'Other', 'EventPlayer', 88]
        );
        otherPlayer = otherPlayerResult.rows[0];

        // Create game with both teams
        const gameResult = await db.query(
          'INSERT INTO games (home_club_id, away_club_id, home_team_id, away_team_id, date, status) VALUES ($1, $2, $3, $4, NOW(), \'in_progress\') RETURNING *',
          [restrictedClub.id, otherClub.id, restrictedTeam.id, otherTeam.id]
        );
        restrictedGame = gameResult.rows[0];

        console.log('      🔧 Event restriction test data created');
      } catch (error) {
        console.error('⚠️ Event restriction test setup failed:', error.message);
        throw error;
      }
    });

    afterAll(async () => {
      try {
        await db.query('DELETE FROM games WHERE id = $1', [restrictedGame.id]);
        await db.query('DELETE FROM trainer_assignments WHERE user_id = $1 AND club_id = $2', [coachUser.id, restrictedClub.id]);
        await db.query('DELETE FROM players WHERE id IN ($1, $2)', [restrictedPlayer.id, otherPlayer.id]);
        await db.query('DELETE FROM teams WHERE id IN ($1, $2)', [restrictedTeam.id, otherTeam.id]);
        await db.query('DELETE FROM clubs WHERE id IN ($1, $2)', [restrictedClub.id, otherClub.id]);
        console.log('      ✅ Event restriction test cleanup complete');
      } catch (error) {
        console.error('⚠️ Event restriction test cleanup failed:', error.message);
      }
    });

    it('✅ admin should record events for any team', async () => {
      try {
        const eventData = {
          club_id: otherClub.id,
          player_id: otherPlayer.id,
          event_type: 'foul',
          period: 1
        };

        const response = await request(app)
          .post(`/api/events/${restrictedGame.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(eventData);

        expect(response.status).toBe(201);
        console.log('      ✅ Admin can record events for any team');

        // Clean up
        await db.query('DELETE FROM game_events WHERE id = $1', [response.body.id]);
      } catch (error) {
        console.log('      ❌ Admin event recording test failed:', error.message);
        global.testContext.logTestError(error, 'Admin event recording failed');
        throw error;
      }
    });

    it('✅ coach should record events only for assigned team', async () => {
      try {
        const eventData = {
          club_id: restrictedClub.id,
          player_id: restrictedPlayer.id,
          event_type: 'foul',
          period: 1
        };

        const response = await request(app)
          .post(`/api/events/${restrictedGame.id}`)
          .set('Authorization', `Bearer ${coachToken}`)
          .send(eventData);

        expect(response.status).toBe(201);
        console.log('      ✅ Coach can record events for assigned team');

        // Clean up
        await db.query('DELETE FROM game_events WHERE id = $1', [response.body.id]);
      } catch (error) {
        console.log('      ❌ Coach assigned team event test failed:', error.message);
        global.testContext.logTestError(error, 'Coach assigned team event failed');
        throw error;
      }
    });

    it('❌ coach should NOT record events for unassigned team', async () => {
      try {
        const eventData = {
          club_id: otherClub.id,
          player_id: otherPlayer.id,
          event_type: 'foul',
          period: 1
        };

        const response = await request(app)
          .post(`/api/events/${restrictedGame.id}`)
          .set('Authorization', `Bearer ${coachToken}`)
          .send(eventData);

        expect(response.status).toBe(403);
        expect(response.body.error).toContain('only record events');
        console.log('      ✅ Coach correctly blocked from unassigned team');
      } catch (error) {
        console.log('      ❌ Coach event restriction test failed:', error.message);
        global.testContext.logTestError(error, 'Coach event restriction failed');
        throw error;
      }
    });

    it('❌ should reject event when team_id does not match player team', async () => {
      try {
        const eventData = {
          club_id: otherClub.id, // Wrong club for this player!
          player_id: restrictedPlayer.id,
          event_type: 'foul',
          period: 1
        };

        const response = await request(app)
          .post(`/api/events/${restrictedGame.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(eventData);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('does not belong');
        console.log('      ✅ Club-player mismatch correctly rejected');
      } catch (error) {
        console.log('      ❌ Team-player mismatch test failed:', error.message);
        global.testContext.logTestError(error, 'Team-player mismatch failed');
        throw error;
      }
    });
  });
});


