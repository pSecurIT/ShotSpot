-- Add configuration fields for sets and possession tracking
-- number_of_periods: 1-10 periods (configurable per match)
-- Teams switch attacking sides every period
-- Track ball possessions to calculate attack duration and shots per attack

ALTER TABLE games
ADD COLUMN IF NOT EXISTS number_of_periods INTEGER DEFAULT 4 CHECK (number_of_periods >= 1 AND number_of_periods <= 10);

-- Update current_period constraint to support up to 10 periods
ALTER TABLE games
DROP CONSTRAINT IF EXISTS games_current_period_check;

ALTER TABLE games
ADD CONSTRAINT games_current_period_check CHECK (current_period >= 1 AND current_period <= 10);

-- Add comment
COMMENT ON COLUMN games.number_of_periods IS 
'Number of periods in the game. Configurable from 1-10. Teams switch sides every period.';

-- Create table for tracking ball possessions
CREATE TABLE IF NOT EXISTS ball_possessions (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    period INTEGER NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    shots_taken INTEGER DEFAULT 0,
    result VARCHAR(20), -- goal, turnover, out_of_bounds, timeout, period_end
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_ball_possessions_game_id ON ball_possessions(game_id);
CREATE INDEX IF NOT EXISTS idx_ball_possessions_team_id ON ball_possessions(team_id);

COMMENT ON TABLE ball_possessions IS 
'Tracks ball possessions to measure attack duration and shots per attack. A possession starts when ball crosses center line and ends on goal, turnover, or stoppage.';
