import db from '../db.js';

/**
 * Middleware to validate if all players in a match are registered in Twizzit
 */
export async function validatePlayersInMatch(req, res, next) {
  const { matchId } = req.params;

  try {
    // Fetch players for the match
    const { rows: players } = await db.query(
      `SELECT p.id, p.first_name, p.last_name, p.is_registered
       FROM players p
       JOIN match_players mp ON p.id = mp.player_id
       WHERE mp.match_id = $1`,
      [matchId]
    );

    // Check if any player is not registered
    const unregisteredPlayers = players.filter(player => !player.is_registered);

    if (unregisteredPlayers.length > 0) {
      return res.status(400).json({
        error: 'Unregistered players found',
        unregisteredPlayers: unregisteredPlayers.map(player => ({
          id: player.id,
          name: `${player.first_name} ${player.last_name}`
        }))
      });
    }

    next();
  } catch (error) {
    console.error('Error validating players in match:', error.message);
    res.status(500).json({
      error: 'Failed to validate players in match',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
}