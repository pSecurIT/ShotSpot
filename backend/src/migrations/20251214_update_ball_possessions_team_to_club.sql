-- Migration: Update ball_possessions table to use club_id instead of team_id

-- Add club_id column to ball_possessions table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ball_possessions' AND column_name = 'club_id'
    ) THEN
        ALTER TABLE ball_possessions ADD COLUMN club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE NOT NULL;
    END IF;
END $$;

-- Migrate existing data from team_id to club_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ball_possessions' AND column_name = 'team_id'
    ) THEN
        UPDATE ball_possessions
        SET club_id = team_id;
    END IF;
END $$;

-- Drop the old team_id column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ball_possessions' AND column_name = 'team_id'
    ) THEN
        ALTER TABLE ball_possessions DROP COLUMN team_id;
    END IF;
END $$;

-- Update index to use club_id
DROP INDEX IF EXISTS idx_ball_possessions_team_id;
CREATE INDEX IF NOT EXISTS idx_ball_possessions_club_id ON ball_possessions(club_id);