import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// Default match configuration constants
const DEFAULT_NUMBER_OF_PERIODS = 4;
const DEFAULT_OVERTIME_ENABLED = false;
const DEFAULT_MAX_OVERTIME_PERIODS = 2;

/**
 * Helper function to parse PostgreSQL interval to seconds
 * PostgreSQL intervals can be returned as objects with various properties
 */
function intervalToSeconds(interval) {
  if (!interval) return 0;
  
  console.log('intervalToSeconds input:', { interval, type: typeof interval });
  
  // If it's already a number, return it
  if (typeof interval === 'number') return interval;
  
  // If it's an object with time components
  if (typeof interval === 'object') {
    // PostgreSQL node-pg returns intervals as objects with properties like:
    // { years, months, days, hours, minutes, seconds, milliseconds }
    // Note: milliseconds might represent the TOTAL time in ms, not additional ms!
    
    // Check if it's a simple time-only interval (no days/months/years)
    const hasTimeComponents = ('hours' in interval || 'minutes' in interval || 'seconds' in interval);
    const hasMilliseconds = 'milliseconds' in interval;
    
    if (hasMilliseconds && !hasTimeComponents) {
      // If ONLY milliseconds is present, it's the total duration
      const totalSeconds = Math.floor(interval.milliseconds / 1000);
      console.log('intervalToSeconds: milliseconds-only format', { 
        interval, 
        totalSeconds 
      });
      return totalSeconds;
    }
    
    // Otherwise, sum up all components
    const hours = parseInt(interval.hours) || 0;
    const minutes = parseInt(interval.minutes) || 0;
    const seconds = parseInt(interval.seconds) || 0;
    const days = parseInt(interval.days) || 0;
    
    // Convert everything to seconds (don't add milliseconds separately)
    const totalSeconds = 
      (days * 86400) +  // days to seconds
      (hours * 3600) +  // hours to seconds
      (minutes * 60) +  // minutes to seconds
      seconds;          // seconds
    
    console.log('intervalToSeconds: object format', { 
      interval, 
      parsed: { days, hours, minutes, seconds },
      totalSeconds 
    });
    return totalSeconds;
  }
  
  // If it's a string like "00:10:00" (HH:MM:SS) or "01:00:00"
  if (typeof interval === 'string') {
    const parts = interval.split(':');
    if (parts.length === 3) {
      const hours = parseInt(parts[0]) || 0;
      const minutes = parseInt(parts[1]) || 0;
      const seconds = parseInt(parts[2]) || 0;
      const totalSeconds = hours * 3600 + minutes * 60 + seconds;
      console.log('intervalToSeconds: string format', { interval, parts, totalSeconds });
      return totalSeconds;
    }
  }
  
  console.log('intervalToSeconds: unknown format', { interval, type: typeof interval });
  return 0;
}

/**
 * Get timer state for a game
 * GET /api/timer/:gameId
 */
