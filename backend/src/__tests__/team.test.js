import request from 'supertest';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import app from '../app.js';

describe('Team Management API', () => {
  let authToken;
  const testUser = {
    id: 1,
    username: 'testuser',
    role: 'coach'
  };

  beforeAll(async () => {
    // Clean database and create auth token for testing
    authToken = jwt.sign(testUser, process.env.JWT_SECRET, {
      expiresIn: '1h'
    });

    // Clear everything first
    await db.query('DELETE FROM players');
    await db.query('DELETE FROM teams');
    await db.query('ALTER SEQUENCE teams_id_seq RESTART WITH 1');
    await db.query('ALTER SEQUENCE players_id_seq RESTART WITH 1');
  });

  beforeEach(async () => {
    // Clear all tables between tests
    await db.query('DELETE FROM players');
    await db.query('DELETE FROM teams');
    await db.query('ALTER SEQUENCE teams_id_seq RESTART WITH 1');
    await db.query('ALTER SEQUENCE players_id_seq RESTART WITH 1');
  });

  afterAll(async () => {
    // Clean up after tests
    await db.query('DELETE FROM players');
    await db.query('DELETE FROM teams');
    await db.pool.end();
  });

  // Test GET /api/teams
  describe('GET /api/teams', () => {
    describe('authentication', () => {
      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/teams');
        
        expect(response.status).toBe(401);
      });
    });

    describe('list teams', () => {
      it('should return empty array when no teams exist', async () => {
        // Clear tables before test
        await db.query('DELETE FROM players');
        await db.query('DELETE FROM teams');
        await db.query('ALTER SEQUENCE teams_id_seq RESTART WITH 1');
        await db.query('ALTER SEQUENCE players_id_seq RESTART WITH 1');

        // Add wait time to ensure sequences are reset
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const response = await request(app)
          .get('/api/teams')
          .set('Authorization', `Bearer ${authToken}`);
        
        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
      });
    });
  });

  // Test team creation
  describe('POST /api/teams', () => {
    it('should create a new team', async () => {
      const newTeam = { name: 'Test Team' };
      
      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newTeam);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(newTeam.name);
    });

    it('should validate team name', async () => {
      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '' });
      
      expect(response.status).toBe(400);
    });
  });

  // Test team updates
  describe('PUT /api/teams/:id', () => {
    let testTeam;

    beforeEach(async () => {
      // Create test team
      const result = await db.query(
        'INSERT INTO teams (name) VALUES ($1) RETURNING *',
        ['Update Test Team']
      );
      testTeam = result.rows[0];
    });

    it('should update an existing team', async () => {
      const updatedName = 'Updated Team Name';
      
      const response = await request(app)
        .put(`/api/teams/${testTeam.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: updatedName });
      
      expect(response.status).toBe(200);
      expect(response.body.name).toBe(updatedName);
    });

    it('should return 404 for non-existent team', async () => {
      const response = await request(app)
        .put('/api/teams/999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test' });
      
      expect(response.status).toBe(404);
    });
  });

  // Test team deletion
  describe('DELETE /api/teams/:id', () => {
    let teamId;
    let team;

    beforeEach(async () => {
      // Clear tables before test
      await db.query('DELETE FROM players');
      await db.query('DELETE FROM teams');
      await db.query('ALTER SEQUENCE teams_id_seq RESTART WITH 1');

      // Create test team
      const result = await db.query(
        'INSERT INTO teams (name) VALUES ($1) RETURNING *',
        ['Delete Test Team']
      );
      team = result.rows[0];
      teamId = team.id;
    });

    it('should delete an existing team', async () => {
      const response = await request(app)
        .delete(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);

      // Verify team was deleted
      const checkTeam = await db.query('SELECT * FROM teams WHERE id = $1', [teamId]);
      expect(checkTeam.rows).toHaveLength(0);
    });

    it('should return 404 for non-existent team', async () => {
      const response = await request(app)
        .delete('/api/teams/999')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(404);
    });
  });
});