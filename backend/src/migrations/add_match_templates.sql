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

COMMENT ON TABLE match_templates IS 'Match templates for saving common match configurations (periods, duration)';
COMMENT ON COLUMN match_templates.number_of_periods IS 'Number of periods in the match (1-10)';
COMMENT ON COLUMN match_templates.period_duration_minutes IS 'Duration of each period in minutes (1-60)';
COMMENT ON COLUMN match_templates.competition_type IS 'Type of competition: league, cup, friendly, tournament';
COMMENT ON COLUMN match_templates.is_system_template IS 'System templates are pre-defined and cannot be deleted by users';

-- Insert default system templates
INSERT INTO match_templates (name, description, number_of_periods, period_duration_minutes, competition_type, is_system_template)
VALUES 
    ('Standard League Match', 'Standard korfball league match with 4 periods of 10 minutes each', 4, 10, 'league', true),
    ('Cup Match', 'Standard korfball cup match with 4 periods of 10 minutes each', 4, 10, 'cup', true),
    ('Tournament Short Match', 'Short format for tournaments (2 periods of 7 minutes)', 2, 7, 'tournament', true),
    ('Friendly Match', 'Flexible friendly match (2 periods of 15 minutes)', 2, 15, 'friendly', true),
    ('Youth Match', 'Youth match with shorter periods (4 periods of 7 minutes)', 4, 7, 'league', true),
    ('Indoor League Match', 'Indoor korfball league match (4 periods of 8 minutes)', 4, 8, 'league', true)
ON CONFLICT DO NOTHING;
