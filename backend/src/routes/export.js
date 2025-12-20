import express from 'express';
import { param, query, validationResult } from 'express-validator';
import db from '../db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

/**
 * Helper function to escape CSV values
 */
function escapeCSV(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * Helper function to convert array of objects to CSV
 */
function arrayToCSV(data, headers) {
  if (!data || data.length === 0) {
    return headers.join(',') + '\n';
  }
  
  const csvRows = [];
  csvRows.push(headers.join(','));
  
  for (const row of data) {
    const values = headers.map(header => {
      const key = header.toLowerCase().replace(/ /g, '_');
      return escapeCSV(row[key]);
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

/**
 * GET /api/export/match/:gameId/csv
 * Export all match data including shots, events, metadata, and player participation
 */
router.get('/match/:gameId/csv', [
  param('gameId').isInt().withMessage('Game ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;

  try {
    // Get game metadata
    const gameResult = await db.query(`
      SELECT 
        g.*,
        hc.name as home_club_name,
        ac.name as away_club_name,
        ht.name as home_team_name,
        at.name as away_team_name,
        EXTRACT(EPOCH FROM g.period_duration) as period_duration_seconds
      FROM games g
      LEFT JOIN clubs hc ON g.home_club_id = hc.id
      LEFT JOIN clubs ac ON g.away_club_id = ac.id
      LEFT JOIN teams ht ON g.home_team_id = ht.id
      LEFT JOIN teams at ON g.away_team_id = at.id
      WHERE g.id = $1
    `, [gameId]);

    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = gameResult.rows[0];
    const homeName = game.home_club_name || game.home_team_name;
    const awayName = game.away_club_name || game.away_team_name;

    // Get all shots
    const shotsResult = await db.query(`
      SELECT 
        s.id,
        s.period,
        EXTRACT(EPOCH FROM s.time_remaining) as time_remaining_seconds,
        s.x_coord,
        s.y_coord,
        s.result,
        s.shot_type,
        s.distance,
        p.first_name || ' ' || p.last_name as player_name,
        p.jersey_number,
        c.name as team_name,
        s.created_at
      FROM shots s
      JOIN players p ON s.player_id = p.id
      JOIN clubs c ON s.club_id = c.id
      WHERE s.game_id = $1
      ORDER BY s.created_at
    `, [gameId]);

    // Get all substitutions
    const substitutionsResult = await db.query(`
      SELECT 
        s.id,
        s.period,
        EXTRACT(EPOCH FROM s.time_remaining) as time_remaining_seconds,
        pin.first_name || ' ' || pin.last_name as player_in,
        pin.jersey_number as player_in_jersey,
        pout.first_name || ' ' || pout.last_name as player_out,
        pout.jersey_number as player_out_jersey,
        c.name as team_name,
        s.reason,
        s.created_at
      FROM substitutions s
      JOIN players pin ON s.player_in_id = pin.id
      JOIN players pout ON s.player_out_id = pout.id
      JOIN clubs c ON s.club_id = c.id
      WHERE s.game_id = $1
      ORDER BY s.created_at
    `, [gameId]);

    // Get all timeouts
    const timeoutsResult = await db.query(`
      SELECT 
        t.id,
        t.period,
        EXTRACT(EPOCH FROM t.time_remaining) as time_remaining_seconds,
        c.name as team_name,
        t.timeout_type,
        EXTRACT(EPOCH FROM t.duration) as duration_seconds,
        t.reason,
        t.called_by,
        t.created_at
      FROM timeouts t
      LEFT JOIN clubs c ON t.club_id = c.id
      WHERE t.game_id = $1
      ORDER BY t.created_at
    `, [gameId]);

    // Get all fouls (from game_events table)
    const foulsResult = await db.query(`
      SELECT 
        ge.id,
        ge.event_type,
        ge.period,
        EXTRACT(EPOCH FROM ge.time_remaining) as time_remaining_seconds,
        p.first_name || ' ' || p.last_name as player_name,
        p.jersey_number,
        c.name as team_name,
        ge.details,
        ge.created_at
      FROM game_events ge
      LEFT JOIN players p ON ge.player_id = p.id
      JOIN clubs c ON ge.club_id = c.id
      WHERE ge.game_id = $1 AND ge.event_type = 'foul'
      ORDER BY ge.created_at
    `, [gameId]);

    // Get player participation and minutes
    const participationResult = await db.query(`
      SELECT 
        p.first_name || ' ' || p.last_name as player_name,
        p.jersey_number,
        c.name as team_name,
        gr.is_captain,
        gr.is_starting,
        gr.starting_position,
        COALESCE(
          (SELECT COUNT(*) FROM shots s WHERE s.player_id = p.id AND s.game_id = $1),
          0
        ) as total_shots,
        COALESCE(
          (SELECT COUNT(*) FROM shots s WHERE s.player_id = p.id AND s.game_id = $1 AND s.result = 'goal'),
          0
        ) as goals
      FROM game_rosters gr
      JOIN players p ON gr.player_id = p.id
      JOIN clubs c ON gr.club_id = c.id
      WHERE gr.game_id = $1
      ORDER BY c.name, p.jersey_number
    `, [gameId]);

    // Build CSV content with multiple sections
    let csvContent = '';
    
    // Game Metadata Section
    csvContent += '=== GAME METADATA ===\n';
    csvContent += 'Field,Value\n';
    csvContent += `Game ID,${game.id}\n`;
    csvContent += `Date,${game.date}\n`;
    csvContent += `Home Team,${homeName}\n`;
    csvContent += `Away Team,${awayName}\n`;
    csvContent += `Home Score,${game.home_score}\n`;
    csvContent += `Away Score,${game.away_score}\n`;
    csvContent += `Status,${game.status}\n`;
    csvContent += `Number of Periods,${game.number_of_periods}\n`;
    csvContent += `Period Duration (seconds),${game.period_duration_seconds}\n`;
    csvContent += `Home Attacking Side,${game.home_attacking_side || 'N/A'}\n`;
    csvContent += '\n\n';

    // Shots Section
    csvContent += '=== SHOTS ===\n';
    const shotsHeaders = ['ID', 'Period', 'Time Remaining (seconds)', 'X Coord', 'Y Coord', 
      'Result', 'Shot Type', 'Distance', 'Player Name', 'Jersey Number', 
      'Team Name', 'Timestamp'];
    csvContent += arrayToCSV(shotsResult.rows, shotsHeaders);
    csvContent += '\n\n';

    // Substitutions Section
    csvContent += '=== SUBSTITUTIONS ===\n';
    const subsHeaders = ['ID', 'Period', 'Time Remaining (seconds)', 'Player In', 
      'Player In Jersey', 'Player Out', 'Player Out Jersey', 
      'Team Name', 'Reason', 'Timestamp'];
    csvContent += arrayToCSV(substitutionsResult.rows, subsHeaders);
    csvContent += '\n\n';

    // Timeouts Section
    csvContent += '=== TIMEOUTS ===\n';
    const timeoutsHeaders = ['ID', 'Period', 'Time Remaining (seconds)', 'Team Name', 
      'Timeout Type', 'Duration (seconds)', 'Reason', 
      'Called By', 'Timestamp'];
    csvContent += arrayToCSV(timeoutsResult.rows, timeoutsHeaders);
    csvContent += '\n\n';

    // Fouls Section
    csvContent += '=== FOULS ===\n';
    const foulsHeaders = ['ID', 'Event Type', 'Period', 'Time Remaining (seconds)', 
      'Player Name', 'Jersey Number', 'Team Name', 'Details', 'Timestamp'];
    csvContent += arrayToCSV(foulsResult.rows, foulsHeaders);
    csvContent += '\n\n';

    // Player Participation Section
    csvContent += '=== PLAYER PARTICIPATION ===\n';
    const participationHeaders = ['Player Name', 'Jersey Number', 'Team Name', 'Is Captain', 
      'Is Starting', 'Starting Position', 'Total Shots', 'Goals'];
    csvContent += arrayToCSV(participationResult.rows, participationHeaders);

    // Set response headers for CSV download
    const filename = `match_${gameId}_${homeName}_vs_${awayName}_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (err) {
    console.error('Error exporting match data:', err);
    res.status(500).json({ error: 'Failed to export match data' });
  }
});

/**
 * GET /api/export/season/csv
 * Export season data with optional filters
 * Query params: date_from, date_to, team_id, player_id, include (comma-separated: player_stats,team_stats,head_to_head,shot_zones,events)
 */
router.get('/season/csv', [
  query('date_from').optional().isISO8601().withMessage('Invalid date_from format'),
  query('date_to').optional().isISO8601().withMessage('Invalid date_to format'),
  query('team_id').optional().isInt().withMessage('Team ID must be an integer'),
  query('player_id').optional().isInt().withMessage('Player ID must be an integer'),
  query('include').optional().isString().withMessage('Include must be a comma-separated string')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { date_from, date_to, team_id, player_id, include } = req.query;
  const includeOptions = include ? include.split(',').map(s => s.trim()) : 
    ['player_stats', 'team_stats', 'head_to_head', 'shot_zones', 'events'];

  try {
    let csvContent = '';
    
    // Build base game filter
    let gameFilter = 'WHERE g.status = $1';
    const gameParams = ['completed'];
    let paramIndex = 2;

    if (date_from) {
      gameFilter += ` AND g.date >= $${paramIndex}`;
      gameParams.push(date_from);
      paramIndex++;
    }
    if (date_to) {
      gameFilter += ` AND g.date <= $${paramIndex}`;
      gameParams.push(date_to);
      paramIndex++;
    }
    if (team_id) {
      gameFilter += ` AND (g.home_team_id = $${paramIndex} OR g.away_team_id = $${paramIndex} OR g.home_club_id = $${paramIndex} OR g.away_club_id = $${paramIndex})`;
      gameParams.push(team_id);
      paramIndex++;
    }

    // Season Summary
    csvContent += '=== SEASON SUMMARY ===\n';
    csvContent += 'Field,Value\n';
    csvContent += `Export Date,${new Date().toISOString()}\n`;
    csvContent += `Date From,${date_from || 'All time'}\n`;
    csvContent += `Date To,${date_to || 'Present'}\n`;
    csvContent += `Team Filter,${team_id || 'All teams'}\n`;
    csvContent += `Player Filter,${player_id || 'All players'}\n`;
    csvContent += '\n\n';

    // Player Statistics
    if (includeOptions.includes('player_stats')) {
      let playerStatsQuery = `
        SELECT 
          p.id as player_id,
          p.first_name || ' ' || p.last_name as player_name,
          p.jersey_number,
          t.name as team_name,
          COUNT(DISTINCT s.game_id) as games_played,
          COUNT(s.id) as total_shots,
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals,
          COUNT(CASE WHEN s.result = 'miss' THEN 1 END) as misses,
          COUNT(CASE WHEN s.result = 'blocked' THEN 1 END) as blocked,
          ROUND(
            COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
            NULLIF(COUNT(s.id)::numeric, 0) * 100, 
            2
          ) as field_goal_percentage,
          ROUND(AVG(s.distance), 2) as avg_shot_distance
        FROM players p
        JOIN teams t ON p.team_id = t.id
        LEFT JOIN shots s ON s.player_id = p.id
        LEFT JOIN games g ON s.game_id = g.id
        ${gameFilter}
        GROUP BY p.id, p.first_name, p.last_name, p.jersey_number, t.name
        HAVING COUNT(s.id) > 0
      `;

      if (player_id) {
        // Use a parameter placeholder instead of direct interpolation
        playerStatsQuery += ` AND p.id = $${gameParams.length + 1}`;
        gameParams.push(player_id);
      }

      playerStatsQuery += ' ORDER BY goals DESC, total_shots DESC';

      const playerStatsResult = await db.query(playerStatsQuery, gameParams);

      csvContent += '=== PLAYER STATISTICS ===\n';
      const playerStatsHeaders = ['Player ID', 'Player Name', 'Jersey Number', 'Team Name', 
        'Games Played', 'Total Shots', 'Goals', 'Misses', 'Blocked',
        'Field Goal Percentage', 'Avg Shot Distance'];
      csvContent += arrayToCSV(playerStatsResult.rows, playerStatsHeaders);
      csvContent += '\n\n';
    }

    // Team Statistics
    if (includeOptions.includes('team_stats')) {
      // Build subquery filter for shots with proper parameter indexing
      let shotFilterClause = '';
      const shotFilterParams = [];
      let shotParamOffset = gameParams.length;
      
      if (date_from) {
        shotFilterClause += ` AND g2.date >= $${shotParamOffset + shotFilterParams.length + 1}`;
        shotFilterParams.push(date_from);
      }
      if (date_to) {
        shotFilterClause += ` AND g2.date <= $${shotParamOffset + shotFilterParams.length + 1}`;
        shotFilterParams.push(date_to);
      }
      
      // For the second subquery, parameters need different indices
      let shotFilterClause2 = '';
      if (date_from) {
        shotFilterClause2 += ` AND g2.date >= $${shotParamOffset + shotFilterParams.length + 1}`;
      }
      if (date_to) {
        shotFilterClause2 += ` AND g2.date <= $${shotParamOffset + shotFilterParams.length + 2}`;
      }
      
      const teamStatsQuery = `
        SELECT 
          c.id as team_id,
          c.name as team_name,
          COUNT(DISTINCT g.id) as games_played,
          SUM(CASE WHEN g.home_club_id = c.id THEN g.home_score ELSE g.away_score END) as total_goals_for,
          SUM(CASE WHEN g.home_club_id = c.id THEN g.away_score ELSE g.home_score END) as total_goals_against,
          COUNT(CASE 
            WHEN (g.home_club_id = c.id AND g.home_score > g.away_score) 
              OR (g.away_club_id = c.id AND g.away_score > g.home_score) 
            THEN 1 
          END) as wins,
          COUNT(CASE 
            WHEN (g.home_club_id = c.id AND g.home_score < g.away_score) 
              OR (g.away_club_id = c.id AND g.away_score < g.home_score) 
            THEN 1 
          END) as losses,
          COUNT(CASE WHEN g.home_score = g.away_score THEN 1 END) as draws,
          COALESCE(
            (SELECT COUNT(*) FROM shots s 
             JOIN games g2 ON s.game_id = g2.id 
             WHERE s.club_id = c.id AND g2.status = 'completed'${shotFilterClause}),
            0
          ) as total_shots,
          COALESCE(
            (SELECT COUNT(*) FROM shots s 
             JOIN games g2 ON s.game_id = g2.id 
             WHERE s.club_id = c.id AND s.result = 'goal' AND g2.status = 'completed'${shotFilterClause2}),
            0
          ) as shot_goals
        FROM clubs c
        LEFT JOIN games g ON (g.home_club_id = c.id OR g.away_club_id = c.id)
        ${gameFilter.replace('g.home_team_id', 'g.home_club_id').replace('g.away_team_id', 'g.away_club_id')}
        GROUP BY c.id, c.name
        HAVING COUNT(DISTINCT g.id) > 0
        ORDER BY wins DESC, total_goals_for DESC
      `;

      const teamStatsResult = await db.query(teamStatsQuery, [...gameParams, ...shotFilterParams, ...shotFilterParams]);

      csvContent += '=== TEAM STATISTICS ===\n';
      const teamStatsHeaders = ['Team ID', 'Team Name', 'Games Played', 'Total Goals For', 
        'Total Goals Against', 'Wins', 'Losses', 'Draws',
        'Total Shots', 'Shot Goals'];
      csvContent += arrayToCSV(teamStatsResult.rows, teamStatsHeaders);
      csvContent += '\n\n';
    }

    // Head-to-Head Records
    if (includeOptions.includes('head_to_head')) {
      const headToHeadQuery = `
        SELECT 
          hc.name as home_team,
          ac.name as away_team,
          COUNT(*) as games_played,
          SUM(CASE WHEN g.home_score > g.away_score THEN 1 ELSE 0 END) as home_wins,
          SUM(CASE WHEN g.away_score > g.home_score THEN 1 ELSE 0 END) as away_wins,
          SUM(CASE WHEN g.home_score = g.away_score THEN 1 ELSE 0 END) as draws,
          SUM(g.home_score) as total_home_goals,
          SUM(g.away_score) as total_away_goals
        FROM games g
        JOIN clubs hc ON g.home_club_id = hc.id
        JOIN clubs ac ON g.away_club_id = ac.id
        ${gameFilter.replace('g.home_team_id', 'g.home_club_id').replace('g.away_team_id', 'g.away_club_id')}
        GROUP BY hc.id, hc.name, ac.id, ac.name
        HAVING COUNT(*) > 0
        ORDER BY hc.name, ac.name
      `;

      const headToHeadResult = await db.query(headToHeadQuery, gameParams);

      csvContent += '=== HEAD-TO-HEAD RECORDS ===\n';
      const headToHeadHeaders = ['Home Team', 'Away Team', 'Games Played', 'Home Wins', 
        'Away Wins', 'Draws', 'Total Home Goals', 'Total Away Goals'];
      csvContent += arrayToCSV(headToHeadResult.rows, headToHeadHeaders);
      csvContent += '\n\n';
    }

    // Shot Accuracy by Zone/Distance
    if (includeOptions.includes('shot_zones')) {
      const shotZonesQuery = `
        SELECT 
          CASE 
            WHEN s.distance < 3 THEN '0-3m'
            WHEN s.distance >= 3 AND s.distance < 5 THEN '3-5m'
            WHEN s.distance >= 5 AND s.distance < 7 THEN '5-7m'
            WHEN s.distance >= 7 THEN '7m+'
            ELSE 'Unknown'
          END as distance_zone,
          CASE 
            WHEN s.x_coord < 33.33 THEN 'Left'
            WHEN s.x_coord >= 33.33 AND s.x_coord < 66.67 THEN 'Center'
            ELSE 'Right'
          END as court_zone,
          COUNT(*) as total_shots,
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals,
          ROUND(
            COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
            NULLIF(COUNT(*)::numeric, 0) * 100, 
            2
          ) as success_rate
        FROM shots s
        JOIN games g ON s.game_id = g.id
        ${gameFilter}
        GROUP BY distance_zone, court_zone
        ORDER BY distance_zone, court_zone
      `;

      const shotZonesResult = await db.query(shotZonesQuery, gameParams);

      csvContent += '=== SHOT ACCURACY BY ZONE/DISTANCE ===\n';
      const shotZonesHeaders = ['Distance Zone', 'Court Zone', 'Total Shots', 'Goals', 'Success Rate'];
      csvContent += arrayToCSV(shotZonesResult.rows, shotZonesHeaders);
      csvContent += '\n\n';
    }

    // Timeline of Events
    if (includeOptions.includes('events')) {
      const eventsQuery = `
        SELECT 
          'Shot' as event_type,
          g.date as game_date,
          hc.name || ' vs ' || ac.name as matchup,
          s.period,
          EXTRACT(EPOCH FROM s.time_remaining) as time_remaining_seconds,
          p.first_name || ' ' || p.last_name as player_name,
          c.name as team_name,
          s.result as event_details,
          s.created_at as timestamp
        FROM shots s
        JOIN games g ON s.game_id = g.id
        JOIN clubs hc ON g.home_club_id = hc.id
        JOIN clubs ac ON g.away_club_id = ac.id
        JOIN players p ON s.player_id = p.id
        JOIN clubs c ON s.club_id = c.id
        ${gameFilter.replace('g.home_team_id', 'g.home_club_id').replace('g.away_team_id', 'g.away_club_id')}
        
        UNION ALL
        
        SELECT 
          'Substitution' as event_type,
          g.date as game_date,
          hc.name || ' vs ' || ac.name as matchup,
          sub.period,
          EXTRACT(EPOCH FROM sub.time_remaining) as time_remaining_seconds,
          pin.first_name || ' ' || pin.last_name || ' in for ' || 
          pout.first_name || ' ' || pout.last_name as player_name,
          c.name as team_name,
          COALESCE(sub.reason, 'N/A') as event_details,
          sub.created_at as timestamp
        FROM substitutions sub
        JOIN games g ON sub.game_id = g.id
        JOIN clubs hc ON g.home_club_id = hc.id
        JOIN clubs ac ON g.away_club_id = ac.id
        JOIN players pin ON sub.player_in_id = pin.id
        JOIN players pout ON sub.player_out_id = pout.id
        JOIN clubs c ON sub.club_id = c.id
        ${gameFilter.replace('g.home_team_id', 'g.home_club_id').replace('g.away_team_id', 'g.away_club_id')}
        
        UNION ALL
        
        SELECT 
          'Timeout' as event_type,
          g.date as game_date,
          hc.name || ' vs ' || ac.name as matchup,
          timeout.period,
          EXTRACT(EPOCH FROM timeout.time_remaining) as time_remaining_seconds,
          COALESCE(timeout.called_by, 'N/A') as player_name,
          COALESCE(c.name, 'N/A') as team_name,
          timeout.timeout_type as event_details,
          timeout.created_at as timestamp
        FROM timeouts timeout
        JOIN games g ON timeout.game_id = g.id
        JOIN clubs hc ON g.home_club_id = hc.id
        JOIN clubs ac ON g.away_club_id = ac.id
        LEFT JOIN clubs c ON timeout.club_id = c.id
        ${gameFilter.replace('g.home_team_id', 'g.home_club_id').replace('g.away_team_id', 'g.away_club_id')}
        
        UNION ALL
        
        SELECT 
          'Foul' as event_type,
          g.date as game_date,
          hc.name || ' vs ' || ac.name as matchup,
          ge.period,
          EXTRACT(EPOCH FROM ge.time_remaining) as time_remaining_seconds,
          COALESCE(p.first_name || ' ' || p.last_name, 'N/A') as player_name,
          c.name as team_name,
          COALESCE(ge.details::text, 'N/A') as event_details,
          ge.created_at as timestamp
        FROM game_events ge
        JOIN games g ON ge.game_id = g.id
        JOIN clubs hc ON g.home_club_id = hc.id
        JOIN clubs ac ON g.away_club_id = ac.id
        LEFT JOIN players p ON ge.player_id = p.id
        JOIN clubs c ON ge.club_id = c.id
        WHERE ge.event_type = 'foul' ${gameFilter.replace('WHERE g.', 'AND g.').replace('g.home_team_id', 'g.home_club_id').replace('g.away_team_id', 'g.away_club_id')}
        
        ORDER BY timestamp DESC
        LIMIT 1000
      `;

      const eventsResult = await db.query(eventsQuery, gameParams);

      csvContent += '=== TIMELINE OF EVENTS ===\n';
      const eventsHeaders = ['Event Type', 'Game Date', 'Matchup', 'Period', 
        'Time Remaining (seconds)', 'Player Name', 'Team Name', 
        'Event Details', 'Timestamp'];
      csvContent += arrayToCSV(eventsResult.rows, eventsHeaders);
    }

    // Set response headers for CSV download
    const filename = `season_export_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (err) {
    console.error('Error exporting season data:', err);
    res.status(500).json({ error: 'Failed to export season data' });
  }
});

/**
 * GET /api/export/games/csv
 * Bulk export multiple games with filters
 * Query params: game_ids (comma-separated), date_from, date_to, team_id, columns (comma-separated)
 */
router.get('/games/csv', [
  query('game_ids').optional().isString().withMessage('Game IDs must be comma-separated integers'),
  query('date_from').optional().isISO8601().withMessage('Invalid date_from format'),
  query('date_to').optional().isISO8601().withMessage('Invalid date_to format'),
  query('team_id').optional().isInt().withMessage('Team ID must be an integer'),
  query('club_id').optional().isInt().withMessage('Club ID must be an integer'),
  query('columns').optional().isString().withMessage('Columns must be comma-separated string')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { game_ids, date_from, date_to, team_id, club_id, columns } = req.query;
  const includeColumns = columns ? columns.split(',').map(s => s.trim()) : 
    ['shots', 'substitutions', 'timeouts', 'fouls', 'participation'];

  try {
    // Build game filter
    let gameFilter = 'WHERE 1=1';
    const gameParams = [];
    let paramIndex = 1;

    if (game_ids) {
      const ids = game_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (ids.length > 0) {
        gameFilter += ` AND g.id = ANY($${paramIndex}::int[])`;
        gameParams.push(ids);
        paramIndex++;
      }
    }

    if (date_from) {
      gameFilter += ` AND g.date >= $${paramIndex}`;
      gameParams.push(date_from);
      paramIndex++;
    }

    if (date_to) {
      gameFilter += ` AND g.date <= $${paramIndex}`;
      gameParams.push(date_to);
      paramIndex++;
    }

    if (team_id) {
      gameFilter += ` AND (g.home_team_id = $${paramIndex} OR g.away_team_id = $${paramIndex})`;
      gameParams.push(team_id);
      paramIndex++;
    }

    if (club_id) {
      gameFilter += ` AND (g.home_club_id = $${paramIndex} OR g.away_club_id = $${paramIndex})`;
      gameParams.push(club_id);
      paramIndex++;
    }

    // Get matching games
    const gamesQuery = `
      SELECT 
        g.id,
        g.date,
        hc.name as home_team_name,
        ac.name as away_team_name,
        g.home_score,
        g.away_score,
        g.status
      FROM games g
      LEFT JOIN clubs hc ON g.home_club_id = hc.id
      LEFT JOIN clubs ac ON g.away_club_id = ac.id
      ${gameFilter}
      ORDER BY g.date DESC
    `;

    const gamesResult = await db.query(gamesQuery, gameParams);

    if (gamesResult.rows.length === 0) {
      return res.status(404).json({ error: 'No games found matching the criteria' });
    }

    let csvContent = '';

    // Export Summary
    csvContent += '=== BULK GAMES EXPORT ===\n';
    csvContent += 'Field,Value\n';
    csvContent += `Export Date,${new Date().toISOString()}\n`;
    csvContent += `Total Games,${gamesResult.rows.length}\n`;
    csvContent += `Date From,${date_from || 'All time'}\n`;
    csvContent += `Date To,${date_to || 'Present'}\n`;
    const filterLabel = club_id ? `Club ${club_id}` : team_id ? `Team ${team_id}` : 'All teams';
    csvContent += `Team Filter,${filterLabel}\n`;
    csvContent += '\n\n';

    // Games List
    csvContent += '=== GAMES LIST ===\n';
    const gamesHeaders = ['ID', 'Date', 'Home Team Name', 'Away Team Name', 'Home Score', 'Away Score', 'Status'];
    csvContent += arrayToCSV(gamesResult.rows, gamesHeaders);
    csvContent += '\n\n';

    const gameIds = gamesResult.rows.map(g => g.id);

    // Shots data
    if (includeColumns.includes('shots')) {
      const shotsQuery = `
        SELECT 
          s.game_id,
          g.date as game_date,
          hc.name || ' vs ' || ac.name as matchup,
          s.period,
          EXTRACT(EPOCH FROM s.time_remaining) as time_remaining_seconds,
          s.x_coord,
          s.y_coord,
          s.result,
          s.shot_type,
          s.distance,
          p.first_name || ' ' || p.last_name as player_name,
          p.jersey_number,
          c.name as team_name
        FROM shots s
        JOIN games g ON s.game_id = g.id
        JOIN clubs hc ON g.home_club_id = hc.id
        JOIN clubs ac ON g.away_club_id = ac.id
        JOIN players p ON s.player_id = p.id
        JOIN clubs c ON s.club_id = c.id
        WHERE s.game_id = ANY($1::int[])
        ORDER BY g.date, s.created_at
      `;
      const shotsResult = await db.query(shotsQuery, [gameIds]);

      csvContent += '=== SHOTS (ALL GAMES) ===\n';
      const shotsHeaders = ['Game ID', 'Game Date', 'Matchup', 'Period', 'Time Remaining (seconds)',
        'X Coord', 'Y Coord', 'Result', 'Shot Type', 'Distance', 
        'Player Name', 'Jersey Number', 'Team Name'];
      csvContent += arrayToCSV(shotsResult.rows, shotsHeaders);
      csvContent += '\n\n';
    }

    // Substitutions data
    if (includeColumns.includes('substitutions')) {
      const subsQuery = `
        SELECT 
          s.game_id,
          g.date as game_date,
          hc.name || ' vs ' || ac.name as matchup,
          s.period,
          EXTRACT(EPOCH FROM s.time_remaining) as time_remaining_seconds,
          pin.first_name || ' ' || pin.last_name as player_in,
          pin.jersey_number as player_in_jersey,
          pout.first_name || ' ' || pout.last_name as player_out,
          pout.jersey_number as player_out_jersey,
          c.name as team_name,
          s.reason
        FROM substitutions s
        JOIN games g ON s.game_id = g.id
        JOIN clubs hc ON g.home_club_id = hc.id
        JOIN clubs ac ON g.away_club_id = ac.id
        JOIN players pin ON s.player_in_id = pin.id
        JOIN players pout ON s.player_out_id = pout.id
        JOIN clubs c ON s.club_id = c.id
        WHERE s.game_id = ANY($1::int[])
        ORDER BY g.date, s.created_at
      `;
      const subsResult = await db.query(subsQuery, [gameIds]);

      csvContent += '=== SUBSTITUTIONS (ALL GAMES) ===\n';
      const subsHeaders = ['Game ID', 'Game Date', 'Matchup', 'Period', 'Time Remaining (seconds)',
        'Player In', 'Player In Jersey', 'Player Out', 'Player Out Jersey', 
        'Team Name', 'Reason'];
      csvContent += arrayToCSV(subsResult.rows, subsHeaders);
      csvContent += '\n\n';
    }

    // Timeouts data
    if (includeColumns.includes('timeouts')) {
      const timeoutsQuery = `
        SELECT 
          t.game_id,
          g.date as game_date,
          hc.name || ' vs ' || ac.name as matchup,
          t.period,
          EXTRACT(EPOCH FROM t.time_remaining) as time_remaining_seconds,
          COALESCE(c.name, 'N/A') as team_name,
          t.timeout_type,
          EXTRACT(EPOCH FROM t.duration) as duration_seconds,
          t.reason,
          t.called_by
        FROM timeouts t
        JOIN games g ON t.game_id = g.id
        JOIN clubs hc ON g.home_club_id = hc.id
        JOIN clubs ac ON g.away_club_id = ac.id
        LEFT JOIN clubs c ON t.club_id = c.id
        WHERE t.game_id = ANY($1::int[])
        ORDER BY g.date, t.created_at
      `;
      const timeoutsResult = await db.query(timeoutsQuery, [gameIds]);

      csvContent += '=== TIMEOUTS (ALL GAMES) ===\n';
      const timeoutsHeaders = ['Game ID', 'Game Date', 'Matchup', 'Period', 'Time Remaining (seconds)',
        'Team Name', 'Timeout Type', 'Duration (seconds)', 'Reason', 'Called By'];
      csvContent += arrayToCSV(timeoutsResult.rows, timeoutsHeaders);
      csvContent += '\n\n';
    }

    // Fouls data
    if (includeColumns.includes('fouls')) {
      const foulsQuery = `
        SELECT 
          ge.game_id,
          g.date as game_date,
          hc.name || ' vs ' || ac.name as matchup,
          ge.period,
          EXTRACT(EPOCH FROM ge.time_remaining) as time_remaining_seconds,
          COALESCE(p.first_name || ' ' || p.last_name, 'N/A') as player_name,
          COALESCE(p.jersey_number::text, 'N/A') as jersey_number,
          c.name as team_name,
          COALESCE(ge.details::text, 'N/A') as details
        FROM game_events ge
        JOIN games g ON ge.game_id = g.id
        JOIN clubs hc ON g.home_club_id = hc.id
        JOIN clubs ac ON g.away_club_id = ac.id
        LEFT JOIN players p ON ge.player_id = p.id
        JOIN clubs c ON ge.club_id = c.id
        WHERE ge.game_id = ANY($1::int[]) AND ge.event_type = 'foul'
        ORDER BY g.date, ge.created_at
      `;
      const foulsResult = await db.query(foulsQuery, [gameIds]);

      csvContent += '=== FOULS (ALL GAMES) ===\n';
      const foulsHeaders = ['Game ID', 'Game Date', 'Matchup', 'Period', 'Time Remaining (seconds)',
        'Player Name', 'Jersey Number', 'Team Name', 'Details'];
      csvContent += arrayToCSV(foulsResult.rows, foulsHeaders);
      csvContent += '\n\n';
    }

    // Player participation data
    if (includeColumns.includes('participation')) {
      const participationQuery = `
        SELECT 
          gr.game_id,
          g.date as game_date,
          hc.name || ' vs ' || ac.name as matchup,
          p.first_name || ' ' || p.last_name as player_name,
          p.jersey_number,
          c.name as team_name,
          gr.is_captain,
          gr.is_starting,
          gr.starting_position,
          COALESCE(
            (SELECT COUNT(*) FROM shots s WHERE s.player_id = p.id AND s.game_id = gr.game_id),
            0
          ) as total_shots,
          COALESCE(
            (SELECT COUNT(*) FROM shots s WHERE s.player_id = p.id AND s.game_id = gr.game_id AND s.result = 'goal'),
            0
          ) as goals
        FROM game_rosters gr
        JOIN games g ON gr.game_id = g.id
        JOIN clubs hc ON g.home_club_id = hc.id
        JOIN clubs ac ON g.away_club_id = ac.id
        JOIN players p ON gr.player_id = p.id
        JOIN clubs c ON gr.club_id = c.id
        WHERE gr.game_id = ANY($1::int[])
        ORDER BY g.date, c.name, p.jersey_number
      `;
      const participationResult = await db.query(participationQuery, [gameIds]);

      csvContent += '=== PLAYER PARTICIPATION (ALL GAMES) ===\n';
      const participationHeaders = ['Game ID', 'Game Date', 'Matchup', 'Player Name', 'Jersey Number',
        'Team Name', 'Is Captain', 'Is Starting', 'Starting Position', 
        'Total Shots', 'Goals'];
      csvContent += arrayToCSV(participationResult.rows, participationHeaders);
    }

    // Set response headers for CSV download
    const filename = `games_export_${gamesResult.rows.length}_games_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (err) {
    console.error('Error exporting games data:', err);
    res.status(500).json({ error: 'Failed to export games data' });
  }
});

export default router;
