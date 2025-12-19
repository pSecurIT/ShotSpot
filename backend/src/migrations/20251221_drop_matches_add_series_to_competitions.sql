-- Drop unused matches table and link competitions to series (divisions)
-- Series represent Belgian korfball division levels (e.g., Eerste Klasse, Tweede Klasse)

-- Drop matches table (was never used in codebase)
DROP TABLE IF EXISTS matches CASCADE;

-- Add series_id to competitions table to link competitions to division levels
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'competitions' AND column_name = 'series_id'
    ) THEN
        ALTER TABLE competitions ADD COLUMN series_id INTEGER REFERENCES series(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_competitions_series_id ON competitions(series_id);
    END IF;
END $$;

COMMENT ON COLUMN competitions.series_id IS 'Links competition to a division level (e.g., Eerste Klasse, Tweede Klasse) for Belgian korfball league structure';

-- Update series table comments for clarity
COMMENT ON TABLE series IS 'Belgian korfball division levels (e.g., Eerste Klasse, Tweede Klasse). Used for league hierarchy and promotion/relegation tracking';
COMMENT ON COLUMN series.name IS 'Division name (e.g., "Eerste Klasse", "Tweede Klasse", "Derde Klasse")';
COMMENT ON COLUMN series.level IS 'Numeric level for hierarchy (1 = highest division, 2 = second highest, etc.)';
