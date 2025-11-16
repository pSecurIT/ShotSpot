-- Achievements System Migration
-- Phase 6: Gamification & Milestones

-- Achievements table: defines available achievements
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  badge_icon VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('shooting', 'consistency', 'improvement', 'milestone')),
  criteria JSONB NOT NULL, -- Stores achievement criteria (e.g., {"min_fg_percentage": 60, "min_shots": 10})
  points INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Player achievements table: tracks which players earned which achievements
CREATE TABLE IF NOT EXISTS player_achievements (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  game_id INTEGER REFERENCES games(id) ON DELETE SET NULL, -- Game where achievement was earned (if applicable)
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB, -- Additional data about the achievement (e.g., stats at time of earning)
  UNIQUE(player_id, achievement_id, game_id) -- Prevent duplicate achievements per game
);

-- Team leaderboard cache: stores aggregated team statistics
CREATE TABLE IF NOT EXISTS team_leaderboard (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season VARCHAR(20) NOT NULL, -- e.g., "2024-2025"
  total_points INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  total_shots INTEGER DEFAULT 0,
  total_goals INTEGER DEFAULT 0,
  avg_fg_percentage NUMERIC(5, 2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, season)
);

-- Player leaderboard cache: stores aggregated player statistics
CREATE TABLE IF NOT EXISTS player_leaderboard (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season VARCHAR(20) NOT NULL,
  total_shots INTEGER DEFAULT 0,
  total_goals INTEGER DEFAULT 0,
  fg_percentage NUMERIC(5, 2) DEFAULT 0,
  achievement_points INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(player_id, season)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_achievements_player ON player_achievements(player_id);
CREATE INDEX IF NOT EXISTS idx_player_achievements_earned ON player_achievements(earned_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_leaderboard_season ON team_leaderboard(season, total_points DESC);
CREATE INDEX IF NOT EXISTS idx_player_leaderboard_season ON player_leaderboard(season, fg_percentage DESC);
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);

-- Insert default achievements
INSERT INTO achievements (name, description, badge_icon, category, criteria, points) VALUES
-- Shooting achievements
('Sharpshooter', 'Score 10+ goals in a single game', '🎯', 'shooting', '{"min_goals_per_game": 10}', 100),
('Perfect Shot', 'Achieve 100% shooting accuracy (min 5 shots)', '💯', 'shooting', '{"min_fg_percentage": 100, "min_shots": 5}', 150),
('Hot Hand', 'Score 5 consecutive goals', '🔥', 'shooting', '{"consecutive_goals": 5}', 75),
('Long Range Specialist', 'Score 5+ goals from 8m+ distance', '🚀', 'shooting', '{"min_goals": 5, "min_distance": 8}', 80),
('Zone Master', 'Shoot above 70% in all three zones (left/center/right) in a game', '⭐', 'shooting', '{"min_fg_all_zones": 70, "min_shots_per_zone": 3}', 120),

-- Consistency achievements  
('Iron Man', 'Play in 10 consecutive games', '💪', 'consistency', '{"consecutive_games": 10}', 50),
('Reliable Scorer', 'Score at least 5 goals in 5 consecutive games', '🎖️', 'consistency', '{"min_goals": 5, "consecutive_games": 5}', 100),
('Steady Eddie', 'Maintain 50%+ FG% for 8 consecutive games (min 8 shots per game)', '📊', 'consistency', '{"min_fg_percentage": 50, "consecutive_games": 8, "min_shots": 8}', 90),

-- Improvement achievements
('Rising Star', 'Improve FG% by 20+ percentage points over 5 games', '🌟', 'improvement', '{"fg_improvement": 20, "games_span": 5}', 80),
('Comeback Kid', 'Score 8+ goals after scoring 2 or fewer in previous game', '🦸', 'improvement', '{"min_goals": 8, "previous_max_goals": 2}', 70),
('Practice Pays Off', 'Increase average shot distance by 2m+ while maintaining 50%+ FG%', '📈', 'improvement', '{"distance_increase": 2, "min_fg_percentage": 50}', 85),

-- Milestone achievements
('Century Club', 'Score 100 career goals', '💯', 'milestone', '{"total_goals": 100}', 200),
('500 Shots', 'Attempt 500 career shots', '🎯', 'milestone', '{"total_shots": 500}', 150),
('Elite Shooter', 'Achieve 60%+ career FG% (min 100 shots)', '👑', 'milestone', '{"min_fg_percentage": 60, "min_total_shots": 100}', 250),
('Team Player', 'Participate in 25 games', '🤝', 'milestone', '{"games_played": 25}', 100),
('Hat Trick Hero', 'Score 3+ goals in 20 different games', '🎩', 'milestone', '{"hat_tricks": 20}', 180)
ON CONFLICT (name) DO NOTHING;
