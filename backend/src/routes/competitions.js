import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// ============================================================================
// COMPETITIONS CRUD
// ============================================================================

/**
 * Get all competitions with optional filtering
 * Query params: type, season_id, status
 */
router.get('/', [
  query('type')
    .optional()
    .isIn(['tournament', 'league'])
    .withMessage('Type must be either tournament or league'),
  query('season_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Season ID must be a positive integer'),
  query('status')
    .optional()
    .isIn(['upcoming', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Invalid status value')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { type, season_id, status } = req.query;

  try {
    let queryText = `
      SELECT 
        c.*,
        s.name as season_name,
        COUNT(DISTINCT ct.team_id) as team_count
      FROM competitions c
      LEFT JOIN seasons s ON c.season_id = s.id
      LEFT JOIN competition_teams ct ON c.id = ct.competition_id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (type) {
      queryText += ` AND c.competition_type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }

    if (season_id) {
      queryText += ` AND c.season_id = $${paramCount}`;
      params.push(season_id);
      paramCount++;
    }

    if (status) {
      queryText += ` AND c.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    queryText += ' GROUP BY c.id, s.name ORDER BY c.start_date DESC';

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching competitions:', err);
    res.status(500).json({ error: 'Failed to fetch competitions' });
  }
});

/**
 * Get a specific competition by ID with full details
 */
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('Competition ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;

  try {
    const result = await db.query(`
      SELECT 
        c.*,
        s.name as season_name,
        (SELECT COUNT(*) FROM competition_teams WHERE competition_id = c.id) as team_count,
        (SELECT COUNT(*) FROM tournament_brackets WHERE competition_id = c.id AND game_id IS NOT NULL) as games_played
      FROM competitions c
      LEFT JOIN seasons s ON c.season_id = s.id
      WHERE c.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching competition:', err);
    res.status(500).json({ error: 'Failed to fetch competition' });
  }
});

/**
 * Create a new competition
 */
router.post('/', [
  requireRole(['admin', 'coach']),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Competition name is required')
    .isLength({ max: 255 })
    .withMessage('Name must be 255 characters or less'),
  body('competition_type')
    .isIn(['tournament', 'league'])
    .withMessage('Competition type must be either tournament or league'),
  body('start_date')
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  body('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  body('season_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Season ID must be a positive integer'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be 2000 characters or less'),
  body('settings')
    .optional()
    .isObject()
    .withMessage('Settings must be a valid JSON object')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { name, competition_type, start_date, end_date, season_id, description, settings } = req.body;

  try {
    // Validate season exists if provided
    if (season_id) {
      const seasonCheck = await db.query('SELECT id FROM seasons WHERE id = $1', [season_id]);
      if (seasonCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Season not found' });
      }
    }

    const result = await db.query(`
      INSERT INTO competitions (name, competition_type, start_date, end_date, season_id, description, settings)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [name, competition_type, start_date, end_date || null, season_id || null, description || null, settings || {}]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating competition:', err);
    res.status(500).json({ error: 'Failed to create competition' });
  }
});

/**
 * Update a competition
 */
router.put('/:id', [
  requireRole(['admin', 'coach']),
  param('id').isInt({ min: 1 }).withMessage('Competition ID must be a positive integer'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Competition name cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Name must be 255 characters or less'),
  body('status')
    .optional()
    .isIn(['upcoming', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Invalid status value'),
  body('start_date')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  body('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be 2000 characters or less'),
  body('settings')
    .optional()
    .isObject()
    .withMessage('Settings must be a valid JSON object')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;
  const { name, status, start_date, end_date, description, settings } = req.body;

  try {
    // Check if competition exists
    const existingCheck = await db.query('SELECT * FROM competitions WHERE id = $1', [id]);
    if (existingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    // Build update query dynamically
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      params.push(name);
      paramCount++;
    }

    if (status !== undefined) {
      updates.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    if (start_date !== undefined) {
      updates.push(`start_date = $${paramCount}`);
      params.push(start_date);
      paramCount++;
    }

    if (end_date !== undefined) {
      updates.push(`end_date = $${paramCount}`);
      params.push(end_date);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      params.push(description);
      paramCount++;
    }

    if (settings !== undefined) {
      updates.push(`settings = $${paramCount}`);
      // PostgreSQL's pg driver handles JSONB conversion natively when passing objects
      params.push(settings);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    params.push(id);
    const queryText = `
      UPDATE competitions
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(queryText, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating competition:', err);
    res.status(500).json({ error: 'Failed to update competition' });
  }
});

/**
 * Delete a competition
 */
router.delete('/:id', [
  requireRole(['admin']),
  param('id').isInt({ min: 1 }).withMessage('Competition ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;

  try {
    const existingCheck = await db.query('SELECT id FROM competitions WHERE id = $1', [id]);
    if (existingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    await db.query('DELETE FROM competitions WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting competition:', err);
    res.status(500).json({ error: 'Failed to delete competition' });
  }
});

// ============================================================================
// COMPETITION TEAMS
// ============================================================================

/**
 * Get teams in a competition
 */
router.get('/:id/teams', [
  param('id').isInt({ min: 1 }).withMessage('Competition ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;

  try {
    const result = await db.query(`
      SELECT 
        ct.*,
        t.name as team_name
      FROM competition_teams ct
      JOIN teams t ON ct.team_id = t.id
      WHERE ct.competition_id = $1
      ORDER BY ct.seed NULLS LAST, t.name
    `, [id]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching competition teams:', err);
    res.status(500).json({ error: 'Failed to fetch competition teams' });
  }
});

/**
 * Add a team to a competition
 */
router.post('/:id/teams', [
  requireRole(['admin', 'coach']),
  param('id').isInt({ min: 1 }).withMessage('Competition ID must be a positive integer'),
  body('team_id')
    .isInt({ min: 1 })
    .withMessage('Team ID must be a positive integer'),
  body('seed')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Seed must be a positive integer'),
  body('group_name')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Group name must be 50 characters or less')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;
  const { team_id, seed, group_name } = req.body;

  try {
    // Verify competition exists
    const compCheck = await db.query('SELECT id FROM competitions WHERE id = $1', [id]);
    if (compCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    // Verify team exists
    const teamCheck = await db.query('SELECT id FROM teams WHERE id = $1', [team_id]);
    if (teamCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check if team is already in competition
    const existingCheck = await db.query(
      'SELECT id FROM competition_teams WHERE competition_id = $1 AND team_id = $2',
      [id, team_id]
    );
    if (existingCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Team is already in this competition' });
    }

    const result = await db.query(`
      INSERT INTO competition_teams (competition_id, team_id, seed, group_name)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [id, team_id, seed || null, group_name || null]);

    // Add team name to response
    const teamResult = await db.query('SELECT name FROM teams WHERE id = $1', [team_id]);
    const response = { ...result.rows[0], team_name: teamResult.rows[0].name };

    res.status(201).json(response);
  } catch (err) {
    console.error('Error adding team to competition:', err);
    res.status(500).json({ error: 'Failed to add team to competition' });
  }
});

/**
 * Remove a team from a competition
 */
router.delete('/:id/teams/:teamId', [
  requireRole(['admin', 'coach']),
  param('id').isInt({ min: 1 }).withMessage('Competition ID must be a positive integer'),
  param('teamId').isInt({ min: 1 }).withMessage('Team ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id, teamId } = req.params;

  try {
    const result = await db.query(
      'DELETE FROM competition_teams WHERE competition_id = $1 AND team_id = $2 RETURNING id',
      [id, teamId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found in competition' });
    }

    res.status(204).send();
  } catch (err) {
    console.error('Error removing team from competition:', err);
    res.status(500).json({ error: 'Failed to remove team from competition' });
  }
});

// ============================================================================
// TOURNAMENT BRACKETS
// ============================================================================

/**
 * Get tournament bracket for a competition
 */
router.get('/:id/bracket', [
  param('id').isInt({ min: 1 }).withMessage('Competition ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;

  try {
    const result = await db.query(`
      SELECT 
        tb.*,
        ht.name as home_team_name,
        at.name as away_team_name,
        wt.name as winner_team_name,
        g.home_score,
        g.away_score,
        g.status as game_status
      FROM tournament_brackets tb
      LEFT JOIN teams ht ON tb.home_team_id = ht.id
      LEFT JOIN teams at ON tb.away_team_id = at.id
      LEFT JOIN teams wt ON tb.winner_team_id = wt.id
      LEFT JOIN games g ON tb.game_id = g.id
      WHERE tb.competition_id = $1
      ORDER BY tb.round_number, tb.match_number
    `, [id]);

    // Group by rounds
    const rounds = {};
    result.rows.forEach(match => {
      const roundKey = match.round_number;
      if (!rounds[roundKey]) {
        rounds[roundKey] = {
          round_number: match.round_number,
          round_name: match.round_name,
          matches: []
        };
      }
      rounds[roundKey].matches.push(match);
    });

    res.json({
      competition_id: parseInt(id),
      rounds: Object.values(rounds)
    });
  } catch (err) {
    console.error('Error fetching tournament bracket:', err);
    res.status(500).json({ error: 'Failed to fetch tournament bracket' });
  }
});

/**
 * Generate tournament bracket for a competition
 */
router.post('/:id/bracket/generate', [
  requireRole(['admin', 'coach']),
  param('id').isInt({ min: 1 }).withMessage('Competition ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;

  try {
    // Verify competition is a tournament
    const compCheck = await db.query(
      'SELECT id, competition_type FROM competitions WHERE id = $1',
      [id]
    );
    if (compCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    if (compCheck.rows[0].competition_type !== 'tournament') {
      return res.status(400).json({ error: 'Can only generate bracket for tournament competitions' });
    }

    // Get teams in the competition (ordered by seed)
    const teamsResult = await db.query(`
      SELECT team_id, seed
      FROM competition_teams
      WHERE competition_id = $1
      ORDER BY seed NULLS LAST
    `, [id]);

    const teams = teamsResult.rows;
    if (teams.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 teams to generate a bracket' });
    }

    // Clear existing bracket
    await db.query('DELETE FROM tournament_brackets WHERE competition_id = $1', [id]);

    // Calculate number of rounds needed
    const teamCount = teams.length;
    const rounds = Math.ceil(Math.log2(teamCount));
    const perfectBracketSize = Math.pow(2, rounds);

    // Generate bracket structure
    const brackets = [];
    let matchNumber = 1;

    /**
     * Get descriptive name for a tournament round based on position from final
     * @param {number} roundsFromFinal - How many rounds before the final (0 = final)
     * @param {number} teamsInRound - Number of teams in this round
     */
    const getRoundName = (roundsFromFinal, teamsInRound) => {
      switch (roundsFromFinal) {
      case 0: return 'Final';
      case 1: return 'Semi Finals';
      case 2: return 'Quarter Finals';
      default: return `Round of ${teamsInRound}`;
      }
    };

    // First round with teams
    const firstRoundMatches = perfectBracketSize / 2;
    const firstRoundName = getRoundName(rounds - 1, perfectBracketSize);
    
    for (let i = 0; i < firstRoundMatches; i++) {
      const homeTeam = teams[i * 2] ? teams[i * 2].team_id : null;
      const awayTeam = teams[i * 2 + 1] ? teams[i * 2 + 1].team_id : null;

      // Handle byes - if away team is null, home team auto-advances
      const winnerTeamId = awayTeam === null ? homeTeam : null;
      const status = awayTeam === null ? 'completed' : 'pending';

      const result = await db.query(`
        INSERT INTO tournament_brackets 
          (competition_id, round_number, round_name, match_number, home_team_id, away_team_id, winner_team_id, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [id, 1, firstRoundName, matchNumber, homeTeam, awayTeam, winnerTeamId, status]);

      brackets.push({
        id: result.rows[0].id,
        round: 1,
        matchNumber,
        homeTeamId: homeTeam,
        awayTeamId: awayTeam
      });
      matchNumber++;
    }

    // Generate subsequent rounds
    for (let round = 2; round <= rounds; round++) {
      const matchesInRound = perfectBracketSize / Math.pow(2, round);
      const teamsInRound = matchesInRound * 2;
      const roundsFromFinal = rounds - round;
      const roundName = getRoundName(roundsFromFinal, teamsInRound);

      for (let i = 0; i < matchesInRound; i++) {
        const result = await db.query(`
          INSERT INTO tournament_brackets 
            (competition_id, round_number, round_name, match_number)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `, [id, round, roundName, matchNumber]);

        brackets.push({
          id: result.rows[0].id,
          round,
          matchNumber
        });
        matchNumber++;
      }
    }

    // Link brackets to next matches
    let previousRoundMatches = brackets.filter(b => b.round === 1);
    for (let round = 2; round <= rounds; round++) {
      const currentRoundMatches = brackets.filter(b => b.round === round);

      for (let i = 0; i < currentRoundMatches.length; i++) {
        const nextBracketId = currentRoundMatches[i].id;
        const match1 = previousRoundMatches[i * 2];
        const match2 = previousRoundMatches[i * 2 + 1];

        if (match1) {
          await db.query(
            'UPDATE tournament_brackets SET next_bracket_id = $1 WHERE id = $2',
            [nextBracketId, match1.id]
          );
        }
        if (match2) {
          await db.query(
            'UPDATE tournament_brackets SET next_bracket_id = $1 WHERE id = $2',
            [nextBracketId, match2.id]
          );
        }
      }
      previousRoundMatches = currentRoundMatches;
    }

    // Propagate bye winners to next rounds
    const byeMatches = await db.query(`
      SELECT id, winner_team_id, next_bracket_id
      FROM tournament_brackets
      WHERE competition_id = $1 AND winner_team_id IS NOT NULL AND next_bracket_id IS NOT NULL
    `, [id]);

    for (const match of byeMatches.rows) {
      // Find if this is the home or away slot in the next bracket
      const nextBracket = await db.query(
        'SELECT home_team_id FROM tournament_brackets WHERE id = $1',
        [match.next_bracket_id]
      );

      if (nextBracket.rows[0].home_team_id === null) {
        await db.query(
          'UPDATE tournament_brackets SET home_team_id = $1 WHERE id = $2',
          [match.winner_team_id, match.next_bracket_id]
        );
      } else {
        await db.query(
          'UPDATE tournament_brackets SET away_team_id = $1 WHERE id = $2',
          [match.winner_team_id, match.next_bracket_id]
        );
      }
    }

    // Return the generated bracket
    const finalBracket = await db.query(`
      SELECT tb.*, ht.name as home_team_name, at.name as away_team_name
      FROM tournament_brackets tb
      LEFT JOIN teams ht ON tb.home_team_id = ht.id
      LEFT JOIN teams at ON tb.away_team_id = at.id
      WHERE tb.competition_id = $1
      ORDER BY tb.round_number, tb.match_number
    `, [id]);

    res.status(201).json({
      message: 'Tournament bracket generated successfully',
      total_rounds: rounds,
      total_matches: brackets.length,
      bracket: finalBracket.rows
    });
  } catch (err) {
    console.error('Error generating tournament bracket:', err);
    res.status(500).json({ error: 'Failed to generate tournament bracket' });
  }
});

/**
 * Update a bracket match (assign game result, advance winner)
 */
router.put('/:id/bracket/:bracketId', [
  requireRole(['admin', 'coach']),
  param('id').isInt({ min: 1 }).withMessage('Competition ID must be a positive integer'),
  param('bracketId').isInt({ min: 1 }).withMessage('Bracket ID must be a positive integer'),
  body('game_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Game ID must be a positive integer'),
  body('winner_team_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Winner team ID must be a positive integer'),
  body('scheduled_date')
    .optional()
    .isISO8601()
    .withMessage('Scheduled date must be a valid ISO 8601 date')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id, bracketId } = req.params;
  const { game_id, winner_team_id, scheduled_date } = req.body;

  try {
    // Verify bracket exists and belongs to competition
    const bracketCheck = await db.query(
      'SELECT * FROM tournament_brackets WHERE id = $1 AND competition_id = $2',
      [bracketId, id]
    );
    if (bracketCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Bracket match not found' });
    }

    const bracket = bracketCheck.rows[0];

    // Build update
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (game_id !== undefined) {
      updates.push(`game_id = $${paramCount}`);
      params.push(game_id);
      paramCount++;
    }

    if (scheduled_date !== undefined) {
      updates.push(`scheduled_date = $${paramCount}`);
      params.push(scheduled_date);
      paramCount++;
      updates.push('status = \'scheduled\'');
    }

    if (winner_team_id !== undefined) {
      // Verify winner is one of the teams in the match
      if (winner_team_id !== bracket.home_team_id && winner_team_id !== bracket.away_team_id) {
        return res.status(400).json({ error: 'Winner must be one of the teams in the match' });
      }

      updates.push(`winner_team_id = $${paramCount}`);
      params.push(winner_team_id);
      paramCount++;
      updates.push('status = \'completed\'');

      // Advance winner to next bracket if exists
      if (bracket.next_bracket_id) {
        const nextBracket = await db.query(
          'SELECT home_team_id FROM tournament_brackets WHERE id = $1',
          [bracket.next_bracket_id]
        );

        if (nextBracket.rows[0].home_team_id === null) {
          await db.query(
            'UPDATE tournament_brackets SET home_team_id = $1 WHERE id = $2',
            [winner_team_id, bracket.next_bracket_id]
          );
        } else {
          await db.query(
            'UPDATE tournament_brackets SET away_team_id = $1 WHERE id = $2',
            [winner_team_id, bracket.next_bracket_id]
          );
        }
      }

      // Update eliminated team
      const loserId = winner_team_id === bracket.home_team_id ? bracket.away_team_id : bracket.home_team_id;
      if (loserId) {
        await db.query(
          'UPDATE competition_teams SET is_eliminated = true, elimination_round = $1 WHERE competition_id = $2 AND team_id = $3',
          [bracket.round_number, id, loserId]
        );
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    params.push(bracketId);
    const result = await db.query(`
      UPDATE tournament_brackets
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, params);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating bracket match:', err);
    res.status(500).json({ error: 'Failed to update bracket match' });
  }
});

// ============================================================================
// COMPETITION STANDINGS
// ============================================================================

/**
 * Get standings for a competition (league)
 */
router.get('/:id/standings', [
  param('id').isInt({ min: 1 }).withMessage('Competition ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;

  try {
    const result = await db.query(`
      SELECT 
        cs.*,
        t.name as team_name
      FROM competition_standings cs
      JOIN teams t ON cs.team_id = t.id
      WHERE cs.competition_id = $1
      ORDER BY cs.points DESC, cs.goal_difference DESC, cs.goals_for DESC
    `, [id]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching standings:', err);
    res.status(500).json({ error: 'Failed to fetch standings' });
  }
});

/**
 * Initialize standings for all teams in a competition
 */
router.post('/:id/standings/initialize', [
  requireRole(['admin', 'coach']),
  param('id').isInt({ min: 1 }).withMessage('Competition ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;

  try {
    // Verify competition exists
    const compCheck = await db.query('SELECT id FROM competitions WHERE id = $1', [id]);
    if (compCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    // Get all teams in competition
    const teamsResult = await db.query(
      'SELECT team_id FROM competition_teams WHERE competition_id = $1',
      [id]
    );

    if (teamsResult.rows.length === 0) {
      return res.status(400).json({ error: 'No teams in competition' });
    }

    // Clear existing standings
    await db.query('DELETE FROM competition_standings WHERE competition_id = $1', [id]);

    // Initialize standings for each team
    for (let i = 0; i < teamsResult.rows.length; i++) {
      await db.query(`
        INSERT INTO competition_standings (competition_id, team_id, rank)
        VALUES ($1, $2, $3)
      `, [id, teamsResult.rows[i].team_id, i + 1]);
    }

    const result = await db.query(`
      SELECT cs.*, t.name as team_name
      FROM competition_standings cs
      JOIN teams t ON cs.team_id = t.id
      WHERE cs.competition_id = $1
      ORDER BY cs.rank
    `, [id]);

    res.status(201).json(result.rows);
  } catch (err) {
    console.error('Error initializing standings:', err);
    res.status(500).json({ error: 'Failed to initialize standings' });
  }
});

/**
 * Update standings after a game result
 */
router.post('/:id/standings/update', [
  requireRole(['admin', 'coach']),
  param('id').isInt({ min: 1 }).withMessage('Competition ID must be a positive integer'),
  body('game_id')
    .isInt({ min: 1 })
    .withMessage('Game ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { id } = req.params;
  const { game_id } = req.body;

  try {
    // Get game details
    const gameResult = await db.query(`
      SELECT home_team_id, away_team_id, home_score, away_score, status
      FROM games WHERE id = $1
    `, [game_id]);

    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = gameResult.rows[0];
    if (game.status !== 'completed') {
      return res.status(400).json({ error: 'Game must be completed to update standings' });
    }

    const { home_team_id, away_team_id, home_score, away_score } = game;

    // Determine result
    let homePoints = 0, awayPoints = 0;
    let homeWin = 0, awayWin = 0, draw = 0;

    if (home_score > away_score) {
      homePoints = 3; // Win
      homeWin = 1;
    } else if (away_score > home_score) {
      awayPoints = 3; // Win
      awayWin = 1;
    } else {
      homePoints = 1; // Draw
      awayPoints = 1;
      draw = 1;
    }

    // Update home team standings
    await db.query(`
      UPDATE competition_standings
      SET 
        games_played = games_played + 1,
        wins = wins + $1,
        losses = losses + $2,
        draws = draws + $3,
        goals_for = goals_for + $4,
        goals_against = goals_against + $5,
        points = points + $6,
        home_wins = home_wins + $1,
        home_losses = home_losses + $2,
        home_draws = home_draws + $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE competition_id = $7 AND team_id = $8
    `, [homeWin, awayWin, draw, home_score, away_score, homePoints, id, home_team_id]);

    // Update away team standings
    await db.query(`
      UPDATE competition_standings
      SET 
        games_played = games_played + 1,
        wins = wins + $1,
        losses = losses + $2,
        draws = draws + $3,
        goals_for = goals_for + $4,
        goals_against = goals_against + $5,
        points = points + $6,
        away_wins = away_wins + $1,
        away_losses = away_losses + $2,
        away_draws = away_draws + $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE competition_id = $7 AND team_id = $8
    `, [awayWin, homeWin, draw, away_score, home_score, awayPoints, id, away_team_id]);

    // Recalculate ranks
    await db.query(`
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (
          ORDER BY points DESC, goal_difference DESC, goals_for DESC
        ) as new_rank
        FROM competition_standings
        WHERE competition_id = $1
      )
      UPDATE competition_standings cs
      SET rank = r.new_rank
      FROM ranked r
      WHERE cs.id = r.id
    `, [id]);

    // Update form (last 5 results)
    const formChar = homeWin ? 'W' : (draw ? 'D' : 'L');
    await db.query(`
      UPDATE competition_standings
      SET form = SUBSTRING($1 || COALESCE(form, '') FROM 1 FOR 5)
      WHERE competition_id = $2 AND team_id = $3
    `, [formChar, id, home_team_id]);

    const awayFormChar = awayWin ? 'W' : (draw ? 'D' : 'L');
    await db.query(`
      UPDATE competition_standings
      SET form = SUBSTRING($1 || COALESCE(form, '') FROM 1 FOR 5)
      WHERE competition_id = $2 AND team_id = $3
    `, [awayFormChar, id, away_team_id]);

    // Return updated standings
    const standings = await db.query(`
      SELECT cs.*, t.name as team_name
      FROM competition_standings cs
      JOIN teams t ON cs.team_id = t.id
      WHERE cs.competition_id = $1
      ORDER BY cs.rank
    `, [id]);

    res.json(standings.rows);
  } catch (err) {
    console.error('Error updating standings:', err);
    res.status(500).json({ error: 'Failed to update standings' });
  }
});

export default router;
