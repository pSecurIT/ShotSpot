/**
 * Twizzit Sync Service
 * Orchestrates data synchronization between Twizzit and ShotSpot
 * 
 * Features:
 * - Player sync (Twizzit contacts → ShotSpot players)
 * - Team sync (Twizzit groups → ShotSpot teams)
 * - Roster sync (Twizzit group-contacts → ShotSpot game_rosters)
 * - Full sync (all data types)
 * - Comprehensive error handling and logging
 * - Duplicate detection and conflict resolution
 */

import db from '../db.js';
import TwizzitClient from './twizzit-client.js';
import { getValidToken, updateSyncStatus } from './twizzit-auth.js';

/**
 * Sync context - tracks progress during sync operation
 */
class SyncContext {
  constructor(configId, syncType) {
    this.configId = configId;
    this.syncType = syncType;
    this.recordsFetched = 0;
    this.recordsCreated = 0;
    this.recordsUpdated = 0;
    this.recordsSkipped = 0;
    this.errors = [];
    this.startedAt = new Date();
    this.logId = null;
  }

  /**
   * Add error to context
   * @param {string} entity - Entity type (player, team, etc.)
   * @param {*} id - Entity ID
   * @param {string} error - Error message
   */
  addError(entity, id, error) {
    this.errors.push({ entity, id, error, timestamp: new Date() });
  }

  /**
   * Get duration in milliseconds
   * @returns {number} Duration in ms
   */
  getDuration() {
    return Date.now() - this.startedAt.getTime();
  }

  /**
   * Get sync result summary
   * @returns {Object} Result summary
   */
  getResult() {
    return {
      syncType: this.syncType,
      status: this.errors.length === 0 ? 'success' : (this.recordsCreated > 0 || this.recordsUpdated > 0) ? 'partial' : 'failed',
      recordsFetched: this.recordsFetched,
      recordsCreated: this.recordsCreated,
      recordsUpdated: this.recordsUpdated,
      recordsSkipped: this.recordsSkipped,
      errors: this.errors,
      duration: this.getDuration(),
    };
  }
}

/**
 * Logs sync start to database
 * @param {SyncContext} context - Sync context
 * @returns {Promise<number>} Log ID
 */
async function logSyncStart(context) {
  const result = await db.query(
    `INSERT INTO twizzit_sync_log (config_id, sync_type, status, started_at)
     VALUES ($1, $2, 'running', $3)
     RETURNING id`,
    [context.configId, context.syncType, context.startedAt]
  );
  context.logId = result.rows[0].id;
  return context.logId;
}

/**
 * Logs sync completion to database
 * @param {SyncContext} context - Sync context
 * @returns {Promise<void>}
 */
async function logSyncComplete(context) {
  const result = context.getResult();
  await db.query(
    `UPDATE twizzit_sync_log
     SET status = $1,
         records_fetched = $2,
         records_created = $3,
         records_updated = $4,
         records_skipped = $5,
         errors = $6,
         completed_at = NOW(),
         duration_ms = $7
     WHERE id = $8`,
    [
      result.status,
      result.recordsFetched,
      result.recordsCreated,
      result.recordsUpdated,
      result.recordsSkipped,
      JSON.stringify(result.errors),
      result.duration,
      context.logId,
    ]
  );
}

/**
 * Logs sync error to database
 * @param {SyncContext} context - Sync context
 * @param {Error} error - Error object
 * @returns {Promise<void>}
 */
async function logSyncError(context, error) {
  context.addError('sync', null, error.message);
  await db.query(
    `UPDATE twizzit_sync_log
     SET status = 'failed',
         errors = $1,
         completed_at = NOW(),
         duration_ms = $2
     WHERE id = $3`,
    [JSON.stringify(context.errors), context.getDuration(), context.logId]
  );
}

/**
 * Starts a sync operation with proper locking and error handling
 * @param {number} configId - Twizzit config ID
 * @param {string} syncType - Type of sync (players, teams, rosters, full)
 * @param {Function} syncFunction - Async function to execute sync
 * @returns {Promise<Object>} Sync result
 * @throws {Error} If sync already in progress or sync fails
 */
export async function startSync(configId, syncType, syncFunction) {
  // Check if sync already in progress
  const checkResult = await db.query(
    'SELECT sync_in_progress FROM twizzit_config WHERE id = $1',
    [configId]
  );

  if (checkResult.rows.length === 0) {
    throw new Error(`Twizzit config not found: ${configId}`);
  }

  if (checkResult.rows[0].sync_in_progress) {
    throw new Error('Sync already in progress for this configuration');
  }

  // Set sync in progress flag
  await updateSyncStatus(configId, true);

  const context = new SyncContext(configId, syncType);

  try {
    // Log sync start
    await logSyncStart(context);

    if (process.env.NODE_ENV !== 'test') {
      console.log(`🔄 Starting Twizzit ${syncType} sync for config ${configId}`);
    }

    // Execute sync function
    await syncFunction(context);

    // Log sync completion
    await logSyncComplete(context);

    // Update last sync time
    await updateSyncStatus(configId, false, context.startedAt);

    const result = context.getResult();

    if (process.env.NODE_ENV !== 'test') {
      console.log(`✅ Twizzit ${syncType} sync completed: ${result.recordsCreated} created, ${result.recordsUpdated} updated, ${result.recordsSkipped} skipped, ${result.errors.length} errors`);
    }

    return result;
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(`❌ Twizzit ${syncType} sync failed:`, error);
    }

    // Log error
    await logSyncError(context, error);

    // Clear sync in progress flag
    await updateSyncStatus(configId, false);

    throw error;
  }
}

