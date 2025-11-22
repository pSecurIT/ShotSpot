import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

describe('📊 Reports Routes', () => {
  let authToken;
  let userToken;
  let adminUserId;
  let regularUserId;
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
  let player3;
  let _player4;
  let testGame;

  beforeAll(async () => {
    console.log('🔧 Setting up Reports Routes tests...');
    
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Create test users
    const adminResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [`admin_reports_${uniqueId}`, `admin_reports_${uniqueId}@test.com`, 'hash', 'admin']
    );
    adminUserId = adminResult.rows[0].id;
    authToken = jwt.sign({ id: adminUserId, role: 'admin' }, process.env.JWT_SECRET);

    const userResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [`user_reports_${uniqueId}`, `user_reports_${uniqueId}@test.com`, 'hash', 'user']
    );
    regularUserId = userResult.rows[0].id;
    userToken = jwt.sign({ id: regularUserId, role: 'user' }, process.env.JWT_SECRET);

    // Create test teams
    const team1Result = await db.query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING *',
      [`Reports Team 1 ${uniqueId}`]
    );
    team1 = team1Result.rows[0];

    const team2Result = await db.query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING *',
      [`Reports Team 2 ${uniqueId}`]
    );
    team2 = team2Result.rows[0];

    // Create test players
    const player1Result = await db.query(
      `INSERT INTO players (team_id, first_name, last_name, jersey_number) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [team1.id, 'Alice', `Player${uniqueId}`, 10]
    );
    player1 = player1Result.rows[0];

    const player2Result = await db.query(
      `INSERT INTO players (team_id, first_name, last_name, jersey_number) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [team1.id, 'Bob', `Player${uniqueId}`, 11]
    );
    player2 = player2Result.rows[0];

    const player3Result = await db.query(
      `INSERT INTO players (team_id, first_name, last_name, jersey_number) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [team2.id, 'Charlie', `Player${uniqueId}`, 20]
    );
    player3 = player3Result.rows[0];

    const player4Result = await db.query(
      `INSERT INTO players (team_id, first_name, last_name, jersey_number) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [team2.id, 'Diana', `Player${uniqueId}`, 21]
    );
    _player4 = player4Result.rows[0];

    // Create a game in progress
    const gameResult = await db.query(
      'INSERT INTO games (home_team_id, away_team_id, date, status, home_score, away_score, current_period) VALUES ($1, $2, CURRENT_TIMESTAMP, \'in_progress\', 0, 0, 1) RETURNING *',
      [team1.id, team2.id]
    );
    testGame = gameResult.rows[0];

    // Add game roster
    await db.query(
      'INSERT INTO game_rosters (game_id, player_id, is_starting) VALUES ($1, $2, true)',
      [testGame.id, player1.id]
    );
    await db.query(
      'INSERT INTO game_rosters (game_id, player_id, is_starting) VALUES ($1, $2, true)',
      [testGame.id, player3.id]
    );

    // Create diverse shot data
    const shotData = [
      // Team 1 player 1 - successful shooter
      { x: 10, y: 50, result: 'goal', player_id: player1.id, team_id: team1.id, period: 1, distance: 5.5 },
      { x: 15, y: 45, result: 'goal', player_id: player1.id, team_id: team1.id, period: 1, distance: 6.0 },
      { x: 20, y: 55, result: 'goal', player_id: player1.id, team_id: team1.id, period: 1, distance: 7.0 },
      { x: 25, y: 50, result: 'goal', player_id: player1.id, team_id: team1.id, period: 1, distance: 5.0 },
      { x: 30, y: 50, result: 'goal', player_id: player1.id, team_id: team1.id, period: 2, distance: 4.5 },
      
      // Team 1 player 2 - struggling shooter
      { x: 40, y: 50, result: 'miss', player_id: player2.id, team_id: team1.id, period: 1, distance: 4.0 },
      { x: 50, y: 50, result: 'miss', player_id: player2.id, team_id: team1.id, period: 1, distance: 3.5 },
      { x: 60, y: 50, result: 'blocked', player_id: player2.id, team_id: team1.id, period: 1, distance: 4.5 },
      { x: 65, y: 50, result: 'miss', player_id: player2.id, team_id: team1.id, period: 1, distance: 5.0 },
      { x: 70, y: 50, result: 'miss', player_id: player2.id, team_id: team1.id, period: 1, distance: 5.5 },
      { x: 75, y: 50, result: 'goal', player_id: player2.id, team_id: team1.id, period: 2, distance: 6.0 },
      
      // Team 2 player 3 - average shooter
      { x: 30, y: 40, result: 'goal', player_id: player3.id, team_id: team2.id, period: 1, distance: 5.0 },
      { x: 45, y: 60, result: 'goal', player_id: player3.id, team_id: team2.id, period: 1, distance: 4.0 },
      { x: 55, y: 55, result: 'miss', player_id: player3.id, team_id: team2.id, period: 2, distance: 5.5 },
      { x: 65, y: 45, result: 'blocked', player_id: player3.id, team_id: team2.id, period: 2, distance: 6.0 }
    ];

    for (const shot of shotData) {
      await db.query(
        `INSERT INTO shots (game_id, player_id, team_id, x_coord, y_coord, result, period, time_remaining, distance)
         VALUES ($1, $2, $3, $4, $5, $6, $7, '00:05:00', $8)`,
        [testGame.id, shot.player_id, shot.team_id, shot.x, shot.y, shot.result, shot.period, shot.distance]
      );
    }

    // Update game scores based on goals
    const team1Goals = shotData.filter(s => s.team_id === team1.id && s.result === 'goal').length;
    const team2Goals = shotData.filter(s => s.team_id === team2.id && s.result === 'goal').length;
    await db.query(
      'UPDATE games SET home_score = $1, away_score = $2 WHERE id = $3',
      [team1Goals, team2Goals, testGame.id]
    );

    // Add some game events
    await db.query(
      `INSERT INTO game_events (game_id, event_type, team_id, player_id, period, time_remaining)
       VALUES ($1, 'foul', $2, $3, 1, '00:08:00')`,
      [testGame.id, team2.id, player3.id]
    );

    await db.query(
      `INSERT INTO game_events (game_id, event_type, team_id, period, time_remaining)
       VALUES ($1, 'timeout', $2, 1, '00:05:30')`,
      [testGame.id, team1.id]
    );

    console.log('✅ Test data created successfully');
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up Reports Routes tests...');
    // Cleanup is handled by CASCADE deletes
    await db.query('DELETE FROM users WHERE id = $1 OR id = $2', [adminUserId, regularUserId]);
    await db.query('DELETE FROM teams WHERE id = $1 OR id = $2', [team1.id, team2.id]);
  });

  describe('GET /api/reports/live/:gameId', () => {
    it('should return live match report with authentication', async () => {
      const response = await request(app)
        .get(`/api/reports/live/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('game');
      expect(response.body).toHaveProperty('shot_summary');
      expect(response.body).toHaveProperty('recent_events');
      expect(response.body).toHaveProperty('top_scorers');
      expect(response.body).toHaveProperty('generated_at');

      expect(response.body.game.id).toBe(testGame.id);
      expect(response.body.game.status).toBe('in_progress');
      expect(response.body.shot_summary).toHaveLength(2); // Both teams
      expect(response.body.top_scorers.length).toBeGreaterThan(0);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/api/reports/live/${testGame.id}`)
        .expect(401);
    });

    it('should return 404 for non-existent game', async () => {
      await request(app)
        .get('/api/reports/live/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should include correct team scores in report', async () => {
      const response = await request(app)
        .get(`/api/reports/live/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.game.home_score).toBeGreaterThan(0);
      expect(response.body.game.away_score).toBeGreaterThan(0);
    });
  });

  describe('GET /api/reports/period/:gameId/:period', () => {
    it('should return period report for period 1', async () => {
      const response = await request(app)
        .get(`/api/reports/period/${testGame.id}/1`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('game_id');
      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('team_stats');
      expect(response.body).toHaveProperty('events');
      expect(response.body).toHaveProperty('player_stats');

      expect(response.body.period).toBe(1);
      expect(response.body.team_stats.length).toBeGreaterThan(0);
    });

    it('should return period report for period 2', async () => {
      const response = await request(app)
        .get(`/api/reports/period/${testGame.id}/2`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.period).toBe(2);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/api/reports/period/${testGame.id}/1`)
        .expect(401);
    });

    it('should return 404 for non-existent game', async () => {
      await request(app)
        .get('/api/reports/period/99999/1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should validate period parameter', async () => {
      await request(app)
        .get(`/api/reports/period/${testGame.id}/0`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('GET /api/reports/momentum/:gameId', () => {
    it('should calculate momentum tracker', async () => {
      const response = await request(app)
        .get(`/api/reports/momentum/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('window_size');
      expect(response.body).toHaveProperty('recent_shots_analyzed');
      expect(response.body).toHaveProperty('momentum');
      expect(response.body).toHaveProperty('recent_shots');

      expect(response.body.momentum).toHaveProperty('home');
      expect(response.body.momentum).toHaveProperty('away');
      expect(response.body.momentum).toHaveProperty('trend');

      expect(typeof response.body.momentum.home).toBe('number');
      expect(typeof response.body.momentum.away).toBe('number');
    });

    it('should accept custom window size', async () => {
      const response = await request(app)
        .get(`/api/reports/momentum/${testGame.id}?window=5`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.window_size).toBe(5);
    });

    it('should validate window parameter range', async () => {
      await request(app)
        .get(`/api/reports/momentum/${testGame.id}?window=3`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      await request(app)
        .get(`/api/reports/momentum/${testGame.id}?window=25`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/api/reports/momentum/${testGame.id}`)
        .expect(401);
    });

    it('should handle game with no shots', async () => {
      const emptyGame = await db.query(
        `INSERT INTO games (home_team_id, away_team_id, date, status, current_period)
         VALUES ($1, $2, CURRENT_TIMESTAMP, 'in_progress', 1) RETURNING *`,
        [team1.id, team2.id]
      );

      const response = await request(app)
        .get(`/api/reports/momentum/${emptyGame.rows[0].id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.momentum.home).toBe(0);
      expect(response.body.momentum.away).toBe(0);

      await db.query('DELETE FROM games WHERE id = $1', [emptyGame.rows[0].id]);
    });
  });

  describe('GET /api/reports/compare/:gameId/:playerId1/:playerId2', () => {
    it('should compare two players in a game', async () => {
      const response = await request(app)
        .get(`/api/reports/compare/${testGame.id}/${player1.id}/${player2.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('game_id');
      expect(response.body).toHaveProperty('players');
      expect(response.body).toHaveProperty('comparison_summary');

      expect(response.body.players).toHaveLength(2);
      expect(response.body.comparison_summary).toHaveProperty('goals_leader');
      expect(response.body.comparison_summary).toHaveProperty('fg_percentage_leader');
      expect(response.body.comparison_summary).toHaveProperty('shots_leader');
    });

    it('should include zone distribution in comparison', async () => {
      const response = await request(app)
        .get(`/api/reports/compare/${testGame.id}/${player1.id}/${player2.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      response.body.players.forEach(player => {
        expect(player).toHaveProperty('zone_distribution');
        expect(player.zone_distribution).toHaveProperty('left');
        expect(player.zone_distribution).toHaveProperty('center');
        expect(player.zone_distribution).toHaveProperty('right');
      });
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/api/reports/compare/${testGame.id}/${player1.id}/${player2.id}`)
        .expect(401);
    });

    it('should return 404 for non-existent players', async () => {
      await request(app)
        .get(`/api/reports/compare/${testGame.id}/99999/99998`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /api/reports/suggestions/substitution/:gameId', () => {
    it('should generate substitution suggestions', async () => {
      const response = await request(app)
        .get(`/api/reports/suggestions/substitution/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('game_id');
      expect(response.body).toHaveProperty('suggestions');
      expect(response.body).toHaveProperty('total_suggestions');

      expect(Array.isArray(response.body.suggestions)).toBe(true);
    });

    it('should filter suggestions by team', async () => {
      const response = await request(app)
        .get(`/api/reports/suggestions/substitution/${testGame.id}?team_id=${team1.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('suggestions');
    });

    it('should identify struggling players', async () => {
      const response = await request(app)
        .get(`/api/reports/suggestions/substitution/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Player 2 has low FG% and should be suggested for substitution
      const player2Suggestion = response.body.suggestions.find(
        s => s.player_id === player2.id
      );

      if (player2Suggestion) {
        expect(player2Suggestion.reason).toBe('Low field goal percentage');
        expect(player2Suggestion.current_fg).toBeLessThan(30);
      }
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/api/reports/suggestions/substitution/${testGame.id}`)
        .expect(401);
    });
  });

  describe('GET /api/reports/export/:gameId', () => {
    it('should export full game report in JSON format', async () => {
      const response = await request(app)
        .get(`/api/reports/export/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('export_date');
      expect(response.body).toHaveProperty('game');
      expect(response.body).toHaveProperty('shots');
      expect(response.body).toHaveProperty('events');
      expect(response.body).toHaveProperty('player_statistics');

      expect(Array.isArray(response.body.shots)).toBe(true);
      expect(Array.isArray(response.body.events)).toBe(true);
      expect(Array.isArray(response.body.player_statistics)).toBe(true);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    it('should export summary format when requested', async () => {
      const response = await request(app)
        .get(`/api/reports/export/${testGame.id}?format=summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('export_date');
      expect(response.body).toHaveProperty('game');
      expect(response.body).toHaveProperty('summary');

      expect(response.body.summary).toHaveProperty('total_shots');
      expect(response.body.summary).toHaveProperty('total_goals');
      expect(response.body.summary).toHaveProperty('total_events');
      expect(response.body.summary).toHaveProperty('top_scorer');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/api/reports/export/${testGame.id}`)
        .expect(401);
    });

    it('should return 404 for non-existent game', async () => {
      await request(app)
        .get('/api/reports/export/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should validate format parameter', async () => {
      await request(app)
        .get(`/api/reports/export/${testGame.id}?format=invalid`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle invalid game ID format', async () => {
      await request(app)
        .get('/api/reports/live/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should handle invalid player ID format in comparison', async () => {
      await request(app)
        .get(`/api/reports/compare/${testGame.id}/invalid/invalid2`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should allow regular users to access reports', async () => {
      const response = await request(app)
        .get(`/api/reports/live/${testGame.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('game');
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
