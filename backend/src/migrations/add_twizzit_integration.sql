-- Twizzit Integration Schema
-- Purpose: Enable synchronization with Twizzit (KBKB member management system)
-- Tables: twizzit_config, twizzit_sync_log, twizzit_player_mapping, twizzit_team_mapping, twizzit_sync_conflicts

-- =====================================================
-- Configuration table - stores Twizzit API credentials and sync settings
-- =====================================================
CREATE TABLE IF NOT EXISTS twizzit_config (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL UNIQUE,
  organization_name VARCHAR(255),
  api_username VARCHAR(255) NOT NULL,
  api_password_encrypted TEXT NOT NULL,
  jwt_token TEXT,
  token_expires_at TIMESTAMP,
  sync_enabled BOOLEAN DEFAULT false,
  auto_sync_frequency VARCHAR(20) DEFAULT 'manual' CHECK (auto_sync_frequency IN ('manual', 'hourly', 'daily', 'weekly')),
  last_sync_at TIMESTAMP,
  sync_in_progress BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE twizzit_config IS 'Stores Twizzit API configuration and credentials per organization';
COMMENT ON COLUMN twizzit_config.organization_id IS 'Twizzit organization ID from /v2/api/organizations';
COMMENT ON COLUMN twizzit_config.api_password_encrypted IS 'Encrypted password using AES-256-GCM';
COMMENT ON COLUMN twizzit_config.jwt_token IS 'Current JWT bearer token from /v2/api/authenticate';
COMMENT ON COLUMN twizzit_config.sync_in_progress IS 'Flag to prevent concurrent syncs';

-- =====================================================
-- Sync log table - audit trail for all sync operations
-- =====================================================
CREATE TABLE IF NOT EXISTS twizzit_sync_log (
  id SERIAL PRIMARY KEY,
  config_id INTEGER REFERENCES twizzit_config(id) ON DELETE CASCADE,
  sync_type VARCHAR(50) NOT NULL CHECK (sync_type IN ('players', 'teams', 'rosters', 'full', 'organizations', 'seasons')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'success', 'failed', 'partial')),
  records_fetched INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  errors JSONB,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_ms INTEGER
);

CREATE INDEX idx_twizzit_sync_log_config ON twizzit_sync_log(config_id);
CREATE INDEX idx_twizzit_sync_log_status ON twizzit_sync_log(status) WHERE status = 'running';
CREATE INDEX idx_twizzit_sync_log_started ON twizzit_sync_log(started_at DESC);

COMMENT ON TABLE twizzit_sync_log IS 'Audit trail for all Twizzit synchronization operations';
COMMENT ON COLUMN twizzit_sync_log.errors IS 'JSON array of error messages: [{"entity": "player", "id": 123, "error": "..."}]';
COMMENT ON COLUMN twizzit_sync_log.duration_ms IS 'Sync duration in milliseconds';

-- =====================================================
-- Player mapping table - links Twizzit contacts to ShotSpot players
-- =====================================================
CREATE TABLE IF NOT EXISTS twizzit_player_mapping (
  id SERIAL PRIMARY KEY,
  shotspot_player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  twizzit_contact_id INTEGER NOT NULL,
  organization_id INTEGER NOT NULL,
  last_synced_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(twizzit_contact_id, organization_id)
);

CREATE INDEX idx_twizzit_player_mapping_contact ON twizzit_player_mapping(twizzit_contact_id, organization_id);
CREATE INDEX idx_twizzit_player_mapping_player ON twizzit_player_mapping(shotspot_player_id);

COMMENT ON TABLE twizzit_player_mapping IS 'Maps Twizzit contact IDs to ShotSpot player IDs';
COMMENT ON COLUMN twizzit_player_mapping.twizzit_contact_id IS 'Contact ID from Twizzit /v2/api/contacts';
COMMENT ON COLUMN twizzit_player_mapping.organization_id IS 'Twizzit organization ID for multi-org support';

-- =====================================================
-- Team mapping table - links Twizzit groups to ShotSpot teams
-- =====================================================
CREATE TABLE IF NOT EXISTS twizzit_team_mapping (
  id SERIAL PRIMARY KEY,
  shotspot_team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  twizzit_group_id INTEGER NOT NULL,
  organization_id INTEGER NOT NULL,
  season_id INTEGER,
  season_name VARCHAR(255),
  last_synced_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(twizzit_group_id, organization_id, season_id)
);

CREATE INDEX idx_twizzit_team_mapping_group ON twizzit_team_mapping(twizzit_group_id, organization_id);
CREATE INDEX idx_twizzit_team_mapping_team ON twizzit_team_mapping(shotspot_team_id);
CREATE INDEX idx_twizzit_team_mapping_season ON twizzit_team_mapping(season_id);

