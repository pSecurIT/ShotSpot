import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

describe('📋 Game Rosters API', () => {
  let authToken;
  let coachToken;
  let viewerToken;
  let adminUser;
  let coachUser;
  let viewerUser;
  let homeTeam;
  let awayTeam;
  let testGame;
  let homePlayer1;
  let homePlayer2;
  let _homePlayer3;
  let _awayPlayer1;
  let _awayPlayer2;

  beforeAll(async () => {
    try {
      // Use unique identifiers to prevent conflicts in CI
      const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Create test users with unique names
      const adminResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [`admin_roster_${uniqueId}`, `admin_roster_${uniqueId}@test.com`, 'hash', 'admin']
      );
      adminUser = adminResult.rows[0];
      authToken = jwt.sign({ id: adminUser.id, username: adminUser.username, role: 'admin' }, process.env.JWT_SECRET);

      const coachResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [`coach_roster_${uniqueId}`, `coach_roster_${uniqueId}@test.com`, 'hash', 'coach']
      );
      coachUser = coachResult.rows[0];
      coachToken = jwt.sign({ id: coachUser.id, username: coachUser.username, role: 'coach' }, process.env.JWT_SECRET);

      const viewerResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [`viewer_roster_${uniqueId}`, `viewer_roster_${uniqueId}@test.com`, 'hash', 'viewer']
      );
      viewerUser = viewerResult.rows[0];
      viewerToken = jwt.sign({ id: viewerUser.id, username: viewerUser.username, role: 'viewer' }, process.env.JWT_SECRET);

      // Validate tokens were created successfully
      if (!authToken || !coachToken || !viewerToken) {
        throw new Error('Failed to create one or more JWT tokens for test users');
      }

      // Create test teams with unique names
      const homeResult = await db.query(
        'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
        [`Roster Home Team ${uniqueId}`]
      );
      homeTeam = homeResult.rows[0];

      const awayResult = await db.query(
        'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
        [`Roster Away Team ${uniqueId}`]
      );
      awayTeam = awayResult.rows[0];

      // Create test players
      const hp1 = await db.query(
        'INSERT INTO players (club_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [homeTeam.id, 'John', 'Doe', 10, 'male']
      );
      homePlayer1 = hp1.rows[0];

      const hp2 = await db.query(
        'INSERT INTO players (club_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [homeTeam.id, 'Jane', 'Smith', 15, 'female']
      );
      homePlayer2 = hp2.rows[0];

      const hp3 = await db.query(
        'INSERT INTO players (club_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [homeTeam.id, 'Bob', 'Johnson', 20, 'male']
      );
      _homePlayer3 = hp3.rows[0];

      const ap1 = await db.query(
        'INSERT INTO players (club_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [awayTeam.id, 'Alice', 'Williams', 12, 'female']
      );
      _awayPlayer1 = ap1.rows[0];

      const ap2 = await db.query(
        'INSERT INTO players (club_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [awayTeam.id, 'Charlie', 'Brown', 18, 'male']
      );
      _awayPlayer2 = ap2.rows[0];

      // Create test game
      const gameResult = await db.query(
        `INSERT INTO games (home_club_id, away_club_id, date, status) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [homeTeam.id, awayTeam.id, new Date(), 'scheduled']
      );
      testGame = gameResult.rows[0];

      console.log('✅ Game Rosters API test setup completed successfully');
    } catch (error) {
      console.log('❌ Game Rosters API test setup failed:', error.message);
      global.testContext.logTestError(error, 'Game Rosters API test setup failed');
      throw error;
    }
  });

  afterAll(async () => {
    try {
      // Clean up in reverse order of dependencies
      await db.query('DELETE FROM game_rosters WHERE game_id = $1', [testGame.id]);
      await db.query('DELETE FROM games WHERE id = $1', [testGame.id]);
      await db.query('DELETE FROM players WHERE club_id IN ($1, $2)', [homeTeam.id, awayTeam.id]);
      await db.query('DELETE FROM clubs WHERE id IN ($1, $2)', [homeTeam.id, awayTeam.id]);
      await db.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [adminUser.id, coachUser.id, viewerUser.id]);
      await db.closePool();
      console.log('✅ Game Rosters API tests completed');
    } catch (error) {
      console.error('❌ Game Rosters API cleanup error:', error.message);
      global.testContext.logTestError(error, 'Game Rosters API cleanup error');
    }
  });

  beforeEach(async () => {
    try {
      // Clear rosters before each test
      await db.query('DELETE FROM game_rosters WHERE game_id = $1', [testGame.id]);
    } catch (error) {
      console.log('      ❌ Game roster cleanup failed:', error.message);
      global.testContext.logTestError(error, 'Game roster cleanup failed');
      throw error;
    }
  });

  describe('📝 POST /api/game-rosters/:gameId', () => {
    it('✅ should add players to game roster with captain', async () => {
      try {
        const response = await request(app)
          .post(`/api/game-rosters/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            players: [
              { club_id: homeTeam.id, player_id: homePlayer1.id, is_captain: true, is_starting: true },
              { club_id: homeTeam.id, player_id: homePlayer2.id, is_captain: false, is_starting: true }
            ]
          });

        expect(response.status).toBe(201);
        expect(response.body.roster).toHaveLength(2);
        expect(response.body.roster[0].is_captain).toBe(true);
        expect(response.body.roster[1].is_captain).toBe(false);
        console.log('      ✅ Players added to roster with captain successfully');
      } catch (error) {
        console.log('      ❌ Add players with captain test failed:', error.message);
        global.testContext.logTestError(error, 'Add players with captain test failed');
        throw error;
      }
    });

    it('❌ should reject multiple captains for same team', async () => {
      try {
        const response = await request(app)
          .post(`/api/game-rosters/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            players: [
              { club_id: homeTeam.id, player_id: homePlayer1.id, is_captain: true, is_starting: true },
              { club_id: homeTeam.id, player_id: homePlayer2.id, is_captain: true, is_starting: true }
            ]
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Only one captain');
        console.log('      ✅ Multiple captains correctly rejected');
      } catch (error) {
        console.log('      ❌ Multiple captains test failed:', error.message);
        global.testContext.logTestError(error, 'Multiple captains test failed');
        throw error;
      }
    });

    it('❌ should reject if game does not exist', async () => {
      try {
        const response = await request(app)
          .post('/api/game-rosters/99999')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            players: [
              { club_id: homeTeam.id, player_id: homePlayer1.id, is_captain: true, is_starting: true }
            ]
          });

        expect(response.status).toBe(404);
        expect(response.body.error).toContain('not found');
        console.log('      ✅ Non-existent game correctly rejected');
      } catch (error) {
        console.log('      ❌ Non-existent game test failed:', error.message);
        global.testContext.logTestError(error, 'Non-existent game test failed');
        throw error;
      }
    });

    it('❌ should require authentication', async () => {
      try {
        const response = await request(app)
          .post(`/api/game-rosters/${testGame.id}`)
          .send({
            players: [
              { club_id: homeTeam.id, player_id: homePlayer1.id, is_captain: true, is_starting: true }
            ]
          });

        expect(response.status).toBe(401);
        console.log('      ✅ Authentication correctly required');
      } catch (error) {
        console.log('      ❌ Authentication test failed:', error.message);
        global.testContext.logTestError(error, 'Authentication test failed');
        throw error;
      }
    });

    it('❌ should validate required fields', async () => {
      try {
        const response = await request(app)
          .post(`/api/game-rosters/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            players: [
              { club_id: homeTeam.id } // Missing player_id
            ]
          });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
        console.log('      ✅ Field validation correctly enforced');
      } catch (error) {
        console.log('      ❌ Field validation test failed:', error.message);
        global.testContext.logTestError(error, 'Field validation test failed');
        throw error;
      }
    });

    it('✅ should allow coaches to manage rosters', async () => {
      try {
        const response = await request(app)
          .post(`/api/game-rosters/${testGame.id}`)
          .set('Authorization', `Bearer ${coachToken}`)
          .send({
            players: [
              { club_id: homeTeam.id, player_id: homePlayer1.id, is_captain: true, is_starting: true }
            ]
          });

        expect(response.status).toBe(201);
        console.log('      ✅ Coach roster management working correctly');
      } catch (error) {
        console.log('      ❌ Coach roster management test failed:', error.message);
        global.testContext.logTestError(error, 'Coach roster management test failed');
        throw error;
      }
    });
  });

  describe('📊 GET /api/game-rosters/:gameId', () => {
    beforeEach(async () => {
      try {
        // Add some roster entries
        await db.query(
          `INSERT INTO game_rosters (game_id, club_id, player_id, is_captain, is_starting) 
           VALUES ($1, $2, $3, $4, $5), ($1, $2, $6, $7, $8)`,
          [testGame.id, homeTeam.id, homePlayer1.id, true, true, homePlayer2.id, false, true]
        );
        console.log('      ✅ Test roster data prepared');
      } catch (error) {
        console.log('      ❌ Test roster data preparation failed:', error.message);
        global.testContext.logTestError(error, 'Test roster data preparation failed');
        throw error;
      }
    });

    it('✅ should get all roster entries for a game', async () => {
      try {
        const response = await request(app)
          .get(`/api/game-rosters/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.length).toBeGreaterThanOrEqual(2);
        
        const captain = response.body.find(p => p.is_captain);
        expect(captain).toBeDefined();
        expect(captain.first_name).toBeDefined();
        console.log('      ✅ Game roster entries retrieved successfully');
      } catch (error) {
        console.log('      ❌ Get roster entries test failed:', error.message);
        global.testContext.logTestError(error, 'Get roster entries test failed');
        throw error;
      }
    });

    it('✅ should filter by club_id', async () => {
      try {
        const response = await request(app)
          .get(`/api/game-rosters/${testGame.id}?club_id=${homeTeam.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.every(p => p.club_id === homeTeam.id)).toBe(true);
        console.log('      ✅ Team filtering working correctly');
      } catch (error) {
        console.log('      ❌ Team filtering test failed:', error.message);
        global.testContext.logTestError(error, 'Team filtering test failed');
        throw error;
      }
    });

    it('✅ should return empty array if no roster entries', async () => {
      try {
        // Clear roster
        await db.query('DELETE FROM game_rosters WHERE game_id = $1', [testGame.id]);

        const response = await request(app)
          .get(`/api/game-rosters/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
        console.log('      ✅ Empty roster correctly returned');
      } catch (error) {
        console.log('      ❌ Empty roster test failed:', error.message);
        global.testContext.logTestError(error, 'Empty roster test failed');
        throw error;
      }
    });

    it('❌ should require authentication', async () => {
      try {
        const response = await request(app)
          .get(`/api/game-rosters/${testGame.id}`);

        expect(response.status).toBe(401);
        console.log('      ✅ Authentication correctly required');
      } catch (error) {
        console.log('      ❌ Authentication test failed:', error.message);
        global.testContext.logTestError(error, 'Authentication test failed');
        throw error;
      }
    });
  });

  describe('✏️ PUT /api/game-rosters/:gameId/:rosterId', () => {
    let rosterId;

    beforeEach(async () => {
      try {
        // Add a roster entry
        const result = await db.query(
          `INSERT INTO game_rosters (game_id, club_id, player_id, is_captain, is_starting) 
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [testGame.id, homeTeam.id, homePlayer1.id, false, true]
        );
        rosterId = result.rows[0].id;
        console.log('      ✅ Test roster entry prepared');
      } catch (error) {
        console.log('      ❌ Test roster entry preparation failed:', error.message);
        global.testContext.logTestError(error, 'Test roster entry preparation failed');
        throw error;
      }
    });

    it('✅ should update roster entry to make player captain', async () => {
      try {
        const response = await request(app)
          .put(`/api/game-rosters/${testGame.id}/${rosterId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ is_captain: true });

        expect(response.status).toBe(200);
        expect(response.body.is_captain).toBe(true);
        console.log('      ✅ Captain status updated successfully');
      } catch (error) {
        console.log('      ❌ Captain update test failed:', error.message);
        global.testContext.logTestError(error, 'Captain update test failed');
        throw error;
      }
    });

    it('✅ should update starting status', async () => {
      try {
        const response = await request(app)
          .put(`/api/game-rosters/${testGame.id}/${rosterId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ is_starting: false });

        expect(response.status).toBe(200);
        expect(response.body.is_starting).toBe(false);
        console.log('      ✅ Starting status updated successfully');
      } catch (error) {
        console.log('      ❌ Starting status update test failed:', error.message);
        global.testContext.logTestError(error, 'Starting status update test failed');
        throw error;
      }
    });

    it('❌ should return 404 if roster entry not found', async () => {
      try {
        const response = await request(app)
          .put(`/api/game-rosters/${testGame.id}/99999`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ is_captain: true });

        expect(response.status).toBe(404);
        console.log('      ✅ Non-existent roster entry correctly rejected');
      } catch (error) {
        console.log('      ❌ Non-existent roster test failed:', error.message);
        global.testContext.logTestError(error, 'Non-existent roster test failed');
        throw error;
      }
    });

    it('❌ should require authentication', async () => {
      try {
        const response = await request(app)
          .put(`/api/game-rosters/${testGame.id}/${rosterId}`)
          .send({ is_captain: true });

        expect(response.status).toBe(401);
        console.log('      ✅ Authentication correctly required');
      } catch (error) {
        console.log('      ❌ Authentication test failed:', error.message);
        global.testContext.logTestError(error, 'Authentication test failed');
        throw error;
      }
    });
  });

  describe('🗑️ DELETE /api/game-rosters/:gameId/:rosterId', () => {
    let rosterId;

    beforeEach(async () => {
      try {
        const result = await db.query(
          `INSERT INTO game_rosters (game_id, club_id, player_id, is_captain, is_starting) 
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [testGame.id, homeTeam.id, homePlayer1.id, false, true]
        );
        rosterId = result.rows[0].id;
        console.log('      ✅ Test roster entry for deletion prepared');
      } catch (error) {
        console.log('      ❌ Test roster entry for deletion preparation failed:', error.message);
        global.testContext.logTestError(error, 'Test roster entry for deletion preparation failed');
        throw error;
      }
    });

    it('✅ should remove player from roster', async () => {
      try {
        const response = await request(app)
          .delete(`/api/game-rosters/${testGame.id}/${rosterId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(204);
        
        // Verify deleted
        const check = await db.query('SELECT * FROM game_rosters WHERE id = $1', [rosterId]);
        expect(check.rows.length).toBe(0);
        console.log('      ✅ Player removed from roster successfully');
      } catch (error) {
        console.log('      ❌ Remove player test failed:', error.message);
        global.testContext.logTestError(error, 'Remove player test failed');
        throw error;
      }
    });

    it('❌ should return 404 if roster entry not found', async () => {
      try {
        const response = await request(app)
          .delete(`/api/game-rosters/${testGame.id}/99999`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(404);
        console.log('      ✅ Non-existent roster entry correctly rejected');
      } catch (error) {
        console.log('      ❌ Non-existent roster entry test failed:', error.message);
        global.testContext.logTestError(error, 'Non-existent roster entry test failed');
        throw error;
      }
    });

    it('❌ should require authentication', async () => {
      try {
        const response = await request(app)
          .delete(`/api/game-rosters/${testGame.id}/${rosterId}`);

        expect(response.status).toBe(401);
        console.log('      ✅ Authentication correctly required');
      } catch (error) {
        console.log('      ❌ Authentication test failed:', error.message);
        global.testContext.logTestError(error, 'Authentication test failed');
        throw error;
      }
    });
  });

  describe('🔒 Authorization', () => {
    it('❌ should deny viewers from managing rosters', async () => {
      try {
        const response = await request(app)
          .post(`/api/game-rosters/${testGame.id}`)
          .set('Authorization', `Bearer ${viewerToken}`)
          .send({
            players: [
              { club_id: homeTeam.id, player_id: homePlayer1.id, is_captain: true, is_starting: true }
            ]
          });

        expect(response.status).toBe(403);
        console.log('      ✅ Viewer access correctly denied');
      } catch (error) {
        console.log('      ❌ Viewer authorization test failed:', error.message);
        global.testContext.logTestError(error, 'Viewer authorization test failed');
        throw error;
      }
    });
  });

  describe('🧪 Edge Cases', () => {
    it('✅ should handle large roster (10 players)', async () => {
      try {
        // Create additional players
        const players = [];
        for (let i = 0; i < 10; i++) {
          const player = await db.query(
            'INSERT INTO players (club_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [homeTeam.id, `Player${i}`, `Test${i}`, 30 + i, i % 2 === 0 ? 'male' : 'female']
          );
          players.push({
            club_id: homeTeam.id,
            player_id: player.rows[0].id,
            is_captain: i === 0, // First player is captain
            is_starting: i < 4 // First 4 are starting
          });
        }

        const response = await request(app)
          .post(`/api/game-rosters/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ players });

        expect(response.status).toBe(201);
        expect(response.body.roster).toHaveLength(10);
        console.log('      ✅ Large roster (10 players) handled successfully');
      } catch (error) {
        console.log('      ❌ Large roster test failed:', error.message);
        global.testContext.logTestError(error, 'Large roster test failed');
        throw error;
      }
    });

    it('❌ should handle empty roster', async () => {
      try {
        const response = await request(app)
          .post(`/api/game-rosters/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ players: [] });

        expect(response.status).toBe(201);
        expect(response.body.roster).toEqual([]);
        console.log('      ✅ Empty roster handled successfully');
      } catch (error) {
        console.log('      ❌ Empty roster test failed:', error.message);
        global.testContext.logTestError(error, 'Empty roster test failed');
        throw error;
      }
    });

    it('✅ should replace existing roster when posting new one', async () => {
      try {
        // Add initial roster
        await request(app)
          .post(`/api/game-rosters/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            players: [
              { club_id: homeTeam.id, player_id: homePlayer1.id, is_captain: true, is_starting: true }
            ]
          });

        // Replace with new roster
        const response = await request(app)
          .post(`/api/game-rosters/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            players: [
              { club_id: homeTeam.id, player_id: homePlayer2.id, is_captain: true, is_starting: true }
            ]
          });

        expect(response.status).toBe(201);
        expect(response.body.roster).toHaveLength(1);
        expect(response.body.roster[0].player_id).toBe(homePlayer2.id);
        
        // Verify old roster is gone
        const check = await db.query(
          'SELECT * FROM game_rosters WHERE game_id = $1 AND player_id = $2',
          [testGame.id, homePlayer1.id]
        );
        expect(check.rows.length).toBe(0);
        console.log('      ✅ Roster replacement working correctly');
      } catch (error) {
        console.log('      ❌ Roster replacement test failed:', error.message);
        global.testContext.logTestError(error, 'Roster replacement test failed');
        throw error;
      }
    });
  });
});


