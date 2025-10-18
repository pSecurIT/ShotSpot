-- Create game_rosters table to track which players are active for each game
-- and which player is the captain for that specific game

CREATE TABLE IF NOT EXISTS game_rosters (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    is_captain BOOLEAN DEFAULT false,
    is_starting BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, player_id) -- Each player can only be in roster once per game
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_game_rosters_game_id ON game_rosters(game_id);
CREATE INDEX IF NOT EXISTS idx_game_rosters_team_id ON game_rosters(team_id);
CREATE INDEX IF NOT EXISTS idx_game_rosters_player_id ON game_rosters(player_id);

COMMENT ON TABLE game_rosters IS 
'Tracks which players are in the roster for each game and who is captain for that specific game. Role is game-specific, not permanent.';

COMMENT ON COLUMN game_rosters.is_captain IS 
'Whether this player is the captain for this specific game. One captain per team per game.';

COMMENT ON COLUMN game_rosters.is_starting IS 
'Whether this player is in the starting lineup (on court) vs on the bench.';
