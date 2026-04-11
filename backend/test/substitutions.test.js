import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

describe('🔄 Substitutions API', () => {
  let authToken;
  let coachToken;
  let viewerToken;
  let adminUser;
  let coachUser;
  let viewerUser;
  let homeTeam;
  let awayTeam;
  let testGame;
  let homePlayer1; // On court
  let homePlayer2; // On court
  let homePlayer3; // On bench
  let homePlayer4; // On bench
  let awayPlayer1; // On court
  let awayPlayer2; // On bench

  beforeAll(async () => {
    console.log('🔧 Setting up Substitutions API tests...');
    try {
      // Use unique identifiers to prevent conflicts in CI
      const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Create test users with unique names
      const adminResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [`admin_sub_${uniqueId}`, `admin_sub_${uniqueId}@test.com`, 'hash', 'admin']
      );
      adminUser = adminResult.rows[0];
      authToken = jwt.sign({ userId: adminUser.id, username: adminUser.username, role: 'admin' }, process.env.JWT_SECRET);

      const coachResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [`coach_sub_${uniqueId}`, `coach_sub_${uniqueId}@test.com`, 'hash', 'coach']
      );
      coachUser = coachResult.rows[0];
      coachToken = jwt.sign({ userId: coachUser.id, username: coachUser.username, role: 'coach' }, process.env.JWT_SECRET);

      const viewerResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [`viewer_sub_${uniqueId}`, `viewer_sub_${uniqueId}@test.com`, 'hash', 'viewer']
      );
      viewerUser = viewerResult.rows[0];
      viewerToken = jwt.sign({ userId: viewerUser.id, username: viewerUser.username, role: 'viewer' }, process.env.JWT_SECRET);

      // Validate tokens were created successfully
      if (!authToken || !coachToken || !viewerToken) {
        throw new Error('Failed to create one or more JWT tokens for test users');
      }

      // Create test teams with unique names
      const homeResult = await db.query(
        'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
        [`Sub Home Team ${uniqueId}`]
      );
      homeTeam = homeResult.rows[0];

      const awayResult = await db.query(
        'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
        [`Sub Away Team ${uniqueId}`]
      );
      awayTeam = awayResult.rows[0];

      // Create test players
      const hp1 = await db.query(
        'INSERT INTO players (club_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [homeTeam.id, 'Starting', 'Forward', 10, 'male']
      );
      homePlayer1 = hp1.rows[0];

      const hp2 = await db.query(
        'INSERT INTO players (club_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [homeTeam.id, 'Starting', 'Guard', 15, 'female']
      );
      homePlayer2 = hp2.rows[0];

      const hp3 = await db.query(
        'INSERT INTO players (club_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [homeTeam.id, 'Bench', 'Forward', 20, 'male']
      );
      homePlayer3 = hp3.rows[0];

      const hp4 = await db.query(
        'INSERT INTO players (club_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [homeTeam.id, 'Bench', 'Guard', 25, 'female']
      );
      homePlayer4 = hp4.rows[0];

      const ap1 = await db.query(
        'INSERT INTO players (club_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [awayTeam.id, 'Away', 'Player', 12, 'male']
      );
      awayPlayer1 = ap1.rows[0];

      const ap2 = await db.query(
        'INSERT INTO players (club_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [awayTeam.id, 'Away', 'Bench', 18, 'male']
      );
      awayPlayer2 = ap2.rows[0];

      // Create test game
      const gameResult = await db.query(
        `INSERT INTO games (home_club_id, away_club_id, date, status) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [homeTeam.id, awayTeam.id, new Date(), 'in_progress']
      );
      testGame = gameResult.rows[0];

      // Create game roster (starting lineup)
      await db.query(
        `INSERT INTO game_rosters (game_id, club_id, player_id, is_captain, is_starting) 
         VALUES ($1, $2, $3, $4, $5)`,
        [testGame.id, homeTeam.id, homePlayer1.id, true, true]
      );
      await db.query(
        `INSERT INTO game_rosters (game_id, club_id, player_id, is_captain, is_starting) 
         VALUES ($1, $2, $3, $4, $5)`,
        [testGame.id, homeTeam.id, homePlayer2.id, false, true]
      );
      await db.query(
        `INSERT INTO game_rosters (game_id, club_id, player_id, is_captain, is_starting) 
         VALUES ($1, $2, $3, $4, $5)`,
        [testGame.id, homeTeam.id, homePlayer3.id, false, false]
      );
      await db.query(
        `INSERT INTO game_rosters (game_id, club_id, player_id, is_captain, is_starting) 
         VALUES ($1, $2, $3, $4, $5)`,
        [testGame.id, homeTeam.id, homePlayer4.id, false, false]
      );
      await db.query(
        `INSERT INTO game_rosters (game_id, club_id, player_id, is_captain, is_starting) 
         VALUES ($1, $2, $3, $4, $5)`,
        [testGame.id, awayTeam.id, awayPlayer1.id, true, true]
      );
      await db.query(
        `INSERT INTO game_rosters (game_id, club_id, player_id, is_captain, is_starting) 
         VALUES ($1, $2, $3, $4, $5)`,
        [testGame.id, awayTeam.id, awayPlayer2.id, false, false]
      );
    } catch (error) {
      global.testContext.logTestError(error, 'Substitutions API setup failed');
      throw error;
    }
  });

  afterAll(async () => {
    console.log('✅ Substitutions API tests completed');
    try {
      // Clean up in reverse order of foreign key dependencies
      await db.query('DELETE FROM substitutions WHERE game_id = $1', [testGame.id]);
      await db.query('DELETE FROM game_rosters WHERE game_id = $1', [testGame.id]);
      await db.query('DELETE FROM games WHERE id = $1', [testGame.id]);
      await db.query('DELETE FROM players WHERE club_id = ANY($1)', [[homeTeam.id, awayTeam.id]]);
      await db.query('DELETE FROM clubs WHERE id = ANY($1)', [[homeTeam.id, awayTeam.id]]);
      await db.query('DELETE FROM users WHERE id = ANY($1)', [[adminUser.id, coachUser.id, viewerUser.id]]);
    } catch (error) {
      console.error('⚠️ Substitutions API cleanup failed:', error.message);
    }
  });

  describe('📝 POST /api/substitutions/:gameId', () => {
    afterEach(async () => {
      // Clean up substitutions after each test
      await db.query('DELETE FROM substitutions WHERE game_id = $1', [testGame.id]);
    });

    it('✅ should record a valid substitution', async () => {
      try {
        const response = await request(app)
          .post(`/api/substitutions/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            club_id: homeTeam.id,
            player_in_id: homePlayer3.id, // From bench
            player_out_id: homePlayer1.id, // From court
            period: 1,
            time_remaining: '00:05:30',
            reason: 'tactical'
          });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          game_id: testGame.id,
          club_id: homeTeam.id,
          player_in_id: homePlayer3.id,
          player_out_id: homePlayer1.id,
          period: 1,
          reason: 'tactical'
        });
        expect(response.body.player_in_first_name).toBe('Bench');
        expect(response.body.player_out_first_name).toBe('Starting');
      } catch (error) {
        global.testContext.logTestError(error, 'POST valid substitution failed');
        throw error;
      }
    });

    it('✅ should allow coach to record substitution', async () => {
      try {
        const response = await request(app)
          .post(`/api/substitutions/${testGame.id}`)
          .set('Authorization', `Bearer ${coachToken}`)
          .send({
            club_id: homeTeam.id,
            player_in_id: homePlayer3.id,
            player_out_id: homePlayer1.id,
            period: 1,
            reason: 'fatigue'
          });

        expect(response.status).toBe(201);
        console.log('      ✅ Coach substitution recorded successfully');
      } catch (error) {
        console.log('      ❌ Coach substitution failed:', error.message);
        global.testContext.logTestError(error, 'Coach substitution failed');
        throw error;
      }
    });

    it('✅ should create an unconfirmed substitution idempotently by client_uuid', async () => {
      const payload = {
        club_id: homeTeam.id,
        player_in_id: homePlayer3.id,
        player_out_id: homePlayer1.id,
        period: 1,
        reason: 'tactical',
        client_uuid: '30000000-0000-4000-8000-000000000001',
        event_status: 'unconfirmed'
      };

      const firstResponse = await request(app)
        .post(`/api/substitutions/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(payload);

      expect(firstResponse.status).toBe(201);
      expect(firstResponse.body.event_status).toBe('unconfirmed');

      const secondResponse = await request(app)
        .post(`/api/substitutions/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(payload);

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.id).toBe(firstResponse.body.id);
    });

    test('❌ should reject substitution from viewer role', async () => {
      try {
        const response = await request(app)
          .post(`/api/substitutions/${testGame.id}`)
          .set('Authorization', `Bearer ${viewerToken}`)
          .send({
            club_id: homeTeam.id,
            player_in_id: homePlayer3.id,
            player_out_id: homePlayer1.id,
            period: 1,
            reason: 'tactical'
          });

        expect(response.status).toBe(403);
        console.log('      ✅ Viewer access correctly rejected');
      } catch (error) {
        console.log('      ❌ Viewer access rejection test failed:', error.message);
        global.testContext.logTestError(error, 'Viewer access rejection test failed');
        throw error;
      }
    });

    test('❌ should reject substitution without authentication', async () => {
      try {
        const response = await request(app)
          .post(`/api/substitutions/${testGame.id}`)
          .send({
            club_id: homeTeam.id,
            player_in_id: homePlayer3.id,
            player_out_id: homePlayer1.id,
            period: 1,
            reason: 'tactical'
          });

        expect(response.status).toBe(401);
        console.log('      ✅ Unauthenticated access correctly rejected');
      } catch (error) {
        console.log('      ❌ Authentication rejection test failed:', error.message);
        global.testContext.logTestError(error, 'Authentication rejection test failed');
        throw error;
      }
    });

    test('❌ should reject substitution with same player in and out', async () => {
      try {
        const response = await request(app)
          .post(`/api/substitutions/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            club_id: homeTeam.id,
            player_in_id: homePlayer1.id,
            player_out_id: homePlayer1.id,
            period: 1,
            reason: 'tactical'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('different');
        console.log('      ✅ Same player substitution correctly rejected');
      } catch (error) {
        console.log('      ❌ Same player validation test failed:', error.message);
        global.testContext.logTestError(error, 'Same player validation test failed');
        throw error;
      }
    });

    test('❌ should reject substitution when player_in is already on court', async () => {
      try {
        const response = await request(app)
          .post(`/api/substitutions/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            club_id: homeTeam.id,
            player_in_id: homePlayer1.id, // Already on court
            player_out_id: homePlayer2.id,
            period: 1,
            reason: 'tactical'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('already on the court');
        console.log('      ✅ Player already on court correctly rejected');
      } catch (error) {
        console.log('      ❌ Player on court validation test failed:', error.message);
        global.testContext.logTestError(error, 'Player on court validation test failed');
        throw error;
      }
    });

    test('❌ should reject substitution when player_out is on bench', async () => {
      try {
        const response = await request(app)
          .post(`/api/substitutions/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            club_id: homeTeam.id,
            player_in_id: homePlayer3.id,
            player_out_id: homePlayer4.id, // Already on bench
            period: 1,
            reason: 'tactical'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('not currently on the court');
        console.log('      ✅ Player on bench correctly rejected');
      } catch (error) {
        console.log('      ❌ Player on bench validation test failed:', error.message);
        global.testContext.logTestError(error, 'Player on bench validation test failed');
        throw error;
      }
    });

    test('❌ should reject substitution for non-existent game', async () => {
      try {
        const response = await request(app)
          .post('/api/substitutions/99999')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            club_id: homeTeam.id,
            player_in_id: homePlayer3.id,
            player_out_id: homePlayer1.id,
            period: 1,
            reason: 'tactical'
          });

        expect(response.status).toBe(404);
        console.log('      ✅ Non-existent game correctly rejected');
      } catch (error) {
        console.log('      ❌ Non-existent game test failed:', error.message);
        global.testContext.logTestError(error, 'Non-existent game test failed');
        throw error;
      }
    });

    test('❌ should reject substitution for game not in progress', async () => {
      try {
        // Create a completed game
        const completedGameResult = await db.query(
          `INSERT INTO games (home_club_id, away_club_id, date, status) 
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [homeTeam.id, awayTeam.id, new Date(), 'completed']
        );
        const completedGame = completedGameResult.rows[0];

        const response = await request(app)
          .post(`/api/substitutions/${completedGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            club_id: homeTeam.id,
            player_in_id: homePlayer3.id,
            player_out_id: homePlayer1.id,
            period: 1,
            reason: 'tactical'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('not in progress');

        // Cleanup
        await db.query('DELETE FROM games WHERE id = $1', [completedGame.id]);
        console.log('      ✅ Completed game substitution correctly rejected');
      } catch (error) {
        console.log('      ❌ Game status validation test failed:', error.message);
        global.testContext.logTestError(error, 'Game status validation test failed');
        throw error;
      }
    });

    test('❌ should reject substitution with invalid reason', async () => {
      try {
        const response = await request(app)
          .post(`/api/substitutions/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            club_id: homeTeam.id,
            player_in_id: homePlayer3.id,
            player_out_id: homePlayer1.id,
            period: 1,
            reason: 'invalid_reason'
          });

        expect(response.status).toBe(400);
        console.log('      ✅ Invalid reason correctly rejected');
      } catch (error) {
        console.log('      ❌ Invalid reason validation test failed:', error.message);
        global.testContext.logTestError(error, 'Invalid reason validation test failed');
        throw error;
      }
    });

    test('❌ should reject substitution with players from different teams', async () => {
      try {
        const response = await request(app)
          .post(`/api/substitutions/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            club_id: homeTeam.id,
            player_in_id: awayPlayer2.id, // Away team player
            player_out_id: homePlayer1.id, // Home team player
            period: 1,
            reason: 'tactical'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('specified club');
        console.log('      ✅ Cross-team substitution correctly rejected');
      } catch (error) {
        console.log('      ❌ Cross-team validation test failed:', error.message);
        global.testContext.logTestError(error, 'Cross-team validation test failed');
        throw error;
      }
    });

    test('✅ should handle multiple consecutive substitutions correctly', async () => {
      try {
        // First substitution: homePlayer1 out, homePlayer3 in
        const response1 = await request(app)
          .post(`/api/substitutions/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            club_id: homeTeam.id,
            player_in_id: homePlayer3.id,
            player_out_id: homePlayer1.id,
            period: 1,
            reason: 'tactical'
          });

        expect(response1.status).toBe(201);

        // Second substitution: homePlayer2 out, homePlayer4 in
        const response2 = await request(app)
          .post(`/api/substitutions/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            club_id: homeTeam.id,
            player_in_id: homePlayer4.id,
            player_out_id: homePlayer2.id,
            period: 1,
            reason: 'fatigue'
          });

        expect(response2.status).toBe(201);

        // Third substitution: bring homePlayer1 back in, homePlayer3 out
        const response3 = await request(app)
          .post(`/api/substitutions/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            club_id: homeTeam.id,
            player_in_id: homePlayer1.id,
            player_out_id: homePlayer3.id,
            period: 2,
            reason: 'tactical'
          });

        expect(response3.status).toBe(201);
        console.log('      ✅ Multiple consecutive substitutions handled correctly');
      } catch (error) {
        console.log('      ❌ Multiple substitutions test failed:', error.message);
        global.testContext.logTestError(error, 'Multiple substitutions test failed');
        throw error;
      }
    });
  });

  describe('📊 GET /api/substitutions/:gameId', () => {
    beforeEach(async () => {
      // Create test substitutions
      await db.query(
        `INSERT INTO substitutions (game_id, club_id, player_in_id, player_out_id, period, time_remaining, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [testGame.id, homeTeam.id, homePlayer3.id, homePlayer1.id, 1, '00:05:00', 'tactical']
      );
      await db.query(
        `INSERT INTO substitutions (game_id, club_id, player_in_id, player_out_id, period, time_remaining, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [testGame.id, homeTeam.id, homePlayer4.id, homePlayer2.id, 2, '00:03:00', 'fatigue']
      );
      await db.query(
        `INSERT INTO substitutions (game_id, club_id, player_in_id, player_out_id, period, time_remaining, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [testGame.id, awayTeam.id, awayPlayer2.id, awayPlayer1.id, 1, '00:04:00', 'injury']
      );
    });

    afterEach(async () => {
      await db.query('DELETE FROM substitutions WHERE game_id = $1', [testGame.id]);
    });

    test('✅ should fetch all substitutions for a game', async () => {
      try {
        const response = await request(app)
          .get(`/api/substitutions/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(3);
        expect(response.body[0]).toHaveProperty('player_in_first_name');
        expect(response.body[0]).toHaveProperty('player_out_first_name');
        expect(response.body[0]).toHaveProperty('club_name');
        console.log('      ✅ All substitutions fetched successfully');
      } catch (error) {
        console.log('      ❌ Fetch all substitutions test failed:', error.message);
        global.testContext.logTestError(error, 'Fetch all substitutions test failed');
        throw error;
      }
    });

    test('✅ should filter substitutions by team', async () => {
      try {
        const response = await request(app)
          .get(`/api/substitutions/${testGame.id}?club_id=${homeTeam.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
        expect(response.body.every(sub => sub.club_id === homeTeam.id)).toBe(true);
        console.log('      ✅ Team filtering works correctly');
      } catch (error) {
        console.log('      ❌ Team filtering test failed:', error.message);
        global.testContext.logTestError(error, 'Team filtering test failed');
        throw error;
      }
    });

    test('✅ should filter substitutions by period', async () => {
      try {
        const response = await request(app)
          .get(`/api/substitutions/${testGame.id}?period=1`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
        expect(response.body.every(sub => sub.period === 1)).toBe(true);
        console.log('      ✅ Period filtering works correctly');
      } catch (error) {
        console.log('      ❌ Period filtering test failed:', error.message);
        global.testContext.logTestError(error, 'Period filtering test failed');
        throw error;
      }
    });

    test('✅ should filter substitutions by player', async () => {
      try {
        const response = await request(app)
          .get(`/api/substitutions/${testGame.id}?player_id=${homePlayer1.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].player_out_id).toBe(homePlayer1.id);
        console.log('      ✅ Player filtering works correctly');
      } catch (error) {
        console.log('      ❌ Player filtering test failed:', error.message);
        global.testContext.logTestError(error, 'Player filtering test failed');
        throw error;
      }
    });

    test('✅ should return empty array for game with no substitutions', async () => {
      try {
        const newGameResult = await db.query(
          `INSERT INTO games (home_club_id, away_club_id, date, status) 
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [homeTeam.id, awayTeam.id, new Date(), 'in_progress']
        );
        const newGame = newGameResult.rows[0];

        const response = await request(app)
          .get(`/api/substitutions/${newGame.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(0);

        // Cleanup
        await db.query('DELETE FROM games WHERE id = $1', [newGame.id]);
        console.log('      ✅ Empty substitutions list handled correctly');
      } catch (error) {
        console.log('      ❌ Empty substitutions test failed:', error.message);
        global.testContext.logTestError(error, 'Empty substitutions test failed');
        throw error;
      }
    });

    test('✅ should filter substitutions by event status', async () => {
      try {
        await db.query(
          `INSERT INTO substitutions (game_id, club_id, player_in_id, player_out_id, period, reason, event_status, client_uuid)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [testGame.id, homeTeam.id, homePlayer3.id, homePlayer1.id, 3, 'tactical', 'unconfirmed', '30000000-0000-4000-8000-000000000002']
        );

        const response = await request(app)
          .get(`/api/substitutions/${testGame.id}?event_status=unconfirmed`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.length).toBeGreaterThan(0);
        expect(response.body.every(substitution => substitution.event_status === 'unconfirmed')).toBe(true);
      } catch (error) {
        global.testContext.logTestError(error, 'Substitution event status filtering failed');
        throw error;
      }
    });
  });

  describe('🏃 GET /api/substitutions/:gameId/active-players', () => {
    afterEach(async () => {
      await db.query('DELETE FROM substitutions WHERE game_id = $1', [testGame.id]);
    });

    test('✅ should return starting lineup when no substitutions made', async () => {
      try {
        const response = await request(app)
          .get(`/api/substitutions/${testGame.id}/active-players`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('home_team');
        expect(response.body).toHaveProperty('away_team');
        expect(response.body.home_team.active).toHaveLength(2); // homePlayer1, homePlayer2
        expect(response.body.home_team.bench).toHaveLength(2); // homePlayer3, homePlayer4
        expect(response.body.away_team.active).toHaveLength(1); // awayPlayer1
        expect(response.body.away_team.bench).toHaveLength(1); // awayPlayer2
        console.log('      ✅ Starting lineup returned correctly');
      } catch (error) {
        console.log('      ❌ Starting lineup test failed:', error.message);
        global.testContext.logTestError(error, 'Starting lineup test failed');
        throw error;
      }
    });

    test('✅ should reflect substitutions in active players', async () => {
      try {
        // Make a substitution
        await db.query(
          `INSERT INTO substitutions (game_id, club_id, player_in_id, player_out_id, period, reason)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [testGame.id, homeTeam.id, homePlayer3.id, homePlayer1.id, 1, 'tactical']
        );

        const response = await request(app)
          .get(`/api/substitutions/${testGame.id}/active-players`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        
        // homePlayer1 should now be on bench
        const homePlayer1OnBench = response.body.home_team.bench.find(p => p.id === homePlayer1.id);
        expect(homePlayer1OnBench).toBeDefined();
        
        // homePlayer3 should now be active
        const homePlayer3Active = response.body.home_team.active.find(p => p.id === homePlayer3.id);
        expect(homePlayer3Active).toBeDefined();
        console.log('      ✅ Substitution correctly reflected in active players');
      } catch (error) {
        console.log('      ❌ Substitution reflection test failed:', error.message);
        global.testContext.logTestError(error, 'Substitution reflection test failed');
        throw error;
      }
    });

    test('✅ should ignore unconfirmed substitutions when calculating active players', async () => {
      try {
        await db.query(
          `INSERT INTO substitutions (game_id, club_id, player_in_id, player_out_id, period, reason, event_status, client_uuid)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [testGame.id, homeTeam.id, homePlayer3.id, homePlayer1.id, 1, 'tactical', 'unconfirmed', '30000000-0000-4000-8000-000000000003']
        );

        const response = await request(app)
          .get(`/api/substitutions/${testGame.id}/active-players`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.home_team.active.some(player => player.id === homePlayer1.id)).toBe(true);
        expect(response.body.home_team.active.some(player => player.id === homePlayer3.id)).toBe(false);
      } catch (error) {
        global.testContext.logTestError(error, 'Unconfirmed substitution active player test failed');
        throw error;
      }
    });

    test('✅ should handle multiple substitutions correctly', async () => {
      try {
        // Sub 1: homePlayer1 out, homePlayer3 in
        await db.query(
          `INSERT INTO substitutions (game_id, club_id, player_in_id, player_out_id, period, reason)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [testGame.id, homeTeam.id, homePlayer3.id, homePlayer1.id, 1, 'tactical']
        );

        // Sub 2: homePlayer3 out, homePlayer1 in (bringing player back)
        await db.query(
          `INSERT INTO substitutions (game_id, club_id, player_in_id, player_out_id, period, reason)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [testGame.id, homeTeam.id, homePlayer1.id, homePlayer3.id, 2, 'tactical']
        );

        const response = await request(app)
          .get(`/api/substitutions/${testGame.id}/active-players`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        
        // After both subs, homePlayer1 should be back on court
        const homePlayer1Active = response.body.home_team.active.find(p => p.id === homePlayer1.id);
        expect(homePlayer1Active).toBeDefined();
        
        // homePlayer3 should be back on bench
        const homePlayer3OnBench = response.body.home_team.bench.find(p => p.id === homePlayer3.id);
        expect(homePlayer3OnBench).toBeDefined();
        console.log('      ✅ Multiple substitutions handled correctly');
      } catch (error) {
        console.log('      ❌ Multiple substitutions test failed:', error.message);
        global.testContext.logTestError(error, 'Multiple substitutions test failed');
        throw error;
      }
    });

    test('❌ should return 404 for game with no roster', async () => {
      try {
        const newGameResult = await db.query(
          `INSERT INTO games (home_club_id, away_club_id, date, status) 
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [homeTeam.id, awayTeam.id, new Date(), 'scheduled']
        );
        const newGame = newGameResult.rows[0];

        const response = await request(app)
          .get(`/api/substitutions/${newGame.id}/active-players`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(404);
        expect(response.body.error).toContain('No roster found');

        // Cleanup
        await db.query('DELETE FROM games WHERE id = $1', [newGame.id]);
        console.log('      ✅ Game without roster correctly rejected');
      } catch (error) {
        console.log('      ❌ No roster test failed:', error.message);
        global.testContext.logTestError(error, 'No roster test failed');
        throw error;
      }
    });
  });

  describe('🗑️ DELETE /api/substitutions/:gameId/:substitutionId', () => {
    let substitution1;
    let substitution2;

    beforeEach(async () => {
      // Create test substitutions
      const sub1Result = await db.query(
        `INSERT INTO substitutions (game_id, club_id, player_in_id, player_out_id, period, reason)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [testGame.id, homeTeam.id, homePlayer3.id, homePlayer1.id, 1, 'tactical']
      );
      substitution1 = sub1Result.rows[0];

      // Wait a moment to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const sub2Result = await db.query(
        `INSERT INTO substitutions (game_id, club_id, player_in_id, player_out_id, period, reason)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [testGame.id, homeTeam.id, homePlayer4.id, homePlayer2.id, 1, 'fatigue']
      );
      substitution2 = sub2Result.rows[0];
    });

    afterEach(async () => {
      await db.query('DELETE FROM substitutions WHERE game_id = $1', [testGame.id]);
    });

    test('✅ should delete the most recent substitution', async () => {
      try {
        const response = await request(app)
          .delete(`/api/substitutions/${testGame.id}/${substitution2.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('deleted successfully');

        // Verify deletion
        const checkResult = await db.query(
          'SELECT * FROM substitutions WHERE id = $1',
          [substitution2.id]
        );
        expect(checkResult.rows).toHaveLength(0);
        console.log('      ✅ Most recent substitution deleted successfully');
      } catch (error) {
        console.log('      ❌ Delete recent substitution test failed:', error.message);
        global.testContext.logTestError(error, 'Delete recent substitution test failed');
        throw error;
      }
    });

    test('❌ should not delete older substitution when newer exists', async () => {
      try {
        const response = await request(app)
          .delete(`/api/substitutions/${testGame.id}/${substitution1.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('most recent substitution');
        console.log('      ✅ Older substitution deletion correctly rejected');
      } catch (error) {
        console.log('      ❌ Prevent old substitution deletion test failed:', error.message);
        global.testContext.logTestError(error, 'Prevent old substitution deletion test failed');
        throw error;
      }
    });

    test('✅ should allow coach to delete substitution', async () => {
      try {
        const response = await request(app)
          .delete(`/api/substitutions/${testGame.id}/${substitution2.id}`)
          .set('Authorization', `Bearer ${coachToken}`);

        expect(response.status).toBe(200);
        console.log('      ✅ Coach deletion permission verified');
      } catch (error) {
        console.log('      ❌ Coach deletion test failed:', error.message);
        global.testContext.logTestError(error, 'Coach deletion test failed');
        throw error;
      }
    });

    test('❌ should reject deletion from viewer role', async () => {
      try {
        const response = await request(app)
          .delete(`/api/substitutions/${testGame.id}/${substitution2.id}`)
          .set('Authorization', `Bearer ${viewerToken}`);

        expect(response.status).toBe(403);
        console.log('      ✅ Viewer deletion correctly rejected');
      } catch (error) {
        console.log('      ❌ Viewer deletion rejection test failed:', error.message);
        global.testContext.logTestError(error, 'Viewer deletion rejection test failed');
        throw error;
      }
    });

    test('❌ should return 404 for non-existent substitution', async () => {
      try {
        const response = await request(app)
          .delete(`/api/substitutions/${testGame.id}/99999`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(404);
        console.log('      ✅ Non-existent substitution correctly rejected');
      } catch (error) {
        console.log('      ❌ Non-existent substitution test failed:', error.message);
        global.testContext.logTestError(error, 'Non-existent substitution test failed');
        throw error;
      }
    });

    test('✅ should delete when it is the only substitution', async () => {
      try {
        // Delete the second substitution first
        await db.query('DELETE FROM substitutions WHERE id = $1', [substitution2.id]);

        const response = await request(app)
          .delete(`/api/substitutions/${testGame.id}/${substitution1.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        console.log('      ✅ Only substitution deleted successfully');
      } catch (error) {
        console.log('      ❌ Delete only substitution test failed:', error.message);
        global.testContext.logTestError(error, 'Delete only substitution test failed');
        throw error;
      }
    });
  });

  describe('✅ POST /api/substitutions/:gameId/:substitutionId/confirm', () => {
    afterEach(async () => {
      await db.query('DELETE FROM substitutions WHERE game_id = $1', [testGame.id]);
    });

    test('✅ should confirm an unconfirmed substitution', async () => {
      const createResponse = await request(app)
        .post(`/api/substitutions/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          club_id: homeTeam.id,
          player_in_id: homePlayer3.id,
          player_out_id: homePlayer1.id,
          period: 1,
          reason: 'tactical',
          client_uuid: '30000000-0000-4000-8000-000000000004',
          event_status: 'unconfirmed'
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.event_status).toBe('unconfirmed');

      const confirmResponse = await request(app)
        .post(`/api/substitutions/${testGame.id}/${createResponse.body.id}/confirm`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(confirmResponse.status).toBe(200);
      expect(confirmResponse.body.event_status).toBe('confirmed');
    });
  });

  describe('✏️ PUT /api/substitutions/:gameId/:substitutionId', () => {
    afterEach(async () => {
      await db.query('DELETE FROM substitutions WHERE game_id = $1', [testGame.id]);
    });

    test('✅ should update substitution status and reason for review workflow', async () => {
      const createResponse = await request(app)
        .post(`/api/substitutions/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          club_id: homeTeam.id,
          player_in_id: homePlayer3.id,
          player_out_id: homePlayer1.id,
          period: 1,
          reason: 'tactical'
        });

      expect(createResponse.status).toBe(201);

      const updateResponse = await request(app)
        .put(`/api/substitutions/${testGame.id}/${createResponse.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'fatigue',
          event_status: 'unconfirmed'
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.reason).toBe('fatigue');
      expect(updateResponse.body.event_status).toBe('unconfirmed');
    });
  });

  describe('🧪 Edge Cases and Validation', () => {
    afterEach(async () => {
      await db.query('DELETE FROM substitutions WHERE game_id = $1', [testGame.id]);
    });

    test('✅ should handle concurrent substitutions for different teams', async () => {
      try {
        const homeSubPromise = request(app)
          .post(`/api/substitutions/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            club_id: homeTeam.id,
            player_in_id: homePlayer3.id,
            player_out_id: homePlayer1.id,
            period: 1,
            reason: 'tactical'
          });

        const awaySubPromise = request(app)
          .post(`/api/substitutions/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            club_id: awayTeam.id,
            player_in_id: awayPlayer2.id,
            player_out_id: awayPlayer1.id,
            period: 1,
            reason: 'tactical'
          });

        const [homeResponse, awayResponse] = await Promise.all([homeSubPromise, awaySubPromise]);

        expect(homeResponse.status).toBe(201);
        expect(awayResponse.status).toBe(201);
        console.log('      ✅ Concurrent substitutions handled correctly');
      } catch (error) {
        console.log('      ❌ Concurrent substitutions test failed:', error.message);
        global.testContext.logTestError(error, 'Concurrent substitutions test failed');
        throw error;
      }
    });

    test('❌ should validate period is positive integer', async () => {
      try {
        const response = await request(app)
          .post(`/api/substitutions/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            club_id: homeTeam.id,
            player_in_id: homePlayer3.id,
            player_out_id: homePlayer1.id,
            period: -1,
            reason: 'tactical'
          });

        expect(response.status).toBe(400);
        console.log('      ✅ Negative period correctly rejected');
      } catch (error) {
        console.log('      ❌ Period validation test failed:', error.message);
        global.testContext.logTestError(error, 'Period validation test failed');
        throw error;
      }
    });

    test('✅ should accept all valid reason types', async () => {
      try {
        const reasons = ['tactical', 'injury', 'fatigue', 'disciplinary'];

        for (const reason of reasons) {
          const response = await request(app)
            .post(`/api/substitutions/${testGame.id}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              club_id: homeTeam.id,
              player_in_id: homePlayer3.id,
              player_out_id: homePlayer1.id,
              period: 1,
              reason: reason
            });

          expect(response.status).toBe(201);
          expect(response.body.reason).toBe(reason);

          // Clean up for next iteration
          await db.query('DELETE FROM substitutions WHERE game_id = $1', [testGame.id]);
        }
        console.log('      ✅ All valid reason types accepted');
      } catch (error) {
        console.log('      ❌ Valid reasons test failed:', error.message);
        global.testContext.logTestError(error, 'Valid reasons test failed');
        throw error;
      }
    });
  });
});


