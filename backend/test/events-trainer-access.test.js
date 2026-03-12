import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

describe('🎯 Events API - Trainer Access Control', () => {
  let adminToken, coachAssignedToken, coachUnassignedToken;
  let adminUser, coachAssigned, coachUnassigned;
  let club1, club2, player1, game;
  const uniqueId = `evtaccess_${Date.now()}`;

  beforeAll(async () => {
    console.log('🔧 Setting up Events Trainer Access tests...');

    // Create admin user
    adminUser = (await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [`admin_${uniqueId}`, `admin_${uniqueId}@test.com`, 'hash', 'admin']
    )).rows[0];

    // Create coach WITH trainer assignment
    coachAssigned = (await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [`coach_assigned_${uniqueId}`, `coach_assigned_${uniqueId}@test.com`, 'hash', 'coach']
    )).rows[0];

    // Create coach WITHOUT trainer assignment
    coachUnassigned = (await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [`coach_unassigned_${uniqueId}`, `coach_unassigned_${uniqueId}@test.com`, 'hash', 'coach']
    )).rows[0];

    // Create tokens
    const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_key_min_32_chars_long_for_testing';
    adminToken = jwt.sign({ userId: adminUser.id, role: 'admin' }, jwtSecret);
    coachAssignedToken = jwt.sign({ userId: coachAssigned.id, role: 'coach' }, jwtSecret);
    coachUnassignedToken = jwt.sign({ userId: coachUnassigned.id, role: 'coach' }, jwtSecret);

    // Create clubs
    club1 = (await db.query('INSERT INTO clubs (name) VALUES ($1) RETURNING *', [`Club A ${uniqueId}`])).rows[0];
    club2 = (await db.query('INSERT INTO clubs (name) VALUES ($1) RETURNING *', [`Club B ${uniqueId}`])).rows[0];

    // Assign coach to club1 only
    await db.query(
      'INSERT INTO trainer_assignments (user_id, club_id, is_active) VALUES ($1, $2, $3)',
      [coachAssigned.id, club1.id, true]
    );

    // Create player
    player1 = (await db.query(
      'INSERT INTO players (club_id, first_name, last_name, jersey_number) VALUES ($1, $2, $3, $4) RETURNING *',
      [club1.id, 'Test', 'Player', 10]
    )).rows[0];

    // Create in-progress game
    game = (await db.query(
      'INSERT INTO games (home_club_id, away_club_id, date, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [club1.id, club2.id, new Date(), 'in_progress']
    )).rows[0];
  });

  afterAll(async () => {
    console.log('✅ Events Trainer Access tests completed');
    await db.query('DELETE FROM game_events WHERE game_id = $1', [game.id]);
    await db.query('DELETE FROM games WHERE id = $1', [game.id]);
    await db.query('DELETE FROM players WHERE id = $1', [player1.id]);
    await db.query('DELETE FROM trainer_assignments WHERE user_id IN ($1, $2)', [coachAssigned.id, coachUnassigned.id]);
    await db.query('DELETE FROM clubs WHERE id IN ($1, $2)', [club1.id, club2.id]);
    await db.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [adminUser.id, coachAssigned.id, coachUnassigned.id]);
  });

  beforeEach(async () => {
    // Clean events before each test
    await db.query('DELETE FROM game_events WHERE game_id = $1', [game.id]);
  });

  describe('📝 POST /api/events/:gameId - Trainer Access', () => {
    it('✅ should allow admin to create events', async () => {
      const response = await request(app)
        .post(`/api/events/${game.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          event_type: 'foul',
          player_id: player1.id,
          club_id: club1.id,
          period: 1
        });

      expect(response.status).toBe(201);
      expect(response.body.event_type).toBe('foul');
    });

    it('✅ should allow coach with trainer assignment to create events', async () => {
      const response = await request(app)
        .post(`/api/events/${game.id}`)
        .set('Authorization', `Bearer ${coachAssignedToken}`)
        .send({
          event_type: 'foul',
          player_id: player1.id,
          club_id: club1.id,
          period: 1
        });

      expect(response.status).toBe(201);
      expect(response.body.event_type).toBe('foul');
    });

    it('❌ should reject coach without trainer assignment', async () => {
      const response = await request(app)
        .post(`/api/events/${game.id}`)
        .set('Authorization', `Bearer ${coachUnassignedToken}`)
        .send({
          event_type: 'foul',
          player_id: player1.id,
          club_id: club1.id,
          period: 1
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('trainer');
    });
  });

  describe('✏️ PUT /api/events/:gameId/:eventId - Trainer Access', () => {
    let eventId;

    beforeEach(async () => {
      // Create event as admin
      const event = await db.query(
        'INSERT INTO game_events (game_id, event_type, club_id, player_id, period) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [game.id, 'foul', club1.id, player1.id, 1]
      );
      eventId = event.rows[0].id;
    });

    it('✅ should allow coach with trainer assignment to update events', async () => {
      const response = await request(app)
        .put(`/api/events/${game.id}/${eventId}`)
        .set('Authorization', `Bearer ${coachAssignedToken}`)
        .send({
          period: 2
        });

      expect(response.status).toBe(200);
      expect(response.body.period).toBe(2);
    });

    it('❌ should reject coach without trainer assignment from updating', async () => {
      const response = await request(app)
        .put(`/api/events/${game.id}/${eventId}`)
        .set('Authorization', `Bearer ${coachUnassignedToken}`)
        .send({
          period: 2
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('trainer');
    });
  });

  describe('🗑️ DELETE /api/events/:gameId/:eventId - Trainer Access', () => {
    let eventId;

    beforeEach(async () => {
      // Create event as admin
      const event = await db.query(
        'INSERT INTO game_events (game_id, event_type, club_id, player_id, period) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [game.id, 'foul', club1.id, player1.id, 1]
      );
      eventId = event.rows[0].id;
    });

    it('✅ should allow coach with trainer assignment to delete events', async () => {
      const response = await request(app)
        .delete(`/api/events/${game.id}/${eventId}`)
        .set('Authorization', `Bearer ${coachAssignedToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');
    });

    it('❌ should reject coach without trainer assignment from deleting', async () => {
      const response = await request(app)
        .delete(`/api/events/${game.id}/${eventId}`)
        .set('Authorization', `Bearer ${coachUnassignedToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('trainer');
    });
  });
});
