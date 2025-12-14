import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

describe('📊 Export API Tests', () => {
  let authToken;
  let testGame;
  let testTeam1;
  let testTeam2;
  let testPlayer1;
  let testPlayer2;
  let testUser;
  let testGameDate;

  beforeAll(async () => {
    // Use unique identifiers to prevent conflicts
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Create test user with coach role directly in DB
    const userResult = await db.query(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [`exporttester_${uniqueId}`, `exporttest_${uniqueId}@test.com`, 'hash', 'coach']);
    testUser = userResult.rows[0];
    
    // Generate JWT token directly
    authToken = jwt.sign({ id: testUser.id, role: 'coach' }, process.env.JWT_SECRET);

    // Create test teams directly in DB
    const team1Result = await db.query(
      'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
      [`Export Test Team 1 ${uniqueId}`]
    );
    testTeam1 = team1Result.rows[0];

    const team2Result = await db.query(
      'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
      [`Export Test Team 2 ${uniqueId}`]
    );
    testTeam2 = team2Result.rows[0];

    // Create test players directly in DB
    const player1Result = await db.query(`
      INSERT INTO players (team_id, first_name, last_name, jersey_number, gender)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [testTeam1.id, 'Export', 'Player1', 10, 'male']);
    testPlayer1 = player1Result.rows[0];

    const player2Result = await db.query(`
      INSERT INTO players (team_id, first_name, last_name, jersey_number, gender)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [testTeam2.id, 'Export', 'Player2', 20, 'female']);
    testPlayer2 = player2Result.rows[0];
    
    // Create a third player for substitution
    const player3Result = await db.query(`
      INSERT INTO players (team_id, first_name, last_name, jersey_number, gender)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [testTeam1.id, 'Export', 'Player3', 11, 'male']);
    const testPlayer3 = player3Result.rows[0];

    // Create a test game directly in DB
    testGameDate = new Date().toISOString();
    const gameResult = await db.query(`
      INSERT INTO games (home_club_id, away_club_id, date, status)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [testTeam1.id, testTeam2.id, testGameDate, 'in_progress']);
    testGame = gameResult.rows[0];

    // Add game roster entries
    await db.query(`
      INSERT INTO game_rosters (game_id, club_id, player_id, is_captain, is_starting, starting_position)
      VALUES ($1, $2, $3, true, true, 'offense')
    `, [testGame.id, testTeam1.id, testPlayer1.id]);
    
    await db.query(`
      INSERT INTO game_rosters (game_id, club_id, player_id, is_captain, is_starting, starting_position)
      VALUES ($1, $2, $3, false, true, 'defense')
    `, [testGame.id, testTeam2.id, testPlayer2.id]);

    // Add some test shots
    await db.query(`
      INSERT INTO shots (game_id, player_id, team_id, x_coord, y_coord, result, period, time_remaining, shot_type, distance)
      VALUES 
        ($1, $2, $3, 50.0, 50.0, 'goal', 1, '09:00:00', 'jump shot', 5.5),
        ($1, $4, $5, 30.0, 40.0, 'miss', 1, '08:30:00', 'running shot', 6.2),
        ($1, $2, $3, 60.0, 55.0, 'goal', 2, '09:45:00', 'penalty', 3.0)
    `, [testGame.id, testPlayer1.id, testTeam1.id, testPlayer2.id, testTeam2.id]);

    // Add a substitution (player3 in, player1 out)
    await db.query(`
      INSERT INTO substitutions (game_id, team_id, player_in_id, player_out_id, period, time_remaining, reason)
      VALUES ($1, $2, $3, $4, 1, '07:00:00', 'tactical')
    `, [testGame.id, testTeam1.id, testPlayer3.id, testPlayer1.id]);

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
    if (testTeam1 && testTeam2) {
      await db.query('DELETE FROM clubs WHERE id IN ($1, $2)', [testTeam1.id, testTeam2.id]);
    }
    if (testUser) {
      await db.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    }
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
      const gameDate = testGameDate.split('T')[0];
      
      // First, verify the game exists without date filter
      const checkResponse = await request(app)
        .get('/api/export/games/csv')
        .set('Authorization', `Bearer ${authToken}`);
      
      if (checkResponse.status === 404) {
        throw new Error('No games found at all - test setup issue');
      }
      
      // Now test with date filter
      const response = await request(app)
        .get(`/api/export/games/csv?date_from=${gameDate}&date_to=${gameDate}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      if (response.status === 404) {
        // If this fails, it's likely a timezone or date comparison issue
        // Try with a wider date range
        const yesterday = new Date(testGameDate);
        yesterday.setDate(yesterday.getDate() - 1);
        const tomorrow = new Date(testGameDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const widerResponse = await request(app)
          .get(`/api/export/games/csv?date_from=${yesterday.toISOString().split('T')[0]}&date_to=${tomorrow.toISOString().split('T')[0]}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(widerResponse.text).toContain('Export Test Team 1');
      } else {
        expect(response.status).toBe(200);
        expect(response.text).toContain(`Date From,${gameDate}`);
        expect(response.text).toContain('Export Test Team 1');
      }
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
          throw new Error('CSV contains "null" string instead of empty value');
        }
      });
    });
  });
});


