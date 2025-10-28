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

describe('Team Routes', () => {
  let authToken;

  beforeAll(() => {
    // Generate test auth token
    authToken = generateTestToken('admin');
  });

  beforeEach(async () => {
    // Clear all tables in correct order (child tables first due to foreign keys)
    await db.query('DELETE FROM substitutions');
    await db.query('DELETE FROM game_rosters');
    await db.query('DELETE FROM ball_possessions');
    await db.query('DELETE FROM shots');
    await db.query('DELETE FROM game_events');
    await db.query('DELETE FROM games');
    await db.query('DELETE FROM players');
    await db.query('DELETE FROM teams');
  });

  afterAll(async () => {
    // Pool will be closed by global teardown
  });

  describe('GET /api/teams', () => {
    it('should return an empty array when no teams exist', async () => {
      const response = await request(app)
        .get('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return all teams', async () => {
      // Use unique team names to avoid conflicts - different for each query
      const teamName1 = generateUniqueTeamName('TeamAlpha');
      const teamName2 = generateUniqueTeamName('TeamBeta');
      
      // Insert test teams
      await db.query(
        'INSERT INTO teams (name) VALUES ($1) RETURNING *',
        [teamName1]
      );
      await db.query(
        'INSERT INTO teams (name) VALUES ($1) RETURNING *',
        [teamName2]
      );

      const response = await request(app)
        .get('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe(teamName1);
      expect(response.body[1].name).toBe(teamName2);
    });
  });

  describe('POST /api/teams', () => {
    it('should create a new team', async () => {
      const uniqueTeamName = generateUniqueTeamName('NewTeam');
      
      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({ name: uniqueTeamName })
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body.name).toBe(uniqueTeamName);
      expect(response.body.id).toBeDefined();

      // Verify team was created in database
      const dbResponse = await db.query('SELECT * FROM teams WHERE id = $1', [response.body.id]);
      expect(dbResponse.rows[0].name).toBe(uniqueTeamName);
    });

    it('should require a team name', async () => {
      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({})
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should prevent duplicate team names', async () => {
      const duplicateTeamName = generateUniqueTeamName('DuplicateTeam');
      
      // Create first team
      await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({ name: duplicateTeamName })
        .expect(201);

      // Try to create second team with same name
      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({ name: duplicateTeamName })
        .expect(409);

      expect(response.body.error).toContain('already exists');
    });
  });

  describe('PUT /api/teams/:id', () => {
    it('should update an existing team', async () => {
      // Create a team first
      const oldName = generateUniqueTeamName('OldTeam');
      const newName = generateUniqueTeamName('NewTeam');
      
      const createRes = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({ name: oldName })
        .expect(201);

      const teamId = createRes.body.id;

      // Update the team
      const response = await request(app)
        .put(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({ name: newName })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.name).toBe(newName);
      expect(response.body.id).toBe(teamId);

      // Verify update in database
      const dbResponse = await db.query('SELECT * FROM teams WHERE id = $1', [teamId]);
      expect(dbResponse.rows[0].name).toBe(newName);
    });

    it('should return 404 for non-existent team', async () => {
      const response = await request(app)
        .put('/api/teams/999')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({ name: 'New Name' })
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body.error).toContain('not found');
    });
  });

  describe('DELETE /api/teams/:id', () => {
    it('should delete an existing team', async () => {
      const teamName = generateUniqueTeamName('DeleteTeam');
      
      // Create a team first
      const createRes = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({ name: teamName })
        .expect(201);

      const teamId = createRes.body.id;

      // Delete the team
      await request(app)
        .delete(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify team was deleted
      const dbResponse = await db.query('SELECT * FROM teams WHERE id = $1', [teamId]);
      expect(dbResponse.rows).toHaveLength(0);
    });

    it('should return 404 for non-existent team', async () => {
      const response = await request(app)
        .delete('/api/teams/999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body.error).toContain('not found');
    });
  });
});