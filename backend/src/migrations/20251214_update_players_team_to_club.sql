-- Migration: Update players table to use club_id instead of team_id

-- Add club_id column to players table
ALTER TABLE players ADD COLUMN club_id INTEGER REFERENCES clubs(id) ON DELETE SET NULL;

-- Migrate existing data from team_id to club_id
UPDATE players
SET club_id = team_id;

-- Drop the old team_id column
ALTER TABLE players DROP COLUMN team_id;

-- Update unique constraint to use club_id
ALTER TABLE players DROP CONSTRAINT players_team_id_jersey_number_key;
ALTER TABLE players ADD CONSTRAINT players_club_id_jersey_number_key UNIQUE (club_id, jersey_number);