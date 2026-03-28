-- Add region assignment for Belgian series/divisions management
ALTER TABLE series
ADD COLUMN IF NOT EXISTS region VARCHAR(100);

COMMENT ON COLUMN series.region IS 'Optional region assignment (e.g., National, Flanders, Wallonia, Brussels, Provincial)';

CREATE INDEX IF NOT EXISTS idx_series_region ON series(region);
