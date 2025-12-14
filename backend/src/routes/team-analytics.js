import express from 'express';
import { param, query, validationResult } from 'express-validator';
import db from '../db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// ============================================================================
// HEAD-TO-HEAD ANALYTICS
// ============================================================================

/**
 * Get head-to-head record between two clubs
 */
router.get('/head-to-head/:club1Id/:club2Id', [
  param('club1Id').isInt({ min: 1 }).withMessage('Club 1 ID must be a positive integer'),
  param('club2Id').isInt({ min: 1 }).withMessage('Club 2 ID must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  let { club1Id, club2Id } = req.params;
  const limit = parseInt(req.query.limit, 10) || 10;

  // Ensure consistent ordering (club1 < club2)
  club1Id = parseInt(club1Id, 10);
  club2Id = parseInt(club2Id, 10);
  if (isNaN(club1Id) || isNaN(club2Id)) {
    return res.status(400).json({ error: 'Invalid club IDs' });
  }
  if (club1Id > club2Id) {
    [club1Id, club2Id] = [club2Id, club1Id];
  }

  try {
    // Get club names
    const clubsResult = await db.query(
      'SELECT id, name FROM clubs WHERE id IN ($1, $2)',
      [club1Id, club2Id]
    );

    if (clubsResult.rows.length !== 2) {
      return res.status(404).json({ error: 'One or both clubs not found' });
    }

    const club1 = clubsResult.rows.find(c => c.id === club1Id);
    const club2 = clubsResult.rows.find(c => c.id === club2Id);

    // Get head-to-head record from cache
    let h2hRecord = await db.query(
      'SELECT * FROM head_to_head WHERE team1_id = $1 AND team2_id = $2',
      [club1Id, club2Id]
    );

    // If no cached record, calculate from games
    if (h2hRecord.rows.length === 0) {
      // Calculate from game history
      const gamesResult = await db.query(`
        SELECT 
          id,
          home_club_id,
          away_club_id,
          home_score,
          away_score,
          date,
          status
        FROM games
        WHERE status = 'completed'
          AND ((home_club_id = $1 AND away_club_id = $2)
            OR (home_club_id = $2 AND away_club_id = $1))
        ORDER BY date DESC
      `, [club1Id, club2Id]);

      let club1Wins = 0, club2Wins = 0, draws = 0;
      let club1Goals = 0, club2Goals = 0;
      let streakClubId = null;
      let streakCount = 0;
      let lastStreakWinner = null;

      gamesResult.rows.forEach(game => {
        const isClub1Home = game.home_club_id === club1Id;
        const c1Score = isClub1Home ? game.home_score : game.away_score;
        const c2Score = isClub1Home ? game.away_score : game.home_score;

        club1Goals += c1Score;
        club2Goals += c2Score;

        let currentWinner = null;
        if (c1Score > c2Score) {
          club1Wins++;
          currentWinner = club1Id;
        } else if (c2Score > c1Score) {
          club2Wins++;
          currentWinner = club2Id;
        } else {
          draws++;
        }

        // Track streak (only if there's a winner)
        if (currentWinner) {
          if (lastStreakWinner === null) {
            streakClubId = currentWinner;
            streakCount = 1;
          } else if (lastStreakWinner === currentWinner) {
            streakCount++;
          }
          lastStreakWinner = currentWinner;
        }
      });

      const lastGame = gamesResult.rows[0] || null;

      // Insert or update head-to-head cache
      if (gamesResult.rows.length > 0) {
        await db.query(`
          INSERT INTO head_to_head 
            (team1_id, team2_id, total_games, team1_wins, team2_wins, draws, 
             team1_goals, team2_goals, last_game_id, last_game_date, streak_team_id, streak_count)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (team1_id, team2_id) 
          DO UPDATE SET
            total_games = EXCLUDED.total_games,
            team1_wins = EXCLUDED.team1_wins,
            team2_wins = EXCLUDED.team2_wins,
            draws = EXCLUDED.draws,
            team1_goals = EXCLUDED.team1_goals,
            team2_goals = EXCLUDED.team2_goals,
            last_game_id = EXCLUDED.last_game_id,
            last_game_date = EXCLUDED.last_game_date,
            streak_team_id = EXCLUDED.streak_team_id,
            streak_count = EXCLUDED.streak_count,
            updated_at = CURRENT_TIMESTAMP
        `, [
          club1Id, club2Id, gamesResult.rows.length, club1Wins, club2Wins, draws,
          club1Goals, club2Goals, lastGame?.id, lastGame?.date,
          streakClubId, streakCount
        ]);
      }

      h2hRecord = {
        rows: [{
          team1_id: club1Id,
          team2_id: club2Id,
          total_games: gamesResult.rows.length,
          team1_wins: club1Wins,
          team2_wins: club2Wins,
          draws,
          team1_goals: club1Goals,
          team2_goals: club2Goals,
          last_game_id: lastGame?.id,
          last_game_date: lastGame?.date,
          streak_team_id: streakClubId,
          streak_count: streakCount
        }]
      };
    }

    // Get recent games between clubs
    const recentGames = await db.query(`
      SELECT 
        g.id,
        g.date,
        g.home_club_id,
        g.away_club_id,
        g.home_score,
        g.away_score,
        hc.name as home_club_name,
        ac.name as away_club_name
      FROM games g
      JOIN clubs hc ON g.home_club_id = hc.id
      JOIN clubs ac ON g.away_club_id = ac.id
      WHERE g.status = 'completed'
        AND ((g.home_club_id = $1 AND g.away_club_id = $2)
          OR (g.home_club_id = $2 AND g.away_club_id = $1))
      ORDER BY g.date DESC
      LIMIT $3
    `, [club1Id, club2Id, limit]);

    const record = h2hRecord.rows[0];

    res.json({
      club1: {
        id: club1Id,
        name: club1.name,
        wins: record.team1_wins,
        goals: record.team1_goals
      },
      club2: {
        id: club2Id,
        name: club2.name,
        wins: record.team2_wins,
        goals: record.team2_goals
      },
      total_games: record.total_games,
      draws: record.draws,
      last_game_date: record.last_game_date,
      current_streak: record.streak_team_id ? {
        club_id: record.streak_team_id,
        club_name: record.streak_team_id === club1Id ? club1.name : club2.name,
        count: record.streak_count
      } : null,
      recent_games: recentGames.rows
    });
  } catch (err) {
    console.error('Error fetching head-to-head:', err);
    res.status(500).json({ error: 'Failed to fetch head-to-head data' });
  }
});

// ============================================================================
// TEAM RANKINGS
// ============================================================================

/**
 * Get overall team rankings
 */
router.get('/rankings', [
  query('season_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Season ID must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { season_id } = req.query;
  const limit = parseInt(req.query.limit, 10) || 20;

  try {
    let queryText;
    let params;

    if (season_id) {
      queryText = `
        SELECT 
          tr.*,
          t.name as team_name,
          s.name as season_name
        FROM team_rankings tr
        JOIN teams t ON tr.team_id = t.id
        LEFT JOIN seasons s ON tr.season_id = s.id
        WHERE tr.season_id = $1
        ORDER BY tr.overall_rank NULLS LAST, tr.rating DESC NULLS LAST
        LIMIT $2
      `;
      params = [season_id, limit];
    } else {
      // Get rankings for current/latest season or overall
      queryText = `
        SELECT 
          tr.*,
          t.name as team_name,
          s.name as season_name
        FROM team_rankings tr
        JOIN teams t ON tr.team_id = t.id
        LEFT JOIN seasons s ON tr.season_id = s.id
        WHERE tr.season_id IS NULL 
          OR tr.season_id = (SELECT id FROM seasons WHERE is_active = true LIMIT 1)
        ORDER BY tr.overall_rank NULLS LAST, tr.rating DESC NULLS LAST
        LIMIT $1
      `;
      params = [limit];
    }

    const result = await db.query(queryText, params);

    // If no rankings exist, calculate from game history
    if (result.rows.length === 0) {
      const calculatedRankings = await calculateTeamRankings(season_id);
      return res.json(calculatedRankings);
    }

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching rankings:', err);
    res.status(500).json({ error: 'Failed to fetch rankings' });
  }
});

/**
 * Get ranking for a specific team
 */
router.get('/rankings/team/:teamId', [
  param('teamId').isInt({ min: 1 }).withMessage('Team ID must be a positive integer'),
  query('season_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Season ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { teamId } = req.params;
  const { season_id } = req.query;

  try {
    // Get team info
    const teamResult = await db.query('SELECT id, name FROM teams WHERE id = $1', [teamId]);
    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    let queryText = `
      SELECT 
        tr.*,
        t.name as team_name,
        s.name as season_name
      FROM team_rankings tr
      JOIN teams t ON tr.team_id = t.id
      LEFT JOIN seasons s ON tr.season_id = s.id
      WHERE tr.team_id = $1
    `;
    const params = [teamId];

    if (season_id) {
      queryText += ' AND tr.season_id = $2';
      params.push(season_id);
    } else {
      queryText += ' AND (tr.season_id IS NULL OR tr.season_id = (SELECT id FROM seasons WHERE is_active = true LIMIT 1))';
    }

    const result = await db.query(queryText, params);

    if (result.rows.length === 0) {
      // Calculate ranking on-the-fly
      const ranking = await calculateTeamRanking(teamId, season_id);
      return res.json(ranking);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching team ranking:', err);
    res.status(500).json({ error: 'Failed to fetch team ranking' });
  }
});

/**
 * Recalculate all team rankings
 */
router.post('/rankings/recalculate', [
  query('season_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Season ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { season_id } = req.query;

  try {
    const rankings = await calculateTeamRankings(season_id);
    res.json({
      message: 'Rankings recalculated successfully',
      rankings
    });
  } catch (err) {
    console.error('Error recalculating rankings:', err);
    res.status(500).json({ error: 'Failed to recalculate rankings' });
  }
});

// ============================================================================
// TEAM COMPARISON
// ============================================================================

/**
 * Compare multiple teams across various metrics
 */
router.get('/compare', [
  query('team_ids')
    .notEmpty()
    .withMessage('Team IDs are required')
    .custom((value) => {
      const ids = value.split(',').map(id => parseInt(id.trim()));
      if (ids.some(isNaN)) {
        throw new Error('All team IDs must be valid integers');
      }
      if (ids.length < 2 || ids.length > 10) {
        throw new Error('Must compare between 2 and 10 teams');
      }
      return true;
    }),
  query('season_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Season ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const teamIds = req.query.team_ids.split(',').map(id => parseInt(id.trim()));
  const { season_id } = req.query;

  try {
    // Get team information
    const teamsResult = await db.query(
      'SELECT id, name FROM teams WHERE id = ANY($1)',
      [teamIds]
    );

    if (teamsResult.rows.length !== teamIds.length) {
      return res.status(404).json({ error: 'One or more teams not found' });
    }

    // Get statistics for each team
    const comparisons = await Promise.all(teamIds.map(async (teamId) => {
      // Build game filter based on season
      let gameFilter = 'g.status = \'completed\'';
      let gameParams = [teamId];

      if (season_id) {
        gameFilter += ' AND g.season_id = $2';
        gameParams.push(season_id);
      }

      // Get game statistics
      const statsResult = await db.query(`
        SELECT
          COUNT(*) as games_played,
          COUNT(CASE 
            WHEN (g.home_team_id = $1 AND g.home_score > g.away_score)
              OR (g.away_team_id = $1 AND g.away_score > g.home_score) THEN 1 
          END) as wins,
          COUNT(CASE 
            WHEN (g.home_team_id = $1 AND g.home_score < g.away_score)
              OR (g.away_team_id = $1 AND g.away_score < g.home_score) THEN 1 
          END) as losses,
          COUNT(CASE WHEN g.home_score = g.away_score THEN 1 END) as draws,
          SUM(CASE WHEN g.home_team_id = $1 THEN g.home_score ELSE g.away_score END) as goals_for,
          SUM(CASE WHEN g.home_team_id = $1 THEN g.away_score ELSE g.home_score END) as goals_against,
          COUNT(CASE WHEN g.home_team_id = $1 AND g.home_score > g.away_score THEN 1 END) as home_wins,
          COUNT(CASE WHEN g.away_team_id = $1 AND g.away_score > g.home_score THEN 1 END) as away_wins
        FROM games g
        WHERE (g.home_team_id = $1 OR g.away_team_id = $1) AND ${gameFilter}
      `, gameParams);

      const stats = statsResult.rows[0];
      const gamesPlayed = parseInt(stats.games_played) || 0;
      const wins = parseInt(stats.wins) || 0;
      const losses = parseInt(stats.losses) || 0;
      const draws = parseInt(stats.draws) || 0;
      const goalsFor = parseInt(stats.goals_for) || 0;
      const goalsAgainst = parseInt(stats.goals_against) || 0;

      // Get shot statistics
      let shotFilter = 's.team_id = $1';
      let shotParams = [teamId];

      if (season_id) {
        shotFilter += ' AND g.season_id = $2';
        shotParams.push(season_id);
      }

      const shotStatsResult = await db.query(`
        SELECT
          COUNT(*) as total_shots,
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals,
          ROUND(
            COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
            NULLIF(COUNT(*)::numeric, 0) * 100, 2
          ) as shooting_percentage,
          ROUND(AVG(s.distance), 2) as avg_shot_distance
        FROM shots s
        JOIN games g ON s.game_id = g.id
        WHERE ${shotFilter} AND g.status = 'completed'
      `, shotParams);

      const shotStats = shotStatsResult.rows[0];

      const team = teamsResult.rows.find(t => t.id === teamId);

      return {
        team_id: teamId,
        team_name: team.name,
        games_played: gamesPlayed,
        wins,
        losses,
        draws,
        win_percentage: gamesPlayed > 0 ? parseFloat(((wins / gamesPlayed) * 100).toFixed(2)) : 0,
        goals_for: goalsFor,
        goals_against: goalsAgainst,
        goal_difference: goalsFor - goalsAgainst,
        avg_goals_per_game: gamesPlayed > 0 ? parseFloat((goalsFor / gamesPlayed).toFixed(2)) : 0,
        avg_goals_conceded: gamesPlayed > 0 ? parseFloat((goalsAgainst / gamesPlayed).toFixed(2)) : 0,
        home_wins: parseInt(stats.home_wins) || 0,
        away_wins: parseInt(stats.away_wins) || 0,
        total_shots: parseInt(shotStats.total_shots) || 0,
        shooting_percentage: parseFloat(shotStats.shooting_percentage) || 0,
        avg_shot_distance: parseFloat(shotStats.avg_shot_distance) || 0
      };
    }));

    res.json({
      teams: comparisons,
      comparison_metrics: [
        'games_played', 'wins', 'losses', 'draws', 'win_percentage',
        'goals_for', 'goals_against', 'goal_difference',
        'avg_goals_per_game', 'avg_goals_conceded',
        'shooting_percentage', 'avg_shot_distance'
      ]
    });
  } catch (err) {
    console.error('Error comparing teams:', err);
    res.status(500).json({ error: 'Failed to compare teams' });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate rankings for all teams
 */
async function calculateTeamRankings(seasonId = null) {
  // Get all teams with completed games
  let gameFilter = 'g.status = \'completed\'';
  const params = [];

  if (seasonId) {
    gameFilter += ' AND g.season_id = $1';
    params.push(seasonId);
  }

  const teamsResult = await db.query(`
    SELECT DISTINCT team_id FROM (
      SELECT home_team_id as team_id FROM games g WHERE ${gameFilter}
      UNION
      SELECT away_team_id as team_id FROM games g WHERE ${gameFilter}
    ) teams
  `, params);

  const rankings = await Promise.all(teamsResult.rows.map(async ({ team_id }) => {
    return await calculateTeamRanking(team_id, seasonId);
  }));

  // Sort by rating and assign ranks
  rankings.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  rankings.forEach((r, i) => {
    r.overall_rank = i + 1;
  });

  // Save rankings to database
  for (const ranking of rankings) {
    await db.query(`
      INSERT INTO team_rankings 
        (team_id, season_id, overall_rank, points, rating, games_played, wins, losses, draws,
         goals_for, goals_against, avg_goals_per_game, avg_goals_conceded, 
         clean_sheets, longest_win_streak, current_streak, last_updated)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
      ON CONFLICT (team_id, season_id) 
      DO UPDATE SET
        overall_rank = EXCLUDED.overall_rank,
        points = EXCLUDED.points,
        rating = EXCLUDED.rating,
        games_played = EXCLUDED.games_played,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses,
        draws = EXCLUDED.draws,
        goals_for = EXCLUDED.goals_for,
        goals_against = EXCLUDED.goals_against,
        avg_goals_per_game = EXCLUDED.avg_goals_per_game,
        avg_goals_conceded = EXCLUDED.avg_goals_conceded,
        clean_sheets = EXCLUDED.clean_sheets,
        longest_win_streak = EXCLUDED.longest_win_streak,
        current_streak = EXCLUDED.current_streak,
        last_updated = CURRENT_TIMESTAMP
    `, [
      ranking.team_id, seasonId || null, ranking.overall_rank, ranking.points, 
      ranking.rating, ranking.games_played, ranking.wins, ranking.losses, ranking.draws,
      ranking.goals_for, ranking.goals_against, ranking.avg_goals_per_game, 
      ranking.avg_goals_conceded, ranking.clean_sheets, ranking.longest_win_streak,
      ranking.current_streak
    ]);
  }

  return rankings;
}

/**
 * Calculate ranking for a single team
 */
async function calculateTeamRanking(teamId, seasonId = null) {
  let gameFilter = 'g.status = \'completed\' AND (g.home_team_id = $1 OR g.away_team_id = $1)';
  const params = [teamId];

  if (seasonId) {
    gameFilter += ' AND g.season_id = $2';
    params.push(seasonId);
  }

  // Get team info
  const teamResult = await db.query('SELECT id, name FROM teams WHERE id = $1', [teamId]);
  if (teamResult.rows.length === 0) {
    return null;
  }

  // Get game statistics
  const statsResult = await db.query(`
    SELECT
      COUNT(*) as games_played,
      COUNT(CASE 
        WHEN (g.home_team_id = $1 AND g.home_score > g.away_score)
          OR (g.away_team_id = $1 AND g.away_score > g.home_score) THEN 1 
      END) as wins,
      COUNT(CASE 
        WHEN (g.home_team_id = $1 AND g.home_score < g.away_score)
          OR (g.away_team_id = $1 AND g.away_score < g.home_score) THEN 1 
      END) as losses,
      COUNT(CASE WHEN g.home_score = g.away_score THEN 1 END) as draws,
      SUM(CASE WHEN g.home_team_id = $1 THEN g.home_score ELSE g.away_score END) as goals_for,
      SUM(CASE WHEN g.home_team_id = $1 THEN g.away_score ELSE g.home_score END) as goals_against,
      COUNT(CASE 
        WHEN (g.home_team_id = $1 AND g.away_score = 0)
          OR (g.away_team_id = $1 AND g.home_score = 0) THEN 1 
      END) as clean_sheets
    FROM games g
    WHERE ${gameFilter}
  `, params);

  const stats = statsResult.rows[0];
  const gamesPlayed = parseInt(stats.games_played) || 0;
  const wins = parseInt(stats.wins) || 0;
  const losses = parseInt(stats.losses) || 0;
  const draws = parseInt(stats.draws) || 0;
  const goalsFor = parseInt(stats.goals_for) || 0;
  const goalsAgainst = parseInt(stats.goals_against) || 0;
  const cleanSheets = parseInt(stats.clean_sheets) || 0;

  // Calculate points using standard football/korfball scoring (3 for win, 1 for draw)
  const points = (wins * 3) + draws;

  /**
   * Calculate simplified performance rating
   * 
   * This is a simplified rating system inspired by ELO, designed for team rankings:
   * - Base rating: 1000 (average team)
   * - Win rate contribution: 0-200 points (100% wins = +200)
   *   - Multiplier 200 chosen to create meaningful separation between teams
   *   - A team winning 50% of games gets +100, 100% gets +200
   * - Goal difference contribution: variable based on average margin
   *   - Multiplier 50 per goal per game to reward offensive dominance
   *   - A team averaging +2 goals per game gets +100
   * 
   * Note: This is not a true ELO system (which requires opponent ratings).
   * For a full ELO implementation, consider storing and updating ratings after each game.
   */
  let rating = 1000;
  if (gamesPlayed > 0) {
    const winRate = wins / gamesPlayed;
    const goalDiffPerGame = (goalsFor - goalsAgainst) / gamesPlayed;
    rating = 1000 + (winRate * 200) + (goalDiffPerGame * 50);
  }

  // Get streak info
  const recentGames = await db.query(`
    SELECT 
      CASE 
        WHEN (g.home_team_id = $1 AND g.home_score > g.away_score)
          OR (g.away_team_id = $1 AND g.away_score > g.home_score) THEN 'W'
        WHEN (g.home_team_id = $1 AND g.home_score < g.away_score)
          OR (g.away_team_id = $1 AND g.away_score < g.home_score) THEN 'L'
        ELSE 'D'
      END as result
    FROM games g
    WHERE ${gameFilter}
    ORDER BY g.date DESC
    LIMIT 10
  `, params);

  let currentStreak = '';
  let currentStreakType = null;
  let currentStreakCount = 0;
  let longestWinStreak = 0;
  let tempWinStreak = 0;

  recentGames.rows.forEach((game, index) => {
    if (game.result === 'W') {
      tempWinStreak++;
      if (tempWinStreak > longestWinStreak) longestWinStreak = tempWinStreak;
    } else {
      tempWinStreak = 0;
    }

    if (index === 0) {
      currentStreakType = game.result;
      currentStreakCount = 1;
    } else if (game.result === currentStreakType) {
      currentStreakCount++;
    }
  });

  if (currentStreakType && currentStreakCount > 0) {
    currentStreak = `${currentStreakType}${currentStreakCount}`;
  }

  return {
    team_id: teamId,
    team_name: teamResult.rows[0].name,
    season_id: seasonId,
    games_played: gamesPlayed,
    wins,
    losses,
    draws,
    points,
    rating: parseFloat(rating.toFixed(2)),
    goals_for: goalsFor,
    goals_against: goalsAgainst,
    goal_difference: goalsFor - goalsAgainst,
    avg_goals_per_game: gamesPlayed > 0 ? parseFloat((goalsFor / gamesPlayed).toFixed(2)) : 0,
    avg_goals_conceded: gamesPlayed > 0 ? parseFloat((goalsAgainst / gamesPlayed).toFixed(2)) : 0,
    clean_sheets: cleanSheets,
    longest_win_streak: longestWinStreak,
    current_streak: currentStreak
  };
}

export default router;
