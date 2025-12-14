-- Migration: Update timeouts table to use club_id instead of team_id
-- This aligns timeouts with the clubs (organizations) structure

-- Drop existing foreign key constraint
ALTER TABLE timeouts DROP CONSTRAINT IF EXISTS timeouts_team_id_fkey;

-- Rename column from team_id to club_id
ALTER TABLE timeouts RENAME COLUMN team_id TO club_id;

-- Add new foreign key constraint referencing clubs table
ALTER TABLE timeouts ADD CONSTRAINT timeouts_club_id_fkey 
    FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

-- Update comment
COMMENT ON COLUMN timeouts.club_id IS 'Club that called timeout (NULL for official/tv timeouts)';
