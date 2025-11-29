-- Competition Management Schema Migration
-- Adds support for:
-- 1. Tournament Brackets: Multi-game tournament tracking
-- 2. League Integration: Season-long statistics
-- 3. Team Comparison: Head-to-head analytics
-- 4. Rankings System: Performance-based team rankings

-- ============================================================================
-- COMPETITIONS TABLE
-- ============================================================================
-- Main competition entity that can be either a tournament or a league
CREATE TABLE IF NOT EXISTS competitions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    competition_type VARCHAR(20) NOT NULL, -- 'tournament', 'league'
    season_id INTEGER REFERENCES seasons(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    description TEXT,
    status VARCHAR(20) DEFAULT 'upcoming', -- 'upcoming', 'in_progress', 'completed', 'cancelled'
    settings JSONB DEFAULT '{}', -- Flexible settings for different competition types
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (competition_type IN ('tournament', 'league')),
    CHECK (status IN ('upcoming', 'in_progress', 'completed', 'cancelled'))
);

COMMENT ON TABLE competitions IS 'Competitions including tournaments and leagues for organizing multi-game events';
COMMENT ON COLUMN competitions.competition_type IS 'Type of competition: tournament (knockout/bracket) or league (round-robin/season)';
COMMENT ON COLUMN competitions.settings IS 'JSON settings for competition rules, format, etc.';

-- ============================================================================
-- COMPETITION TEAMS TABLE
-- ============================================================================
-- Teams participating in a competition
CREATE TABLE IF NOT EXISTS competition_teams (
    id SERIAL PRIMARY KEY,
    competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    seed INTEGER, -- Seeding/ranking within the competition
    group_name VARCHAR(50), -- For group stage tournaments
    is_eliminated BOOLEAN DEFAULT false,
    elimination_round INTEGER, -- Round in which team was eliminated
    final_rank INTEGER, -- Final ranking in competition
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(competition_id, team_id)
);

COMMENT ON TABLE competition_teams IS 'Teams registered in a competition with their seeding and status';
COMMENT ON COLUMN competition_teams.seed IS 'Initial seeding/ranking of the team in the competition';
COMMENT ON COLUMN competition_teams.group_name IS 'Group name for group stage tournaments (e.g., Group A, Group B)';

-- ============================================================================
-- TOURNAMENT BRACKETS TABLE
-- ============================================================================
-- Tournament bracket structure for knockout tournaments
CREATE TABLE IF NOT EXISTS tournament_brackets (
    id SERIAL PRIMARY KEY,
    competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL, -- 1 = first round, increments for each subsequent round
    round_name VARCHAR(100), -- e.g., 'Quarter Finals', 'Semi Finals', 'Final'
    match_number INTEGER NOT NULL, -- Position within the round
    game_id INTEGER REFERENCES games(id) ON DELETE SET NULL,
    home_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    away_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    winner_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    next_bracket_id INTEGER REFERENCES tournament_brackets(id) ON DELETE SET NULL, -- Links to winner's next match
    scheduled_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'scheduled', 'in_progress', 'completed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(competition_id, round_number, match_number),
    CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed'))
);

COMMENT ON TABLE tournament_brackets IS 'Tournament bracket structure linking rounds and matches';
COMMENT ON COLUMN tournament_brackets.next_bracket_id IS 'ID of the bracket match where the winner advances';

-- ============================================================================
-- COMPETITION STANDINGS TABLE
-- ============================================================================
-- League standings and team statistics within a competition
CREATE TABLE IF NOT EXISTS competition_standings (
    id SERIAL PRIMARY KEY,
    competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    games_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    goals_for INTEGER DEFAULT 0,
    goals_against INTEGER DEFAULT 0,
    goal_difference INTEGER GENERATED ALWAYS AS (goals_for - goals_against) STORED,
    points INTEGER DEFAULT 0, -- For league competitions
    rank INTEGER, -- Current rank/position
    form VARCHAR(20), -- Last 5 results, e.g., 'WWLDW'
    home_wins INTEGER DEFAULT 0,
    home_losses INTEGER DEFAULT 0,
    home_draws INTEGER DEFAULT 0,
    away_wins INTEGER DEFAULT 0,
    away_losses INTEGER DEFAULT 0,
    away_draws INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(competition_id, team_id)
);

COMMENT ON TABLE competition_standings IS 'League standings with comprehensive team statistics';
COMMENT ON COLUMN competition_standings.form IS 'Recent form showing last 5 results (W=Win, L=Loss, D=Draw)';

