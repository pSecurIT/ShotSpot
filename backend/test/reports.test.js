import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

describe('📄 Reports API', () => {
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
  let game;

  beforeAll(async () => {
    console.log('🔧 Setting up Reports API tests...');
    try {
      const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Create test users
      const adminResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [`admin_reports_${uniqueId}`, `admin_reports_${uniqueId}@test.com`, 'hash', 'admin']
      );
      adminUser = adminResult.rows[0];
      authToken = jwt.sign({ id: adminUser.id, role: 'admin' }, process.env.JWT_SECRET);

      const coachResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [`coach_reports_${uniqueId}`, `coach_reports_${uniqueId}@test.com`, 'hash', 'coach']
      );
      coachUser = coachResult.rows[0];
      coachToken = jwt.sign({ id: coachUser.id, role: 'coach' }, process.env.JWT_SECRET);

      const userResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [`user_reports_${uniqueId}`, `user_reports_${uniqueId}@test.com`, 'hash', 'user']
      );
      regularUser = userResult.rows[0];
      userToken = jwt.sign({ id: regularUser.id, role: 'user' }, process.env.JWT_SECRET);

      // Create test teams
      const team1Result = await db.query(
        'INSERT INTO teams (name) VALUES ($1) RETURNING *',
        [`Test Team Alpha Reports ${uniqueId}`]
      );
      team1 = team1Result.rows[0];

      const team2Result = await db.query(
        'INSERT INTO teams (name) VALUES ($1) RETURNING *',
        [`Test Team Beta Reports ${uniqueId}`]
      );
      team2 = team2Result.rows[0];

      // Create test players
      const player1Result = await db.query(
        'INSERT INTO players (team_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4) RETURNING *',
        [team1.id, 'John', 'Doe', 10]
      );
      player1 = player1Result.rows[0];

      const player2Result = await db.query(
        'INSERT INTO players (team_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4) RETURNING *',
        [team2.id, 'Jane', 'Smith', 15]
      );
      player2 = player2Result.rows[0];

      // Create a completed test game
      const gameResult = await db.query(
        `INSERT INTO games (home_team_id, away_team_id, date, status, home_score, away_score) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [team1.id, team2.id, new Date('2025-01-15T14:00:00Z'), 'completed', 12, 10]
      );
      game = gameResult.rows[0];

      // Add some shots for the game
      await db.query(`
        INSERT INTO shots (game_id, player_id, team_id, x_coord, y_coord, result, period, time_remaining, distance)
        VALUES 
          ($1, $2, $3, 25, 30, 'goal', 1, '00:08:30', 5.5),
          ($1, $2, $3, 30, 40, 'goal', 1, '00:07:15', 6.2),
          ($1, $2, $3, 35, 35, 'miss', 2, '00:06:45', 7.1),
          ($1, $4, $5, 70, 50, 'goal', 1, '00:08:00', 5.8),
          ($1, $4, $5, 65, 45, 'blocked', 2, '00:05:30', 6.5)
      `, [game.id, player1.id, team1.id, player2.id, team2.id]);

      // Add some game events
      await db.query(`
        INSERT INTO game_events (game_id, event_type, team_id, player_id, period, time_remaining)
        VALUES 
          ($1, 'foul', $2, $3, 1, '00:07:00'),
          ($1, 'timeout', $4, NULL, 2, '00:05:00')
      `, [game.id, team1.id, player1.id, team2.id]);

      // Add possession data
      await db.query(`
        INSERT INTO ball_possessions (game_id, team_id, period, duration_seconds, shots_taken, result)
        VALUES 
          ($1, $2, 1, 25, 2, 'goal'),
          ($1, $3, 1, 18, 1, 'goal'),
          ($1, $2, 2, 30, 1, 'turnover')
      `, [game.id, team1.id, team2.id]);

    } catch (error) {
      global.testContext.logTestError(error, 'Reports API setup failed');
      throw error;
    }
  });

  afterAll(async () => {
    console.log('✅ Reports API tests completed');
    try {
      // Clean up test data
      await db.query('DELETE FROM shots WHERE game_id = $1', [game.id]);
      await db.query('DELETE FROM game_events WHERE game_id = $1', [game.id]);
      await db.query('DELETE FROM ball_possessions WHERE game_id = $1', [game.id]);
      await db.query('DELETE FROM games WHERE id = $1', [game.id]);
      await db.query('DELETE FROM players WHERE id IN ($1, $2)', [player1.id, player2.id]);
      await db.query('DELETE FROM teams WHERE id IN ($1, $2)', [team1.id, team2.id]);
      await db.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [adminUser.id, coachUser.id, regularUser.id]);
    } catch (error) {
      console.error('⚠️ Reports API cleanup failed:', error.message);
    }
  });

  describe('📊 GET /api/reports/games/:gameId/post-match', () => {
    it('✅ should generate post-match report with admin token', async () => {
      const response = await request(app)
        .get(`/api/reports/games/${game.id}/post-match`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('post-match-report');
      expect(response.body).toBeInstanceOf(Buffer);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('✅ should generate post-match report with coach token', async () => {
      const response = await request(app)
        .get(`/api/reports/games/${game.id}/post-match`)
        .set('Authorization', `Bearer ${coachToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
    });

    it('✅ should generate post-match report with user token', async () => {
      const response = await request(app)
        .get(`/api/reports/games/${game.id}/post-match`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
    });

    it('❌ should reject request without authentication', async () => {
      const response = await request(app)
        .get(`/api/reports/games/${game.id}/post-match`);

      expect(response.status).toBe(401);
    });

    it('❌ should return 404 for non-existent game', async () => {
      const response = await request(app)
        .get('/api/reports/games/999999/post-match')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('❌ should return 400 for invalid game ID', async () => {
      const response = await request(app)
        .get('/api/reports/games/invalid/post-match')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('👤 GET /api/reports/games/:gameId/player/:playerId', () => {
    it('✅ should generate player performance report', async () => {
      const response = await request(app)
        .get(`/api/reports/games/${game.id}/player/${player1.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('player-report');
      expect(response.body).toBeInstanceOf(Buffer);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('✅ should generate report for player from different team', async () => {
      const response = await request(app)
        .get(`/api/reports/games/${game.id}/player/${player2.id}`)
        .set('Authorization', `Bearer ${coachToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
    });

    it('❌ should reject request without authentication', async () => {
      const response = await request(app)
        .get(`/api/reports/games/${game.id}/player/${player1.id}`);

      expect(response.status).toBe(401);
    });

    it('❌ should return 404 for non-existent player', async () => {
      const response = await request(app)
        .get(`/api/reports/games/${game.id}/player/999999`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('❌ should return 404 for non-existent game', async () => {
      const response = await request(app)
        .get(`/api/reports/games/999999/player/${player1.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('❌ should return 400 for invalid IDs', async () => {
      const response = await request(app)
        .get('/api/reports/games/invalid/player/invalid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('🎓 POST /api/reports/games/:gameId/coach-analysis', () => {
    it('✅ should generate coach analysis report with admin token', async () => {
      const response = await request(app)
        .post(`/api/reports/games/${game.id}/coach-analysis`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          notes: 'Great game performance. Focus on defense in next match.'
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('coach-analysis');
      expect(response.body).toBeInstanceOf(Buffer);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('✅ should generate report with coach token', async () => {
      const response = await request(app)
        .post(`/api/reports/games/${game.id}/coach-analysis`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          notes: 'Team showed improvement in shooting efficiency.'
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
    });

    it('✅ should generate report without notes', async () => {
      const response = await request(app)
        .post(`/api/reports/games/${game.id}/coach-analysis`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
    });

    it('❌ should reject request from regular user', async () => {
      const response = await request(app)
        .post(`/api/reports/games/${game.id}/coach-analysis`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          notes: 'Test notes'
        });

      expect(response.status).toBe(403);
    });

    it('❌ should reject request without authentication', async () => {
      const response = await request(app)
        .post(`/api/reports/games/${game.id}/coach-analysis`)
        .send({
          notes: 'Test notes'
        });

      expect(response.status).toBe(401);
    });

    it('❌ should return 404 for non-existent game', async () => {
      const response = await request(app)
        .post('/api/reports/games/999999/coach-analysis')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          notes: 'Test notes'
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('❌ should return 400 for invalid game ID', async () => {
      const response = await request(app)
        .post('/api/reports/games/invalid/coach-analysis')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          notes: 'Test notes'
        });

      expect(response.status).toBe(400);
    });

    it('❌ should reject invalid notes type', async () => {
      const response = await request(app)
        .post(`/api/reports/games/${game.id}/coach-analysis`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          notes: 12345
        });

      expect(response.status).toBe(400);
    });
  });

  describe('🔒 Authorization Tests', () => {
    it('✅ should allow admin to access all report types', async () => {
      const postMatchResponse = await request(app)
        .get(`/api/reports/games/${game.id}/post-match`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(postMatchResponse.status).toBe(200);

      const playerResponse = await request(app)
        .get(`/api/reports/games/${game.id}/player/${player1.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(playerResponse.status).toBe(200);

      const coachResponse = await request(app)
        .post(`/api/reports/games/${game.id}/coach-analysis`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'Test' });
      expect(coachResponse.status).toBe(200);
    });

    it('✅ should allow coach to access all report types', async () => {
      const postMatchResponse = await request(app)
        .get(`/api/reports/games/${game.id}/post-match`)
        .set('Authorization', `Bearer ${coachToken}`);
      expect(postMatchResponse.status).toBe(200);

      const playerResponse = await request(app)
        .get(`/api/reports/games/${game.id}/player/${player1.id}`)
        .set('Authorization', `Bearer ${coachToken}`);
      expect(playerResponse.status).toBe(200);

      const coachResponse = await request(app)
        .post(`/api/reports/games/${game.id}/coach-analysis`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ notes: 'Test' });
      expect(coachResponse.status).toBe(200);
    });

    it('✅ should allow user to view reports but not create coach analysis', async () => {
      const postMatchResponse = await request(app)
        .get(`/api/reports/games/${game.id}/post-match`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(postMatchResponse.status).toBe(200);

      const playerResponse = await request(app)
        .get(`/api/reports/games/${game.id}/player/${player1.id}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(playerResponse.status).toBe(200);

      const coachResponse = await request(app)
        .post(`/api/reports/games/${game.id}/coach-analysis`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ notes: 'Test' });
      expect(coachResponse.status).toBe(403);
    });
  });

  describe('📋 Data Coverage Tests', () => {
    it('✅ should handle games with no shots', async () => {
      // Create a game with no shots
      const emptyGameResult = await db.query(
        `INSERT INTO games (home_team_id, away_team_id, date, status) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [team1.id, team2.id, new Date('2025-01-20T14:00:00Z'), 'completed']
      );
      const emptyGame = emptyGameResult.rows[0];

      const response = await request(app)
        .get(`/api/reports/games/${emptyGame.id}/post-match`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');

      // Cleanup
      await db.query('DELETE FROM games WHERE id = $1', [emptyGame.id]);
    });

    it('✅ should handle player with no shots in game', async () => {
      // Create a player with no shots
      const noShotsPlayerResult = await db.query(
        'INSERT INTO players (team_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4) RETURNING *',
        [team1.id, 'NoShots', 'Player', 99]
      );
      const noShotsPlayer = noShotsPlayerResult.rows[0];

      const response = await request(app)
        .get(`/api/reports/games/${game.id}/player/${noShotsPlayer.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');

      // Cleanup
      await db.query('DELETE FROM players WHERE id = $1', [noShotsPlayer.id]);
    });
  });
});
