import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

describe('🏆 Competitions API', () => {
  let authToken;
  let coachToken;
  let userToken;
  let adminUser;
  let coachUser;
  let regularUser;
  let club1;
  let club2;
  let club3;
  let club4;
  let season;

  beforeAll(async () => {
    console.log('🔧 Setting up Competitions API tests...');
    try {
      const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Create test users
      const adminResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [`admin_comp_${uniqueId}`, `admin_comp_${uniqueId}@test.com`, 'hash', 'admin']
      );
      adminUser = adminResult.rows[0];
      authToken = jwt.sign({ id: adminUser.id, role: 'admin' }, process.env.JWT_SECRET);

      const coachResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [`coach_comp_${uniqueId}`, `coach_comp_${uniqueId}@test.com`, 'hash', 'coach']
      );
      coachUser = coachResult.rows[0];
      coachToken = jwt.sign({ id: coachUser.id, role: 'coach' }, process.env.JWT_SECRET);

      const userResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [`user_comp_${uniqueId}`, `user_comp_${uniqueId}@test.com`, 'hash', 'user']
      );
      regularUser = userResult.rows[0];
      userToken = jwt.sign({ id: regularUser.id, role: 'user' }, process.env.JWT_SECRET);

      // Create test season
      const seasonResult = await db.query(
        `INSERT INTO seasons (name, start_date, end_date, is_active) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [`Test Season ${uniqueId}`, '2024-01-01', '2024-12-31', true]
      );
      season = seasonResult.rows[0];

      // Create test teams
      const club1Result = await db.query(
        'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
        [`Competition Team 1 ${uniqueId}`]
      );
      club1 = club1Result.rows[0];

      const club2Result = await db.query(
        'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
        [`Competition Team 2 ${uniqueId}`]
      );
      club2 = club2Result.rows[0];

      const club3Result = await db.query(
        'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
        [`Competition Team 3 ${uniqueId}`]
      );
      club3 = club3Result.rows[0];

      const club4Result = await db.query(
        'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
        [`Competition Team 4 ${uniqueId}`]
      );
      club4 = club4Result.rows[0];

    } catch (error) {
      global.testContext.logTestError(error, 'Competitions API setup failed');
      throw error;
    }
  });

  afterAll(async () => {
    console.log('✅ Competitions API tests completed');
    try {
      // Clean up in correct order due to foreign key constraints
      await db.query('DELETE FROM tournament_brackets WHERE competition_id IN (SELECT id FROM competitions WHERE name LIKE $1)', ['%Competition%']);
      await db.query('DELETE FROM competition_standings WHERE competition_id IN (SELECT id FROM competitions WHERE name LIKE $1)', ['%Competition%']);
      await db.query('DELETE FROM competition_teams WHERE competition_id IN (SELECT id FROM competitions WHERE name LIKE $1)', ['%Competition%']);
      await db.query('DELETE FROM competitions WHERE name LIKE $1', ['%Competition%']);
      await db.query('DELETE FROM games WHERE home_club_id IN ($1, $2, $3, $4) OR away_club_id IN ($1, $2, $3, $4)', [club1.id, club2.id, club3.id, team4.id]);
      await db.query('DELETE FROM clubs WHERE id IN ($1, $2, $3, $4)', [club1.id, club2.id, club3.id, team4.id]);
      await db.query('DELETE FROM seasons WHERE id = $1', [season.id]);
      await db.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [adminUser.id, coachUser.id, regularUser.id]);
    } catch (error) {
      console.error('⚠️ Competitions API cleanup failed:', error.message);
    }
  });

  describe('📝 POST /api/competitions', () => {
    it('✅ should create a tournament competition', async () => {
      try {
        const response = await request(app)
          .post('/api/competitions')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Test Tournament Competition',
            competition_type: 'tournament',
            start_date: '2024-06-01',
            end_date: '2024-06-30',
            season_id: season.id,
            description: 'A test tournament'
          });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body.name).toBe('Test Tournament Competition');
        expect(response.body.competition_type).toBe('tournament');
        expect(response.body.status).toBe('upcoming');
      } catch (error) {
        global.testContext.logTestError(error, 'POST create tournament competition failed');
        throw error;
      }
    });

    it('✅ should create a league competition', async () => {
      try {
        const response = await request(app)
          .post('/api/competitions')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Test League Competition',
            competition_type: 'league',
            start_date: '2024-01-01',
            end_date: '2024-05-31'
          });

        expect(response.status).toBe(201);
        expect(response.body.competition_type).toBe('league');
      } catch (error) {
        global.testContext.logTestError(error, 'POST create league competition failed');
        throw error;
      }
    });

    it('✅ should allow coach to create competition', async () => {
      try {
        const response = await request(app)
          .post('/api/competitions')
          .set('Authorization', `Bearer ${coachToken}`)
          .send({
            name: 'Coach Competition',
            competition_type: 'tournament',
            start_date: '2024-07-01'
          });

        expect(response.status).toBe(201);
      } catch (error) {
        global.testContext.logTestError(error, 'POST create competition by coach failed');
        throw error;
      }
    });

    it('❌ should reject invalid competition type', async () => {
      try {
        const response = await request(app)
          .post('/api/competitions')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Invalid Type Competition',
            competition_type: 'invalid_type',
            start_date: '2024-06-01'
          });

        expect(response.status).toBe(400);
      } catch (error) {
        global.testContext.logTestError(error, 'POST invalid competition type rejection failed');
        throw error;
      }
    });

    it('❌ should reject creation by regular user', async () => {
      try {
        const response = await request(app)
          .post('/api/competitions')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            name: 'User Competition',
            competition_type: 'tournament',
            start_date: '2024-06-01'
          });

        expect(response.status).toBe(403);
      } catch (error) {
        global.testContext.logTestError(error, 'POST user authorization rejection failed');
        throw error;
      }
    });
  });

  describe('📊 GET /api/competitions', () => {
    let _testTournament;
    let _testLeague;

    beforeAll(async () => {
      // Create competitions for testing
      const tournamentResult = await db.query(
        `INSERT INTO competitions (name, competition_type, start_date, status) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        ['List Test Tournament', 'tournament', '2024-06-01', 'upcoming']
      );
      _testTournament = tournamentResult.rows[0];

      const leagueResult = await db.query(
        `INSERT INTO competitions (name, competition_type, start_date, status) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        ['List Test League', 'league', '2024-01-01', 'in_progress']
      );
      _testLeague = leagueResult.rows[0];
    });

    it('✅ should get all competitions', async () => {
      try {
        const response = await request(app)
          .get('/api/competitions')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(2);
      } catch (error) {
        global.testContext.logTestError(error, 'GET all competitions failed');
        throw error;
      }
    });

    it('✅ should filter competitions by type', async () => {
      try {
        const response = await request(app)
          .get('/api/competitions?type=tournament')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        response.body.forEach(comp => {
          expect(comp.competition_type).toBe('tournament');
        });
      } catch (error) {
        global.testContext.logTestError(error, 'GET competitions by type filter failed');
        throw error;
      }
    });

    it('✅ should filter competitions by status', async () => {
      try {
        const response = await request(app)
          .get('/api/competitions?status=in_progress')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        response.body.forEach(comp => {
          expect(comp.status).toBe('in_progress');
        });
      } catch (error) {
        global.testContext.logTestError(error, 'GET competitions by status filter failed');
        throw error;
      }
    });

    it('❌ should require authentication', async () => {
      try {
        const response = await request(app)
          .get('/api/competitions');

        expect(response.status).toBe(401);
      } catch (error) {
        global.testContext.logTestError(error, 'GET competitions auth requirement failed');
        throw error;
      }
    });
  });

  describe('👥 Competition Teams Management', () => {
    let testCompetition;

    beforeAll(async () => {
      const result = await db.query(
        `INSERT INTO competitions (name, competition_type, start_date) 
         VALUES ($1, $2, $3) RETURNING *`,
        ['Teams Test Competition', 'tournament', '2024-06-01']
      );
      testCompetition = result.rows[0];
    });

    it('✅ should add a team to competition', async () => {
      try {
        const response = await request(app)
          .post(`/api/competitions/${testCompetition.id}/teams`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            team_id: club1.id,
            seed: 1
          });

        expect(response.status).toBe(201);
        expect(response.body.team_id).toBe(club1.id);
        expect(response.body.seed).toBe(1);
        expect(response.body).toHaveProperty('club_name');
      } catch (error) {
        global.testContext.logTestError(error, 'POST add team to competition failed');
        throw error;
      }
    });

    it('✅ should add multiple teams with seeding', async () => {
      try {
        await request(app)
          .post(`/api/competitions/${testCompetition.id}/teams`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ team_id: club2.id, seed: 2 });

        await request(app)
          .post(`/api/competitions/${testCompetition.id}/teams`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ team_id: club3.id, seed: 3 });

        await request(app)
          .post(`/api/competitions/${testCompetition.id}/teams`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ team_id: team4.id, seed: 4 });

        const response = await request(app)
          .get(`/api/competitions/${testCompetition.id}/teams`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.length).toBe(4);
        expect(response.body[0].seed).toBe(1);
      } catch (error) {
        global.testContext.logTestError(error, 'POST add multiple teams failed');
        throw error;
      }
    });

    it('❌ should reject duplicate team in competition', async () => {
      try {
        const response = await request(app)
          .post(`/api/competitions/${testCompetition.id}/teams`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ team_id: club1.id });

        expect(response.status).toBe(409);
        expect(response.body.error).toContain('already');
      } catch (error) {
        global.testContext.logTestError(error, 'POST duplicate team rejection failed');
        throw error;
      }
    });

    it('✅ should get teams in competition', async () => {
      try {
        const response = await request(app)
          .get(`/api/competitions/${testCompetition.id}/teams`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(4);
      } catch (error) {
        global.testContext.logTestError(error, 'GET competition teams failed');
        throw error;
      }
    });

    it('✅ should remove team from competition', async () => {
      try {
        const response = await request(app)
          .delete(`/api/competitions/${testCompetition.id}/teams/${team4.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(204);

        // Re-add for other tests
        await request(app)
          .post(`/api/competitions/${testCompetition.id}/teams`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ team_id: team4.id, seed: 4 });
      } catch (error) {
        global.testContext.logTestError(error, 'DELETE team from competition failed');
        throw error;
      }
    });
  });

  describe('🏆 Tournament Brackets', () => {
    let bracketCompetition;

    beforeAll(async () => {
      const result = await db.query(
        `INSERT INTO competitions (name, competition_type, start_date) 
         VALUES ($1, $2, $3) RETURNING *`,
        ['Bracket Test Tournament', 'tournament', '2024-06-01']
      );
      bracketCompetition = result.rows[0];

      // Add 4 teams
      await db.query(
        'INSERT INTO competition_teams (competition_id, team_id, seed) VALUES ($1, $2, $3)',
        [bracketCompetition.id, club1.id, 1]
      );
      await db.query(
        'INSERT INTO competition_teams (competition_id, team_id, seed) VALUES ($1, $2, $3)',
        [bracketCompetition.id, club2.id, 2]
      );
      await db.query(
        'INSERT INTO competition_teams (competition_id, team_id, seed) VALUES ($1, $2, $3)',
        [bracketCompetition.id, club3.id, 3]
      );
      await db.query(
        'INSERT INTO competition_teams (competition_id, team_id, seed) VALUES ($1, $2, $3)',
        [bracketCompetition.id, team4.id, 4]
      );
    });

    it('✅ should generate tournament bracket', async () => {
      try {
        const response = await request(app)
          .post(`/api/competitions/${bracketCompetition.id}/bracket/generate`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json');

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('total_rounds');
        expect(response.body).toHaveProperty('total_matches');
        expect(response.body.total_rounds).toBe(2); // 4 teams = 2 rounds
        expect(response.body.total_matches).toBe(3); // 2 semis + 1 final
      } catch (error) {
        global.testContext.logTestError(error, 'POST generate bracket failed');
        throw error;
      }
    });

    it('✅ should get tournament bracket', async () => {
      try {
        const response = await request(app)
          .get(`/api/competitions/${bracketCompetition.id}/bracket`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('rounds');
        expect(response.body.rounds.length).toBe(2);
        expect(response.body.rounds[0].matches.length).toBe(2); // 2 semi-final matches
        expect(response.body.rounds[1].matches.length).toBe(1); // 1 final match
      } catch (error) {
        global.testContext.logTestError(error, 'GET tournament bracket failed');
        throw error;
      }
    });

    it('✅ should update bracket with winner', async () => {
      try {
        // Get bracket matches
        const bracketResult = await db.query(
          'SELECT id, home_club_id FROM tournament_brackets WHERE competition_id = $1 AND round_number = 1 ORDER BY match_number LIMIT 1',
          [bracketCompetition.id]
        );
        const bracketMatch = bracketResult.rows[0];

        const response = await request(app)
          .put(`/api/competitions/${bracketCompetition.id}/bracket/${bracketMatch.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            winner_club_id: bracketMatch.home_team_id
          });

        expect(response.status).toBe(200);
        expect(response.body.winner_club_id).toBe(bracketMatch.home_club_id);
        expect(response.body.status).toBe('completed');
      } catch (error) {
        global.testContext.logTestError(error, 'PUT update bracket winner failed');
        throw error;
      }
    });

    it('❌ should reject bracket generation for league', async () => {
      try {
        // Create a league
        const leagueResult = await db.query(
          `INSERT INTO competitions (name, competition_type, start_date) 
           VALUES ($1, $2, $3) RETURNING *`,
          ['League Bracket Test', 'league', '2024-01-01']
        );

        const response = await request(app)
          .post(`/api/competitions/${leagueResult.rows[0].id}/bracket/generate`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json');

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('tournament');
      } catch (error) {
        global.testContext.logTestError(error, 'POST bracket for league rejection failed');
        throw error;
      }
    });
  });

  describe('📊 Competition Standings', () => {
    let standingsCompetition;

    beforeAll(async () => {
      const result = await db.query(
        `INSERT INTO competitions (name, competition_type, start_date) 
         VALUES ($1, $2, $3) RETURNING *`,
        ['Standings Test League', 'league', '2024-01-01']
      );
      standingsCompetition = result.rows[0];

      // Add teams
      await db.query(
        'INSERT INTO competition_teams (competition_id, team_id) VALUES ($1, $2)',
        [standingsCompetition.id, club1.id]
      );
      await db.query(
        'INSERT INTO competition_teams (competition_id, team_id) VALUES ($1, $2)',
        [standingsCompetition.id, club2.id]
      );
    });

    it('✅ should initialize standings', async () => {
      try {
        const response = await request(app)
          .post(`/api/competitions/${standingsCompetition.id}/standings/initialize`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json');

        expect(response.status).toBe(201);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(2);
        expect(response.body[0].games_played).toBe(0);
        expect(response.body[0].points).toBe(0);
      } catch (error) {
        global.testContext.logTestError(error, 'POST initialize standings failed');
        throw error;
      }
    });

    it('✅ should get standings', async () => {
      try {
        const response = await request(app)
          .get(`/api/competitions/${standingsCompetition.id}/standings`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      } catch (error) {
        global.testContext.logTestError(error, 'GET standings failed');
        throw error;
      }
    });

    it('✅ should update standings after game', async () => {
      try {
        // Create a completed game
        const gameResult = await db.query(
          `INSERT INTO games (home_club_id, away_club_id, date, status, home_score, away_score) 
           VALUES ($1, $2, CURRENT_TIMESTAMP, 'completed', 3, 1) RETURNING *`,
          [club1.id, club2.id]
        );

        const response = await request(app)
          .post(`/api/competitions/${standingsCompetition.id}/standings/update`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ game_id: gameResult.rows[0].id });

        expect(response.status).toBe(200);
        
        const team1Standing = response.body.find(s => s.team_id === club1.id);
        const team2Standing = response.body.find(s => s.team_id === club2.id);
        
        expect(team1Standing.wins).toBe(1);
        expect(team1Standing.points).toBe(3);
        expect(team2Standing.losses).toBe(1);
        expect(team2Standing.points).toBe(0);
      } catch (error) {
        global.testContext.logTestError(error, 'POST update standings failed');
        throw error;
      }
    });
  });

  describe('✏️ PUT /api/competitions/:id', () => {
    let updateCompetition;

    beforeAll(async () => {
      const result = await db.query(
        `INSERT INTO competitions (name, competition_type, start_date, status) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        ['Update Test Competition', 'tournament', '2024-06-01', 'upcoming']
      );
      updateCompetition = result.rows[0];
    });

    it('✅ should update competition status', async () => {
      try {
        const response = await request(app)
          .put(`/api/competitions/${updateCompetition.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            status: 'in_progress'
          });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('in_progress');
      } catch (error) {
        global.testContext.logTestError(error, 'PUT update competition status failed');
        throw error;
      }
    });

    it('✅ should update competition name and description', async () => {
      try {
        const response = await request(app)
          .put(`/api/competitions/${updateCompetition.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Updated Competition Name',
            description: 'Updated description'
          });

        expect(response.status).toBe(200);
        expect(response.body.name).toBe('Updated Competition Name');
        expect(response.body.description).toBe('Updated description');
      } catch (error) {
        global.testContext.logTestError(error, 'PUT update competition name failed');
        throw error;
      }
    });

    it('❌ should reject invalid status', async () => {
      try {
        const response = await request(app)
          .put(`/api/competitions/${updateCompetition.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            status: 'invalid_status'
          });

        expect(response.status).toBe(400);
      } catch (error) {
        global.testContext.logTestError(error, 'PUT invalid status rejection failed');
        throw error;
      }
    });
  });

  describe('🗑️ DELETE /api/competitions/:id', () => {
    it('✅ should delete competition as admin', async () => {
      try {
        // Create a competition to delete
        const createResult = await db.query(
          `INSERT INTO competitions (name, competition_type, start_date) 
           VALUES ($1, $2, $3) RETURNING *`,
          ['Delete Test Competition', 'tournament', '2024-06-01']
        );

        const response = await request(app)
          .delete(`/api/competitions/${createResult.rows[0].id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(204);

        // Verify deletion
        const checkResult = await db.query(
          'SELECT id FROM competitions WHERE id = $1',
          [createResult.rows[0].id]
        );
        expect(checkResult.rows.length).toBe(0);
      } catch (error) {
        global.testContext.logTestError(error, 'DELETE competition failed');
        throw error;
      }
    });

    it('❌ should reject deletion by coach', async () => {
      try {
        const createResult = await db.query(
          `INSERT INTO competitions (name, competition_type, start_date) 
           VALUES ($1, $2, $3) RETURNING *`,
          ['Coach Delete Test Competition', 'tournament', '2024-06-01']
        );

        const response = await request(app)
          .delete(`/api/competitions/${createResult.rows[0].id}`)
          .set('Authorization', `Bearer ${coachToken}`);

        expect(response.status).toBe(403);
      } catch (error) {
        global.testContext.logTestError(error, 'DELETE by coach rejection failed');
        throw error;
      }
    });
  });
});