COMMENT ON TABLE twizzit_team_mapping IS 'Maps Twizzit group IDs to ShotSpot team IDs';
COMMENT ON COLUMN twizzit_team_mapping.twizzit_group_id IS 'Group ID from Twizzit /v2/api/groups';
COMMENT ON COLUMN twizzit_team_mapping.season_id IS 'Twizzit season ID for tracking team per season';

-- =====================================================
-- Sync conflicts table - tracks data conflicts requiring manual resolution
-- =====================================================
CREATE TABLE IF NOT EXISTS twizzit_sync_conflicts (
  id SERIAL PRIMARY KEY,
  config_id INTEGER REFERENCES twizzit_config(id) ON DELETE CASCADE,
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('player', 'team', 'roster')),
  shotspot_id INTEGER NOT NULL,
  twizzit_id INTEGER NOT NULL,
  conflict_type VARCHAR(50) NOT NULL CHECK (conflict_type IN ('duplicate', 'data_mismatch', 'deleted_in_twizzit', 'deleted_in_shotspot')),
  shotspot_data JSONB,
  twizzit_data JSONB,
  resolution VARCHAR(20) DEFAULT 'pending' CHECK (resolution IN ('pending', 'twizzit_wins', 'shotspot_wins', 'manual', 'ignored')),
  resolved_by INTEGER REFERENCES users(id),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_twizzit_conflicts_config ON twizzit_sync_conflicts(config_id);
CREATE INDEX idx_twizzit_conflicts_pending ON twizzit_sync_conflicts(config_id, resolution) WHERE resolution = 'pending';
CREATE INDEX idx_twizzit_conflicts_entity ON twizzit_sync_conflicts(entity_type, shotspot_id);

COMMENT ON TABLE twizzit_sync_conflicts IS 'Tracks synchronization conflicts requiring manual resolution';
COMMENT ON COLUMN twizzit_sync_conflicts.shotspot_data IS 'Current data in ShotSpot at time of conflict';
COMMENT ON COLUMN twizzit_sync_conflicts.twizzit_data IS 'Incoming data from Twizzit at time of conflict';
COMMENT ON COLUMN twizzit_sync_conflicts.resolved_by IS 'User ID who resolved the conflict';

-- =====================================================
-- Add sync metadata columns to existing tables
-- =====================================================

-- Add sync source tracking to players table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'players' AND column_name = 'sync_source') THEN
    ALTER TABLE players ADD COLUMN sync_source VARCHAR(20) DEFAULT 'manual' CHECK (sync_source IN ('manual', 'twizzit'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'players' AND column_name = 'last_synced_at') THEN
    ALTER TABLE players ADD COLUMN last_synced_at TIMESTAMP;
  END IF;
END $$;

COMMENT ON COLUMN players.sync_source IS 'Source of player data: manual (created in ShotSpot) or twizzit (synced from Twizzit)';
COMMENT ON COLUMN players.last_synced_at IS 'Timestamp of last sync from Twizzit (NULL for manual entries)';

-- Add sync source tracking to teams table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'teams' AND column_name = 'sync_source') THEN
    ALTER TABLE teams ADD COLUMN sync_source VARCHAR(20) DEFAULT 'manual' CHECK (sync_source IN ('manual', 'twizzit'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'teams' AND column_name = 'last_synced_at') THEN
    ALTER TABLE teams ADD COLUMN last_synced_at TIMESTAMP;
  END IF;
END $$;

COMMENT ON COLUMN teams.sync_source IS 'Source of team data: manual (created in ShotSpot) or twizzit (synced from Twizzit)';
COMMENT ON COLUMN teams.last_synced_at IS 'Timestamp of last sync from Twizzit (NULL for manual entries)';

-- =====================================================
-- Create indexes for performance optimization
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_players_sync_source ON players(sync_source) WHERE sync_source = 'twizzit';
CREATE INDEX IF NOT EXISTS idx_teams_sync_source ON teams(sync_source) WHERE sync_source = 'twizzit';

-- =====================================================
-- Create trigger to update updated_at timestamp on twizzit_config
-- =====================================================
CREATE OR REPLACE FUNCTION update_twizzit_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_twizzit_config_updated_at ON twizzit_config;
CREATE TRIGGER trigger_update_twizzit_config_updated_at
  BEFORE UPDATE ON twizzit_config
  FOR EACH ROW
  EXECUTE FUNCTION update_twizzit_config_updated_at();

-- =====================================================
-- Insert default data (for development/testing)
-- =====================================================
-- Note: No default data inserted. Configuration created via API by admins.
