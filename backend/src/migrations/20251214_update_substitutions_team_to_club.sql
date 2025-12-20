-- Migration: Update substitutions table to use club_id instead of team_id

-- Add club_id column to substitutions table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'substitutions' AND column_name = 'club_id'
    ) THEN
        ALTER TABLE substitutions ADD COLUMN club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE NOT NULL;
    END IF;
END $$;

-- Migrate existing data from team_id to club_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'substitutions' AND column_name = 'team_id'
    ) THEN
        UPDATE substitutions
        SET club_id = team_id;
    END IF;
END $$;

-- Drop the old team_id column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'substitutions' AND column_name = 'team_id'
    ) THEN
        ALTER TABLE substitutions DROP COLUMN team_id;
    END IF;
END $$;

-- Update index to use club_id
DROP INDEX IF EXISTS idx_substitutions_team_id;
CREATE INDEX IF NOT EXISTS idx_substitutions_club_id ON substitutions(club_id);