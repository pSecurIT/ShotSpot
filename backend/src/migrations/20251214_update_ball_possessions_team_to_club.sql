-- Migration: Update ball_possessions table to use club_id instead of team_id

-- Add club_id column to ball_possessions table
ALTER TABLE ball_possessions ADD COLUMN club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE NOT NULL;

-- Migrate existing data from team_id to club_id
UPDATE ball_possessions
SET club_id = team_id;

-- Drop the old team_id column
ALTER TABLE ball_possessions DROP COLUMN team_id;

-- Update index to use club_id
DROP INDEX IF EXISTS idx_ball_possessions_team_id;
CREATE INDEX idx_ball_possessions_club_id ON ball_possessions(club_id);