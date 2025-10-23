import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

describe('Game Rosters API', () => {
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
    // Create test users
    const adminResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      ['admin_roster', 'admin_roster@test.com', 'hash', 'admin']
    );
    adminUser = adminResult.rows[0];
    authToken = jwt.sign({ id: adminUser.id, username: adminUser.username, role: 'admin' }, process.env.JWT_SECRET);

    const coachResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      ['coach_roster', 'coach_roster@test.com', 'hash', 'coach']
    );
    coachUser = coachResult.rows[0];
    coachToken = jwt.sign({ id: coachUser.id, username: coachUser.username, role: 'coach' }, process.env.JWT_SECRET);

    const viewerResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      ['viewer_roster', 'viewer_roster@test.com', 'hash', 'viewer']
    );
    viewerUser = viewerResult.rows[0];
    viewerToken = jwt.sign({ id: viewerUser.id, username: viewerUser.username, role: 'viewer' }, process.env.JWT_SECRET);

    // Create test teams
    const homeResult = await db.query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING *',
      ['Roster Home Team']
    );
    homeTeam = homeResult.rows[0];

    const awayResult = await db.query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING *',
      ['Roster Away Team']
    );
    awayTeam = awayResult.rows[0];

    // Create test players
    const hp1 = await db.query(
      'INSERT INTO players (team_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [homeTeam.id, 'John', 'Doe', 10, 'male']
    );
    homePlayer1 = hp1.rows[0];

    const hp2 = await db.query(
      'INSERT INTO players (team_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [homeTeam.id, 'Jane', 'Smith', 15, 'female']
    );
    homePlayer2 = hp2.rows[0];

    const hp3 = await db.query(
      'INSERT INTO players (team_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [homeTeam.id, 'Bob', 'Johnson', 20, 'male']
    );
    _homePlayer3 = hp3.rows[0];

    const ap1 = await db.query(
      'INSERT INTO players (team_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [awayTeam.id, 'Alice', 'Williams', 12, 'female']
    );
    _awayPlayer1 = ap1.rows[0];

    const ap2 = await db.query(
      'INSERT INTO players (team_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [awayTeam.id, 'Charlie', 'Brown', 18, 'male']
    );
    _awayPlayer2 = ap2.rows[0];

    // Create test game
    const gameResult = await db.query(
      `INSERT INTO games (home_team_id, away_team_id, date, status) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [homeTeam.id, awayTeam.id, new Date(), 'scheduled']
    );
    testGame = gameResult.rows[0];
  });

  afterAll(async () => {
    // Clean up in reverse order of dependencies
    await db.query('DELETE FROM game_rosters WHERE game_id = $1', [testGame.id]);
    await db.query('DELETE FROM games WHERE id = $1', [testGame.id]);
    await db.query('DELETE FROM players WHERE team_id IN ($1, $2)', [homeTeam.id, awayTeam.id]);
    await db.query('DELETE FROM teams WHERE id IN ($1, $2)', [homeTeam.id, awayTeam.id]);
    await db.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [adminUser.id, coachUser.id, viewerUser.id]);
    await db.closePool();
  });

  beforeEach(async () => {
    // Clear rosters before each test
    await db.query('DELETE FROM game_rosters WHERE game_id = $1', [testGame.id]);
  });

  describe('POST /api/game-rosters/:gameId', () => {
    it('should add players to game roster with captain', async () => {
      const response = await request(app)
        .post(`/api/game-rosters/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          players: [
            { team_id: homeTeam.id, player_id: homePlayer1.id, is_captain: true, is_starting: true },
            { team_id: homeTeam.id, player_id: homePlayer2.id, is_captain: false, is_starting: true }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].is_captain).toBe(true);
      expect(response.body[1].is_captain).toBe(false);
    });

    it('should reject multiple captains for same team', async () => {
      const response = await request(app)
        .post(`/api/game-rosters/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          players: [
            { team_id: homeTeam.id, player_id: homePlayer1.id, is_captain: true, is_starting: true },
            { team_id: homeTeam.id, player_id: homePlayer2.id, is_captain: true, is_starting: true }
          ]
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Only one captain');
    });

    it('should reject if game does not exist', async () => {
      const response = await request(app)
        .post('/api/game-rosters/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          players: [
            { team_id: homeTeam.id, player_id: homePlayer1.id, is_captain: true, is_starting: true }
          ]
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/game-rosters/${testGame.id}`)
        .send({
          players: [
            { team_id: homeTeam.id, player_id: homePlayer1.id, is_captain: true, is_starting: true }
          ]
        });

      expect(response.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post(`/api/game-rosters/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          players: [
            { team_id: homeTeam.id } // Missing player_id
          ]
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should allow coaches to manage rosters', async () => {
      const response = await request(app)
        .post(`/api/game-rosters/${testGame.id}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          players: [
            { team_id: homeTeam.id, player_id: homePlayer1.id, is_captain: true, is_starting: true }
          ]
        });

      expect(response.status).toBe(201);
    });
  });

  describe('GET /api/game-rosters/:gameId', () => {
    beforeEach(async () => {
      // Add some roster entries
      await db.query(
        `INSERT INTO game_rosters (game_id, team_id, player_id, is_captain, is_starting) 
         VALUES ($1, $2, $3, $4, $5), ($1, $2, $6, $7, $8)`,
        [testGame.id, homeTeam.id, homePlayer1.id, true, true, homePlayer2.id, false, true]
      );
    });

    it('should get all roster entries for a game', async () => {
      const response = await request(app)
        .get(`/api/game-rosters/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
      
      const captain = response.body.find(p => p.is_captain);
      expect(captain).toBeDefined();
      expect(captain.first_name).toBeDefined();
    });

    it('should filter by team_id', async () => {
      const response = await request(app)
        .get(`/api/game-rosters/${testGame.id}?team_id=${homeTeam.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.every(p => p.team_id === homeTeam.id)).toBe(true);
    });

    it('should return empty array if no roster entries', async () => {
      // Clear roster
      await db.query('DELETE FROM game_rosters WHERE game_id = $1', [testGame.id]);

      const response = await request(app)
        .get(`/api/game-rosters/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/game-rosters/${testGame.id}`);

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/game-rosters/:gameId/:rosterId', () => {
    let rosterId;

    beforeEach(async () => {
      // Add a roster entry
      const result = await db.query(
        `INSERT INTO game_rosters (game_id, team_id, player_id, is_captain, is_starting) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [testGame.id, homeTeam.id, homePlayer1.id, false, true]
      );
      rosterId = result.rows[0].id;
    });

    it('should update roster entry to make player captain', async () => {
      const response = await request(app)
        .put(`/api/game-rosters/${testGame.id}/${rosterId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ is_captain: true });

      expect(response.status).toBe(200);
      expect(response.body.is_captain).toBe(true);
    });

    it('should update starting status', async () => {
      const response = await request(app)
        .put(`/api/game-rosters/${testGame.id}/${rosterId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ is_starting: false });

      expect(response.status).toBe(200);
      expect(response.body.is_starting).toBe(false);
    });

    it('should return 404 if roster entry not found', async () => {
      const response = await request(app)
        .put(`/api/game-rosters/${testGame.id}/99999`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ is_captain: true });

      expect(response.status).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .put(`/api/game-rosters/${testGame.id}/${rosterId}`)
        .send({ is_captain: true });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/game-rosters/:gameId/:rosterId', () => {
    let rosterId;

    beforeEach(async () => {
      const result = await db.query(
        `INSERT INTO game_rosters (game_id, team_id, player_id, is_captain, is_starting) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [testGame.id, homeTeam.id, homePlayer1.id, false, true]
      );
      rosterId = result.rows[0].id;
    });

    it('should remove player from roster', async () => {
      const response = await request(app)
        .delete(`/api/game-rosters/${testGame.id}/${rosterId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(204);
      
      // Verify deleted
      const check = await db.query('SELECT * FROM game_rosters WHERE id = $1', [rosterId]);
      expect(check.rows.length).toBe(0);
    });

    it('should return 404 if roster entry not found', async () => {
      const response = await request(app)
        .delete(`/api/game-rosters/${testGame.id}/99999`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete(`/api/game-rosters/${testGame.id}/${rosterId}`);

      expect(response.status).toBe(401);
    });
  });

  describe('Authorization', () => {
    it('should deny viewers from managing rosters', async () => {
      const response = await request(app)
        .post(`/api/game-rosters/${testGame.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          players: [
            { team_id: homeTeam.id, player_id: homePlayer1.id, is_captain: true, is_starting: true }
          ]
        });

      expect(response.status).toBe(403);
    });
  });

  describe('Edge Cases', () => {
    it('should handle large roster (10 players)', async () => {
      // Create additional players
      const players = [];
      for (let i = 0; i < 10; i++) {
        const player = await db.query(
          'INSERT INTO players (team_id, first_name, last_name, jersey_number, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [homeTeam.id, `Player${i}`, `Test${i}`, 30 + i, i % 2 === 0 ? 'male' : 'female']
        );
        players.push({
          team_id: homeTeam.id,
          player_id: player.rows[0].id,
          is_captain: i === 0,
          is_starting: i < 8
        });
      }

      const response = await request(app)
        .post(`/api/game-rosters/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ players });

      expect(response.status).toBe(201);
      expect(response.body).toHaveLength(10);
      
      // Only first player should be captain
      const captains = response.body.filter(p => p.is_captain);
      expect(captains).toHaveLength(1);

      // Clean up
      await db.query('DELETE FROM players WHERE jersey_number >= 30 AND team_id = $1', [homeTeam.id]);
    });

    it('should handle empty roster', async () => {
      const response = await request(app)
        .post(`/api/game-rosters/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ players: [] });

      expect(response.status).toBe(201);
      expect(response.body).toEqual([]);
    });

    it('should replace existing roster when posting new one', async () => {
      // Add initial roster
      await request(app)
        .post(`/api/game-rosters/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          players: [
            { team_id: homeTeam.id, player_id: homePlayer1.id, is_captain: true, is_starting: true }
          ]
        });

      // Replace with new roster
      const response = await request(app)
        .post(`/api/game-rosters/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          players: [
            { team_id: homeTeam.id, player_id: homePlayer2.id, is_captain: true, is_starting: true }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].player_id).toBe(homePlayer2.id);
      
      // Verify old roster is gone
      const check = await db.query(
        'SELECT * FROM game_rosters WHERE game_id = $1 AND player_id = $2',
        [testGame.id, homePlayer1.id]
      );
      expect(check.rows.length).toBe(0);
    });
  });
});
