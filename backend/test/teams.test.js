import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import { generateTestToken } from './helpers/testHelpers.js';

describe('Team Routes', () => {
  let authToken;

  beforeAll(() => {
    // Generate test auth token
    authToken = generateTestToken('admin');
  });

  beforeEach(async () => {
    // Clear the teams table before each test
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
      // Insert test teams
      const team1 = await db.query(
        'INSERT INTO teams (name) VALUES ($1) RETURNING *',
        ['Team Alpha']
      );
      const team2 = await db.query(
        'INSERT INTO teams (name) VALUES ($1) RETURNING *',
        ['Team Beta']
      );

      const response = await request(app)
        .get('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('Team Alpha');
      expect(response.body[1].name).toBe('Team Beta');
    });
  });

  describe('POST /api/teams', () => {
    it('should create a new team', async () => {
      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({ name: 'New Team' })
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body.name).toBe('New Team');
      expect(response.body.id).toBeDefined();

      // Verify team was created in database
      const dbResponse = await db.query('SELECT * FROM teams WHERE id = $1', [response.body.id]);
      expect(dbResponse.rows[0].name).toBe('New Team');
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
      // Create first team
      await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({ name: 'Duplicate Team' })
        .expect(201);

      // Try to create second team with same name
      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({ name: 'Duplicate Team' })
        .expect(409);

      expect(response.body.error).toContain('already exists');
    });
  });

  describe('PUT /api/teams/:id', () => {
    it('should update an existing team', async () => {
      // Create a team first
      const createRes = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({ name: 'Old Name' })
        .expect(201);

      const teamId = createRes.body.id;

      // Update the team
      const response = await request(app)
        .put(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({ name: 'New Name' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.name).toBe('New Name');
      expect(response.body.id).toBe(teamId);

      // Verify update in database
      const dbResponse = await db.query('SELECT * FROM teams WHERE id = $1', [teamId]);
      expect(dbResponse.rows[0].name).toBe('New Name');
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
      // Create a team first
      const createRes = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({ name: 'Team to Delete' })
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