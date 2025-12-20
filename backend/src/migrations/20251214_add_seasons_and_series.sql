-- Migration: Add seasons and series tables

-- Create seasons table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'seasons'
    ) THEN
        CREATE TABLE seasons (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
    END IF;
END $$;

-- Create series table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'series'
    ) THEN
        CREATE TABLE series (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            level INT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
    END IF;
END $$;

-- Create matches table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'matches'
    ) THEN
        CREATE TABLE matches (
            id SERIAL PRIMARY KEY,
            home_club_id INT REFERENCES clubs(id) ON DELETE CASCADE,
            away_club_id INT REFERENCES clubs(id) ON DELETE CASCADE,
            season_id INT REFERENCES seasons(id),
            series_id INT REFERENCES series(id),
            match_date TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
    END IF;
END $$;

-- Update matches table to include season_id and series_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'matches' AND column_name = 'season_id'
    ) THEN
        ALTER TABLE matches ADD COLUMN season_id INT REFERENCES seasons(id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'matches' AND column_name = 'series_id'
    ) THEN
        ALTER TABLE matches ADD COLUMN series_id INT REFERENCES series(id);
    END IF;
END $$;

-- Update teams table to include club_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'teams' AND column_name = 'club_id'
    ) THEN
        ALTER TABLE teams ADD COLUMN club_id INT REFERENCES clubs(id);
    END IF;
END $$;