import TwizzitApiClient from './twizzit-api-client.js';
import db from '../db.js';

import { logError } from '../utils/logger.js';

// Lazy client initialization to avoid import-time failures in tests
let twizzitClient = null;

function getTwizzitClient() {
  if (twizzitClient) return twizzitClient;
  if (process.env.NODE_ENV === 'test') {
    // Provide a lightweight stub in test to avoid external dependencies
    twizzitClient = {
      async getGroups() {
        return { groups: [{ id: 1, name: 'Club A', description: '' }] };
      },
      async getGroupContacts(clubId) {
        return { contacts: [{ id: 1, first_name: 'John', last_name: 'Doe', email: null, gender: null, club_id: clubId }] };
      },
      async getSeasons() {
        return { seasons: [{ id: 1, name: 'Season 2025', start_date: null, end_date: null }] };
      },
      async verifyConnection() {
        return true;
      }
    };
    return twizzitClient;
  }
  const config = {
    apiEndpoint: process.env.TWIZZIT_API_ENDPOINT || 'https://app.twizzit.com',
    username: process.env.TWIZZIT_API_USERNAME,
    password: process.env.TWIZZIT_API_PASSWORD,
    timeout: 30000,
  };
  // Let the client constructor validate credentials; callers catch errors.
  twizzitClient = new TwizzitApiClient(config);
  return twizzitClient;
}

function normalizeGender(gender) {
  if (!gender) return null;
  const value = String(gender).trim().toLowerCase();
  if (['male', 'm', 'man'].includes(value)) return 'male';
  if (['female', 'f', 'woman'].includes(value)) return 'female';
  return null;
}

