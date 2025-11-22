import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
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
  let player3;
  let _player4;
  let testGame;

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
      [team1.id, 'Alice', `Player${uniqueId}`, 10]
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
      [team1.id, 'Bob', `Player${uniqueId}`, 11]
    );
    player2 = player2Result.rows[0];

    const player3Result = await db.query(
      `INSERT INTO players (team_id, first_name, last_name, jersey_number) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [team2.id, 'Charlie', `Player${uniqueId}`, 20]
    );
    player3 = player3Result.rows[0];

    const player4Result = await db.query(
      `INSERT INTO players (team_id, first_name, last_name, jersey_number) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [team2.id, 'Diana', `Player${uniqueId}`, 21]
    );
    _player4 = player4Result.rows[0];

    // Create a game in progress
    const gameResult = await db.query(
      'INSERT INTO games (home_team_id, away_team_id, date, status, home_score, away_score, current_period) VALUES ($1, $2, CURRENT_TIMESTAMP, \'in_progress\', 0, 0, 1) RETURNING *',
      [team1.id, team2.id]
    );
    testGame = gameResult.rows[0];

    // Add game roster
    await db.query(
      'INSERT INTO game_rosters (game_id, team_id, player_id, is_starting) VALUES ($1, $2, $3, true)',
      [testGame.id, team1.id, player1.id]
    );
    await db.query(
      'INSERT INTO game_rosters (game_id, team_id, player_id, is_starting) VALUES ($1, $2, $3, true)',
      [testGame.id, team2.id, player3.id]
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
      // Team 1 player 1 - successful shooter
      { x: 10, y: 50, result: 'goal', player_id: player1.id, team_id: team1.id, period: 1, distance: 5.5 },
      { x: 15, y: 45, result: 'goal', player_id: player1.id, team_id: team1.id, period: 1, distance: 6.0 },
      { x: 20, y: 55, result: 'goal', player_id: player1.id, team_id: team1.id, period: 1, distance: 7.0 },
      { x: 25, y: 50, result: 'goal', player_id: player1.id, team_id: team1.id, period: 1, distance: 5.0 },
      { x: 30, y: 50, result: 'goal', player_id: player1.id, team_id: team1.id, period: 2, distance: 4.5 },
      
      // Team 1 player 2 - struggling shooter
      { x: 40, y: 50, result: 'miss', player_id: player2.id, team_id: team1.id, period: 1, distance: 4.0 },
      { x: 50, y: 50, result: 'miss', player_id: player2.id, team_id: team1.id, period: 1, distance: 3.5 },
      { x: 60, y: 50, result: 'blocked', player_id: player2.id, team_id: team1.id, period: 1, distance: 4.5 },
      { x: 65, y: 50, result: 'miss', player_id: player2.id, team_id: team1.id, period: 1, distance: 5.0 },
      { x: 70, y: 50, result: 'miss', player_id: player2.id, team_id: team1.id, period: 1, distance: 5.5 },
      { x: 75, y: 50, result: 'goal', player_id: player2.id, team_id: team1.id, period: 2, distance: 6.0 },
      
      // Team 2 player 3 - average shooter
      { x: 30, y: 40, result: 'goal', player_id: player3.id, team_id: team2.id, period: 1, distance: 5.0 },
      { x: 45, y: 60, result: 'goal', player_id: player3.id, team_id: team2.id, period: 1, distance: 4.0 },
      { x: 55, y: 55, result: 'miss', player_id: player3.id, team_id: team2.id, period: 2, distance: 5.5 },
      { x: 65, y: 45, result: 'blocked', player_id: player3.id, team_id: team2.id, period: 2, distance: 6.0 }
    ];

    for (const shot of shotData) {
      await db.query(
        `INSERT INTO shots (game_id, player_id, team_id, x_coord, y_coord, result, period, distance)
         VALUES ($1, $2, $3, $4, $5, $6, 1, $7)`,
        [shot.game_id, shot.player_id, shot.team_id, shot.x, shot.y, shot.result, shot.distance]
      );
    }

    console.log('✅ Reports Routes test setup complete');
        `INSERT INTO shots (game_id, player_id, team_id, x_coord, y_coord, result, period, time_remaining, distance)
         VALUES ($1, $2, $3, $4, $5, $6, $7, '00:05:00', $8)`,
        [testGame.id, shot.player_id, shot.team_id, shot.x, shot.y, shot.result, shot.period, shot.distance]
      );
    }

    // Update game scores based on goals
    const team1Goals = shotData.filter(s => s.team_id === team1.id && s.result === 'goal').length;
    const team2Goals = shotData.filter(s => s.team_id === team2.id && s.result === 'goal').length;
    await db.query(
      'UPDATE games SET home_score = $1, away_score = $2 WHERE id = $3',
      [team1Goals, team2Goals, testGame.id]
    );

    // Add some game events
    await db.query(
      `INSERT INTO game_events (game_id, event_type, team_id, player_id, period, time_remaining)
       VALUES ($1, 'foul', $2, $3, 1, '00:08:00')`,
      [testGame.id, team2.id, player3.id]
    );

    await db.query(
      `INSERT INTO game_events (game_id, event_type, team_id, period, time_remaining)
       VALUES ($1, 'timeout', $2, 1, '00:05:30')`,
      [testGame.id, team1.id]
    );

    console.log('✅ Test data created successfully');
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
    // Cleanup is handled by CASCADE deletes
    await db.query('DELETE FROM users WHERE id = $1 OR id = $2', [adminUserId, regularUserId]);
    await db.query('DELETE FROM teams WHERE id = $1 OR id = $2', [team1.id, team2.id]);
  });

  describe('GET /api/reports/live/:gameId', () => {
    it('should return live match report with authentication', async () => {
      const response = await request(app)
        .get(`/api/reports/live/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('game');
      expect(response.body).toHaveProperty('shot_summary');
      expect(response.body).toHaveProperty('recent_events');
      expect(response.body).toHaveProperty('top_scorers');
      expect(response.body).toHaveProperty('generated_at');

      expect(response.body.game.id).toBe(testGame.id);
      expect(response.body.game.status).toBe('in_progress');
      expect(response.body.shot_summary).toHaveLength(2); // Both teams
      expect(response.body.top_scorers.length).toBeGreaterThan(0);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/api/reports/live/${testGame.id}`)
        .expect(401);
    });

    it('should return 404 for non-existent game', async () => {
      await request(app)
        .get('/api/reports/live/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should include correct team scores in report', async () => {
      const response = await request(app)
        .get(`/api/reports/live/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.game.home_score).toBeGreaterThan(0);
      expect(response.body.game.away_score).toBeGreaterThan(0);
    });
  });

  describe('GET /api/reports/period/:gameId/:period', () => {
    it('should return period report for period 1', async () => {
      const response = await request(app)
        .get(`/api/reports/period/${testGame.id}/1`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('game_id');
      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('team_stats');
      expect(response.body).toHaveProperty('events');
      expect(response.body).toHaveProperty('player_stats');

      expect(response.body.period).toBe(1);
      expect(response.body.team_stats.length).toBeGreaterThan(0);
    });

    it('should return period report for period 2', async () => {
      const response = await request(app)
        .get(`/api/reports/period/${testGame.id}/2`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.period).toBe(2);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/api/reports/period/${testGame.id}/1`)
        .expect(401);
    });

    it('should return 404 for non-existent game', async () => {
      await request(app)
        .get('/api/reports/period/99999/1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should validate period parameter', async () => {
      await request(app)
        .get(`/api/reports/period/${testGame.id}/0`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('GET /api/reports/momentum/:gameId', () => {
    it('should calculate momentum tracker', async () => {
      const response = await request(app)
        .get(`/api/reports/momentum/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('window_size');
      expect(response.body).toHaveProperty('recent_shots_analyzed');
      expect(response.body).toHaveProperty('momentum');
      expect(response.body).toHaveProperty('recent_shots');

      expect(response.body.momentum).toHaveProperty('home');
      expect(response.body.momentum).toHaveProperty('away');
      expect(response.body.momentum).toHaveProperty('trend');

      expect(typeof response.body.momentum.home).toBe('number');
      expect(typeof response.body.momentum.away).toBe('number');
    });

    it('should accept custom window size', async () => {
      const response = await request(app)
        .get(`/api/reports/momentum/${testGame.id}?window=5`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.window_size).toBe(5);
    });

    it('should validate window parameter range', async () => {
      await request(app)
        .get(`/api/reports/momentum/${testGame.id}?window=3`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      await request(app)
        .get(`/api/reports/momentum/${testGame.id}?window=25`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/api/reports/momentum/${testGame.id}`)
        .expect(401);
    });

    it('should handle game with no shots', async () => {
      const emptyGame = await db.query(
        `INSERT INTO games (home_team_id, away_team_id, date, status, current_period)
         VALUES ($1, $2, CURRENT_TIMESTAMP, 'in_progress', 1) RETURNING *`,
        [team1.id, team2.id]
      );

      const response = await request(app)
        .get(`/api/reports/momentum/${emptyGame.rows[0].id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.momentum.home).toBe(0);
      expect(response.body.momentum.away).toBe(0);

      await db.query('DELETE FROM games WHERE id = $1', [emptyGame.rows[0].id]);
    });
  });

  describe('GET /api/reports/compare/:gameId/:playerId1/:playerId2', () => {
    it('should compare two players in a game', async () => {
      const response = await request(app)
        .get(`/api/reports/compare/${testGame.id}/${player1.id}/${player2.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('game_id');
      expect(response.body).toHaveProperty('players');
      expect(response.body).toHaveProperty('comparison_summary');

      expect(response.body.players).toHaveLength(2);
      expect(response.body.comparison_summary).toHaveProperty('goals_leader');
      expect(response.body.comparison_summary).toHaveProperty('fg_percentage_leader');
      expect(response.body.comparison_summary).toHaveProperty('shots_leader');
    });

    it('should include zone distribution in comparison', async () => {
      const response = await request(app)
        .get(`/api/reports/compare/${testGame.id}/${player1.id}/${player2.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      response.body.players.forEach(player => {
        expect(player).toHaveProperty('zone_distribution');
        expect(player.zone_distribution).toHaveProperty('left');
        expect(player.zone_distribution).toHaveProperty('center');
        expect(player.zone_distribution).toHaveProperty('right');
      });
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/api/reports/compare/${testGame.id}/${player1.id}/${player2.id}`)
        .expect(401);
    });

    it('should return 404 for non-existent players', async () => {
      await request(app)
        .get(`/api/reports/compare/${testGame.id}/99999/99998`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /api/reports/suggestions/substitution/:gameId', () => {
    it('should generate substitution suggestions', async () => {
      const response = await request(app)
        .get(`/api/reports/suggestions/substitution/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('game_id');
      expect(response.body).toHaveProperty('suggestions');
      expect(response.body).toHaveProperty('total_suggestions');

      expect(Array.isArray(response.body.suggestions)).toBe(true);
    });

    it('should filter suggestions by team', async () => {
      const response = await request(app)
        .get(`/api/reports/suggestions/substitution/${testGame.id}?team_id=${team1.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('suggestions');
    });

    it('should identify struggling players', async () => {
      const response = await request(app)
        .get(`/api/reports/suggestions/substitution/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Player 2 has low FG% and should be suggested for substitution
      const player2Suggestion = response.body.suggestions.find(
        s => s.player_id === player2.id
      );

      if (player2Suggestion) {
        expect(player2Suggestion.reason).toBe('Low field goal percentage');
        expect(player2Suggestion.current_fg).toBeLessThan(30);
      }
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/api/reports/suggestions/substitution/${testGame.id}`)
        .expect(401);
    });
  });

  describe('GET /api/reports/export/:gameId', () => {
    it('should export full game report in JSON format', async () => {
      const response = await request(app)
        .get(`/api/reports/export/${testGame.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('export_date');
      expect(response.body).toHaveProperty('game');
      expect(response.body).toHaveProperty('shots');
      expect(response.body).toHaveProperty('events');
      expect(response.body).toHaveProperty('player_statistics');

      expect(Array.isArray(response.body.shots)).toBe(true);
      expect(Array.isArray(response.body.events)).toBe(true);
      expect(Array.isArray(response.body.player_statistics)).toBe(true);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    it('should export summary format when requested', async () => {
      const response = await request(app)
        .get(`/api/reports/export/${testGame.id}?format=summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('export_date');
      expect(response.body).toHaveProperty('game');
      expect(response.body).toHaveProperty('summary');

      expect(response.body.summary).toHaveProperty('total_shots');
      expect(response.body.summary).toHaveProperty('total_goals');
      expect(response.body.summary).toHaveProperty('total_events');
      expect(response.body.summary).toHaveProperty('top_scorer');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/api/reports/export/${testGame.id}`)
        .expect(401);
    });

    it('should return 404 for non-existent game', async () => {
      await request(app)
        .get('/api/reports/export/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should validate format parameter', async () => {
      await request(app)
        .get(`/api/reports/export/${testGame.id}?format=invalid`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle invalid game ID format', async () => {
      await request(app)
        .get('/api/reports/live/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should handle invalid player ID format in comparison', async () => {
      await request(app)
        .get(`/api/reports/compare/${testGame.id}/invalid/invalid2`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should allow regular users to access reports', async () => {
      const response = await request(app)
        .get(`/api/reports/live/${testGame.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('game');
    });
  });
});
