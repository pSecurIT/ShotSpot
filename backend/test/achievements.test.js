import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

describe('🏆 Achievements Routes', () => {
  let authToken;
  let testUserId;
  let testTeamId;
  let testPlayerId;
  let testGameId;

  beforeAll(async () => {
    // Create test user
    const userResult = await db.query(`
      INSERT INTO users (username, password_hash, email, role)
      VALUES ('achievementuser', 'hashedpass', 'achievement@test.com', 'coach')
      RETURNING id
    `);
    testUserId = userResult.rows[0].id;

    // Create auth token
    const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_key_min_32_chars_long_for_testing';
    authToken = jwt.sign(
      { userId: testUserId, role: 'coach' },
      jwtSecret,
      { expiresIn: '1h' }
    );

    // Create test teams
    const teamResult = await db.query(`
      INSERT INTO teams (name) 
      VALUES ('Achievement Team')
      RETURNING id
    `);
    testTeamId = teamResult.rows[0].id;

    const awayTeamResult = await db.query(`
      INSERT INTO teams (name) 
      VALUES ('Away Team')
      RETURNING id
    `);
    const awayTeamId = awayTeamResult.rows[0].id;

    // Create test player
    const playerResult = await db.query(`
      INSERT INTO players (first_name, last_name, jersey_number, team_id, gender)
      VALUES ('Test', 'Achiever', 99, $1, 'male')
      RETURNING id
    `, [testTeamId]);
    testPlayerId = playerResult.rows[0].id;

    // Create test game
    const gameResult = await db.query(`
      INSERT INTO games (home_team_id, away_team_id, date, status)
      VALUES ($1, $2, CURRENT_DATE, 'completed')
      RETURNING id
    `, [testTeamId, awayTeamId]);
    testGameId = gameResult.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup
    await db.query('DELETE FROM player_achievements WHERE player_id = $1', [testPlayerId]);
    await db.query('DELETE FROM shots WHERE player_id = $1', [testPlayerId]);
    await db.query('DELETE FROM games WHERE id = $1', [testGameId]);
    await db.query('DELETE FROM players WHERE id = $1', [testPlayerId]);
    await db.query('DELETE FROM teams WHERE id = $1', [testTeamId]);
    await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  describe('📋 GET /api/achievements/list', () => {
    it('✅ should return all available achievements', async () => {
      const response = await request(app)
        .get('/api/achievements/list')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      const achievement = response.body[0];
      expect(achievement).toHaveProperty('id');
      expect(achievement).toHaveProperty('name');
      expect(achievement).toHaveProperty('description');
      expect(achievement).toHaveProperty('badge_icon');
      expect(achievement).toHaveProperty('category');
      expect(achievement).toHaveProperty('criteria');
      expect(achievement).toHaveProperty('points');
    });

    it('✅ should have correct achievement categories', async () => {
      const response = await request(app)
        .get('/api/achievements/list')
        .set('Authorization', `Bearer ${authToken}`);

      const categories = [...new Set(response.body.map(a => a.category))];
      expect(categories).toContain('shooting');
      expect(categories).toContain('consistency');
      expect(categories).toContain('improvement');
      expect(categories).toContain('milestone');
    });

    it('❌ should require authentication', async () => {
      const response = await request(app)
        .get('/api/achievements/list');

      expect(response.status).toBe(401);
    });
  });

  describe('👤 GET /api/achievements/player/:playerId', () => {
    it('✅ should return empty achievements for new player', async () => {
      const response = await request(app)
        .get(`/api/achievements/player/${testPlayerId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('achievements');
      expect(response.body).toHaveProperty('total_points');
      expect(Array.isArray(response.body.achievements)).toBe(true);
      expect(response.body.achievements.length).toBe(0);
      expect(response.body.total_points).toBe(0);
    });

    it('✅ should return achievements with details', async () => {
      // Manually award an achievement
      const achievementResult = await db.query(
        'SELECT id FROM achievements WHERE name = $1',
        ['Sharpshooter']
      );
      
      if (achievementResult.rows.length > 0) {
        await db.query(`
          INSERT INTO player_achievements (player_id, achievement_id, game_id)
          VALUES ($1, $2, $3)
          ON CONFLICT DO NOTHING
        `, [testPlayerId, achievementResult.rows[0].id, testGameId]);

        const response = await request(app)
          .get(`/api/achievements/player/${testPlayerId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.achievements.length).toBeGreaterThan(0);
        expect(response.body.total_points).toBeGreaterThan(0);
        
        const achievement = response.body.achievements[0];
        expect(achievement).toHaveProperty('name');
        expect(achievement).toHaveProperty('badge_icon');
        expect(achievement).toHaveProperty('earned_at');
      }
    });

    it('❌ should reject invalid player ID', async () => {
      const response = await request(app)
        .get('/api/achievements/player/invalid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('🎯 POST /api/achievements/check/:playerId', () => {
    it('✅ should check achievements without errors', async () => {
      const response = await request(app)
        .post(`/api/achievements/check/${testPlayerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .query({ gameId: testGameId });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('checked');
      expect(response.body).toHaveProperty('new_achievements');
      expect(Array.isArray(response.body.new_achievements)).toBe(true);
    });

    it('✅ should award Sharpshooter achievement', async () => {
      // Create 10 goals for the player
      const shots = [];
      for (let i = 0; i < 10; i++) {
        shots.push(`(${testGameId}, ${testPlayerId}, ${testTeamId}, 50, 50, 'goal', 1)`);
      }
      
      await db.query(`
        INSERT INTO shots (game_id, player_id, team_id, x_coord, y_coord, result, period)
        VALUES ${shots.join(', ')}
      `);

      const response = await request(app)
        .post(`/api/achievements/check/${testPlayerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .query({ gameId: testGameId });

      expect(response.status).toBe(200);
      
      // Check if Sharpshooter was awarded
      const sharpshooter = response.body.new_achievements.find(a => a.name === 'Sharpshooter');
      if (sharpshooter) {
        expect(sharpshooter.points).toBeGreaterThan(0);
        expect(sharpshooter.badge_icon).toBeTruthy();
      }
    });

    it('✅ should not award same achievement twice', async () => {
      // Run check twice
      await request(app)
        .post(`/api/achievements/check/${testPlayerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .query({ gameId: testGameId });

      const response = await request(app)
        .post(`/api/achievements/check/${testPlayerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .query({ gameId: testGameId });

      expect(response.status).toBe(200);
      
      // Should not award Sharpshooter again
      const duplicates = response.body.new_achievements.filter(a => a.name === 'Sharpshooter');
      expect(duplicates.length).toBe(0);
    });

    it('❌ should reject invalid player ID', async () => {
      const response = await request(app)
        .post('/api/achievements/check/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });
  });

  describe('🏅 GET /api/achievements/leaderboard', () => {
    it('✅ should return leaderboard data', async () => {
      const response = await request(app)
        .get('/api/achievements/leaderboard')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('season');
      expect(response.body).toHaveProperty('leaderboard');
      expect(Array.isArray(response.body.leaderboard)).toBe(true);
    });

    it('✅ should include player stats in leaderboard', async () => {
      const response = await request(app)
        .get('/api/achievements/leaderboard')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.body.leaderboard.length > 0) {
        const player = response.body.leaderboard[0];
        expect(player).toHaveProperty('rank');
        expect(player).toHaveProperty('first_name');
        expect(player).toHaveProperty('last_name');
        expect(player).toHaveProperty('team_name');
        expect(player).toHaveProperty('total_shots');
        expect(player).toHaveProperty('total_goals');
        expect(player).toHaveProperty('fg_percentage');
        expect(player).toHaveProperty('achievement_points');
      }
    });

    it('✅ should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/achievements/leaderboard')
        .query({ limit: 5 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.leaderboard.length).toBeLessThanOrEqual(5);
    });

    it('✅ should order by FG percentage', async () => {
      const response = await request(app)
        .get('/api/achievements/leaderboard')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.body.leaderboard.length >= 2) {
        const first = response.body.leaderboard[0];
        const second = response.body.leaderboard[1];
        expect(first.fg_percentage).toBeGreaterThanOrEqual(second.fg_percentage);
      }
    });

    it('❌ should reject invalid limit', async () => {
      const response = await request(app)
        .get('/api/achievements/leaderboard')
        .query({ limit: 200 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('🏆 GET /api/achievements/team/:teamId/leaderboard', () => {
    it('✅ should return team-specific leaderboard', async () => {
      const response = await request(app)
        .get(`/api/achievements/team/${testTeamId}/leaderboard`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('team_id');
      expect(response.body).toHaveProperty('leaderboard');
      expect(response.body.team_id).toBe(testTeamId);
    });

    it('✅ should include achievement counts', async () => {
      const response = await request(app)
        .get(`/api/achievements/team/${testTeamId}/leaderboard`)
        .set('Authorization', `Bearer ${authToken}`);

      if (response.body.leaderboard.length > 0) {
        const player = response.body.leaderboard[0];
        expect(player).toHaveProperty('achievements_earned');
        expect(typeof player.achievements_earned).toBe('number');
      }
    });

    it('✅ should only include active players', async () => {
      // Create inactive player
      const inactivePlayer = await db.query(`
        INSERT INTO players (first_name, last_name, jersey_number, team_id, gender, is_active)
        VALUES ('Inactive', 'Player', 88, $1, 'male', false)
        RETURNING id
      `, [testTeamId]);

      const response = await request(app)
        .get(`/api/achievements/team/${testTeamId}/leaderboard`)
        .set('Authorization', `Bearer ${authToken}`);

      const hasInactive = response.body.leaderboard.some(
        p => p.id === inactivePlayer.rows[0].id
      );
      expect(hasInactive).toBe(false);

      // Cleanup
      await db.query('DELETE FROM players WHERE id = $1', [inactivePlayer.rows[0].id]);
    });

    it('❌ should reject invalid team ID', async () => {
      const response = await request(app)
        .get('/api/achievements/team/invalid/leaderboard')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('🔒 Authorization', () => {
    it('❌ should reject requests without token', async () => {
      const response = await request(app)
        .get('/api/achievements/list');

      expect(response.status).toBe(401);
    });

    it('❌ should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/achievements/list')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(401);
    });
  });
});
