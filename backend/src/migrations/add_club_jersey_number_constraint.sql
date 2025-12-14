-- Migration: Add unique constraint for jersey numbers within clubs
-- Players must have unique jersey numbers within their club (organization level)
-- This is in addition to the team-level uniqueness constraint

-- Add unique constraint for club_id + jersey_number
-- This ensures jersey numbers are unique within a club, even when team_id is NULL
ALTER TABLE players ADD CONSTRAINT players_club_id_jersey_number_key UNIQUE(club_id, jersey_number);

COMMENT ON CONSTRAINT players_club_id_jersey_number_key ON players IS 'Ensures jersey numbers are unique within a club';
