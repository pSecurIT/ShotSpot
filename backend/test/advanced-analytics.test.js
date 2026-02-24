import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

describe('📊 Advanced Analytics Routes', () => {
  let authToken;
  let coachToken;
  let userToken;
  let adminUserId;
  let coachUserId;
  let regularUserId;
  let club1;
  let club2;
  let player1;
  let player2;
  let player3;
  let game1;
  let game2;
  let shots = [];

  beforeAll(async () => {
    console.log('🔧 Setting up Advanced Analytics Routes tests...');
    
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Create test users
    const adminResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [`admin_adv_analytics_${uniqueId}`, `admin_adv_${uniqueId}@test.com`, 'hash', 'admin']
    );
    adminUserId = adminResult.rows[0].id;
    authToken = jwt.sign({ userId: adminUserId, role: 'admin' }, process.env.JWT_SECRET);

    const coachResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [`coach_adv_analytics_${uniqueId}`, `coach_adv_${uniqueId}@test.com`, 'hash', 'coach']
    );
    coachUserId = coachResult.rows[0].id;
    coachToken = jwt.sign({ userId: coachUserId, role: 'coach' }, process.env.JWT_SECRET);

    const userResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [`user_adv_analytics_${uniqueId}`, `user_adv_${uniqueId}@test.com`, 'hash', 'user']
    );
    regularUserId = userResult.rows[0].id;
    userToken = jwt.sign({ userId: regularUserId, role: 'user' }, process.env.JWT_SECRET);

    // Create test teams
    const club1Result = await db.query(
      'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
      [`Adv Analytics Team 1 ${uniqueId}`]
    );
    club1 = club1Result.rows[0];

    const club2Result = await db.query(
      'INSERT INTO clubs (name) VALUES ($1) RETURNING *',
      [`Adv Analytics Team 2 ${uniqueId}`]
    );
    club2 = club2Result.rows[0];

    // Create test players
    const player1Result = await db.query(
      `INSERT INTO players (club_id, first_name, last_name, jersey_number) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [club1.id, 'Alice', `AdvPlayer${uniqueId}`, 10]
    );
    player1 = player1Result.rows[0];

    const player2Result = await db.query(
      `INSERT INTO players (club_id, first_name, last_name, jersey_number) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [club1.id, 'Bob', `AdvPlayer${uniqueId}`, 11]
    );
    player2 = player2Result.rows[0];

    const player3Result = await db.query(
      `INSERT INTO players (club_id, first_name, last_name, jersey_number) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [club2.id, 'Charlie', `AdvPlayer${uniqueId}`, 20]
    );
    player3 = player3Result.rows[0];

    // Create games for analytics
    const game1Result = await db.query(
      `INSERT INTO games (home_club_id, away_club_id, date, status, home_score, away_score, current_period)
       VALUES ($1, $2, CURRENT_TIMESTAMP - INTERVAL '7 days', 'completed', 15, 12, 4) RETURNING *`,
      [club1.id, club2.id]
    );
    game1 = game1Result.rows[0];

    const game2Result = await db.query(
      `INSERT INTO games (home_club_id, away_club_id, date, status, home_score, away_score, current_period)
       VALUES ($1, $2, CURRENT_TIMESTAMP - INTERVAL '3 days', 'completed', 18, 14, 4) RETURNING *`,
      [club1.id, club2.id]
    );
    game2 = game2Result.rows[0];

    // Create a third game for form trends (needs 3+ games)
    const game3Result = await db.query(
      `INSERT INTO games (home_club_id, away_club_id, date, status, home_score, away_score, current_period)
       VALUES ($1, $2, CURRENT_TIMESTAMP - INTERVAL '1 day', 'completed', 20, 16, 4) RETURNING *`,
      [club1.id, club2.id]
    );
    const game3 = game3Result.rows[0];

    // Create diverse shot data for player1 across games
    // Game 1: 8 shots, 5 goals (62.5% FG)
    const game1Shots = [
      { x: 10, y: 50, result: 'goal', game: game1.id, player: player1.id, team: club1.id, distance: 5.5, period: 1 },
      { x: 15, y: 45, result: 'goal', game: game1.id, player: player1.id, team: club1.id, distance: 6.0, period: 1 },
      { x: 20, y: 55, result: 'miss', game: game1.id, player: player1.id, team: club1.id, distance: 7.0, period: 2 },
      { x: 25, y: 50, result: 'goal', game: game1.id, player: player1.id, team: club1.id, distance: 5.0, period: 2 },
      { x: 40, y: 50, result: 'goal', game: game1.id, player: player1.id, team: club1.id, distance: 4.0, period: 3 },
      { x: 50, y: 50, result: 'miss', game: game1.id, player: player1.id, team: club1.id, distance: 3.5, period: 3 },
      { x: 60, y: 50, result: 'goal', game: game1.id, player: player1.id, team: club1.id, distance: 4.5, period: 4 },
      { x: 70, y: 50, result: 'miss', game: game1.id, player: player1.id, team: club1.id, distance: 6.5, period: 4 },
    ];

    // Game 2: 10 shots, 7 goals (70% FG) - showing improvement
    const game2Shots = [
      { x: 10, y: 50, result: 'goal', game: game2.id, player: player1.id, team: club1.id, distance: 5.5, period: 1 },
      { x: 15, y: 45, result: 'goal', game: game2.id, player: player1.id, team: club1.id, distance: 6.0, period: 1 },
      { x: 20, y: 55, result: 'goal', game: game2.id, player: player1.id, team: club1.id, distance: 7.0, period: 1 },
      { x: 25, y: 50, result: 'miss', game: game2.id, player: player1.id, team: club1.id, distance: 5.0, period: 2 },
      { x: 40, y: 50, result: 'goal', game: game2.id, player: player1.id, team: club1.id, distance: 4.0, period: 2 },
      { x: 50, y: 50, result: 'goal', game: game2.id, player: player1.id, team: club1.id, distance: 3.5, period: 3 },
      { x: 60, y: 50, result: 'goal', game: game2.id, player: player1.id, team: club1.id, distance: 4.5, period: 3 },
      { x: 70, y: 50, result: 'miss', game: game2.id, player: player1.id, team: club1.id, distance: 6.5, period: 4 },
      { x: 80, y: 50, result: 'goal', game: game2.id, player: player1.id, team: club1.id, distance: 8.0, period: 4 },
      { x: 90, y: 50, result: 'miss', game: game2.id, player: player1.id, team: club1.id, distance: 9.0, period: 4 },
    ];

    // Game 3: 12 shots, 9 goals (75% FG) - continuing improvement trend
    const game3Shots = [
      { x: 10, y: 50, result: 'goal', game: game3.id, player: player1.id, team: club1.id, distance: 5.5, period: 1 },
      { x: 15, y: 45, result: 'goal', game: game3.id, player: player1.id, team: club1.id, distance: 6.0, period: 1 },
      { x: 20, y: 55, result: 'goal', game: game3.id, player: player1.id, team: club1.id, distance: 7.0, period: 1 },
      { x: 25, y: 50, result: 'goal', game: game3.id, player: player1.id, team: club1.id, distance: 5.0, period: 1 },
      { x: 30, y: 50, result: 'miss', game: game3.id, player: player1.id, team: club1.id, distance: 4.5, period: 2 },
      { x: 40, y: 50, result: 'goal', game: game3.id, player: player1.id, team: club1.id, distance: 4.0, period: 2 },
      { x: 50, y: 50, result: 'goal', game: game3.id, player: player1.id, team: club1.id, distance: 3.5, period: 2 },
      { x: 60, y: 50, result: 'goal', game: game3.id, player: player1.id, team: club1.id, distance: 4.5, period: 3 },
      { x: 70, y: 50, result: 'goal', game: game3.id, player: player1.id, team: club1.id, distance: 6.5, period: 3 },
      { x: 80, y: 50, result: 'miss', game: game3.id, player: player1.id, team: club1.id, distance: 8.0, period: 4 },
      { x: 85, y: 50, result: 'goal', game: game3.id, player: player1.id, team: club1.id, distance: 7.0, period: 4 },
      { x: 90, y: 50, result: 'miss', game: game3.id, player: player1.id, team: club1.id, distance: 9.0, period: 4 },
    ];

    // Player 2 shots
    const player2Shots = [
      { x: 30, y: 40, result: 'goal', game: game1.id, player: player2.id, team: club1.id, distance: 5.0, period: 1 },
      { x: 45, y: 60, result: 'goal', game: game1.id, player: player2.id, team: club1.id, distance: 4.0, period: 2 },
      { x: 55, y: 55, result: 'miss', game: game1.id, player: player2.id, team: club1.id, distance: 5.5, period: 3 },
      { x: 65, y: 45, result: 'blocked', game: game1.id, player: player2.id, team: club1.id, distance: 6.0, period: 4 },
    ];

    // Player 3 shots (opponent)
    const player3Shots = [
      { x: 20, y: 30, result: 'goal', game: game1.id, player: player3.id, team: club2.id, distance: 5.5, period: 1 },
      { x: 40, y: 40, result: 'miss', game: game1.id, player: player3.id, team: club2.id, distance: 6.0, period: 2 },
      { x: 60, y: 50, result: 'goal', game: game1.id, player: player3.id, team: club2.id, distance: 4.5, period: 3 },
    ];

    const allShots = [...game1Shots, ...game2Shots, ...game3Shots, ...player2Shots, ...player3Shots];

    for (const shot of allShots) {
      const result = await db.query(
        `INSERT INTO shots (game_id, player_id, club_id, x_coord, y_coord, result, distance, period, time_remaining, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '00:05:00', CURRENT_TIMESTAMP) RETURNING *`,
        [shot.game, shot.player, shot.team, shot.x, shot.y, shot.result, shot.distance, shot.period]
      );
      shots.push(result.rows[0]);
    }

    // Create game rosters for play time calculations
    await db.query(
      `INSERT INTO game_rosters (game_id, club_id, player_id, is_starting, starting_position)
       VALUES ($1, $2, $3, true, 'offense')`,
      [game1.id, club1.id, player1.id]
    );

    await db.query(
      `INSERT INTO game_rosters (game_id, club_id, player_id, is_starting, starting_position)
       VALUES ($1, $2, $3, true, 'offense')`,
      [game2.id, club1.id, player1.id]
    );

    await db.query(
      `INSERT INTO game_rosters (game_id, club_id, player_id, is_starting, starting_position)
       VALUES ($1, $2, $3, true, 'offense')`,
      [game3.id, club1.id, player1.id]
    );

    console.log('✅ Advanced Analytics test setup complete');
  });

  afterAll(async () => {
    // Cleanup is handled by test database teardown
    console.log('🧹 Advanced Analytics test cleanup complete');
  });

  describe('📈 Performance Predictions', () => {
    describe('GET /api/advanced-analytics/predictions/form-trends/:playerId', () => {
      it('✅ should analyze player form trends with sufficient data', async () => {
        const response = await request(app)
          .get(`/api/advanced-analytics/predictions/form-trends/${player1.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('player_id', player1.id);
        expect(response.body).toHaveProperty('form_trend');
        expect(response.body).toHaveProperty('trend_change');
        expect(response.body).toHaveProperty('recent_avg_fg');
        expect(response.body).toHaveProperty('overall_avg_fg');
        expect(response.body).toHaveProperty('volatility');
        expect(response.body).toHaveProperty('consistency_rating');
        expect(response.body).toHaveProperty('games_analyzed');
        expect(response.body.games_analyzed).toBeGreaterThanOrEqual(2);
      });

      it('❌ should return insufficient data message for player with few games', async () => {
        const response = await request(app)
          .get(`/api/advanced-analytics/predictions/form-trends/${player2.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('form_trend', 'insufficient_data');
        expect(response.body).toHaveProperty('message');
      });

      it('❌ should require authentication', async () => {
        const response = await request(app)
          .get(`/api/advanced-analytics/predictions/form-trends/${player1.id}`)
          .expect(401);
        
        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/advanced-analytics/predictions/fatigue/:playerId', () => {
      it('✅ should analyze player fatigue indicators', async () => {
        const response = await request(app)
          .get(`/api/advanced-analytics/predictions/fatigue/${player1.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('player_id', player1.id);
        expect(response.body).toHaveProperty('games_analyzed');
        expect(response.body).toHaveProperty('fatigue_analysis');
        expect(Array.isArray(response.body.fatigue_analysis)).toBe(true);
        
        if (response.body.fatigue_analysis.length > 0) {
          const analysis = response.body.fatigue_analysis[0];
          expect(analysis).toHaveProperty('game_id');
          expect(analysis).toHaveProperty('play_time_seconds');
          expect(analysis).toHaveProperty('fatigue_level');
          expect(analysis).toHaveProperty('period_performance');
        }
      });

      it('✅ should analyze fatigue for specific game', async () => {
        const response = await request(app)
          .get(`/api/advanced-analytics/predictions/fatigue/${player1.id}`)
          .query({ game_id: game1.id })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('player_id', player1.id);
        expect(response.body.fatigue_analysis).toHaveLength(1);
        expect(response.body.fatigue_analysis[0].game_id).toBe(game1.id);
      });
    });

    describe('GET /api/advanced-analytics/predictions/next-game/:playerId', () => {
      it('✅ should generate next game prediction', async () => {
        const response = await request(app)
          .get(`/api/advanced-analytics/predictions/next-game/${player1.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('player_id', player1.id);
        expect(response.body).toHaveProperty('predicted_fg_percentage');
        expect(response.body).toHaveProperty('predicted_shots');
        expect(response.body).toHaveProperty('predicted_goals');
        expect(response.body).toHaveProperty('confidence_score');
        expect(response.body).toHaveProperty('form_trend');
        expect(response.body).toHaveProperty('historical_avg');
        expect(response.body.predicted_fg_percentage).toBeGreaterThanOrEqual(0);
        expect(response.body.predicted_fg_percentage).toBeLessThanOrEqual(100);
      });

      it('✅ should adjust prediction based on opponent', async () => {
        const response = await request(app)
          .get(`/api/advanced-analytics/predictions/next-game/${player1.id}`)
          .query({ opponent_id: club2.id })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('opponent_id', club2.id);
        expect(response.body.adjustments).toHaveProperty('matchup_adjustment');
      });
    });
  });

  describe('📊 Benchmarking', () => {
    describe('GET /api/advanced-analytics/benchmarks/league-averages', () => {
      it('✅ should calculate league averages', async () => {
        const response = await request(app)
          .get('/api/advanced-analytics/benchmarks/league-averages')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('league_averages');
        expect(response.body.league_averages).toHaveProperty('total_games');
        expect(response.body.league_averages).toHaveProperty('total_players');
        expect(response.body.league_averages).toHaveProperty('avg_shots_per_game');
        expect(response.body.league_averages).toHaveProperty('avg_goals_per_game');
        expect(response.body.league_averages).toHaveProperty('avg_fg_percentage');
      });

      it('✅ should filter by position when specified', async () => {
        const response = await request(app)
          .get('/api/advanced-analytics/benchmarks/league-averages')
          .query({ position: 'offense' })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.position).toBe('offense');
        expect(response.body).toHaveProperty('position_averages');
      });
    });

    describe('GET /api/advanced-analytics/benchmarks/player-comparison/:playerId', () => {
      it('✅ should compare player to league averages', async () => {
        const response = await request(app)
          .get(`/api/advanced-analytics/benchmarks/player-comparison/${player1.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('player_id', player1.id);
        expect(response.body).toHaveProperty('player_stats');
        expect(response.body).toHaveProperty('league_averages');
        expect(response.body).toHaveProperty('comparison');
        expect(response.body.comparison).toHaveProperty('shots_vs_league');
        expect(response.body.comparison).toHaveProperty('fg_vs_league');
      });

      it('❌ should handle player with no data', async () => {
        // Create player with no shots
        const noDataPlayer = await db.query(
          `INSERT INTO players (club_id, first_name, last_name, jersey_number) 
           VALUES ($1, 'NoData', 'Player', 99) RETURNING *`,
          [club1.id]
        );

        const response = await request(app)
          .get(`/api/advanced-analytics/benchmarks/player-comparison/${noDataPlayer.rows[0].id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('message');
      });
    });

    describe('GET /api/advanced-analytics/benchmarks/historical/:entityType/:entityId', () => {
      it('✅ should fetch historical performance for player', async () => {
        const response = await request(app)
          .get(`/api/advanced-analytics/benchmarks/historical/player/${player1.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('entity_type', 'player');
        expect(response.body).toHaveProperty('entity_id', player1.id);
        expect(response.body).toHaveProperty('historical_benchmarks');
        expect(Array.isArray(response.body.historical_benchmarks)).toBe(true);
      });

      it('✅ should fetch historical performance for team', async () => {
        const response = await request(app)
          .get(`/api/advanced-analytics/benchmarks/historical/team/${club1.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('entity_type', 'team');
        expect(response.body).toHaveProperty('entity_id', club1.id);
      });

      it('❌ should validate entity type', async () => {
        const response = await request(app)
          .get(`/api/advanced-analytics/benchmarks/historical/invalid/${player1.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      });
    });
  });

  describe('🎥 Video Integration', () => {
    describe('POST /api/advanced-analytics/video/link-event', () => {
      it('✅ should link event to video timestamp (coach)', async () => {
        const response = await request(app)
          .post('/api/advanced-analytics/video/link-event')
          .set('Authorization', `Bearer ${coachToken}`)
          .send({
            game_id: game1.id,
            event_type: 'goal',
            event_id: shots[0].id,
            video_url: 'https://example.com/game1.mp4',
            timestamp_start: 120,
            timestamp_end: 130,
            description: 'Amazing goal by Alice',
            is_highlight: true,
            tags: ['goal', 'highlight', 'team1']
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('game_id', game1.id);
        expect(response.body).toHaveProperty('event_type', 'goal');
        expect(response.body).toHaveProperty('timestamp_start', 120);
        expect(response.body).toHaveProperty('is_highlight', true);
      });

      it('✅ should allow admin to link events', async () => {
        const response = await request(app)
          .post('/api/advanced-analytics/video/link-event')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            game_id: game1.id,
            event_type: 'shot',
            timestamp_start: 60
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
      });

      it('❌ should deny regular users', async () => {
        const response = await request(app)
          .post('/api/advanced-analytics/video/link-event')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            game_id: game1.id,
            event_type: 'goal',
            timestamp_start: 120
          })
          .expect(403);
        
        expect(response.body).toHaveProperty('error');
      });

      it('❌ should validate required fields', async () => {
        const response = await request(app)
          .post('/api/advanced-analytics/video/link-event')
          .set('Authorization', `Bearer ${coachToken}`)
          .send({
            game_id: game1.id
            // Missing event_type and timestamp_start
          })
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      });
    });

    describe('GET /api/advanced-analytics/video/game/:gameId', () => {
      it('✅ should get all video events for game', async () => {
        const response = await request(app)
          .get(`/api/advanced-analytics/video/game/${game1.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      it('✅ should filter by event type', async () => {
        const response = await request(app)
          .get(`/api/advanced-analytics/video/game/${game1.id}`)
          .query({ event_type: 'goal' })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      it('✅ should filter highlights only', async () => {
        const response = await request(app)
          .get(`/api/advanced-analytics/video/game/${game1.id}`)
          .query({ highlights_only: true })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('GET /api/advanced-analytics/video/highlights/:gameId', () => {
      it('✅ should generate highlight reel metadata', async () => {
        const response = await request(app)
          .get(`/api/advanced-analytics/video/highlights/${game1.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('game_id', game1.id);
        expect(response.body).toHaveProperty('total_clips');
        expect(response.body).toHaveProperty('marked_highlights');
        expect(response.body).toHaveProperty('auto_identified_highlights');
        expect(response.body).toHaveProperty('reel_metadata');
        expect(Array.isArray(response.body.marked_highlights)).toBe(true);
        expect(Array.isArray(response.body.auto_identified_highlights)).toBe(true);
      });

      it('✅ should limit max clips', async () => {
        const response = await request(app)
          .get(`/api/advanced-analytics/video/highlights/${game1.id}`)
          .query({ max_clips: 5 })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.total_clips).toBeLessThanOrEqual(5);
      });
    });

    describe('GET /api/advanced-analytics/video/report-data/:gameId', () => {
      it('✅ should get video-tagged events for PDF report', async () => {
        const response = await request(app)
          .get(`/api/advanced-analytics/video/report-data/${game1.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('game_id', game1.id);
        expect(response.body).toHaveProperty('video_events');
        expect(response.body).toHaveProperty('report_metadata');
        expect(Array.isArray(response.body.video_events)).toBe(true);
        expect(response.body.report_metadata).toHaveProperty('total_tagged_events');
        expect(response.body.report_metadata).toHaveProperty('highlights_count');
      });
    });
  });

  describe('🔒 Security & Validation', () => {
    it('❌ should validate integer parameters', async () => {
      const response = await request(app)
        .get('/api/advanced-analytics/predictions/form-trends/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    it('❌ should validate query parameters', async () => {
      const response = await request(app)
        .get(`/api/advanced-analytics/predictions/form-trends/${player1.id}`)
        .query({ games: 'invalid' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    it('❌ should require authentication for all endpoints', async () => {
      const res1 = await request(app)
        .get(`/api/advanced-analytics/predictions/form-trends/${player1.id}`)
        .expect(401);
      expect(res1.body).toHaveProperty('error');

      const res2 = await request(app)
        .get('/api/advanced-analytics/benchmarks/league-averages')
        .expect(401);
      expect(res2.body).toHaveProperty('error');

      const res3 = await request(app)
        .get(`/api/advanced-analytics/video/game/${game1.id}`)
        .expect(401);
      expect(res3.body).toHaveProperty('error');
    });
  });
});


