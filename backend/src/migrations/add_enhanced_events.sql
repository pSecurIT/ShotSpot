-- Migration: Add Enhanced Match Events Support
-- Description: Extend event types to support faults, free shots, timeouts, and match commentary

-- Add additional event types to the existing game_events table
-- The current table already supports: foul, substitution, timeout, period_start, period_end
-- We're extending to support more granular event types for enhanced match tracking

-- Note: We're not modifying the existing table structure as it's already flexible with JSONB details column
-- Instead, we'll extend the validation in the application layer for new event types:

-- New event types to be supported:
-- 1. fault_offensive - Offensive fault by a player
-- 2. fault_defensive - Defensive fault by a player  
-- 3. fault_out_of_bounds - Ball out of bounds
-- 4. free_shot - Free shot/penalty shot
-- 5. timeout_team - Team timeout
-- 6. timeout_injury - Injury timeout
-- 7. timeout_official - Official timeout
-- 8. match_commentary - Timestamped match notes

-- Create a dedicated table for free shots to track more detailed information
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'free_shots'
    ) THEN
        CREATE TABLE free_shots (
            id SERIAL PRIMARY KEY,
            game_id INTEGER REFERENCES games(id) ON DELETE CASCADE NOT NULL,
            player_id INTEGER REFERENCES players(id) ON DELETE CASCADE NOT NULL,
            club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
            period INTEGER NOT NULL,
            time_remaining INTERVAL,
            free_shot_type VARCHAR(50) NOT NULL, -- free_shot, penalty
            reason VARCHAR(100), -- What caused the free shot
            x_coord DECIMAL, -- Shot location (optional for penalties)
            y_coord DECIMAL, -- Shot location (optional for penalties)
            result VARCHAR(20) NOT NULL, -- goal, miss, blocked
            distance DECIMAL, -- Distance to korf
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            CHECK (free_shot_type IN ('free_shot', 'penalty')),
            CHECK (result IN ('goal', 'miss', 'blocked'))
        );
    END IF;
END $$;

COMMENT ON TABLE free_shots IS 'Detailed tracking of free shots and penalty shots in korfball';
COMMENT ON COLUMN free_shots.free_shot_type IS 'Type of shot: free_shot (awarded for rule violations) or penalty (serious infractions, closer to post)';
COMMENT ON COLUMN free_shots.reason IS 'What caused the free shot/penalty to be awarded';

-- Create indexes for free shots
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_free_shots_game_id'
    ) THEN
        CREATE INDEX idx_free_shots_game_id ON free_shots(game_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_free_shots_club_id'
    ) THEN
        CREATE INDEX idx_free_shots_club_id ON free_shots(club_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_free_shots_player_id'
    ) THEN
        CREATE INDEX idx_free_shots_player_id ON free_shots(player_id);
    END IF;
END $$;

-- Create a dedicated table for timeout management with more detailed tracking
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'timeouts'
    ) THEN
        CREATE TABLE timeouts (
            id SERIAL PRIMARY KEY,
            game_id INTEGER REFERENCES games(id) ON DELETE CASCADE NOT NULL,
            club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE, -- NULL for official timeouts
            timeout_type VARCHAR(50) NOT NULL, -- team, injury, official, tv
            period INTEGER NOT NULL,
            time_remaining INTERVAL,
            duration INTERVAL DEFAULT '1 minute', -- How long the timeout lasted
            reason VARCHAR(200), -- Optional reason/notes
            called_by VARCHAR(100), -- Who called the timeout (coach name, referee, etc.)
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            ended_at TIMESTAMP WITH TIME ZONE, -- When timeout ended
            CHECK (timeout_type IN ('team', 'injury', 'official', 'tv'))
        );
    END IF;
END $$;

COMMENT ON TABLE timeouts IS 'Detailed timeout tracking including team, injury, and official timeouts';
COMMENT ON COLUMN timeouts.timeout_type IS 'Type of timeout: team (tactical), injury, official (referee), tv (television)';
COMMENT ON COLUMN timeouts.club_id IS 'Club that called timeout (NULL for official/tv timeouts)';
COMMENT ON COLUMN timeouts.called_by IS 'Person who called the timeout (coach name, referee, etc.)';

-- Create indexes for timeouts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_timeouts_game_id'
    ) THEN
        CREATE INDEX idx_timeouts_game_id ON timeouts(game_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_timeouts_club_id'
    ) THEN
        CREATE INDEX idx_timeouts_club_id ON timeouts(club_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_timeouts_type'
    ) THEN
        CREATE INDEX idx_timeouts_type ON timeouts(timeout_type);
    END IF;
END $$;

