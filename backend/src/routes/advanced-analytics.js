import express from 'express';
import { param, query, body, validationResult } from 'express-validator';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

/**
 * PERFORMANCE PREDICTIONS
 */

/**
 * Get player form trends
 * Analyzes recent performance to identify improving/declining trends
 */
router.get('/predictions/form-trends/:playerId', [
  param('playerId').isInt().withMessage('Player ID must be an integer'),
  query('games').optional().isInt({ min: 3, max: 20 }).withMessage('Games must be between 3 and 20')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { playerId } = req.params;
  const { games = 5 } = req.query;

  try {
    // Get recent game performance
    const recentGames = await db.query(`
      SELECT 
        g.id as game_id,
        g.date as game_date,
        COUNT(*) as shots,
        COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals,
        ROUND(
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as fg_percentage,
        ROUND(AVG(s.distance), 2) as avg_distance
      FROM shots s
      JOIN games g ON s.game_id = g.id
      WHERE s.player_id = $1
      GROUP BY g.id, g.date
      ORDER BY g.date DESC
      LIMIT $2
    `, [playerId, games]);

    if (recentGames.rows.length < 3) {
      return res.json({
        player_id: playerId,
        form_trend: 'insufficient_data',
        message: 'Need at least 3 games for trend analysis',
        games_analyzed: recentGames.rows.length
      });
    }

    // Calculate rolling averages and trend
    const gameData = recentGames.rows.map(row => ({
      game_id: row.game_id,
      game_date: row.game_date,
      shots: parseInt(row.shots),
      goals: parseInt(row.goals),
      fg_percentage: parseFloat(row.fg_percentage) || 0,
      avg_distance: parseFloat(row.avg_distance) || 0
    }));

    // Calculate recent (last 3) vs older performance
    const recentAvg = gameData.slice(0, 3).reduce((sum, g) => sum + g.fg_percentage, 0) / 3;
    const olderAvg = gameData.length > 3 
      ? gameData.slice(3).reduce((sum, g) => sum + g.fg_percentage, 0) / (gameData.length - 3)
      : recentAvg;

    const trend_change = recentAvg - olderAvg;
    let form_trend;
    
    if (Math.abs(trend_change) < 5) {
      form_trend = 'stable';
    } else if (trend_change > 15) {
      form_trend = 'hot';
    } else if (trend_change > 5) {
      form_trend = 'improving';
    } else if (trend_change < -15) {
      form_trend = 'cold';
    } else {
      form_trend = 'declining';
    }

    // Calculate volatility (standard deviation)
    const mean = gameData.reduce((sum, g) => sum + g.fg_percentage, 0) / gameData.length;
    const variance = gameData.reduce((sum, g) => sum + Math.pow(g.fg_percentage - mean, 2), 0) / gameData.length;
    const volatility = Math.sqrt(variance);

    const formAnalysis = {
      player_id: playerId,
      form_trend,
      trend_change: parseFloat(trend_change.toFixed(2)),
      recent_avg_fg: parseFloat(recentAvg.toFixed(2)),
      older_avg_fg: parseFloat(olderAvg.toFixed(2)),
      overall_avg_fg: parseFloat(mean.toFixed(2)),
      volatility: parseFloat(volatility.toFixed(2)),
      consistency_rating: volatility < 10 ? 'high' : volatility < 20 ? 'medium' : 'low',
      games_analyzed: gameData.length,
      recent_games: gameData
    };

    // Store prediction in database
    await db.query(`
      INSERT INTO player_predictions 
        (player_id, prediction_type, predicted_fg_percentage, confidence_score, form_trend, factors)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      playerId, 
      'form_trend', 
      recentAvg,
      Math.max(50, 100 - volatility * 2), // Higher volatility = lower confidence
      form_trend,
      JSON.stringify({ games_analyzed: gameData.length, volatility, trend_change })
    ]);

    res.json(formAnalysis);
  } catch (err) {
    console.error('Error analyzing form trends:', err);
    res.status(500).json({ error: 'Failed to analyze form trends' });
  }
});

/**
 * Get player fatigue indicators
 * Analyzes play time and performance degradation
 */
router.get('/predictions/fatigue/:playerId', [
  param('playerId').isInt().withMessage('Player ID must be an integer'),
  query('game_id').optional().isInt().withMessage('Game ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { playerId } = req.params;
  const { game_id } = req.query;

  try {
    // Get recent games (last 5) if no specific game
    let gamesQuery;
    let gamesParams;
    
    if (game_id) {
      gamesQuery = `
        SELECT id, date, period_duration, number_of_periods
        FROM games 
        WHERE id = $1
      `;
      gamesParams = [game_id];
    } else {
      gamesQuery = `
        SELECT DISTINCT g.id, g.date, g.period_duration, g.number_of_periods
        FROM games g
        JOIN shots s ON g.id = s.game_id
        WHERE s.player_id = $1
        ORDER BY g.date DESC
        LIMIT 5
      `;
      gamesParams = [playerId];
    }

    const games = await db.query(gamesQuery, gamesParams);

    const fatigueAnalysis = [];

    for (const game of games.rows) {
      // Get player's play time
      const rostersResult = await db.query(`
        SELECT is_starting
        FROM game_rosters
        WHERE game_id = $1 AND player_id = $2
      `, [game.id, playerId]);

      const isStarter = rostersResult.rows[0]?.is_starting || false;

      // Get substitutions
      const subsResult = await db.query(`
        SELECT 
          player_in_id as player_id,
          period,
          EXTRACT(EPOCH FROM time_remaining) as time_remaining_seconds,
          'in' as type
        FROM substitutions
        WHERE game_id = $1 AND player_in_id = $2
        UNION ALL
        SELECT 
          player_out_id as player_id,
          period,
          EXTRACT(EPOCH FROM time_remaining) as time_remaining_seconds,
          'out' as type
        FROM substitutions
        WHERE game_id = $1 AND player_out_id = $2
        ORDER BY period, time_remaining_seconds DESC
      `, [game.id, playerId, playerId]);

      // Calculate play time
      const periodDuration = parseInt(game.period_duration.minutes) || 10;
      const numberOfPeriods = game.number_of_periods || 4;
      const totalGameTime = periodDuration * numberOfPeriods * 60; // in seconds

      let playTimeSeconds = 0;
      let isOnCourt = isStarter;
      let lastTime = 0;
      let currentPeriod = 1;

      subsResult.rows.forEach(sub => {
        const subTime = (sub.period - 1) * periodDuration * 60 + (periodDuration * 60 - sub.time_remaining_seconds);
        
        if (sub.period > currentPeriod) {
          if (isOnCourt) {
            playTimeSeconds += (currentPeriod * periodDuration * 60) - lastTime;
            playTimeSeconds += (sub.period - currentPeriod - 1) * periodDuration * 60;
            lastTime = (sub.period - 1) * periodDuration * 60;
          } else {
            lastTime = (sub.period - 1) * periodDuration * 60;
          }
          currentPeriod = sub.period;
        }
        
        if (sub.type === 'in') {
          isOnCourt = true;
          lastTime = subTime;
        } else {
          if (isOnCourt) {
            playTimeSeconds += subTime - lastTime;
          }
          isOnCourt = false;
          lastTime = subTime;
        }
      });

      if (isOnCourt) {
        playTimeSeconds += totalGameTime - lastTime;
      }

      const playTimePercent = (playTimeSeconds / totalGameTime * 100);

      // Get performance by period to detect degradation
      const periodPerf = await db.query(`
        SELECT 
          period,
          COUNT(*) as shots,
          COUNT(CASE WHEN result = 'goal' THEN 1 END) as goals,
          ROUND(
            COUNT(CASE WHEN result = 'goal' THEN 1 END)::numeric / 
            NULLIF(COUNT(*)::numeric, 0) * 100, 
            2
          ) as fg_percentage
        FROM shots
        WHERE game_id = $1 AND player_id = $2
        GROUP BY period
        ORDER BY period
      `, [game.id, playerId]);

      // Calculate performance degradation
      let degradation = 0;
      if (periodPerf.rows.length > 1) {
        const firstHalfAvg = periodPerf.rows.slice(0, Math.ceil(periodPerf.rows.length / 2))
          .reduce((sum, p) => sum + (parseFloat(p.fg_percentage) || 0), 0) / Math.ceil(periodPerf.rows.length / 2);
        const secondHalfAvg = periodPerf.rows.slice(Math.ceil(periodPerf.rows.length / 2))
          .reduce((sum, p) => sum + (parseFloat(p.fg_percentage) || 0), 0) / Math.floor(periodPerf.rows.length / 2);
        degradation = firstHalfAvg - secondHalfAvg;
      }

      // Determine fatigue level
      let fatigue_level;
      if (playTimePercent < 40) {
        fatigue_level = 'fresh';
      } else if (playTimePercent < 70 && degradation < 10) {
        fatigue_level = 'normal';
      } else if (playTimePercent < 85 || degradation < 15) {
        fatigue_level = 'tired';
      } else {
        fatigue_level = 'exhausted';
      }

      fatigueAnalysis.push({
        game_id: game.id,
        game_date: game.date,
        play_time_seconds: playTimeSeconds,
        play_time_minutes: parseFloat((playTimeSeconds / 60).toFixed(1)),
        play_time_percent: parseFloat(playTimePercent.toFixed(1)),
        performance_degradation: parseFloat(degradation.toFixed(2)),
        fatigue_level,
        period_performance: periodPerf.rows.map(p => ({
          period: p.period,
          shots: parseInt(p.shots),
          goals: parseInt(p.goals),
          fg_percentage: parseFloat(p.fg_percentage) || 0
        }))
      });
    }

    // Store latest fatigue prediction
    if (fatigueAnalysis.length > 0) {
      const latest = fatigueAnalysis[0];
      await db.query(`
        INSERT INTO player_predictions 
          (player_id, game_id, prediction_type, fatigue_level, factors)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        playerId,
        latest.game_id,
        'fatigue',
        latest.fatigue_level,
        JSON.stringify({
          play_time_percent: latest.play_time_percent,
          performance_degradation: latest.performance_degradation
        })
      ]);
    }

    res.json({
      player_id: playerId,
      games_analyzed: fatigueAnalysis.length,
      fatigue_analysis: fatigueAnalysis
    });
  } catch (err) {
    console.error('Error analyzing fatigue:', err);
    res.status(500).json({ error: 'Failed to analyze fatigue' });
  }
});

