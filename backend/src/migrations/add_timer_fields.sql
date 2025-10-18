-- Add timer management fields to games table
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS current_period INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS period_duration INTERVAL DEFAULT '10 minutes',
ADD COLUMN IF NOT EXISTS time_remaining INTERVAL,
ADD COLUMN IF NOT EXISTS timer_state VARCHAR(20) DEFAULT 'stopped', -- stopped, running, paused
ADD COLUMN IF NOT EXISTS timer_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS timer_paused_at TIMESTAMP WITH TIME ZONE;

-- Add check constraint for valid periods (1-4 for korfball)
ALTER TABLE games 
ADD CONSTRAINT valid_period CHECK (current_period >= 1 AND current_period <= 4);

-- Add check constraint for valid timer states
ALTER TABLE games
ADD CONSTRAINT valid_timer_state CHECK (timer_state IN ('stopped', 'running', 'paused'));

-- Comment on new columns
COMMENT ON COLUMN games.current_period IS 'Current period of the game (1-4)';
COMMENT ON COLUMN games.period_duration IS 'Duration of each period (default 10 minutes)';
COMMENT ON COLUMN games.time_remaining IS 'Time remaining in current period (calculated when paused/stopped)';
COMMENT ON COLUMN games.timer_state IS 'Current state of the game timer: stopped, running, or paused';
COMMENT ON COLUMN games.timer_started_at IS 'Timestamp when timer was last started/resumed';
COMMENT ON COLUMN games.timer_paused_at IS 'Timestamp when timer was paused';
