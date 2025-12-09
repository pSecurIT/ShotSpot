-- Twizzit Integration Schema
-- Stores encrypted API credentials, sync status, and data mappings for Belgian Korfball Federation integration

-- Twizzit API Credentials (encrypted)
CREATE TABLE IF NOT EXISTS twizzit_credentials (
    id SERIAL PRIMARY KEY,
    organization_name VARCHAR(255) NOT NULL,
    api_username VARCHAR(255) NOT NULL,
    encrypted_password TEXT NOT NULL,
    encryption_iv TEXT NOT NULL,
    api_endpoint VARCHAR(500) NOT NULL DEFAULT 'https://api.twizzit.com/v1',
    is_active BOOLEAN DEFAULT true,
    last_verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_name)
);

-- Twizzit Sync Configuration
CREATE TABLE IF NOT EXISTS twizzit_sync_config (
    id SERIAL PRIMARY KEY,
    credential_id INTEGER REFERENCES twizzit_credentials(id) ON DELETE CASCADE,
    sync_teams BOOLEAN DEFAULT true,
    sync_players BOOLEAN DEFAULT true,
    sync_competitions BOOLEAN DEFAULT true,
    sync_interval_minutes INTEGER DEFAULT 60,
    auto_sync_enabled BOOLEAN DEFAULT false,
    last_sync_at TIMESTAMP,
    next_sync_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(credential_id)
);

-- Twizzit Team Mapping (links local teams to Twizzit teams)
CREATE TABLE IF NOT EXISTS twizzit_team_mappings (
    id SERIAL PRIMARY KEY,
    local_team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    twizzit_team_id VARCHAR(100) NOT NULL,
    twizzit_team_name VARCHAR(255),
    last_synced_at TIMESTAMP,
    sync_status VARCHAR(50) DEFAULT 'pending',
    sync_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(local_team_id),
    UNIQUE(twizzit_team_id)
);

-- Twizzit Player Mapping (links local players to Twizzit players)
CREATE TABLE IF NOT EXISTS twizzit_player_mappings (
    id SERIAL PRIMARY KEY,
    local_player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    twizzit_player_id VARCHAR(100) NOT NULL,
    twizzit_player_name VARCHAR(255),
    team_mapping_id INTEGER REFERENCES twizzit_team_mappings(id) ON DELETE CASCADE,
    last_synced_at TIMESTAMP,
    sync_status VARCHAR(50) DEFAULT 'pending',
    sync_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(local_player_id),
    UNIQUE(twizzit_player_id)
);

-- Twizzit Competition Mapping (links local competitions to Twizzit competitions)
CREATE TABLE IF NOT EXISTS twizzit_competition_mappings (
    id SERIAL PRIMARY KEY,
    local_competition_id INTEGER REFERENCES competitions(id) ON DELETE CASCADE,
    twizzit_competition_id VARCHAR(100) NOT NULL,
    twizzit_competition_name VARCHAR(255),
    season VARCHAR(50),
    last_synced_at TIMESTAMP,
    sync_status VARCHAR(50) DEFAULT 'pending',
    sync_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(local_competition_id),
    UNIQUE(twizzit_competition_id)
);

-- Twizzit Sync History (audit log of all sync operations)
CREATE TABLE IF NOT EXISTS twizzit_sync_history (
    id SERIAL PRIMARY KEY,
    credential_id INTEGER REFERENCES twizzit_credentials(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL,
    sync_direction VARCHAR(20) NOT NULL,
    status VARCHAR(50) NOT NULL,
    items_processed INTEGER DEFAULT 0,
    items_succeeded INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_twizzit_team_mappings_local_team ON twizzit_team_mappings(local_team_id);
CREATE INDEX IF NOT EXISTS idx_twizzit_team_mappings_twizzit_team ON twizzit_team_mappings(twizzit_team_id);
CREATE INDEX IF NOT EXISTS idx_twizzit_player_mappings_local_player ON twizzit_player_mappings(local_player_id);
CREATE INDEX IF NOT EXISTS idx_twizzit_player_mappings_twizzit_player ON twizzit_player_mappings(twizzit_player_id);
CREATE INDEX IF NOT EXISTS idx_twizzit_player_mappings_team_mapping ON twizzit_player_mappings(team_mapping_id);
CREATE INDEX IF NOT EXISTS idx_twizzit_competition_mappings_local_competition ON twizzit_competition_mappings(local_competition_id);
CREATE INDEX IF NOT EXISTS idx_twizzit_sync_history_credential ON twizzit_sync_history(credential_id);
CREATE INDEX IF NOT EXISTS idx_twizzit_sync_history_started_at ON twizzit_sync_history(started_at DESC);
