import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import db from '../src/db.js';

// Helper to create JWT with default secret fallback
const signToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET || 'test_jwt_secret_key_min_32_chars_long_for_testing');

describe('👥 Trainer assignments guard access', () => {
  const uniqueId = `trainer_${Date.now()}`;
  let admin;
  let coachAssigned;
  let coachUnassigned;
  let _adminToken;
  let assignedToken;
  let unassignedToken;
  let club1;
  let club2;
  let team1;
  let playerClub1;
  let playerClub2;

  beforeAll(async () => {
    admin = (await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1,$2,\'hash\',\'admin\') RETURNING *',
      [`admin_${uniqueId}`, `admin_${uniqueId}@test.com`]
    )).rows[0];
    coachAssigned = (await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1,$2,\'hash\',\'coach\') RETURNING *',
      [`coach_a_${uniqueId}`, `coach_a_${uniqueId}@test.com`]
    )).rows[0];
    coachUnassigned = (await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1,$2,\'hash\',\'coach\') RETURNING *',
      [`coach_u_${uniqueId}`, `coach_u_${uniqueId}@test.com`]
    )).rows[0];

    _adminToken = signToken({ userId: admin.id, role: 'admin' });
    assignedToken = signToken({ userId: coachAssigned.id, role: 'coach' });
    unassignedToken = signToken({ userId: coachUnassigned.id, role: 'coach' });

    club1 = (await db.query('INSERT INTO clubs (name) VALUES ($1) RETURNING *', [`Club A ${uniqueId}`])).rows[0];
    club2 = (await db.query('INSERT INTO clubs (name) VALUES ($1) RETURNING *', [`Club B ${uniqueId}`])).rows[0];

    // assign coachAssigned to club1
    await db.query(
      'INSERT INTO trainer_assignments (user_id, club_id, is_active) VALUES ($1, $2, true)',
      [coachAssigned.id, club1.id]
    );

    team1 = (await db.query(
      'INSERT INTO teams (club_id, name) VALUES ($1, $2) RETURNING *',
      [club1.id, `Team A ${uniqueId}`]
    )).rows[0];

    playerClub1 = (await db.query(
      'INSERT INTO players (club_id, team_id, first_name, last_name, jersey_number) VALUES ($1,$2,\'P\',\'One\',7) RETURNING *',
      [club1.id, team1.id]
    )).rows[0];

    playerClub2 = (await db.query(
      'INSERT INTO players (club_id, first_name, last_name, jersey_number) VALUES ($1,\'Q\',\'Two\',8) RETURNING *',
      [club2.id]
    )).rows[0];
  });

  afterAll(async () => {
    await db.query('DELETE FROM game_rosters WHERE game_id IN (SELECT id FROM games WHERE home_club_id = $1 OR away_club_id = $1 OR home_club_id = $2 OR away_club_id = $2)', [club1.id, club2.id]);
    await db.query('DELETE FROM games WHERE home_club_id = $1 OR away_club_id = $1 OR home_club_id = $2 OR away_club_id = $2', [club1.id, club2.id]);
    await db.query('DELETE FROM trainer_assignments WHERE user_id IN ($1,$2)', [coachAssigned.id, coachUnassigned.id]);
    await db.query('DELETE FROM players WHERE id IN ($1,$2)', [playerClub1.id, playerClub2.id]);
    await db.query('DELETE FROM teams WHERE id = $1', [team1.id]);
    await db.query('DELETE FROM clubs WHERE id IN ($1,$2)', [club1.id, club2.id]);
    await db.query('DELETE FROM users WHERE id IN ($1,$2,$3)', [admin.id, coachAssigned.id, coachUnassigned.id]);
  });

  it('blocks unassigned coach from creating a team', async () => {
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${unassignedToken}`)
      .send({ club_id: club2.id, name: `Blocked Team ${uniqueId}` });

    expect(res.status).toBe(403);
  });

  it('allows assigned coach to create a team in their club', async () => {
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${assignedToken}`)
      .send({ club_id: club1.id, name: `Allowed Team ${uniqueId}` });

    expect(res.status).toBe(201);
  });

  it('blocks unassigned coach from creating a player for another club', async () => {
    const res = await request(app)
      .post('/api/players')
      .set('Authorization', `Bearer ${unassignedToken}`)
      .send({ club_id: club2.id, first_name: 'Xa', last_name: 'Ya', jersey_number: 12 });

    expect(res.status).toBe(403);
  });

  it('allows assigned coach to create a player for their club', async () => {
    const res = await request(app)
      .post('/api/players')
      .set('Authorization', `Bearer ${assignedToken}`)
      .send({ club_id: club1.id, team_id: team1.id, first_name: 'New', last_name: 'Player', jersey_number: 15 });

    expect(res.status).toBe(201);
  });

  it('blocks unassigned coach from creating a game', async () => {
    const res = await request(app)
      .post('/api/games')
      .set('Authorization', `Bearer ${unassignedToken}`)
      .send({ home_club_id: club1.id, away_club_id: club2.id, date: new Date().toISOString() });

    expect(res.status).toBe(403);
  });

  it('allows assigned coach to create a game involving their club', async () => {
    const res = await request(app)
      .post('/api/games')
      .set('Authorization', `Bearer ${assignedToken}`)
      .send({ home_club_id: club1.id, away_club_id: club2.id, date: new Date().toISOString() });

    expect(res.status).toBe(201);
  });

  it('blocks roster updates for clubs without assignment and allows for assigned club', async () => {
    // Create game as admin so it exists
    const game = (await db.query(
      'INSERT INTO games (home_club_id, away_club_id, date, status) VALUES ($1,$2,CURRENT_TIMESTAMP,\'scheduled\') RETURNING *',
      [club1.id, club2.id]
    )).rows[0];

    // Attempt to roster player from unassigned club2 by assigned coach (should fail)
    const resBlocked = await request(app)
      .post(`/api/game-rosters/${game.id}`)
      .set('Authorization', `Bearer ${assignedToken}`)
      .send({
        players: [
          { club_id: club2.id, player_id: playerClub2.id, is_captain: true }
        ]
      });
    expect(resBlocked.status).toBe(403);

    // Roster player from assigned club1 (should succeed)
    const resAllowed = await request(app)
      .post(`/api/game-rosters/${game.id}`)
      .set('Authorization', `Bearer ${assignedToken}`)
      .send({
        players: [
          { club_id: club1.id, player_id: playerClub1.id, is_captain: true }
        ]
      });
    expect(resAllowed.status).toBe(201);
    expect(Array.isArray(resAllowed.body.roster)).toBe(true);
  });
});
