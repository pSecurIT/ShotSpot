import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

describe('📊 Analytics Routes', () => {
  let authToken;
  let userToken;
  let adminUserId;
  let regularUserId;
  let team1;
  let team2;
  let player1;
  let player2;
  let analyticsGame;
  let analyticsShots = [];

  beforeAll(async () => {
    console.log('🔧 Setting up Analytics Routes tests...');
    
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Create test users
    const adminResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [`admin_analytics_${uniqueId}`, `admin_analytics_${uniqueId}@test.com`, 'hash', 'admin']
    );
    adminUserId = adminResult.rows[0].id;
    authToken = jwt.sign({ id: adminUserId, role: 'admin' }, process.env.JWT_SECRET);

    const userResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [`user_analytics_${uniqueId}`, `user_analytics_${uniqueId}@test.com`, 'hash', 'user']
    );
    regularUserId = userResult.rows[0].id;
    userToken = jwt.sign({ id: regularUserId, role: 'user' }, process.env.JWT_SECRET);

    // Create test teams
    const team1Result = await db.query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING *',
      [`Analytics Team 1 ${uniqueId}`]
    );
    team1 = team1Result.rows[0];

    const team2Result = await db.query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING *',
      [`Analytics Team 2 ${uniqueId}`]
    );
    team2 = team2Result.rows[0];

    // Create test players
    const player1Result = await db.query(
      `INSERT INTO players (team_id, first_name, last_name, jersey_number) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [team1.id, 'Ana', `Player${uniqueId}`, 10]
    );
    player1 = player1Result.rows[0];

    const player2Result = await db.query(
      `INSERT INTO players (team_id, first_name, last_name, jersey_number) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [team2.id, 'Bob', `Player${uniqueId}`, 20]
    );
    player2 = player2Result.rows[0];

    // Create a game for analytics
    const gameResult = await db.query(
      `INSERT INTO games (home_team_id, away_team_id, date, status, home_score, away_score, current_period)
       VALUES ($1, $2, CURRENT_TIMESTAMP, 'in_progress', 0, 0, 1) RETURNING *`,
      [team1.id, team2.id]
    );
    analyticsGame = gameResult.rows[0];

    // Create diverse shot data for analytics
    const shotData = [
      // Team 1 player 1 - left zone shots
      { x: 10, y: 50, result: 'goal', player_id: player1.id, team_id: team1.id, distance: 5.5 },
      { x: 15, y: 45, result: 'goal', player_id: player1.id, team_id: team1.id, distance: 6.0 },
      { x: 20, y: 55, result: 'miss', player_id: player1.id, team_id: team1.id, distance: 7.0 },
      { x: 25, y: 50, result: 'blocked', player_id: player1.id, team_id: team1.id, distance: 5.0 },
      
      // Team 1 player 1 - center zone shots
      { x: 40, y: 50, result: 'goal', player_id: player1.id, team_id: team1.id, distance: 4.0 },
      { x: 50, y: 50, result: 'goal', player_id: player1.id, team_id: team1.id, distance: 3.5 },
      { x: 60, y: 50, result: 'miss', player_id: player1.id, team_id: team1.id, distance: 4.5 },
      
      // Team 1 player 1 - right zone shots
      { x: 70, y: 50, result: 'goal', player_id: player1.id, team_id: team1.id, distance: 6.5 },
      { x: 80, y: 50, result: 'miss', player_id: player1.id, team_id: team1.id, distance: 8.0 },
      { x: 90, y: 50, result: 'miss', player_id: player1.id, team_id: team1.id, distance: 9.0 },
      
      // Team 2 player 2 - various shots
      { x: 30, y: 40, result: 'goal', player_id: player2.id, team_id: team2.id, distance: 5.0 },
      { x: 45, y: 60, result: 'goal', player_id: player2.id, team_id: team2.id, distance: 4.0 },
      { x: 55, y: 55, result: 'miss', player_id: player2.id, team_id: team2.id, distance: 5.5 },
      { x: 65, y: 45, result: 'blocked', player_id: player2.id, team_id: team2.id, distance: 6.0 }
    ];

    for (const shot of shotData) {
      const shotResult = await db.query(
        `INSERT INTO shots (game_id, player_id, team_id, x_coord, y_coord, result, period, distance)
         VALUES ($1, $2, $3, $4, $5, $6, 1, $7) RETURNING *`,
        [analyticsGame.id, shot.player_id, shot.team_id, shot.x, shot.y, shot.result, shot.distance]
      );
      analyticsShots.push(shotResult.rows[0]);
    }

    console.log('✅ Analytics Routes test setup completed');
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up Analytics Routes tests...');
    await db.query('DELETE FROM shots WHERE game_id = $1', [analyticsGame.id]);
    await db.query('DELETE FROM games WHERE id = $1', [analyticsGame.id]);
    await db.query('DELETE FROM players WHERE id = ANY($1)', [[player1.id, player2.id]]);
    await db.query('DELETE FROM teams WHERE id = ANY($1)', [[team1.id, team2.id]]);
    await db.query('DELETE FROM users WHERE id = ANY($1)', [[adminUserId, regularUserId]]);
    console.log('✅ Analytics Routes tests cleanup completed');
  });

  describe('📈 GET /api/analytics/shots/:gameId/heatmap', () => {
    it('✅ should return heatmap data with default grid size', async () => {
      try {
        const response = await request(app)
          .get(`/api/analytics/shots/${analyticsGame.id}/heatmap`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('grid_size', 10);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);

        const firstBucket = response.body.data[0];
        expect(firstBucket).toHaveProperty('x');
        expect(firstBucket).toHaveProperty('y');
        expect(firstBucket).toHaveProperty('count');
        expect(firstBucket).toHaveProperty('goals');
        expect(firstBucket).toHaveProperty('misses');
        expect(firstBucket).toHaveProperty('blocked');
        expect(firstBucket).toHaveProperty('success_rate');
      } catch (error) {
        global.testContext.logTestError(error, 'Heatmap default grid failed');
        throw error;
      }
    });

    it('✅ should accept custom grid size', async () => {
      try {
        const response = await request(app)
          .get(`/api/analytics/shots/${analyticsGame.id}/heatmap?grid_size=5`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.grid_size).toBe(5);
      } catch (error) {
        global.testContext.logTestError(error, 'Heatmap custom grid failed');
        throw error;
      }
    });

    it('✅ should filter by team', async () => {
      try {
        const response = await request(app)
          .get(`/api/analytics/shots/${analyticsGame.id}/heatmap?team_id=${team1.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.length).toBeGreaterThan(0);
      } catch (error) {
        global.testContext.logTestError(error, 'Heatmap team filter failed');
        throw error;
      }
    });

    it('✅ should filter by period', async () => {
      try {
        const response = await request(app)
          .get(`/api/analytics/shots/${analyticsGame.id}/heatmap?period=1`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.length).toBeGreaterThan(0);
      } catch (error) {
        global.testContext.logTestError(error, 'Heatmap period filter failed');
        throw error;
      }
    });

    it('❌ should reject invalid grid size', async () => {
      try {
        const response = await request(app)
          .get(`/api/analytics/shots/${analyticsGame.id}/heatmap?grid_size=25`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(400);
      } catch (error) {
        global.testContext.logTestError(error, 'Heatmap invalid grid rejection failed');
        throw error;
      }
    });

    it('❌ should require authentication', async () => {
      try {
        const response = await request(app)
          .get(`/api/analytics/shots/${analyticsGame.id}/heatmap`);

        expect(response.status).toBe(401);
      } catch (error) {
        global.testContext.logTestError(error, 'Heatmap auth requirement failed');
        throw error;
      }
    });
  });

  describe('🎯 GET /api/analytics/shots/:gameId/shot-chart', () => {
    it('✅ should return all shot locations with details', async () => {
      try {
        const response = await request(app)
          .get(`/api/analytics/shots/${analyticsGame.id}/shot-chart`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(14); // Total shots created

        const shot = response.body[0];
        expect(shot).toHaveProperty('id');
        expect(shot).toHaveProperty('x_coord');
        expect(shot).toHaveProperty('y_coord');
        expect(shot).toHaveProperty('result');
        expect(shot).toHaveProperty('first_name');
        expect(shot).toHaveProperty('last_name');
        expect(shot).toHaveProperty('team_name');
      } catch (error) {
        global.testContext.logTestError(error, 'Shot chart all shots failed');
        throw error;
      }
    });

    it('✅ should filter by team', async () => {
      try {
        const response = await request(app)
          .get(`/api/analytics/shots/${analyticsGame.id}/shot-chart?team_id=${team1.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.length).toBe(10); // Team 1 shots
        response.body.forEach(shot => {
          expect(shot.team_id).toBe(team1.id);
        });
      } catch (error) {
        global.testContext.logTestError(error, 'Shot chart team filter failed');
        throw error;
      }
    });

    it('✅ should filter by player', async () => {
      try {
        const response = await request(app)
          .get(`/api/analytics/shots/${analyticsGame.id}/shot-chart?player_id=${player1.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.length).toBe(10); // Player 1 shots
      } catch (error) {
        global.testContext.logTestError(error, 'Shot chart player filter failed');
        throw error;
      }
    });

    it('✅ should allow regular users to view', async () => {
      try {
        const response = await request(app)
          .get(`/api/analytics/shots/${analyticsGame.id}/shot-chart`)
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
      } catch (error) {
        global.testContext.logTestError(error, 'Shot chart user access failed');
        throw error;
      }
    });
  });

  describe('👤 GET /api/analytics/shots/:gameId/players', () => {
    it('✅ should return player statistics', async () => {
      try {
        const response = await request(app)
          .get(`/api/analytics/shots/${analyticsGame.id}/players`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(2); // Two players

        const player = response.body[0];
        expect(player).toHaveProperty('player_id');
        expect(player).toHaveProperty('first_name');
        expect(player).toHaveProperty('total_shots');
        expect(player).toHaveProperty('goals');
        expect(player).toHaveProperty('misses');
        expect(player).toHaveProperty('blocked');
        expect(player).toHaveProperty('field_goal_percentage');
        expect(player).toHaveProperty('zone_performance');
        expect(player.zone_performance).toHaveProperty('left');
        expect(player.zone_performance).toHaveProperty('center');
        expect(player.zone_performance).toHaveProperty('right');
      } catch (error) {
        global.testContext.logTestError(error, 'Player analytics failed');
        throw error;
      }
    });

    it('✅ should calculate zone performance correctly', async () => {
      try {
        const response = await request(app)
          .get(`/api/analytics/shots/${analyticsGame.id}/players?team_id=${team1.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        const playerStats = response.body.find(p => p.player_id === player1.id);
        
        expect(playerStats.zone_performance.left.shots).toBe(4); // 4 left zone shots
        expect(playerStats.zone_performance.center.shots).toBe(3); // 3 center zone shots
        expect(playerStats.zone_performance.right.shots).toBe(3); // 3 right zone shots
        
        expect(playerStats.zone_performance.left.goals).toBe(2);
        expect(playerStats.zone_performance.center.goals).toBe(2);
        expect(playerStats.zone_performance.right.goals).toBe(1);
      } catch (error) {
        global.testContext.logTestError(error, 'Zone performance calculation failed');
        throw error;
      }
    });

    it('✅ should calculate field goal percentage', async () => {
      try {
        const response = await request(app)
          .get(`/api/analytics/shots/${analyticsGame.id}/players`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        const playerStats = response.body.find(p => p.player_id === player1.id);
        
        // Player 1: 5 goals out of 10 shots = 50%
        expect(playerStats.field_goal_percentage).toBe(50);
        expect(playerStats.total_shots).toBe(10);
        expect(playerStats.goals).toBe(5);
      } catch (error) {
        global.testContext.logTestError(error, 'FG% calculation failed');
        throw error;
      }
    });

    it('✅ should filter by team', async () => {
      try {
        const response = await request(app)
          .get(`/api/analytics/shots/${analyticsGame.id}/players?team_id=${team2.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.length).toBe(1); // Only player 2
        expect(response.body[0].player_id).toBe(player2.id);
      } catch (error) {
        global.testContext.logTestError(error, 'Player analytics team filter failed');
        throw error;
      }
    });
  });

  describe('📋 GET /api/analytics/shots/:gameId/summary', () => {
    it('✅ should return overall game statistics', async () => {
      try {
        const response = await request(app)
          .get(`/api/analytics/shots/${analyticsGame.id}/summary`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('overall');
        expect(response.body).toHaveProperty('by_team');

        const overall = response.body.overall;
        expect(overall.total_shots).toBe(14);
        expect(overall.total_goals).toBe(7);
        expect(overall.total_misses).toBe(5);
        expect(overall.total_blocked).toBe(2);
        expect(overall.overall_fg_percentage).toBeCloseTo(50, 0);

        expect(Array.isArray(response.body.by_team)).toBe(true);
        expect(response.body.by_team.length).toBe(2);
      } catch (error) {
        global.testContext.logTestError(error, 'Summary statistics failed');
        throw error;
      }
    });

    it('✅ should calculate team statistics correctly', async () => {
      try {
        const response = await request(app)
          .get(`/api/analytics/shots/${analyticsGame.id}/summary`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        
        const team1Stats = response.body.by_team.find(t => t.team_id === team1.id);
        expect(team1Stats.total_shots).toBe(10);
        expect(team1Stats.goals).toBe(5);
        expect(team1Stats.fg_percentage).toBe(50);

        const team2Stats = response.body.by_team.find(t => t.team_id === team2.id);
        expect(team2Stats.total_shots).toBe(4);
        expect(team2Stats.goals).toBe(2);
        expect(team2Stats.fg_percentage).toBe(50);
      } catch (error) {
        global.testContext.logTestError(error, 'Team statistics calculation failed');
        throw error;
      }
    });

    it('✅ should allow regular users to view summary', async () => {
      try {
        const response = await request(app)
          .get(`/api/analytics/shots/${analyticsGame.id}/summary`)
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
      } catch (error) {
        global.testContext.logTestError(error, 'Summary user access failed');
        throw error;
      }
    });
  });
});
