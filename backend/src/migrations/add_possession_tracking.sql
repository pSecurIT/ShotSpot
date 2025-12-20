-- Add configuration fields for sets and possession tracking
-- number_of_periods: 1-10 periods (configurable per match)
-- Teams switch attacking sides every period
-- Track ball possessions to calculate attack duration and shots per attack

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'number_of_periods'
    ) THEN
        ALTER TABLE games ADD COLUMN number_of_periods INTEGER DEFAULT 4 CHECK (number_of_periods >= 1 AND number_of_periods <= 10);
    END IF;
END $$;

-- Update current_period constraint to support up to 10 periods
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_name = 'games' AND constraint_name = 'games_current_period_check'
    ) THEN
        ALTER TABLE games DROP CONSTRAINT games_current_period_check;
    END IF;
    ALTER TABLE games ADD CONSTRAINT games_current_period_check CHECK (current_period >= 1 AND current_period <= 10);
END $$;

-- Add comment
COMMENT ON COLUMN games.number_of_periods IS 
'Number of periods in the game. Configurable from 1-10. Teams switch sides every period.';

-- Create table for tracking ball possessions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'ball_possessions'
    ) THEN
        CREATE TABLE ball_possessions (
            id SERIAL PRIMARY KEY,
            game_id INTEGER REFERENCES games(id) ON DELETE CASCADE NOT NULL,
            club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
            player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
            period INTEGER NOT NULL,
            started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ended_at TIMESTAMP WITH TIME ZONE,
            duration_seconds INTEGER,
            shots_taken INTEGER DEFAULT 0,
            result VARCHAR(20), -- goal, turnover, out_of_bounds, timeout, period_end
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    END IF;
END $$;

-- Index for faster queries
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ball_possessions_game_id'
    ) THEN
        CREATE INDEX idx_ball_possessions_game_id ON ball_possessions(game_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ball_possessions_club_id'
    ) THEN
        CREATE INDEX idx_ball_possessions_club_id ON ball_possessions(club_id);
    END IF;
END $$;

COMMENT ON TABLE ball_possessions IS 
'Tracks ball possessions to measure attack duration and shots per attack. A possession starts when ball crosses center line and ends on goal, turnover, or stoppage.';

-- Migration: Add possession tracking
-- This migration adds the ball_possessions table for tracking ball possession events
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'ball_possessions'
    ) THEN
        CREATE TABLE ball_possessions (
            id SERIAL PRIMARY KEY,
            game_id INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
            club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
            player_id INT REFERENCES players(id) ON DELETE SET NULL,
            start_time TIMESTAMP NOT NULL,
            end_time TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
    END IF;
END $$;
