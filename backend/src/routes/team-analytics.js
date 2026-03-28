import express from 'express';
import { param, query, validationResult } from 'express-validator';
import db from '../db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

const POINTS_PER_WIN = 2;
const DEFAULT_TOP_SCORERS_LIMIT = 10;
const MOMENTUM_ROLLING_WINDOW = 3;

router.use(auth);

router.get('/head-to-head/:club1Id/:club2Id', [
  param('club1Id').isInt({ min: 1 }).withMessage('Club 1 ID must be a positive integer'),
  param('club2Id').isInt({ min: 1 }).withMessage('Club 2 ID must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  let { club1Id, club2Id } = req.params;
  const limit = parseInt(req.query.limit, 10) || 10;

  club1Id = parseInt(club1Id, 10);
  club2Id = parseInt(club2Id, 10);
  if (Number.isNaN(club1Id) || Number.isNaN(club2Id)) {
    return res.status(400).json({ error: 'Invalid club IDs' });
  }
  if (club1Id > club2Id) {
    [club1Id, club2Id] = [club2Id, club1Id];
  }

  try {
    const clubsResult = await db.query('SELECT id, name FROM clubs WHERE id IN ($1, $2)', [club1Id, club2Id]);
    if (clubsResult.rows.length !== 2) {
      return res.status(404).json({ error: 'One or both clubs not found' });
    }

    const club1 = clubsResult.rows.find((club) => club.id === club1Id);
    const club2 = clubsResult.rows.find((club) => club.id === club2Id);
    const gamesResult = await db.query(`
      SELECT id, home_club_id, away_club_id, home_score, away_score, date
      FROM games
      WHERE status = 'completed'
        AND ((home_club_id = $1 AND away_club_id = $2)
          OR (home_club_id = $2 AND away_club_id = $1))
      ORDER BY date DESC
    `, [club1Id, club2Id]);

    let club1Wins = 0;
    let club2Wins = 0;
    let draws = 0;
    let club1Goals = 0;
    let club2Goals = 0;
    let streakClubId = null;
    let streakCount = 0;
    let lastStreakWinner = null;

    gamesResult.rows.forEach((game) => {
      const isClub1Home = game.home_club_id === club1Id;
      const club1Score = isClub1Home ? game.home_score : game.away_score;
      const club2Score = isClub1Home ? game.away_score : game.home_score;

      club1Goals += club1Score;
      club2Goals += club2Score;

      let currentWinner = null;
      if (club1Score > club2Score) {
        club1Wins += 1;
        currentWinner = club1Id;
      } else if (club2Score > club1Score) {
        club2Wins += 1;
        currentWinner = club2Id;
      } else {
        draws += 1;
      }

      if (currentWinner) {
        if (lastStreakWinner === null) {
          streakClubId = currentWinner;
          streakCount = 1;
        } else if (lastStreakWinner === currentWinner) {
          streakCount += 1;
        }
        lastStreakWinner = currentWinner;
      }
    });

    const recentGames = await db.query(`
      SELECT
        g.id,
        g.date,
        g.home_club_id,
        g.away_club_id,
        g.home_score,
        g.away_score,
        hc.name AS home_club_name,
        ac.name AS away_club_name
      FROM games g
      JOIN clubs hc ON g.home_club_id = hc.id
      JOIN clubs ac ON g.away_club_id = ac.id
      WHERE g.status = 'completed'
        AND ((g.home_club_id = $1 AND g.away_club_id = $2)
          OR (g.home_club_id = $2 AND g.away_club_id = $1))
      ORDER BY g.date DESC
      LIMIT $3
    `, [club1Id, club2Id, limit]);

    const lastGame = gamesResult.rows[0] || null;

    return res.json({
      team1: { id: club1Id, name: club1.name, wins: club1Wins, goals: club1Goals },
      team2: { id: club2Id, name: club2.name, wins: club2Wins, goals: club2Goals },
      total_games: gamesResult.rows.length,
      draws,
      last_game_date: lastGame?.date || null,
      current_streak: streakClubId ? {
        team_id: streakClubId,
        team_name: streakClubId === club1Id ? club1.name : club2.name,
        count: streakCount,
      } : null,
      recent_games: recentGames.rows,
    });
  } catch (err) {
    console.error('Error fetching head-to-head:', err);
    return res.status(500).json({ error: 'Failed to fetch head-to-head data' });
  }
});

router.get('/rankings', [
  query('season_id').optional().isInt({ min: 1 }).withMessage('Season ID must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const seasonId = req.query.season_id ? parseInt(req.query.season_id, 10) : null;
  const limit = parseInt(req.query.limit, 10) || 20;

  try {
    return res.json(await calculateTeamRankings(seasonId, limit));
  } catch (err) {
    console.error('Error fetching rankings:', err);
    return res.status(500).json({ error: 'Failed to fetch rankings' });
  }
});

router.get('/rankings/team/:teamId', [
  param('teamId').isInt({ min: 1 }).withMessage('Team ID must be a positive integer'),
  query('season_id').optional().isInt({ min: 1 }).withMessage('Season ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const clubId = parseInt(req.params.teamId, 10);
  const seasonId = req.query.season_id ? parseInt(req.query.season_id, 10) : null;

  try {
    const clubResult = await db.query('SELECT id FROM clubs WHERE id = $1', [clubId]);
    if (clubResult.rows.length === 0) {
      return res.status(404).json({ error: 'Club not found' });
    }

    return res.json(await calculateTeamRanking(clubId, seasonId));
  } catch (err) {
    console.error('Error fetching team ranking:', err);
    return res.status(500).json({ error: 'Failed to fetch team ranking' });
  }
});

router.post('/rankings/recalculate', [
  query('season_id').optional().isInt({ min: 1 }).withMessage('Season ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const seasonId = req.query.season_id ? parseInt(req.query.season_id, 10) : null;

  try {
    return res.json({ message: 'Rankings recalculated successfully', rankings: await calculateTeamRankings(seasonId) });
  } catch (err) {
    console.error('Error recalculating rankings:', err);
    return res.status(500).json({ error: 'Failed to recalculate rankings' });
  }
});

router.get('/compare', [
  query('team_ids')
    .notEmpty()
    .withMessage('Team IDs are required')
    .custom((value) => {
      const ids = value.split(',').map((id) => parseInt(id.trim(), 10));
      if (ids.some(Number.isNaN)) {
        throw new Error('All team IDs must be valid integers');
      }
      if (ids.length < 2 || ids.length > 10) {
        throw new Error('Must compare between 2 and 10 teams');
      }
      return true;
    }),
  query('season_id').optional().isInt({ min: 1 }).withMessage('Season ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const teamIds = req.query.team_ids.split(',').map((id) => parseInt(id.trim(), 10));
  const seasonId = req.query.season_id ? parseInt(req.query.season_id, 10) : null;

  try {
    const clubsResult = await db.query('SELECT id, name FROM clubs WHERE id = ANY($1)', [teamIds]);
    if (clubsResult.rows.length !== teamIds.length) {
      return res.status(404).json({ error: 'One or more clubs not found' });
    }

    const comparisons = await Promise.all(teamIds.map(async (teamId) => {
      let gameFilter = 'g.status = \'completed\'';
      const gameParams = [teamId];
      if (seasonId) {
        gameFilter += ' AND g.season_id = $2';
        gameParams.push(seasonId);
      }

      const statsResult = await db.query(`
        SELECT
          COUNT(*) AS games_played,
          COUNT(CASE WHEN (g.home_club_id = $1 AND g.home_score > g.away_score) OR (g.away_club_id = $1 AND g.away_score > g.home_score) THEN 1 END) AS wins,
          COUNT(CASE WHEN (g.home_club_id = $1 AND g.home_score < g.away_score) OR (g.away_club_id = $1 AND g.away_score < g.home_score) THEN 1 END) AS losses,
          COUNT(CASE WHEN g.home_score = g.away_score THEN 1 END) AS draws,
          SUM(CASE WHEN g.home_club_id = $1 THEN g.home_score ELSE g.away_score END) AS goals_for,
          SUM(CASE WHEN g.home_club_id = $1 THEN g.away_score ELSE g.home_score END) AS goals_against,
          COUNT(CASE WHEN g.home_club_id = $1 AND g.home_score > g.away_score THEN 1 END) AS home_wins,
          COUNT(CASE WHEN g.away_club_id = $1 AND g.away_score > g.home_score THEN 1 END) AS away_wins
        FROM games g
        WHERE (g.home_club_id = $1 OR g.away_club_id = $1) AND ${gameFilter}
      `, gameParams);

      let shotFilter = 's.club_id = $1';
      const shotParams = [teamId];
      if (seasonId) {
        shotFilter += ' AND g.season_id = $2';
        shotParams.push(seasonId);
      }

      const shotStatsResult = await db.query(`
        SELECT
          COUNT(*) AS total_shots,
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END) AS goals,
          ROUND(COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / NULLIF(COUNT(*)::numeric, 0) * 100, 2) AS shooting_percentage,
          ROUND(AVG(s.distance), 2) AS avg_shot_distance
        FROM shots s
        JOIN games g ON s.game_id = g.id
        WHERE ${shotFilter} AND g.status = 'completed'
      `, shotParams);

      const stats = statsResult.rows[0];
      const shotStats = shotStatsResult.rows[0];
      const gamesPlayed = parseInt(stats.games_played, 10) || 0;
      const goalsFor = parseInt(stats.goals_for, 10) || 0;
      const goalsAgainst = parseInt(stats.goals_against, 10) || 0;
      const club = clubsResult.rows.find((item) => item.id === teamId);

      return {
        club_id: teamId,
        club_name: club.name,
        team_id: teamId,
        team_name: club.name,
        games_played: gamesPlayed,
        wins: parseInt(stats.wins, 10) || 0,
        losses: parseInt(stats.losses, 10) || 0,
        draws: parseInt(stats.draws, 10) || 0,
        win_percentage: gamesPlayed > 0 ? round((parseInt(stats.wins, 10) / gamesPlayed) * 100) : 0,
        goals_for: goalsFor,
        goals_against: goalsAgainst,
        goal_difference: goalsFor - goalsAgainst,
        avg_goals_per_game: gamesPlayed > 0 ? round(goalsFor / gamesPlayed) : 0,
        avg_goals_conceded: gamesPlayed > 0 ? round(goalsAgainst / gamesPlayed) : 0,
        home_wins: parseInt(stats.home_wins, 10) || 0,
        away_wins: parseInt(stats.away_wins, 10) || 0,
        total_shots: parseInt(shotStats.total_shots, 10) || 0,
        shooting_percentage: parseFloat(shotStats.shooting_percentage) || 0,
        avg_shot_distance: parseFloat(shotStats.avg_shot_distance) || 0,
      };
    }));

    return res.json({
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
    return res.status(500).json({ error: 'Failed to compare teams' });
  }
});

router.get('/:teamId/season-overview', [
  param('teamId').isInt({ min: 1 }).withMessage('Team ID must be a positive integer'),
  query('season_id').optional().isInt({ min: 1 }).withMessage('Season ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  try {
    const teamId = parseInt(req.params.teamId, 10);
    const requestedSeasonId = req.query.season_id ? parseInt(req.query.season_id, 10) : null;
    const context = await loadTeamAnalyticsContext(teamId, requestedSeasonId);

    if (!context.team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    if (requestedSeasonId && !context.season) {
      return res.status(404).json({ error: 'Season not found' });
    }

    const summary = await buildTeamSeasonSummary(context.team, context.season);
    let previousSeasonComparison = null;

    if (context.season) {
      const previousSeason = await loadPreviousSeason(context.season.id);
      if (previousSeason) {
        const previousSummary = await buildTeamSeasonSummary(context.team, previousSeason);
        if (previousSummary.record.games_played > 0) {
          previousSeasonComparison = {
            season: previousSeason,
            record: previousSummary.record,
            scoring: previousSummary.scoring,
            deltas: {
              win_percentage: round(summary.record.win_percentage - previousSummary.record.win_percentage),
              goals_for_per_game: round(summary.scoring.avg_goals_for - previousSummary.scoring.avg_goals_for),
              fg_percentage: round(summary.scoring.fg_percentage - previousSummary.scoring.fg_percentage),
              goal_difference_per_game: round(summary.scoring.avg_goal_difference - previousSummary.scoring.avg_goal_difference),
            },
          };
        }
      }
    }

    return res.json({
      team: context.team,
      season: context.season,
      scope_mode: summary.scope_mode,
      record: summary.record,
      scoring: summary.scoring,
      top_scorers: summary.top_scorers,
      period_breakdown: summary.period_breakdown,
      previous_season_comparison: previousSeasonComparison,
    });
  } catch (err) {
    console.error('Error fetching season overview:', err);
    return res.status(500).json({ error: 'Failed to fetch season overview' });
  }
});

router.get('/:teamId/momentum', [
  param('teamId').isInt({ min: 1 }).withMessage('Team ID must be a positive integer'),
  query('season_id').optional().isInt({ min: 1 }).withMessage('Season ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  try {
    const teamId = parseInt(req.params.teamId, 10);
    const requestedSeasonId = req.query.season_id ? parseInt(req.query.season_id, 10) : null;
    const context = await loadTeamAnalyticsContext(teamId, requestedSeasonId);

    if (!context.team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    if (requestedSeasonId && !context.season) {
      return res.status(404).json({ error: 'Season not found' });
    }

    const summary = await buildTeamSeasonSummary(context.team, context.season);
    const trend = buildMomentumTrend(summary.games, summary.per_game_metrics);
    const recentGames = trend.slice(-5);
    const wins = recentGames.filter((game) => game.result === 'W').length;
    const losses = recentGames.filter((game) => game.result === 'L').length;
    const draws = recentGames.filter((game) => game.result === 'D').length;
    const lastFivePoints = recentGames.reduce((total, game) => total + (game.result === 'W' ? POINTS_PER_WIN : game.result === 'D' ? 1 : 0), 0);

    return res.json({
      team: context.team,
      season: context.season,
      scope_mode: summary.scope_mode,
      trend,
      summary: {
        current_streak: buildCurrentStreak(summary.games.map((game) => game.result)),
        last_five_record: `${wins}-${losses}-${draws}`,
        last_five_points: lastFivePoints,
        average_momentum: trend.length > 0 ? round(trend.reduce((total, game) => total + game.momentum_score, 0) / trend.length) : 0,
      },
    });
  } catch (err) {
    console.error('Error fetching momentum:', err);
    return res.status(500).json({ error: 'Failed to fetch momentum data' });
  }
});

router.get('/:teamId/strengths-weaknesses', [
  param('teamId').isInt({ min: 1 }).withMessage('Team ID must be a positive integer'),
  query('season_id').optional().isInt({ min: 1 }).withMessage('Season ID must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  try {
    const teamId = parseInt(req.params.teamId, 10);
    const requestedSeasonId = req.query.season_id ? parseInt(req.query.season_id, 10) : null;
    const context = await loadTeamAnalyticsContext(teamId, requestedSeasonId);

    if (!context.team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    if (requestedSeasonId && !context.season) {
      return res.status(404).json({ error: 'Season not found' });
    }

    const summary = await buildTeamSeasonSummary(context.team, context.season);
    const benchmarks = await buildLeagueBenchmarks(context.season?.id || null);
    const analysis = buildStrengthsWeaknessesAnalysis(summary, benchmarks);

    return res.json({
      team: context.team,
      season: context.season,
      scope_mode: summary.scope_mode,
      benchmarks,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      period_breakdown: summary.period_breakdown,
    });
  } catch (err) {
    console.error('Error fetching strengths and weaknesses:', err);
    return res.status(500).json({ error: 'Failed to fetch strengths and weaknesses' });
  }
});

async function loadTeamAnalyticsContext(teamId, requestedSeasonId) {
  const teamResult = await db.query(`
    SELECT
      t.id,
      t.name,
      t.club_id,
      t.season_id,
      c.name AS club_name,
      s.name AS team_season_name,
      s.start_date AS team_season_start_date,
      s.end_date AS team_season_end_date,
      s.is_active AS team_season_is_active
    FROM teams t
    JOIN clubs c ON c.id = t.club_id
    LEFT JOIN seasons s ON s.id = t.season_id
    WHERE t.id = $1
  `, [teamId]);

  if (teamResult.rows.length === 0) {
    return { team: null, season: null };
  }

  const row = teamResult.rows[0];
  let season;

  if (requestedSeasonId) {
    season = await loadSeason(requestedSeasonId);
  } else if (row.season_id) {
    season = {
      id: row.season_id,
      name: row.team_season_name,
      start_date: row.team_season_start_date,
      end_date: row.team_season_end_date,
      is_active: row.team_season_is_active,
    };
  } else {
    season = await loadDefaultSeason();
  }

  return {
    team: {
      id: row.id,
      name: row.name,
      club_id: row.club_id,
      club_name: row.club_name,
      season_id: row.season_id,
      season_name: row.team_season_name,
    },
    season,
  };
}

async function loadSeason(seasonId) {
  const result = await db.query('SELECT id, name, start_date, end_date, is_active FROM seasons WHERE id = $1', [seasonId]);
  return result.rows[0] || null;
}

async function loadDefaultSeason() {
  const result = await db.query(`
    SELECT id, name, start_date, end_date, is_active
    FROM seasons
    ORDER BY is_active DESC, start_date DESC, id DESC
    LIMIT 1
  `);
  return result.rows[0] || null;
}

async function loadPreviousSeason(currentSeasonId) {
  const currentSeason = await loadSeason(currentSeasonId);
  if (!currentSeason) {
    return null;
  }

  const result = await db.query(`
    SELECT id, name, start_date, end_date, is_active
    FROM seasons
    WHERE start_date < $1
    ORDER BY start_date DESC, id DESC
    LIMIT 1
  `, [currentSeason.start_date]);
  return result.rows[0] || null;
}

async function buildTeamSeasonSummary(team, season) {
  const { games, scopeMode: gameScopeMode } = await fetchTeamGames(team, season?.id || null);
  const shotAnalytics = await fetchShotAnalytics(team, games);
  const record = buildRecordSummary(games);

  return {
    scope_mode: gameScopeMode === 'team' && shotAnalytics.scopeMode === 'team' ? 'team' : 'club_fallback',
    games,
    record,
    scoring: {
      total_shots: shotAnalytics.totalShots,
      total_goals: shotAnalytics.totalGoals,
      fg_percentage: shotAnalytics.fgPercentage,
      goals_for: record.goals_for,
      goals_against: record.goals_against,
      goal_difference: record.goal_difference,
      avg_goals_for: record.avg_goals_for,
      avg_goals_against: record.avg_goals_against,
      avg_goal_difference: record.avg_goal_difference,
    },
    top_scorers: shotAnalytics.topScorers,
    period_breakdown: shotAnalytics.periodBreakdown,
    per_game_metrics: shotAnalytics.perGameMetrics,
  };
}

async function fetchTeamGames(team, seasonId) {
  const teamScopeParams = [team.id];
  let teamScopeClause = '(g.home_team_id = $1 OR g.away_team_id = $1)';
  if (seasonId) {
    teamScopeParams.push(seasonId);
    teamScopeClause += ' AND g.season_id = $2';
  }

  const teamScopedCountResult = await db.query(`
    SELECT COUNT(*) AS count
    FROM games g
    WHERE g.status = 'completed' AND ${teamScopeClause}
  `, teamScopeParams);

  const useTeamScope = Number(teamScopedCountResult.rows[0]?.count || 0) > 0;
  const params = [useTeamScope ? team.id : team.club_id];
  let whereClause = useTeamScope ? '(g.home_team_id = $1 OR g.away_team_id = $1)' : '(g.home_club_id = $1 OR g.away_club_id = $1)';
  if (seasonId) {
    params.push(seasonId);
    whereClause += ` AND g.season_id = $${params.length}`;
  }

  const gamesResult = await db.query(`
    SELECT
      g.id,
      g.date,
      g.home_club_id,
      g.away_club_id,
      g.home_team_id,
      g.away_team_id,
      g.home_score,
      g.away_score,
      hc.name AS home_club_name,
      ac.name AS away_club_name,
      ht.name AS home_team_name,
      at.name AS away_team_name
    FROM games g
    JOIN clubs hc ON hc.id = g.home_club_id
    JOIN clubs ac ON ac.id = g.away_club_id
    LEFT JOIN teams ht ON ht.id = g.home_team_id
    LEFT JOIN teams at ON at.id = g.away_team_id
    WHERE g.status = 'completed' AND ${whereClause}
    ORDER BY g.date ASC, g.id ASC
  `, params);

  return {
    scopeMode: useTeamScope ? 'team' : 'club_fallback',
    games: gamesResult.rows.map((game) => normalizeGame(game, team, useTeamScope)),
  };
}

function normalizeGame(game, team, useTeamScope) {
  const isHome = useTeamScope ? game.home_team_id === team.id : game.home_club_id === team.club_id;
  const goalsFor = Number(isHome ? game.home_score : game.away_score) || 0;
  const goalsAgainst = Number(isHome ? game.away_score : game.home_score) || 0;
  const opponentName = useTeamScope
    ? (isHome ? game.away_team_name || game.away_club_name : game.home_team_name || game.home_club_name)
    : (isHome ? game.away_club_name : game.home_club_name);

  return {
    id: game.id,
    game_date: game.date,
    opponent_name: opponentName,
    venue: isHome ? 'home' : 'away',
    goals_for: goalsFor,
    goals_against: goalsAgainst,
    goal_difference: goalsFor - goalsAgainst,
    result: goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D',
  };
}

async function fetchShotAnalytics(team, games) {
  if (games.length === 0) {
    return { scopeMode: 'team', totalShots: 0, totalGoals: 0, fgPercentage: 0, topScorers: [], periodBreakdown: [], perGameMetrics: [] };
  }

  const gameIds = games.map((game) => game.id);
  const teamShotCountResult = await db.query(`
    SELECT COUNT(*) AS count
    FROM shots s
    JOIN players p ON p.id = s.player_id
    WHERE s.game_id = ANY($1) AND p.team_id = $2
  `, [gameIds, team.id]);

  const useTeamScope = Number(teamShotCountResult.rows[0]?.count || 0) > 0;
  const scopeCondition = useTeamScope ? 'p.team_id = $2' : 's.club_id = $2';
  const scopeValue = useTeamScope ? team.id : team.club_id;

  const totalsResult = await db.query(`
    SELECT COUNT(s.id) AS total_shots, COUNT(CASE WHEN s.result = 'goal' THEN 1 END) AS total_goals
    FROM shots s
    JOIN players p ON p.id = s.player_id
    WHERE s.game_id = ANY($1) AND ${scopeCondition}
  `, [gameIds, scopeValue]);

  const topScorersResult = await db.query(`
    SELECT
      p.id AS player_id,
      CONCAT(p.first_name, ' ', p.last_name) AS player_name,
      p.jersey_number,
      COUNT(CASE WHEN s.result = 'goal' THEN 1 END) AS goals,
      COUNT(s.id) AS shots,
      ROUND(COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / NULLIF(COUNT(s.id)::numeric, 0) * 100, 2) AS fg_percentage
    FROM shots s
    JOIN players p ON p.id = s.player_id
    WHERE s.game_id = ANY($1) AND ${scopeCondition}
    GROUP BY p.id, p.first_name, p.last_name, p.jersey_number
    ORDER BY goals DESC, shots ASC, player_name ASC
    LIMIT ${DEFAULT_TOP_SCORERS_LIMIT}
  `, [gameIds, scopeValue]);

  const periodBreakdownResult = await db.query(`
    SELECT
      s.period,
      COUNT(s.id) AS shots,
      COUNT(CASE WHEN s.result = 'goal' THEN 1 END) AS goals,
      ROUND(COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / NULLIF(COUNT(s.id)::numeric, 0) * 100, 2) AS fg_percentage
    FROM shots s
    JOIN players p ON p.id = s.player_id
    WHERE s.game_id = ANY($1) AND ${scopeCondition}
    GROUP BY s.period
    ORDER BY s.period ASC
  `, [gameIds, scopeValue]);

  const perGameMetricsResult = await db.query(`
    SELECT
      s.game_id,
      COUNT(s.id) AS shots,
      COUNT(CASE WHEN s.result = 'goal' THEN 1 END) AS goals,
      ROUND(COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / NULLIF(COUNT(s.id)::numeric, 0) * 100, 2) AS fg_percentage
    FROM shots s
    JOIN players p ON p.id = s.player_id
    WHERE s.game_id = ANY($1) AND ${scopeCondition}
    GROUP BY s.game_id
    ORDER BY s.game_id ASC
  `, [gameIds, scopeValue]);

  const totalShots = parseInt(totalsResult.rows[0]?.total_shots, 10) || 0;
  const totalGoals = parseInt(totalsResult.rows[0]?.total_goals, 10) || 0;

  return {
    scopeMode: useTeamScope ? 'team' : 'club_fallback',
    totalShots,
    totalGoals,
    fgPercentage: totalShots > 0 ? round((totalGoals / totalShots) * 100) : 0,
    topScorers: topScorersResult.rows.map((row) => ({
      player_id: row.player_id,
      player_name: row.player_name,
      jersey_number: row.jersey_number,
      goals: parseInt(row.goals, 10) || 0,
      shots: parseInt(row.shots, 10) || 0,
      fg_percentage: parseFloat(row.fg_percentage) || 0,
    })),
    periodBreakdown: periodBreakdownResult.rows.map((row) => ({
      period: parseInt(row.period, 10) || 0,
      shots: parseInt(row.shots, 10) || 0,
      goals: parseInt(row.goals, 10) || 0,
      fg_percentage: parseFloat(row.fg_percentage) || 0,
    })),
    perGameMetrics: perGameMetricsResult.rows.map((row) => ({
      game_id: row.game_id,
      shots: parseInt(row.shots, 10) || 0,
      goals: parseInt(row.goals, 10) || 0,
      fg_percentage: parseFloat(row.fg_percentage) || 0,
    })),
  };
}

function buildRecordSummary(games) {
  const gamesPlayed = games.length;
  const wins = games.filter((game) => game.result === 'W').length;
  const losses = games.filter((game) => game.result === 'L').length;
  const draws = games.filter((game) => game.result === 'D').length;
  const goalsFor = games.reduce((total, game) => total + game.goals_for, 0);
  const goalsAgainst = games.reduce((total, game) => total + game.goals_against, 0);

  return {
    games_played: gamesPlayed,
    wins,
    losses,
    draws,
    points: (wins * POINTS_PER_WIN) + draws,
    win_percentage: gamesPlayed > 0 ? round((wins / gamesPlayed) * 100) : 0,
    goals_for: goalsFor,
    goals_against: goalsAgainst,
    goal_difference: goalsFor - goalsAgainst,
    avg_goals_for: gamesPlayed > 0 ? round(goalsFor / gamesPlayed) : 0,
    avg_goals_against: gamesPlayed > 0 ? round(goalsAgainst / gamesPlayed) : 0,
    avg_goal_difference: gamesPlayed > 0 ? round((goalsFor - goalsAgainst) / gamesPlayed) : 0,
  };
}

function buildMomentumTrend(games, perGameMetrics) {
  const metricMap = new Map(perGameMetrics.map((metric) => [metric.game_id, metric]));

  return games.map((game, index) => {
    const metrics = metricMap.get(game.id) || { shots: 0, goals: 0, fg_percentage: 0 };
    const rollingWindow = games.slice(Math.max(0, index - MOMENTUM_ROLLING_WINDOW + 1), index + 1);
    const rollingMetrics = rollingWindow.map((rollingGame) => metricMap.get(rollingGame.id) || { shots: 0, goals: 0, fg_percentage: 0 });
    const rollingFgPercentage = rollingMetrics.length > 0 ? round(rollingMetrics.reduce((total, metric) => total + metric.fg_percentage, 0) / rollingMetrics.length) : 0;
    const rollingPointsPerGame = rollingWindow.length > 0 ? round(rollingWindow.reduce((total, rollingGame) => total + (rollingGame.result === 'W' ? POINTS_PER_WIN : rollingGame.result === 'D' ? 1 : 0), 0) / rollingWindow.length) : 0;

    return {
      game_id: game.id,
      game_date: game.game_date,
      opponent_name: game.opponent_name,
      venue: game.venue,
      result: game.result,
      goals_for: game.goals_for,
      goals_against: game.goals_against,
      goal_difference: game.goal_difference,
      shots: metrics.shots,
      goals: metrics.goals,
      fg_percentage: metrics.fg_percentage,
      momentum_score: round((metrics.fg_percentage - 50) + (game.result === 'W' ? 18 : game.result === 'D' ? 6 : -12) + (game.goal_difference * 4)),
      rolling_fg_percentage: rollingFgPercentage,
      rolling_points_per_game: rollingPointsPerGame,
    };
  });
}

function buildCurrentStreak(results) {
  if (results.length === 0) {
    return '';
  }

  const reversed = [...results].reverse();
  const streakType = reversed[0];
  let count = 0;
  for (const result of reversed) {
    if (result !== streakType) {
      break;
    }
    count += 1;
  }
  return `${streakType}${count}`;
}

async function buildLeagueBenchmarks(seasonId = null) {
  const rankings = (await calculateTeamRankings(seasonId, 500)).filter(Boolean);
  const shootingParams = [];
  let shootingWhere = 'g.status = \'completed\'';

  if (seasonId) {
    shootingParams.push(seasonId);
    shootingWhere += ' AND g.season_id = $1';
  }

  const shootingResult = await db.query(`
    SELECT
      s.club_id,
      ROUND(COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / NULLIF(COUNT(s.id)::numeric, 0) * 100, 2) AS fg_percentage
    FROM shots s
    JOIN games g ON g.id = s.game_id
    WHERE ${shootingWhere}
    GROUP BY s.club_id
  `, shootingParams);

  const shootingPercentages = shootingResult.rows.map((row) => parseFloat(row.fg_percentage) || 0);
  return {
    win_percentage: rankings.length > 0 ? round(average(rankings.map((item) => item.games_played > 0 ? (item.wins / item.games_played) * 100 : 0))) : 0,
    goals_for_per_game: rankings.length > 0 ? round(average(rankings.map((item) => item.avg_goals_per_game || 0))) : 0,
    goals_against_per_game: rankings.length > 0 ? round(average(rankings.map((item) => item.avg_goals_conceded || 0))) : 0,
    fg_percentage: round(average(shootingPercentages)),
    goal_difference_per_game: rankings.length > 0 ? round(average(rankings.map((item) => item.games_played > 0 ? item.goal_difference / item.games_played : 0))) : 0,
  };
}

function buildStrengthsWeaknessesAnalysis(summary, benchmarks) {
  if (summary.record.games_played === 0) {
    return { strengths: [], weaknesses: [] };
  }

  const metricDefinitions = [
    {
      metric: 'win_percentage',
      title: 'Winning form',
      current: summary.record.win_percentage,
      benchmark: benchmarks.win_percentage,
      goodWhenHigher: true,
      strengthDescription: (current, benchmark) => `Wins ${current.toFixed(1)}% of matches versus a ${benchmark.toFixed(1)}% benchmark.`,
      weaknessDescription: (current, benchmark) => `Sits below the benchmark at ${current.toFixed(1)}% versus ${benchmark.toFixed(1)}%.`,
    },
    {
      metric: 'goals_for_per_game',
      title: 'Attacking output',
      current: summary.scoring.avg_goals_for,
      benchmark: benchmarks.goals_for_per_game,
      goodWhenHigher: true,
      strengthDescription: (current, benchmark) => `Scores ${current.toFixed(2)} goals per game against a ${benchmark.toFixed(2)} benchmark.`,
      weaknessDescription: (current, benchmark) => `Only generates ${current.toFixed(2)} goals per game against a ${benchmark.toFixed(2)} benchmark.`,
    },
    {
      metric: 'goals_against_per_game',
      title: 'Defensive control',
      current: summary.scoring.avg_goals_against,
      benchmark: benchmarks.goals_against_per_game,
      goodWhenHigher: false,
      strengthDescription: (current, benchmark) => `Concedes ${current.toFixed(2)} goals per game, tighter than the ${benchmark.toFixed(2)} benchmark.`,
      weaknessDescription: (current, benchmark) => `Allows ${current.toFixed(2)} goals per game, above the ${benchmark.toFixed(2)} benchmark.`,
    },
    {
      metric: 'fg_percentage',
      title: 'Shot efficiency',
      current: summary.scoring.fg_percentage,
      benchmark: benchmarks.fg_percentage,
      goodWhenHigher: true,
      strengthDescription: (current, benchmark) => `Converts ${current.toFixed(1)}% of shots against a ${benchmark.toFixed(1)}% benchmark.`,
      weaknessDescription: (current, benchmark) => `Converts ${current.toFixed(1)}% of shots, below the ${benchmark.toFixed(1)}% benchmark.`,
    },
    {
      metric: 'goal_difference_per_game',
      title: 'Score margin',
      current: summary.scoring.avg_goal_difference,
      benchmark: benchmarks.goal_difference_per_game,
      goodWhenHigher: true,
      strengthDescription: (current, benchmark) => `Carries a ${current.toFixed(2)} goal difference per game against a ${benchmark.toFixed(2)} benchmark.`,
      weaknessDescription: (current, benchmark) => `Goal difference per game sits at ${current.toFixed(2)} against a ${benchmark.toFixed(2)} benchmark.`,
    },
  ];

  const ratedMetrics = metricDefinitions.map((definition) => ({
    ...definition,
    rawDelta: round(definition.current - definition.benchmark),
    effectiveDelta: definition.goodWhenHigher ? definition.current - definition.benchmark : definition.benchmark - definition.current,
  }));

  const strengthsPool = ratedMetrics.filter((metric) => metric.effectiveDelta >= 0).sort((left, right) => right.effectiveDelta - left.effectiveDelta);
  const weaknessesPool = ratedMetrics.filter((metric) => metric.effectiveDelta < 0).sort((left, right) => left.effectiveDelta - right.effectiveDelta);

  const strengthsSource = strengthsPool.length > 0 ? strengthsPool : [...ratedMetrics].sort((left, right) => right.effectiveDelta - left.effectiveDelta);
  const weaknessesSource = weaknessesPool.length > 0 ? weaknessesPool : [...ratedMetrics].sort((left, right) => left.effectiveDelta - right.effectiveDelta);

  return {
    strengths: strengthsSource.slice(0, 3).map((metric) => ({
      title: metric.title,
      description: metric.strengthDescription(metric.current, metric.benchmark),
      metric: metric.metric,
      value: round(metric.current),
      benchmark: round(metric.benchmark),
      delta: metric.rawDelta,
    })),
    weaknesses: weaknessesSource.slice(0, 3).map((metric) => ({
      title: metric.title,
      description: metric.weaknessDescription(metric.current, metric.benchmark),
      metric: metric.metric,
      value: round(metric.current),
      benchmark: round(metric.benchmark),
      delta: metric.rawDelta,
    })),
  };
}

async function calculateTeamRankings(seasonId = null, limit = 20) {
  let gameFilter = 'g.status = \'completed\'';
  const params = [];
  if (seasonId) {
    gameFilter += ' AND g.season_id = $1';
    params.push(seasonId);
  }

  const clubsResult = await db.query(`
    SELECT DISTINCT club_id FROM (
      SELECT home_club_id AS club_id FROM games g WHERE ${gameFilter}
      UNION
      SELECT away_club_id AS club_id FROM games g WHERE ${gameFilter}
    ) clubs
  `, params);

  const rankings = (await Promise.all(clubsResult.rows.map(async ({ club_id }) => calculateTeamRanking(Number(club_id), seasonId)))).filter(Boolean);
  rankings.sort((left, right) => (right.rating || 0) - (left.rating || 0));
  rankings.forEach((ranking, index) => {
    ranking.overall_rank = index + 1;
  });
  return rankings.slice(0, limit);
}

async function calculateTeamRanking(clubId, seasonId = null) {
  const clubIdNumber = Number(clubId);
  let gameFilter = 'g.status = \'completed\' AND (g.home_club_id = $1 OR g.away_club_id = $1)';
  const params = [clubIdNumber];
  if (seasonId) {
    gameFilter += ' AND g.season_id = $2';
    params.push(seasonId);
  }

  const clubResult = await db.query('SELECT id, name FROM clubs WHERE id = $1', [clubIdNumber]);
  if (clubResult.rows.length === 0) {
    return null;
  }

  const statsResult = await db.query(`
    SELECT
      COUNT(*) AS games_played,
      COUNT(CASE WHEN (g.home_club_id = $1 AND g.home_score > g.away_score) OR (g.away_club_id = $1 AND g.away_score > g.home_score) THEN 1 END) AS wins,
      COUNT(CASE WHEN (g.home_club_id = $1 AND g.home_score < g.away_score) OR (g.away_club_id = $1 AND g.away_score < g.home_score) THEN 1 END) AS losses,
      COUNT(CASE WHEN g.home_score = g.away_score THEN 1 END) AS draws,
      SUM(CASE WHEN g.home_club_id = $1 THEN g.home_score ELSE g.away_score END) AS goals_for,
      SUM(CASE WHEN g.home_club_id = $1 THEN g.away_score ELSE g.home_score END) AS goals_against,
      COUNT(CASE WHEN (g.home_club_id = $1 AND g.away_score = 0) OR (g.away_club_id = $1 AND g.home_score = 0) THEN 1 END) AS clean_sheets
    FROM games g
    WHERE ${gameFilter}
  `, params);

  const stats = statsResult.rows[0];
  const gamesPlayed = parseInt(stats.games_played, 10) || 0;
  const wins = parseInt(stats.wins, 10) || 0;
  const losses = parseInt(stats.losses, 10) || 0;
  const draws = parseInt(stats.draws, 10) || 0;
  const goalsFor = parseInt(stats.goals_for, 10) || 0;
  const goalsAgainst = parseInt(stats.goals_against, 10) || 0;
  const cleanSheets = parseInt(stats.clean_sheets, 10) || 0;

  let rating = 1000;
  if (gamesPlayed > 0) {
    rating = 1000 + ((wins / gamesPlayed) * 200) + (((goalsFor - goalsAgainst) / gamesPlayed) * 50);
  }

  const recentGames = await db.query(`
    SELECT
      CASE
        WHEN (g.home_club_id = $1 AND g.home_score > g.away_score) OR (g.away_club_id = $1 AND g.away_score > g.home_score) THEN 'W'
        WHEN (g.home_club_id = $1 AND g.home_score < g.away_score) OR (g.away_club_id = $1 AND g.away_score < g.home_score) THEN 'L'
        ELSE 'D'
      END AS result
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
      tempWinStreak += 1;
      if (tempWinStreak > longestWinStreak) {
        longestWinStreak = tempWinStreak;
      }
    } else {
      tempWinStreak = 0;
    }

    if (index === 0) {
      currentStreakType = game.result;
      currentStreakCount = 1;
    } else if (game.result === currentStreakType) {
      currentStreakCount += 1;
    }
  });

  if (currentStreakType && currentStreakCount > 0) {
    currentStreak = `${currentStreakType}${currentStreakCount}`;
  }

  return {
    club_id: clubIdNumber,
    club_name: clubResult.rows[0].name,
    team_id: clubIdNumber,
    team_name: clubResult.rows[0].name,
    season_id: seasonId,
    games_played: gamesPlayed,
    wins,
    losses,
    draws,
    points: (wins * POINTS_PER_WIN) + draws,
    rating: round(rating),
    goals_for: goalsFor,
    goals_against: goalsAgainst,
    goal_difference: goalsFor - goalsAgainst,
    avg_goals_per_game: gamesPlayed > 0 ? round(goalsFor / gamesPlayed) : 0,
    avg_goals_conceded: gamesPlayed > 0 ? round(goalsAgainst / gamesPlayed) : 0,
    clean_sheets: cleanSheets,
    longest_win_streak: longestWinStreak,
    current_streak: currentStreak,
  };
}

function average(values) {
  if (!values || values.length === 0) {
    return 0;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Number(value.toFixed(digits));
}

export default router;