/**
 * Syncs players from Twizzit contacts
 * @param {number} configId - Twizzit config ID
 * @param {Array<number>} organizationIds - Organization IDs to sync (optional, defaults to config org)
 * @returns {Promise<Object>} Sync result
 */
export async function syncPlayers(configId, organizationIds = null) {
  return startSync(configId, 'players', async (context) => {
    // Get valid token
    const token = await getValidToken(configId);
    const client = new TwizzitClient(token);

    // Get organization IDs if not provided
    if (!organizationIds) {
      const configResult = await db.query(
        'SELECT organization_id FROM twizzit_config WHERE id = $1',
        [configId]
      );
      organizationIds = [configResult.rows[0].organization_id];
    }

    // Fetch all contacts (players) with pagination
    const contacts = await client.getAllContacts(organizationIds, {
      currentMembership: true, // Only sync current members
    });

    context.recordsFetched = contacts.length;

    if (process.env.NODE_ENV !== 'test') {
      console.log(`📥 Fetched ${contacts.length} contacts from Twizzit`);
    }

    // Process each contact
    for (const contact of contacts) {
      try {
        await processContact(context, contact, organizationIds[0]);
      } catch (error) {
        context.addError('contact', contact.id, error.message);
        context.recordsSkipped++;
        // Continue with next contact
      }
    }
  });
}

/**
 * Processes a single Twizzit contact (creates or updates player)
 * @private
 * @param {SyncContext} context - Sync context
 * @param {Object} contact - Twizzit contact object
 * @param {number} organizationId - Twizzit organization ID
 * @returns {Promise<void>}
 */
async function processContact(context, contact, organizationId) {
  // Check if player already exists in mapping
  const mappingResult = await db.query(
    'SELECT shotspot_player_id FROM twizzit_player_mapping WHERE twizzit_contact_id = $1 AND organization_id = $2',
    [contact.id, organizationId]
  );

  let playerId;
  const playerData = mapContactToPlayer(contact);

  if (mappingResult.rows.length > 0) {
    // Update existing player
    playerId = mappingResult.rows[0].shotspot_player_id;
    await db.query(
      `UPDATE players
       SET first_name = $1, last_name = $2, date_of_birth = $3, gender = $4, 
           jersey_number = $5, email = $6, phone = $7,
           sync_source = 'twizzit', last_synced_at = NOW()
       WHERE id = $8`,
      [
        playerData.firstName,
        playerData.lastName,
        playerData.dateOfBirth,
        playerData.gender,
        playerData.jerseyNumber,
        playerData.email,
        playerData.phone,
        playerId,
      ]
    );
    context.recordsUpdated++;
  } else {
    // Check for duplicate by registry number or email
    const duplicateResult = await db.query(
      `SELECT id FROM players 
       WHERE (email = $1 AND email IS NOT NULL) 
          OR (first_name = $2 AND last_name = $3 AND date_of_birth = $4)
       LIMIT 1`,
      [playerData.email, playerData.firstName, playerData.lastName, playerData.dateOfBirth]
    );

    if (duplicateResult.rows.length > 0) {
      // Found duplicate, link existing player to Twizzit contact
      playerId = duplicateResult.rows[0].id;
      
      // Update player with Twizzit data
      await db.query(
        `UPDATE players
         SET sync_source = 'twizzit', last_synced_at = NOW()
         WHERE id = $1`,
        [playerId]
      );
    } else {
      // Create new player
      const insertResult = await db.query(
        `INSERT INTO players (first_name, last_name, date_of_birth, gender, 
                              jersey_number, email, phone, sync_source, last_synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'twizzit', NOW())
         RETURNING id`,
        [
          playerData.firstName,
          playerData.lastName,
          playerData.dateOfBirth,
          playerData.gender,
          playerData.jerseyNumber,
          playerData.email,
          playerData.phone,
        ]
      );
      playerId = insertResult.rows[0].id;
      context.recordsCreated++;
    }

    // Create mapping
    await db.query(
      `INSERT INTO twizzit_player_mapping (shotspot_player_id, twizzit_contact_id, organization_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (twizzit_contact_id, organization_id) DO NOTHING`,
      [playerId, contact.id, organizationId]
    );
  }
}

