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
