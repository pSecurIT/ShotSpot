import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

describe('🎯 Events API', () => {
  let adminToken, coachToken, userToken;
  let adminUser, coachUser, regularUser;
  let team1, team2, player1, player2, game;

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
      adminToken = jwt.sign({ id: adminUser.id, role: adminUser.role }, jwtSecret, { expiresIn: '1h' });
      coachToken = jwt.sign({ id: coachUser.id, role: coachUser.role }, jwtSecret, { expiresIn: '1h' });
      userToken = jwt.sign({ id: regularUser.id, role: regularUser.role }, jwtSecret, { expiresIn: '1h' });

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
      await db.query('DELETE FROM teams WHERE id IN ($1, $2)', [team1.id, team2.id]);
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
            team_id: team1.id,
            period: 2,
            details: { player_in: player2.id, player_out: player1.id }
          });

        expect(response.status).toBe(201);
        expect(response.body.event_type).toBe('substitution');
        expect(response.body.team_id).toBe(team1.id);
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
            team_id: team1.id,
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
            team_id: team1.id,
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

    it('❌ should reject creation by regular user', async () => {
      try {
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

  describe('📊 GET /api/events/:gameId', () => {
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

    it('✅ should get all events for a game', async () => {
      try {
        const response = await request(app)
          .get(`/api/events/${game.id}`)
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body.length).toBe(3);
        expect(response.body[0]).toHaveProperty('event_type');
        expect(response.body[0]).toHaveProperty('team_name');
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

    it('✅ should filter events by team_id', async () => {
      try {
        const response = await request(app)
          .get(`/api/events/${game.id}?team_id=${team1.id}`)
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body.length).toBe(2); // foul and timeout
        expect(response.body.every(e => e.team_id === team1.id)).toBe(true);
      } catch (error) {
        global.testContext.logTestError(error, 'GET events by team_id filter failed');
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
        'INSERT INTO game_events (game_id, event_type, player_id, team_id, period) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [game.id, 'foul', player1.id, team1.id, 1]
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
        'INSERT INTO game_events (game_id, event_type, player_id, team_id, period) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [game.id, 'foul', player1.id, team1.id, 1]
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
            team_id: team1.id,
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
            team_id: team2.id,
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
            team_id: team1.id,
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
            team_id: team1.id,
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
          team_id: team1.id,
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
          team_id: team2.id,
          period: 2,
          free_shot_type: 'penalty',
          reason: 'Serious foul',
          result: 'miss'
        });

      expect(response.status).toBe(201);
      expect(response.body.free_shot_type).toBe('penalty');
      expect(response.body.result).toBe('miss');
    });

    it('should get all free shots for a game', async () => {
      // Create test data
      await request(app)
        .post('/api/free-shots')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: game.id,
          player_id: player1.id,
          team_id: team1.id,
          period: 1,
          free_shot_type: 'free_shot',
          result: 'goal'
        });

      const response = await request(app)
        .get(`/api/free-shots/${game.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0]).toHaveProperty('team_name');
      expect(response.body[0]).toHaveProperty('first_name');
    });

    it('should reject invalid free shot type', async () => {
      const response = await request(app)
        .post('/api/free-shots')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: game.id,
          player_id: player1.id,
          team_id: team1.id,
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
          team_id: team1.id,
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
          team_id: team1.id,
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
          team_id: team2.id,
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
      expect(response.body.team_id).toBeNull();
    });

    it('should get all timeouts for a game', async () => {
      // Create test data
      await request(app)
        .post('/api/timeouts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: game.id,
          team_id: team1.id,
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

    it('should require team_id for team timeouts', async () => {
      const response = await request(app)
        .post('/api/timeouts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: game.id,
          timeout_type: 'team',
          period: 1
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('team_id is required for team timeouts');
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
            team_id: team1.id,
            period: 1
          }),

        request(app)
          .post('/api/free-shots')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: game.id,
            player_id: player2.id,
            team_id: team2.id,
            period: 1,
            free_shot_type: 'free_shot',
            result: 'goal'
          }),

        request(app)
          .post('/api/timeouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: game.id,
            team_id: team1.id,
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
    });

    it('should filter comprehensive events by type', async () => {
      // Create test events in parallel for better performance
      await Promise.all([
        request(app)
          .post('/api/free-shots')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: game.id,
            player_id: player1.id,
            team_id: team1.id,
            period: 1,
            free_shot_type: 'free_shot',
            result: 'goal'
          }),

        request(app)
          .post('/api/timeouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: game.id,
            team_id: team1.id,
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
    });

    it('should filter comprehensive events by period', async () => {
      // Create events in different periods in parallel for better performance
      await Promise.all([
        request(app)
          .post('/api/timeouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: game.id,
            team_id: team1.id,
            timeout_type: 'team',
            period: 1
          }),

        request(app)
          .post('/api/timeouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: game.id,
            team_id: team2.id,
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
    });
  });
});