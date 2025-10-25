import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

describe('Substitutions API', () => {
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
    // Use unique identifiers to prevent conflicts in CI
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Create test users with unique names
    const adminResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [`admin_sub_${uniqueId}`, `admin_sub_${uniqueId}@test.com`, 'hash', 'admin']
    );
    adminUser = adminResult.rows[0];
    authToken = jwt.sign({ id: adminUser.id, username: adminUser.username, role: 'admin' }, process.env.JWT_SECRET);

    const coachResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [`coach_sub_${uniqueId}`, `coach_sub_${uniqueId}@test.com`, 'hash', 'coach']
    );
    coachUser = coachResult.rows[0];
    coachToken = jwt.sign({ id: coachUser.id, username: coachUser.username, role: 'coach' }, process.env.JWT_SECRET);

    const viewerResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [`viewer_sub_${uniqueId}`, `viewer_sub_${uniqueId}@test.com`, 'hash', 'viewer']
    );
    viewerUser = viewerResult.rows[0];
    viewerToken = jwt.sign({ id: viewerUser.id, username: viewerUser.username, role: 'viewer' }, process.env.JWT_SECRET);

    // Validate tokens were created successfully
    if (!authToken || !coachToken || !viewerToken) {
      throw new Error('Failed to create one or more JWT tokens for test users');
    }

    // Create test teams with unique names
    const homeResult = await db.query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING *',
      [`Sub Home Team ${uniqueId}`]
    );
    homeTeam = homeResult.rows[0];

    const awayResult = await db.query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING *',
      [`Sub Away Team ${uniqueId}`]
    );
    awayTeam = awayResult.rows[0];

    // Create test players
    const hp1 = await db.query(
      'INSERT INTO players (team_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [homeTeam.id, 'Starting', 'Forward', 10, 'male']
    );
    homePlayer1 = hp1.rows[0];

    const hp2 = await db.query(
      'INSERT INTO players (team_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [homeTeam.id, 'Starting', 'Guard', 15, 'female']
    );
    homePlayer2 = hp2.rows[0];

    const hp3 = await db.query(
      'INSERT INTO players (team_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [homeTeam.id, 'Bench', 'Forward', 20, 'male']
    );
    homePlayer3 = hp3.rows[0];

    const hp4 = await db.query(
      'INSERT INTO players (team_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [homeTeam.id, 'Bench', 'Guard', 25, 'female']
    );
    homePlayer4 = hp4.rows[0];

    const ap1 = await db.query(
      'INSERT INTO players (team_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [awayTeam.id, 'Away', 'Player', 12, 'male']
    );
    awayPlayer1 = ap1.rows[0];

    const ap2 = await db.query(
      'INSERT INTO players (team_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [awayTeam.id, 'Away', 'Bench', 18, 'male']
    );
    awayPlayer2 = ap2.rows[0];

    // Create test game
    const gameResult = await db.query(
      `INSERT INTO games (home_team_id, away_team_id, date, status) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [homeTeam.id, awayTeam.id, new Date(), 'in_progress']
    );
    testGame = gameResult.rows[0];

    // Create game roster (starting lineup)
    await db.query(
      `INSERT INTO game_rosters (game_id, team_id, player_id, is_captain, is_starting) 
       VALUES ($1, $2, $3, $4, $5)`,
      [testGame.id, homeTeam.id, homePlayer1.id, true, true]
    );
    await db.query(
      `INSERT INTO game_rosters (game_id, team_id, player_id, is_captain, is_starting) 
       VALUES ($1, $2, $3, $4, $5)`,
      [testGame.id, homeTeam.id, homePlayer2.id, false, true]
    );
    await db.query(
      `INSERT INTO game_rosters (game_id, team_id, player_id, is_captain, is_starting) 
       VALUES ($1, $2, $3, $4, $5)`,
      [testGame.id, homeTeam.id, homePlayer3.id, false, false]
    );
    await db.query(
      `INSERT INTO game_rosters (game_id, team_id, player_id, is_captain, is_starting) 
       VALUES ($1, $2, $3, $4, $5)`,
      [testGame.id, homeTeam.id, homePlayer4.id, false, false]
    );
    await db.query(
      `INSERT INTO game_rosters (game_id, team_id, player_id, is_captain, is_starting) 
       VALUES ($1, $2, $3, $4, $5)`,
      [testGame.id, awayTeam.id, awayPlayer1.id, true, true]
    );
    await db.query(
      `INSERT INTO game_rosters (game_id, team_id, player_id, is_captain, is_starting) 
       VALUES ($1, $2, $3, $4, $5)`,
      [testGame.id, awayTeam.id, awayPlayer2.id, false, false]
    );
  });

  afterAll(async () => {
    // Clean up in reverse order of foreign key dependencies
    await db.query('DELETE FROM substitutions WHERE game_id = $1', [testGame.id]);
    await db.query('DELETE FROM game_rosters WHERE game_id = $1', [testGame.id]);
    await db.query('DELETE FROM games WHERE id = $1', [testGame.id]);
    await db.query('DELETE FROM players WHERE team_id = ANY($1)', [[homeTeam.id, awayTeam.id]]);
    await db.query('DELETE FROM teams WHERE id = ANY($1)', [[homeTeam.id, awayTeam.id]]);
    await db.query('DELETE FROM users WHERE id = ANY($1)', [[adminUser.id, coachUser.id, viewerUser.id]]);
    await db.pool.end();
  });

  describe('POST /api/substitutions/:gameId', () => {
    afterEach(async () => {
      // Clean up substitutions after each test
      await db.query('DELETE FROM substitutions WHERE game_id = $1', [testGame.id]);
    });

    test('should record a valid substitution', async () => {
      const response = await request(app)
        .post(`/api/substitutions/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          team_id: homeTeam.id,
          player_in_id: homePlayer3.id, // From bench
          player_out_id: homePlayer1.id, // From court
          period: 1,
          time_remaining: '00:05:30',
          reason: 'tactical'
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        game_id: testGame.id,
        team_id: homeTeam.id,
        player_in_id: homePlayer3.id,
        player_out_id: homePlayer1.id,
        period: 1,
        reason: 'tactical'
      });
      expect(response.body.player_in_first_name).toBe('Bench');
      expect(response.body.player_out_first_name).toBe('Starting');
    });

    test('should allow coach to record substitution', async () => {
      const response = await request(app)
        .post(`/api/substitutions/${testGame.id}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          team_id: homeTeam.id,
          player_in_id: homePlayer3.id,
          player_out_id: homePlayer1.id,
          period: 1,
          reason: 'fatigue'
        });

      expect(response.status).toBe(201);
    });

    test('should reject substitution from viewer role', async () => {
      const response = await request(app)
        .post(`/api/substitutions/${testGame.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          team_id: homeTeam.id,
          player_in_id: homePlayer3.id,
          player_out_id: homePlayer1.id,
          period: 1,
          reason: 'tactical'
        });

      expect(response.status).toBe(403);
    });

    test('should reject substitution without authentication', async () => {
      const response = await request(app)
        .post(`/api/substitutions/${testGame.id}`)
        .send({
          team_id: homeTeam.id,
          player_in_id: homePlayer3.id,
          player_out_id: homePlayer1.id,
          period: 1,
          reason: 'tactical'
        });

      expect(response.status).toBe(401);
    });

    test('should reject substitution with same player in and out', async () => {
      const response = await request(app)
        .post(`/api/substitutions/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          team_id: homeTeam.id,
          player_in_id: homePlayer1.id,
          player_out_id: homePlayer1.id,
          period: 1,
          reason: 'tactical'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('different');
    });

    test('should reject substitution when player_in is already on court', async () => {
      const response = await request(app)
        .post(`/api/substitutions/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          team_id: homeTeam.id,
          player_in_id: homePlayer1.id, // Already on court
          player_out_id: homePlayer2.id,
          period: 1,
          reason: 'tactical'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already on the court');
    });

    test('should reject substitution when player_out is on bench', async () => {
      const response = await request(app)
        .post(`/api/substitutions/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          team_id: homeTeam.id,
          player_in_id: homePlayer3.id,
          player_out_id: homePlayer4.id, // Already on bench
          period: 1,
          reason: 'tactical'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('not currently on the court');
    });

    test('should reject substitution for non-existent game', async () => {
      const response = await request(app)
        .post('/api/substitutions/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          team_id: homeTeam.id,
          player_in_id: homePlayer3.id,
          player_out_id: homePlayer1.id,
          period: 1,
          reason: 'tactical'
        });

      expect(response.status).toBe(404);
    });

    test('should reject substitution for game not in progress', async () => {
      // Create a completed game
      const completedGameResult = await db.query(
        `INSERT INTO games (home_team_id, away_team_id, date, status) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [homeTeam.id, awayTeam.id, new Date(), 'completed']
      );
      const completedGame = completedGameResult.rows[0];

      const response = await request(app)
        .post(`/api/substitutions/${completedGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          team_id: homeTeam.id,
          player_in_id: homePlayer3.id,
          player_out_id: homePlayer1.id,
          period: 1,
          reason: 'tactical'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('not in progress');

      // Cleanup
      await db.query('DELETE FROM games WHERE id = $1', [completedGame.id]);
    });

    test('should reject substitution with invalid reason', async () => {
      const response = await request(app)
        .post(`/api/substitutions/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          team_id: homeTeam.id,
          player_in_id: homePlayer3.id,
          player_out_id: homePlayer1.id,
          period: 1,
          reason: 'invalid_reason'
        });

      expect(response.status).toBe(400);
    });

    test('should reject substitution with players from different teams', async () => {
      const response = await request(app)
        .post(`/api/substitutions/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          team_id: homeTeam.id,
          player_in_id: awayPlayer2.id, // Away team player
          player_out_id: homePlayer1.id, // Home team player
          period: 1,
          reason: 'tactical'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('belong to the specified team');
    });

    test('should handle multiple consecutive substitutions correctly', async () => {
      // First substitution: homePlayer1 out, homePlayer3 in
      const response1 = await request(app)
        .post(`/api/substitutions/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          team_id: homeTeam.id,
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
          team_id: homeTeam.id,
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
          team_id: homeTeam.id,
          player_in_id: homePlayer1.id,
          player_out_id: homePlayer3.id,
          period: 2,
          reason: 'tactical'
        });

      expect(response3.status).toBe(201);
    });
  });

  describe('GET /api/substitutions/:gameId', () => {
    beforeEach(async () => {
      // Create test substitutions
      await db.query(
        `INSERT INTO substitutions (game_id, team_id, player_in_id, player_out_id, period, time_remaining, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [testGame.id, homeTeam.id, homePlayer3.id, homePlayer1.id, 1, '00:05:00', 'tactical']
      );
      await db.query(
        `INSERT INTO substitutions (game_id, team_id, player_in_id, player_out_id, period, time_remaining, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [testGame.id, homeTeam.id, homePlayer4.id, homePlayer2.id, 2, '00:03:00', 'fatigue']
      );
      await db.query(
        `INSERT INTO substitutions (game_id, team_id, player_in_id, player_out_id, period, time_remaining, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [testGame.id, awayTeam.id, awayPlayer2.id, awayPlayer1.id, 1, '00:04:00', 'injury']
      );
    });

    afterEach(async () => {
      await db.query('DELETE FROM substitutions WHERE game_id = $1', [testGame.id]);
    });

    test('should fetch all substitutions for a game', async () => {
      const response = await request(app)
        .get(`/api/substitutions/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
      expect(response.body[0]).toHaveProperty('player_in_first_name');
      expect(response.body[0]).toHaveProperty('player_out_first_name');
      expect(response.body[0]).toHaveProperty('team_name');
    });

    test('should filter substitutions by team', async () => {
      const response = await request(app)
        .get(`/api/substitutions/${testGame.id}?team_id=${homeTeam.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body.every(sub => sub.team_id === homeTeam.id)).toBe(true);
    });

    test('should filter substitutions by period', async () => {
      const response = await request(app)
        .get(`/api/substitutions/${testGame.id}?period=1`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body.every(sub => sub.period === 1)).toBe(true);
    });

    test('should filter substitutions by player', async () => {
      const response = await request(app)
        .get(`/api/substitutions/${testGame.id}?player_id=${homePlayer1.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].player_out_id).toBe(homePlayer1.id);
    });

    test('should return empty array for game with no substitutions', async () => {
      const newGameResult = await db.query(
        `INSERT INTO games (home_team_id, away_team_id, date, status) 
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
    });
  });

  describe('GET /api/substitutions/:gameId/active-players', () => {
    afterEach(async () => {
      await db.query('DELETE FROM substitutions WHERE game_id = $1', [testGame.id]);
    });

    test('should return starting lineup when no substitutions made', async () => {
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
    });

    test('should reflect substitutions in active players', async () => {
      // Make a substitution
      await db.query(
        `INSERT INTO substitutions (game_id, team_id, player_in_id, player_out_id, period, reason)
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
    });

    test('should handle multiple substitutions correctly', async () => {
      // Sub 1: homePlayer1 out, homePlayer3 in
      await db.query(
        `INSERT INTO substitutions (game_id, team_id, player_in_id, player_out_id, period, reason)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [testGame.id, homeTeam.id, homePlayer3.id, homePlayer1.id, 1, 'tactical']
      );

      // Sub 2: homePlayer3 out, homePlayer1 in (bringing player back)
      await db.query(
        `INSERT INTO substitutions (game_id, team_id, player_in_id, player_out_id, period, reason)
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
    });

    test('should return 404 for game with no roster', async () => {
      const newGameResult = await db.query(
        `INSERT INTO games (home_team_id, away_team_id, date, status) 
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
    });
  });

  describe('DELETE /api/substitutions/:gameId/:substitutionId', () => {
    let substitution1;
    let substitution2;

    beforeEach(async () => {
      // Create test substitutions
      const sub1Result = await db.query(
        `INSERT INTO substitutions (game_id, team_id, player_in_id, player_out_id, period, reason)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [testGame.id, homeTeam.id, homePlayer3.id, homePlayer1.id, 1, 'tactical']
      );
      substitution1 = sub1Result.rows[0];

      // Wait a moment to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const sub2Result = await db.query(
        `INSERT INTO substitutions (game_id, team_id, player_in_id, player_out_id, period, reason)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [testGame.id, homeTeam.id, homePlayer4.id, homePlayer2.id, 1, 'fatigue']
      );
      substitution2 = sub2Result.rows[0];
    });

    afterEach(async () => {
      await db.query('DELETE FROM substitutions WHERE game_id = $1', [testGame.id]);
    });

    test('should delete the most recent substitution', async () => {
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
    });

    test('should not delete older substitution when newer exists', async () => {
      const response = await request(app)
        .delete(`/api/substitutions/${testGame.id}/${substitution1.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('most recent substitution');
    });

    test('should allow coach to delete substitution', async () => {
      const response = await request(app)
        .delete(`/api/substitutions/${testGame.id}/${substitution2.id}`)
        .set('Authorization', `Bearer ${coachToken}`);

      expect(response.status).toBe(200);
    });

    test('should reject deletion from viewer role', async () => {
      const response = await request(app)
        .delete(`/api/substitutions/${testGame.id}/${substitution2.id}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(403);
    });

    test('should return 404 for non-existent substitution', async () => {
      const response = await request(app)
        .delete(`/api/substitutions/${testGame.id}/99999`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    test('should delete when it is the only substitution', async () => {
      // Delete the second substitution first
      await db.query('DELETE FROM substitutions WHERE id = $1', [substitution2.id]);

      const response = await request(app)
        .delete(`/api/substitutions/${testGame.id}/${substitution1.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('Edge Cases and Validation', () => {
    afterEach(async () => {
      await db.query('DELETE FROM substitutions WHERE game_id = $1', [testGame.id]);
    });

    test('should handle concurrent substitutions for different teams', async () => {
      const homeSubPromise = request(app)
        .post(`/api/substitutions/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          team_id: homeTeam.id,
          player_in_id: homePlayer3.id,
          player_out_id: homePlayer1.id,
          period: 1,
          reason: 'tactical'
        });

      const awaySubPromise = request(app)
        .post(`/api/substitutions/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          team_id: awayTeam.id,
          player_in_id: awayPlayer2.id,
          player_out_id: awayPlayer1.id,
          period: 1,
          reason: 'tactical'
        });

      const [homeResponse, awayResponse] = await Promise.all([homeSubPromise, awaySubPromise]);

      expect(homeResponse.status).toBe(201);
      expect(awayResponse.status).toBe(201);
    });

    test('should validate period is positive integer', async () => {
      const response = await request(app)
        .post(`/api/substitutions/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          team_id: homeTeam.id,
          player_in_id: homePlayer3.id,
          player_out_id: homePlayer1.id,
          period: -1,
          reason: 'tactical'
        });

      expect(response.status).toBe(400);
    });

    test('should accept all valid reason types', async () => {
      const reasons = ['tactical', 'injury', 'fatigue', 'disciplinary'];

      for (const reason of reasons) {
        const response = await request(app)
          .post(`/api/substitutions/${testGame.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            team_id: homeTeam.id,
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
    });
  });
});
