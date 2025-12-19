-- Migration: reintroduce optional team link for players while keeping club_id uniqueness
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'players' AND column_name = 'team_id'
    ) THEN
        ALTER TABLE players ADD COLUMN team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add indexes to support lookups
CREATE INDEX IF NOT EXISTS idx_players_club_id ON players(club_id);
CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);

-- Ensure unique constraint remains on club/jersey combination
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'players_club_id_jersey_number_key'
    ) THEN
        -- already correct
        NULL;
    ELSIF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'players_team_id_jersey_number_key'
    ) THEN
        ALTER TABLE players ADD CONSTRAINT players_club_id_jersey_number_key UNIQUE (club_id, jersey_number);
    END IF;
END $$;
