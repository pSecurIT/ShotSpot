-- Seasons table for organizing games into seasons
CREATE TABLE IF NOT EXISTS seasons (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL, -- e.g., "2023-2024", "Spring 2024"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    season_type VARCHAR(20), -- indoor, outdoor, mixed
    is_active BOOLEAN DEFAULT false, -- Only one active season at a time
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date >= start_date),
    CHECK (season_type IN ('indoor', 'outdoor', 'mixed') OR season_type IS NULL)
);

COMMENT ON TABLE seasons IS 'Seasons for organizing games and tracking historical performance';
COMMENT ON COLUMN seasons.is_active IS 'Indicates the current active season. Only one season should be active at a time.';
COMMENT ON COLUMN seasons.season_type IS 'Type of season: indoor, outdoor, or mixed';

-- Add season_id to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS season_id INTEGER REFERENCES seasons(id) ON DELETE SET NULL;

-- Create indexes for seasons
CREATE INDEX IF NOT EXISTS idx_seasons_is_active ON seasons(is_active);
CREATE INDEX IF NOT EXISTS idx_seasons_dates ON seasons(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_games_season_id ON games(season_id);

-- Create updated_at trigger for seasons
CREATE TRIGGER update_seasons_updated_at
    BEFORE UPDATE ON seasons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
