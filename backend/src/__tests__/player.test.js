import request from 'supertest';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import app from '../app.js';

describe('Player Management API', () => {
  let authToken;
  let testTeamId;
  const testUser = {
    id: 1,
    username: 'testuser',
    role: 'coach'
  };

  beforeAll(async () => {
    // Create auth token for testing
    authToken = jwt.sign(testUser, process.env.JWT_SECRET, {
      expiresIn: '1h'
    });
  });

  beforeEach(async () => {
    // Clear tables before each test
    await db.query('DELETE FROM players');
    await db.query('DELETE FROM teams');
    await db.query('ALTER SEQUENCE teams_id_seq RESTART WITH 1');
    await db.query('ALTER SEQUENCE players_id_seq RESTART WITH 1');

    // Add wait time to ensure sequences are reset
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create a test team
    const teamResult = await db.query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING *',
      ['Test Team']
    );
    testTeamId = teamResult.rows[0].id;
  });

  afterEach(async () => {
    // Clear tables after each test
    await db.query('DELETE FROM players');
    await db.query('DELETE FROM teams');
    await db.query('ALTER SEQUENCE teams_id_seq RESTART WITH 1');
    await db.query('ALTER SEQUENCE players_id_seq RESTART WITH 1');
  });

  afterAll(async () => {
    // Clean up after tests
    await db.query('DELETE FROM players');
    await db.query('DELETE FROM teams');
    // Pool will be closed by global teardown
  });

  describe('GET /api/players', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/players');
      
      expect(response.status).toBe(401);
    });

    it('should return empty array when no players exist', async () => {
      const response = await request(app)
        .get('/api/players')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/players/team/:teamId', () => {
    it('should get players by team', async () => {
      // First create a test player
      await db.query(
        'INSERT INTO players (team_id, first_name, last_name, jersey_number, role) VALUES ($1, $2, $3, $4, $5)',
        [testTeamId, 'John', 'Doe', 10, 'Player']
      );

      const response = await request(app)
        .get(`/api/players/team/${testTeamId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].first_name).toBe('John');
    });

    it('should return empty array for non-existent team', async () => {
      const response = await request(app)
        .get('/api/players/team/999')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('POST /api/players', () => {
    const newPlayer = {
      team_id: null, // Will be set in beforeEach
      first_name: 'Jane',
      last_name: 'Smith',
      jersey_number: 7,
      role: 'Player'
    };

    beforeEach(() => {
      newPlayer.team_id = testTeamId;
    });

    it('should create a new player', async () => {
      const response = await request(app)
        .post('/api/players')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newPlayer);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.first_name).toBe(newPlayer.first_name);
      expect(response.body.last_name).toBe(newPlayer.last_name);
      expect(response.body.jersey_number).toBe(newPlayer.jersey_number);
    });

    it('should validate required fields', async () => {
      const invalidPlayer = {
        team_id: testTeamId,
        // Missing first_name and last_name
        jersey_number: 8
      };

      const response = await request(app)
        .post('/api/players')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPlayer);
      
      expect(response.status).toBe(400);
    });

    it('should validate jersey number uniqueness within team', async () => {
      // First create a player directly in the database with the test team
      await db.query(
        'INSERT INTO players (team_id, first_name, last_name, jersey_number, role) VALUES ($1, $2, $3, $4, $5)',
        [testTeamId, 'First', 'Player', 7, 'Player']
      );

      // Try to create another player with the same jersey number in the same team
      const duplicateJerseyPlayer = {
        team_id: testTeamId,
        first_name: 'Another',
        last_name: 'Player',
        jersey_number: 7,
        role: 'Player'
      };

      const response = await request(app)
        .post('/api/players')
        .set('Authorization', `Bearer ${authToken}`)
        .send(duplicateJerseyPlayer);
      
      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error', 'Jersey number already in use for this team');
    });
  });

  describe('PUT /api/players/:id', () => {
    let playerId;

    beforeEach(async () => {
      const result = await db.query(
        'INSERT INTO players (team_id, first_name, last_name, jersey_number, role) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [testTeamId, 'Update', 'Test', 15, 'Player']
      );
      playerId = result.rows[0].id;
    });

    it('should update an existing player', async () => {
      const updatedData = {
        team_id: testTeamId,
        first_name: 'Updated',
        last_name: 'Name',
        jersey_number: 16,
        role: 'Player',
        is_active: false
      };

      const response = await request(app)
        .put(`/api/players/${playerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedData);
      
      expect(response.status).toBe(200);
      expect(response.body.first_name).toBe(updatedData.first_name);
      expect(response.body.last_name).toBe(updatedData.last_name);
      expect(response.body.jersey_number).toBe(updatedData.jersey_number);
      expect(response.body.is_active).toBe(updatedData.is_active);
    });

    it('should return 404 for non-existent player', async () => {
      // Create a test team for valid foreign key
      const teamResult = await db.query(
        'INSERT INTO teams (name) VALUES ($1) RETURNING *',
        ['Another Test Team']
      );
      const teamId = teamResult.rows[0].id;

      const response = await request(app)
        .put('/api/players/999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          team_id: teamId,
          first_name: 'Test',
          last_name: 'Player',
          jersey_number: 20,
          role: 'Player'
        });
      
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/players/:id', () => {
    let playerId;

    beforeEach(async () => {
      const result = await db.query(
        'INSERT INTO players (team_id, first_name, last_name, jersey_number, role) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [testTeamId, 'Delete', 'Test', 25, 'Player']
      );
      playerId = result.rows[0].id;
    });

    it('should delete an existing player', async () => {
      const response = await request(app)
        .delete(`/api/players/${playerId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(204);

      // Verify player was deleted
      const checkPlayer = await db.query('SELECT * FROM players WHERE id = $1', [playerId]);
      expect(checkPlayer.rows).toHaveLength(0);
    });

    it('should return 404 for non-existent player', async () => {
      const response = await request(app)
        .delete('/api/players/999')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(404);
    });
  });
});