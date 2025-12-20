-- Migration: Update games table to use club_id instead of team_id

-- Add home_club_id and away_club_id columns to games table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'home_club_id'
    ) THEN
        ALTER TABLE games ADD COLUMN home_club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE NOT NULL;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'away_club_id'
    ) THEN
        ALTER TABLE games ADD COLUMN away_club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE NOT NULL;
    END IF;
END $$;

-- Migrate existing data from home_team_id and away_team_id to home_club_id and away_club_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'home_team_id'
    ) THEN
        UPDATE games
        SET home_club_id = home_team_id;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'away_team_id'
    ) THEN
        UPDATE games
        SET away_club_id = away_team_id;
    END IF;
END $$;

-- Drop the old home_team_id and away_team_id columns
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'home_team_id'
    ) THEN
        ALTER TABLE games DROP COLUMN home_team_id;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'away_team_id'
    ) THEN
        ALTER TABLE games DROP COLUMN away_team_id;
    END IF;
END $$;

-- Update CHECK constraint to use club_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'games_home_team_id_check'
    ) THEN
        ALTER TABLE games DROP CONSTRAINT games_home_team_id_check;
    END IF;
END $$;
ALTER TABLE games ADD CONSTRAINT games_home_club_id_check CHECK (home_club_id != away_club_id);