router.get('/:gameId', async (req, res) => {
  const { gameId } = req.params;

  try {
    const result = await db.query(
      `SELECT 
        id,
        current_period,
        period_duration,
        time_remaining,
        timer_state,
        timer_started_at,
        timer_paused_at
      FROM games 
      WHERE id = $1`,
      [gameId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = result.rows[0];

    console.log('Timer GET - Raw game data:', {
      period_duration: game.period_duration,
      period_duration_type: typeof game.period_duration,
      time_remaining: game.time_remaining,
      time_remaining_type: typeof game.time_remaining,
      timer_state: game.timer_state
    });

    // Calculate current time remaining if timer is running
    let currentTimeRemaining = game.time_remaining;
    
    if (game.timer_state === 'running' && game.timer_started_at) {
      const elapsed = Date.now() - new Date(game.timer_started_at).getTime();
      const elapsedSeconds = Math.floor(elapsed / 1000);
      
      // Convert intervals to seconds
      const startingSeconds = game.time_remaining 
        ? intervalToSeconds(game.time_remaining)
        : intervalToSeconds(game.period_duration);
      
      console.log('Timer GET - Calculated:', {
        elapsed,
        elapsedSeconds,
        startingSeconds,
        remainingSeconds: Math.max(0, startingSeconds - elapsedSeconds)
      });
      
      const remainingSeconds = Math.max(0, startingSeconds - elapsedSeconds);
      currentTimeRemaining = {
        minutes: Math.floor(remainingSeconds / 60),
        seconds: remainingSeconds % 60
      };
    }

    res.json({
      game_id: game.id,
      current_period: game.current_period,
      period_duration: game.period_duration,
      time_remaining: currentTimeRemaining,
      timer_state: game.timer_state,
      timer_started_at: game.timer_started_at,
      timer_paused_at: game.timer_paused_at
    });
  } catch (error) {
    console.error('Error fetching timer state:', error);
    res.status(500).json({ error: 'Failed to fetch timer state' });
  }
});

/**
 * Start or resume the game timer
 * POST /api/timer/:gameId/start
 */
router.post('/:gameId/start', [
  requireRole(['admin', 'coach'])
], async (req, res) => {
  const { gameId } = req.params;

  try {
    // Get current game state
    const gameResult = await db.query('SELECT * FROM games WHERE id = $1', [gameId]);
    
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = gameResult.rows[0];

    console.log('Timer START - Game state:', {
      period_duration: game.period_duration,
      period_duration_type: typeof game.period_duration,
      time_remaining: game.time_remaining,
      timer_state: game.timer_state
    });

    // Can only start timer if game is in progress
    if (game.status !== 'in_progress') {
      return res.status(400).json({ 
        error: 'Cannot start timer for game that is not in progress',
        currentStatus: game.status
      });
    }

    // Can't start if already running
    if (game.timer_state === 'running') {
      return res.status(400).json({ 
        error: 'Timer is already running',
        currentState: game.timer_state
      });
    }

    // If starting fresh (stopped state), use full period duration
    // If resuming (paused state), keep existing time_remaining
    const updateQuery = game.timer_state === 'stopped'
      ? `UPDATE games 
         SET timer_state = 'running', 
             timer_started_at = CURRENT_TIMESTAMP,
             time_remaining = period_duration,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`
      : `UPDATE games 
         SET timer_state = 'running', 
             timer_started_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`;

    const result = await db.query(updateQuery, [gameId]);

    res.json({
      message: 'Timer started',
      timer_state: result.rows[0].timer_state,
      timer_started_at: result.rows[0].timer_started_at,
      current_period: result.rows[0].current_period,
      time_remaining: result.rows[0].time_remaining
    });
  } catch (error) {
    console.error('Error starting timer:', error);
    res.status(500).json({ error: 'Failed to start timer' });
  }
});

/**
 * Pause the game timer
 * POST /api/timer/:gameId/pause
 */
router.post('/:gameId/pause', [
  requireRole(['admin', 'coach'])
], async (req, res) => {
  const { gameId } = req.params;

  try {
    const gameResult = await db.query('SELECT * FROM games WHERE id = $1', [gameId]);
    
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = gameResult.rows[0];

    if (game.timer_state !== 'running') {
      return res.status(400).json({ 
        error: 'Timer is not running',
        currentState: game.timer_state
      });
    }

    // Calculate elapsed time since timer started
    const elapsed = Date.now() - new Date(game.timer_started_at).getTime();
    const elapsedSeconds = Math.floor(elapsed / 1000);
    
    // Calculate remaining time using helper function
    const startingSeconds = game.time_remaining 
      ? intervalToSeconds(game.time_remaining)
      : intervalToSeconds(game.period_duration);
    
    const remainingSeconds = Math.max(0, startingSeconds - elapsedSeconds);
    
    // Create interval in format: 'HH:MM:SS' for PostgreSQL
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;
    const remainingInterval = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const result = await db.query(
      `UPDATE games 
       SET timer_state = 'paused',
           timer_paused_at = CURRENT_TIMESTAMP,
           time_remaining = $1::interval,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [remainingInterval, gameId]
    );

    res.json({
      message: 'Timer paused',
      timer_state: result.rows[0].timer_state,
      timer_paused_at: result.rows[0].timer_paused_at,
      time_remaining: result.rows[0].time_remaining
    });
  } catch (error) {
    console.error('Error pausing timer:', error);
    res.status(500).json({ error: 'Failed to pause timer' });
  }
});

/**
 * Stop the timer completely (reset to period duration)
 * POST /api/timer/:gameId/stop
 */
router.post('/:gameId/stop', [
  requireRole(['admin', 'coach'])
], async (req, res) => {
  const { gameId } = req.params;

  try {
    const gameResult = await db.query('SELECT * FROM games WHERE id = $1', [gameId]);
    
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const result = await db.query(
      `UPDATE games 
       SET timer_state = 'stopped',
           time_remaining = NULL,
           timer_started_at = NULL,
           timer_paused_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [gameId]
    );

    res.json({
      message: 'Timer stopped',
      timer_state: result.rows[0].timer_state
    });
  } catch (error) {
    console.error('Error stopping timer:', error);
    res.status(500).json({ error: 'Failed to stop timer' });
  }
});

/**
 * Change to next period
 * POST /api/timer/:gameId/next-period
 */
router.post('/:gameId/next-period', [
  requireRole(['admin', 'coach'])
], async (req, res) => {
  const { gameId } = req.params;

  try {
    const gameResult = await db.query('SELECT * FROM games WHERE id = $1', [gameId]);
    
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = gameResult.rows[0];
    const numberOfPeriods = game.number_of_periods || DEFAULT_NUMBER_OF_PERIODS;
    const overtimeEnabled = game.overtime_enabled || DEFAULT_OVERTIME_ENABLED;
    const maxOvertimePeriods = game.max_overtime_periods || DEFAULT_MAX_OVERTIME_PERIODS;

    // Check if we're already at the final period
    if (!game.is_overtime && game.current_period >= numberOfPeriods) {
      // At final regular period - check if overtime is enabled
      if (!overtimeEnabled) {
        return res.status(400).json({ 
          error: 'Already at final period. Overtime is not enabled for this game.',
          currentPeriod: game.current_period,
          isOvertime: game.is_overtime || false
        });
      }
      
      // Check if game is tied (overtime only allowed if tied)
      if (game.home_score !== game.away_score) {
        return res.status(400).json({
          error: 'Cannot go to overtime - scores are not tied',
          homeScore: game.home_score,
          awayScore: game.away_score
        });
      }
      
      // Start overtime
      const result = await db.query(
        `UPDATE games 
         SET is_overtime = true,
             overtime_period_number = 1,
             current_period = current_period + 1,
             timer_state = 'stopped',
             time_remaining = NULL,
             timer_started_at = NULL,
             timer_paused_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [gameId]
      );

      // Create period_end event for the last regular period
      await db.query(
        `INSERT INTO game_events (game_id, event_type, team_id, period, details)
         VALUES ($1, 'period_end', $2, $3, $4)`,
        [
          gameId,
          game.home_team_id,
          game.current_period,
          JSON.stringify({ period_number: game.current_period })
        ]
      );

      // Create overtime_start event
      await db.query(
        `INSERT INTO game_events (game_id, event_type, team_id, period, details)
         VALUES ($1, 'overtime_start', $2, $3, $4)`,
        [
          gameId,
          game.home_team_id,
          result.rows[0].current_period,
          JSON.stringify({ overtime_period_number: 1 })
        ]
      );

      return res.json({
        message: 'Started overtime period 1',
        current_period: result.rows[0].current_period,
        is_overtime: true,
        overtime_period_number: 1,
        timer_state: result.rows[0].timer_state
      });
    }

    // Check if we're in overtime and at max overtime periods
    if (game.is_overtime && game.overtime_period_number >= maxOvertimePeriods) {
      return res.status(400).json({ 
        error: 'Already at maximum overtime periods',
        overtimePeriodNumber: game.overtime_period_number,
        maxOvertimePeriods: maxOvertimePeriods
      });
    }

    // Move to next period (either regular or overtime)
    let result;
    if (game.is_overtime) {
      // Move to next overtime period
      result = await db.query(
        `UPDATE games 
         SET overtime_period_number = overtime_period_number + 1,
             current_period = current_period + 1,
             timer_state = 'stopped',
             time_remaining = NULL,
             timer_started_at = NULL,
             timer_paused_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [gameId]
      );

      // Create overtime_period_end event
      await db.query(
        `INSERT INTO game_events (game_id, event_type, team_id, period, details)
         VALUES ($1, 'overtime_period_end', $2, $3, $4)`,
        [
          gameId,
          game.home_team_id,
          game.current_period,
          JSON.stringify({ overtime_period_number: game.overtime_period_number })
        ]
      );

      // Create next overtime period start event
      await db.query(
        `INSERT INTO game_events (game_id, event_type, team_id, period, details)
         VALUES ($1, 'overtime_period_start', $2, $3, $4)`,
        [
          gameId,
          game.home_team_id,
          result.rows[0].current_period,
          JSON.stringify({ overtime_period_number: result.rows[0].overtime_period_number })
        ]
      );

      return res.json({
        message: `Moved to overtime period ${result.rows[0].overtime_period_number}`,
        current_period: result.rows[0].current_period,
        is_overtime: true,
        overtime_period_number: result.rows[0].overtime_period_number,
        timer_state: result.rows[0].timer_state
      });
    } else {
      // Move to next regular period
      result = await db.query(
        `UPDATE games 
         SET current_period = current_period + 1,
             timer_state = 'stopped',
             time_remaining = NULL,
             timer_started_at = NULL,
             timer_paused_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [gameId]
      );

      // Create a period_end event for the previous period
      await db.query(
        `INSERT INTO game_events (game_id, event_type, team_id, period, details)
         VALUES ($1, 'period_end', $2, $3, $4)`,
        [
          gameId,
          game.home_team_id,
          game.current_period,
          JSON.stringify({ period_number: game.current_period })
        ]
      );

      // Create a period_start event for the new period
      await db.query(
        `INSERT INTO game_events (game_id, event_type, team_id, period, details)
         VALUES ($1, 'period_start', $2, $3, $4)`,
        [
          gameId,
          game.home_team_id,
          result.rows[0].current_period,
          JSON.stringify({ period_number: result.rows[0].current_period })
        ]
      );

      res.json({
        message: 'Moved to next period',
        current_period: result.rows[0].current_period,
        is_overtime: false,
        timer_state: result.rows[0].timer_state
      });
    }
  } catch (error) {
    console.error('Error changing period:', error);
    res.status(500).json({ error: 'Failed to change period' });
  }
});

/**
 * Set period manually
 * PUT /api/timer/:gameId/period
 */
router.put('/:gameId/period', [
  requireRole(['admin', 'coach']),
  body('period')
    .notEmpty()
    .isInt({ min: 1, max: 4 })
    .withMessage('Period must be between 1 and 4')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { gameId } = req.params;
  const { period } = req.body;

  try {
    const gameResult = await db.query('SELECT * FROM games WHERE id = $1', [gameId]);
    
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const result = await db.query(
      `UPDATE games 
       SET current_period = $1,
           timer_state = 'stopped',
           time_remaining = NULL,
           timer_started_at = NULL,
           timer_paused_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [period, gameId]
    );

    res.json({
      message: 'Period updated',
      current_period: result.rows[0].current_period,
      timer_state: result.rows[0].timer_state
    });
  } catch (error) {
    console.error('Error updating period:', error);
    res.status(500).json({ error: 'Failed to update period' });
  }
});

/**
 * Set custom period duration
 * PUT /api/timer/:gameId/duration
 */
router.put('/:gameId/duration', [
  requireRole(['admin', 'coach']),
  body('minutes')
    .notEmpty()
    .isInt({ min: 1, max: 60 })
    .withMessage('Minutes must be between 1 and 60')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { gameId } = req.params;
  const { minutes } = req.body;

  try {
    const gameResult = await db.query('SELECT * FROM games WHERE id = $1', [gameId]);
    
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const interval = `00:${String(minutes).padStart(2, '0')}:00`;

    const result = await db.query(
      `UPDATE games 
       SET period_duration = $1::interval,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [interval, gameId]
    );

    res.json({
      message: 'Period duration updated',
      period_duration: result.rows[0].period_duration
    });
  } catch (error) {
    console.error('Error updating period duration:', error);
    res.status(500).json({ error: 'Failed to update period duration' });
  }
});

/**
 * Reset entire match - clears all game data and resets to initial state
 * POST /api/timer/:gameId/reset-match
 */
router.post('/:gameId/reset-match', [
  requireRole(['admin', 'coach'])
], async (req, res) => {
  const { gameId } = req.params;

  try {
    // Verify game exists
    const gameResult = await db.query('SELECT * FROM games WHERE id = $1', [gameId]);
    
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const _game = gameResult.rows[0];

    // Start transaction to ensure all or nothing
    await db.query('BEGIN');

    try {
      // Delete all shots for this game
      await db.query('DELETE FROM shots WHERE game_id = $1', [gameId]);

      // Delete all game events for this game
      await db.query('DELETE FROM game_events WHERE game_id = $1', [gameId]);

      // Delete all ball possessions for this game
      await db.query('DELETE FROM ball_possessions WHERE game_id = $1', [gameId]);

      // Reset game to initial state
      await db.query(
        `UPDATE games 
         SET home_score = 0,
             away_score = 0,
             current_period = 1,
             time_remaining = NULL,
             timer_state = 'stopped',
             timer_started_at = NULL,
             timer_paused_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [gameId]
      );

      // Commit transaction
      await db.query('COMMIT');

      res.json({
        message: 'Match reset successfully',
        game_id: gameId,
        reset_data: {
          shots_deleted: true,
          events_deleted: true,
          possessions_deleted: true,
          scores_reset: true,
          timer_reset: true,
          period_reset: true
        }
      });
    } catch (error) {
      // Rollback on error
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error resetting match:', error);
    res.status(500).json({ error: 'Failed to reset match' });
  }
});

export default router;
