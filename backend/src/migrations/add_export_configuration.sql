-- Export Configuration & Templates Migration
-- This migration adds tables for managing report templates, export settings, and scheduled reports

-- Report Templates table
-- Stores both default and custom templates for generating reports
CREATE TABLE IF NOT EXISTS report_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'summary', 'detailed', 'coach_focused', 'custom'
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    description TEXT,
    
    -- Template configuration (sections to include)
    sections JSONB DEFAULT '[]'::jsonb, -- Array of section names: 'game_info', 'score', 'shot_chart', 'player_stats', etc.
    metrics JSONB DEFAULT '[]'::jsonb, -- Array of metrics to include
    
    -- Branding options
    branding JSONB DEFAULT '{}'::jsonb, -- {logo_url, primary_color, secondary_color, header_text, footer_text}
    
    -- Language and formatting
    language VARCHAR(10) DEFAULT 'en', -- ISO language code
    date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD',
    time_format VARCHAR(20) DEFAULT '24h',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE report_templates IS 'Stores report template definitions for generating match reports';
COMMENT ON COLUMN report_templates.type IS 'Template type: summary, detailed, coach_focused, or custom';
COMMENT ON COLUMN report_templates.is_default IS 'True for system-provided templates that cannot be deleted';
COMMENT ON COLUMN report_templates.sections IS 'Array of section identifiers to include in the report';
COMMENT ON COLUMN report_templates.metrics IS 'Array of specific metrics to display';
COMMENT ON COLUMN report_templates.branding IS 'Team branding configuration: logo, colors, headers, footers';

-- Export Settings table
-- User-specific preferences for exports
CREATE TABLE IF NOT EXISTS export_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    
    -- Default preferences
    default_format VARCHAR(20) DEFAULT 'pdf', -- 'pdf', 'csv', 'json'
    default_template_id INTEGER REFERENCES report_templates(id) ON DELETE SET NULL,
    
    -- Privacy settings
    anonymize_opponents BOOLEAN DEFAULT false,
    include_sensitive_data BOOLEAN DEFAULT true, -- e.g., player personal info
    
    -- Data retention
    auto_delete_after_days INTEGER, -- NULL means never delete
    
    -- Sharing permissions
    allow_public_sharing BOOLEAN DEFAULT false,
    allowed_share_roles JSONB DEFAULT '["coach", "admin"]'::jsonb, -- Array of role names
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id)
);

COMMENT ON TABLE export_settings IS 'User-specific export configuration and preferences';
COMMENT ON COLUMN export_settings.anonymize_opponents IS 'Whether to hide opponent team names and player names in reports';
COMMENT ON COLUMN export_settings.auto_delete_after_days IS 'Automatically delete generated reports after N days (NULL = never)';
COMMENT ON COLUMN export_settings.allowed_share_roles IS 'Array of user roles that can access shared reports';

-- Scheduled Reports table
-- Configuration for automatic report generation
CREATE TABLE IF NOT EXISTS scheduled_reports (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    template_id INTEGER REFERENCES report_templates(id) ON DELETE CASCADE NOT NULL,
    
    -- Schedule configuration
    schedule_type VARCHAR(50) NOT NULL, -- 'after_match', 'weekly', 'monthly', 'season_end'
    is_active BOOLEAN DEFAULT true,
    
    -- Filters for report content
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE, -- NULL means all teams
    game_filters JSONB DEFAULT '{}'::jsonb, -- Additional filters: date_range, opponent, etc.
    
    -- Email delivery configuration
    send_email BOOLEAN DEFAULT false,
    email_recipients JSONB DEFAULT '[]'::jsonb, -- Array of email addresses
    email_subject VARCHAR(200),
    email_body TEXT,
    
    -- Execution tracking
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    run_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CHECK (schedule_type IN ('after_match', 'weekly', 'monthly', 'season_end'))
);

COMMENT ON TABLE scheduled_reports IS 'Configuration for automatically generating and sending reports on schedule';
COMMENT ON COLUMN scheduled_reports.schedule_type IS 'When to generate: after_match, weekly, monthly, or season_end';
COMMENT ON COLUMN scheduled_reports.game_filters IS 'Additional filters for selecting games to include in report';
COMMENT ON COLUMN scheduled_reports.email_recipients IS 'Array of email addresses to send report to';

-- Report Exports table
-- Tracks generated reports for history and download
CREATE TABLE IF NOT EXISTS report_exports (
    id SERIAL PRIMARY KEY,
    template_id INTEGER REFERENCES report_templates(id) ON DELETE SET NULL,
    scheduled_report_id INTEGER REFERENCES scheduled_reports(id) ON DELETE SET NULL,
    generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Report details
    report_name VARCHAR(200) NOT NULL,
    report_type VARCHAR(50) NOT NULL, -- 'game', 'player', 'team', 'season'
    format VARCHAR(20) NOT NULL, -- 'pdf', 'csv', 'json'
    
    -- Content references
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    date_range JSONB, -- {start_date, end_date} for multi-game reports
    
    -- File information
    file_path VARCHAR(500), -- Relative path to stored file
    file_size_bytes INTEGER,
    file_hash VARCHAR(64), -- SHA-256 hash for integrity
    
    -- Sharing and access
    is_public BOOLEAN DEFAULT false,
    share_token VARCHAR(64) UNIQUE, -- UUID for public sharing
    access_count INTEGER DEFAULT 0,
    
    -- Retention
    expires_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE report_exports IS 'Tracks all generated reports for download and history';
COMMENT ON COLUMN report_exports.report_type IS 'Type of report: game (single match), player, team, or season';
COMMENT ON COLUMN report_exports.share_token IS 'Unique token for public sharing if is_public is true';
COMMENT ON COLUMN report_exports.expires_at IS 'When to auto-delete this report (based on user retention policy)';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_report_templates_type ON report_templates(type);
CREATE INDEX IF NOT EXISTS idx_report_templates_is_default ON report_templates(is_default);
CREATE INDEX IF NOT EXISTS idx_report_templates_created_by ON report_templates(created_by);

CREATE INDEX IF NOT EXISTS idx_export_settings_user_id ON export_settings(user_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_created_by ON scheduled_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_template_id ON scheduled_reports(template_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_team_id ON scheduled_reports(team_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run_at ON scheduled_reports(next_run_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_is_active ON scheduled_reports(is_active);

CREATE INDEX IF NOT EXISTS idx_report_exports_generated_by ON report_exports(generated_by);
CREATE INDEX IF NOT EXISTS idx_report_exports_game_id ON report_exports(game_id);
CREATE INDEX IF NOT EXISTS idx_report_exports_team_id ON report_exports(team_id);
CREATE INDEX IF NOT EXISTS idx_report_exports_player_id ON report_exports(player_id);
CREATE INDEX IF NOT EXISTS idx_report_exports_share_token ON report_exports(share_token);
CREATE INDEX IF NOT EXISTS idx_report_exports_created_at ON report_exports(created_at);
CREATE INDEX IF NOT EXISTS idx_report_exports_expires_at ON report_exports(expires_at);

-- Triggers for updated_at
CREATE TRIGGER update_report_templates_updated_at
    BEFORE UPDATE ON report_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_export_settings_updated_at
    BEFORE UPDATE ON export_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_reports_updated_at
    BEFORE UPDATE ON scheduled_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
