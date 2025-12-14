/**
 * Twizzit Sync Service
 * Orchestrates data synchronization between ShotSpot and Twizzit API
 */

import db from '../db.js';
import TwizzitApiClient from './twizzit-api-client.js';
import { getCredentials, updateVerificationTimestamp } from './twizzit-auth.js';

/**
 * Create a Twizzit API client from stored credentials
 * @param {number} credentialId - Credential ID
 * @returns {Promise<TwizzitApiClient>} Configured API client
 */
async function createApiClient(credentialId) {
  const credentials = await getCredentials(credentialId);
  
  return new TwizzitApiClient({
    apiEndpoint: credentials.apiEndpoint,
    username: credentials.apiUsername,
    password: credentials.apiPassword
  });
}

/**
 * Log sync operation to history
 * @param {Object} syncData - Sync operation data
 * @returns {Promise<number>} Sync history ID
 */
async function logSyncHistory(syncData) {
  const {
    credentialId,
    syncType,
    syncDirection,
    status,
    itemsProcessed = 0,
    itemsSucceeded = 0,
    itemsFailed = 0,
    errorMessage = null,
    startedAt,
    completedAt = null
  } = syncData;

  try {
    const result = await db.query(
      `INSERT INTO twizzit_sync_history 
       (credential_id, sync_type, sync_direction, status, 
        items_processed, items_succeeded, items_failed, error_message,
        started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        credentialId,
        syncType,
        syncDirection,
        status,
        itemsProcessed,
        itemsSucceeded,
        itemsFailed,
        errorMessage,
        startedAt,
        completedAt
      ]
    );

    return result.rows[0].id;
  } catch (error) {
    console.error('Failed to log sync history:', error);
    throw error;
  }
}

/**
 * Update sync history record
 * @param {number} syncId - Sync history ID
 * @param {Object} updates - Fields to update
 */
async function updateSyncHistory(syncId, updates) {
  const {
    status,
    itemsProcessed,
    itemsSucceeded,
    itemsFailed,
    errorMessage,
    completedAt
  } = updates;

  try {
    await db.query(
      `UPDATE twizzit_sync_history 
       SET status = COALESCE($2, status),
           items_processed = COALESCE($3, items_processed),
           items_succeeded = COALESCE($4, items_succeeded),
           items_failed = COALESCE($5, items_failed),
           error_message = COALESCE($6, error_message),
           completed_at = COALESCE($7, completed_at)
       WHERE id = $1`,
      [syncId, status, itemsProcessed, itemsSucceeded, itemsFailed, errorMessage, completedAt]
    );
  } catch (error) {
    console.error('Failed to update sync history:', error);
    throw error;
  }
}

/**
 * Sync clubs from Twizzit to ShotSpot
 * @param {number} credentialId - Credential ID
 * @param {Object} options - Sync options
 * @returns {Promise<Object>} Sync results
 */
export async function syncClubsFromTwizzit(credentialId, options = {}) {
  const startTime = new Date();
  const syncId = await logSyncHistory({
    credentialId,
    syncType: 'clubs',
    syncDirection: 'import',
    status: 'in_progress',
    startedAt: startTime
  });

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const errors = [];

  try {
    const apiClient = await createApiClient(credentialId);
    
    // Verify connection
    const isConnected = await apiClient.verifyConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to Twizzit API');
    }

    await updateVerificationTimestamp(credentialId);

    // Fetch all teams (clubs in Twizzit terminology)
    let hasMore = true;
    let page = 1;
    const allTeams = [];

    while (hasMore) {
      const result = await apiClient.getTeams({ page, limit: 100 });
      allTeams.push(...result.teams);
      hasMore = result.hasMore;
      page++;
    }

    // Process each team (create as club in ShotSpot)
    for (const twizzitTeam of allTeams) {
      processed++;

      try {
        // Check if club already exists in mapping (using local_club_id)
        const existingMapping = await db.query(
          'SELECT * FROM twizzit_team_mappings WHERE twizzit_team_id = $1',
          [twizzitTeam.id]
        );

        let localClubId;

        if (existingMapping.rows.length > 0) {
          // Update existing club
          localClubId = existingMapping.rows[0].local_club_id;
          
          await db.query(
            `UPDATE clubs 
             SET name = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [twizzitTeam.name, localClubId]
          );

          // Update mapping
          await db.query(
            `UPDATE twizzit_team_mappings 
             SET twizzit_team_name = $1, 
                 last_synced_at = CURRENT_TIMESTAMP,
                 sync_status = 'success',
                 sync_error = NULL
             WHERE id = $2`,
            [twizzitTeam.name, existingMapping.rows[0].id]
          );
        } else {
          // Create new club
          const clubResult = await db.query(
            'INSERT INTO clubs (name) VALUES ($1) RETURNING id',
            [twizzitTeam.name]
          );
          localClubId = clubResult.rows[0].id;

          // Create mapping
          await db.query(
            `INSERT INTO twizzit_team_mappings 
             (local_club_id, twizzit_team_id, twizzit_team_name, 
              last_synced_at, sync_status)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'success')`,
            [localClubId, twizzitTeam.id, twizzitTeam.name]
          );
        }

        succeeded++;

        // Optionally sync players for this club
        if (options.includePlayers) {
          await syncClubPlayers(credentialId, twizzitTeam.id, localClubId);
        }
      } catch (error) {
        failed++;
        errors.push({
          clubId: twizzitTeam.id,
          clubName: twizzitTeam.name,
          error: error.message
        });

        // Update mapping with error
        try {
          await db.query(
            `UPDATE twizzit_team_mappings 
             SET sync_status = 'error', 
                 sync_error = $1,
                 last_synced_at = CURRENT_TIMESTAMP
             WHERE twizzit_team_id = $2`,
            [error.message, twizzitTeam.id]
          );
        } catch (_err) {
          // Ignore mapping update errors
        }
      }
    }

    // Update sync history with success
    await updateSyncHistory(syncId, {
      status: failed > 0 ? 'partial_success' : 'success',
      itemsProcessed: processed,
      itemsSucceeded: succeeded,
      itemsFailed: failed,
      errorMessage: errors.length > 0 ? JSON.stringify(errors) : null,
      completedAt: new Date()
    });

    return {
      success: true,
      syncId,
      processed,
      succeeded,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      duration: Date.now() - startTime.getTime()
    };
  } catch (error) {
    // Update sync history with failure
    await updateSyncHistory(syncId, {
      status: 'failed',
      itemsProcessed: processed,
      itemsSucceeded: succeeded,
      itemsFailed: failed,
      errorMessage: error.message,
      completedAt: new Date()
    });

    throw new Error(`Club sync failed: ${error.message}`);
  }
}