function toDateOrNull(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function deriveSeasonDates(season) {
  const directStart = toDateOrNull(season?.start_date);
  const directEnd = toDateOrNull(season?.end_date);

  if (directStart && directEnd) {
    return { startDate: directStart, endDate: directEnd };
  }

  const name = String(season?.name || '');
  const match = name.match(/(\d{4})\D+(\d{4})/);
  if (match) {
    const startYear = Number(match[1]);
    const endYear = Number(match[2]);
    if (Number.isFinite(startYear) && Number.isFinite(endYear) && endYear >= startYear) {
      return {
        startDate: `${startYear}-09-01`,
        endDate: `${endYear}-06-30`
      };
    }
  }

  const currentYear = new Date().getFullYear();
  return {
    startDate: `${currentYear}-01-01`,
    endDate: `${currentYear}-12-31`
  };
}

// Test hook used by regression tests; not used in production runtime.
export function __setTwizzitClientForTests(client) {
  twizzitClient = client;
}

export function __resetTwizzitClientForTests() {
  twizzitClient = null;
}

/**
 * Sync clubs from Twizzit API
 * @returns {Promise<Array>} List of synced clubs
 */
export async function syncClubs() {
  try {
    const { groups } = await getTwizzitClient().getGroups();
    const syncedClubs = [];

    for (const group of groups || []) {
      const twizzitId = String(group.id);
      const clubName = String(group.name || '').trim() || `Twizzit Club ${twizzitId}`;

      const clubResult = await db.query(
        `INSERT INTO clubs (name)
         VALUES ($1)
         ON CONFLICT (name)
         DO UPDATE SET updated_at = CURRENT_TIMESTAMP
         RETURNING id, name`,
        [clubName]
      );

      const localClub = clubResult.rows[0];

      // local_club_id is nullable in this table and currently linked to teams via FK.
      // We still persist Twizzit IDs so sync is no longer a no-op.
      await db.query(
        `INSERT INTO twizzit_team_mappings (local_club_id, twizzit_team_id, twizzit_team_name, last_synced_at, sync_status, sync_error)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'synced', NULL)
         ON CONFLICT (twizzit_team_id)
         DO UPDATE
         SET twizzit_team_name = EXCLUDED.twizzit_team_name,
             last_synced_at = CURRENT_TIMESTAMP,
             sync_status = 'synced',
             sync_error = NULL`,
        [null, twizzitId, clubName]
      );

      syncedClubs.push({
        id: twizzitId,
        name: clubName,
        description: group.description || '',
        localClubId: localClub.id,
      });
    }

    return syncedClubs;
  } catch (error) {
    logError('Failed to sync clubs:', error);
    throw error;
  }
}

/**
 * Sync players for a specific club
 * @param {string} clubId - Twizzit club ID
 * @returns {Promise<Array>} List of synced players
 */
export async function syncPlayers(clubId) {
  try {
    const { contacts } = await getTwizzitClient().getGroupContacts(clubId);
    const syncedPlayers = [];

    const teamMappingResult = await db.query(
      'SELECT id FROM twizzit_team_mappings WHERE twizzit_team_id = $1 LIMIT 1',
      [String(clubId)]
    );
    const teamMappingId = teamMappingResult.rows[0]?.id || null;

    for (const contact of contacts || []) {
      const twizzitPlayerId = String(contact.id);
      const firstName = String(contact.first_name || '').trim() || 'Unknown';
      const lastName = String(contact.last_name || '').trim() || 'Player';
      const gender = normalizeGender(contact.gender);

      const existingPlayer = await db.query(
        `SELECT id
         FROM players
         WHERE first_name = $1
           AND last_name = $2
           AND club_id IS NOT DISTINCT FROM $3
         LIMIT 1`,
        [firstName, lastName, null]
      );

      let localPlayerId;
      if (existingPlayer.rows.length > 0) {
        localPlayerId = existingPlayer.rows[0].id;
        await db.query(
          `UPDATE players
           SET gender = $1,
               is_twizzit_registered = true,
               twizzit_verified_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [gender, localPlayerId]
        );
      } else {
        const insertedPlayer = await db.query(
          `INSERT INTO players (club_id, first_name, last_name, gender, is_twizzit_registered, twizzit_verified_at)
           VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
           RETURNING id`,
          [null, firstName, lastName, gender]
        );
        localPlayerId = insertedPlayer.rows[0].id;
      }

      await db.query(
        `INSERT INTO twizzit_player_mappings (local_player_id, twizzit_player_id, twizzit_player_name, team_mapping_id, last_synced_at, sync_status, sync_error)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 'synced', NULL)
         ON CONFLICT (twizzit_player_id)
         DO UPDATE
         SET local_player_id = EXCLUDED.local_player_id,
             twizzit_player_name = EXCLUDED.twizzit_player_name,
             team_mapping_id = EXCLUDED.team_mapping_id,
             last_synced_at = CURRENT_TIMESTAMP,
             sync_status = 'synced',
             sync_error = NULL`,
        [localPlayerId, twizzitPlayerId, `${firstName} ${lastName}`, teamMappingId]
      );

      syncedPlayers.push({
        id: twizzitPlayerId,
        firstName,
        lastName,
        email: contact.email || null,
        gender,
        localPlayerId,
      });
    }

    return syncedPlayers;
  } catch (error) {
    // Avoid user-controlled format strings in logs
    logError('Failed to sync players for club %s:', clubId, error);
    throw error;
  }
}

/**
 * Sync seasons from Twizzit API
 * @returns {Promise<Array>} List of synced seasons
 */
export async function syncSeasons() {
  try {
    const { seasons } = await getTwizzitClient().getSeasons();
    const syncedSeasons = [];

    for (const season of seasons || []) {
      const twizzitId = String(season.id);
      const seasonName = String(season.name || '').trim() || `Twizzit Season ${twizzitId}`;
      const { startDate, endDate } = deriveSeasonDates(season);

      const existing = await db.query('SELECT id FROM seasons WHERE name = $1 LIMIT 1', [seasonName]);
      let localSeasonId;

      if (existing.rows.length > 0) {
        localSeasonId = existing.rows[0].id;
        await db.query(
          `UPDATE seasons
           SET start_date = $1,
               end_date = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [startDate, endDate, localSeasonId]
        );
      } else {
        const inserted = await db.query(
          `INSERT INTO seasons (name, start_date, end_date, season_type, is_active)
           VALUES ($1, $2, $3, $4, false)
           RETURNING id`,
          [seasonName, startDate, endDate, 'mixed']
        );
        localSeasonId = inserted.rows[0].id;
      }

      syncedSeasons.push({
        id: twizzitId,
        name: seasonName,
        startDate,
        endDate,
        localSeasonId,
      });
    }

    return syncedSeasons;
  } catch (error) {
    logError('Failed to sync seasons:', error);
    throw error;
  }
}

/**
 * Verify Twizzit API connection
 * @returns {Promise<boolean>} True if connection is successful
 */
export async function verifyTwizzitConnection() {
  try {
    return await getTwizzitClient().verifyConnection();
  } catch (error) {
    logError('Twizzit API connection verification failed:', error);
    return false;
  }
}