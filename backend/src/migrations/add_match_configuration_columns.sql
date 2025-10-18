-- Migration: Add match configuration columns to games table
-- This migration adds columns needed for pre-match setup:
-- - home_attacking_side: Which korf the home team attacks initially
-- - number_of_periods: How many periods in the match (1-10)
-- - current_period: Which period the game is currently in
-- - period_duration: How long each period lasts
-- - time_remaining: Time left in current period
-- - timer_state: Whether timer is stopped, running, or paused
-- - timer_started_at: When the timer was started
-- - timer_paused_at: When the timer was paused

-- Add home_attacking_side column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'home_attacking_side'
    ) THEN
        ALTER TABLE games ADD COLUMN home_attacking_side VARCHAR(10);
        ALTER TABLE games ADD CONSTRAINT check_home_attacking_side 
            CHECK (home_attacking_side IN ('left', 'right') OR home_attacking_side IS NULL);
    END IF;
END $$;

-- Add number_of_periods column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'number_of_periods'
    ) THEN
        ALTER TABLE games ADD COLUMN number_of_periods INTEGER DEFAULT 4;
        ALTER TABLE games ADD CONSTRAINT check_number_of_periods 
            CHECK (number_of_periods >= 1 AND number_of_periods <= 10);
    END IF;
END $$;

-- Add current_period column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'current_period'
    ) THEN
        ALTER TABLE games ADD COLUMN current_period INTEGER DEFAULT 1;
        ALTER TABLE games ADD CONSTRAINT check_current_period 
            CHECK (current_period >= 1 AND current_period <= 10);
    END IF;
END $$;

-- Add period_duration column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'period_duration'
    ) THEN
        ALTER TABLE games ADD COLUMN period_duration INTERVAL DEFAULT '10 minutes';
    END IF;
END $$;

-- Add time_remaining column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'time_remaining'
    ) THEN
        ALTER TABLE games ADD COLUMN time_remaining INTERVAL;
    END IF;
END $$;

-- Add timer_state column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'timer_state'
    ) THEN
        ALTER TABLE games ADD COLUMN timer_state VARCHAR(20) DEFAULT 'stopped';
        ALTER TABLE games ADD CONSTRAINT check_timer_state 
            CHECK (timer_state IN ('stopped', 'running', 'paused'));
    END IF;
END $$;

-- Add timer_started_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'timer_started_at'
    ) THEN
        ALTER TABLE games ADD COLUMN timer_started_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add timer_paused_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'timer_paused_at'
    ) THEN
        ALTER TABLE games ADD COLUMN timer_paused_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Verify the migration
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'games' 
AND column_name IN (
    'home_attacking_side', 
    'number_of_periods', 
    'current_period',
    'period_duration',
    'time_remaining',
    'timer_state',
    'timer_started_at',
    'timer_paused_at'
)
ORDER BY column_name;