/**
 * Sync players for a specific club
 * @param {number} credentialId - Credential ID
 * @param {string} twizzitTeamId - Twizzit team ID (clubs in Twizzit terminology)
 * @param {number} localClubId - Local club ID
 * @returns {Promise<Object>} Sync results
 */
async function syncClubPlayers(credentialId, twizzitTeamId, localClubId) {
  const apiClient = await createApiClient(credentialId);
  
  // Get club mapping (team_mappings stores club mappings after migration)
  const mappingResult = await db.query(
    'SELECT id FROM twizzit_team_mappings WHERE twizzit_team_id = $1',
    [twizzitTeamId]
  );

  if (mappingResult.rows.length === 0) {
    throw new Error('Club mapping not found');
  }

  const teamMappingId = mappingResult.rows[0].id;

  // Fetch all players (handle pagination)
  let hasMore = true;
  let page = 1;
  const allPlayers = [];

  while (hasMore) {
    const result = await apiClient.getTeamPlayers(twizzitTeamId, { page, limit: 100 });
    allPlayers.push(...result.players);
    hasMore = result.hasMore;
    page++;
  }

  let succeeded = 0;
  let failed = 0;

  // Process each player
  for (const twizzitPlayer of allPlayers) {
    try {
      // Check if player already exists in mapping
      const existingMapping = await db.query(
        'SELECT * FROM twizzit_player_mappings WHERE twizzit_player_id = $1',
        [twizzitPlayer.id]
      );

      let localPlayerId;

      if (existingMapping.rows.length > 0) {
        // Update existing player
        localPlayerId = existingMapping.rows[0].local_player_id;
        
        await db.query(
          `UPDATE players 
           SET first_name = $1, 
               last_name = $2, 
               jersey_number = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [
            twizzitPlayer.first_name || twizzitPlayer.firstName,
            twizzitPlayer.last_name || twizzitPlayer.lastName,
            twizzitPlayer.jersey_number || twizzitPlayer.jerseyNumber,
            localPlayerId
          ]
        );

        // Update mapping
        await db.query(
          `UPDATE twizzit_player_mappings 
           SET twizzit_player_name = $1, 
               last_synced_at = CURRENT_TIMESTAMP,
               sync_status = 'success',
               sync_error = NULL
           WHERE id = $2`,
          [
            `${twizzitPlayer.first_name || twizzitPlayer.firstName} ${twizzitPlayer.last_name || twizzitPlayer.lastName}`,
            existingMapping.rows[0].id
          ]
        );
      } else {
        // Create new player with club_id (team_id is optional)
        const playerResult = await db.query(
          `INSERT INTO players 
           (club_id, first_name, last_name, jersey_number, is_active)
           VALUES ($1, $2, $3, $4, true)
           RETURNING id`,
          [
            localClubId,
            twizzitPlayer.first_name || twizzitPlayer.firstName,
            twizzitPlayer.last_name || twizzitPlayer.lastName,
            twizzitPlayer.jersey_number || twizzitPlayer.jerseyNumber
          ]
        );
        localPlayerId = playerResult.rows[0].id;

        // Create mapping
        await db.query(
          `INSERT INTO twizzit_player_mappings 
           (local_player_id, twizzit_player_id, twizzit_player_name, 
            team_mapping_id, last_synced_at, sync_status)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 'success')`,
          [
            localPlayerId,
            twizzitPlayer.id,
            `${twizzitPlayer.first_name || twizzitPlayer.firstName} ${twizzitPlayer.last_name || twizzitPlayer.lastName}`,
            teamMappingId
          ]
        );
      }

      succeeded++;
    } catch (error) {
      failed++;
      console.error(`Failed to sync player ${twizzitPlayer.id}:`, error);
    }
  }

  return { succeeded, failed, total: allPlayers.length };
}

/**
 * Sync players from Twizzit to ShotSpot
 * @param {number} credentialId - Credential ID
 * @param {Object} _options - Sync options (reserved for future use)
 * @returns {Promise<Object>} Sync results
 */
export async function syncPlayersFromTwizzit(credentialId, _options = {}) {
  const startTime = new Date();
  const syncId = await logSyncHistory({
    credentialId,
    syncType: 'players',
    syncDirection: 'import',
    status: 'in_progress',
    startedAt: startTime
  });

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  try {
    // Get all club mappings (team_mappings table stores club mappings after migration)
    const clubMappingsResult = await db.query(
      'SELECT twizzit_team_id, local_club_id FROM twizzit_team_mappings'
    );

    // Sync players for each club
    for (const mapping of clubMappingsResult.rows) {
      try {
        const result = await syncClubPlayers(
          credentialId,
          mapping.twizzit_team_id,
          mapping.local_club_id
        );
        
        processed += result.total;
        succeeded += result.succeeded;
        failed += result.failed;
      } catch (error) {
        console.error(`Failed to sync players for club ${mapping.twizzit_team_id}:`, error);
      }
    }

    // Update sync history
    await updateSyncHistory(syncId, {
      status: failed > 0 ? 'partial_success' : 'success',
      itemsProcessed: processed,
      itemsSucceeded: succeeded,
      itemsFailed: failed,
      completedAt: new Date()
    });

    return {
      success: true,
      syncId,
      processed,
      succeeded,
      failed,
      duration: Date.now() - startTime.getTime()
    };
  } catch (error) {
    await updateSyncHistory(syncId, {
      status: 'failed',
      itemsProcessed: processed,
      itemsSucceeded: succeeded,
      itemsFailed: failed,
      errorMessage: error.message,
      completedAt: new Date()
    });

    throw new Error(`Player sync failed: ${error.message}`);
  }
}

/**
 * Get sync configuration
 * @param {number} credentialId - Credential ID
 * @returns {Promise<Object>} Sync configuration
 */
export async function getSyncConfig(credentialId) {
  try {
    const result = await db.query(
      'SELECT * FROM twizzit_sync_config WHERE credential_id = $1',
      [credentialId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const config = result.rows[0];
    return {
      id: config.id,
      credentialId: config.credential_id,
      syncTeams: config.sync_teams,
      syncPlayers: config.sync_players,
      syncCompetitions: config.sync_competitions,
      syncIntervalMinutes: config.sync_interval_minutes,
      autoSyncEnabled: config.auto_sync_enabled,
      lastSyncAt: config.last_sync_at,
      nextSyncAt: config.next_sync_at
    };
  } catch (error) {
    throw new Error(`Failed to get sync config: ${error.message}`);
  }
}

/**
 * Update sync configuration
 * @param {number} credentialId - Credential ID
 * @param {Object} config - Configuration updates
 * @returns {Promise<Object>} Updated configuration
 */
export async function updateSyncConfig(credentialId, config) {
  try {
    const result = await db.query(
      `INSERT INTO twizzit_sync_config 
       (credential_id, sync_teams, sync_players, sync_competitions, 
        sync_interval_minutes, auto_sync_enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (credential_id)
       DO UPDATE SET
         sync_teams = COALESCE($2, twizzit_sync_config.sync_teams),
         sync_players = COALESCE($3, twizzit_sync_config.sync_players),
         sync_competitions = COALESCE($4, twizzit_sync_config.sync_competitions),
         sync_interval_minutes = COALESCE($5, twizzit_sync_config.sync_interval_minutes),
         auto_sync_enabled = COALESCE($6, twizzit_sync_config.auto_sync_enabled),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        credentialId,
        config.syncTeams,
        config.syncPlayers,
        config.syncCompetitions,
        config.syncIntervalMinutes,
        config.autoSyncEnabled
      ]
    );

    return result.rows[0];
  } catch (error) {
    throw new Error(`Failed to update sync config: ${error.message}`);
  }
}

/**
 * Get sync history
 * @param {number} credentialId - Credential ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Sync history records
 */
export async function getSyncHistory(credentialId, options = {}) {
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  try {
    const result = await db.query(
      `SELECT * FROM twizzit_sync_history 
       WHERE credential_id = $1
       ORDER BY started_at DESC
       LIMIT $2 OFFSET $3`,
      [credentialId, limit, offset]
    );

    return result.rows;
  } catch (error) {
    throw new Error(`Failed to get sync history: ${error.message}`);
  }
}

export default {
  syncClubsFromTwizzit,
  syncPlayersFromTwizzit,
  getSyncConfig,
  updateSyncConfig,
  getSyncHistory
};
