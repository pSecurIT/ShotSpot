#!/bin/sh
# Apply database migrations for Docker deployment
# This script runs migrations that aren't in the base schema.sql

set -e

echo "Applying database migrations..."

# Wait for database to be ready
until PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; do
  echo "Waiting for database..."
  sleep 2
done

# Apply migrations (login_history is the critical missing one)
PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" <<'SQL'
-- Login history table
CREATE TABLE IF NOT EXISTS login_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL,
    success BOOLEAN NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_created_at ON login_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_success ON login_history(success);

-- Seasons table
CREATE TABLE IF NOT EXISTS seasons (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    season_type VARCHAR(20),
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date >= start_date),
    CHECK (season_type IN ('indoor', 'outdoor', 'mixed') OR season_type IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_seasons_is_active ON seasons(is_active);
CREATE INDEX IF NOT EXISTS idx_seasons_dates ON seasons(start_date, end_date);

-- Add season_id to games
ALTER TABLE games ADD COLUMN IF NOT EXISTS season_id INTEGER REFERENCES seasons(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_games_season_id ON games(season_id);

-- Achievements tables
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  badge_icon VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('shooting', 'consistency', 'improvement', 'milestone')),
  criteria JSONB NOT NULL,
  points INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS player_achievements (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  game_id INTEGER REFERENCES games(id) ON DELETE SET NULL,
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB,
  UNIQUE(player_id, achievement_id, game_id)
);

CREATE TABLE IF NOT EXISTS team_leaderboard (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season VARCHAR(20) NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_player_achievements_player ON player_achievements(player_id);
CREATE INDEX IF NOT EXISTS idx_team_leaderboard_season ON team_leaderboard(season, total_points DESC);
CREATE INDEX IF NOT EXISTS idx_player_leaderboard_season ON player_leaderboard(season, fg_percentage DESC);

-- Enhanced events tables
CREATE TABLE IF NOT EXISTS free_shots (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    period INTEGER NOT NULL,
    time_remaining INTERVAL,
    free_shot_type VARCHAR(50) NOT NULL,
    reason VARCHAR(100),
    x_coord DECIMAL,
    y_coord DECIMAL,
    result VARCHAR(20) NOT NULL,
    distance DECIMAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (free_shot_type IN ('free_shot', 'penalty')),
    CHECK (result IN ('goal', 'miss', 'blocked'))
);

CREATE INDEX IF NOT EXISTS idx_free_shots_game_id ON free_shots(game_id);

CREATE TABLE IF NOT EXISTS timeouts (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    timeout_type VARCHAR(50) NOT NULL,
    period INTEGER NOT NULL,
    time_remaining INTERVAL,
    duration INTERVAL DEFAULT '1 minute',
    reason VARCHAR(200),
    called_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    CHECK (timeout_type IN ('team', 'injury', 'official', 'tv'))
);

CREATE INDEX IF NOT EXISTS idx_timeouts_game_id ON timeouts(game_id);

CREATE TABLE IF NOT EXISTS match_commentary (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    period INTEGER NOT NULL,
    time_remaining INTERVAL,
    commentary_type VARCHAR(50) NOT NULL,
    title VARCHAR(100),
    content TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (commentary_type IN ('note', 'highlight', 'injury', 'weather', 'technical'))
);

CREATE INDEX IF NOT EXISTS idx_match_commentary_game_id ON match_commentary(game_id);

SQL

echo "Migrations applied successfully!"
