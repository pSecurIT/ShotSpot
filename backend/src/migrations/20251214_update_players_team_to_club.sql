-- Migration: Update players table to use club_id instead of team_id

-- Add club_id column to players table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'players' AND column_name = 'club_id'
    ) THEN
        ALTER TABLE players ADD COLUMN club_id INTEGER REFERENCES clubs(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Migrate existing data from team_id to club_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'players' AND column_name = 'team_id'
    ) THEN
        UPDATE players
        SET club_id = team_id
        WHERE club_id IS NULL; -- Ensure no overwrites
    END IF;
END $$;

-- Drop the old team_id column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'players' AND column_name = 'team_id'
    ) THEN
        ALTER TABLE players DROP COLUMN team_id;
    END IF;
END $$;

-- Update unique constraint to use club_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'players_team_id_jersey_number_key'
    ) THEN
        ALTER TABLE players DROP CONSTRAINT players_team_id_jersey_number_key;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'players_club_id_jersey_number_key'
    ) THEN
        ALTER TABLE players ADD CONSTRAINT players_club_id_jersey_number_key UNIQUE (club_id, jersey_number);
    END IF;
END $$;