/**
 * Twizzit Registration Validation Middleware
 * Enforces KBKB (Belgian Korfball Federation) rule:
 * Players must be registered in Twizzit to participate in official matches
 */

import db from '../db.js';

/**
 * Check if a single player is eligible for official match participation
 * @param {number} playerId - The local player ID
 * @returns {Promise<{eligible: boolean, reason?: string, player?: object}>}
 */
export async function requireTwizzitRegistration(playerId) {
  const result = await db.query(`
    SELECT 
      p.id,
      p.first_name,
      p.last_name,
      p.is_twizzit_registered,
      p.twizzit_verified_at,
      tpm.twizzit_player_id,
      tpm.sync_status
    FROM players p
    LEFT JOIN twizzit_player_mappings tpm ON p.id = tpm.local_player_id
    WHERE p.id = $1
  `, [playerId]);
  
  if (result.rows.length === 0) {
    return {
      eligible: false,
      reason: 'Player not found'
    };
  }
  
  const player = result.rows[0];
  
  // Player must have both the flag set AND a valid Twizzit mapping
  if (!player.is_twizzit_registered || !player.twizzit_player_id) {
    return {
      eligible: false,
      reason: `${player.first_name} ${player.last_name} is not registered in Twizzit (KBKB). Official match participation requires Twizzit registration.`,
      player: {
        id: player.id,
        name: `${player.first_name} ${player.last_name}`,
        isRegistered: player.is_twizzit_registered,
        hasMappingtwizzit: !!player.twizzit_player_id
      }
    };
  }
  
  return { 
    eligible: true,
    player: {
      id: player.id,
      name: `${player.first_name} ${player.last_name}`,
      twizzitId: player.twizzit_player_id
    }
  };
}

/**
 * Validate that all players in a roster are eligible for the game
 * @param {number[]} playerIds - Array of player IDs to validate
 * @param {number} gameId - The game ID
 * @returns {Promise<{eligible: boolean, skipCheck?: boolean, ineligiblePlayers?: Array}>}
 */
export async function validateRosterTwizzitEligibility(playerIds, gameId) {
  // First, check if this is an official match requiring Twizzit validation
  const gameResult = await db.query(`
    SELECT 
      g.id,
      g.status,
      c.is_official
    FROM games g
    LEFT JOIN competitions c ON g.competition_id = c.id
    WHERE g.id = $1
  `, [gameId]);
  
  if (gameResult.rows.length === 0) {
    return {
      eligible: false,
      reason: 'Game not found'
    };
  }
  
  const game = gameResult.rows[0];
  
  // If no competition or competition is not official (friendly match), skip Twizzit check
  const isOfficialMatch = game.is_official === true;
  
  if (!isOfficialMatch) {
    return { 
      eligible: true, 
      skipCheck: true,
      message: 'Friendly match - Twizzit registration not required'
    };
  }
  
  // For official matches, validate all players
  const ineligiblePlayers = [];
  
  for (const playerId of playerIds) {
    const check = await requireTwizzitRegistration(playerId);
    if (!check.eligible) {
      ineligiblePlayers.push({
        playerId,
        playerName: check.player?.name || 'Unknown',
        reason: check.reason
      });
    }
  }
  
  if (ineligiblePlayers.length > 0) {
    return {
      eligible: false,
      ineligiblePlayers,
      message: 'One or more players are not eligible for this official match. All players must be registered in Twizzit (KBKB).'
    };
  }
  
  return { eligible: true };
}

/**
 * Express middleware to validate Twizzit registration for game rosters
 * Use this on game roster creation/update endpoints
 */
export const validateGameRosterTwizzit = async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const { players } = req.body;
    
    if (!players || !Array.isArray(players)) {
      return res.status(400).json({ error: 'Players array is required' });
    }
    
    const playerIds = players.map(p => p.player_id);
    const validation = await validateRosterTwizzitEligibility(playerIds, gameId);
    
    if (validation.reason === 'Game not found') {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (!validation.eligible && !validation.skipCheck) {
      return res.status(403).json({
        error: validation.message,
        ineligiblePlayers: validation.ineligiblePlayers,
        details: 'Official KBKB matches require all players to be registered in Twizzit. Please sync players from Twizzit or contact your club administrator.'
      });
    }
    
    // Store validation result in request for logging/auditing
    req.twizzitValidation = validation;
    
    next();
  } catch (error) {
    console.error('Twizzit validation error:', error);
    return res.status(500).json({ 
      error: 'Failed to validate Twizzit registration',
      details: error.message 
    });
  }
};
