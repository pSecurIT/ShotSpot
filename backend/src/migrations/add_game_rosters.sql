-- Create game_rosters table to track which players are active for each game
-- and which player is the captain for that specific game

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'game_rosters'
    ) THEN
        CREATE TABLE game_rosters (
            id SERIAL PRIMARY KEY,
            game_id INTEGER REFERENCES games(id) ON DELETE CASCADE NOT NULL,
            club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
            player_id INTEGER REFERENCES players(id) ON DELETE CASCADE NOT NULL,
            is_captain BOOLEAN DEFAULT false,
            is_starting BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(game_id, player_id) -- Each player can only be in roster once per game
        );
    END IF;
END $$;

-- Create index for faster queries
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_game_rosters_game_id'
    ) THEN
        CREATE INDEX idx_game_rosters_game_id ON game_rosters(game_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_game_rosters_club_id'
    ) THEN
        CREATE INDEX idx_game_rosters_club_id ON game_rosters(club_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_game_rosters_player_id'
    ) THEN
        CREATE INDEX idx_game_rosters_player_id ON game_rosters(player_id);
    END IF;
END $$;

COMMENT ON TABLE game_rosters IS 
'Tracks which players are in the roster for each game and who is captain for that specific game. Role is game-specific, not permanent.';

COMMENT ON COLUMN game_rosters.is_captain IS 
'Whether this player is the captain for this specific game. One captain per team per game.';

COMMENT ON COLUMN game_rosters.is_starting IS 
'Whether this player is in the starting lineup (on court) vs on the bench.';

-- Migration: Add game rosters
-- This migration adds the game_rosters table for tracking player participation in games
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'game_rosters'
    ) THEN
        CREATE TABLE game_rosters (
            id SERIAL PRIMARY KEY,
            game_id INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
            club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
            player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            is_starting BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
    END IF;
END $$;
