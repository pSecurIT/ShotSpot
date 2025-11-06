import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

// Helper function to generate truly unique names
const generateUniqueTeamName = (prefix = 'Team') => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const processId = process.pid;
  return `${prefix}_${timestamp}_${random}_${processId}`;
};

describe('🏀 Shot Routes', () => {
  let authToken;
  let coachToken;
  let userToken;
  let adminUser;
  let coachUser;
  let regularUser;
  let team1;
  let team2;
  let player1;
  let player2;
  let testGame;

  beforeAll(async () => {
    console.log('🔧 Setting up Shot Routes tests...');
    try {
      // Use unique identifiers to prevent conflicts in CI
      const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Create test users with different roles and unique names
      const adminResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
        [`admin_shots_${uniqueId}`, `admin_shots_${uniqueId}@test.com`, 'hash', 'admin']
      );
      adminUser = adminResult.rows[0];
      authToken = jwt.sign({ id: adminUser.id, role: 'admin' }, process.env.JWT_SECRET);

      const coachResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
        [`coach_shots_${uniqueId}`, `coach_shots_${uniqueId}@test.com`, 'hash', 'coach']
      );
      coachUser = coachResult.rows[0];
      coachToken = jwt.sign({ id: coachUser.id, role: 'coach' }, process.env.JWT_SECRET);

      const userResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
        [`user_shots_${uniqueId}`, `user_shots_${uniqueId}@test.com`, 'hash', 'user']
      );
      regularUser = userResult.rows[0];
      userToken = jwt.sign({ id: regularUser.id, role: 'user' }, process.env.JWT_SECRET);

      // Validate tokens were created successfully
      if (!authToken || !coachToken || !userToken) {
        throw new Error('Failed to create one or more JWT tokens for test users');
      }

      // Create test teams with unique names
      const team1Result = await db.query(
        'INSERT INTO teams (name) VALUES ($1) RETURNING *',
        [`Shot Test Team 1 ${uniqueId}`]
      );
      team1 = team1Result.rows[0];

      const team2Result = await db.query(
        'INSERT INTO teams (name) VALUES ($1) RETURNING *',
        [`Shot Test Team 2 ${uniqueId}`]
      );
      team2 = team2Result.rows[0];

      // Create test players
      const player1Result = await db.query(
        'INSERT INTO players (team_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4) RETURNING *',
        [team1.id, 'John', 'Shooter', 10]
      );
      player1 = player1Result.rows[0];

      const player2Result = await db.query(
        'INSERT INTO players (team_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4) RETURNING *',
        [team2.id, 'Jane', 'Scorer', 15]
      );
      player2 = player2Result.rows[0];

      // Create a test game in progress
      const gameResult = await db.query(
        `INSERT INTO games (home_team_id, away_team_id, date, status)
       VALUES ($1, $2, $3, 'in_progress') RETURNING *`,
        [team1.id, team2.id, new Date('2025-11-01T14:00:00Z')]
      );
      testGame = gameResult.rows[0];
    } catch (error) {
      global.testContext.logTestError(error, 'Shot Routes setup failed');
      throw error;
    }
  });

  afterAll(async () => {
    console.log('✅ Shot Routes tests completed');
    try {
      // Clean up test data
      await db.query('DELETE FROM shots WHERE game_id = $1', [testGame.id]);
      await db.query('DELETE FROM games WHERE id = $1', [testGame.id]);
      await db.query('DELETE FROM players WHERE id IN ($1, $2)', [player1.id, player2.id]);
      await db.query('DELETE FROM teams WHERE id IN ($1, $2)', [team1.id, team2.id]);
      await db.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [adminUser.id, coachUser.id, regularUser.id]);
    } catch (error) {
      console.error('⚠️ Shot Routes cleanup failed:', error.message);
    }
  });

  describe('📝 POST /api/shots/:gameId', () => {
    it('✅ should create a shot as admin', async () => {
      try {
        const shotData = {
          player_id: player1.id,
          team_id: team1.id,
          x_coord: 45.5,
          y_coord: 30.2,
          result: 'goal',
          period: 1,
          time_remaining: '10:00:00',
          shot_type: 'jump shot',
          distance: 5.5
        };

        const response = await request(app)
          .post(`/api/shots/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send(shotData);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body.player_id).toBe(player1.id);
        expect(response.body.team_id).toBe(team1.id);
        expect(response.body.result).toBe('goal');
        expect(parseFloat(response.body.x_coord)).toBeCloseTo(45.5);
        expect(parseFloat(response.body.y_coord)).toBeCloseTo(30.2);
        expect(response.body.first_name).toBe('John');
        expect(response.body.last_name).toBe('Shooter');

        // Verify score was updated
        const gameCheck = await db.query('SELECT * FROM games WHERE id = $1', [testGame.id]);
        expect(gameCheck.rows[0].home_score).toBe(1);
      } catch (error) {
        global.testContext.logTestError(error, 'POST create shot as admin failed');
        throw error;
      }
    });

    it('✅ should create a miss shot as coach', async () => {
      try {
        const shotData = {
          player_id: player2.id,
          team_id: team2.id,
          x_coord: 50.0,
          y_coord: 40.0,
          result: 'miss',
          period: 1,
          time_remaining: '09:30:00'
        };

        const response = await request(app)
          .post(`/api/shots/${testGame.id}`)
          .set('Authorization', `Bearer ${coachToken}`)
          .set('Content-Type', 'application/json')
          .send(shotData);

        expect(response.status).toBe(201);
        expect(response.body.result).toBe('miss');

        // Verify score was NOT updated
        const gameCheck = await db.query('SELECT * FROM games WHERE id = $1', [testGame.id]);
        expect(gameCheck.rows[0].away_score).toBe(0);
      } catch (error) {
        global.testContext.logTestError(error, 'POST create miss shot as coach failed');
        throw error;
      }
    });

    it('❌ should reject creation by regular user', async () => {
      try {
        const shotData = {
          player_id: player1.id,
          team_id: team1.id,
          x_coord: 45.5,
          y_coord: 30.2,
          result: 'goal',
          period: 1
        };

        const response = await request(app)
          .post(`/api/shots/${testGame.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .set('Content-Type', 'application/json')
          .send(shotData);

        expect(response.status).toBe(403);
      } catch (error) {
        global.testContext.logTestError(error, 'POST user authorization rejection failed');
        throw error;
      }
    });

    it('❌ should reject shot for non-existent game', async () => {
      try {
        const shotData = {
          player_id: player1.id,
          team_id: team1.id,
          x_coord: 45.5,
          y_coord: 30.2,
          result: 'goal',
          period: 1
        };

        const response = await request(app)
          .post('/api/shots/99999')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send(shotData);

        expect(response.status).toBe(404);
        expect(response.body.error).toContain('Game not found');
      } catch (error) {
        global.testContext.logTestError(error, 'POST non-existent game rejection failed');
        throw error;
      }
    });

    it('❌ should reject shot for game not in progress', async () => {
      try {
        // Create a scheduled game
        const scheduledGame = await db.query(
          `INSERT INTO games (home_team_id, away_team_id, date, status)
           VALUES ($1, $2, $3, 'scheduled') RETURNING *`,
          [team1.id, team2.id, new Date('2025-12-01T14:00:00Z')]
        );

        const shotData = {
          player_id: player1.id,
          team_id: team1.id,
          x_coord: 45.5,
          y_coord: 30.2,
          result: 'goal',
          period: 1
        };

        const response = await request(app)
          .post(`/api/shots/${scheduledGame.rows[0].id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send(shotData);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('in progress');

        await db.query('DELETE FROM games WHERE id = $1', [scheduledGame.rows[0].id]);
      } catch (error) {
        global.testContext.logTestError(error, 'POST scheduled game rejection failed');
        throw error;
      }
    });

    it('❌ should reject invalid coordinates', async () => {
      try {
        const shotData = {
          player_id: player1.id,
          team_id: team1.id,
          x_coord: 150, // Invalid: > 100
          y_coord: 30.2,
          result: 'goal',
          period: 1
        };

        const response = await request(app)
          .post(`/api/shots/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send(shotData);

        expect(response.status).toBe(400);
      } catch (error) {
        global.testContext.logTestError(error, 'POST invalid coordinates validation failed');
        throw error;
      }
    });

    it('❌ should reject invalid result value', async () => {
      try {
        const shotData = {
          player_id: player1.id,
          team_id: team1.id,
          x_coord: 45.5,
          y_coord: 30.2,
          result: 'invalid_result',
          period: 1
        };

        const response = await request(app)
          .post(`/api/shots/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send(shotData);

        expect(response.status).toBe(400);
      } catch (error) {
        global.testContext.logTestError(error, 'POST invalid result validation failed');
        throw error;
      }
    });

    it('❌ should reject player from non-participating team', async () => {
      try {
        // Create another team and player
        const uniqueOtherTeamName = generateUniqueTeamName('OtherTeamShots');
        const otherTeam = await db.query('INSERT INTO teams (name) VALUES ($1) RETURNING *', [uniqueOtherTeamName]);
        const otherPlayer = await db.query(
          'INSERT INTO players (team_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4) RETURNING *',
          [otherTeam.rows[0].id, 'Other', 'Player', 99]
        );

        const shotData = {
          player_id: otherPlayer.rows[0].id,
          team_id: otherTeam.rows[0].id,
          x_coord: 45.5,
          y_coord: 30.2,
          result: 'goal',
          period: 1
        };

        const response = await request(app)
          .post(`/api/shots/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send(shotData);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('not participating');

        await db.query('DELETE FROM players WHERE id = $1', [otherPlayer.rows[0].id]);
        await db.query('DELETE FROM teams WHERE id = $1', [otherTeam.rows[0].id]);
      } catch (error) {
        global.testContext.logTestError(error, 'POST non-participating team validation failed');
        throw error;
      }
    });
  });  describe('📊 GET /api/shots/:gameId', () => {
    let shot1, shot2, shot3;

    beforeAll(async () => {
      // Create test shots
      const shot1Result = await db.query(
        `INSERT INTO shots (game_id, player_id, team_id, x_coord, y_coord, result, period)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [testGame.id, player1.id, team1.id, 40, 30, 'goal', 1]
      );
      shot1 = shot1Result.rows[0];

      const shot2Result = await db.query(
        `INSERT INTO shots (game_id, player_id, team_id, x_coord, y_coord, result, period)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [testGame.id, player2.id, team2.id, 60, 50, 'miss', 1]
      );
      shot2 = shot2Result.rows[0];

      const shot3Result = await db.query(
        `INSERT INTO shots (game_id, player_id, team_id, x_coord, y_coord, result, period)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [testGame.id, player1.id, team1.id, 45, 35, 'blocked', 2]
      );
      shot3 = shot3Result.rows[0];
    });

    afterAll(async () => {
      await db.query('DELETE FROM shots WHERE id IN ($1, $2, $3)', [shot1.id, shot2.id, shot3.id]);
    });

    it('✅ should get all shots for a game', async () => {
      try {
        const response = await request(app)
          .get(`/api/shots/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(3);
        expect(response.body[0]).toHaveProperty('first_name');
        expect(response.body[0]).toHaveProperty('team_name');
      } catch (error) {
        global.testContext.logTestError(error, 'GET all shots failed');
        throw error;
      }
    });

    it('✅ should filter shots by period', async () => {
      try {
        const response = await request(app)
          .get(`/api/shots/${testGame.id}?period=1`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.every(shot => shot.period === 1)).toBe(true);
      } catch (error) {
        global.testContext.logTestError(error, 'GET shots by period filter failed');
        throw error;
      }
    });

    it('✅ should filter shots by team', async () => {
      try {
        const response = await request(app)
          .get(`/api/shots/${testGame.id}?team_id=${team1.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.every(shot => shot.team_id === team1.id)).toBe(true);
      } catch (error) {
        global.testContext.logTestError(error, 'GET shots by team filter failed');
        throw error;
      }
    });

    it('✅ should filter shots by result', async () => {
      try {
        const response = await request(app)
          .get(`/api/shots/${testGame.id}?result=goal`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.every(shot => shot.result === 'goal')).toBe(true);
      } catch (error) {
        global.testContext.logTestError(error, 'GET shots by result filter failed');
        throw error;
      }
    });

    it('❌ should reject invalid result filter', async () => {
      try {
        const response = await request(app)
          .get(`/api/shots/${testGame.id}?result=invalid`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(400);
      } catch (error) {
        global.testContext.logTestError(error, 'GET invalid result filter rejection failed');
        throw error;
      }
    });
  });

  describe('✏️ PUT /api/shots/:gameId/:shotId', () => {
    let testShot;

    beforeEach(async () => {
      // Reset game score
      await db.query('UPDATE games SET home_score = 0, away_score = 0 WHERE id = $1', [testGame.id]);

      // Create a test shot
      const shotResult = await db.query(
        `INSERT INTO shots (game_id, player_id, team_id, x_coord, y_coord, result, period)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [testGame.id, player1.id, team1.id, 40, 30, 'miss', 1]
      );
      testShot = shotResult.rows[0];
    });

    afterEach(async () => {
      await db.query('DELETE FROM shots WHERE id = $1', [testShot.id]);
    });

    it('✅ should update shot coordinates', async () => {
      try {
        const response = await request(app)
          .put(`/api/shots/${testGame.id}/${testShot.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send({ x_coord: 50, y_coord: 40 });

        expect(response.status).toBe(200);
        expect(parseFloat(response.body.x_coord)).toBeCloseTo(50);
        expect(parseFloat(response.body.y_coord)).toBeCloseTo(40);
      } catch (error) {
        global.testContext.logTestError(error, 'PUT update shot coordinates failed');
        throw error;
      }
    });

    it('✅ should update shot result and adjust score', async () => {
      try {
        // Change miss to goal
        const response = await request(app)
          .put(`/api/shots/${testGame.id}/${testShot.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send({ result: 'goal' });

        expect(response.status).toBe(200);
        expect(response.body.result).toBe('goal');

        // Verify score was updated
        const gameCheck = await db.query('SELECT * FROM games WHERE id = $1', [testGame.id]);
        expect(gameCheck.rows[0].home_score).toBe(1);
      } catch (error) {
        global.testContext.logTestError(error, 'PUT update shot result and score failed');
        throw error;
      }
    });

    it('✅ should update shot from goal to miss and decrease score', async () => {
      try {
        // First make it a goal
        await db.query('UPDATE shots SET result = $1 WHERE id = $2', ['goal', testShot.id]);
        await db.query('UPDATE games SET home_score = 1 WHERE id = $1', [testGame.id]);

        // Now change to miss
        const response = await request(app)
          .put(`/api/shots/${testGame.id}/${testShot.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send({ result: 'miss' });

        expect(response.status).toBe(200);
        expect(response.body.result).toBe('miss');

        // Verify score was decreased
        const gameCheck = await db.query('SELECT * FROM games WHERE id = $1', [testGame.id]);
        expect(gameCheck.rows[0].home_score).toBe(0);
      } catch (error) {
        global.testContext.logTestError(error, 'PUT update goal to miss and decrease score failed');
        throw error;
      }
    });

    it('❌ should reject update for non-existent shot', async () => {
      try {
        const response = await request(app)
          .put(`/api/shots/${testGame.id}/99999`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send({ result: 'goal' });

        expect(response.status).toBe(404);
      } catch (error) {
        global.testContext.logTestError(error, 'PUT non-existent shot 404 failed');
        throw error;
      }
    });

    it('❌ should reject update by regular user', async () => {
      try {
        const response = await request(app)
          .put(`/api/shots/${testGame.id}/${testShot.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .set('Content-Type', 'application/json')
          .send({ result: 'goal' });

        expect(response.status).toBe(403);
      } catch (error) {
        global.testContext.logTestError(error, 'PUT user authorization rejection failed');
        throw error;
      }
    });
  });

  describe('🗑️ DELETE /api/shots/:gameId/:shotId', () => {
    let testShot;

    beforeEach(async () => {
      // Create a goal shot
      const shotResult = await db.query(
        `INSERT INTO shots (game_id, player_id, team_id, x_coord, y_coord, result, period)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [testGame.id, player1.id, team1.id, 40, 30, 'goal', 1]
      );
      testShot = shotResult.rows[0];

      // Set game score
      await db.query('UPDATE games SET home_score = 1 WHERE id = $1', [testGame.id]);
    });

    it('✅ should delete a shot and decrease score', async () => {
      try {
        const response = await request(app)
          .delete(`/api/shots/${testGame.id}/${testShot.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(204);

        // Verify shot was deleted
        const shotCheck = await db.query('SELECT * FROM shots WHERE id = $1', [testShot.id]);
        expect(shotCheck.rows.length).toBe(0);

        // Verify score was decreased
        const gameCheck = await db.query('SELECT * FROM games WHERE id = $1', [testGame.id]);
        expect(gameCheck.rows[0].home_score).toBe(0);
      } catch (error) {
        global.testContext.logTestError(error, 'DELETE shot and decrease score failed');
        throw error;
      }
    });

    it('✅ should delete a miss shot without affecting score', async () => {
      try {
        // Change to miss
        await db.query('UPDATE shots SET result = $1 WHERE id = $2', ['miss', testShot.id]);

        const response = await request(app)
          .delete(`/api/shots/${testGame.id}/${testShot.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(204);

        // Score should still be 1
        const gameCheck = await db.query('SELECT * FROM games WHERE id = $1', [testGame.id]);
        expect(gameCheck.rows[0].home_score).toBe(1);
      } catch (error) {
        global.testContext.logTestError(error, 'DELETE miss shot without score change failed');
        throw error;
      }
    });

    it('❌ should reject deletion for non-existent shot', async () => {
      try {
        const response = await request(app)
          .delete(`/api/shots/${testGame.id}/99999`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(404);
      } catch (error) {
        global.testContext.logTestError(error, 'DELETE non-existent shot 404 failed');
        throw error;
      }
    });

    it('❌ should reject deletion by regular user', async () => {
      try {
        const response = await request(app)
          .delete(`/api/shots/${testGame.id}/${testShot.id}`)
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(403);
      } catch (error) {
        global.testContext.logTestError(error, 'DELETE user authorization rejection failed');
        throw error;
      }
    });
  });
});
