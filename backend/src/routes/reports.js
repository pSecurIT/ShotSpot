import express from 'express';
import { param, query, validationResult } from 'express-validator';
import db from '../db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

/**
 * Get season performance report for a team
 * Returns overall record, standings, progression, and home/away performance
 */
router.get('/season/team/:teamId', [
  param('teamId').isInt().withMessage('Team ID must be an integer'),
  query('seasonId').optional().isInt().withMessage('Season ID must be an integer'),
  query('year').optional().isInt({ min: 2000, max: 2100 }).withMessage('Year must be between 2000 and 2100')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { teamId } = req.params;
  const { seasonId, year } = req.query;

  try {
    // Build season filter
    let seasonFilter = '';
    let seasonParams = [teamId];
    
    if (seasonId) {
      seasonFilter = 'AND g.season_id = $2';
      seasonParams.push(seasonId);
    } else if (year) {
      seasonFilter = 'AND EXTRACT(YEAR FROM g.date) = $2';
      seasonParams.push(year);
    }

    // Get overall record
    const recordQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE 
          (g.home_team_id = $1 AND g.home_score > g.away_score) OR 
          (g.away_team_id = $1 AND g.away_score > g.home_score)
        ) as wins,
        COUNT(*) FILTER (WHERE 
          (g.home_team_id = $1 AND g.home_score < g.away_score) OR 
          (g.away_team_id = $1 AND g.away_score < g.home_score)
        ) as losses,
        COUNT(*) FILTER (WHERE g.home_score = g.away_score) as draws,
        COUNT(*) as total_games,
        SUM(CASE WHEN g.home_team_id = $1 THEN g.home_score ELSE g.away_score END) as points_for,
        SUM(CASE WHEN g.home_team_id = $1 THEN g.away_score ELSE g.home_score END) as points_against
      FROM games g
      WHERE (g.home_team_id = $1 OR g.away_team_id = $1)
        AND g.status = 'completed'
        ${seasonFilter}
    `;
    const recordResult = await db.query(recordQuery, seasonParams);
    const record = recordResult.rows[0];

    // Get home vs away performance
    const homeAwayQuery = `
      SELECT 
        'home' as venue,
        COUNT(*) as games,
        COUNT(*) FILTER (WHERE g.home_score > g.away_score) as wins,
        COUNT(*) FILTER (WHERE g.home_score < g.away_score) as losses,
        COUNT(*) FILTER (WHERE g.home_score = g.away_score) as draws,
        AVG(g.home_score) as avg_points_for,
        AVG(g.away_score) as avg_points_against
      FROM games g
      WHERE g.home_team_id = $1 AND g.status = 'completed' ${seasonFilter}
      UNION ALL
      SELECT 
        'away' as venue,
        COUNT(*) as games,
        COUNT(*) FILTER (WHERE g.away_score > g.home_score) as wins,
        COUNT(*) FILTER (WHERE g.away_score < g.home_score) as losses,
        COUNT(*) FILTER (WHERE g.home_score = g.away_score) as draws,
        AVG(g.away_score) as avg_points_for,
        AVG(g.home_score) as avg_points_against
      FROM games g
      WHERE g.away_team_id = $1 AND g.status = 'completed' ${seasonFilter}
    `;
    const homeAwayResult = await db.query(homeAwayQuery, seasonParams);

    // Get scoring trends over time (by game date)
    const trendsQuery = `
      SELECT 
        g.id as game_id,
        g.date,
        CASE WHEN g.home_team_id = $1 THEN g.home_score ELSE g.away_score END as points_for,
        CASE WHEN g.home_team_id = $1 THEN g.away_score ELSE g.home_score END as points_against,
        CASE 
          WHEN (g.home_team_id = $1 AND g.home_score > g.away_score) OR 
               (g.away_team_id = $1 AND g.away_score > g.home_score) THEN 'W'
          WHEN g.home_score = g.away_score THEN 'D'
          ELSE 'L'
        END as result
      FROM games g
      WHERE (g.home_team_id = $1 OR g.away_team_id = $1)
        AND g.status = 'completed'
        ${seasonFilter}
      ORDER BY g.date ASC
    `;
    const trendsResult = await db.query(trendsQuery, seasonParams);

    // Get shooting statistics trends
    const shootingTrendsQuery = `
      SELECT 
        g.id as game_id,
        g.date,
        COUNT(s.id) as shots,
        COUNT(s.id) FILTER (WHERE s.result = 'goal') as goals,
        ROUND(
          COUNT(s.id) FILTER (WHERE s.result = 'goal')::numeric / 
          NULLIF(COUNT(s.id)::numeric, 0) * 100, 
          2
        ) as fg_percentage
      FROM games g
      LEFT JOIN shots s ON s.game_id = g.id AND s.team_id = $1
      WHERE (g.home_team_id = $1 OR g.away_team_id = $1)
        AND g.status = 'completed'
        ${seasonFilter}
      GROUP BY g.id, g.date
      ORDER BY g.date ASC
    `;
    const shootingTrendsResult = await db.query(shootingTrendsQuery, seasonParams);

    // Get indoor vs outdoor comparison (if season type is tracked)
    let indoorOutdoorComparison = null;
    if (!seasonId && !year) {
      const indoorOutdoorQuery = `
        SELECT 
          s.season_type,
          COUNT(g.id) as games,
          COUNT(*) FILTER (WHERE 
            (g.home_team_id = $1 AND g.home_score > g.away_score) OR 
            (g.away_team_id = $1 AND g.away_score > g.home_score)
          ) as wins,
          AVG(CASE WHEN g.home_team_id = $1 THEN g.home_score ELSE g.away_score END) as avg_points_for,
          AVG(CASE WHEN g.home_team_id = $1 THEN g.away_score ELSE g.home_score END) as avg_points_against
        FROM games g
        LEFT JOIN seasons s ON g.season_id = s.id
        WHERE (g.home_team_id = $1 OR g.away_team_id = $1)
          AND g.status = 'completed'
          AND s.season_type IS NOT NULL
        GROUP BY s.season_type
      `;
      const indoorOutdoorResult = await db.query(indoorOutdoorQuery, [teamId]);
      indoorOutdoorComparison = indoorOutdoorResult.rows;
    }

    res.json({
      overall_record: {
        wins: parseInt(record.wins) || 0,
        losses: parseInt(record.losses) || 0,
        draws: parseInt(record.draws) || 0,
        total_games: parseInt(record.total_games) || 0,
        win_percentage: record.total_games > 0 
          ? parseFloat(((parseInt(record.wins) / parseInt(record.total_games)) * 100).toFixed(2))
          : 0,
        points_for: parseInt(record.points_for) || 0,
        points_against: parseInt(record.points_against) || 0,
        point_differential: (parseInt(record.points_for) || 0) - (parseInt(record.points_against) || 0)
      },
      home_away_performance: homeAwayResult.rows.map(row => ({
        venue: row.venue,
        games: parseInt(row.games),
        wins: parseInt(row.wins),
        losses: parseInt(row.losses),
        draws: parseInt(row.draws),
        win_percentage: row.games > 0 
          ? parseFloat(((parseInt(row.wins) / parseInt(row.games)) * 100).toFixed(2))
          : 0,
        avg_points_for: parseFloat(row.avg_points_for) || 0,
        avg_points_against: parseFloat(row.avg_points_against) || 0
      })),
      scoring_trends: trendsResult.rows.map(row => ({
        game_id: row.game_id,
        date: row.date,
        points_for: parseInt(row.points_for),
        points_against: parseInt(row.points_against),
        result: row.result
      })),
      shooting_trends: shootingTrendsResult.rows.map(row => ({
        game_id: row.game_id,
        date: row.date,
        shots: parseInt(row.shots),
        goals: parseInt(row.goals),
        fg_percentage: parseFloat(row.fg_percentage) || 0
      })),
      indoor_outdoor_comparison: indoorOutdoorComparison ? indoorOutdoorComparison.map(row => ({
        season_type: row.season_type,
        games: parseInt(row.games),
        wins: parseInt(row.wins),
        avg_points_for: parseFloat(row.avg_points_for) || 0,
        avg_points_against: parseFloat(row.avg_points_against) || 0
      })) : null
    });
  } catch (err) {
    console.error('Error fetching season team report:', err);
    res.status(500).json({ error: 'Failed to fetch season team report' });
  }
});

/**
 * Get player season summary
 * Returns games played, minutes, scoring stats, and career statistics
 */
router.get('/season/player/:playerId', [
  param('playerId').isInt().withMessage('Player ID must be an integer'),
  query('seasonId').optional().isInt().withMessage('Season ID must be an integer'),
  query('year').optional().isInt({ min: 2000, max: 2100 }).withMessage('Year must be between 2000 and 2100')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { playerId } = req.params;
  const { seasonId, year } = req.query;

  try {
    // Build season filter
    let seasonFilter = '';
    let seasonParams = [playerId];
    
    if (seasonId) {
      seasonFilter = 'AND g.season_id = $2';
      seasonParams.push(seasonId);
    } else if (year) {
      seasonFilter = 'AND EXTRACT(YEAR FROM g.date) = $2';
      seasonParams.push(year);
    }

    // Get player info
    const playerInfo = await db.query(
      'SELECT p.*, t.name as team_name FROM players p LEFT JOIN teams t ON p.team_id = t.id WHERE p.id = $1',
      [playerId]
    );
    
    if (playerInfo.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Get games played
    const gamesPlayedQuery = `
      SELECT COUNT(DISTINCT gr.game_id) as games_played
      FROM game_rosters gr
      JOIN games g ON gr.game_id = g.id
      WHERE gr.player_id = $1 AND g.status = 'completed' ${seasonFilter}
    `;
    const gamesPlayedResult = await db.query(gamesPlayedQuery, seasonParams);

    // Get total minutes played (this would need play time tracking)
    // For now, we'll estimate based on substitutions
    // Note: This is a placeholder for future play time tracking implementation

    // Get shooting statistics
    const shootingStatsQuery = `
      SELECT 
        COUNT(*) as total_shots,
        COUNT(*) FILTER (WHERE s.result = 'goal') as total_goals,
        ROUND(
          COUNT(*) FILTER (WHERE s.result = 'goal')::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as fg_percentage,
        ROUND(AVG(s.distance), 2) as avg_distance
      FROM shots s
      JOIN games g ON s.game_id = g.id
      WHERE s.player_id = $1 AND g.status = 'completed' ${seasonFilter}
    `;
    const shootingStatsResult = await db.query(shootingStatsQuery, seasonParams);

    // Get shooting zones heatmap (aggregated)
    const heatmapQuery = `
      SELECT 
        CASE 
          WHEN s.x_coord < 33.33 THEN 'left'
          WHEN s.x_coord >= 33.33 AND s.x_coord < 66.67 THEN 'center'
          ELSE 'right'
        END as zone_x,
        CASE 
          WHEN s.y_coord < 33.33 THEN 'near'
          WHEN s.y_coord >= 33.33 AND s.y_coord < 66.67 THEN 'mid'
          ELSE 'far'
        END as zone_y,
        COUNT(*) as shots,
        COUNT(*) FILTER (WHERE s.result = 'goal') as goals,
        ROUND(
          COUNT(*) FILTER (WHERE s.result = 'goal')::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as fg_percentage
      FROM shots s
      JOIN games g ON s.game_id = g.id
      WHERE s.player_id = $1 AND g.status = 'completed' ${seasonFilter}
      GROUP BY zone_x, zone_y
    `;
    const heatmapResult = await db.query(heatmapQuery, seasonParams);

    // Get game-by-game performance
    const gamePerformanceQuery = `
      SELECT 
        g.id as game_id,
        g.date,
        COUNT(s.id) as shots,
        COUNT(s.id) FILTER (WHERE s.result = 'goal') as goals,
        ROUND(
          COUNT(s.id) FILTER (WHERE s.result = 'goal')::numeric / 
          NULLIF(COUNT(s.id)::numeric, 0) * 100, 
          2
        ) as fg_percentage
      FROM games g
      LEFT JOIN shots s ON s.game_id = g.id AND s.player_id = $1
      JOIN game_rosters gr ON gr.game_id = g.id AND gr.player_id = $1
      WHERE g.status = 'completed' ${seasonFilter}
      GROUP BY g.id, g.date
      ORDER BY g.date ASC
    `;
    const gamePerformanceResult = await db.query(gamePerformanceQuery, seasonParams);

    // Get best and worst performances
    const performances = gamePerformanceResult.rows.map(row => ({
      game_id: row.game_id,
      date: row.date,
      shots: parseInt(row.shots),
      goals: parseInt(row.goals),
      fg_percentage: parseFloat(row.fg_percentage) || 0
    }));

    const bestPerformance = performances.length > 0 
      ? performances.reduce((best, current) => 
        current.goals > best.goals ? current : best
      )
      : null;

    const worstPerformance = performances.length > 0 
      ? performances.reduce((worst, current) => 
        (current.shots > 0 && current.fg_percentage < worst.fg_percentage) ? current : worst
      )
      : null;

    // Get career statistics (all seasons)
    const careerStatsQuery = `
      SELECT 
        COUNT(DISTINCT g.id) as career_games,
        COUNT(s.id) as career_shots,
        COUNT(s.id) FILTER (WHERE s.result = 'goal') as career_goals,
        ROUND(
          COUNT(s.id) FILTER (WHERE s.result = 'goal')::numeric / 
          NULLIF(COUNT(s.id)::numeric, 0) * 100, 
          2
        ) as career_fg_percentage
      FROM shots s
      JOIN games g ON s.game_id = g.id
      WHERE s.player_id = $1 AND g.status = 'completed'
    `;
    const careerStatsResult = await db.query(careerStatsQuery, [playerId]);

    const shootingStats = shootingStatsResult.rows[0];
    const careerStats = careerStatsResult.rows[0];
    const gamesPlayed = parseInt(gamesPlayedResult.rows[0].games_played) || 0;

    res.json({
      player: {
        id: playerInfo.rows[0].id,
        first_name: playerInfo.rows[0].first_name,
        last_name: playerInfo.rows[0].last_name,
        jersey_number: playerInfo.rows[0].jersey_number,
        team_name: playerInfo.rows[0].team_name
      },
      season_summary: {
        games_played: gamesPlayed,
        total_minutes: null, // Would need more detailed tracking
        total_shots: parseInt(shootingStats.total_shots) || 0,
        total_goals: parseInt(shootingStats.total_goals) || 0,
        fg_percentage: parseFloat(shootingStats.fg_percentage) || 0,
        avg_distance: parseFloat(shootingStats.avg_distance) || 0,
        points_per_game: gamesPlayed > 0 
          ? parseFloat(((parseInt(shootingStats.total_goals) || 0) / gamesPlayed).toFixed(2))
          : 0
      },
      shooting_zones_heatmap: heatmapResult.rows.map(row => ({
        zone_x: row.zone_x,
        zone_y: row.zone_y,
        shots: parseInt(row.shots),
        goals: parseInt(row.goals),
        fg_percentage: parseFloat(row.fg_percentage) || 0
      })),
      game_performance: performances,
      best_performance: bestPerformance,
      worst_performance: worstPerformance,
      career_statistics: {
        games: parseInt(careerStats.career_games) || 0,
        shots: parseInt(careerStats.career_shots) || 0,
        goals: parseInt(careerStats.career_goals) || 0,
        fg_percentage: parseFloat(careerStats.career_fg_percentage) || 0
      }
    });
  } catch (err) {
    console.error('Error fetching player season summary:', err);
    res.status(500).json({ error: 'Failed to fetch player season summary' });
  }
});

/**
 * Get comparative analysis for teams
 * Compare team vs league averages and season-over-season
 */
router.get('/comparative/teams/:teamId', [
  param('teamId').isInt().withMessage('Team ID must be an integer'),
  query('compareSeasonId').optional().isInt().withMessage('Compare Season ID must be an integer'),
  query('compareYear').optional().isInt({ min: 2000, max: 2100 }).withMessage('Compare year must be between 2000 and 2100')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { teamId } = req.params;
  const { compareSeasonId, compareYear } = req.query;

  try {
    // Get current season stats for the team
    const currentStatsQuery = `
      SELECT 
        COUNT(*) as games,
        AVG(CASE WHEN g.home_team_id = $1 THEN g.home_score ELSE g.away_score END) as avg_points_for,
        AVG(CASE WHEN g.home_team_id = $1 THEN g.away_score ELSE g.home_score END) as avg_points_against,
        COUNT(*) FILTER (WHERE 
          (g.home_team_id = $1 AND g.home_score > g.away_score) OR 
          (g.away_team_id = $1 AND g.away_score > g.home_score)
        )::float / NULLIF(COUNT(*)::float, 0) * 100 as win_percentage
      FROM games g
      WHERE (g.home_team_id = $1 OR g.away_team_id = $1)
        AND g.status = 'completed'
    `;
    const currentStats = await db.query(currentStatsQuery, [teamId]);

    // Get league averages (all teams)
    const leagueAveragesQuery = `
      SELECT 
        AVG(team_stats.avg_points) as league_avg_points,
        AVG(team_stats.win_pct) as league_avg_win_pct
      FROM (
        SELECT 
          teams.id,
          AVG(CASE 
            WHEN g.home_team_id = teams.id THEN g.home_score 
            ELSE g.away_score 
          END) as avg_points,
          COUNT(*) FILTER (WHERE 
            (g.home_team_id = teams.id AND g.home_score > g.away_score) OR 
            (g.away_team_id = teams.id AND g.away_score > g.home_score)
          )::float / NULLIF(COUNT(*)::float, 0) * 100 as win_pct
        FROM teams
        LEFT JOIN games g ON (g.home_team_id = teams.id OR g.away_team_id = teams.id)
          AND g.status = 'completed'
        GROUP BY teams.id
        HAVING COUNT(*) > 0
      ) as team_stats
    `;
    const leagueAverages = await db.query(leagueAveragesQuery);

    // Get shooting comparison
    const shootingCompQuery = `
      SELECT 
        COUNT(s.id) FILTER (WHERE s.result = 'goal')::float / 
          NULLIF(COUNT(s.id)::float, 0) * 100 as team_fg_pct,
        (
          SELECT COUNT(*) FILTER (WHERE result = 'goal')::float / 
            NULLIF(COUNT(*)::float, 0) * 100
          FROM shots
        ) as league_avg_fg_pct
      FROM shots s
      JOIN games g ON s.game_id = g.id
      WHERE s.team_id = $1 AND g.status = 'completed'
    `;
    const shootingComp = await db.query(shootingCompQuery, [teamId]);

    // Season-over-season comparison (if requested)
    let seasonComparison = null;
    if (compareSeasonId || compareYear) {
      const compareFilter = compareSeasonId 
        ? 'AND g.season_id = $2'
        : 'AND EXTRACT(YEAR FROM g.date) = $2';
      const compareParam = compareSeasonId || compareYear;

      const compareStatsQuery = `
        SELECT 
          COUNT(*) as games,
          AVG(CASE WHEN g.home_team_id = $1 THEN g.home_score ELSE g.away_score END) as avg_points_for,
          AVG(CASE WHEN g.home_team_id = $1 THEN g.away_score ELSE g.home_score END) as avg_points_against,
          COUNT(*) FILTER (WHERE 
            (g.home_team_id = $1 AND g.home_score > g.away_score) OR 
            (g.away_team_id = $1 AND g.away_score > g.home_score)
          )::float / NULLIF(COUNT(*)::float, 0) * 100 as win_percentage
        FROM games g
        WHERE (g.home_team_id = $1 OR g.away_team_id = $1)
          AND g.status = 'completed'
          ${compareFilter}
      `;
      const compareStats = await db.query(compareStatsQuery, [teamId, compareParam]);

      const current = currentStats.rows[0];
      const previous = compareStats.rows[0];

      seasonComparison = {
        current_season: {
          games: parseInt(current.games),
          avg_points_for: parseFloat(current.avg_points_for) || 0,
          avg_points_against: parseFloat(current.avg_points_against) || 0,
          win_percentage: parseFloat(current.win_percentage) || 0
        },
        compare_season: {
          games: parseInt(previous.games),
          avg_points_for: parseFloat(previous.avg_points_for) || 0,
          avg_points_against: parseFloat(previous.avg_points_against) || 0,
          win_percentage: parseFloat(previous.win_percentage) || 0
        },
        changes: {
          points_for_change: parseFloat(((current.avg_points_for || 0) - (previous.avg_points_for || 0)).toFixed(2)),
          points_against_change: parseFloat(((current.avg_points_against || 0) - (previous.avg_points_against || 0)).toFixed(2)),
          win_percentage_change: parseFloat(((current.win_percentage || 0) - (previous.win_percentage || 0)).toFixed(2))
        }
      };
    }

    const current = currentStats.rows[0];
    const league = leagueAverages.rows[0];
    const shooting = shootingComp.rows[0];

    res.json({
      team_stats: {
        games: parseInt(current.games),
        avg_points_for: parseFloat(current.avg_points_for) || 0,
        avg_points_against: parseFloat(current.avg_points_against) || 0,
        win_percentage: parseFloat(current.win_percentage) || 0,
        fg_percentage: parseFloat(shooting.team_fg_pct) || 0
      },
      league_averages: {
        avg_points: parseFloat(league.league_avg_points) || 0,
        avg_win_percentage: parseFloat(league.league_avg_win_pct) || 0,
        avg_fg_percentage: parseFloat(shooting.league_avg_fg_pct) || 0
      },
      comparison_to_league: {
        points_diff: parseFloat(((current.avg_points_for || 0) - (league.league_avg_points || 0)).toFixed(2)),
        win_pct_diff: parseFloat(((current.win_percentage || 0) - (league.league_avg_win_pct || 0)).toFixed(2)),
        fg_pct_diff: parseFloat(((shooting.team_fg_pct || 0) - (shooting.league_avg_fg_pct || 0)).toFixed(2))
      },
      season_over_season: seasonComparison
    });
  } catch (err) {
    console.error('Error fetching comparative team analysis:', err);
    res.status(500).json({ error: 'Failed to fetch comparative team analysis' });
  }
});

/**
 * Get comparative analysis for players
 * Compare player vs position/team averages
 */
router.get('/comparative/players/:playerId', [
  param('playerId').isInt().withMessage('Player ID must be an integer'),
  query('seasonId').optional().isInt().withMessage('Season ID must be an integer'),
  query('year').optional().isInt({ min: 2000, max: 2100 }).withMessage('Year must be between 2000 and 2100')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { playerId } = req.params;
  const { seasonId, year } = req.query;

  try {
    // Build season filter
    let seasonFilter = '';
    let seasonParams = [playerId];
    
    if (seasonId) {
      seasonFilter = 'AND g.season_id = $2';
      seasonParams.push(seasonId);
    } else if (year) {
      seasonFilter = 'AND EXTRACT(YEAR FROM g.date) = $2';
      seasonParams.push(year);
    }

    // Get player info and stats
    const playerQuery = `
      SELECT 
        p.id,
        p.first_name,
        p.last_name,
        p.jersey_number,
        p.team_id,
        t.name as team_name,
        COUNT(DISTINCT gr.game_id) as games_played,
        COUNT(s.id) as total_shots,
        COUNT(s.id) FILTER (WHERE s.result = 'goal') as total_goals,
        ROUND(
          COUNT(s.id) FILTER (WHERE s.result = 'goal')::numeric / 
          NULLIF(COUNT(s.id)::numeric, 0) * 100, 
          2
        ) as fg_percentage
      FROM players p
      LEFT JOIN teams t ON p.team_id = t.id
      LEFT JOIN game_rosters gr ON gr.player_id = p.id
      LEFT JOIN games g ON gr.game_id = g.id AND g.status = 'completed'
      LEFT JOIN shots s ON s.player_id = p.id AND s.game_id = g.id
      WHERE p.id = $1 ${seasonFilter.replace('$2', '$3')}
      GROUP BY p.id, p.first_name, p.last_name, p.jersey_number, p.team_id, t.name
    `;
    const playerResult = await db.query(
      playerQuery.replace('$3', seasonFilter ? '$2' : '$1'),
      seasonParams
    );

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = playerResult.rows[0];

    // Get team averages (players on same team)
    const teamAvgQuery = `
      SELECT 
        AVG(player_stats.ppg) as avg_ppg,
        AVG(player_stats.fg_pct) as avg_fg_pct,
        AVG(player_stats.shots_per_game) as avg_shots_per_game
      FROM (
        SELECT 
          p.id,
          COUNT(s.id) FILTER (WHERE s.result = 'goal')::float / 
            NULLIF(COUNT(DISTINCT g.id)::float, 0) as ppg,
          COUNT(s.id) FILTER (WHERE s.result = 'goal')::float / 
            NULLIF(COUNT(s.id)::float, 0) * 100 as fg_pct,
          COUNT(s.id)::float / NULLIF(COUNT(DISTINCT g.id)::float, 0) as shots_per_game
        FROM players p
        LEFT JOIN shots s ON s.player_id = p.id
        LEFT JOIN games g ON s.game_id = g.id AND g.status = 'completed'
        WHERE p.team_id = $1 ${seasonFilter.replace('$2', '$3')}
        GROUP BY p.id
        HAVING COUNT(DISTINCT g.id) > 0
      ) as player_stats
    `;
    const teamAvgParams = [player.team_id];
    if (seasonId) {
      teamAvgParams.push(seasonId);
    } else if (year) {
      teamAvgParams.push(year);
    }
    const teamAvgResult = await db.query(
      teamAvgQuery.replace('$3', seasonFilter ? '$2' : '$1'),
      teamAvgParams
    );

    // Get league averages (all players)
    const leagueAvgQuery = `
      SELECT 
        AVG(player_stats.ppg) as avg_ppg,
        AVG(player_stats.fg_pct) as avg_fg_pct,
        AVG(player_stats.shots_per_game) as avg_shots_per_game
      FROM (
        SELECT 
          p.id,
          COUNT(s.id) FILTER (WHERE s.result = 'goal')::float / 
            NULLIF(COUNT(DISTINCT g.id)::float, 0) as ppg,
          COUNT(s.id) FILTER (WHERE s.result = 'goal')::float / 
            NULLIF(COUNT(s.id)::float, 0) * 100 as fg_pct,
          COUNT(s.id)::float / NULLIF(COUNT(DISTINCT g.id)::float, 0) as shots_per_game
        FROM players p
        LEFT JOIN shots s ON s.player_id = p.id
        LEFT JOIN games g ON s.game_id = g.id AND g.status = 'completed'
        ${seasonFilter.replace('$1', 'p.id').replace('$2', '$1')}
        GROUP BY p.id
        HAVING COUNT(DISTINCT g.id) > 0
      ) as player_stats
    `;
    const leagueAvgParams = [];
    if (seasonId) {
      leagueAvgParams.push(seasonId);
    } else if (year) {
      leagueAvgParams.push(year);
    }
    const leagueAvgResult = await db.query(
      seasonFilter ? leagueAvgQuery : leagueAvgQuery.replace('${seasonFilter.replace', '').replace('}', ''),
      leagueAvgParams
    );

    const gamesPlayed = parseInt(player.games_played) || 0;
    const playerPPG = gamesPlayed > 0 
      ? parseFloat(((parseInt(player.total_goals) || 0) / gamesPlayed).toFixed(2))
      : 0;
    const playerShotsPerGame = gamesPlayed > 0 
      ? parseFloat(((parseInt(player.total_shots) || 0) / gamesPlayed).toFixed(2))
      : 0;

    const teamAvg = teamAvgResult.rows[0];
    const leagueAvg = leagueAvgResult.rows[0];

    res.json({
      player: {
        id: player.id,
        first_name: player.first_name,
        last_name: player.last_name,
        jersey_number: player.jersey_number,
        team_name: player.team_name
      },
      player_stats: {
        games_played: gamesPlayed,
        total_shots: parseInt(player.total_shots) || 0,
        total_goals: parseInt(player.total_goals) || 0,
        fg_percentage: parseFloat(player.fg_percentage) || 0,
        points_per_game: playerPPG,
        shots_per_game: playerShotsPerGame
      },
      team_averages: {
        avg_ppg: parseFloat(teamAvg.avg_ppg) || 0,
        avg_fg_percentage: parseFloat(teamAvg.avg_fg_pct) || 0,
        avg_shots_per_game: parseFloat(teamAvg.avg_shots_per_game) || 0
      },
      league_averages: {
        avg_ppg: parseFloat(leagueAvg.avg_ppg) || 0,
        avg_fg_percentage: parseFloat(leagueAvg.avg_fg_pct) || 0,
        avg_shots_per_game: parseFloat(leagueAvg.avg_shots_per_game) || 0
      },
      comparison_to_team: {
        ppg_diff: parseFloat((playerPPG - (parseFloat(teamAvg.avg_ppg) || 0)).toFixed(2)),
        fg_pct_diff: parseFloat(((parseFloat(player.fg_percentage) || 0) - (parseFloat(teamAvg.avg_fg_pct) || 0)).toFixed(2)),
        shots_per_game_diff: parseFloat((playerShotsPerGame - (parseFloat(teamAvg.avg_shots_per_game) || 0)).toFixed(2))
      },
      comparison_to_league: {
        ppg_diff: parseFloat((playerPPG - (parseFloat(leagueAvg.avg_ppg) || 0)).toFixed(2)),
        fg_pct_diff: parseFloat(((parseFloat(player.fg_percentage) || 0) - (parseFloat(leagueAvg.avg_fg_pct) || 0)).toFixed(2)),
        shots_per_game_diff: parseFloat((playerShotsPerGame - (parseFloat(leagueAvg.avg_shots_per_game) || 0)).toFixed(2))
      }
    });
  } catch (err) {
    console.error('Error fetching comparative player analysis:', err);
    res.status(500).json({ error: 'Failed to fetch comparative player analysis' });
  }
});

export default router;
