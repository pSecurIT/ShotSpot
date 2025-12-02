-- ============================================================================
-- Migration: Add Match Templates
-- Description: Create match_templates table for saving common match configurations
-- ============================================================================

-- Match Templates table for saving common match configurations
CREATE TABLE IF NOT EXISTS match_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Match configuration
    number_of_periods INTEGER DEFAULT 4 CHECK (number_of_periods >= 1 AND number_of_periods <= 10),
    period_duration_minutes INTEGER DEFAULT 10 CHECK (period_duration_minutes >= 1 AND period_duration_minutes <= 60),
    overtime_enabled BOOLEAN DEFAULT false,
    overtime_period_duration_minutes INTEGER DEFAULT 5 CHECK (overtime_period_duration_minutes >= 1 AND overtime_period_duration_minutes <= 30),
    max_overtime_periods INTEGER DEFAULT 2 CHECK (max_overtime_periods >= 1 AND max_overtime_periods <= 10),
    
    -- Golden goal option for overtime
    golden_goal_overtime BOOLEAN DEFAULT false,
    
    -- Competition type hints
    competition_type VARCHAR(50), -- e.g., 'league', 'cup', 'friendly', 'tournament'
    
    -- Ownership
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_system_template BOOLEAN DEFAULT false, -- System templates cannot be deleted by users
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for match_templates
CREATE INDEX IF NOT EXISTS idx_match_templates_name ON match_templates(name);
CREATE INDEX IF NOT EXISTS idx_match_templates_created_by ON match_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_match_templates_competition_type ON match_templates(competition_type);

COMMENT ON TABLE match_templates IS 'Match templates for saving common match configurations (periods, duration, overtime settings)';
COMMENT ON COLUMN match_templates.number_of_periods IS 'Number of regular periods in the match (1-10)';
COMMENT ON COLUMN match_templates.period_duration_minutes IS 'Duration of each regular period in minutes (1-60)';
COMMENT ON COLUMN match_templates.overtime_enabled IS 'Whether overtime periods are allowed when match is tied';
COMMENT ON COLUMN match_templates.overtime_period_duration_minutes IS 'Duration of each overtime period in minutes (1-30)';
COMMENT ON COLUMN match_templates.max_overtime_periods IS 'Maximum number of overtime periods allowed (1-10)';
COMMENT ON COLUMN match_templates.golden_goal_overtime IS 'If true, overtime ends immediately when a goal is scored';
COMMENT ON COLUMN match_templates.competition_type IS 'Type of competition: league, cup, friendly, tournament';
COMMENT ON COLUMN match_templates.is_system_template IS 'System templates are pre-defined and cannot be deleted by users';

-- Add overtime fields to games table
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS overtime_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS overtime_period_duration INTERVAL DEFAULT '5 minutes',
ADD COLUMN IF NOT EXISTS max_overtime_periods INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS golden_goal_overtime BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_overtime BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS overtime_period_number INTEGER DEFAULT 0;

-- Update existing constraints for games table to support overtime
ALTER TABLE games
DROP CONSTRAINT IF EXISTS games_current_period_check;

-- Add new constraint that allows for regular periods plus overtime
-- current_period can be 1-10 for regular periods, 11-20 for overtime periods
ALTER TABLE games
ADD CONSTRAINT games_current_period_check 
CHECK (current_period >= 1 AND current_period <= 20);

COMMENT ON COLUMN games.overtime_enabled IS 'Whether overtime periods are enabled for this game';
COMMENT ON COLUMN games.overtime_period_duration IS 'Duration of each overtime period (different from regular period_duration)';
COMMENT ON COLUMN games.max_overtime_periods IS 'Maximum number of overtime periods allowed';
COMMENT ON COLUMN games.golden_goal_overtime IS 'If true, game ends immediately when a goal is scored in overtime';
COMMENT ON COLUMN games.is_overtime IS 'True when the game is currently in overtime';
COMMENT ON COLUMN games.overtime_period_number IS 'Current overtime period number (1, 2, etc.) when in overtime';

-- Insert default system templates
INSERT INTO match_templates (name, description, number_of_periods, period_duration_minutes, overtime_enabled, overtime_period_duration_minutes, max_overtime_periods, golden_goal_overtime, competition_type, is_system_template)
VALUES 
    ('Standard League Match', 'Standard korfball league match with 4 periods of 10 minutes each', 4, 10, false, 5, 2, false, 'league', true),
    ('Cup Match with Overtime', 'Cup match with 4 periods of 10 minutes plus overtime (up to 2 periods of 5 minutes each)', 4, 10, true, 5, 2, false, 'cup', true),
    ('Cup Match Golden Goal', 'Cup match with golden goal overtime', 4, 10, true, 5, 2, true, 'cup', true),
    ('Tournament Short Match', 'Short format for tournaments (2 periods of 7 minutes)', 2, 7, false, 3, 2, false, 'tournament', true),
    ('Friendly Match', 'Flexible friendly match (2 periods of 15 minutes)', 2, 15, false, 5, 1, false, 'friendly', true),
    ('Youth Match', 'Youth match with shorter periods (4 periods of 7 minutes)', 4, 7, false, 5, 1, false, 'league', true),
    ('Indoor League Match', 'Indoor korfball league match (4 periods of 8 minutes)', 4, 8, false, 4, 2, false, 'league', true)
ON CONFLICT DO NOTHING;
