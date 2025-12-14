-- Substitutions table (track player substitutions during live matches)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'substitutions'
    ) THEN
        CREATE TABLE substitutions (
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
    END IF;
END $$;

COMMENT ON TABLE substitutions IS 'Tracks player substitutions during live matches. Player_out goes to bench, player_in enters the court.';
COMMENT ON COLUMN substitutions.player_in_id IS 'Player entering the court (coming from bench)';
COMMENT ON COLUMN substitutions.player_out_id IS 'Player leaving the court (going to bench)';
COMMENT ON COLUMN substitutions.reason IS 'Reason for substitution: tactical, injury, fatigue, disciplinary';

-- Indexes for substitutions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_substitutions_game_id'
    ) THEN
        CREATE INDEX idx_substitutions_game_id ON substitutions(game_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_substitutions_club_id'
    ) THEN
        CREATE INDEX idx_substitutions_club_id ON substitutions(club_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_substitutions_player_in_id'
    ) THEN
        CREATE INDEX idx_substitutions_player_in_id ON substitutions(player_in_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_substitutions_player_out_id'
    ) THEN
        CREATE INDEX idx_substitutions_player_out_id ON substitutions(player_out_id);
    END IF;
END $$;

-- Migration: Add substitutions
-- This migration adds the substitutions table for tracking player substitutions during games
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'substitutions'
    ) THEN
        CREATE TABLE substitutions (
            id SERIAL PRIMARY KEY,
            game_id INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
            club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
            player_in_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            player_out_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            substitution_time TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
    END IF;
END $$;
