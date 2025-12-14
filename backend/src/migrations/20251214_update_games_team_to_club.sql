-- Migration: Update games table to use club_id instead of team_id

-- Add home_club_id and away_club_id columns to games table
ALTER TABLE games ADD COLUMN home_club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE NOT NULL;
ALTER TABLE games ADD COLUMN away_club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE NOT NULL;

-- Migrate existing data from home_team_id and away_team_id to home_club_id and away_club_id
UPDATE games
SET home_club_id = home_team_id,
    away_club_id = away_team_id;

-- Drop the old home_team_id and away_team_id columns
ALTER TABLE games DROP COLUMN home_team_id;
ALTER TABLE games DROP COLUMN away_team_id;

-- Update CHECK constraint to use club_id
ALTER TABLE games DROP CONSTRAINT games_home_team_id_check;
ALTER TABLE games ADD CONSTRAINT games_home_club_id_check CHECK (home_club_id != away_club_id);