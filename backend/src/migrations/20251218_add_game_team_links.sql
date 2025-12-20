-- Migration: allow games to track optional teams and type
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'home_team_id'
    ) THEN
        ALTER TABLE games ADD COLUMN home_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'away_team_id'
    ) THEN
        ALTER TABLE games ADD COLUMN away_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'game_type'
    ) THEN
        ALTER TABLE games ADD COLUMN game_type VARCHAR(10) DEFAULT 'club';
    END IF;
END $$;

-- Maintain allowed values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'games_game_type_check'
    ) THEN
        ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN ('club', 'team'));
    END IF;
END $$;
