-- Migration: Add Twizzit registration tracking and official match flags
-- This enforces the KBKB rule that players must be registered in Twizzit to play official matches

-- Add Twizzit registration fields to players table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'players' AND column_name = 'is_twizzit_registered'
    ) THEN
        ALTER TABLE players ADD COLUMN is_twizzit_registered BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'players' AND column_name = 'twizzit_verified_at'
    ) THEN
        ALTER TABLE players ADD COLUMN twizzit_verified_at TIMESTAMP;
    END IF;
END $$;

-- Add index for performance on Twizzit registration queries
CREATE INDEX IF NOT EXISTS idx_players_twizzit_registered ON players(is_twizzit_registered);

-- Add comment explaining the KBKB registration requirement
COMMENT ON COLUMN players.is_twizzit_registered IS 
  'Whether player is registered in Twizzit (KBKB - Belgian Korfball Federation). Required for official match participation per KBKB rules.';

COMMENT ON COLUMN players.twizzit_verified_at IS 
  'Timestamp when Twizzit registration was last verified via sync or manual confirmation.';

-- Add is_official flag to competitions table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'competitions' AND column_name = 'is_official'
    ) THEN
        ALTER TABLE competitions ADD COLUMN is_official BOOLEAN DEFAULT true;
    END IF;
END $$;

COMMENT ON COLUMN competitions.is_official IS 
  'Whether this is an official KBKB competition requiring Twizzit-registered players only.';

-- Update existing players to have null twizzit_verified_at (not false, to distinguish unknown from verified-false)
-- Leave is_twizzit_registered as false by default until verified

-- Trigger to auto-update is_twizzit_registered based on twizzit_player_mappings
CREATE OR REPLACE FUNCTION sync_player_twizzit_registration()
RETURNS TRIGGER AS $$
BEGIN
    -- When a mapping is created, mark player as registered
    IF TG_OP = 'INSERT' THEN
        UPDATE players 
        SET is_twizzit_registered = true, 
            twizzit_verified_at = CURRENT_TIMESTAMP
        WHERE id = NEW.local_player_id;
    END IF;
    
    -- When a mapping is deleted, mark player as unregistered
    IF TG_OP = 'DELETE' THEN
        UPDATE players 
        SET is_twizzit_registered = false, 
            twizzit_verified_at = NULL
        WHERE id = OLD.local_player_id
        AND NOT EXISTS (
            SELECT 1 FROM twizzit_player_mappings 
            WHERE local_player_id = OLD.local_player_id
        );
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on twizzit_player_mappings
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_sync_player_twizzit_registration'
    ) THEN
        CREATE TRIGGER trigger_sync_player_twizzit_registration
            AFTER INSERT OR DELETE ON twizzit_player_mappings
            FOR EACH ROW
            EXECUTE FUNCTION sync_player_twizzit_registration();
    END IF;
END $$;

-- Backfill is_twizzit_registered for existing players with mappings
UPDATE players p
SET is_twizzit_registered = true,
    twizzit_verified_at = COALESCE(tpm.last_synced_at, CURRENT_TIMESTAMP)
FROM twizzit_player_mappings tpm
WHERE p.id = tpm.local_player_id
  AND p.is_twizzit_registered = false;
