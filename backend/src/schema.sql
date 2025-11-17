-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Players table
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    jersey_number INTEGER,
    gender VARCHAR(10),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, jersey_number), -- Ensure unique jersey numbers within a team
    CHECK (gender IN ('male', 'female') OR gender IS NULL)
);

COMMENT ON TABLE players IS 'Player information. Note: Captain role is game-specific and stored in game_rosters table.';

-- Games table
CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    home_team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    away_team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, to_reschedule, in_progress, completed, cancelled
    home_score INTEGER DEFAULT 0,
    away_score INTEGER DEFAULT 0,
    current_period INTEGER DEFAULT 1,
    period_duration INTERVAL DEFAULT '10 minutes',
    time_remaining INTERVAL,
    timer_state VARCHAR(20) DEFAULT 'stopped', -- stopped, running, paused
    timer_started_at TIMESTAMP WITH TIME ZONE,
    timer_paused_at TIMESTAMP WITH TIME ZONE,
    home_attacking_side VARCHAR(10), -- 'left' or 'right' - which korf the home team attacks initially
    number_of_periods INTEGER DEFAULT 4, -- 1-10 periods, teams switch sides every period
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (home_team_id != away_team_id),
    CHECK (current_period >= 1 AND current_period <= 10),
    CHECK (timer_state IN ('stopped', 'running', 'paused')),
    CHECK (home_attacking_side IN ('left', 'right') OR home_attacking_side IS NULL),
    CHECK (number_of_periods >= 1 AND number_of_periods <= 10)
);

-- Shots table
CREATE TABLE IF NOT EXISTS shots (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
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
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    period INTEGER NOT NULL,
    time_remaining INTERVAL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ball possessions table (track attack duration and shots per attack)
CREATE TABLE IF NOT EXISTS ball_possessions (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_ball_possessions_team_id ON ball_possessions(team_id);

-- Game rosters table (track which players are active for each game and captain)
CREATE TABLE IF NOT EXISTS game_rosters (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_game_rosters_team_id ON game_rosters(team_id);
CREATE INDEX IF NOT EXISTS idx_game_rosters_player_id ON game_rosters(player_id);

-- Substitutions table (track player substitutions during live matches)
CREATE TABLE IF NOT EXISTS substitutions (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_substitutions_team_id ON substitutions(team_id);
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