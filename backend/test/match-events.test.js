import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

describe('🎮 Match Events API', () => {
  let adminToken, coachToken, userToken;
  let adminUser, coachUser, regularUser;
  let club1, club2, player1, player2, game;
  let testUsers = [];

  beforeAll(async () => {
    console.log('🔧 Setting up Match Events API tests...');
    try {
      // Use unique identifiers to prevent conflicts
      const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Create test users with unique names
      const adminResult = await db.query(
        'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
        [`admin_events_${uniqueId}`, `admin_events_${uniqueId}@test.com`, 'hash', 'admin']
      );
      adminUser = adminResult.rows[0];
      testUsers.push(adminUser.id);

      const coachResult = await db.query(
        'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
        [`coach_events_${uniqueId}`, `coach_events_${uniqueId}@test.com`, 'hash', 'coach']
      );
      coachUser = coachResult.rows[0];
      testUsers.push(coachUser.id);

      const userResult = await db.query(
        'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
        [`user_events_${uniqueId}`, `user_events_${uniqueId}@test.com`, 'hash', 'user']
      );
      regularUser = userResult.rows[0];
      testUsers.push(regularUser.id);

      // Create JWT tokens
      const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_key_min_32_chars_long_for_testing';
      adminToken = jwt.sign(
        { 
          id: adminUser.id, 
          userId: adminUser.id, 
          username: adminUser.username,
          role: adminUser.role, 
          permissions: ['write'] 
        }, 
        jwtSecret, 
        { expiresIn: '1h' }
      );
      coachToken = jwt.sign(
        { 
          id: coachUser.id, 
          userId: coachUser.id, 
          username: coachUser.username,
          role: coachUser.role, 
          permissions: ['write'] 
        }, 
        jwtSecret, 
        { expiresIn: '1h' }
      );
      userToken = jwt.sign(
        { 
          id: regularUser.id, 
          userId: regularUser.id, 
          username: regularUser.username,
          role: regularUser.role, 
          permissions: ['read'] 
        }, 
        jwtSecret, 
        { expiresIn: '1h' }
      );

      // Create teams
      const club1Result = await db.query(
        'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
        [`Team Match Events 1 ${uniqueId}`]
      );
      club1 = club1Result.rows[0];

      const club2Result = await db.query(
        'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
        [`Team Match Events 2 ${uniqueId}`]
      );
      club2 = club2Result.rows[0];

      // Create players
      const player1Result = await db.query(
        'INSERT INTO players (first_name, last_name, club_id, jersey_number) VALUES ($1, $2, $3, $4) RETURNING *',
        [`Player1_${uniqueId}`, 'LastName1', club1.id, 10]
      );
      player1 = player1Result.rows[0];

      const player2Result = await db.query(
        'INSERT INTO players (first_name, last_name, club_id, jersey_number) VALUES ($1, $2, $3, $4) RETURNING *',
        [`Player2_${uniqueId}`, 'LastName2', club2.id, 20]
      );
      player2 = player2Result.rows[0];

      // Create game
      const gameResult = await db.query(
        'INSERT INTO games (home_club_id, away_club_id, status, date) VALUES ($1, $2, $3, $4) RETURNING *',
        [club1.id, club2.id, 'in_progress', new Date()]
      );
      game = gameResult.rows[0];

      console.log('✅ Match Events API test setup complete');
    } catch (error) {
      console.error('❌ Match Events API test setup failed:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      console.log('🧹 Cleaning up Match Events API tests...');
      
      // Clean up in correct order to avoid foreign key constraints
      if (game?.id) {
        await db.query('DELETE FROM shots WHERE game_id = $1', [game.id]);
        await db.query('DELETE FROM game_events WHERE game_id = $1', [game.id]);
        await db.query('DELETE FROM games WHERE id = $1', [game.id]);
      }
      if (player1?.id && player2?.id) {
        await db.query('DELETE FROM players WHERE id = ANY($1)', [[player1.id, player2.id]]);
      }
      if (club1?.id && club2?.id) {
        await db.query('DELETE FROM clubs WHERE id = ANY($1)', [[club1.id, club2.id]]);
      }
      if (testUsers.length > 0) {
        await db.query('DELETE FROM users WHERE id = ANY($1)', [testUsers]);
      }
      
      console.log('✅ Match Events API tests cleanup completed');
    } catch (error) {
      console.error('❌ Match Events API cleanup failed:', error);
    }
  });

  beforeEach(async () => {
    // Clean up shots and events before each test
    await db.query('DELETE FROM shots WHERE game_id = $1', [game.id]);
    await db.query('DELETE FROM game_events WHERE game_id = $1', [game.id]);
  });

  describe('🎯 Shots Management', () => {
    describe('✅ GET /api/match-events/games/:gameId/shots', () => {
      it('✅ should get all shots for a game', async () => {
        try {
          // Create test shot
          await db.query(
            `INSERT INTO shots (game_id, player_id, club_id, x_coord, y_coord, result, period, time_remaining) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [game.id, player1.id, club1.id, 10.5, 15.2, 'goal', 1, '00:10:30']
          );

          const response = await request(app)
            .get(`/api/match-events/games/${game.id}/shots`)
            .set('Authorization', `Bearer ${userToken}`);

          expect(response.status).toBe(200);
          expect(response.body).toHaveLength(1);
          expect(response.body[0]).toMatchObject({
            game_id: game.id,
            player_id: player1.id,
            team_id: club1.id,
            result: 'goal',
            period: 1
          });
          expect(response.body[0]).toHaveProperty('player_name');
          expect(response.body[0]).toHaveProperty('club_name');
        } catch (error) {
          global.testContext?.logTestError(error, 'GET shots for game failed');
          throw error;
        }
      });

      it('❌ should reject invalid game ID parameter', async () => {
        try {
          const response = await request(app)
            .get('/api/match-events/games/invalid/shots')
            .set('Authorization', `Bearer ${userToken}`);

          expect(response.status).toBe(400);
          expect(response.body.errors).toBeDefined();
          expect(response.body.errors[0].msg).toContain('Game ID must be an integer');
        } catch (error) {
          global.testContext?.logTestError(error, 'Invalid game ID validation failed');
          throw error;
        }
      });

      it('❌ should require authentication', async () => {
        try {
          const response = await request(app)
            .get(`/api/match-events/games/${game.id}/shots`);

          expect(response.status).toBe(401);
        } catch (error) {
          global.testContext?.logTestError(error, 'Authentication requirement failed');
          throw error;
        }
      });
    });

    describe('✅ POST /api/match-events/shots', () => {
      const validShotData = {
        game_id: null, // Will be set in tests
        player_id: null, // Will be set in tests
        team_id: null, // Will be set in tests
        x_coord: 12.5,
        y_coord: 8.3,
        result: 'goal',
        period: 1,
        time_remaining: '00:08:45',
        shot_type: 'distance_shot',
        distance: 15.2
      };

      it('✅ should create shot as admin', async () => {
        try {
          const shotData = {
            ...validShotData,
            game_id: game.id,
            player_id: player1.id,
            team_id: club1.id
          };

          const response = await request(app)
            .post('/api/match-events/shots')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(shotData);

          expect(response.status).toBe(201);
          expect(response.body).toMatchObject({
            game_id: game.id,
            player_id: player1.id,
            team_id: club1.id,
            result: 'goal',
            period: 1,
            x_coord: '12.5', // Database returns as string
            y_coord: '8.3'   // Database returns as string
          });
          expect(response.body).toHaveProperty('id');
          expect(response.body).toHaveProperty('created_at');
        } catch (error) {
          global.testContext?.logTestError(error, 'Admin shot creation failed');
          throw error;
        }
      });

      it('✅ should create shot as coach', async () => {
        try {
          const shotData = {
            ...validShotData,
            game_id: game.id,
            player_id: player2.id,
            team_id: club2.id,
            result: 'miss'
          };

          const response = await request(app)
            .post('/api/match-events/shots')
            .set('Authorization', `Bearer ${coachToken}`)
            .send(shotData);

          expect(response.status).toBe(201);
          expect(response.body.result).toBe('miss');
        } catch (error) {
          global.testContext?.logTestError(error, 'Coach shot creation failed');
          throw error;
        }
      });

      it('✅ should update game score when shot is goal', async () => {
        try {
          const shotData = {
            ...validShotData,
            game_id: game.id,
            player_id: player1.id,
            team_id: club1.id,
            result: 'goal'
          };

          // Check initial score
          const initialGame = await db.query('SELECT home_score, away_score FROM games WHERE id = $1', [game.id]);
          const initialHomeScore = initialGame.rows[0].home_score || 0;

          const response = await request(app)
            .post('/api/match-events/shots')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(shotData);

          expect(response.status).toBe(201);

          // Check updated score
          const updatedGame = await db.query('SELECT home_score, away_score FROM games WHERE id = $1', [game.id]);
          expect(updatedGame.rows[0].home_score).toBe(initialHomeScore + 1);
        } catch (error) {
          global.testContext?.logTestError(error, 'Score update on goal failed');
          throw error;
        }
      });

      it('❌ should reject regular user creating shots', async () => {
        try {
          const shotData = {
            ...validShotData,
            game_id: game.id,
            player_id: player1.id,
            team_id: club1.id
          };

          const response = await request(app)
            .post('/api/match-events/shots')
            .set('Authorization', `Bearer ${userToken}`)
            .send(shotData);

          expect(response.status).toBe(403);
        } catch (error) {
          global.testContext?.logTestError(error, 'User permission rejection failed');
          throw error;
        }
      });

      it('❌ should reject invalid shot result', async () => {
        try {
          const shotData = {
            ...validShotData,
            game_id: game.id,
            player_id: player1.id,
            team_id: club1.id,
            result: 'invalid_result'
          };

          const response = await request(app)
            .post('/api/match-events/shots')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(shotData);

          expect(response.status).toBe(400);
          expect(response.body.errors).toBeDefined();
          expect(response.body.errors[0].msg).toContain('Result must be goal, miss, or blocked');
        } catch (error) {
          global.testContext?.logTestError(error, 'Invalid result validation failed');
          throw error;
        }
      });

      it('❌ should reject shot for non-existent game', async () => {
        try {
          const shotData = {
            ...validShotData,
            game_id: 99999,
            player_id: player1.id,
            team_id: club1.id
          };

          const response = await request(app)
            .post('/api/match-events/shots')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(shotData);

          expect(response.status).toBe(404);
          expect(response.body.error).toBe('Game not found');
        } catch (error) {
          global.testContext?.logTestError(error, 'Non-existent game validation failed');
          throw error;
        }
      });

      it('❌ should reject shot for non-progress game', async () => {
        try {
          // Create a finished game
          const finishedGameResult = await db.query(
            'INSERT INTO games (home_club_id, away_club_id, status, date) VALUES ($1, $2, $3, $4) RETURNING *',
            [club1.id, club2.id, 'completed', new Date()]
          );

          const shotData = {
            ...validShotData,
            game_id: finishedGameResult.rows[0].id,
            player_id: player1.id,
            team_id: club1.id
          };

          const response = await request(app)
            .post('/api/match-events/shots')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(shotData);

          expect(response.status).toBe(400);
          expect(response.body.error).toBe('Invalid game status');
          expect(response.body.details).toContain('Shots can only be recorded for games in progress');

          // Clean up
          await db.query('DELETE FROM games WHERE id = $1', [finishedGameResult.rows[0].id]);
        } catch (error) {
          global.testContext?.logTestError(error, 'Non-progress game validation failed');
          throw error;
        }
      });

      it('❌ should reject shot when player not in team', async () => {
        try {
          const shotData = {
            ...validShotData,
            game_id: game.id,
            player_id: player1.id, // Player1 belongs to team1
            team_id: club2.id      // But we're saying they're in team2
          };

          const response = await request(app)
            .post('/api/match-events/shots')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(shotData);

          expect(response.status).toBe(400);
          expect(response.body.error).toBe('Player does not belong to the specified team');
        } catch (error) {
          global.testContext?.logTestError(error, 'Player-team validation failed');
          throw error;
        }
      });

      it('❌ should reject shot for non-existent player', async () => {
        try {
          const shotData = {
            ...validShotData,
            game_id: game.id,
            player_id: 99999,
            team_id: club1.id
          };

          const response = await request(app)
            .post('/api/match-events/shots')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(shotData);

          expect(response.status).toBe(404);
          expect(response.body.error).toBe('Player not found');
        } catch (error) {
          global.testContext?.logTestError(error, 'Non-existent player validation failed');
          throw error;
        }
      });
    });
  });

  describe('🎪 Game Events Management', () => {
    describe('✅ GET /api/match-events/games/:gameId/events', () => {
      it('✅ should get all events for a game', async () => {
        try {
          // Create test event
          await db.query(
            `INSERT INTO game_events (game_id, event_type, club_id, player_id, period, time_remaining, details) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [game.id, 'foul', club1.id, player1.id, 1, '00:12:45', { reason: 'offensive_foul' }]
          );

          const response = await request(app)
            .get(`/api/match-events/games/${game.id}/events`)
            .set('Authorization', `Bearer ${userToken}`);

          expect(response.status).toBe(200);
          expect(response.body).toHaveLength(1);
          expect(response.body[0]).toMatchObject({
            game_id: game.id,
            event_type: 'foul',
            team_id: club1.id,
            player_id: player1.id,
            period: 1
          });
          expect(response.body[0]).toHaveProperty('player_name');
          expect(response.body[0]).toHaveProperty('club_name');
        } catch (error) {
          global.testContext?.logTestError(error, 'GET events for game failed');
          throw error;
        }
      });

      it('✅ should handle events without player (team-level events)', async () => {
        try {
          // Create team-level event (no player)
          await db.query(
            `INSERT INTO game_events (game_id, event_type, club_id, period, time_remaining) 
             VALUES ($1, $2, $3, $4, $5)`,
            [game.id, 'timeout', club1.id, 2, '00:05:15']
          );

          const response = await request(app)
            .get(`/api/match-events/games/${game.id}/events`)
            .set('Authorization', `Bearer ${userToken}`);

          expect(response.status).toBe(200);
          expect(response.body).toHaveLength(1);
          expect(response.body[0]).toMatchObject({
            event_type: 'timeout',
            team_id: club1.id,
            player_id: null
          });
          expect(response.body[0].player_name).toBeNull();
          expect(response.body[0]).toHaveProperty('club_name');
        } catch (error) {
          global.testContext?.logTestError(error, 'Team-level event handling failed');
          throw error;
        }
      });

      it('❌ should reject invalid game ID parameter', async () => {
        try {
          const response = await request(app)
            .get('/api/match-events/games/invalid/events')
            .set('Authorization', `Bearer ${userToken}`);

          expect(response.status).toBe(400);
          expect(response.body.errors).toBeDefined();
        } catch (error) {
          global.testContext?.logTestError(error, 'Invalid game ID validation failed');
          throw error;
        }
      });
    });

    describe('✅ POST /api/match-events/events', () => {
      const validEventData = {
        game_id: null, // Will be set in tests
        event_type: 'foul',
        team_id: null, // Will be set in tests
        player_id: null, // Will be set in tests
        period: 1,
        time_remaining: '00:07:20',
        details: { reason: 'defensive_interference' }
      };

      it('✅ should create game event as admin', async () => {
        try {
          const eventData = {
            ...validEventData,
            game_id: game.id,
            team_id: club1.id,
            player_id: player1.id
          };

          const response = await request(app)
            .post('/api/match-events/events')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(eventData);

          expect(response.status).toBe(201);
          expect(response.body).toMatchObject({
            game_id: game.id,
            event_type: 'foul',
            team_id: club1.id,
            player_id: player1.id,
            period: 1
          });
          expect(response.body).toHaveProperty('id');
          expect(response.body).toHaveProperty('created_at');
        } catch (error) {
          global.testContext?.logTestError(error, 'Admin event creation failed');
          throw error;
        }
      });

      it('✅ should create game event as coach', async () => {
        try {
          const eventData = {
            ...validEventData,
            game_id: game.id,
            team_id: club2.id,
            player_id: player2.id,
            event_type: 'substitution'
          };

          const response = await request(app)
            .post('/api/match-events/events')
            .set('Authorization', `Bearer ${coachToken}`)
            .send(eventData);

          expect(response.status).toBe(201);
          expect(response.body.event_type).toBe('substitution');
        } catch (error) {
          global.testContext?.logTestError(error, 'Coach event creation failed');
          throw error;
        }
      });

      it('✅ should create team-level event without player', async () => {
        try {
          const eventData = {
            ...validEventData,
            game_id: game.id,
            team_id: club1.id,
            player_id: undefined, // No player for timeout
            event_type: 'timeout'
          };
          delete eventData.player_id; // Remove player_id completely

          const response = await request(app)
            .post('/api/match-events/events')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(eventData);

          expect(response.status).toBe(201);
          expect(response.body).toMatchObject({
            event_type: 'timeout',
            team_id: club1.id,
            player_id: null
          });
        } catch (error) {
          global.testContext?.logTestError(error, 'Team-level event creation failed');
          throw error;
        }
      });

      it('❌ should reject regular user creating events', async () => {
        try {
          const eventData = {
            ...validEventData,
            game_id: game.id,
            team_id: club1.id,
            player_id: player1.id
          };

          const response = await request(app)
            .post('/api/match-events/events')
            .set('Authorization', `Bearer ${userToken}`)
            .send(eventData);

          expect(response.status).toBe(403);
        } catch (error) {
          global.testContext?.logTestError(error, 'User permission rejection failed');
          throw error;
        }
      });

      it('❌ should reject invalid event type', async () => {
        try {
          const eventData = {
            ...validEventData,
            game_id: game.id,
            team_id: club1.id,
            event_type: 'invalid_event'
          };

          const response = await request(app)
            .post('/api/match-events/events')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(eventData);

          expect(response.status).toBe(400);
          expect(response.body.errors).toBeDefined();
          expect(response.body.errors[0].msg).toContain('Event type must be foul, substitution, or timeout');
        } catch (error) {
          global.testContext?.logTestError(error, 'Invalid event type validation failed');
          throw error;
        }
      });

      it('❌ should reject event for non-existent game', async () => {
        try {
          const eventData = {
            ...validEventData,
            game_id: 99999,
            team_id: club1.id,
            player_id: player1.id
          };

          const response = await request(app)
            .post('/api/match-events/events')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(eventData);

          expect(response.status).toBe(404);
          expect(response.body.error).toBe('Game not found');
        } catch (error) {
          global.testContext?.logTestError(error, 'Non-existent game validation failed');
          throw error;
        }
      });

      it('❌ should reject event for non-progress game', async () => {
        try {
          // Create a scheduled game
          const scheduledGameResult = await db.query(
            'INSERT INTO games (home_club_id, away_club_id, status, date) VALUES ($1, $2, $3, $4) RETURNING *',
            [club1.id, club2.id, 'scheduled', new Date()]
          );

          const eventData = {
            ...validEventData,
            game_id: scheduledGameResult.rows[0].id,
            team_id: club1.id,
            player_id: player1.id
          };

          const response = await request(app)
            .post('/api/match-events/events')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(eventData);

          expect(response.status).toBe(400);
          expect(response.body.error).toBe('Invalid game status');
          expect(response.body.details).toContain('Events can only be recorded for games in progress');

          // Clean up
          await db.query('DELETE FROM games WHERE id = $1', [scheduledGameResult.rows[0].id]);
        } catch (error) {
          global.testContext?.logTestError(error, 'Non-progress game validation failed');
          throw error;
        }
      });

      it('❌ should reject event when player not in team', async () => {
        try {
          const eventData = {
            ...validEventData,
            game_id: game.id,
            team_id: club2.id, // team2
            player_id: player1.id // but player1 belongs to team1
          };

          const response = await request(app)
            .post('/api/match-events/events')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(eventData);

          expect(response.status).toBe(400);
          expect(response.body.error).toBe('Player does not belong to the specified team');
        } catch (error) {
          global.testContext?.logTestError(error, 'Player-team validation failed');
          throw error;
        }
      });

      it('❌ should reject event for non-existent player', async () => {
        try {
          const eventData = {
            ...validEventData,
            game_id: game.id,
            team_id: club1.id,
            player_id: 99999
          };

          const response = await request(app)
            .post('/api/match-events/events')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(eventData);

          expect(response.status).toBe(404);
          expect(response.body.error).toBe('Player not found');
        } catch (error) {
          global.testContext?.logTestError(error, 'Non-existent player validation failed');
          throw error;
        }
      });

      it('❌ should require authentication', async () => {
        try {
          const eventData = {
            ...validEventData,
            game_id: game.id,
            team_id: club1.id,
            player_id: player1.id
          };

          const response = await request(app)
            .post('/api/match-events/events')
            .send(eventData);

          expect(response.status).toBe(401);
        } catch (error) {
          global.testContext?.logTestError(error, 'Authentication requirement failed');
          throw error;
        }
      });
    });
  });

  describe('🔧 Edge Cases and Validation', () => {
    it('🔧 should handle database errors gracefully for shots', async () => {
      try {
        // Mock a database error by using invalid SQL
        const invalidShotData = {
          game_id: game.id,
          player_id: player1.id,
          team_id: club1.id,
          x_coord: 'invalid_coord', // This should cause a database error
          y_coord: 8.3,
          result: 'goal',
          period: 1,
          time_remaining: '00:08:45'
        };

        const response = await request(app)
          .post('/api/match-events/shots')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(invalidShotData);

        expect([400, 500]).toContain(response.status);
      } catch (error) {
        global.testContext?.logTestError(error, 'Database error handling failed');
        throw error;
      }
    });

    it('🔧 should handle database errors gracefully for events', async () => {
      try {
        const response = await request(app)
          .get('/api/match-events/games/99999/events')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
      } catch (error) {
        global.testContext?.logTestError(error, 'Database error handling for events failed');
        throw error;
      }
    });

    it('🔧 should handle missing optional fields in shots', async () => {
      try {
        const minimalShotData = {
          game_id: game.id,
          player_id: player1.id,
          team_id: club1.id,
          x_coord: 10.0,
          y_coord: 15.0,
          result: 'miss',
          period: 2,
          time_remaining: '00:05:30'
          // shot_type and distance are optional
        };

        const response = await request(app)
          .post('/api/match-events/shots')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(minimalShotData);

        expect(response.status).toBe(201);
        expect(response.body.shot_type).toBeNull();
        expect(response.body.distance).toBeNull();
      } catch (error) {
        global.testContext?.logTestError(error, 'Optional fields handling failed');
        throw error;
      }
    });

    it('🔧 should handle missing optional fields in events', async () => {
      try {
        const minimalEventData = {
          game_id: game.id,
          event_type: 'timeout',
          team_id: club1.id,
          period: 2,
          time_remaining: '00:03:45'
          // player_id and details are optional
        };

        const response = await request(app)
          .post('/api/match-events/events')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(minimalEventData);

        expect(response.status).toBe(201);
        expect(response.body.player_id).toBeNull();
        expect(response.body.details).toBeNull();
      } catch (error) {
        global.testContext?.logTestError(error, 'Optional fields handling for events failed');
        throw error;
      }
    });
  });

  console.log('✅ Match Events API tests completed');
});