-- ============================================================================
-- HEAD TO HEAD TABLE
-- ============================================================================
-- Historical head-to-head records between teams
CREATE TABLE IF NOT EXISTS head_to_head (
    id SERIAL PRIMARY KEY,
    team1_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    team2_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    total_games INTEGER DEFAULT 0,
    team1_wins INTEGER DEFAULT 0,
    team2_wins INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    team1_goals INTEGER DEFAULT 0,
    team2_goals INTEGER DEFAULT 0,
    last_game_id INTEGER REFERENCES games(id) ON DELETE SET NULL,
    last_game_date TIMESTAMP WITH TIME ZONE,
    streak_team_id INTEGER REFERENCES teams(id), -- Team with current winning streak
    streak_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team1_id, team2_id),
    CHECK (team1_id < team2_id) -- Enforce consistent ordering
);

COMMENT ON TABLE head_to_head IS 'Historical head-to-head records between pairs of teams';
COMMENT ON COLUMN head_to_head.streak_team_id IS 'Team with the current winning streak in head-to-head matches';

-- ============================================================================
-- TEAM RANKINGS TABLE
-- ============================================================================
-- Overall team rankings based on performance metrics
CREATE TABLE IF NOT EXISTS team_rankings (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    season_id INTEGER REFERENCES seasons(id) ON DELETE SET NULL,
    overall_rank INTEGER,
    points INTEGER DEFAULT 0, -- Calculated ranking points
    rating DECIMAL(6,2), -- ELO-style rating
    games_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    goals_for INTEGER DEFAULT 0,
    goals_against INTEGER DEFAULT 0,
    goal_difference INTEGER GENERATED ALWAYS AS (goals_for - goals_against) STORED,
    win_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN games_played > 0 
        THEN ROUND((wins::DECIMAL / games_played) * 100, 2) 
        ELSE 0 END
    ) STORED,
    avg_goals_per_game DECIMAL(4,2),
    avg_goals_conceded DECIMAL(4,2),
    clean_sheets INTEGER DEFAULT 0,
    longest_win_streak INTEGER DEFAULT 0,
    current_streak VARCHAR(20), -- e.g., 'W3' or 'L2' or 'D1'
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, season_id)
);

COMMENT ON TABLE team_rankings IS 'Team rankings based on performance metrics, can be season-specific or overall';
COMMENT ON COLUMN team_rankings.rating IS 'ELO-style rating for team strength comparison';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_competitions_season_id ON competitions(season_id);
CREATE INDEX IF NOT EXISTS idx_competitions_type ON competitions(competition_type);
CREATE INDEX IF NOT EXISTS idx_competitions_status ON competitions(status);

CREATE INDEX IF NOT EXISTS idx_competition_teams_competition_id ON competition_teams(competition_id);
CREATE INDEX IF NOT EXISTS idx_competition_teams_team_id ON competition_teams(team_id);

CREATE INDEX IF NOT EXISTS idx_tournament_brackets_competition_id ON tournament_brackets(competition_id);
CREATE INDEX IF NOT EXISTS idx_tournament_brackets_game_id ON tournament_brackets(game_id);
CREATE INDEX IF NOT EXISTS idx_tournament_brackets_round ON tournament_brackets(round_number);

CREATE INDEX IF NOT EXISTS idx_competition_standings_competition_id ON competition_standings(competition_id);
CREATE INDEX IF NOT EXISTS idx_competition_standings_team_id ON competition_standings(team_id);
CREATE INDEX IF NOT EXISTS idx_competition_standings_rank ON competition_standings(rank);

CREATE INDEX IF NOT EXISTS idx_head_to_head_teams ON head_to_head(team1_id, team2_id);
CREATE INDEX IF NOT EXISTS idx_head_to_head_last_game ON head_to_head(last_game_date DESC);

CREATE INDEX IF NOT EXISTS idx_team_rankings_team_id ON team_rankings(team_id);
CREATE INDEX IF NOT EXISTS idx_team_rankings_season_id ON team_rankings(season_id);
CREATE INDEX IF NOT EXISTS idx_team_rankings_rank ON team_rankings(overall_rank);
CREATE INDEX IF NOT EXISTS idx_team_rankings_rating ON team_rankings(rating DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================
-- Update timestamps automatically
CREATE TRIGGER update_competitions_updated_at
    BEFORE UPDATE ON competitions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_competition_standings_updated_at
    BEFORE UPDATE ON competition_standings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_head_to_head_updated_at
    BEFORE UPDATE ON head_to_head
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