/**
 * Get AI-based next game prediction
 * Simple statistical model for predicting next game performance
 */
router.get('/predictions/next-game/:playerId', [
  param('playerId').isInt().withMessage('Player ID must be an integer'),
  query('opponent_id').optional().isInt().withMessage('Opponent ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { playerId } = req.params;
  const { opponent_id } = req.query;

  try {
    // Get recent performance (last 10 games)
    const recentPerf = await db.query(`
      SELECT 
        COUNT(*) as total_shots,
        COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as total_goals,
        ROUND(
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as avg_fg_percentage,
        ROUND(AVG(shots_per_game), 2) as avg_shots_per_game,
        ROUND(AVG(goals_per_game), 2) as avg_goals_per_game
      FROM (
        SELECT 
          g.id,
          COUNT(*) as shots_per_game,
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals_per_game
        FROM shots s
        JOIN games g ON s.game_id = g.id
        WHERE s.player_id = $1
        GROUP BY g.id
        ORDER BY g.date DESC
        LIMIT 10
      ) subquery
    `, [playerId]);

    const avgStats = recentPerf.rows[0];

    if (!avgStats.total_shots || parseInt(avgStats.total_shots) === 0) {
      return res.json({
        player_id: playerId,
        prediction: 'insufficient_data',
        message: 'Not enough historical data for prediction'
      });
    }

    // Get form trend
    const formResult = await db.query(`
      SELECT form_trend, confidence_score
      FROM player_predictions
      WHERE player_id = $1 AND prediction_type = 'form_trend'
      ORDER BY created_at DESC
      LIMIT 1
    `, [playerId]);

    const form_trend = formResult.rows[0]?.form_trend || 'stable';

    // Adjust prediction based on form
    let adjustment = 0;
    switch (form_trend) {
      case 'hot': adjustment = 10; break;
      case 'improving': adjustment = 5; break;
      case 'declining': adjustment = -5; break;
      case 'cold': adjustment = -10; break;
      default: adjustment = 0;
    }

    // If opponent specified, get historical matchup data
    let matchupAdjustment = 0;
    if (opponent_id) {
      const matchupResult = await db.query(`
        SELECT 
          ROUND(AVG(
            CAST(COUNT(CASE WHEN s.result = 'goal' THEN 1 END) AS numeric) / 
            NULLIF(COUNT(*), 0) * 100
          ), 2) as matchup_fg_percentage
        FROM shots s
        JOIN games g ON s.game_id = g.id
        WHERE s.player_id = $1
          AND (
            (g.home_team_id = $2 OR g.away_team_id = $2)
          )
        GROUP BY g.id
      `, [playerId, opponent_id]);

      if (matchupResult.rows[0]?.matchup_fg_percentage) {
        const matchupFG = parseFloat(matchupResult.rows[0].matchup_fg_percentage);
        const avgFG = parseFloat(avgStats.avg_fg_percentage);
        matchupAdjustment = matchupFG - avgFG;
      }
    }

    const predicted_fg = Math.max(0, Math.min(100, 
      parseFloat(avgStats.avg_fg_percentage) + adjustment + matchupAdjustment
    ));
    const predicted_shots = Math.round(parseFloat(avgStats.avg_shots_per_game));
    const predicted_goals = Math.round(predicted_shots * predicted_fg / 100);

    // Calculate confidence based on data quality
    let confidence = 70;
    if (recentPerf.rows[0].total_shots > 50) confidence += 10;
    if (formResult.rows[0]?.confidence_score) {
      confidence = (confidence + parseFloat(formResult.rows[0].confidence_score)) / 2;
    }
    if (opponent_id && matchupResult.rows[0]?.matchup_fg_percentage) {
      confidence += 10;
    }

    const prediction = {
      player_id: playerId,
      opponent_id: opponent_id || null,
      predicted_fg_percentage: parseFloat(predicted_fg.toFixed(2)),
      predicted_shots,
      predicted_goals,
      confidence_score: parseFloat(Math.min(95, confidence).toFixed(2)),
      form_trend,
      historical_avg: {
        fg_percentage: parseFloat(avgStats.avg_fg_percentage),
        shots_per_game: parseFloat(avgStats.avg_shots_per_game),
        goals_per_game: parseFloat(avgStats.avg_goals_per_game)
      },
      adjustments: {
        form_adjustment: adjustment,
        matchup_adjustment: parseFloat(matchupAdjustment.toFixed(2))
      }
    };

    // Store prediction
    await db.query(`
      INSERT INTO player_predictions 
        (player_id, prediction_type, predicted_fg_percentage, predicted_goals, 
         predicted_shots, confidence_score, form_trend, factors)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      playerId,
      'next_game',
      prediction.predicted_fg_percentage,
      prediction.predicted_goals,
      prediction.predicted_shots,
      prediction.confidence_score,
      form_trend,
      JSON.stringify({ adjustments: prediction.adjustments, opponent_id })
    ]);

    res.json(prediction);
  } catch (err) {
    console.error('Error generating next game prediction:', err);
    res.status(500).json({ error: 'Failed to generate next game prediction' });
  }
});

/**
 * BENCHMARKING
 */

/**
 * Get league/competition averages
 * Calculate and return aggregate statistics across games
 */
router.get('/benchmarks/league-averages', [
  query('competition').optional().isString().withMessage('Competition must be a string'),
  query('season').optional().isString().withMessage('Season must be a string'),
  query('position').optional().isIn(['offense', 'defense', 'all']).withMessage('Position must be offense, defense, or all'),
  query('min_games').optional().isInt({ min: 1 }).withMessage('Min games must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { competition = 'default', season = 'current', position = 'all', min_games = 3 } = req.query;

  try {
    // Calculate league averages from all games
    const leagueAvg = await db.query(`
      SELECT 
        COUNT(DISTINCT s.game_id) as total_games,
        COUNT(DISTINCT s.player_id) as total_players,
        ROUND(AVG(shots_per_game), 2) as avg_shots_per_game,
        ROUND(AVG(goals_per_game), 2) as avg_goals_per_game,
        ROUND(AVG(fg_percentage), 2) as avg_fg_percentage,
        ROUND(AVG(avg_distance), 2) as avg_shot_distance
      FROM (
        SELECT 
          s.player_id,
          s.game_id,
          COUNT(*) as shots_per_game,
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals_per_game,
          ROUND(
            COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
            NULLIF(COUNT(*)::numeric, 0) * 100, 
            2
          ) as fg_percentage,
          ROUND(AVG(s.distance), 2) as avg_distance
        FROM shots s
        GROUP BY s.player_id, s.game_id
        HAVING COUNT(*) >= 3
      ) player_games
    `);

    // Position-specific averages
    let positionAvg = null;
    if (position !== 'all') {
      positionAvg = await db.query(`
        SELECT 
          COUNT(DISTINCT s.player_id) as total_players,
          ROUND(AVG(shots_per_game), 2) as avg_shots_per_game,
          ROUND(AVG(goals_per_game), 2) as avg_goals_per_game,
          ROUND(AVG(fg_percentage), 2) as avg_fg_percentage
        FROM (
          SELECT 
            s.player_id,
            s.game_id,
            COUNT(*) as shots_per_game,
            COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals_per_game,
            ROUND(
              COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
              NULLIF(COUNT(*)::numeric, 0) * 100, 
              2
            ) as fg_percentage
          FROM shots s
          JOIN game_rosters gr ON s.player_id = gr.player_id AND s.game_id = gr.game_id
          WHERE gr.starting_position = $1
          GROUP BY s.player_id, s.game_id
          HAVING COUNT(*) >= 3
        ) player_games
      `, [position]);
    }

    const benchmarks = {
      competition,
      season,
      position,
      league_averages: {
        total_games: parseInt(leagueAvg.rows[0].total_games),
        total_players: parseInt(leagueAvg.rows[0].total_players),
        avg_shots_per_game: parseFloat(leagueAvg.rows[0].avg_shots_per_game) || 0,
        avg_goals_per_game: parseFloat(leagueAvg.rows[0].avg_goals_per_game) || 0,
        avg_fg_percentage: parseFloat(leagueAvg.rows[0].avg_fg_percentage) || 0,
        avg_shot_distance: parseFloat(leagueAvg.rows[0].avg_shot_distance) || 0
      }
    };

    if (positionAvg) {
      benchmarks.position_averages = {
        position,
        total_players: parseInt(positionAvg.rows[0].total_players),
        avg_shots_per_game: parseFloat(positionAvg.rows[0].avg_shots_per_game) || 0,
        avg_goals_per_game: parseFloat(positionAvg.rows[0].avg_goals_per_game) || 0,
        avg_fg_percentage: parseFloat(positionAvg.rows[0].avg_fg_percentage) || 0
      };
    }

    // Store benchmarks
    const benchmarkTypes = [
      { type: 'avg_shots_per_game', value: benchmarks.league_averages.avg_shots_per_game },
      { type: 'avg_goals_per_game', value: benchmarks.league_averages.avg_goals_per_game },
      { type: 'avg_fg_percentage', value: benchmarks.league_averages.avg_fg_percentage },
      { type: 'avg_shot_distance', value: benchmarks.league_averages.avg_shot_distance }
    ];

    for (const bench of benchmarkTypes) {
      await db.query(`
        INSERT INTO competition_benchmarks 
          (competition_name, season, position, benchmark_type, benchmark_value, sample_size)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        competition,
        season,
        position,
        bench.type,
        bench.value,
        benchmarks.league_averages.total_games
      ]);
    }

    res.json(benchmarks);
  } catch (err) {
    console.error('Error calculating league averages:', err);
    res.status(500).json({ error: 'Failed to calculate league averages' });
  }
});

