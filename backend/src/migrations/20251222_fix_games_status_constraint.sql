-- Fix games status constraint to include all valid status values
-- The original constraint only allowed: 'scheduled', 'completed', 'cancelled'
-- But the application also uses: 'to_reschedule', 'in_progress'

-- Drop the old constraint if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'games_status_check'
    ) THEN
        ALTER TABLE games DROP CONSTRAINT games_status_check;
    END IF;
END $$;

-- Add the updated constraint with all valid status values
ALTER TABLE games 
ADD CONSTRAINT games_status_check 
CHECK (status IN ('scheduled', 'to_reschedule', 'in_progress', 'completed', 'cancelled'));

COMMENT ON CONSTRAINT games_status_check ON games IS 
'Valid game statuses: scheduled (planned), to_reschedule (needs new date), in_progress (currently playing), completed (finished), cancelled (not played)';
