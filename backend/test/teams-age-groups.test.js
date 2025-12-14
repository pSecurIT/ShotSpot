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

describe('👥 Age Group Team Routes', () => {
  let authToken;
  let testClubId;

  beforeAll(async () => {
    console.log('🔧 Setting up Age Group Team Routes tests...');
    // Generate test auth token
    authToken = generateTestToken('admin');
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

      // Create a test club for team tests
      const clubName = `TestClub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const clubResult = await db.query(
        'INSERT INTO clubs (name) VALUES ($1) RETURNING id',
        [clubName]
      );
      testClubId = clubResult.rows[0].id;
    } catch (error) {
      global.testContext.logTestError(error, 'Database cleanup failed');
      throw error;
    }
  });

  afterAll(async () => {
    console.log('✅ Age Group Team Routes tests completed');
  });

  describe('📊 GET /api/teams - Retrieving Teams', () => {
    it('✅ should return an empty array when no teams exist', async () => {
      try {
        const response = await request(app)
          .get('/api/teams')
          .set('Authorization', `Bearer ${authToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toEqual([]);
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to get empty teams array');
        throw error;
      }
    });

    it('✅ should return all teams with correct structure', async () => {
      try {
        // Create test teams for the club
        const teamName1 = generateUniqueTeamName('U17Boys');
        const teamName2 = generateUniqueTeamName('U15Girls');
        
        await db.query(
          'INSERT INTO teams (club_id, name, age_group, gender) VALUES ($1, $2, $3, $4)',
          [testClubId, teamName1, 'U17', 'male']
        );
        await db.query(
          'INSERT INTO teams (club_id, name, age_group, gender) VALUES ($1, $2, $3, $4)',
          [testClubId, teamName2, 'U15', 'female']
        );

        const response = await request(app)
          .get('/api/teams')
          .set('Authorization', `Bearer ${authToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveLength(2);
        
        // Verify team structure
        expect(response.body[0]).toHaveProperty('id');
        expect(response.body[0]).toHaveProperty('name');
        expect(response.body[0]).toHaveProperty('club_id');
        expect(response.body[0]).toHaveProperty('age_group');
        expect(response.body[0]).toHaveProperty('gender');
        expect(response.body[0]).toHaveProperty('club_name');
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to retrieve teams list');
        throw error;
      }
    });
  });

  describe('➕ POST /api/teams - Creating Teams', () => {
    it('✅ should create a new team successfully with all fields', async () => {
      try {
        const uniqueTeamName = generateUniqueTeamName('U19Boys');
        
        const response = await request(app)
          .post('/api/teams')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send({ 
            club_id: testClubId,
            name: uniqueTeamName,
            age_group: 'U19',
            gender: 'male'
          })
          .expect('Content-Type', /json/)
          .expect(201);

        expect(response.body.name).toBe(uniqueTeamName);
        expect(response.body.club_id).toBe(testClubId);
        expect(response.body.age_group).toBe('U19');
        expect(response.body.gender).toBe('male');
        expect(response.body.id).toBeDefined();

        // Verify team was created in database
        const dbResponse = await db.query('SELECT * FROM teams WHERE id = $1', [response.body.id]);
        expect(dbResponse.rows[0].name).toBe(uniqueTeamName);
        expect(dbResponse.rows[0].club_id).toBe(testClubId);
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to create team');
        throw error;
      }
    });

    it('❌ should require a club_id', async () => {
      try {
        const response = await request(app)
          .post('/api/teams')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send({ name: 'U17 Boys', age_group: 'U17' })
          .expect('Content-Type', /json/)
          .expect(400);

        expect(response.body.error).toBeDefined();
      } catch (error) {
        global.testContext.logTestError(error, 'Failed validation test for missing club_id');
        throw error;
      }
    });

    it('❌ should require a team name', async () => {
      try {
        const response = await request(app)
          .post('/api/teams')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send({ club_id: testClubId, age_group: 'U17' })
          .expect('Content-Type', /json/)
          .expect(400);

        expect(response.body.error).toBeDefined();
      } catch (error) {
        global.testContext.logTestError(error, 'Failed validation test for missing team name');
        throw error;
      }
    });

    it('❌ should reject invalid club_id', async () => {
      try {
        const response = await request(app)
          .post('/api/teams')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send({ 
            club_id: 99999,
            name: 'Test Team',
            age_group: 'U17'
          })
          .expect('Content-Type', /json/)
          .expect(404);

        expect(response.body.error).toContain('Club');
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to reject invalid club_id');
        throw error;
      }
    });
  });

  describe('📋 GET /api/teams/:id/players - Get Team Players', () => {
    it('✅ should return all players for a team', async () => {
      try {
        // Create a team
        const teamName = generateUniqueTeamName('U17Boys');
        const teamRes = await db.query(
          'INSERT INTO teams (club_id, name, age_group) VALUES ($1, $2, $3) RETURNING id',
          [testClubId, teamName, 'U17']
        );
        const teamId = teamRes.rows[0].id;

        // Create players for this team
        await db.query(
          'INSERT INTO players (club_id, team_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4, $5)',
          [testClubId, teamId, 'John', 'Doe', 10]
        );
        await db.query(
          'INSERT INTO players (club_id, team_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4, $5)',
          [testClubId, teamId, 'Jane', 'Smith', 12]
        );

        const response = await request(app)
          .get(`/api/teams/${teamId}/players`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveLength(2);
        expect(response.body[0]).toHaveProperty('first_name');
        expect(response.body[0]).toHaveProperty('last_name');
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to get team players');
        throw error;
      }
    });
  });

  describe('✏️ PUT /api/teams/:id - Updating Teams', () => {
    it('✅ should update an existing team successfully', async () => {
      try {
        // Create a team first
        const oldName = generateUniqueTeamName('OldU17');
        const newName = generateUniqueTeamName('NewU17');
        
        const teamRes = await db.query(
          'INSERT INTO teams (club_id, name, age_group) VALUES ($1, $2, $3) RETURNING id',
          [testClubId, oldName, 'U17']
        );
        const teamId = teamRes.rows[0].id;

        // Update the team
        const response = await request(app)
          .put(`/api/teams/${teamId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send({ name: newName, age_group: 'U19', gender: 'male' })
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body.name).toBe(newName);
        expect(response.body.age_group).toBe('U19');
        expect(response.body.id).toBe(teamId);

        // Verify update in database
        const dbResponse = await db.query('SELECT * FROM teams WHERE id = $1', [teamId]);
        expect(dbResponse.rows[0].name).toBe(newName);
        expect(dbResponse.rows[0].age_group).toBe('U19');
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to update team');
        throw error;
      }
    });

    it('❌ should return 404 for non-existent team', async () => {
      try {
        const response = await request(app)
          .put('/api/teams/999')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send({ name: 'New Name' })
          .expect('Content-Type', /json/)
          .expect(404);

        expect(response.body.error).toContain('not found');
      } catch (error) {
        global.testContext.logTestError(error, 'Failed 404 test for team update');
        throw error;
      }
    });
  });

  describe('🗑️ DELETE /api/teams/:id - Deleting Teams', () => {
    it('✅ should delete an existing team successfully', async () => {
      try {
        const teamName = generateUniqueTeamName('DeleteTeam');
        
        // Create a team first
        const teamRes = await db.query(
          'INSERT INTO teams (club_id, name, age_group) VALUES ($1, $2, $3) RETURNING id',
          [testClubId, teamName, 'U17']
        );
        const teamId = teamRes.rows[0].id;

        // Delete the team
        await request(app)
          .delete(`/api/teams/${teamId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(204);

        // Verify team was deleted
        const dbResponse = await db.query('SELECT * FROM teams WHERE id = $1', [teamId]);
        expect(dbResponse.rows).toHaveLength(0);
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to delete team');
        throw error;
      }
    });

    it('❌ should return 404 for non-existent team deletion', async () => {
      try {
        const response = await request(app)
          .delete('/api/teams/999')
          .set('Authorization', `Bearer ${authToken}`)
          .expect('Content-Type', /json/)
          .expect(404);

        expect(response.body.error).toContain('not found');
      } catch (error) {
        global.testContext.logTestError(error, 'Failed 404 test for team deletion');
        throw error;
      }
    });

    it('❌ should prevent deletion of team with players', async () => {
      try {
        // Create a team
        const teamName = generateUniqueTeamName('TeamWithPlayers');
        const teamRes = await db.query(
          'INSERT INTO teams (club_id, name, age_group) VALUES ($1, $2, $3) RETURNING id',
          [testClubId, teamName, 'U17']
        );
        const teamId = teamRes.rows[0].id;

        // Create a player for this team
        await db.query(
          'INSERT INTO players (club_id, team_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4, $5)',
          [testClubId, teamId, 'John', 'Doe', 10]
        );

        // Try to delete team
        const response = await request(app)
          .delete(`/api/teams/${teamId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(409);

        expect(response.body.error).toBe('Cannot delete team');
        expect(response.body.details).toContain('players');
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to prevent deletion of team with players');
        throw error;
      }
    });
  });
});


