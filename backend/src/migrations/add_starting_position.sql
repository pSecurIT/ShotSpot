-- Migration: Add starting_position to game_rosters table
-- This allows coaches to designate which players start in offense vs defense
-- Korfball requires 4 players in attack and 4 in defense (2 male, 2 female each)

-- Add starting_position column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_rosters' AND column_name = 'starting_position'
    ) THEN
        ALTER TABLE game_rosters 
        ADD COLUMN starting_position VARCHAR(10) CHECK (starting_position IN ('offense', 'defense') OR starting_position IS NULL);
        
        COMMENT ON COLUMN game_rosters.starting_position IS 
        'Starting position for the player: offense or defense. Required for starting players (is_starting = true).';
    END IF;
END $$;

-- Verify the migration
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'game_rosters' 
AND column_name = 'starting_position';
