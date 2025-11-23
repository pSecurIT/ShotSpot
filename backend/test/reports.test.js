import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import { generateTestToken } from './helpers/testHelpers.js';

describe('📄 Reports Routes', () => {
  let coachToken;
  let templateId;
  let gameId;
  let teamId;

  beforeAll(async () => {
    console.log('🔧 Setting up Reports tests...');
    coachToken = generateTestToken('coach');
    
    // Ensure test user exists
    try {
      await db.query(`
        INSERT INTO users (id, username, email, password_hash, role)
        VALUES (1, 'testuser', 'testuser@test.com', '$2b$10$test', 'coach')
        ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username
      `);
    } catch (error) {
      console.log('Test user setup:', error.message);
    }
  });

  beforeEach(async () => {
    try {
      // Clear test data
      await db.query('DELETE FROM report_exports');
      
      // Setup test data
      const template = await db.query('SELECT id FROM report_templates WHERE is_default = true LIMIT 1');
      templateId = template.rows[0]?.id;
      
      const team1 = await db.query('INSERT INTO teams (name) VALUES ($1) RETURNING id', ['Home Team']);
      const team2 = await db.query('INSERT INTO teams (name) VALUES ($1) RETURNING id', ['Away Team']);
      teamId = team1.rows[0].id;
      
      const game = await db.query(`
        INSERT INTO games (home_team_id, away_team_id, date, status)
        VALUES ($1, $2, NOW(), 'completed')
        RETURNING id
      `, [team1.rows[0].id, team2.rows[0].id]);
      gameId = game.rows[0].id;
    } catch (error) {
      global.testContext.logTestError(error, 'Database setup failed');
      throw error;
    }
  });

  afterEach(async () => {
    try {
      await db.query('DELETE FROM games WHERE id = $1', [gameId]);
      await db.query('DELETE FROM teams');
    } catch (error) {
      global.testContext.logTestError(error, 'Database cleanup failed');
    }
  });

  afterAll(async () => {
    console.log('✅ Reports tests completed');
  });

  describe('📋 GET /api/reports', () => {
    it('✅ should return empty array when no reports exist', async () => {
      try {
        const response = await request(app)
          .get('/api/reports')
          .set('Authorization', `Bearer ${coachToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to get empty reports');
        throw error;
      }
    });

    it('❌ should require authentication', async () => {
      try {
        await request(app)
          .get('/api/reports')
          .expect(401);
      } catch (error) {
        global.testContext.logTestError(error, 'Authentication check failed');
        throw error;
      }
    });
  });

  describe('🆕 POST /api/reports/generate', () => {
    it('✅ should generate a game report', async () => {
      try {
        const reportData = {
          template_id: templateId,
          report_type: 'game',
          format: 'json',
          game_id: gameId,
          report_name: 'Test Game Report'
        };

        const response = await request(app)
          .post('/api/reports/generate')
          .set('Authorization', `Bearer ${coachToken}`)
          .send(reportData)
          .expect('Content-Type', /json/)
          .expect(201);

        expect(response.body).toHaveProperty('report');
        expect(response.body).toHaveProperty('data');
        expect(response.body.report.report_name).toBe(reportData.report_name);
        expect(response.body.report.report_type).toBe('game');
        expect(response.body.report.format).toBe('json');
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to generate game report');
        throw error;
      }
    });

    it('✅ should generate a team report', async () => {
      try {
        const reportData = {
          template_id: templateId,
          report_type: 'team',
          format: 'json',
          team_id: teamId,
          report_name: 'Test Team Report'
        };

        const response = await request(app)
          .post('/api/reports/generate')
          .set('Authorization', `Bearer ${coachToken}`)
          .send(reportData)
          .expect('Content-Type', /json/)
          .expect(201);

        expect(response.body.report.report_type).toBe('team');
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to generate team report');
        throw error;
      }
    });

    it('❌ should validate required fields', async () => {
      try {
        await request(app)
          .post('/api/reports/generate')
          .set('Authorization', `Bearer ${coachToken}`)
          .send({
            template_id: templateId,
            report_type: 'game'
            // Missing format and report_name
          })
          .expect(400);
      } catch (error) {
        global.testContext.logTestError(error, 'Validation check failed');
        throw error;
      }
    });

    it('❌ should reject invalid template_id', async () => {
      try {
        await request(app)
          .post('/api/reports/generate')
          .set('Authorization', `Bearer ${coachToken}`)
          .send({
            template_id: 99999,
            report_type: 'game',
            format: 'json',
            game_id: gameId,
            report_name: 'Test'
          })
          .expect(404);
      } catch (error) {
        global.testContext.logTestError(error, 'Template validation failed');
        throw error;
      }
    });

    it('❌ should require coach or admin role', async () => {
      try {
        const viewerToken = generateTestToken('viewer');
        
        await request(app)
          .post('/api/reports/generate')
          .set('Authorization', `Bearer ${viewerToken}`)
          .send({
            template_id: templateId,
            report_type: 'game',
            format: 'json',
            game_id: gameId,
            report_name: 'Test'
          })
          .expect(403);
      } catch (error) {
        global.testContext.logTestError(error, 'Role check failed');
        throw error;
      }
    });
  });

  describe('🔍 GET /api/reports/:id', () => {
    let reportId;

    beforeEach(async () => {
      // Use the test user that was created in beforeAll (ID 1)
      const userId = 1;
      
      const result = await db.query(`
        INSERT INTO report_exports (
          template_id, generated_by, report_name, report_type, format, game_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [templateId, userId, 'Test Report', 'game', 'json', gameId]);
      reportId = result.rows[0].id;
    });

    it('✅ should return report details', async () => {
      try {
        const response = await request(app)
          .get(`/api/reports/${reportId}`)
          .set('Authorization', `Bearer ${coachToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('id');
        expect(response.body.id).toBe(reportId);
        expect(response.body.report_name).toBe('Test Report');
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to get report details');
        throw error;
      }
    });

    it('❌ should return 404 for non-existent report', async () => {
      try {
        await request(app)
          .get('/api/reports/99999')
          .set('Authorization', `Bearer ${coachToken}`)
          .expect(404);
      } catch (error) {
        global.testContext.logTestError(error, '404 check failed');
        throw error;
      }
    });
  });

  describe('🗑️ DELETE /api/reports/:id', () => {
    let reportId;

    beforeEach(async () => {
      // Use the test user that was created in beforeAll (ID 1)
      const userId = 1;
      
      const result = await db.query(`
        INSERT INTO report_exports (
          template_id, generated_by, report_name, report_type, format
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [templateId, userId, 'Deletable Report', 'season', 'pdf']);
      reportId = result.rows[0].id;
    });

    it('✅ should delete report', async () => {
      try {
        await request(app)
          .delete(`/api/reports/${reportId}`)
          .set('Authorization', `Bearer ${coachToken}`)
          .expect(200);

        // Verify deletion
        const check = await db.query('SELECT id FROM report_exports WHERE id = $1', [reportId]);
        expect(check.rows.length).toBe(0);
      } catch (error) {
        global.testContext.logTestError(error, 'Failed to delete report');
        throw error;
      }
import jwt from 'jsonwebtoken';

describe('📊 Reports Routes', () => {
  let authToken;
  let userToken;
  let adminUserId;
  let regularUserId;
  let team1;
  let team2;
  let player1;
  let player2;
  let game1;
  let game2;
  let season1;

  beforeAll(async () => {
    console.log('🔧 Setting up Reports Routes tests...');
    
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Create test users
    const adminResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [`admin_reports_${uniqueId}`, `admin_reports_${uniqueId}@test.com`, 'hash', 'admin']
    );
    adminUserId = adminResult.rows[0].id;
    authToken = jwt.sign({ id: adminUserId, role: 'admin' }, process.env.JWT_SECRET);

    const userResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [`user_reports_${uniqueId}`, `user_reports_${uniqueId}@test.com`, 'hash', 'user']
    );
    regularUserId = userResult.rows[0].id;
    userToken = jwt.sign({ id: regularUserId, role: 'user' }, process.env.JWT_SECRET);

    // Create test teams
    const team1Result = await db.query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING *',
      [`Reports Team 1 ${uniqueId}`]
    );
    team1 = team1Result.rows[0];

    const team2Result = await db.query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING *',
      [`Reports Team 2 ${uniqueId}`]
    );
    team2 = team2Result.rows[0];

    // Create test players
    const player1Result = await db.query(
      `INSERT INTO players (team_id, first_name, last_name, jersey_number) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [team1.id, 'John', `ReportsPlayer${uniqueId}`, 10]
    );
    player1 = player1Result.rows[0];

    const player2Result = await db.query(
      `INSERT INTO players (team_id, first_name, last_name, jersey_number) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [team2.id, 'Jane', `ReportsPlayer${uniqueId}`, 20]
    );
    player2 = player2Result.rows[0];

    // Create a test season
    const seasonResult = await db.query(
      `INSERT INTO seasons (name, start_date, end_date, season_type, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [`Test Season ${uniqueId}`, '2024-01-01', '2024-12-31', 'indoor', true]
    );
    season1 = seasonResult.rows[0];

    // Create games for reports
    const game1Result = await db.query(
      `INSERT INTO games (home_team_id, away_team_id, date, status, home_score, away_score, season_id)
       VALUES ($1, $2, '2024-06-01', 'completed', 15, 10, $3) RETURNING *`,
      [team1.id, team2.id, season1.id]
    );
    game1 = game1Result.rows[0];

    const game2Result = await db.query(
      `INSERT INTO games (home_team_id, away_team_id, date, status, home_score, away_score, season_id)
       VALUES ($1, $2, '2024-06-15', 'completed', 12, 18, $3) RETURNING *`,
      [team2.id, team1.id, season1.id]
    );
    game2 = game2Result.rows[0];

    // Create game rosters
    await db.query(
      'INSERT INTO game_rosters (game_id, team_id, player_id, is_starting) VALUES ($1, $2, $3, $4)',
      [game1.id, team1.id, player1.id, true]
    );
    await db.query(
      'INSERT INTO game_rosters (game_id, team_id, player_id, is_starting) VALUES ($1, $2, $3, $4)',
      [game1.id, team2.id, player2.id, true]
    );
    await db.query(
      'INSERT INTO game_rosters (game_id, team_id, player_id, is_starting) VALUES ($1, $2, $3, $4)',
      [game2.id, team1.id, player1.id, true]
    );
    await db.query(
      'INSERT INTO game_rosters (game_id, team_id, player_id, is_starting) VALUES ($1, $2, $3, $4)',
      [game2.id, team2.id, player2.id, true]
    );

    // Create diverse shot data
    const shotData = [
      // Game 1 - Team 1 (player 1)
      { x: 10, y: 50, result: 'goal', player_id: player1.id, team_id: team1.id, game_id: game1.id, distance: 5.5 },
      { x: 15, y: 45, result: 'goal', player_id: player1.id, team_id: team1.id, game_id: game1.id, distance: 6.0 },
      { x: 20, y: 55, result: 'miss', player_id: player1.id, team_id: team1.id, game_id: game1.id, distance: 7.0 },
      { x: 40, y: 50, result: 'goal', player_id: player1.id, team_id: team1.id, game_id: game1.id, distance: 4.0 },
      
      // Game 1 - Team 2 (player 2)
      { x: 30, y: 40, result: 'goal', player_id: player2.id, team_id: team2.id, game_id: game1.id, distance: 5.0 },
      { x: 45, y: 60, result: 'miss', player_id: player2.id, team_id: team2.id, game_id: game1.id, distance: 4.0 },
      
      // Game 2 - Team 1 (player 1)
      { x: 50, y: 50, result: 'goal', player_id: player1.id, team_id: team1.id, game_id: game2.id, distance: 3.5 },
      { x: 60, y: 50, result: 'miss', player_id: player1.id, team_id: team1.id, game_id: game2.id, distance: 4.5 },
      { x: 70, y: 50, result: 'goal', player_id: player1.id, team_id: team1.id, game_id: game2.id, distance: 6.5 },
      
      // Game 2 - Team 2 (player 2)
      { x: 55, y: 55, result: 'goal', player_id: player2.id, team_id: team2.id, game_id: game2.id, distance: 5.5 },
      { x: 65, y: 45, result: 'goal', player_id: player2.id, team_id: team2.id, game_id: game2.id, distance: 6.0 },
      { x: 75, y: 50, result: 'goal', player_id: player2.id, team_id: team2.id, game_id: game2.id, distance: 5.0 }
    ];

    for (const shot of shotData) {
      await db.query(
        `INSERT INTO shots (game_id, player_id, team_id, x_coord, y_coord, result, period, distance)
         VALUES ($1, $2, $3, $4, $5, $6, 1, $7)`,
        [shot.game_id, shot.player_id, shot.team_id, shot.x, shot.y, shot.result, shot.distance]
      );
    }

    console.log('✅ Reports Routes test setup complete');
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up Reports Routes tests...');
    
    // Clean up in reverse order of dependencies
    if (player1) await db.query('DELETE FROM players WHERE id = $1', [player1.id]);
    if (player2) await db.query('DELETE FROM players WHERE id = $1', [player2.id]);
    if (team1) await db.query('DELETE FROM teams WHERE id = $1', [team1.id]);
    if (team2) await db.query('DELETE FROM teams WHERE id = $1', [team2.id]);
    if (season1) await db.query('DELETE FROM seasons WHERE id = $1', [season1.id]);
    if (adminUserId) await db.query('DELETE FROM users WHERE id = $1', [adminUserId]);
    if (regularUserId) await db.query('DELETE FROM users WHERE id = $1', [regularUserId]);
    
    console.log('✅ Reports Routes cleanup complete');
  });

  describe('🔒 Authentication', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .get(`/api/reports/season/team/${team1.id}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should allow authenticated users to access reports', async () => {
      const response = await request(app)
        .get(`/api/reports/season/team/${team1.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('overall_record');
    });
  });

  describe('📈 Season Team Reports', () => {
    it('should get season performance report for a team', async () => {
      const response = await request(app)
        .get(`/api/reports/season/team/${team1.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('overall_record');
      expect(response.body.overall_record).toMatchObject({
        wins: expect.any(Number),
        losses: expect.any(Number),
        draws: expect.any(Number),
        total_games: expect.any(Number),
        win_percentage: expect.any(Number),
        points_for: expect.any(Number),
        points_against: expect.any(Number),
        point_differential: expect.any(Number)
      });

      expect(response.body).toHaveProperty('home_away_performance');
      expect(Array.isArray(response.body.home_away_performance)).toBe(true);
      
      expect(response.body).toHaveProperty('scoring_trends');
      expect(Array.isArray(response.body.scoring_trends)).toBe(true);
      
      expect(response.body).toHaveProperty('shooting_trends');
      expect(Array.isArray(response.body.shooting_trends)).toBe(true);
    });

    it('should filter by season ID', async () => {
      const response = await request(app)
        .get(`/api/reports/season/team/${team1.id}`)
        .query({ seasonId: season1.id })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.overall_record.total_games).toBeGreaterThan(0);
    });

    it('should filter by year', async () => {
      const response = await request(app)
        .get(`/api/reports/season/team/${team1.id}`)
        .query({ year: 2024 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.overall_record.total_games).toBeGreaterThan(0);
    });

    it('should handle team with no games', async () => {
      const newTeamResult = await db.query(
        'INSERT INTO teams (name) VALUES ($1) RETURNING *',
        ['No Games Team']
      );
      const newTeam = newTeamResult.rows[0];

      const response = await request(app)
        .get(`/api/reports/season/team/${newTeam.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.overall_record.total_games).toBe(0);

      await db.query('DELETE FROM teams WHERE id = $1', [newTeam.id]);
    });

    it('should validate team ID parameter', async () => {
      const response = await request(app)
        .get('/api/reports/season/team/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('👤 Player Season Summary', () => {
    it('should get player season summary', async () => {
      const response = await request(app)
        .get(`/api/reports/season/player/${player1.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('player');
      expect(response.body.player).toMatchObject({
        id: player1.id,
        first_name: 'John',
        last_name: expect.any(String),
        jersey_number: 10
      });

      expect(response.body).toHaveProperty('season_summary');
      expect(response.body.season_summary).toMatchObject({
        games_played: expect.any(Number),
        total_shots: expect.any(Number),
        total_goals: expect.any(Number),
        fg_percentage: expect.any(Number),
        points_per_game: expect.any(Number)
      });

      expect(response.body).toHaveProperty('shooting_zones_heatmap');
      expect(Array.isArray(response.body.shooting_zones_heatmap)).toBe(true);

      expect(response.body).toHaveProperty('game_performance');
      expect(Array.isArray(response.body.game_performance)).toBe(true);

      expect(response.body).toHaveProperty('best_performance');
      expect(response.body).toHaveProperty('worst_performance');
      expect(response.body).toHaveProperty('career_statistics');
    });

    it('should filter player stats by season', async () => {
      const response = await request(app)
        .get(`/api/reports/season/player/${player1.id}`)
        .query({ seasonId: season1.id })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.season_summary.games_played).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent player', async () => {
      const response = await request(app)
        .get('/api/reports/season/player/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate player ID parameter', async () => {
      const response = await request(app)
        .get('/api/reports/season/player/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('🔄 Comparative Team Analysis', () => {
    it('should get comparative team analysis', async () => {
      const response = await request(app)
        .get(`/api/reports/comparative/teams/${team1.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('team_stats');
      expect(response.body.team_stats).toMatchObject({
        games: expect.any(Number),
        avg_points_for: expect.any(Number),
        avg_points_against: expect.any(Number),
        win_percentage: expect.any(Number),
        fg_percentage: expect.any(Number)
      });

      expect(response.body).toHaveProperty('league_averages');
      expect(response.body.league_averages).toMatchObject({
        avg_points: expect.any(Number),
        avg_win_percentage: expect.any(Number),
        avg_fg_percentage: expect.any(Number)
      });

      expect(response.body).toHaveProperty('comparison_to_league');
      expect(response.body.comparison_to_league).toMatchObject({
        points_diff: expect.any(Number),
        win_pct_diff: expect.any(Number),
        fg_pct_diff: expect.any(Number)
      });
    });

    it('should include season-over-season comparison when requested', async () => {
      const response = await request(app)
        .get(`/api/reports/comparative/teams/${team1.id}`)
        .query({ compareYear: 2023 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('season_over_season');
    });

    it('should validate team ID parameter', async () => {
      const response = await request(app)
        .get('/api/reports/comparative/teams/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('👥 Comparative Player Analysis', () => {
    it('should get comparative player analysis', async () => {
      const response = await request(app)
        .get(`/api/reports/comparative/players/${player1.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('player');
      expect(response.body.player).toMatchObject({
        id: player1.id,
        first_name: 'John',
        last_name: expect.any(String)
      });

      expect(response.body).toHaveProperty('player_stats');
      expect(response.body.player_stats).toMatchObject({
        games_played: expect.any(Number),
        total_shots: expect.any(Number),
        total_goals: expect.any(Number),
        fg_percentage: expect.any(Number),
        points_per_game: expect.any(Number),
        shots_per_game: expect.any(Number)
      });

      expect(response.body).toHaveProperty('team_averages');
      expect(response.body).toHaveProperty('league_averages');
      expect(response.body).toHaveProperty('comparison_to_team');
      expect(response.body).toHaveProperty('comparison_to_league');
    });

    it('should return 404 for non-existent player', async () => {
      const response = await request(app)
        .get('/api/reports/comparative/players/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate player ID parameter', async () => {
      const response = await request(app)
        .get('/api/reports/comparative/players/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('⚠️ Error Handling', () => {
    it('should handle invalid season ID', async () => {
      const response = await request(app)
        .get(`/api/reports/season/team/${team1.id}`)
        .query({ seasonId: 'invalid' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    it('should handle invalid year', async () => {
      const response = await request(app)
        .get(`/api/reports/season/player/${player1.id}`)
        .query({ year: 1999 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });
});
