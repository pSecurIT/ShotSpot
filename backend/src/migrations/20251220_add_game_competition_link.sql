-- Add competition_id to games table to link games with competitions
-- This is needed to determine if a game is an official match requiring Twizzit registration

-- Add competition_id column (nullable since not all games are part of competitions)
ALTER TABLE games ADD COLUMN IF NOT EXISTS competition_id INTEGER REFERENCES competitions(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_games_competition_id ON games(competition_id);

-- Comment explaining the column
COMMENT ON COLUMN games.competition_id IS 'Links game to a competition (tournament/league). NULL for friendly matches.';
