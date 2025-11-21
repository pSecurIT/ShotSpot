import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';

describe('📊 Export API Tests', () => {
  let authToken;
  let testGame;
  let testTeam1;
  let testTeam2;
  let testPlayer1;
  let testPlayer2;

  beforeAll(async () => {
    // Create test user and authenticate
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'exporttester',
        email: 'exporttest@test.com',
        password: 'TestPass123!',
        role: 'coach'
      });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'exporttester',
        password: 'TestPass123!'
      });

    authToken = loginResponse.body.token;

    // Create test teams
    const team1Response = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Export Test Team 1' });
    testTeam1 = team1Response.body;

    const team2Response = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Export Test Team 2' });
    testTeam2 = team2Response.body;

    // Create test players
    const player1Response = await request(app)
      .post('/api/players')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        team_id: testTeam1.id,
        first_name: 'Export',
        last_name: 'Player1',
        jersey_number: 10,
        gender: 'male'
      });
    testPlayer1 = player1Response.body;

    const player2Response = await request(app)
      .post('/api/players')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        team_id: testTeam2.id,
        first_name: 'Export',
        last_name: 'Player2',
        jersey_number: 20,
        gender: 'female'
      });
    testPlayer2 = player2Response.body;

    // Create a test game
    const gameResponse = await request(app)
      .post('/api/games')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        home_team_id: testTeam1.id,
        away_team_id: testTeam2.id,
        date: new Date().toISOString(),
        status: 'in_progress'
      });
    testGame = gameResponse.body;

    // Add game roster entries
    await db.query(`
      INSERT INTO game_rosters (game_id, team_id, player_id, is_captain, is_starting, starting_position)
      VALUES ($1, $2, $3, true, true, 'offense'), ($4, $5, $6, false, true, 'defense')
    `, [testGame.id, testTeam1.id, testPlayer1.id, testGame.id, testTeam2.id, testPlayer2.id]);

    // Add some test shots
    await db.query(`
      INSERT INTO shots (game_id, player_id, team_id, x_coord, y_coord, result, period, time_remaining, shot_type, distance)
      VALUES 
        ($1, $2, $3, 50.0, 50.0, 'goal', 1, '09:00:00', 'jump shot', 5.5),
        ($1, $4, $5, 30.0, 40.0, 'miss', 1, '08:30:00', 'running shot', 6.2),
        ($1, $2, $3, 60.0, 55.0, 'goal', 2, '09:45:00', 'penalty', 3.0)
    `, [testGame.id, testPlayer1.id, testTeam1.id, testPlayer2.id, testTeam2.id]);

    // Add a substitution
    await db.query(`
      INSERT INTO substitutions (game_id, team_id, player_in_id, player_out_id, period, time_remaining, reason)
      VALUES ($1, $2, $3, $4, 1, '07:00:00', 'tactical')
    `, [testGame.id, testTeam1.id, testPlayer1.id, testPlayer1.id]);

    // Add a timeout
    await db.query(`
      INSERT INTO timeouts (game_id, team_id, timeout_type, period, time_remaining, duration, reason, called_by)
      VALUES ($1, $2, 'team', 1, '05:00:00', '01:00:00', 'Strategy discussion', 'Coach Smith')
    `, [testGame.id, testTeam1.id]);

    // Add a foul event
    await db.query(`
      INSERT INTO game_events (game_id, event_type, player_id, team_id, period, time_remaining, details)
      VALUES ($1, 'foul', $2, $3, 1, '06:00:00', '{"type": "personal", "severity": "minor"}')
    `, [testGame.id, testPlayer2.id, testTeam2.id]);
  });

  afterAll(async () => {
    // Clean up test data
    if (testGame) {
      await db.query('DELETE FROM games WHERE id = $1', [testGame.id]);
    }
    if (testTeam1) {
      await db.query('DELETE FROM teams WHERE id = $1', [testTeam1.id]);
    }
    if (testTeam2) {
      await db.query('DELETE FROM teams WHERE id = $1', [testTeam2.id]);
    }
    await db.query('DELETE FROM users WHERE username = $1', ['exporttester']);
  });

  describe('🎯 Match Export', () => {
    it('✅ should export match data as CSV', async () => {
      const response = await request(app)
        .get(`/api/export/match/${testGame.id}/csv`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.text).toContain('=== GAME METADATA ===');
      expect(response.text).toContain('=== SHOTS ===');
      expect(response.text).toContain('=== SUBSTITUTIONS ===');
      expect(response.text).toContain('=== TIMEOUTS ===');
      expect(response.text).toContain('=== FOULS ===');
      expect(response.text).toContain('=== PLAYER PARTICIPATION ===');
      expect(response.text).toContain('Export Test Team 1');
      expect(response.text).toContain('Export Test Team 2');
    });

    it('✅ should include shot data in CSV', async () => {
      const response = await request(app)
        .get(`/api/export/match/${testGame.id}/csv`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.text).toContain('50.0'); // x_coord
      expect(response.text).toContain('goal');
      expect(response.text).toContain('jump shot');
      expect(response.text).toContain('5.5'); // distance
      expect(response.text).toContain('Export Player1');
    });

    it('✅ should include game metadata in CSV', async () => {
      const response = await request(app)
        .get(`/api/export/match/${testGame.id}/csv`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.text).toContain('Home Team,Export Test Team 1');
      expect(response.text).toContain('Away Team,Export Test Team 2');
      expect(response.text).toContain('Status,in_progress');
    });

    it('✅ should include substitution data in CSV', async () => {
      const response = await request(app)
        .get(`/api/export/match/${testGame.id}/csv`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.text).toContain('tactical');
      expect(response.text).toContain('Export Player1');
    });

    it('✅ should include timeout data in CSV', async () => {
      const response = await request(app)
        .get(`/api/export/match/${testGame.id}/csv`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.text).toContain('team');
      expect(response.text).toContain('Coach Smith');
      expect(response.text).toContain('Strategy discussion');
    });

    it('✅ should include foul data in CSV', async () => {
      const response = await request(app)
        .get(`/api/export/match/${testGame.id}/csv`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.text).toContain('foul');
      expect(response.text).toContain('Export Player2');
    });

    it('✅ should include player participation data in CSV', async () => {
      const response = await request(app)
        .get(`/api/export/match/${testGame.id}/csv`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.text).toContain('Export Player1');
      expect(response.text).toContain('Export Player2');
      expect(response.text).toContain('offense'); // starting position
      expect(response.text).toContain('defense');
    });

    it('❌ should return 404 for non-existent game', async () => {
      const response = await request(app)
        .get('/api/export/match/999999/csv')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('Game not found');
    });

    it('❌ should require authentication', async () => {
      await request(app)
        .get(`/api/export/match/${testGame.id}/csv`)
        .expect(401);
    });

    it('❌ should reject invalid game ID', async () => {
      const response = await request(app)
        .get('/api/export/match/invalid/csv')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });

  describe('📅 Season Export', () => {
    it('✅ should export season data as CSV', async () => {
      const response = await request(app)
        .get('/api/export/season/csv')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.text).toContain('=== SEASON SUMMARY ===');
      expect(response.text).toContain('=== PLAYER STATISTICS ===');
      expect(response.text).toContain('=== TEAM STATISTICS ===');
    });

    it('✅ should filter by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await request(app)
        .get(`/api/export/season/csv?date_from=${today}&date_to=${today}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.text).toContain(`Date From,${today}`);
      expect(response.text).toContain(`Date To,${today}`);
    });

    it('✅ should filter by team', async () => {
      const response = await request(app)
        .get(`/api/export/season/csv?team_id=${testTeam1.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.text).toContain(`Team Filter,${testTeam1.id}`);
    });

    it('✅ should support custom includes', async () => {
      const response = await request(app)
        .get('/api/export/season/csv?include=player_stats,team_stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.text).toContain('=== PLAYER STATISTICS ===');
      expect(response.text).toContain('=== TEAM STATISTICS ===');
      expect(response.text).not.toContain('=== HEAD-TO-HEAD RECORDS ===');
    });

    it('✅ should include shot zones when requested', async () => {
      const response = await request(app)
        .get('/api/export/season/csv?include=shot_zones')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.text).toContain('=== SHOT ACCURACY BY ZONE/DISTANCE ===');
    });

    it('✅ should include events timeline when requested', async () => {
      const response = await request(app)
        .get('/api/export/season/csv?include=events')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.text).toContain('=== TIMELINE OF EVENTS ===');
    });

    it('❌ should require authentication', async () => {
      await request(app)
        .get('/api/export/season/csv')
        .expect(401);
    });

    it('❌ should reject invalid date format', async () => {
      const response = await request(app)
        .get('/api/export/season/csv?date_from=invalid-date')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });

  describe('🎲 Bulk Games Export', () => {
    it('✅ should export multiple games as CSV', async () => {
      const response = await request(app)
        .get(`/api/export/games/csv?game_ids=${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.text).toContain('=== BULK GAMES EXPORT ===');
      expect(response.text).toContain('=== GAMES LIST ===');
      expect(response.text).toContain('Export Test Team 1');
    });

    it('✅ should include shots in bulk export', async () => {
      const response = await request(app)
        .get(`/api/export/games/csv?game_ids=${testGame.id}&columns=shots`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.text).toContain('=== SHOTS (ALL GAMES) ===');
      expect(response.text).toContain('Export Player1');
      expect(response.text).not.toContain('=== SUBSTITUTIONS');
    });

    it('✅ should include substitutions in bulk export', async () => {
      const response = await request(app)
        .get(`/api/export/games/csv?game_ids=${testGame.id}&columns=substitutions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.text).toContain('=== SUBSTITUTIONS (ALL GAMES) ===');
      expect(response.text).toContain('tactical');
    });

    it('✅ should include timeouts in bulk export', async () => {
      const response = await request(app)
        .get(`/api/export/games/csv?game_ids=${testGame.id}&columns=timeouts`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.text).toContain('=== TIMEOUTS (ALL GAMES) ===');
      expect(response.text).toContain('Coach Smith');
    });

    it('✅ should include fouls in bulk export', async () => {
      const response = await request(app)
        .get(`/api/export/games/csv?game_ids=${testGame.id}&columns=fouls`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.text).toContain('=== FOULS (ALL GAMES) ===');
      expect(response.text).toContain('Export Player2');
    });

    it('✅ should include participation in bulk export', async () => {
      const response = await request(app)
        .get(`/api/export/games/csv?game_ids=${testGame.id}&columns=participation`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.text).toContain('=== PLAYER PARTICIPATION (ALL GAMES) ===');
      expect(response.text).toContain('Export Player1');
      expect(response.text).toContain('Export Player2');
    });

    it('✅ should filter by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await request(app)
        .get(`/api/export/games/csv?date_from=${today}&date_to=${today}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.text).toContain(`Date From,${today}`);
    });

    it('✅ should filter by team', async () => {
      const response = await request(app)
        .get(`/api/export/games/csv?team_id=${testTeam1.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.text).toContain('Export Test Team 1');
    });

    it('❌ should return 404 when no games match filters', async () => {
      const response = await request(app)
        .get('/api/export/games/csv?game_ids=999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('No games found matching the criteria');
    });

    it('❌ should require authentication', async () => {
      await request(app)
        .get('/api/export/games/csv')
        .expect(401);
    });
  });

  describe('🔒 CSV Security', () => {
    it('✅ should properly escape CSV values with commas', async () => {
      // Add a shot with comma in shot type
      await db.query(`
        INSERT INTO shots (game_id, player_id, team_id, x_coord, y_coord, result, period, time_remaining, shot_type, distance)
        VALUES ($1, $2, $3, 45.0, 55.0, 'goal', 1, '08:00:00', 'long-range, high-arc shot', 7.5)
      `, [testGame.id, testPlayer1.id, testTeam1.id]);

      const response = await request(app)
        .get(`/api/export/match/${testGame.id}/csv`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should be properly quoted
      expect(response.text).toContain('"long-range, high-arc shot"');
    });

    it('✅ should properly escape CSV values with quotes', async () => {
      // Add a timeout with quotes in reason
      await db.query(`
        INSERT INTO timeouts (game_id, team_id, timeout_type, period, time_remaining, duration, reason, called_by)
        VALUES ($1, $2, 'team', 1, '04:00:00', '01:00:00', 'Coach said "take a breath"', 'Coach')
      `, [testGame.id, testTeam1.id]);

      const response = await request(app)
        .get(`/api/export/match/${testGame.id}/csv`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should properly escape quotes
      expect(response.text).toContain('Coach said ""take a breath""');
    });

    it('✅ should handle NULL values gracefully', async () => {
      const response = await request(app)
        .get(`/api/export/match/${testGame.id}/csv`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should not contain "null" strings, just empty values
      const csvLines = response.text.split('\n');
      csvLines.forEach(line => {
        if (line.includes(',null,') || line.endsWith(',null')) {
          fail('CSV contains "null" string instead of empty value');
        }
      });
    });
  });
});
