import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

describe('📊 Club Analytics API', () => {
  let authToken;
  let adminUser;
  let club1;
  let club2;
  let club3;
  let _team1;
  let _team2;
  let game1;
  let game2;
  let game3;
  let player1;

  beforeAll(async () => {
    console.log('🔧 Setting up Club Analytics API tests...');
    try {
      const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Create test user
      const adminResult = await db.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [`admin_analytics_${uniqueId}`, `admin_analytics_${uniqueId}@test.com`, 'hash', 'admin']
      );
      adminUser = adminResult.rows[0];
      authToken = jwt.sign({ userId: adminUser.id, role: 'admin' }, process.env.JWT_SECRET);

      // Create test clubs
      const club1Result = await db.query(
        'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
        [`Analytics Club 1 ${uniqueId}`]
      );
      club1 = club1Result.rows[0];

      const club2Result = await db.query(
        'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
        [`Analytics Club 2 ${uniqueId}`]
      );
      club2 = club2Result.rows[0];

      // Create test club3
      const club3Result = await db.query(
        'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
        [`Analytics Club 3 ${uniqueId}`]
      );
      club3 = club3Result.rows[0];

      // Create test teams
      const team1Result = await db.query(
        'INSERT INTO teams (name, club_id) VALUES ($1, $2) RETURNING *',
        [`Analytics Team 1 ${uniqueId}`, club1.id]
      );
      _team1 = team1Result.rows[0];

      const team2Result = await db.query(
        'INSERT INTO teams (name, club_id) VALUES ($1, $2) RETURNING *',
        [`Analytics Team 2 ${uniqueId}`, club2.id]
      );
      _team2 = team2Result.rows[0];

      // Create test games
      const game1Result = await db.query(
        'INSERT INTO games (home_club_id, away_club_id, home_score, away_score, date, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [club1.id, club2.id, 10, 8, new Date(), 'completed']
      );
      game1 = game1Result.rows[0];

      const game2Result = await db.query(
        'INSERT INTO games (home_club_id, away_club_id, home_score, away_score, date, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [club2.id, club1.id, 12, 14, new Date(), 'completed']
      );
      game2 = game2Result.rows[0];

      const game3Result = await db.query(
        'INSERT INTO games (home_club_id, away_club_id, home_score, away_score, date, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [club1.id, club3.id, 9, 9, new Date(), 'completed']
      );
      game3 = game3Result.rows[0];

      // Create a test player first
      const player1Result = await db.query(
        'INSERT INTO players (club_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4) RETURNING *',
        [club1.id, 'Test', 'Player', 1]
      );
      player1 = player1Result.rows[0];

      // Create shots for statistics
      await db.query(
        `INSERT INTO shots (game_id, player_id, club_id, x_coord, y_coord, result, period, distance) 
         VALUES ($1, $2, $3, 50, 50, 'goal', 1, 5.0)`,
        [game1.id, player1.id, club1.id]
      );
      await db.query(
        `INSERT INTO shots (game_id, player_id, club_id, x_coord, y_coord, result, period, distance) 
         VALUES ($1, $2, $3, 55, 45, 'miss', 1, 6.0)`,
        [game1.id, player1.id, club1.id]
      );

      // Debug logs to verify test data creation
      console.log('club1:', club1);
      console.log('club2:', club2);
      console.log('club3:', club3);
      console.log('game1:', game1);
      console.log('player1:', player1);

    } catch (error) {
      global.testContext.logTestError(error, 'Club Analytics API setup failed');
      throw error;
    }
  });

  afterAll(async () => {
    console.log('✅ Club Analytics API tests completed');
    try {
      await db.query('DELETE FROM team_rankings WHERE team_id IN ($1, $2, $3)', [club1.id, club2.id, club3.id]);
      await db.query('DELETE FROM head_to_head WHERE team1_id = $1 OR team2_id = $1 OR team1_id = $2 OR team2_id = $2', [club1.id, club2.id]);
      await db.query('DELETE FROM shots WHERE game_id IN ($1, $2, $3)', [game1.id, game2.id, game3.id]);
      await db.query('DELETE FROM games WHERE id IN ($1, $2, $3)', [game1.id, game2.id, game3.id]);
      await db.query('DELETE FROM players WHERE id = $1', [player1.id]);
      await db.query('DELETE FROM clubs WHERE id IN ($1, $2, $3)', [club1.id, club2.id, club3.id]);
      await db.query('DELETE FROM users WHERE id = $1', [adminUser.id]);
    } catch (error) {
      console.error('⚠️ Club Analytics API cleanup failed:', error.message);
    }
  });

  describe('🤝 HEAD-TO-HEAD /api/team-analytics/head-to-head', () => {
    it('✅ should get head-to-head record between two teams', async () => {
      try {
        const response = await request(app)
          .get(`/api/team-analytics/head-to-head/${club1.id}/${club2.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('team1');
        expect(response.body).toHaveProperty('team2');
        expect(response.body).toHaveProperty('total_games');
        expect(response.body).toHaveProperty('draws');
        expect(response.body).toHaveProperty('recent_games');
        
        expect(response.body.total_games).toBe(2);
        expect(response.body.draws).toBe(0);
        expect(response.body.team1.wins + response.body.team2.wins + response.body.draws).toBe(2);
      } catch (error) {
        global.testContext.logTestError(error, 'GET head-to-head failed');
        throw error;
      }
    });

    it('✅ should return streak information', async () => {
      try {
        const response = await request(app)
          .get(`/api/team-analytics/head-to-head/${club1.id}/${club2.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        if (response.body.current_streak) {
          expect(response.body.current_streak).toHaveProperty('team_id');
          expect(response.body.current_streak).toHaveProperty('team_name');
          expect(response.body.current_streak).toHaveProperty('count');
        }
      } catch (error) {
        global.testContext.logTestError(error, 'GET head-to-head streak failed');
        throw error;
      }
    });

    it('✅ should return recent games', async () => {
      try {
        const response = await request(app)
          .get(`/api/team-analytics/head-to-head/${club1.id}/${club2.id}?limit=5`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.recent_games)).toBe(true);
        expect(response.body.recent_games.length).toBeLessThanOrEqual(5);
        
        if (response.body.recent_games.length > 0) {
          const game = response.body.recent_games[0];
          expect(game).toHaveProperty('id');
          expect(game).toHaveProperty('date');
          expect(game).toHaveProperty('home_score');
          expect(game).toHaveProperty('away_score');
        }
      } catch (error) {
        global.testContext.logTestError(error, 'GET head-to-head recent games failed');
        throw error;
      }
    });

    it('✅ should handle teams with no games between them', async () => {
      try {
        const response = await request(app)
          .get(`/api/team-analytics/head-to-head/${club2.id}/${club3.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.total_games).toBe(0);
        expect(response.body.recent_games.length).toBe(0);
      } catch (error) {
        global.testContext.logTestError(error, 'GET head-to-head no games failed');
        throw error;
      }
    });

    it('❌ should return 404 for non-existent team', async () => {
      try {
        const response = await request(app)
          .get(`/api/team-analytics/head-to-head/${club1.id}/99999`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(404);
      } catch (error) {
        global.testContext.logTestError(error, 'GET head-to-head 404 failed');
        throw error;
      }
    });

    it('❌ should require authentication', async () => {
      try {
        const response = await request(app)
          .get(`/api/team-analytics/head-to-head/${club1.id}/${club2.id}`);

        expect(response.status).toBe(401);
      } catch (error) {
        global.testContext.logTestError(error, 'GET head-to-head auth failed');
        throw error;
      }
    });
  });

  describe('🏅 RANKINGS /api/team-analytics/rankings', () => {
    it('✅ should get team rankings', async () => {
      try {
        const response = await request(app)
          .get('/api/team-analytics/rankings')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      } catch (error) {
        global.testContext.logTestError(error, 'GET rankings failed');
        throw error;
      }
    });

    it('✅ should get ranking for specific team', async () => {
      try {
        const response = await request(app)
          .get(`/api/team-analytics/rankings/team/${club1.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('club_id');
        expect(response.body).toHaveProperty('club_name');
        expect(response.body).toHaveProperty('games_played');
        expect(response.body).toHaveProperty('wins');
        expect(response.body).toHaveProperty('losses');
        expect(response.body).toHaveProperty('draws');
        expect(response.body).toHaveProperty('rating');
        
        expect(response.body.club_id).toBe(club1.id);
        expect(response.body.team_id).toBe(club1.id);
      } catch (error) {
        global.testContext.logTestError(error, 'GET team ranking failed');
        throw error;
      }
    });

    it('✅ should include calculated statistics', async () => {
      try {
        const response = await request(app)
          .get(`/api/team-analytics/rankings/team/${club1.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('points');
        expect(response.body).toHaveProperty('goals_for');
        expect(response.body).toHaveProperty('goals_against');
        expect(response.body).toHaveProperty('goal_difference');
        expect(response.body).toHaveProperty('avg_goals_per_game');
        expect(response.body).toHaveProperty('current_streak');
      } catch (error) {
        global.testContext.logTestError(error, 'GET ranking statistics failed');
        throw error;
      }
    });

    it('✅ should recalculate rankings', async () => {
      try {
        const response = await request(app)
          .post('/api/team-analytics/rankings/recalculate')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('rankings');
        expect(Array.isArray(response.body.rankings)).toBe(true);
      } catch (error) {
        global.testContext.logTestError(error, 'POST recalculate rankings failed');
        throw error;
      }
    });

    it('❌ should return 404 for non-existent team', async () => {
      try {
        const response = await request(app)
          .get('/api/team-analytics/rankings/team/99999')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(404);
      } catch (error) {
        global.testContext.logTestError(error, 'GET ranking 404 failed');
        throw error;
      }
    });
  });

  describe('📈 TEAM COMPARISON /api/team-analytics/compare', () => {
    it('✅ should compare multiple teams', async () => {
      try {
        const response = await request(app)
          .get(`/api/team-analytics/compare?team_ids=${club1.id},${club2.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('teams');
        expect(response.body).toHaveProperty('comparison_metrics');
        expect(response.body.teams.length).toBe(2);
      } catch (error) {
        global.testContext.logTestError(error, 'GET compare teams failed');
        throw error;
      }
    });

    it('✅ should include comprehensive metrics', async () => {
      try {
        const response = await request(app)
          .get(`/api/team-analytics/compare?team_ids=${club1.id},${club2.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        
        const team = response.body.teams[0];
        expect(team).toHaveProperty('club_id');
        expect(team).toHaveProperty('club_name');
        expect(team).toHaveProperty('games_played');
        expect(team).toHaveProperty('wins');
        expect(team).toHaveProperty('losses');
        expect(team).toHaveProperty('draws');
        expect(team).toHaveProperty('win_percentage');
        expect(team).toHaveProperty('goals_for');
        expect(team).toHaveProperty('goals_against');
        expect(team).toHaveProperty('shooting_percentage');
      } catch (error) {
        global.testContext.logTestError(error, 'GET comparison metrics failed');
        throw error;
      }
    });

    it('✅ should compare three or more teams', async () => {
      try {
        const response = await request(app)
          .get(`/api/team-analytics/compare?team_ids=${club1.id},${club2.id},${club3.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.teams.length).toBe(3);
      } catch (error) {
        global.testContext.logTestError(error, 'GET compare three teams failed');
        throw error;
      }
    });

    it('❌ should reject comparison with less than 2 teams', async () => {
      try {
        const response = await request(app)
          .get(`/api/team-analytics/compare?team_ids=${club1.id}`)
          .set('Authorization', `Bearer ${authToken}`);
        expect(response.status).toBe(400);
      } catch (error) {
        global.testContext.logTestError(error, 'GET compare single team rejection failed');
        throw error;
      }
    });

    it('❌ should reject missing team_ids parameter', async () => {
      try {
        const response = await request(app)
          .get('/api/team-analytics/compare')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(400);
      } catch (error) {
        global.testContext.logTestError(error, 'GET compare missing params rejection failed');
        throw error;
      }
    });

    it('❌ should return 404 for non-existent teams', async () => {
      try {
        const response = await request(app)
          .get(`/api/team-analytics/compare?team_ids=${club1.id},99999`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(404);
      } catch (error) {
        global.testContext.logTestError(error, 'GET compare 404 failed');
        throw error;
      }
    });
  });
});


