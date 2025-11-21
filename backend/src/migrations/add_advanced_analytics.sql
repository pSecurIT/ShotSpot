-- Advanced Analytics Features Migration
-- Adds support for video integration, performance predictions, and benchmarking

-- Video Events table - links game events to video timestamps
CREATE TABLE IF NOT EXISTS video_events (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- 'shot', 'goal', 'substitution', 'timeout', 'foul', etc.
    event_id INTEGER, -- Reference to the specific event (shot_id, substitution_id, etc.)
    video_url TEXT, -- URL or path to video file
    timestamp_start INTEGER NOT NULL, -- Video timestamp in seconds
    timestamp_end INTEGER, -- End timestamp for clips (optional)
    description TEXT,
    is_highlight BOOLEAN DEFAULT false, -- Mark as highlight for reel generation
    tags TEXT[], -- Array of tags for categorization
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE video_events IS 'Links game events to video timestamps for video integration and highlight reel generation';
COMMENT ON COLUMN video_events.event_type IS 'Type of event: shot, goal, substitution, timeout, foul, etc.';
COMMENT ON COLUMN video_events.event_id IS 'Reference to specific event ID in related table';
COMMENT ON COLUMN video_events.timestamp_start IS 'Video timestamp in seconds where event starts';
COMMENT ON COLUMN video_events.is_highlight IS 'Mark as highlight for automatic reel generation';
COMMENT ON COLUMN video_events.tags IS 'Array of tags for categorization and filtering';

-- Create indexes for video events
CREATE INDEX IF NOT EXISTS idx_video_events_game_id ON video_events(game_id);
CREATE INDEX IF NOT EXISTS idx_video_events_event_type ON video_events(event_type);
CREATE INDEX IF NOT EXISTS idx_video_events_is_highlight ON video_events(is_highlight);

-- Player Performance Predictions table - stores AI-based predictions
CREATE TABLE IF NOT EXISTS player_predictions (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE, -- NULL for general predictions
    prediction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    prediction_type VARCHAR(50) NOT NULL, -- 'next_game', 'form_trend', 'fatigue'
    predicted_fg_percentage DECIMAL(5,2),
    predicted_goals INTEGER,
    predicted_shots INTEGER,
    confidence_score DECIMAL(5,2), -- 0-100 confidence level
    form_trend VARCHAR(20), -- 'improving', 'declining', 'stable', 'hot', 'cold'
    fatigue_level VARCHAR(20), -- 'fresh', 'normal', 'tired', 'exhausted'
    factors JSONB, -- Store contributing factors (recent games, play time, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE player_predictions IS 'Stores AI-based predictions for player performance';
COMMENT ON COLUMN player_predictions.prediction_type IS 'Type: next_game, form_trend, or fatigue';
COMMENT ON COLUMN player_predictions.confidence_score IS 'Prediction confidence level (0-100)';
COMMENT ON COLUMN player_predictions.form_trend IS 'Player form trend: improving, declining, stable, hot, cold';
COMMENT ON COLUMN player_predictions.fatigue_level IS 'Fatigue indicator: fresh, normal, tired, exhausted';
COMMENT ON COLUMN player_predictions.factors IS 'JSON object with contributing factors';

-- Create indexes for player predictions
CREATE INDEX IF NOT EXISTS idx_player_predictions_player_id ON player_predictions(player_id);
CREATE INDEX IF NOT EXISTS idx_player_predictions_game_id ON player_predictions(game_id);
CREATE INDEX IF NOT EXISTS idx_player_predictions_type ON player_predictions(prediction_type);
CREATE INDEX IF NOT EXISTS idx_player_predictions_date ON player_predictions(prediction_date);

-- Competition Benchmarks table - stores league/competition averages
CREATE TABLE IF NOT EXISTS competition_benchmarks (
    id SERIAL PRIMARY KEY,
    competition_name VARCHAR(100) NOT NULL,
    season VARCHAR(20), -- '2023-2024', '2024', etc.
    position VARCHAR(20), -- 'offense', 'defense', 'all'
    benchmark_type VARCHAR(50) NOT NULL, -- 'avg_fg_percentage', 'avg_goals_per_game', etc.
    benchmark_value DECIMAL(10,2) NOT NULL,
    sample_size INTEGER, -- Number of games/players in calculation
    calculation_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB, -- Additional context (age group, skill level, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE competition_benchmarks IS 'Stores league and competition average statistics for benchmarking';
COMMENT ON COLUMN competition_benchmarks.position IS 'Player position: offense, defense, or all';
COMMENT ON COLUMN competition_benchmarks.benchmark_type IS 'Type of benchmark metric';
COMMENT ON COLUMN competition_benchmarks.sample_size IS 'Number of data points in calculation';
COMMENT ON COLUMN competition_benchmarks.metadata IS 'Additional context like age group, skill level, etc.';

-- Create indexes for competition benchmarks
CREATE INDEX IF NOT EXISTS idx_benchmarks_competition ON competition_benchmarks(competition_name);
CREATE INDEX IF NOT EXISTS idx_benchmarks_season ON competition_benchmarks(season);
CREATE INDEX IF NOT EXISTS idx_benchmarks_position ON competition_benchmarks(position);
CREATE INDEX IF NOT EXISTS idx_benchmarks_type ON competition_benchmarks(benchmark_type);

-- Historical Performance table - stores historical averages for comparison
CREATE TABLE IF NOT EXISTS historical_performance (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(20) NOT NULL, -- 'player', 'team'
    entity_id INTEGER NOT NULL, -- player_id or team_id
    time_period VARCHAR(50) NOT NULL, -- 'season_2023', 'last_30_days', 'career', etc.
    games_played INTEGER NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- 'fg_percentage', 'goals_per_game', 'avg_distance', etc.
    metric_value DECIMAL(10,2) NOT NULL,
    calculation_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB, -- Additional stats and context
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE historical_performance IS 'Stores historical performance metrics for players and teams';
COMMENT ON COLUMN historical_performance.entity_type IS 'Type of entity: player or team';
COMMENT ON COLUMN historical_performance.entity_id IS 'ID of player or team';
COMMENT ON COLUMN historical_performance.time_period IS 'Time period for calculation (season, days, career, etc.)';
COMMENT ON COLUMN historical_performance.metric_type IS 'Type of performance metric';
COMMENT ON COLUMN historical_performance.metadata IS 'Additional statistics and context';

-- Create indexes for historical performance
CREATE INDEX IF NOT EXISTS idx_historical_entity ON historical_performance(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_historical_period ON historical_performance(time_period);
CREATE INDEX IF NOT EXISTS idx_historical_metric ON historical_performance(metric_type);

-- Create updated_at trigger for video_events
CREATE TRIGGER update_video_events_updated_at
    BEFORE UPDATE ON video_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create updated_at trigger for competition_benchmarks
CREATE TRIGGER update_competition_benchmarks_updated_at
    BEFORE UPDATE ON competition_benchmarks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create updated_at trigger for historical_performance
CREATE TRIGGER update_historical_performance_updated_at
    BEFORE UPDATE ON historical_performance
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
