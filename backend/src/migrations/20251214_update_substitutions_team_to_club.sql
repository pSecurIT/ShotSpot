-- Migration: Update substitutions table to use club_id instead of team_id

-- Add club_id column to substitutions table
ALTER TABLE substitutions ADD COLUMN club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE NOT NULL;

-- Migrate existing data from team_id to club_id
UPDATE substitutions
SET club_id = team_id;

-- Drop the old team_id column
ALTER TABLE substitutions DROP COLUMN team_id;

-- Update index to use club_id
DROP INDEX IF EXISTS idx_substitutions_team_id;
CREATE INDEX idx_substitutions_club_id ON substitutions(club_id);