import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';

describe('⏱️ Timeouts API', () => {
  let adminToken, coachToken, userToken;
  let adminUserId, coachUserId, userUserId;
  let homeTeamId, awayTeamId, gameId;

  beforeAll(async () => {
    console.log('🔧 Setting up Timeouts API tests...');

    // Create test users
    const adminRes = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ('testadmin_timeouts', 'admin_timeouts@test.com', '$2b$10$hashedpassword', 'admin') 
       RETURNING id`
    );
    adminUserId = adminRes.rows[0].id;

    const coachRes = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ('testcoach_timeouts', 'coach_timeouts@test.com', '$2b$10$hashedpassword', 'coach') 
       RETURNING id`
    );
    coachUserId = coachRes.rows[0].id;

    const userRes = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ('testuser_timeouts', 'user_timeouts@test.com', '$2b$10$hashedpassword', 'user') 
       RETURNING id`
    );
    userUserId = userRes.rows[0].id;

    // Generate tokens
    const jwt = await import('jsonwebtoken');
    adminToken = jwt.default.sign(
      { userId: adminUserId, username: 'testadmin_timeouts', role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    coachToken = jwt.default.sign(
      { userId: coachUserId, username: 'testcoach_timeouts', role: 'coach' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    userToken = jwt.default.sign(
      { userId: userUserId, username: 'testuser_timeouts', role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create test teams
    const homeTeam = await db.query(
      `INSERT INTO teams (name) VALUES ('Timeout Home Team') RETURNING id`
    );
    homeTeamId = homeTeam.rows[0].id;

    const awayTeam = await db.query(
      `INSERT INTO teams (name) VALUES ('Timeout Away Team') RETURNING id`
    );
    awayTeamId = awayTeam.rows[0].id;

    // Create test game
    const game = await db.query(
      `INSERT INTO games (
        home_team_id, away_team_id, date, status, current_period,
        period_duration, time_remaining, number_of_periods
      ) VALUES ($1, $2, CURRENT_TIMESTAMP, 'in_progress', 1, '25 minutes', '24 minutes', 4) 
      RETURNING id`,
      [homeTeamId, awayTeamId]
    );
    gameId = game.rows[0].id;

    console.log('✅ Timeouts API test setup completed');
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up Timeouts API tests...');
    await db.query('DELETE FROM timeouts WHERE game_id = $1', [gameId]);
    await db.query('DELETE FROM games WHERE id = $1', [gameId]);
    await db.query('DELETE FROM teams WHERE id = ANY($1)', [[homeTeamId, awayTeamId]]);
    await db.query('DELETE FROM users WHERE id = ANY($1)', [[adminUserId, coachUserId, userUserId]]);
    console.log('✅ Timeouts API tests cleanup completed');
  });

  describe('📊 GET /api/timeouts/:gameId', () => {
    describe('✅ Successful Operations', () => {
      it('✅ should get all timeouts for a game', async () => {
        // Create test timeout
        await db.query(
          `INSERT INTO timeouts (game_id, team_id, timeout_type, period, time_remaining, duration)
           VALUES ($1, $2, 'team', 1, '15 minutes', '1 minute')`,
          [gameId, homeTeamId]
        );

        const res = await request(app)
          .get(`/api/timeouts/${gameId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        expect(res.body[0]).toHaveProperty('timeout_type', 'team');
        expect(res.body[0]).toHaveProperty('team_name');
      });

      it('✅ should return empty array for game with no timeouts', async () => {
        const newGame = await db.query(
          `INSERT INTO games (
            home_team_id, away_team_id, date, status, current_period
          ) VALUES ($1, $2, CURRENT_TIMESTAMP, 'in_progress', 1) 
          RETURNING id`,
          [homeTeamId, awayTeamId]
        );
        const newGameId = newGame.rows[0].id;

        const res = await request(app)
          .get(`/api/timeouts/${newGameId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(0);

        await db.query('DELETE FROM games WHERE id = $1', [newGameId]);
      });

      it('✅ should allow regular user to view timeouts', async () => {
        const res = await request(app)
          .get(`/api/timeouts/${gameId}`)
          .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });
    });

    describe('❌ Error Handling', () => {
      it('❌ should require authentication', async () => {
        const res = await request(app)
          .get(`/api/timeouts/${gameId}`);

        expect(res.status).toBe(401);
      });
    });
  });

  describe('📝 POST /api/timeouts', () => {
    describe('✅ Successful Operations', () => {
      it('✅ should create team timeout as admin', async () => {
        const res = await request(app)
          .post('/api/timeouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: gameId,
            team_id: homeTeamId,
            timeout_type: 'team',
            period: 1,
            time_remaining: '15 minutes',
            reason: 'Strategic timeout',
            called_by: 'Head Coach'
          });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('timeout_type', 'team');
        expect(res.body).toHaveProperty('team_name', 'Timeout Home Team');
        expect(res.body).toHaveProperty('reason', 'Strategic timeout');
        expect(res.body).toHaveProperty('called_by', 'Head Coach');
      });

      it('✅ should create team timeout as coach', async () => {
        const res = await request(app)
          .post('/api/timeouts')
          .set('Authorization', `Bearer ${coachToken}`)
          .send({
            game_id: gameId,
            team_id: awayTeamId,
            timeout_type: 'team',
            period: 1,
            time_remaining: '10 minutes'
          });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('timeout_type', 'team');
        expect(res.body).toHaveProperty('team_id', awayTeamId);
      });

      it('✅ should create injury timeout without team_id', async () => {
        const res = await request(app)
          .post('/api/timeouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: gameId,
            timeout_type: 'injury',
            period: 1,
            reason: 'Player injury'
          });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('timeout_type', 'injury');
        expect(res.body.team_id).toBeNull();
      });

      it('✅ should create official timeout', async () => {
        const res = await request(app)
          .post('/api/timeouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: gameId,
            timeout_type: 'official',
            period: 2,
            reason: 'Equipment check'
          });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('timeout_type', 'official');
      });

      it('✅ should create TV timeout', async () => {
        const res = await request(app)
          .post('/api/timeouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: gameId,
            timeout_type: 'tv',
            period: 3,
            duration: '2 minutes'
          });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('timeout_type', 'tv');
        expect(res.body).toHaveProperty('duration');
      });
    });

    describe('❌ Error Handling', () => {
      it('❌ should require authentication', async () => {
        const res = await request(app)
          .post('/api/timeouts')
          .send({
            game_id: gameId,
            team_id: homeTeamId,
            timeout_type: 'team',
            period: 1
          });

        expect(res.status).toBe(401);
      });

      it('❌ should reject regular user creating timeouts', async () => {
        const res = await request(app)
          .post('/api/timeouts')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            game_id: gameId,
            team_id: homeTeamId,
            timeout_type: 'team',
            period: 1
          });

        expect(res.status).toBe(403);
      });

      it('❌ should validate required fields', async () => {
        const res = await request(app)
          .post('/api/timeouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: gameId
            // Missing required fields
          });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
      });

      it('❌ should validate timeout_type', async () => {
        const res = await request(app)
          .post('/api/timeouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: gameId,
            timeout_type: 'invalid',
            period: 1
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Timeout type must be one of');
      });

      it('❌ should validate period range', async () => {
        const res = await request(app)
          .post('/api/timeouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: gameId,
            timeout_type: 'official',
            period: 15
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Period must be between 1 and 10');
      });

      it('❌ should return 404 for non-existent game', async () => {
        const res = await request(app)
          .post('/api/timeouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: 999999,
            timeout_type: 'official',
            period: 1
          });

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Game not found');
      });

      it('❌ should reject timeout for game not in progress', async () => {
        const scheduledGame = await db.query(
          `INSERT INTO games (home_team_id, away_team_id, date, status, current_period)
           VALUES ($1, $2, CURRENT_TIMESTAMP, 'scheduled', 1) RETURNING id`,
          [homeTeamId, awayTeamId]
        );
        const scheduledGameId = scheduledGame.rows[0].id;

        const res = await request(app)
          .post('/api/timeouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: scheduledGameId,
            timeout_type: 'official',
            period: 1
          });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Cannot add timeouts to game that is not in progress');

        await db.query('DELETE FROM games WHERE id = $1', [scheduledGameId]);
      });

      it('❌ should reject team timeout for non-participating team', async () => {
        const otherTeam = await db.query(
          `INSERT INTO teams (name) VALUES ('Other Team') RETURNING id`
        );
        const otherTeamId = otherTeam.rows[0].id;

        const res = await request(app)
          .post('/api/timeouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: gameId,
            team_id: otherTeamId,
            timeout_type: 'team',
            period: 1
          });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Team is not participating in this game');

        await db.query('DELETE FROM teams WHERE id = $1', [otherTeamId]);
      });

      it('❌ should reject official timeout with team_id', async () => {
        const res = await request(app)
          .post('/api/timeouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: gameId,
            team_id: homeTeamId,
            timeout_type: 'official',
            period: 1
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('official timeouts should not have a team_id');
      });

      it('❌ should reject TV timeout with team_id', async () => {
        const res = await request(app)
          .post('/api/timeouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: gameId,
            team_id: homeTeamId,
            timeout_type: 'tv',
            period: 1
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('tv timeouts should not have a team_id');
      });

      it('❌ should reject team timeout without team_id', async () => {
        const res = await request(app)
          .post('/api/timeouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: gameId,
            timeout_type: 'team',
            period: 1
          });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'team_id is required for team timeouts');
      });
    });
  });

  describe('✏️ PUT /api/timeouts/:timeoutId/end', () => {
    let timeoutId;

    beforeEach(async () => {
      const timeout = await db.query(
        `INSERT INTO timeouts (game_id, team_id, timeout_type, period)
         VALUES ($1, $2, 'team', 1) RETURNING id`,
        [gameId, homeTeamId]
      );
      timeoutId = timeout.rows[0].id;
    });

    describe('✅ Successful Operations', () => {
      it('✅ should end timeout as admin', async () => {
        const res = await request(app)
          .put(`/api/timeouts/${timeoutId}/end`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ game_id: gameId });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id', timeoutId);
        expect(res.body).toHaveProperty('ended_at');
        expect(res.body.ended_at).not.toBeNull();
      });

      it('✅ should end timeout as coach', async () => {
        const newTimeout = await db.query(
          `INSERT INTO timeouts (game_id, team_id, timeout_type, period)
           VALUES ($1, $2, 'team', 1) RETURNING id`,
          [gameId, homeTeamId]
        );

        const res = await request(app)
          .put(`/api/timeouts/${newTimeout.rows[0].id}/end`)
          .set('Authorization', `Bearer ${coachToken}`)
          .send({ game_id: gameId });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('ended_at');
      });
    });

    describe('❌ Error Handling', () => {
      it('❌ should require authentication', async () => {
        const res = await request(app)
          .put(`/api/timeouts/${timeoutId}/end`)
          .send({ game_id: gameId });

        expect(res.status).toBe(401);
      });

      it('❌ should reject regular user', async () => {
        const res = await request(app)
          .put(`/api/timeouts/${timeoutId}/end`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ game_id: gameId });

        expect(res.status).toBe(403);
      });

      it('❌ should return 404 for non-existent timeout', async () => {
        const res = await request(app)
          .put('/api/timeouts/999999/end')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ game_id: gameId });

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Timeout not found');
      });

      it('❌ should reject ending already ended timeout', async () => {
        // End the timeout first
        await db.query(
          `UPDATE timeouts SET ended_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [timeoutId]
        );

        const res = await request(app)
          .put(`/api/timeouts/${timeoutId}/end`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ game_id: gameId });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Timeout has already ended');
      });

      it('❌ should validate game_id', async () => {
        const res = await request(app)
          .put(`/api/timeouts/${timeoutId}/end`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ game_id: 'invalid' });

        expect(res.status).toBe(400);
      });
    });
  });

  describe('✏️ PUT /api/timeouts/:timeoutId - Update Timeout', () => {
    let timeoutId;

    beforeEach(async () => {
      const timeout = await db.query(
        `INSERT INTO timeouts (game_id, team_id, timeout_type, period, reason)
         VALUES ($1, $2, 'team', 1, 'Original reason') RETURNING id`,
        [gameId, homeTeamId]
      );
      timeoutId = timeout.rows[0].id;
    });

    describe('✅ Successful Operations', () => {
      it('✅ should update timeout reason', async () => {
        const res = await request(app)
          .put(`/api/timeouts/${timeoutId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: gameId,
            reason: 'Updated reason'
          });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('reason', 'Updated reason');
      });

      it('✅ should update multiple fields', async () => {
        const res = await request(app)
          .put(`/api/timeouts/${timeoutId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: gameId,
            reason: 'New reason',
            called_by: 'Assistant Coach',
            duration: '2 minutes'
          });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('reason', 'New reason');
        expect(res.body).toHaveProperty('called_by', 'Assistant Coach');
      });
    });

    describe('❌ Error Handling', () => {
      it('❌ should require authentication', async () => {
        const res = await request(app)
          .put(`/api/timeouts/${timeoutId}`)
          .send({ game_id: gameId, reason: 'Updated' });

        expect(res.status).toBe(401);
      });

      it('❌ should reject regular user', async () => {
        const res = await request(app)
          .put(`/api/timeouts/${timeoutId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ game_id: gameId, reason: 'Updated' });

        expect(res.status).toBe(403);
      });

      it('❌ should return 404 for non-existent timeout', async () => {
        const res = await request(app)
          .put('/api/timeouts/999999')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ game_id: gameId, reason: 'Updated' });

        expect(res.status).toBe(404);
      });

      it('❌ should return 404 when game_id missing', async () => {
        const res = await request(app)
          .put(`/api/timeouts/${timeoutId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({});

        expect(res.status).toBe(404);
      });

      it('❌ should validate timeout_type if provided', async () => {
        const res = await request(app)
          .put(`/api/timeouts/${timeoutId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            game_id: gameId,
            timeout_type: 'invalid'
          });

        expect(res.status).toBe(400);
      });
    });
  });

  describe('🗑️ DELETE /api/timeouts/:timeoutId', () => {
    let timeoutId;

    beforeEach(async () => {
      const timeout = await db.query(
        `INSERT INTO timeouts (game_id, team_id, timeout_type, period)
         VALUES ($1, $2, 'team', 1) RETURNING id`,
        [gameId, homeTeamId]
      );
      timeoutId = timeout.rows[0].id;
    });

    describe('✅ Successful Operations', () => {
      it('✅ should delete timeout as admin', async () => {
        const res = await request(app)
          .delete(`/api/timeouts/${timeoutId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ game_id: gameId });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message', 'Timeout deleted successfully');

        // Verify deletion
        const check = await db.query('SELECT * FROM timeouts WHERE id = $1', [timeoutId]);
        expect(check.rows.length).toBe(0);
      });

      it('✅ should delete timeout as coach', async () => {
        const newTimeout = await db.query(
          `INSERT INTO timeouts (game_id, team_id, timeout_type, period)
           VALUES ($1, $2, 'team', 1) RETURNING id`,
          [gameId, homeTeamId]
        );

        const res = await request(app)
          .delete(`/api/timeouts/${newTimeout.rows[0].id}`)
          .set('Authorization', `Bearer ${coachToken}`)
          .send({ game_id: gameId });

        expect(res.status).toBe(200);
      });
    });

    describe('❌ Error Handling', () => {
      it('❌ should require authentication', async () => {
        const res = await request(app)
          .delete(`/api/timeouts/${timeoutId}`)
          .send({ game_id: gameId });

        expect(res.status).toBe(401);
      });

      it('❌ should reject regular user', async () => {
        const res = await request(app)
          .delete(`/api/timeouts/${timeoutId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ game_id: gameId });

        expect(res.status).toBe(403);
      });

      it('❌ should return 404 for non-existent timeout', async () => {
        const res = await request(app)
          .delete('/api/timeouts/999999')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ game_id: gameId });

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Timeout not found');
      });

      it('❌ should validate game_id', async () => {
        const res = await request(app)
          .delete(`/api/timeouts/${timeoutId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ game_id: 'invalid' });

        expect(res.status).toBe(400);
      });
    });
  });

  describe('🔧 Edge Cases and Validation', () => {
    it('🔧 should handle very long reason text (near limit)', async () => {
      const longReason = 'A'.repeat(200); // Exactly at limit

      const res = await request(app)
        .post('/api/timeouts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: gameId,
          timeout_type: 'official',
          period: 1,
          reason: longReason
        });

      expect(res.status).toBe(201);
      expect(res.body.reason).toHaveLength(200);
    });

    it('🔧 should reject reason exceeding maximum length', async () => {
      const tooLongReason = 'A'.repeat(201); // Over limit

      const res = await request(app)
        .post('/api/timeouts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: gameId,
          timeout_type: 'official',
          period: 1,
          reason: tooLongReason
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('maximum 200 characters');
    });

    it('🔧 should handle called_by at maximum length', async () => {
      const longCalledBy = 'B'.repeat(100);

      const res = await request(app)
        .post('/api/timeouts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: gameId,
          timeout_type: 'official',
          period: 1,
          called_by: longCalledBy
        });

      expect(res.status).toBe(201);
      expect(res.body.called_by).toHaveLength(100);
    });

    it('🔧 should handle multiple timeouts in same period', async () => {
      // Create first timeout
      const res1 = await request(app)
        .post('/api/timeouts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: gameId,
          team_id: homeTeamId,
          timeout_type: 'team',
          period: 2,
          time_remaining: '20 minutes'
        });

      // Create second timeout
      const res2 = await request(app)
        .post('/api/timeouts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          game_id: gameId,
          team_id: awayTeamId,
          timeout_type: 'team',
          period: 2,
          time_remaining: '15 minutes'
        });

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);

      // Verify both exist
      const list = await request(app)
        .get(`/api/timeouts/${gameId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const period2Timeouts = list.body.filter(t => t.period === 2);
      expect(period2Timeouts.length).toBeGreaterThanOrEqual(2);
    });
  });
});
