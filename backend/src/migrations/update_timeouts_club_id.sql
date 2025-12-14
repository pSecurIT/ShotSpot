-- Migration: Update timeouts table to use club_id instead of team_id
-- This aligns timeouts with the clubs (organizations) structure

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'timeouts'
    ) THEN
        -- Drop existing foreign key constraint
        ALTER TABLE timeouts DROP CONSTRAINT IF EXISTS timeouts_team_id_fkey;

        -- Rename column from team_id to club_id
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'timeouts' AND column_name = 'team_id'
        ) THEN
            ALTER TABLE timeouts RENAME COLUMN team_id TO club_id;
        END IF;

        -- Update comment
        COMMENT ON COLUMN timeouts.club_id IS 'Club that called timeout (NULL for official/tv timeouts)';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'timeouts_club_id_fkey'
    ) THEN
        ALTER TABLE timeouts DROP CONSTRAINT timeouts_club_id_fkey;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'timeouts_club_id_fkey'
    ) THEN
        ALTER TABLE timeouts ADD CONSTRAINT timeouts_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
