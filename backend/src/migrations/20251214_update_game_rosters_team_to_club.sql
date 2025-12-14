-- Migration: Update game_rosters table to use club_id instead of team_id

-- Add club_id column to game_rosters table
ALTER TABLE game_rosters ADD COLUMN club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE NOT NULL;

-- Migrate existing data from team_id to club_id
UPDATE game_rosters
SET club_id = team_id;

-- Drop the old team_id column
ALTER TABLE game_rosters DROP COLUMN team_id;

-- Update index to use club_id
DROP INDEX IF EXISTS idx_game_rosters_team_id;
CREATE INDEX idx_game_rosters_club_id ON game_rosters(club_id);