/**
 * Compare player to league/position averages
 */
router.get('/benchmarks/player-comparison/:playerId', [
  param('playerId').isInt().withMessage('Player ID must be an integer'),
  query('games').optional().isInt({ min: 1, max: 50 }).withMessage('Games must be between 1 and 50')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { playerId } = req.params;
  const { games = 10 } = req.query;

  try {
    // Get player stats
    const playerStats = await db.query(`
      SELECT 
        COUNT(DISTINCT s.game_id) as games_played,
        ROUND(AVG(shots_per_game), 2) as avg_shots_per_game,
        ROUND(AVG(goals_per_game), 2) as avg_goals_per_game,
        ROUND(AVG(fg_percentage), 2) as avg_fg_percentage,
        ROUND(AVG(avg_distance), 2) as avg_shot_distance
      FROM (
        SELECT 
          s.game_id,
          COUNT(*) as shots_per_game,
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals_per_game,
          ROUND(
            COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
            NULLIF(COUNT(*)::numeric, 0) * 100, 
            2
          ) as fg_percentage,
          ROUND(AVG(s.distance), 2) as avg_distance
        FROM shots s
        JOIN games g ON s.game_id = g.id
        WHERE s.player_id = $1
        GROUP BY s.game_id
        ORDER BY g.date DESC
        LIMIT $2
      ) player_games
    `, [playerId, games]);

    if (parseInt(playerStats.rows[0].games_played) === 0) {
      return res.json({
        player_id: playerId,
        message: 'No game data available for this player'
      });
    }

    // Get league averages
    const leagueAvg = await db.query(`
      SELECT 
        ROUND(AVG(shots_per_game), 2) as avg_shots_per_game,
        ROUND(AVG(goals_per_game), 2) as avg_goals_per_game,
        ROUND(AVG(fg_percentage), 2) as avg_fg_percentage,
        ROUND(AVG(avg_distance), 2) as avg_shot_distance
      FROM (
        SELECT 
          s.player_id,
          s.game_id,
          COUNT(*) as shots_per_game,
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as goals_per_game,
          ROUND(
            COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
            NULLIF(COUNT(*)::numeric, 0) * 100, 
            2
          ) as fg_percentage,
          ROUND(AVG(s.distance), 2) as avg_distance
        FROM shots s
        WHERE s.player_id != $1
        GROUP BY s.player_id, s.game_id
      ) other_players
    `, [playerId]);

    const player = playerStats.rows[0];
    const league = leagueAvg.rows[0];

    const comparison = {
      player_id: playerId,
      games_analyzed: parseInt(player.games_played),
      player_stats: {
        avg_shots_per_game: parseFloat(player.avg_shots_per_game) || 0,
        avg_goals_per_game: parseFloat(player.avg_goals_per_game) || 0,
        avg_fg_percentage: parseFloat(player.avg_fg_percentage) || 0,
        avg_shot_distance: parseFloat(player.avg_shot_distance) || 0
      },
      league_averages: {
        avg_shots_per_game: parseFloat(league.avg_shots_per_game) || 0,
        avg_goals_per_game: parseFloat(league.avg_goals_per_game) || 0,
        avg_fg_percentage: parseFloat(league.avg_fg_percentage) || 0,
        avg_shot_distance: parseFloat(league.avg_shot_distance) || 0
      },
      comparison: {
        shots_vs_league: parseFloat(((player.avg_shots_per_game - league.avg_shots_per_game) / league.avg_shots_per_game * 100).toFixed(2)),
        goals_vs_league: parseFloat(((player.avg_goals_per_game - league.avg_goals_per_game) / league.avg_goals_per_game * 100).toFixed(2)),
        fg_vs_league: parseFloat((player.avg_fg_percentage - league.avg_fg_percentage).toFixed(2)),
        distance_vs_league: parseFloat((player.avg_shot_distance - league.avg_shot_distance).toFixed(2))
      },
      percentile_rank: {
        fg_percentage: await calculatePercentile(playerId, 'fg_percentage', player.avg_fg_percentage)
      }
    };

    res.json(comparison);
  } catch (err) {
    console.error('Error comparing player to league:', err);
    res.status(500).json({ error: 'Failed to compare player to league averages' });
  }
});

