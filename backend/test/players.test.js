import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import { generateTestToken } from './helpers/testHelpers.js';

// Helper function to generate truly unique names
const generateUniqueTeamName = (prefix = 'Team') => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const processId = process.pid;
  return `${prefix}_${timestamp}_${random}_${processId}`;
};

describe('👤 Player Routes', () => {
  let testTeamId;
  let authToken;

  beforeAll(async () => {
    console.log('🔧 Setting up Player Routes tests...');
    // Generate test auth token with coach role
    authToken = generateTestToken('coach');

    try {
      // Clear all tables first to ensure clean state
      await db.query('DELETE FROM substitutions');
      await db.query('DELETE FROM game_rosters');
      await db.query('DELETE FROM ball_possessions');
      await db.query('DELETE FROM shots');
      await db.query('DELETE FROM game_events');
      await db.query('DELETE FROM games');
      await db.query('DELETE FROM players');
      await db.query('DELETE FROM teams');

      // Create a test team to use for player tests
      const uniqueTeamName = generateUniqueTeamName('TestTeamPlayers');
      const teamRes = await db.query(
        'INSERT INTO teams (name) VALUES ($1) RETURNING id',
        [uniqueTeamName]
      );
      testTeamId = teamRes.rows[0].id;
    } catch (error) {
      global.testContext.logTestError(error, 'Player Routes setup failed');
      throw error;
    }
  });

  beforeEach(async () => {
    try {
      // Clear only players table before each test (team persists)
      await db.query('DELETE FROM players WHERE team_id = $1', [testTeamId]);
    } catch (error) {
      global.testContext.logTestError(error, 'Player database cleanup failed');
      throw error;
    }
  });

  afterAll(async () => {
    console.log('✅ Player Routes tests completed');
    try {
      // Clean up test data in correct order
      await db.query('DELETE FROM players WHERE team_id = $1', [testTeamId]);
      await db.query('DELETE FROM teams WHERE id = $1', [testTeamId]);
    } catch (error) {
      console.error('⚠️ Player Routes cleanup failed:', error.message);
    }
  });

  describe('📊 GET /api/players', () => {
    it('✅ should return an empty array when no players exist', async () => {
      try {
        const response = await request(app)
          .get('/api/players')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toEqual([]);
      } catch (error) {
        global.testContext.logTestError(error, 'GET empty players array failed');
        throw error;
      }
    });

    it('✅ should return all players', async () => {
      try {
        // Insert test players
        await db.query(
          'INSERT INTO players (team_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4)',
          [testTeamId, 'John', 'Doe', 10]
        );
        await db.query(
          'INSERT INTO players (team_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4)',
          [testTeamId, 'Jane', 'Smith', 20]
        );

        const response = await request(app)
          .get('/api/players')
          .set('Authorization', `Bearer ${authToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveLength(2);
        expect(response.body[0].first_name).toBe('John');
        expect(response.body[1].first_name).toBe('Jane');
      } catch (error) {
        global.testContext.logTestError(error, 'GET all players failed');
        throw error;
      }
    });

    it('✅ should filter players by team_id', async () => {
      try {
        // Insert players for different teams
        await db.query(
          'INSERT INTO players (team_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4)',
          [testTeamId, 'John', 'Doe', 10]
        );

        const uniqueOtherTeamName = generateUniqueTeamName('OtherTeamPlayers');
        const otherTeamRes = await db.query(
          'INSERT INTO teams (name) VALUES ($1) RETURNING id',
          [uniqueOtherTeamName]
        );
        const otherTeamId = otherTeamRes.rows[0].id;

        await db.query(
          'INSERT INTO players (team_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4)',
          [otherTeamId, 'Jane', 'Smith', 20]
        );

        const response = await request(app)
          .get(`/api/players?team_id=${testTeamId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveLength(1);
        expect(response.body[0].first_name).toBe('John');

        // Clean up
        await db.query('DELETE FROM teams WHERE id = $1', [otherTeamId]);
      } catch (error) {
        global.testContext.logTestError(error, 'GET players by team_id filter failed');
        throw error;
      }
    });
  });

  describe('📝 POST /api/players', () => {
    it('✅ should create a new player', async () => {
      try {
        const newPlayer = {
          team_id: testTeamId,
          first_name: 'Test',
          last_name: 'Player',
          jersey_number: 30
        };

        const response = await request(app)
          .post('/api/players')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send(newPlayer)
          .expect('Content-Type', /json/)
          .expect(201);

        expect(response.body.first_name).toBe('Test');
        expect(response.body.last_name).toBe('Player');
        expect(response.body.jersey_number).toBe(30);
        expect(response.body.team_id).toBe(testTeamId);

        // Verify player was created in database
        const dbResponse = await db.query('SELECT * FROM players WHERE id = $1', [response.body.id]);
        expect(dbResponse.rows[0].first_name).toBe('Test');
      } catch (error) {
        global.testContext.logTestError(error, 'POST create player failed');
        throw error;
      }
    });

    it('❌ should validate required fields', async () => {
      try {
        const response = await request(app)
          .post('/api/players')
          .send({
            team_id: testTeamId,
            // Missing first_name and last_name
            jersey_number: 30
          })
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .expect('Content-Type', /json/)
          .expect(400);

        expect(response.body.validationErrors).toBeDefined();
      } catch (error) {
        global.testContext.logTestError(error, 'POST required fields validation failed');
        throw error;
      }
    });

    it('❌ should validate jersey number uniqueness within team', async () => {
      try {
        // Create first player
        await request(app)
          .post('/api/players')
          .send({
            team_id: testTeamId,
            first_name: 'First',
            last_name: 'Player',
            jersey_number: 30
          })
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .expect(201);

        // Try to create second player with same jersey number in same team
        const response = await request(app)
          .post('/api/players')
          .send({
            team_id: testTeamId,
            first_name: 'Second',
            last_name: 'Player',
            jersey_number: 30
          })
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .expect(409);

        expect(response.body.error).toContain('Jersey number');
      } catch (error) {
        global.testContext.logTestError(error, 'POST jersey number uniqueness validation failed');
        throw error;
      }
    });
  });

  describe('✏️ PUT /api/players/:id', () => {
    it('✅ should update an existing player', async () => {
      try {
        // Create a player first
        const createRes = await request(app)
          .post('/api/players')
          .send({
            team_id: testTeamId,
            first_name: 'Old',
            last_name: 'Name',
            jersey_number: 30
          })
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .expect(201);

        const playerId = createRes.body.id;

        // Update the player
        const response = await request(app)
          .put(`/api/players/${playerId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send({
            team_id: testTeamId,
            first_name: 'New',
            last_name: 'Name',
            jersey_number: 31
          })
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body.first_name).toBe('New');
        expect(response.body.last_name).toBe('Name');
        expect(response.body.jersey_number).toBe(31);

        // Verify update in database
        const dbResponse = await db.query('SELECT * FROM players WHERE id = $1', [playerId]);
        expect(dbResponse.rows[0].first_name).toBe('New');
      } catch (error) {
        global.testContext.logTestError(error, 'PUT update player failed');
        throw error;
      }
    });

    it('❌ should return 404 for non-existent player', async () => {
      try {
        const response = await request(app)
          .put('/api/players/999')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send({
            team_id: testTeamId,
            first_name: 'New',
            last_name: 'Name',
            jersey_number: 31
          })
          .expect('Content-Type', /json/)
          .expect(404);

        expect(response.body.error).toContain('not found');
      } catch (error) {
        global.testContext.logTestError(error, 'PUT non-existent player 404 failed');
        throw error;
      }
    });
  });

  describe('🗑️ DELETE /api/players/:id', () => {
    it('✅ should delete an existing player', async () => {
      try {
        // Create a player first
        const createRes = await request(app)
          .post('/api/players')
          .send({
            team_id: testTeamId,
            first_name: 'To',
            last_name: 'Delete',
            jersey_number: 99
          })
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .expect(201);

        const playerId = createRes.body.id;

        // Delete the player
        await request(app)
          .delete(`/api/players/${playerId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .expect(204);

        // Verify player was deleted
        const dbResponse = await db.query('SELECT * FROM players WHERE id = $1', [playerId]);
        expect(dbResponse.rows).toHaveLength(0);
      } catch (error) {
        global.testContext.logTestError(error, 'DELETE player failed');
        throw error;
      }
    });

    it('❌ should return 404 for non-existent player', async () => {
      try {
        const response = await request(app)
          .delete('/api/players/999')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .expect('Content-Type', /json/)
          .expect(404);

        expect(response.body.error).toContain('not found');
      } catch (error) {
        global.testContext.logTestError(error, 'DELETE non-existent player 404 failed');
        throw error;
      }
    });
  });
});