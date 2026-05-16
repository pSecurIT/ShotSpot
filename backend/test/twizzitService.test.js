import db from '../src/db.js';
import {
  syncClubs,
  syncPlayers,
  syncSeasons,
  verifyTwizzitConnection,
  __setTwizzitClientForTests,
  __resetTwizzitClientForTests
} from '../src/services/twizzitService.js';

describe('🔄 Twizzit Service Persistence', () => {
  let suffix;
  let mockGroupId;
  let clubName;
  let playerFirstName;
  let playerLastName;
  let seasonName;

  beforeEach(() => {
    suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    mockGroupId = `twizzit-group-${suffix}`;
    clubName = `Twizzit Club ${suffix}`;
    playerFirstName = `First${suffix}`;
    playerLastName = `Last${suffix}`;
    seasonName = `Season ${suffix}`;

    __setTwizzitClientForTests({
      async getGroups() {
        return {
          groups: [
            {
              id: mockGroupId,
              name: clubName,
              description: 'Synced from Twizzit'
            }
          ]
        };
      },
      async getGroupContacts() {
        return {
          contacts: [
            {
              id: `twizzit-player-${suffix}`,
              first_name: playerFirstName,
              last_name: playerLastName,
              email: `${suffix}@example.com`,
              gender: 'male'
            }
          ]
        };
      },
      async getSeasons() {
        return {
          seasons: [
            {
              id: `twizzit-season-${suffix}`,
              name: seasonName,
              start_date: '2025-09-01',
              end_date: '2026-06-30'
            }
          ]
        };
      },
      async verifyConnection() {
        return true;
      }
    });
  });

  afterEach(async () => {
    try {
      await db.query('DELETE FROM twizzit_player_mappings WHERE twizzit_player_id = $1', [`twizzit-player-${suffix}`]);
      await db.query('DELETE FROM twizzit_team_mappings WHERE twizzit_team_id = $1', [mockGroupId]);
      await db.query('DELETE FROM players WHERE first_name = $1 AND last_name = $2', [playerFirstName, playerLastName]);
      await db.query('DELETE FROM seasons WHERE name = $1', [seasonName]);
      await db.query('DELETE FROM clubs WHERE name = $1', [clubName]);
    } finally {
      __resetTwizzitClientForTests();
    }
  });

  it('✅ syncClubs persists clubs and team mappings', async () => {
    const synced = await syncClubs();

    expect(synced).toHaveLength(1);
    expect(synced[0].name).toBe(clubName);

    const clubRow = await db.query('SELECT id, name FROM clubs WHERE name = $1', [clubName]);
    expect(clubRow.rows).toHaveLength(1);

    const mappingRow = await db.query(
      'SELECT twizzit_team_id, twizzit_team_name, sync_status FROM twizzit_team_mappings WHERE twizzit_team_id = $1',
      [mockGroupId]
    );
    expect(mappingRow.rows).toHaveLength(1);
    expect(mappingRow.rows[0].twizzit_team_name).toBe(clubName);
    expect(mappingRow.rows[0].sync_status).toBe('synced');
  });

  it('✅ syncPlayers persists players and player mappings', async () => {
    await syncClubs();
    const syncedPlayers = await syncPlayers(mockGroupId);

    expect(syncedPlayers).toHaveLength(1);
    expect(syncedPlayers[0].firstName).toBe(playerFirstName);
    expect(syncedPlayers[0].lastName).toBe(playerLastName);

    const playerRow = await db.query(
      'SELECT id, first_name, last_name, is_twizzit_registered FROM players WHERE first_name = $1 AND last_name = $2',
      [playerFirstName, playerLastName]
    );
    expect(playerRow.rows).toHaveLength(1);
    expect(playerRow.rows[0].is_twizzit_registered).toBe(true);

    const mappingRow = await db.query(
      'SELECT twizzit_player_id, local_player_id, sync_status FROM twizzit_player_mappings WHERE twizzit_player_id = $1',
      [`twizzit-player-${suffix}`]
    );
    expect(mappingRow.rows).toHaveLength(1);
    expect(mappingRow.rows[0].local_player_id).toBe(playerRow.rows[0].id);
    expect(mappingRow.rows[0].sync_status).toBe('synced');
  });

  it('✅ syncSeasons persists seasons', async () => {
    const syncedSeasons = await syncSeasons();

    expect(syncedSeasons).toHaveLength(1);
    expect(syncedSeasons[0].name).toBe(seasonName);

    const seasonRow = await db.query(
      `SELECT id,
              name,
              to_char(start_date, 'YYYY-MM-DD') AS start_date_iso,
              to_char(end_date, 'YYYY-MM-DD') AS end_date_iso
       FROM seasons
       WHERE name = $1`,
      [seasonName]
    );
    expect(seasonRow.rows).toHaveLength(1);
    expect(seasonRow.rows[0].start_date_iso).toBe('2025-09-01');
    expect(seasonRow.rows[0].end_date_iso).toBe('2026-06-30');
  });

  it('✅ syncClubs falls back to a generated club name when Twizzit name is blank', async () => {
    const fallbackGroupId = `blank-group-${suffix}`;

    __setTwizzitClientForTests({
      async getGroups() {
        return { groups: [{ id: fallbackGroupId, name: '   ', description: '' }] };
      },
      async getGroupContacts() {
        return { contacts: [] };
      },
      async getSeasons() {
        return { seasons: [] };
      },
      async verifyConnection() {
        return true;
      }
    });

    const synced = await syncClubs();

    expect(synced[0].name).toBe(`Twizzit Club ${fallbackGroupId}`);

    await db.query('DELETE FROM twizzit_team_mappings WHERE twizzit_team_id = $1', [fallbackGroupId]);
    await db.query('DELETE FROM clubs WHERE name = $1', [`Twizzit Club ${fallbackGroupId}`]);
  });

  it('✅ syncPlayers updates an existing player and normalizes gender aliases', async () => {
    await syncClubs();

    const existingPlayer = await db.query(
      `INSERT INTO players (club_id, first_name, last_name, gender, is_twizzit_registered)
       VALUES ($1, $2, $3, $4, false)
       RETURNING id`,
      [null, playerFirstName, playerLastName, null]
    );

    __setTwizzitClientForTests({
      async getGroups() {
        return { groups: [{ id: mockGroupId, name: clubName, description: '' }] };
      },
      async getGroupContacts() {
        return {
          contacts: [{
            id: `twizzit-player-${suffix}`,
            first_name: playerFirstName,
            last_name: playerLastName,
            email: `${suffix}@example.com`,
            gender: 'F'
          }]
        };
      },
      async getSeasons() {
        return { seasons: [] };
      },
      async verifyConnection() {
        return true;
      }
    });

    const syncedPlayers = await syncPlayers(mockGroupId);
    expect(syncedPlayers[0].gender).toBe('female');

    const updatedPlayer = await db.query(
      'SELECT id, gender, is_twizzit_registered FROM players WHERE id = $1',
      [existingPlayer.rows[0].id]
    );

    expect(updatedPlayer.rows[0].gender).toBe('female');
    expect(updatedPlayer.rows[0].is_twizzit_registered).toBe(true);
  });

  it('✅ syncSeasons derives dates from season name when API dates are missing', async () => {
    const derivedSeasonName = `Competition 2030-2031 ${suffix}`;

    __setTwizzitClientForTests({
      async getGroups() {
        return { groups: [] };
      },
      async getGroupContacts() {
        return { contacts: [] };
      },
      async getSeasons() {
        return {
          seasons: [{ id: `derived-season-${suffix}`, name: derivedSeasonName, start_date: null, end_date: null }]
        };
      },
      async verifyConnection() {
        return true;
      }
    });

    const syncedSeasons = await syncSeasons();

    expect(syncedSeasons[0].startDate).toBe('2030-09-01');
    expect(syncedSeasons[0].endDate).toBe('2031-06-30');

    await db.query('DELETE FROM seasons WHERE name = $1', [derivedSeasonName]);
  });

  it('✅ verifyTwizzitConnection returns false when the client throws', async () => {
    __setTwizzitClientForTests({
      async getGroups() {
        return { groups: [] };
      },
      async getGroupContacts() {
        return { contacts: [] };
      },
      async getSeasons() {
        return { seasons: [] };
      },
      async verifyConnection() {
        throw new Error('connection failed');
      }
    });

    await expect(verifyTwizzitConnection()).resolves.toBe(false);
  });
});
