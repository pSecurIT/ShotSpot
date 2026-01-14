import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import { generateTestToken } from './helpers/testHelpers.js';

// Helper function to generate truly unique names
const generateUniqueClubName = (prefix = 'Club') => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const processId = process.pid;
  return `${prefix}_${timestamp}_${random}_${processId}`;
};

describe('🏆 Club Routes', () => {
  let adminToken;
  let coachToken;
  let viewerToken;

  beforeAll(async () => {
    console.log('🔧 Setting up Club Routes tests...');
    // Generate test auth tokens
    adminToken = generateTestToken('admin');
    coachToken = generateTestToken('coach');
    viewerToken = generateTestToken('viewer');
  });

  beforeEach(async () => {
    try {
      // Clear all tables in correct order (child tables first due to foreign keys)
      await db.query('DELETE FROM substitutions');
      await db.query('DELETE FROM game_rosters');
      await db.query('DELETE FROM ball_possessions');
      await db.query('DELETE FROM shots');
      await db.query('DELETE FROM game_events');
      await db.query('DELETE FROM games');
      await db.query('DELETE FROM players');
      await db.query('DELETE FROM teams');
      await db.query('DELETE FROM clubs');
    } catch (error) {
      global.testContext.logTestError(error, 'Database cleanup failed');
      throw error;
    }
  });

  afterAll(async () => {
    console.log('✅ Club Routes tests completed');
  });

  describe('📊 GET /api/clubs - Retrieving Clubs', () => {
    it('❌ should require authentication', async () => {
      const response = await request(app)
        .get('/api/clubs')
        .expect(401);

      expect(response.status).toBe(401);
    });

    it('✅ should return an empty array when no clubs exist', async () => {
      try {
        const response = await request(app)
          .get('/api/clubs')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toEqual([]);
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to get empty clubs array');
        throw error;
      }
    });

    it('✅ should return all clubs with correct structure', async () => {
      try {
        // Use unique club names to avoid conflicts
        const clubName1 = generateUniqueClubName('ClubAlpha');
        const clubName2 = generateUniqueClubName('ClubBeta');
        
        // Insert test clubs
        await db.query(
          'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
          [clubName1]
        );
        await db.query(
          'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
          [clubName2]
        );

        const response = await request(app)
          .get('/api/clubs')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveLength(2);
        expect(response.body[0].name).toBe(clubName1);
        expect(response.body[1].name).toBe(clubName2);
        
        // Verify club structure
        expect(response.body[0]).toHaveProperty('id');
        expect(response.body[0]).toHaveProperty('name');
        expect(response.body[0]).toHaveProperty('created_at');
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to retrieve clubs list');
        throw error;
      }
    });
  });

  describe('➕ POST /api/clubs - Creating Clubs', () => {
    it('❌ should deny create for viewer role', async () => {
      const uniqueClubName = generateUniqueClubName('DeniedClub');

      const response = await request(app)
        .post('/api/clubs')
        .set('Authorization', `Bearer ${viewerToken}`)
        .set('Content-Type', 'application/json')
        .send({ name: uniqueClubName })
        .expect(403);

      expect(response.status).toBe(403);
    });

    it('✅ should allow coach to create a new club', async () => {
      const uniqueClubName = generateUniqueClubName('CoachClub');

      const response = await request(app)
        .post('/api/clubs')
        .set('Authorization', `Bearer ${coachToken}`)
        .set('Content-Type', 'application/json')
        .send({ name: uniqueClubName })
        .expect(201);

      expect(response.body.name).toBe(uniqueClubName);
    });

    it('✅ should create a new club successfully', async () => {
      try {
        const uniqueClubName = generateUniqueClubName('NewClub');
        
        const response = await request(app)
          .post('/api/clubs')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Content-Type', 'application/json')
          .send({ name: uniqueClubName })
          .expect('Content-Type', /json/)
          .expect(201);

        expect(response.body.name).toBe(uniqueClubName);
        expect(response.body.id).toBeDefined();

        // Verify club was created in database
        const dbResponse = await db.query('SELECT * FROM clubs WHERE id = $1', [response.body.id]);
        expect(dbResponse.rows[0].name).toBe(uniqueClubName);
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to create club');
        throw error;
      }
    });

    it('❌ should require a club name', async () => {
      try {
        const response = await request(app)
          .post('/api/clubs')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Content-Type', 'application/json')
          .send({})
          .expect('Content-Type', /json/)
          .expect(400);

        expect(response.body.error).toBeDefined();
      } catch (error) {
        global.testContext.logTestError(error, 'Failed validation test for missing club name');
        throw error;
      }
    });

    it('❌ should prevent duplicate club names', async () => {
      try {
        const duplicateClubName = generateUniqueClubName('DuplicateClub');
        
        // Create first club
        await request(app)
          .post('/api/clubs')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Content-Type', 'application/json')
          .send({ name: duplicateClubName })
          .expect(201);

        // Try to create second club with same name
        const response = await request(app)
          .post('/api/clubs')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Content-Type', 'application/json')
          .send({ name: duplicateClubName })
          .expect(409);

        expect(response.body.error).toContain('already exists');
      } catch (error) {
        global.testContext.logTestError(error, 'Failed duplicate club name validation');
        throw error;
      }
    });
  });

  describe('📄 GET /api/clubs/:id - Club Details', () => {
    it('✅ should return club details', async () => {
      const clubName = generateUniqueClubName('DetailClub');
      const createRes = await request(app)
        .post('/api/clubs')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send({ name: clubName })
        .expect(201);

      const clubId = createRes.body.id;

      const response = await request(app)
        .get(`/api/clubs/${clubId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', clubId);
      expect(response.body).toHaveProperty('name', clubName);
    });

    it('❌ should return 404 for missing club', async () => {
      const response = await request(app)
        .get('/api/clubs/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.error).toContain('not found');
    });
  });

  describe('📋 GET /api/clubs/:id/teams - Get Club Teams', () => {
    it('❌ should return 404 for missing club', async () => {
      const response = await request(app)
        .get('/api/clubs/999999/teams')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.error).toContain('not found');
    });

    it('✅ should return all teams for a club', async () => {
      try {
        // Create a club
        const clubName = generateUniqueClubName('TestClub');
        const clubRes = await request(app)
          .post('/api/clubs')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: clubName })
          .expect(201);

        const clubId = clubRes.body.id;

        // Create teams for this club
        await db.query(
          'INSERT INTO teams (club_id, name, age_group, gender) VALUES ($1, $2, $3, $4)',
          [clubId, 'U17 Boys', 'U17', 'male']
        );
        await db.query(
          'INSERT INTO teams (club_id, name, age_group, gender) VALUES ($1, $2, $3, $4)',
          [clubId, 'U15 Girls', 'U15', 'female']
        );

        const response = await request(app)
          .get(`/api/clubs/${clubId}/teams`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveLength(2);
        expect(response.body[0]).toHaveProperty('name');
        expect(response.body[0]).toHaveProperty('age_group');
        expect(response.body[0]).toHaveProperty('gender');
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to get club teams');
        throw error;
      }
    });
  });

  describe('📋 GET /api/clubs/:id/players - Get Club Players', () => {
    it('❌ should return 404 for missing club', async () => {
      const response = await request(app)
        .get('/api/clubs/999999/players')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.error).toContain('not found');
    });

    it('✅ should return all players for a club', async () => {
      try {
        // Create a club
        const clubName = generateUniqueClubName('TestClub');
        const clubRes = await request(app)
          .post('/api/clubs')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: clubName })
          .expect(201);

        const clubId = clubRes.body.id;

        // Create players for this club
        await db.query(
          'INSERT INTO players (club_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4)',
          [clubId, 'John', 'Doe', 10]
        );
        await db.query(
          'INSERT INTO players (club_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4)',
          [clubId, 'Jane', 'Smith', 12]
        );

        const response = await request(app)
          .get(`/api/clubs/${clubId}/players`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveLength(2);
        expect(response.body[0]).toHaveProperty('first_name');
        expect(response.body[0]).toHaveProperty('last_name');
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to get club players');
        throw error;
      }
    });
  });

  describe('✏️ PUT /api/clubs/:id - Updating Clubs', () => {
    it('❌ should deny update for viewer role', async () => {
      const clubName = generateUniqueClubName('ViewUpdateClub');
      const createRes = await request(app)
        .post('/api/clubs')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send({ name: clubName })
        .expect(201);

      const response = await request(app)
        .put(`/api/clubs/${createRes.body.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .set('Content-Type', 'application/json')
        .send({ name: generateUniqueClubName('NewName') })
        .expect(403);

      expect(response.status).toBe(403);
    });

    it('✅ should update an existing club successfully', async () => {
      try {
        // Create a club first
        const oldName = generateUniqueClubName('OldClub');
        const newName = generateUniqueClubName('NewClub');
        
        const createRes = await request(app)
          .post('/api/clubs')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Content-Type', 'application/json')
          .send({ name: oldName })
          .expect(201);

        const clubId = createRes.body.id;

        // Update the club
        const response = await request(app)
          .put(`/api/clubs/${clubId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Content-Type', 'application/json')
          .send({ name: newName })
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body.name).toBe(newName);
        expect(response.body.id).toBe(clubId);

        // Verify update in database
        const dbResponse = await db.query('SELECT * FROM clubs WHERE id = $1', [clubId]);
        expect(dbResponse.rows[0].name).toBe(newName);
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to update club');
        throw error;
      }
    });

    it('❌ should return 404 for non-existent club', async () => {
      try {
        const response = await request(app)
          .put('/api/clubs/999')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Content-Type', 'application/json')
          .send({ name: 'New Name' })
          .expect('Content-Type', /json/)
          .expect(404);

        expect(response.body.error).toContain('not found');
      } catch (error) {
        global.testContext.logTestError(error, 'Failed 404 test for club update');
        throw error;
      }
    });
  });

  describe('🗑️ DELETE /api/clubs/:id - Deleting Clubs', () => {
    it('❌ should deny delete for viewer role', async () => {
      const clubName = generateUniqueClubName('ViewDeleteClub');
      const createRes = await request(app)
        .post('/api/clubs')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send({ name: clubName })
        .expect(201);

      const response = await request(app)
        .delete(`/api/clubs/${createRes.body.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);

      expect(response.status).toBe(403);
    });

    it('✅ should delete an existing club successfully', async () => {
      try {
        const clubName = generateUniqueClubName('DeleteClub');
        
        // Create a club first
        const createRes = await request(app)
          .post('/api/clubs')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Content-Type', 'application/json')
          .send({ name: clubName })
          .expect(201);

        const clubId = createRes.body.id;

        // Delete the club
        await request(app)
          .delete(`/api/clubs/${clubId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(204);

        // Verify club was deleted
        const dbResponse = await db.query('SELECT * FROM clubs WHERE id = $1', [clubId]);
        expect(dbResponse.rows).toHaveLength(0);
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to delete club');
        throw error;
      }
    });

    it('❌ should return 404 for non-existent club deletion', async () => {
      try {
        const response = await request(app)
          .delete('/api/clubs/999')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect('Content-Type', /json/)
          .expect(404);

        expect(response.body.error).toContain('not found');
      } catch (error) {
        global.testContext.logTestError(error, 'Failed 404 test for club deletion');
        throw error;
      }
    });

    it('❌ should prevent deletion of club with dependent teams', async () => {
      try {
        // Create a club
        const clubName = generateUniqueClubName('ClubWithTeams');
        const clubRes = await request(app)
          .post('/api/clubs')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: clubName })
          .expect(201);

        const clubId = clubRes.body.id;

        // Create a team for this club
        await db.query(
          'INSERT INTO teams (club_id, name, age_group) VALUES ($1, $2, $3)',
          [clubId, 'U17', 'U17']
        );

        // Try to delete club
        const response = await request(app)
          .delete(`/api/clubs/${clubId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(409);

        expect(response.body.error).toContain('teams');
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to prevent deletion of club with teams');
        throw error;
      }
    });
  });
});