-- Create a dedicated table for match commentary and notes
CREATE TABLE IF NOT EXISTS match_commentary (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    period INTEGER NOT NULL,
    time_remaining INTERVAL,
    commentary_type VARCHAR(50) NOT NULL, -- note, highlight, injury, weather, technical
    title VARCHAR(100), -- Brief title/summary
    content TEXT NOT NULL, -- The actual commentary/note
    created_by INTEGER REFERENCES users(id), -- User who added the commentary
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (commentary_type IN ('note', 'highlight', 'injury', 'weather', 'technical'))
);

COMMENT ON TABLE match_commentary IS 'Timestamped commentary and notes during matches';
COMMENT ON COLUMN match_commentary.commentary_type IS 'Type of commentary: note (general), highlight (key moment), injury, weather (conditions), technical (rule clarification)';

-- Create indexes for match commentary
CREATE INDEX IF NOT EXISTS idx_match_commentary_game_id ON match_commentary(game_id);
CREATE INDEX IF NOT EXISTS idx_match_commentary_type ON match_commentary(commentary_type);
CREATE INDEX IF NOT EXISTS idx_match_commentary_created_by ON match_commentary(created_by);

-- Create trigger for updated_at on match_commentary
CREATE TRIGGER update_match_commentary_updated_at
    BEFORE UPDATE ON match_commentary
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create a view to get comprehensive match events including new types
CREATE OR REPLACE VIEW comprehensive_match_events AS
SELECT 
    'game_event' as source_table,
    ge.id,
    ge.game_id,
    ge.event_type as type,
    ge.club_id,
    ge.player_id,
    ge.period,
    ge.time_remaining,
    ge.details,
    ge.created_at,
    t.name as team_name,
    p.first_name,
    p.last_name,
    p.jersey_number,
    NULL::jsonb as specific_details
FROM game_events ge
JOIN teams t ON ge.club_id = t.id
LEFT JOIN players p ON ge.player_id = p.id

UNION ALL

SELECT 
    'free_shot' as source_table,
    fs.id,
    fs.game_id,
    CONCAT('free_shot_', fs.free_shot_type) as type,
    fs.club_id,
    fs.player_id,
    fs.period,
    fs.time_remaining,
    jsonb_build_object(
        'result', fs.result,
        'reason', fs.reason,
        'x_coord', fs.x_coord,
        'y_coord', fs.y_coord,
        'distance', fs.distance
    ) as details,
    fs.created_at,
    t.name as team_name,
    p.first_name,
    p.last_name,
    p.jersey_number,
    jsonb_build_object(
        'free_shot_type', fs.free_shot_type,
        'result', fs.result,
        'distance', fs.distance
    ) as specific_details
FROM free_shots fs
JOIN teams t ON fs.club_id = t.id
JOIN players p ON fs.player_id = p.id

UNION ALL

SELECT 
    'timeout' as source_table,
    to1.id,
    to1.game_id,
    CONCAT('timeout_', to1.timeout_type) as type,
    to1.club_id,
    NULL as player_id,
    to1.period,
    to1.time_remaining,
    jsonb_build_object(
        'duration', to1.duration,
        'reason', to1.reason,
        'called_by', to1.called_by,
        'ended_at', to1.ended_at
    ) as details,
    to1.created_at,
    t.name as team_name,
    NULL as first_name,
    NULL as last_name,
    NULL as jersey_number,
    jsonb_build_object(
        'timeout_type', to1.timeout_type,
        'duration', to1.duration,
        'called_by', to1.called_by
    ) as specific_details
FROM timeouts to1
LEFT JOIN teams t ON to1.club_id = t.id

UNION ALL

SELECT 
    'commentary' as source_table,
    mc.id,
    mc.game_id,
    CONCAT('commentary_', mc.commentary_type) as type,
    NULL as club_id,
    NULL as player_id,
    mc.period,
    mc.time_remaining,
    jsonb_build_object(
        'title', mc.title,
        'content', mc.content,
        'created_by', mc.created_by
    ) as details,
    mc.created_at,
    NULL as team_name,
    NULL as first_name,
    NULL as last_name,
    NULL as jersey_number,
    jsonb_build_object(
        'commentary_type', mc.commentary_type,
        'title', mc.title,
        'content', mc.content
    ) as specific_details
FROM match_commentary mc

ORDER BY created_at DESC;

COMMENT ON VIEW comprehensive_match_events IS 'Unified view of all match events from different tables for easy querying and timeline display';

-- Migration: Add enhanced events
-- This migration adds additional columns to the events table for advanced analytics
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'events'
    ) THEN
        CREATE TABLE events (
            id SERIAL PRIMARY KEY,
            game_id INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
            event_type VARCHAR(255) NOT NULL,
            timestamp TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'club_id'
    ) THEN
        ALTER TABLE events ADD COLUMN club_id INT REFERENCES clubs(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'team_id'
    ) THEN
        ALTER TABLE events DROP COLUMN team_id;
    END IF;
END $$;