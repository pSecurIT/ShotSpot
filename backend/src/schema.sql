-- ==============================================================================
-- SHOTSPOT DATABASE SCHEMA - Complete with all migrations
-- ==============================================================================
-- This schema includes the base tables plus all migrations applied in order
-- Last updated: 2025-11-23
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- USERS & AUTHENTICATION
-- ==============================================================================

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    password_must_change BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON COLUMN users.password_must_change IS 'Forces user to change password on next login (used for default admin and password resets)';
COMMENT ON COLUMN users.is_active IS 'Soft delete flag - false indicates user has been deactivated';
COMMENT ON COLUMN users.last_login IS 'Timestamp of user''s most recent successful login';

-- Create indexes for user activity tracking
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);
CREATE INDEX IF NOT EXISTS idx_users_password_must_change ON users(password_must_change) WHERE password_must_change = true;

-- Login history table for security auditing
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

COMMENT ON TABLE login_history IS 'Tracks all login attempts (successful and failed) for security auditing';

-- ==============================================================================
-- SEASONS
-- ==============================================================================

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

COMMENT ON TABLE seasons IS 'Seasons for organizing games and tracking historical performance';

-- ==============================================================================
-- TEAMS & PLAYERS
-- ==============================================================================

-- Replace 'teams' table with 'clubs'
CREATE TABLE IF NOT EXISTS clubs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Update references in players table
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    club_id INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    jersey_number INTEGER,
    gender VARCHAR(10),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(club_id, jersey_number),
    CHECK (gender IN ('male', 'female') OR gender IS NULL)
);

COMMENT ON TABLE players IS 'Player information. Note: Captain role is game-specific and stored in game_rosters table.';
COMMENT ON COLUMN players.gender IS 'Player gender: male or female. Required for korfball team composition (4 males + 4 females per team).';

-- Teams table for age groups (U17, U15, etc.)
CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    age_group VARCHAR(20),
    gender VARCHAR(10),
    season_id INTEGER REFERENCES seasons(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(club_id, name, season_id),
    CHECK (gender IN ('male', 'female', 'mixed') OR gender IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_teams_club_id ON teams(club_id);
CREATE INDEX IF NOT EXISTS idx_teams_season_id ON teams(season_id);
CREATE INDEX IF NOT EXISTS idx_teams_is_active ON teams(is_active);

COMMENT ON TABLE teams IS 'Teams within clubs (e.g., U17, U15, U13 age groups). Players belong to teams.';
COMMENT ON COLUMN teams.age_group IS 'Age group identifier (e.g., U17, U15, U13, U11, Senior)';
COMMENT ON COLUMN teams.gender IS 'Team gender: male, female, or mixed for korfball';
COMMENT ON COLUMN teams.season_id IS 'Optional season link for historical team tracking';

-- ==============================================================================
-- GAMES
-- ==============================================================================

-- Update references in games table
CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    home_club_id INTEGER REFERENCES clubs(id) NOT NULL,
    away_club_id INTEGER REFERENCES clubs(id) NOT NULL,
    home_score INTEGER DEFAULT 0,
    away_score INTEGER DEFAULT 0,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (status IN ('scheduled', 'completed', 'cancelled'))
);

COMMENT ON TABLE games IS 'Tracks all matches between clubs, including scores and status.';

-- Shots table
CREATE TABLE IF NOT EXISTS shots (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
    x_coord DECIMAL NOT NULL,
    y_coord DECIMAL NOT NULL,
    result VARCHAR(20) NOT NULL, -- goal, miss, blocked
    period INTEGER NOT NULL,
    time_remaining INTERVAL,
    shot_type VARCHAR(50),
    distance DECIMAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Game events table (fouls, substitutions, timeouts)
CREATE TABLE IF NOT EXISTS game_events (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
    period INTEGER NOT NULL,
    time_remaining INTERVAL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ball possessions table (track attack duration and shots per attack)
CREATE TABLE IF NOT EXISTS ball_possessions (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
    period INTEGER NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    shots_taken INTEGER DEFAULT 0,
    result VARCHAR(20), -- goal, turnover, out_of_bounds, timeout, period_end
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_ball_possessions_game_id ON ball_possessions(game_id);
CREATE INDEX IF NOT EXISTS idx_ball_possessions_club_id ON ball_possessions(club_id);

-- Game rosters table (track which players are active for each game and captain)
CREATE TABLE IF NOT EXISTS game_rosters (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    is_captain BOOLEAN DEFAULT false,
    is_starting BOOLEAN DEFAULT true,
    starting_position VARCHAR(20), -- 'offense' or 'defense' - position at match start
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, player_id),
    CHECK (starting_position IN ('offense', 'defense') OR starting_position IS NULL)
);

-- Indexes for game rosters
CREATE INDEX IF NOT EXISTS idx_game_rosters_game_id ON game_rosters(game_id);
CREATE INDEX IF NOT EXISTS idx_game_rosters_club_id ON game_rosters(club_id);
CREATE INDEX IF NOT EXISTS idx_game_rosters_player_id ON game_rosters(player_id);

-- Substitutions table (track player substitutions during live matches)
CREATE TABLE IF NOT EXISTS substitutions (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
    player_in_id INTEGER REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    player_out_id INTEGER REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    period INTEGER NOT NULL,
    time_remaining INTERVAL,
    reason VARCHAR(50), -- tactical, injury, fatigue, disciplinary
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT different_players CHECK (player_in_id != player_out_id)
);

COMMENT ON TABLE substitutions IS 'Tracks player substitutions during live matches. Player_out goes to bench, player_in enters the court.';
COMMENT ON COLUMN substitutions.player_in_id IS 'Player entering the court (coming from bench)';
COMMENT ON COLUMN substitutions.player_out_id IS 'Player leaving the court (going to bench)';
COMMENT ON COLUMN substitutions.reason IS 'Reason for substitution: tactical, injury, fatigue, disciplinary';

-- Indexes for substitutions
CREATE INDEX IF NOT EXISTS idx_substitutions_game_id ON substitutions(game_id);
CREATE INDEX IF NOT EXISTS idx_substitutions_club_id ON substitutions(club_id);
CREATE INDEX IF NOT EXISTS idx_substitutions_player_in_id ON substitutions(player_in_id);
CREATE INDEX IF NOT EXISTS idx_substitutions_player_out_id ON substitutions(player_out_id);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_players_updated_at
    BEFORE UPDATE ON players
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_games_updated_at
    BEFORE UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();