/**
 * Get historical performance benchmarks
 */
router.get('/benchmarks/historical/:entityType/:entityId', [
  param('entityType').isIn(['player', 'team']).withMessage('Entity type must be player or team'),
  param('entityId').isInt().withMessage('Entity ID must be an integer'),
  query('periods').optional().isArray().withMessage('Periods must be an array')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { entityType, entityId } = req.params;
  const { periods = ['last_7_days', 'last_30_days', 'season'] } = req.query;

  try {
    const historicalData = [];

    for (const period of periods) {
      let dateFilter = '';
      
      switch (period) {
        case 'last_7_days':
          dateFilter = "AND g.date >= CURRENT_DATE - INTERVAL '7 days'";
          break;
        case 'last_30_days':
          dateFilter = "AND g.date >= CURRENT_DATE - INTERVAL '30 days'";
          break;
        case 'last_90_days':
          dateFilter = "AND g.date >= CURRENT_DATE - INTERVAL '90 days'";
          break;
        case 'season':
          dateFilter = "AND g.date >= CURRENT_DATE - INTERVAL '1 year'";
          break;
        default:
          dateFilter = '';
      }

      const column = entityType === 'player' ? 'player_id' : 'team_id';
      
      const stats = await db.query(`
        SELECT 
          COUNT(DISTINCT s.game_id) as games_played,
          COUNT(*) as total_shots,
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as total_goals,
          ROUND(
            COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
            NULLIF(COUNT(*)::numeric, 0) * 100, 
            2
          ) as avg_fg_percentage,
          ROUND(AVG(s.distance), 2) as avg_distance
        FROM shots s
        JOIN games g ON s.game_id = g.id
        WHERE s.${column} = $1 ${dateFilter}
      `, [entityId]);

      const result = stats.rows[0];
      
      historicalData.push({
        period,
        games_played: parseInt(result.games_played),
        total_shots: parseInt(result.total_shots),
        total_goals: parseInt(result.total_goals),
        avg_fg_percentage: parseFloat(result.avg_fg_percentage) || 0,
        avg_distance: parseFloat(result.avg_distance) || 0,
        avg_shots_per_game: result.games_played > 0 
          ? parseFloat((result.total_shots / result.games_played).toFixed(2))
          : 0,
        avg_goals_per_game: result.games_played > 0
          ? parseFloat((result.total_goals / result.games_played).toFixed(2))
          : 0
      });

      // Store in database
      if (result.games_played > 0) {
        await db.query(`
          INSERT INTO historical_performance 
            (entity_type, entity_id, time_period, games_played, metric_type, metric_value, metadata)
          VALUES 
            ($1, $2, $3, $4, 'fg_percentage', $5, $6),
            ($1, $2, $3, $4, 'avg_shots_per_game', $7, $6),
            ($1, $2, $3, $4, 'avg_goals_per_game', $8, $6)
        `, [
          entityType,
          entityId,
          period,
          parseInt(result.games_played),
          parseFloat(result.avg_fg_percentage),
          JSON.stringify({ total_shots: result.total_shots, total_goals: result.total_goals }),
          historicalData[historicalData.length - 1].avg_shots_per_game,
          historicalData[historicalData.length - 1].avg_goals_per_game
        ]);
      }
    }

    res.json({
      entity_type: entityType,
      entity_id: parseInt(entityId),
      historical_benchmarks: historicalData
    });
  } catch (err) {
    console.error('Error fetching historical benchmarks:', err);
    res.status(500).json({ error: 'Failed to fetch historical benchmarks' });
  }
});

