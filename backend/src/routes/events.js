import express from 'express';
import { body, query, validationResult } from 'express-validator';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

/**
 * Get all events for a game with optional filtering
 * GET /api/events/:gameId
 * Query params: event_type, team_id, player_id, period
 */
router.get('/:gameId', [
  query('event_type')
    .optional()
    .isIn([
      'foul', 'substitution', 'timeout', 'period_start', 'period_end',
      'fault_offensive', 'fault_defensive', 'fault_out_of_bounds',
      'free_shot', 'timeout_team', 'timeout_injury', 'timeout_official',
      'match_commentary'
    ])
    .withMessage('Invalid event type'),
  query('team_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Team ID must be a positive integer'),
  query('player_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Player ID must be a positive integer'),
  query('period')
    .optional()
    .isInt({ min: 1, max: 4 })
    .withMessage('Period must be between 1 and 4')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { gameId } = req.params;
  const { event_type, team_id, player_id, period } = req.query;

  try {
    let queryText = `
      SELECT 
        e.*,
        p.first_name,
        p.last_name,
        p.jersey_number,
        t.name as team_name
      FROM game_events e
      JOIN teams t ON e.team_id = t.id
      LEFT JOIN players p ON e.player_id = p.id
      WHERE e.game_id = $1
    `;
    const params = [gameId];
    let paramIndex = 2;

    if (event_type) {
      queryText += ` AND e.event_type = $${paramIndex}`;
      params.push(event_type);
      paramIndex++;
    }

    if (team_id) {
      queryText += ` AND e.team_id = $${paramIndex}`;
      params.push(team_id);
      paramIndex++;
    }

    if (player_id) {
      queryText += ` AND e.player_id = $${paramIndex}`;
      params.push(player_id);
      paramIndex++;
    }

    if (period) {
      queryText += ` AND e.period = $${paramIndex}`;
      params.push(period);
      paramIndex++;
    }

    queryText += ' ORDER BY e.created_at DESC';

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

/**
 * Create a new game event
 * POST /api/events/:gameId
 * Body: { event_type, player_id?, team_id, period, time_remaining?, details? }
 */
router.post('/:gameId', [
  requireRole(['admin', 'coach']),
  body('event_type')
    .notEmpty()
    .isIn([
      'foul', 'substitution', 'timeout', 'period_start', 'period_end',
      'fault_offensive', 'fault_defensive', 'fault_out_of_bounds',
      'free_shot', 'timeout_team', 'timeout_injury', 'timeout_official',
      'match_commentary'
    ])
    .withMessage('Event type must be one of: foul, substitution, timeout, period_start, period_end, fault_offensive, fault_defensive, fault_out_of_bounds, free_shot, timeout_team, timeout_injury, timeout_official, match_commentary'),
  body('team_id')
    .notEmpty()
    .isInt({ min: 1 })
    .withMessage('Team ID must be a positive integer'),
  body('player_id')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('Player ID must be a positive integer'),
  body('period')
    .notEmpty()
    .isInt({ min: 1, max: 4 })
    .withMessage('Period must be between 1 and 4'),
  body('time_remaining')
    .optional({ nullable: true })
    .isString()
    .withMessage('Time remaining must be a string in interval format'),
  body('details')
    .optional({ nullable: true })
    .isObject()
    .withMessage('Details must be a valid JSON object')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { gameId } = req.params;
  const { event_type, player_id, team_id, period, time_remaining, details } = req.body;

  try {
    // Verify game exists and is in progress
    const gameResult = await db.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = gameResult.rows[0];
    if (game.status !== 'in_progress') {
      return res.status(400).json({ 
        error: 'Cannot add events to game that is not in progress',
        currentStatus: game.status
      });
    }

    // Verify team is participating in the game
    if (team_id !== game.home_team_id && team_id !== game.away_team_id) {
      return res.status(400).json({ 
        error: 'Team is not participating in this game',
        gameTeams: { home: game.home_team_id, away: game.away_team_id },
        providedTeam: team_id
      });
    }

    // If player_id is provided, verify player belongs to the team
    if (player_id) {
      const playerResult = await db.query(
        'SELECT * FROM players WHERE id = $1',
        [player_id]
      );

      if (playerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Player not found' });
      }

      if (playerResult.rows[0].team_id !== team_id) {
        return res.status(400).json({ 
          error: 'Player does not belong to the specified team',
          playerTeam: playerResult.rows[0].team_id,
          providedTeam: team_id
        });
      }
    }

    // Validate fault event details
    if (event_type.startsWith('fault_') && details && details.reason) {
      const validFaultReasons = [
        'running_with_ball', 'hindering_shot', 'ball_out',
        'traveling', 'offensive_foul', 'defensive_foul', 'illegal_contact',
        'out_of_bounds', 'shot_clock_violation', 'technical_foul'
      ];
      
      if (!validFaultReasons.includes(details.reason)) {
        return res.status(400).json({ 
          error: 'Invalid fault reason',
          providedReason: details.reason,
          validReasons: validFaultReasons
        });
      }
    }

    // Insert the event
    const insertQuery = `
      INSERT INTO game_events (game_id, event_type, player_id, team_id, period, time_remaining, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await db.query(insertQuery, [
      gameId,
      event_type,
      player_id || null,
      team_id,
      period,
      time_remaining || null,
      details ? JSON.stringify(details) : null
    ]);

    // Fetch the complete event with joined data
    const eventResult = await db.query(`
      SELECT 
        e.*,
        p.first_name,
        p.last_name,
        p.jersey_number,
        t.name as team_name
      FROM game_events e
      JOIN teams t ON e.team_id = t.id
      LEFT JOIN players p ON e.player_id = p.id
      WHERE e.id = $1
    `, [result.rows[0].id]);

    res.status(201).json(eventResult.rows[0]);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

/**
 * Update an event
 * PUT /api/events/:gameId/:eventId
 * Body: { event_type?, player_id?, team_id?, period?, time_remaining?, details? }
 */
router.put('/:gameId/:eventId', [
  requireRole(['admin', 'coach']),
  body('event_type')
    .optional()
    .isIn([
      'foul', 'substitution', 'timeout', 'period_start', 'period_end',
      'fault_offensive', 'fault_defensive', 'fault_out_of_bounds',
      'free_shot', 'timeout_team', 'timeout_injury', 'timeout_official',
      'match_commentary'
    ])
    .withMessage('Event type must be one of: foul, substitution, timeout, period_start, period_end, fault_offensive, fault_defensive, fault_out_of_bounds, free_shot, timeout_team, timeout_injury, timeout_official, match_commentary'),
  body('team_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Team ID must be a positive integer'),
  body('player_id')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('Player ID must be a positive integer'),
  body('period')
    .optional()
    .isInt({ min: 1, max: 4 })
    .withMessage('Period must be between 1 and 4'),
  body('time_remaining')
    .optional({ nullable: true })
    .isString()
    .withMessage('Time remaining must be a string in interval format'),
  body('details')
    .optional({ nullable: true })
    .isObject()
    .withMessage('Details must be a valid JSON object')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { gameId, eventId } = req.params;
  const { event_type, player_id, team_id, period, time_remaining, details } = req.body;

  try {
    // Verify event exists
    const eventResult = await db.query(
      'SELECT * FROM game_events WHERE id = $1 AND game_id = $2',
      [eventId, gameId]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Build dynamic update query
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (event_type !== undefined) {
      updates.push(`event_type = $${paramIndex}`);
      params.push(event_type);
      paramIndex++;
    }

    if (team_id !== undefined) {
      updates.push(`team_id = $${paramIndex}`);
      params.push(team_id);
      paramIndex++;
    }

    if (player_id !== undefined) {
      updates.push(`player_id = $${paramIndex}`);
      params.push(player_id || null);
      paramIndex++;
    }

    if (period !== undefined) {
      updates.push(`period = $${paramIndex}`);
      params.push(period);
      paramIndex++;
    }

    if (time_remaining !== undefined) {
      updates.push(`time_remaining = $${paramIndex}`);
      params.push(time_remaining || null);
      paramIndex++;
    }

    if (details !== undefined) {
      updates.push(`details = $${paramIndex}`);
      params.push(details ? JSON.stringify(details) : null);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(eventId);
    const updateQuery = `
      UPDATE game_events 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    await db.query(updateQuery, params);

    // Fetch the complete event with joined data
    const updatedResult = await db.query(`
      SELECT 
        e.*,
        p.first_name,
        p.last_name,
        p.jersey_number,
        t.name as team_name
      FROM game_events e
      JOIN teams t ON e.team_id = t.id
      LEFT JOIN players p ON e.player_id = p.id
      WHERE e.id = $1
    `, [eventId]);

    res.json(updatedResult.rows[0]);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

/**
 * Delete an event
 * DELETE /api/events/:gameId/:eventId
 */
router.delete('/:gameId/:eventId', [
  requireRole(['admin', 'coach'])
], async (req, res) => {
  const { gameId, eventId } = req.params;

  try {
    // Verify event exists
    const eventResult = await db.query(
      'SELECT * FROM game_events WHERE id = $1 AND game_id = $2',
      [eventId, gameId]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Delete the event
    await db.query('DELETE FROM game_events WHERE id = $1', [eventId]);

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

/**
 * Get comprehensive events from all Enhanced Match Events tables
 * GET /api/events/comprehensive/:gameId
 * Query params: type, period
 */
router.get('/comprehensive/:gameId', [
  query('type')
    .optional()
    .isString()
    .withMessage('Type filter must be a string'),
  query('period')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Period must be between 1 and 10')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { gameId } = req.params;
  const { type, period } = req.query;

  try {
    const allEvents = [];

    // Query game_events
    let gameEventsQuery = `
      SELECT 
        'game_event' as source_table,
        ge.id,
        ge.game_id,
        ge.event_type as type,
        ge.team_id,
        ge.player_id,
        ge.period,
        ge.time_remaining,
        ge.details,
        ge.created_at,
        t.name as team_name,
        p.first_name,
        p.last_name,
        p.jersey_number
      FROM game_events ge
      JOIN teams t ON ge.team_id = t.id
      LEFT JOIN players p ON ge.player_id = p.id
      WHERE ge.game_id = $1
    `;
    let params = [gameId];
    let paramIndex = 2;

    if (type && (type.startsWith('fault_') || type === 'substitution' || type === 'period_start' || type === 'period_end')) {
      gameEventsQuery += ` AND ge.event_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (period) {
      gameEventsQuery += ` AND ge.period = $${paramIndex}`;
      params.push(period);
      paramIndex++;
    }

    const gameEventsResult = await db.query(gameEventsQuery, params);
    allEvents.push(...gameEventsResult.rows);

    // Query free_shots
    if (!type || type.startsWith('free_shot_')) {
      let freeShotsQuery = `
        SELECT 
          'free_shot' as source_table,
          fs.id,
          fs.game_id,
          CONCAT('free_shot_', fs.free_shot_type) as type,
          fs.team_id,
          fs.player_id,
          fs.period,
          fs.time_remaining,
          jsonb_build_object(
            'result', fs.result,
            'reason', fs.reason,
            'x_coord', fs.x_coord,
            'y_coord', fs.y_coord,
            'distance', fs.distance
          ) as details,
          fs.created_at,
          t.name as team_name,
          p.first_name,
          p.last_name,
          p.jersey_number
        FROM free_shots fs
        JOIN teams t ON fs.team_id = t.id
        JOIN players p ON fs.player_id = p.id
        WHERE fs.game_id = $1
      `;
      let fsParams = [gameId];
      let fsParamIndex = 2;

      if (type && type.startsWith('free_shot_')) {
        const freeShotType = type.replace('free_shot_', '');
        freeShotsQuery += ` AND fs.free_shot_type = $${fsParamIndex}`;
        fsParams.push(freeShotType);
        fsParamIndex++;
      }

      if (period) {
        freeShotsQuery += ` AND fs.period = $${fsParamIndex}`;
        fsParams.push(period);
      }

      const freeShotsResult = await db.query(freeShotsQuery, fsParams);
      allEvents.push(...freeShotsResult.rows);
    }

    // Query timeouts
    if (!type || type.startsWith('timeout_')) {
      let timeoutsQuery = `
        SELECT 
          'timeout' as source_table,
          t.id,
          t.game_id,
          CONCAT('timeout_', t.timeout_type) as type,
          t.team_id,
          NULL as player_id,
          t.period,
          t.time_remaining,
          jsonb_build_object(
            'duration', t.duration,
            'reason', t.reason,
            'called_by', t.called_by,
            'ended_at', t.ended_at
          ) as details,
          t.created_at,
          teams.name as team_name,
          NULL as first_name,
          NULL as last_name,
          NULL as jersey_number
        FROM timeouts t
        LEFT JOIN teams ON t.team_id = teams.id
        WHERE t.game_id = $1
      `;
      let toParams = [gameId];
      let toParamIndex = 2;

      if (type && type.startsWith('timeout_')) {
        const timeoutType = type.replace('timeout_', '');
        timeoutsQuery += ` AND t.timeout_type = $${toParamIndex}`;
        toParams.push(timeoutType);
        toParamIndex++;
      }

      if (period) {
        timeoutsQuery += ` AND t.period = $${toParamIndex}`;
        toParams.push(period);
      }

      const timeoutsResult = await db.query(timeoutsQuery, toParams);
      allEvents.push(...timeoutsResult.rows);
    }

    // Query match_commentary
    if (!type || type.startsWith('commentary_')) {
      let commentaryQuery = `
        SELECT 
          'commentary' as source_table,
          mc.id,
          mc.game_id,
          CONCAT('commentary_', mc.commentary_type) as type,
          NULL as team_id,
          NULL as player_id,
          mc.period,
          mc.time_remaining,
          jsonb_build_object(
            'title', mc.title,
            'content', mc.content,
            'created_by', mc.created_by
          ) as details,
          mc.created_at,
          NULL as team_name,
          NULL as first_name,
          NULL as last_name,
          NULL as jersey_number
        FROM match_commentary mc
        WHERE mc.game_id = $1
      `;
      let mcParams = [gameId];
      let mcParamIndex = 2;

      if (type && type.startsWith('commentary_')) {
        const commentaryType = type.replace('commentary_', '');
        commentaryQuery += ` AND mc.commentary_type = $${mcParamIndex}`;
        mcParams.push(commentaryType);
        mcParamIndex++;
      }

      if (period) {
        commentaryQuery += ` AND mc.period = $${mcParamIndex}`;
        mcParams.push(period);
      }

      const commentaryResult = await db.query(commentaryQuery, mcParams);
      allEvents.push(...commentaryResult.rows);
    }

    // Sort all events by created_at descending
    allEvents.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(allEvents);
  } catch (error) {
    console.error('Error fetching comprehensive events:', error);
    res.status(500).json({ error: 'Failed to fetch comprehensive events' });
  }
});

export default router;
