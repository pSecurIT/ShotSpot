import express from 'express';
import { param, query } from 'express-validator';
import { validationResult } from 'express-validator';
import db from '../db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

/**
 * GET /api/achievements/list
 * Get all available achievements with descriptions
 */
router.get('/list', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id,
        name,
        description,
        badge_icon,
        category,
        criteria,
        points
      FROM achievements
      ORDER BY category, points DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching achievements list:', err);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

/**
 * GET /api/achievements/player/:playerId
 * Get all achievements earned by a specific player
 */
router.get('/player/:playerId', [
  param('playerId').isInt().withMessage('Player ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { playerId } = req.params;

  try {
    const result = await db.query(`
      SELECT 
        pa.id,
        pa.earned_at,
        pa.metadata,
        a.name,
        a.description,
        a.badge_icon,
        a.category,
        a.points,
        g.date as game_date,
        g.id as game_id
      FROM player_achievements pa
      JOIN achievements a ON pa.achievement_id = a.id
      LEFT JOIN games g ON pa.game_id = g.id
      WHERE pa.player_id = $1
      ORDER BY pa.earned_at DESC
    `, [playerId]);

    // Get player's total achievement points
    const pointsResult = await db.query(`
      SELECT COALESCE(SUM(a.points), 0) as total_points
      FROM player_achievements pa
      JOIN achievements a ON pa.achievement_id = a.id
      WHERE pa.player_id = $1
    `, [playerId]);

    res.json({
      achievements: result.rows,
      total_points: parseInt(pointsResult.rows[0].total_points)
    });
  } catch (err) {
    console.error('Error fetching player achievements:', err);
    res.status(500).json({ error: 'Failed to fetch player achievements' });
  }
});

/**
 * POST /api/achievements/check/:playerId
 * Check and award new achievements for a player based on their stats
 */
router.post('/check/:playerId', [
  param('playerId').isInt().withMessage('Player ID must be an integer'),
  query('gameId').optional().isInt().withMessage('Game ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { playerId } = req.params;
  const { gameId } = req.query;

  try {
    // Get player stats
    const playerStats = await getPlayerStats(playerId, gameId);
    
    // Get all achievements
    const achievements = await db.query('SELECT * FROM achievements');
    
    // Check each achievement
    const newAchievements = [];
    
    for (const achievement of achievements.rows) {
      const alreadyEarned = await hasEarnedAchievement(playerId, achievement.id, gameId);
      
      if (!alreadyEarned) {
        const earned = await checkAchievementCriteria(achievement, playerStats, playerId, gameId);
        
        if (earned) {
          // Award achievement
          const result = await db.query(`
            INSERT INTO player_achievements (player_id, achievement_id, game_id, metadata)
            VALUES ($1, $2, $3, $4)
            RETURNING id, earned_at
          `, [playerId, achievement.id, gameId || null, JSON.stringify(playerStats)]);
          
          newAchievements.push({
            ...achievement,
            earned_at: result.rows[0].earned_at
          });

          // Emit WebSocket event for achievement unlock
          const io = req.app.get('io');
          if (io) {
            io.emit('achievement-unlocked', {
              playerId: parseInt(playerId),
              achievement: {
                name: achievement.name,
                description: achievement.description,
                badge_icon: achievement.badge_icon,
                points: achievement.points
              }
            });
          }
        }
      }
    }

    res.json({
      checked: achievements.rows.length,
      new_achievements: newAchievements
    });
  } catch (err) {
    console.error('Error checking achievements:', err);
    res.status(500).json({ error: 'Failed to check achievements' });
  }
});

/**
 * GET /api/achievements/leaderboard
 * Get player leaderboard for current season
 */
router.get('/leaderboard', [
  query('season').optional().isString().withMessage('Season must be a string'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const season = req.query.season || getCurrentSeason();
  const limit = req.query.limit || 50;

  try {
    const result = await db.query(`
      SELECT 
        p.id,
        p.first_name,
        p.last_name,
        p.jersey_number,
        t.name as team_name,
        COUNT(DISTINCT s.game_id) as games_played,
        COUNT(s.id) as total_shots,
        COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as total_goals,
        ROUND(
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(s.id)::numeric, 0) * 100, 
          2
        ) as fg_percentage,
        COALESCE(SUM(a.points), 0) as achievement_points
      FROM players p
      JOIN teams t ON p.team_id = t.id
      LEFT JOIN shots s ON p.id = s.player_id
      LEFT JOIN games g ON s.game_id = g.id
      LEFT JOIN player_achievements pa ON p.id = pa.player_id
      LEFT JOIN achievements a ON pa.achievement_id = a.id
      WHERE g.date IS NULL OR EXTRACT(YEAR FROM g.date) = EXTRACT(YEAR FROM NOW())
      GROUP BY p.id, p.first_name, p.last_name, p.jersey_number, t.name
      HAVING COUNT(s.id) >= 10
      ORDER BY fg_percentage DESC, total_goals DESC
      LIMIT $1
    `, [limit]);

    res.json({
      season,
      leaderboard: result.rows.map((row, index) => ({
        rank: index + 1,
        ...row,
        games_played: parseInt(row.games_played),
        total_shots: parseInt(row.total_shots),
        total_goals: parseInt(row.total_goals),
        fg_percentage: parseFloat(row.fg_percentage) || 0,
        achievement_points: parseInt(row.achievement_points)
      }))
    });
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

/**
 * GET /api/achievements/team/:teamId/leaderboard
 * Get team-specific leaderboard
 */
router.get('/team/:teamId/leaderboard', [
  param('teamId').isInt().withMessage('Team ID must be an integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { teamId } = req.params;
  const limit = req.query.limit || 20;

  try {
    const result = await db.query(`
      SELECT 
        p.id,
        p.first_name,
        p.last_name,
        p.jersey_number,
        COUNT(DISTINCT s.game_id) as games_played,
        COUNT(s.id) as total_shots,
        COUNT(CASE WHEN s.result = 'goal' THEN 1 END) as total_goals,
        ROUND(
          COUNT(CASE WHEN s.result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(s.id)::numeric, 0) * 100, 
          2
        ) as fg_percentage,
        COALESCE(SUM(a.points), 0) as achievement_points,
        COUNT(DISTINCT pa.achievement_id) as achievements_earned
      FROM players p
      LEFT JOIN shots s ON p.id = s.player_id
      LEFT JOIN player_achievements pa ON p.id = pa.player_id
      LEFT JOIN achievements a ON pa.achievement_id = a.id
      WHERE p.team_id = $1 AND p.is_active = true
      GROUP BY p.id, p.first_name, p.last_name, p.jersey_number
      HAVING COUNT(s.id) >= 5
      ORDER BY fg_percentage DESC, total_goals DESC
      LIMIT $2
    `, [teamId, limit]);

    res.json({
      team_id: parseInt(teamId),
      leaderboard: result.rows.map((row, index) => ({
        rank: index + 1,
        ...row,
        games_played: parseInt(row.games_played),
        total_shots: parseInt(row.total_shots),
        total_goals: parseInt(row.total_goals),
        fg_percentage: parseFloat(row.fg_percentage) || 0,
        achievement_points: parseInt(row.achievement_points),
        achievements_earned: parseInt(row.achievements_earned)
      }))
    });
  } catch (err) {
    console.error('Error fetching team leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch team leaderboard' });
  }
});

// Helper functions

async function getPlayerStats(playerId, gameId) {
  const stats = {};

  if (gameId) {
    // Game-specific stats
    const gameStats = await db.query(`
      SELECT 
        COUNT(*) as shots,
        COUNT(CASE WHEN result = 'goal' THEN 1 END) as goals,
        ROUND(AVG(distance), 2) as avg_distance,
        ROUND(
          COUNT(CASE WHEN result = 'goal' THEN 1 END)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          2
        ) as fg_percentage
      FROM shots
      WHERE player_id = $1 AND game_id = $2
    `, [playerId, gameId]);
    
    Object.assign(stats, {
      game_shots: parseInt(gameStats.rows[0].shots),
      game_goals: parseInt(gameStats.rows[0].goals),
      game_fg_percentage: parseFloat(gameStats.rows[0].fg_percentage) || 0,
      game_avg_distance: parseFloat(gameStats.rows[0].avg_distance) || 0
    });
  }

  // Career stats
  const careerStats = await db.query(`
    SELECT 
      COUNT(*) as total_shots,
      COUNT(CASE WHEN result = 'goal' THEN 1 END) as total_goals,
      COUNT(DISTINCT game_id) as games_played,
      ROUND(
        COUNT(CASE WHEN result = 'goal' THEN 1 END)::numeric / 
        NULLIF(COUNT(*)::numeric, 0) * 100, 
        2
      ) as career_fg_percentage
    FROM shots
    WHERE player_id = $1
  `, [playerId]);

  Object.assign(stats, {
    total_shots: parseInt(careerStats.rows[0].total_shots),
    total_goals: parseInt(careerStats.rows[0].total_goals),
    games_played: parseInt(careerStats.rows[0].games_played),
    career_fg_percentage: parseFloat(careerStats.rows[0].career_fg_percentage) || 0
  });

  return stats;
}

async function hasEarnedAchievement(playerId, achievementId, gameId) {
  const result = await db.query(`
    SELECT COUNT(*) as count
    FROM player_achievements
    WHERE player_id = $1 AND achievement_id = $2
      AND (game_id = $3 OR $3 IS NULL)
  `, [playerId, achievementId, gameId || null]);

  return parseInt(result.rows[0].count) > 0;
}

async function checkAchievementCriteria(achievement, stats, playerId, gameId) {
  const criteria = achievement.criteria;

  switch (achievement.name) {
  case 'Sharpshooter':
    return stats.game_goals >= criteria.min_goals_per_game;

  case 'Perfect Shot':
    return stats.game_shots >= criteria.min_shots && stats.game_fg_percentage === 100;

  case 'Century Club':
    return stats.total_goals >= criteria.total_goals;

  case '500 Shots':
    return stats.total_shots >= criteria.total_shots;

  case 'Elite Shooter':
    return stats.total_shots >= criteria.min_total_shots && 
             stats.career_fg_percentage >= criteria.min_fg_percentage;

  case 'Team Player':
    return stats.games_played >= criteria.games_played;

    // Add more achievement checks as needed
  default:
    return false;
  }
}

function getCurrentSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  // Season runs from August to July
  if (month >= 7) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

export default router;
