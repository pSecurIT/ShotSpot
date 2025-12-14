-- Migration: Rename Teams to Clubs and Create New Teams (Age Groups)
-- This migration restructures the data model:
-- - Current "teams" table becomes "clubs" (organizations)
-- - New "teams" table represents age groups (U17, U15, etc.)
-- - Players belong to teams (age groups)
-- - Games are played between clubs
-- - Teams belong to clubs

-- Step 1: Rename teams table to clubs
ALTER TABLE teams RENAME TO clubs;

-- Step 2: Rename all foreign key columns and constraints
-- Update players table
ALTER TABLE players RENAME COLUMN team_id TO club_id;
ALTER TABLE players RENAME CONSTRAINT players_team_id_fkey TO players_club_id_fkey;
ALTER TABLE players DROP CONSTRAINT players_team_id_jersey_number_key;
-- We'll recreate this constraint later after adding team_id

-- Step 3: Update games table
ALTER TABLE games RENAME COLUMN home_team_id TO home_club_id;
ALTER TABLE games RENAME COLUMN away_team_id TO away_club_id;
ALTER TABLE games RENAME CONSTRAINT games_home_team_id_fkey TO games_home_club_id_fkey;
ALTER TABLE games RENAME CONSTRAINT games_away_team_id_fkey TO games_away_club_id_fkey;
-- Drop the check constraint if it exists (it might have a generated name)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'games_home_team_id_away_team_id_check') THEN
        ALTER TABLE games DROP CONSTRAINT games_home_team_id_away_team_id_check;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'games_check') THEN
        ALTER TABLE games DROP CONSTRAINT games_check;
    END IF;
END $$;
ALTER TABLE games ADD CONSTRAINT games_home_club_id_away_club_id_check CHECK (home_club_id != away_club_id);

-- Step 4: Update shots table
ALTER TABLE shots RENAME COLUMN team_id TO club_id;
ALTER TABLE shots RENAME CONSTRAINT shots_team_id_fkey TO shots_club_id_fkey;

-- Step 5: Update game_events table
ALTER TABLE game_events RENAME COLUMN team_id TO club_id;
ALTER TABLE game_events RENAME CONSTRAINT game_events_team_id_fkey TO game_events_club_id_fkey;

-- Step 6: Update ball_possessions table
ALTER TABLE ball_possessions RENAME COLUMN team_id TO club_id;
ALTER TABLE ball_possessions RENAME CONSTRAINT ball_possessions_team_id_fkey TO ball_possessions_club_id_fkey;
DROP INDEX IF EXISTS idx_ball_possessions_team_id;
CREATE INDEX IF NOT EXISTS idx_ball_possessions_club_id ON ball_possessions(club_id);

-- Step 7: Update game_rosters table
ALTER TABLE game_rosters RENAME COLUMN team_id TO club_id;
ALTER TABLE game_rosters RENAME CONSTRAINT game_rosters_team_id_fkey TO game_rosters_club_id_fkey;
DROP INDEX IF EXISTS idx_game_rosters_team_id;
CREATE INDEX IF NOT EXISTS idx_game_rosters_club_id ON game_rosters(club_id);

-- Step 8: Update substitutions table
ALTER TABLE substitutions RENAME COLUMN team_id TO club_id;
ALTER TABLE substitutions RENAME CONSTRAINT substitutions_team_id_fkey TO substitutions_club_id_fkey;
DROP INDEX IF EXISTS idx_substitutions_team_id;
CREATE INDEX IF NOT EXISTS idx_substitutions_club_id ON substitutions(club_id);

-- Step 9: Update Twizzit integration tables
ALTER TABLE twizzit_team_mappings RENAME COLUMN local_team_id TO local_club_id;
ALTER TABLE twizzit_team_mappings RENAME CONSTRAINT twizzit_team_mappings_local_team_id_fkey TO twizzit_team_mappings_local_club_id_fkey;
DROP INDEX IF EXISTS idx_twizzit_team_mappings_local_team;
CREATE INDEX IF NOT EXISTS idx_twizzit_team_mappings_local_club ON twizzit_team_mappings(local_club_id);
ALTER TABLE twizzit_team_mappings DROP CONSTRAINT twizzit_team_mappings_local_team_id_key;
ALTER TABLE twizzit_team_mappings ADD CONSTRAINT twizzit_team_mappings_local_club_id_key UNIQUE(local_club_id);

-- Step 10: Rename triggers
DROP TRIGGER IF EXISTS update_teams_updated_at ON clubs;
CREATE TRIGGER update_clubs_updated_at
    BEFORE UPDATE ON clubs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 11: Create new teams table for age groups (U17, U15, etc.)
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

CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 12: Add team_id to players table (age group team)
ALTER TABLE players ADD COLUMN team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);

-- Step 13: Recreate unique constraint for players with both club_id and team_id
-- Players can have same jersey number in different teams, but not in the same team
ALTER TABLE players ADD CONSTRAINT players_team_id_jersey_number_key UNIQUE(team_id, jersey_number);

COMMENT ON COLUMN players.club_id IS 'Club/organization the player belongs to';
COMMENT ON COLUMN players.team_id IS 'Specific team (age group) the player plays in';

-- Step 14: Update game_rosters to include team information
ALTER TABLE game_rosters ADD COLUMN team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_game_rosters_team_id ON game_rosters(team_id);

COMMENT ON COLUMN game_rosters.team_id IS 'Specific team (age group) that played in this game';

-- Step 15: Add game type to differentiate between club games and team games
ALTER TABLE games ADD COLUMN game_type VARCHAR(20) DEFAULT 'club';
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN ('club', 'team'));

COMMENT ON COLUMN games.game_type IS 'Type of game: club (senior level) or team (age group specific)';

-- Step 16: Add optional team references to games for age group matches
ALTER TABLE games ADD COLUMN home_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE games ADD COLUMN away_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_games_home_team ON games(home_team_id);
CREATE INDEX IF NOT EXISTS idx_games_away_team ON games(away_team_id);

COMMENT ON COLUMN games.home_team_id IS 'Home team (age group) if this is a team-level game';
COMMENT ON COLUMN games.away_team_id IS 'Away team (age group) if this is a team-level game';