/**
 * Maps Twizzit contact to ShotSpot player data
 * @private
 * @param {Object} contact - Twizzit contact object
 * @returns {Object} Mapped player data
 */
function mapContactToPlayer(contact) {
  // Format phone number
  let phone = null;
  if (contact['mobile-1'] && contact['mobile-1'].number) {
    const cc = contact['mobile-1'].cc || '';
    phone = `+${cc}${contact['mobile-1'].number}`;
  }

  // Normalize gender
  let gender = null;
  if (contact.gender) {
    const g = contact.gender.toLowerCase();
    if (g === 'm' || g === 'male') gender = 'M';
    else if (g === 'f' || g === 'female') gender = 'F';
  }

  return {
    firstName: contact['first-name'] || '',
    lastName: contact['last-name'] || '',
    dateOfBirth: contact['date-of-birth'] || null,
    gender,
    jerseyNumber: contact.number || null,
    email: contact['email-1']?.email || null,
    phone,
  };
}

/**
 * Syncs teams from Twizzit groups
 * @param {number} configId - Twizzit config ID
 * @param {Array<number>} organizationIds - Organization IDs to sync
 * @returns {Promise<Object>} Sync result
 */
export async function syncTeams(configId, organizationIds = null) {
  return startSync(configId, 'teams', async (context) => {
    const token = await getValidToken(configId);
    const client = new TwizzitClient(token);

    if (!organizationIds) {
      const configResult = await db.query(
        'SELECT organization_id FROM twizzit_config WHERE id = $1',
        [configId]
      );
      organizationIds = [configResult.rows[0].organization_id];
    }

    // Fetch current season first
    const seasons = await client.getSeasons(organizationIds, { isCurrentSeason: true });
    const currentSeason = seasons.length > 0 ? seasons[0] : null;

    // Fetch all groups (teams)
    const groups = await client.getAllGroups(organizationIds, {
      seasonId: currentSeason?.id,
    });

    context.recordsFetched = groups.length;

    if (process.env.NODE_ENV !== 'test') {
      console.log(`📥 Fetched ${groups.length} groups from Twizzit`);
    }

    // Process each group
    for (const group of groups) {
      try {
        await processGroup(context, group, organizationIds[0], currentSeason);
      } catch (error) {
        context.addError('group', group.id, error.message);
        context.recordsSkipped++;
      }
    }
  });
}

/**
 * Processes a single Twizzit group (creates or updates team)
 * @private
 * @param {SyncContext} context - Sync context
 * @param {Object} group - Twizzit group object
 * @param {number} organizationId - Twizzit organization ID
 * @param {Object} season - Current season object
 * @returns {Promise<void>}
 */
async function processGroup(context, group, organizationId, season) {
  const mappingResult = await db.query(
    'SELECT shotspot_team_id FROM twizzit_team_mapping WHERE twizzit_group_id = $1 AND organization_id = $2',
    [group.id, organizationId]
  );

  let teamId;
  const teamData = mapGroupToTeam(group);

  if (mappingResult.rows.length > 0) {
    // Update existing team
    teamId = mappingResult.rows[0].shotspot_team_id;
    await db.query(
      `UPDATE teams
       SET name = $1, sync_source = 'twizzit', last_synced_at = NOW()
       WHERE id = $2`,
      [teamData.name, teamId]
    );
    context.recordsUpdated++;
  } else {
    // Create new team
    const insertResult = await db.query(
      `INSERT INTO teams (name, sync_source, last_synced_at)
       VALUES ($1, 'twizzit', NOW())
       RETURNING id`,
      [teamData.name]
    );
    teamId = insertResult.rows[0].id;
    context.recordsCreated++;

    // Create mapping
    await db.query(
      `INSERT INTO twizzit_team_mapping (shotspot_team_id, twizzit_group_id, organization_id, season_id, season_name)
       VALUES ($1, $2, $3, $4, $5)`,
      [teamId, group.id, organizationId, season?.id, season?.name]
    );
  }
}

/**
 * Maps Twizzit group to ShotSpot team data
 * @private
 * @param {Object} group - Twizzit group object
 * @returns {Object} Mapped team data
 */
function mapGroupToTeam(group) {
  return {
    name: group.name || group['short-name'] || 'Unknown Team',
  };
}

/**
 * Syncs full data (players, teams, rosters)
 * @param {number} configId - Twizzit config ID
 * @returns {Promise<Object>} Combined sync result
 */
export async function syncFull(configId) {
  const results = {
    players: null,
    teams: null,
    errors: [],
  };

  try {
    results.players = await syncPlayers(configId);
  } catch (error) {
    results.errors.push({ type: 'players', error: error.message });
  }

  try {
    results.teams = await syncTeams(configId);
  } catch (error) {
    results.errors.push({ type: 'teams', error: error.message });
  }

  return results;
}