/**
 * VIDEO INTEGRATION
 */

/**
 * Link event to video timestamp
 */
router.post('/video/link-event', requireRole(['admin', 'coach']), [
  body('game_id').isInt().withMessage('Game ID must be an integer'),
  body('event_type').isString().notEmpty().withMessage('Event type is required'),
  body('event_id').optional().isInt().withMessage('Event ID must be an integer'),
  body('video_url').optional().isString().withMessage('Video URL must be a string'),
  body('timestamp_start').isInt({ min: 0 }).withMessage('Timestamp start must be a non-negative integer'),
  body('timestamp_end').optional().isInt({ min: 0 }).withMessage('Timestamp end must be a non-negative integer'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('is_highlight').optional().isBoolean().withMessage('Is highlight must be a boolean'),
  body('tags').optional().isArray().withMessage('Tags must be an array')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    game_id,
    event_type,
    event_id = null,
    video_url = null,
    timestamp_start,
    timestamp_end = null,
    description = null,
    is_highlight = false,
    tags = []
  } = req.body;

  try {
    const result = await db.query(`
      INSERT INTO video_events 
        (game_id, event_type, event_id, video_url, timestamp_start, timestamp_end, 
         description, is_highlight, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [game_id, event_type, event_id, video_url, timestamp_start, timestamp_end, 
        description, is_highlight, tags]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error linking video event:', err);
    res.status(500).json({ error: 'Failed to link video event' });
  }
});

/**
 * Get video events for a game
 */
router.get('/video/game/:gameId', [
  param('gameId').isInt().withMessage('Game ID must be an integer'),
  query('event_type').optional().isString().withMessage('Event type must be a string'),
  query('highlights_only').optional().isBoolean().withMessage('Highlights only must be a boolean')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;
  const { event_type, highlights_only = false } = req.query;

  try {
    let queryText = `
      SELECT *
      FROM video_events
      WHERE game_id = $1
    `;
    const queryParams = [gameId];
    let paramIndex = 2;

    if (event_type) {
      queryText += ` AND event_type = $${paramIndex}`;
      queryParams.push(event_type);
      paramIndex++;
    }

    if (highlights_only === 'true' || highlights_only === true) {
      queryText += ' AND is_highlight = true';
    }

    queryText += ' ORDER BY timestamp_start';

    const result = await db.query(queryText, queryParams);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching video events:', err);
    res.status(500).json({ error: 'Failed to fetch video events' });
  }
});

/**
 * Generate highlight reel metadata
 * Identifies key moments for highlight reel generation
 */
router.get('/video/highlights/:gameId', [
  param('gameId').isInt().withMessage('Game ID must be an integer'),
  query('max_clips').optional().isInt({ min: 1, max: 50 }).withMessage('Max clips must be between 1 and 50')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;
  const { max_clips = 20 } = req.query;

  try {
    // Get marked highlights
    const markedHighlights = await db.query(`
      SELECT *
      FROM video_events
      WHERE game_id = $1 AND is_highlight = true
      ORDER BY timestamp_start
      LIMIT $2
    `, [gameId, max_clips]);

    // Auto-identify highlights from game events if not enough marked
    const autoHighlights = [];
    
    if (markedHighlights.rows.length < max_clips) {
      // Get all goals
      const goals = await db.query(`
        SELECT 
          s.id as event_id,
          'goal' as event_type,
          s.created_at,
          p.first_name,
          p.last_name,
          t.name as team_name
        FROM shots s
        JOIN players p ON s.player_id = p.id
        JOIN teams t ON s.team_id = t.id
        WHERE s.game_id = $1 AND s.result = 'goal'
        ORDER BY s.created_at
        LIMIT $2
      `, [gameId, max_clips - markedHighlights.rows.length]);

      goals.rows.forEach(goal => {
        autoHighlights.push({
          event_id: goal.event_id,
          event_type: goal.event_type,
          description: `Goal by ${goal.first_name} ${goal.last_name} (${goal.team_name})`,
          suggested_duration: 10, // seconds
          priority: 'high'
        });
      });
    }

    res.json({
      game_id: parseInt(gameId),
      total_clips: markedHighlights.rows.length + autoHighlights.length,
      marked_highlights: markedHighlights.rows,
      auto_identified_highlights: autoHighlights,
      reel_metadata: {
        suggested_total_duration: (markedHighlights.rows.length * 15) + (autoHighlights.length * 10),
        clip_ordering: 'chronological',
        include_transitions: true
      }
    });
  } catch (err) {
    console.error('Error generating highlight reel:', err);
    res.status(500).json({ error: 'Failed to generate highlight reel' });
  }
});

/**
 * Get video-tagged events for PDF report generation
 */
router.get('/video/report-data/:gameId', [
  param('gameId').isInt().withMessage('Game ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId } = req.params;

  try {
    // Get all video events
    const videoEvents = await db.query(`
      SELECT 
        ve.*,
        CASE 
          WHEN ve.event_type = 'shot' OR ve.event_type = 'goal' THEN (
            SELECT json_build_object(
              'player_name', p.first_name || ' ' || p.last_name,
              'team_name', t.name,
              'result', s.result,
              'x_coord', s.x_coord,
              'y_coord', s.y_coord
            )
            FROM shots s
            JOIN players p ON s.player_id = p.id
            JOIN teams t ON s.team_id = t.id
            WHERE s.id = ve.event_id
          )
          ELSE NULL
        END as event_details
      FROM video_events ve
      WHERE ve.game_id = $1
      ORDER BY ve.timestamp_start
    `, [gameId]);

    res.json({
      game_id: parseInt(gameId),
      video_events: videoEvents.rows,
      report_metadata: {
        includes_video_links: videoEvents.rows.filter(e => e.video_url).length > 0,
        total_tagged_events: videoEvents.rows.length,
        highlights_count: videoEvents.rows.filter(e => e.is_highlight).length,
        event_types: [...new Set(videoEvents.rows.map(e => e.event_type))]
      }
    });
  } catch (err) {
    console.error('Error fetching video report data:', err);
    res.status(500).json({ error: 'Failed to fetch video report data' });
  }
});

// Helper function to calculate percentile rank
async function calculatePercentile(playerId, metric, value) {
  try {
    const result = await db.query(`
      WITH player_averages AS (
        SELECT 
          s.player_id,
          ROUND(
            COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
            NULLIF(COUNT(*)::numeric, 0) * 100, 
            2
          ) as avg_metric
        FROM shots s
        GROUP BY s.player_id
        HAVING COUNT(*) >= 10
      )
      SELECT 
        COUNT(*) FILTER (WHERE avg_metric < $1)::numeric / COUNT(*)::numeric * 100 as percentile
      FROM player_averages
    `, [value]);

    return parseFloat((result.rows[0]?.percentile || 50).toFixed(1));
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Error calculating percentile:', err);
    }
    return 50; // Default to 50th percentile on error
  }
}

export default router;
