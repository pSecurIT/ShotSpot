import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

describe('📤 Exports API', () => {
  let authToken;
  let coachToken;
  let userToken;
  let adminUser;
  let coachUser;
  let regularUser;
  let club1;
  let club2;
  let player1;
  let player2;
  let game1;
  let game2;

  beforeAll(async () => {
    console.log('🔧 Setting up Exports API tests...');
    try {
      const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Create test users with different roles
      const adminResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [`admin_exports_${uniqueId}`, `admin_exports_${uniqueId}@test.com`, 'hash', 'admin']
      );
      adminUser = adminResult.rows[0];
      authToken = jwt.sign({ id: adminUser.id, role: 'admin' }, process.env.JWT_SECRET);

      const coachResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [`coach_exports_${uniqueId}`, `coach_exports_${uniqueId}@test.com`, 'hash', 'coach']
      );
      coachUser = coachResult.rows[0];
      coachToken = jwt.sign({ id: coachUser.id, role: 'coach' }, process.env.JWT_SECRET);

      const userResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [`user_exports_${uniqueId}`, `user_exports_${uniqueId}@test.com`, 'hash', 'user']
      );
      regularUser = userResult.rows[0];
      userToken = jwt.sign({ id: regularUser.id, role: 'user' }, process.env.JWT_SECRET);

      // Create test teams
      const club1Result = await db.query(
        'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
        [`Export Team Alpha ${uniqueId}`]
      );
      club1 = club1Result.rows[0];

      const club2Result = await db.query(
        'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
        [`Export Team Beta ${uniqueId}`]
      );
      club2 = club2Result.rows[0];

      // Create test players
      const player1Result = await db.query(
        'INSERT INTO players (club_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [club1.id, 'John', 'Doe', 10, 'male']
      );
      player1 = player1Result.rows[0];

      const player2Result = await db.query(
        'INSERT INTO players (club_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [club2.id, 'Jane', 'Smith', 20, 'female']
      );
      player2 = player2Result.rows[0];

      // Create test games
      const game1Result = await db.query(
        `INSERT INTO games (home_club_id, away_club_id, date, status, home_score, away_score, current_period) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [club1.id, club2.id, new Date('2025-11-01'), 'completed', 15, 12, 4]
      );
      game1 = game1Result.rows[0];

      const game2Result = await db.query(
        `INSERT INTO games (home_club_id, away_club_id, date, status, home_score, away_score, current_period) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [club2.id, club1.id, new Date('2025-11-08'), 'completed', 18, 16, 4]
      );
      game2 = game2Result.rows[0];

      // Add players to game rosters
      await db.query(
        'INSERT INTO game_rosters (game_id, club_id, player_id, is_captain, is_starting, starting_position) VALUES ($1, $2, $3, $4, $5, $6)',
        [game1.id, club1.id, player1.id, true, true, 'offense']
      );
      await db.query(
        'INSERT INTO game_rosters (game_id, club_id, player_id, is_captain, is_starting, starting_position) VALUES ($1, $2, $3, $4, $5, $6)',
        [game1.id, club2.id, player2.id, false, true, 'defense']
      );
      await db.query(
        'INSERT INTO game_rosters (game_id, club_id, player_id, is_captain, is_starting, starting_position) VALUES ($1, $2, $3, $4, $5, $6)',
        [game2.id, club1.id, player1.id, true, true, 'offense']
      );
      await db.query(
        'INSERT INTO game_rosters (game_id, club_id, player_id, is_captain, is_starting, starting_position) VALUES ($1, $2, $3, $4, $5, $6)',
        [game2.id, club2.id, player2.id, false, true, 'defense']
      );

      // Add test shots
      await db.query(
        'INSERT INTO shots (game_id, player_id, club_id, x_coord, y_coord, result, period, shot_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [game1.id, player1.id, club1.id, 10.5, 5.3, 'goal', 1, 'standard']
      );
      await db.query(
        'INSERT INTO shots (game_id, player_id, club_id, x_coord, y_coord, result, period, shot_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [game1.id, player1.id, club1.id, 12.0, 6.0, 'miss', 2, 'standard']
      );
      await db.query(
        'INSERT INTO shots (game_id, player_id, club_id, x_coord, y_coord, result, period, shot_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [game1.id, player2.id, club2.id, 8.5, 4.2, 'goal', 1, 'standard']
      );

      // Add test events
      await db.query(
        'INSERT INTO game_events (game_id, event_type, player_id, club_id, period) VALUES ($1, $2, $3, $4, $5)',
        [game1.id, 'foul', player1.id, club1.id, 2]
      );
    } catch (error) {
      console.error('⚠️ Exports API setup failed:', error.message);
      throw error;
    }
  });

  afterAll(async () => {
    console.log('✅ Exports API tests completed');
    try {
      // Clean up test data in correct order (respecting foreign key constraints)
      await db.query('DELETE FROM shots WHERE game_id IN ($1, $2)', [game1.id, game2.id]);
      await db.query('DELETE FROM game_events WHERE game_id IN ($1, $2)', [game1.id, game2.id]);
      await db.query('DELETE FROM game_rosters WHERE game_id IN ($1, $2)', [game1.id, game2.id]);
      await db.query('DELETE FROM games WHERE id IN ($1, $2)', [game1.id, game2.id]);
      await db.query('DELETE FROM players WHERE id IN ($1, $2)', [player1.id, player2.id]);
      await db.query('DELETE FROM clubs WHERE id IN ($1, $2)', [club1.id, club2.id]);
      await db.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [adminUser.id, coachUser.id, regularUser.id]);
    } catch (error) {
      console.error('⚠️ Exports API cleanup failed:', error.message);
    }
  });

  describe('📄 POST /api/exports/match-pdf/:gameId', () => {
    it('✅ should generate match PDF with admin token', async () => {
      const response = await request(app)
        .post(`/api/exports/match-pdf/${game1.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ template: 'summary' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('match-');
      expect(response.headers['content-disposition']).toContain('.pdf');
    });

    it('✅ should generate match PDF with coach token', async () => {
      const response = await request(app)
        .post(`/api/exports/match-pdf/${game1.id}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ template: 'detailed' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
    });

    it('❌ should reject match PDF request without authentication', async () => {
      const response = await request(app)
        .post(`/api/exports/match-pdf/${game1.id}`)
        .send({ template: 'summary' });

      expect(response.status).toBe(401);
    });

    it('❌ should reject match PDF request with regular user token', async () => {
      const response = await request(app)
        .post(`/api/exports/match-pdf/${game1.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ template: 'summary' });

      expect(response.status).toBe(403);
    });

    it('❌ should reject invalid template', async () => {
      const response = await request(app)
        .post(`/api/exports/match-pdf/${game1.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ template: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Template must be');
    });

    it('❌ should return 404 for non-existent game', async () => {
      const response = await request(app)
        .post('/api/exports/match-pdf/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ template: 'summary' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Game not found');
    });
  });

  describe('📊 GET /api/exports/match-csv/:gameId', () => {
    it('✅ should generate match CSV with all sections', async () => {
      const response = await request(app)
        .get(`/api/exports/match-csv/${game1.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ sections: 'shots,events,players' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.headers['content-disposition']).toContain('match-');
      expect(response.headers['content-disposition']).toContain('.csv');
      expect(response.text).toContain('SHOTS');
      expect(response.text).toContain('EVENTS');
      expect(response.text).toContain('PLAYERS');
    });

    it('✅ should generate match CSV with only shots section', async () => {
      const response = await request(app)
        .get(`/api/exports/match-csv/${game1.id}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .query({ sections: 'shots' });

      expect(response.status).toBe(200);
      expect(response.text).toContain('SHOTS');
      expect(response.text).not.toContain('EVENTS');
    });

    it('❌ should reject invalid sections parameter', async () => {
      const response = await request(app)
        .get(`/api/exports/match-csv/${game1.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ sections: 'invalid,shots' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Sections must be');
    });

    it('❌ should reject match CSV request without authentication', async () => {
      const response = await request(app)
        .get(`/api/exports/match-csv/${game1.id}`);

      expect(response.status).toBe(401);
    });

    it('❌ should return 404 for non-existent game', async () => {
      const response = await request(app)
        .get('/api/exports/match-csv/999999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Game not found');
    });
  });

  describe('📅 POST /api/exports/season-pdf', () => {
    it('✅ should generate season PDF with team filter', async () => {
      const response = await request(app)
        .post('/api/exports/season-pdf')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ team_id: club1.id });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('season-report.pdf');
    });

    it('✅ should generate season PDF with date range', async () => {
      const response = await request(app)
        .post('/api/exports/season-pdf')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          start_date: '2025-10-01T00:00:00Z',
          end_date: '2025-12-31T23:59:59Z'
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
    });

    it('❌ should reject invalid team_id', async () => {
      const response = await request(app)
        .post('/api/exports/season-pdf')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ team_id: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Team ID must be');
    });

    it('❌ should reject invalid date format', async () => {
      const response = await request(app)
        .post('/api/exports/season-pdf')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ start_date: 'invalid-date' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('date must be in ISO 8601 format');
    });

    it('❌ should return 404 when no games found', async () => {
      const response = await request(app)
        .post('/api/exports/season-pdf')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          start_date: '2020-01-01T00:00:00Z',
          end_date: '2020-12-31T23:59:59Z'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('No games found for the specified criteria');
    });
  });

  describe('📈 GET /api/exports/season-csv', () => {
    it('✅ should generate season CSV with team filter', async () => {
      const response = await request(app)
        .get('/api/exports/season-csv')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ team_id: club1.id });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.headers['content-disposition']).toContain('season-report.csv');
      expect(response.text).toContain('Date');
      expect(response.text).toContain('Home Team');
      expect(response.text).toContain('Away Team');
    });

    it('✅ should generate season CSV with date range', async () => {
      const response = await request(app)
        .get('/api/exports/season-csv')
        .set('Authorization', `Bearer ${coachToken}`)
        .query({
          start_date: '2025-10-01T00:00:00Z',
          end_date: '2025-12-31T23:59:59Z'
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
    });

    it('❌ should reject invalid query parameters', async () => {
      const response = await request(app)
        .get('/api/exports/season-csv')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ team_id: 'invalid' });

      expect(response.status).toBe(400);
    });

    it('❌ should return 404 when no games found', async () => {
      const response = await request(app)
        .get('/api/exports/season-csv')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          start_date: '2020-01-01T00:00:00Z',
          end_date: '2020-12-31T23:59:59Z'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('No games found for the specified criteria');
    });
  });

  describe('📦 POST /api/exports/bulk', () => {
    it('✅ should generate bulk PDF export', async () => {
      const response = await request(app)
        .post('/api/exports/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          game_ids: [game1.id, game2.id],
          format: 'pdf'
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('bulk-export.pdf');
    });

    it('✅ should generate bulk CSV export', async () => {
      const response = await request(app)
        .post('/api/exports/bulk')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          game_ids: [game1.id, game2.id],
          format: 'csv'
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.headers['content-disposition']).toContain('bulk-export.csv');
    });

    it('❌ should reject empty game_ids array', async () => {
      const response = await request(app)
        .post('/api/exports/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          game_ids: [],
          format: 'pdf'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('non-empty array');
    });

    it('❌ should reject invalid format', async () => {
      const response = await request(app)
        .post('/api/exports/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          game_ids: [game1.id],
          format: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Format must be pdf or csv');
    });

    it('❌ should reject invalid game IDs', async () => {
      const response = await request(app)
        .post('/api/exports/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          game_ids: ['invalid', 1],
          format: 'pdf'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('👤 GET /api/exports/player-report/:playerId', () => {
    it('✅ should generate player report in PDF format', async () => {
      const response = await request(app)
        .get(`/api/exports/player-report/${player1.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ format: 'pdf' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain(`player-${player1.id}-report.pdf`);
    });

    it('✅ should generate player report in CSV format', async () => {
      const response = await request(app)
        .get(`/api/exports/player-report/${player1.id}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .query({ format: 'csv' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.headers['content-disposition']).toContain(`player-${player1.id}-report.csv`);
      expect(response.text).toContain('Date');
      expect(response.text).toContain('Goals');
    });

    it('✅ should default to PDF format when format not specified', async () => {
      const response = await request(app)
        .get(`/api/exports/player-report/${player1.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
    });

    it('❌ should return 404 for non-existent player', async () => {
      const response = await request(app)
        .get('/api/exports/player-report/999999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Player not found');
    });

    it('❌ should reject invalid format', async () => {
      const response = await request(app)
        .get(`/api/exports/player-report/${player1.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ format: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Format must be pdf or csv');
    });

    it('❌ should reject invalid player ID', async () => {
      const response = await request(app)
        .get('/api/exports/player-report/invalid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Player ID must be');
    });
  });
});



