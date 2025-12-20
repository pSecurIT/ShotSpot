import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import db from '../src/db.js';

// Helper to create JWT with default secret fallback
const signToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET || 'test_jwt_secret_key_min_32_chars_long_for_testing');

describe('🔐 Twizzit Registration Enforcement', () => {
  const uniqueId = `twizzit_${Date.now()}`;
  let adminToken;
  let adminUser;
  let homeClub;
  let awayClub;
  let homeTeam;
  let officialCompetition;
  let officialGame;
  let friendlyGame;
  let registeredPlayer;
  let unregisteredPlayer;

  beforeAll(async () => {
    // Create admin user
    adminUser = (await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1,$2,\'hash\',\'admin\') RETURNING *',
      [`admin_${uniqueId}`, `admin_${uniqueId}@test.com`]
    )).rows[0];
    adminToken = signToken({ id: adminUser.id, role: 'admin' });

    // Create clubs
    homeClub = (await db.query('INSERT INTO clubs (name) VALUES ($1) RETURNING *', [`Home Club ${uniqueId}`])).rows[0];
    awayClub = (await db.query('INSERT INTO clubs (name) VALUES ($1) RETURNING *', [`Away Club ${uniqueId}`])).rows[0];

    // Create team
    homeTeam = (await db.query(
      'INSERT INTO teams (club_id, name, age_group) VALUES ($1, $2, $3) RETURNING *',
      [homeClub.id, `U17 ${uniqueId}`, 'U17']
    )).rows[0];

    // Create official competition
    officialCompetition = (await db.query(`
      INSERT INTO competitions (name, competition_type, start_date, season_id, is_official) 
      VALUES ($1, 'league', CURRENT_DATE, NULL, true) 
      RETURNING *
    `, [`KBKB League ${uniqueId}`])).rows[0];

    // Create official game linked to competition
    officialGame = (await db.query(`
      INSERT INTO games (home_club_id, away_club_id, competition_id, date, status)
      VALUES ($1, $2, $3, NOW(), 'scheduled')
      RETURNING *
    `, [homeClub.id, awayClub.id, officialCompetition.id])).rows[0];

    // Create friendly game (no competition)
    friendlyGame = (await db.query(`
      INSERT INTO games (home_club_id, away_club_id, date, status)
      VALUES ($1, $2, NOW(), 'scheduled')
      RETURNING *
    `, [homeClub.id, awayClub.id])).rows[0];

    // Create registered player with Twizzit mapping
    registeredPlayer = (await db.query(`
      INSERT INTO players (club_id, team_id, first_name, last_name, jersey_number, is_twizzit_registered)
      VALUES ($1, $2, 'Registered', 'Player', 10, true)
      RETURNING *
    `, [homeClub.id, homeTeam.id])).rows[0];

    await db.query(`
      INSERT INTO twizzit_player_mappings (local_player_id, twizzit_player_id, twizzit_player_name, sync_status)
      VALUES ($1, 'TW001', 'Registered Player', 'success')
    `, [registeredPlayer.id]);

    // Create unregistered player (no Twizzit mapping)
    unregisteredPlayer = (await db.query(`
      INSERT INTO players (club_id, team_id, first_name, last_name, jersey_number, is_twizzit_registered)
      VALUES ($1, $2, 'Unregistered', 'Player', 11, false)
      RETURNING *
    `, [homeClub.id, homeTeam.id])).rows[0];
  });

  afterAll(async () => {
    await db.query('DELETE FROM game_rosters WHERE game_id IN ($1, $2)', [officialGame.id, friendlyGame.id]);
    await db.query('DELETE FROM games WHERE id IN ($1, $2)', [officialGame.id, friendlyGame.id]);
    await db.query('DELETE FROM competition_teams WHERE competition_id = $1', [officialCompetition.id]);
    await db.query('DELETE FROM competitions WHERE id = $1', [officialCompetition.id]);
    await db.query('DELETE FROM twizzit_player_mappings WHERE local_player_id IN ($1, $2)', [registeredPlayer.id, unregisteredPlayer.id]);
    await db.query('DELETE FROM players WHERE id IN ($1, $2)', [registeredPlayer.id, unregisteredPlayer.id]);
    await db.query('DELETE FROM teams WHERE id = $1', [homeTeam.id]);
    await db.query('DELETE FROM clubs WHERE id IN ($1, $2)', [homeClub.id, awayClub.id]);
    await db.query('DELETE FROM users WHERE id = $1', [adminUser.id]);
  });

  describe('🎯 Player Creation with Twizzit Flag', () => {
    it('should create player with is_twizzit_registered=false by default', async () => {
      const res = await request(app)
        .post('/api/players')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          club_id: homeClub.id,
          team_id: homeTeam.id,
          first_name: 'New',
          last_name: 'Player',
          jersey_number: 20,
          gender: 'male'
        });

      expect(res.status).toBe(201);
      expect(res.body.is_twizzit_registered).toBe(false);
      expect(res.body._warning).toMatch(/Twizzit/i);
      expect(res.body._warning).toMatch(/registration/i);

      // Clean up
      await db.query('DELETE FROM players WHERE id = $1', [res.body.id]);
    });

    it('should return warning message about Twizzit registration', async () => {
      const res = await request(app)
        .post('/api/players')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          club_id: homeClub.id,
          first_name: 'Warning',
          last_name: 'Test',
          jersey_number: 21,
          gender: 'female'
        });

      expect(res.status).toBe(201);
      expect(res.body._warning).toBeDefined();
      expect(res.body._warning).toContain('KBKB');

      // Clean up
      await db.query('DELETE FROM players WHERE id = $1', [res.body.id]);
    });
  });

  describe('🏆 Official Match Roster Validation', () => {
    it('should BLOCK unregistered players in official matches', async () => {
      const res = await request(app)
        .post(`/api/game-rosters/${officialGame.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          players: [
            { club_id: homeClub.id, player_id: unregisteredPlayer.id, is_captain: false }
          ]
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/not eligible for this official match/i);
      expect(res.body.ineligiblePlayers).toHaveLength(1);
      expect(res.body.ineligiblePlayers[0].playerId).toBe(unregisteredPlayer.id);
      expect(res.body.ineligiblePlayers[0].reason).toMatch(/not registered in Twizzit/i);
    });

    it('should allow registered players in official matches', async () => {
      const res = await request(app)
        .post(`/api/game-rosters/${officialGame.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          players: [
            { club_id: homeClub.id, player_id: registeredPlayer.id, is_captain: true }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.roster).toBeDefined();
      expect(Array.isArray(res.body.roster)).toBe(true);
    });

    it('should allow unregistered players in friendly matches', async () => {
      const res = await request(app)
        .post(`/api/game-rosters/${friendlyGame.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          players: [
            { club_id: homeClub.id, player_id: unregisteredPlayer.id, is_captain: false }
          ]
        });

      expect(res.status).toBe(201);
    });

    it('should reject roster with mix of registered and unregistered players in official match', async () => {
      const res = await request(app)
        .post(`/api/game-rosters/${officialGame.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          players: [
            { club_id: homeClub.id, player_id: registeredPlayer.id, is_captain: true },
            { club_id: homeClub.id, player_id: unregisteredPlayer.id, is_captain: false }
          ]
        });

      expect(res.status).toBe(403);
      expect(res.body.ineligiblePlayers).toHaveLength(1);
      expect(res.body.ineligiblePlayers[0].playerId).toBe(unregisteredPlayer.id);
    });

    it('should return clear error message listing all ineligible players', async () => {
      const unregistered2 = (await db.query(`
        INSERT INTO players (club_id, team_id, first_name, last_name, jersey_number, is_twizzit_registered)
        VALUES ($1, $2, 'Another', 'Unregistered', 12, false)
        RETURNING *
      `, [homeClub.id, homeTeam.id])).rows[0];

      const res = await request(app)
        .post(`/api/game-rosters/${officialGame.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          players: [
            { club_id: homeClub.id, player_id: unregisteredPlayer.id, is_captain: false },
            { club_id: homeClub.id, player_id: unregistered2.id, is_captain: false }
          ]
        });

      expect(res.status).toBe(403);
      expect(res.body.ineligiblePlayers).toHaveLength(2);
      expect(res.body.details).toMatch(/KBKB/i);

      // Clean up
      await db.query('DELETE FROM players WHERE id = $1', [unregistered2.id]);
    });
  });

  describe('🔄 Twizzit Sync Integration', () => {
    it('should auto-update is_twizzit_registered when mapping is created via trigger', async () => {
      const player = (await db.query(`
        INSERT INTO players (club_id, team_id, first_name, last_name, jersey_number, is_twizzit_registered)
        VALUES ($1, $2, 'Sync', 'Test', 30, false)
        RETURNING *
      `, [homeClub.id, homeTeam.id])).rows[0];

      expect(player.is_twizzit_registered).toBe(false);

      // Simulate Twizzit sync creating mapping (trigger should auto-update flag)
      await db.query(`
        INSERT INTO twizzit_player_mappings (local_player_id, twizzit_player_id, twizzit_player_name, sync_status)
        VALUES ($1, 'TW999', 'Sync Test', 'success')
      `, [player.id]);

      // Check that trigger updated the flag
      const updated = (await db.query('SELECT * FROM players WHERE id = $1', [player.id])).rows[0];
      expect(updated.is_twizzit_registered).toBe(true);
      expect(updated.twizzit_verified_at).not.toBeNull();

      // Clean up
      await db.query('DELETE FROM twizzit_player_mappings WHERE local_player_id = $1', [player.id]);
      await db.query('DELETE FROM players WHERE id = $1', [player.id]);
    });

    it('should auto-update to false when Twizzit mapping is deleted via trigger', async () => {
      const player = (await db.query(`
        INSERT INTO players (club_id, team_id, first_name, last_name, jersey_number, is_twizzit_registered)
        VALUES ($1, $2, 'Mapped', 'Player', 31, true)
        RETURNING *
      `, [homeClub.id, homeTeam.id])).rows[0];

      const mapping = await db.query(`
        INSERT INTO twizzit_player_mappings (local_player_id, twizzit_player_id, twizzit_player_name)
        VALUES ($1, 'TW888', 'Mapped Player')
        RETURNING *
      `, [player.id]);

      // Delete mapping (simulates player removed from Twizzit)
      await db.query('DELETE FROM twizzit_player_mappings WHERE id = $1', [mapping.rows[0].id]);

      // Check that trigger updated the flag
      const updated = (await db.query('SELECT * FROM players WHERE id = $1', [player.id])).rows[0];
      expect(updated.is_twizzit_registered).toBe(false);
      expect(updated.twizzit_verified_at).toBeNull();

      // Clean up
      await db.query('DELETE FROM players WHERE id = $1', [player.id]);
    });
  });

  describe('🔍 Edge Cases', () => {
    it('should treat game without competition as friendly (allow unregistered)', async () => {
      const gameNoComp = (await db.query(`
        INSERT INTO games (home_club_id, away_club_id, date, status)
        VALUES ($1, $2, NOW(), 'scheduled')
        RETURNING *
      `, [homeClub.id, awayClub.id])).rows[0];

      const res = await request(app)
        .post(`/api/game-rosters/${gameNoComp.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          players: [
            { club_id: homeClub.id, player_id: unregisteredPlayer.id, is_captain: false }
          ]
        });

      expect(res.status).toBe(201);

      // Clean up
      await db.query('DELETE FROM game_rosters WHERE game_id = $1', [gameNoComp.id]);
      await db.query('DELETE FROM games WHERE id = $1', [gameNoComp.id]);
    });

    it('should treat competition with is_official=false as friendly', async () => {
      const friendlyComp = (await db.query(`
        INSERT INTO competitions (name, competition_type, start_date, is_official) 
        VALUES ($1, 'tournament', CURRENT_DATE, false) 
        RETURNING *
      `, [`Friendly Tournament ${uniqueId}`])).rows[0];

      const friendlyGameInComp = (await db.query(`
        INSERT INTO games (home_club_id, away_club_id, competition_id, date, status)
        VALUES ($1, $2, $3, NOW(), 'scheduled')
        RETURNING *
      `, [homeClub.id, awayClub.id, friendlyComp.id])).rows[0];

      const res = await request(app)
        .post(`/api/game-rosters/${friendlyGameInComp.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          players: [
            { club_id: homeClub.id, player_id: unregisteredPlayer.id, is_captain: false }
          ]
        });

      expect(res.status).toBe(201);

      // Clean up
      await db.query('DELETE FROM game_rosters WHERE game_id = $1', [friendlyGameInComp.id]);
      await db.query('DELETE FROM games WHERE id = $1', [friendlyGameInComp.id]);
      await db.query('DELETE FROM competitions WHERE id = $1', [friendlyComp.id]);
    });
  });
});
