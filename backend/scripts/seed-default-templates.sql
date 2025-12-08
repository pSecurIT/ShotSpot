-- Seed default report templates
-- Run this after the export configuration migration

-- Insert default templates if they don't exist
INSERT INTO report_templates (name, description, type, is_default, sections, metrics, created_by)
VALUES 
  (
    'Match Summary',
    'Quick overview with key statistics',
    'pdf-summary',
    true,
    '["game_info", "score", "key_stats"]'::jsonb,
    '["goals", "shots", "success_rate"]'::jsonb,
    NULL
  ),
  (
    'Full Game Report',
    'Comprehensive analysis with all details',
    'pdf-detailed',
    true,
    '["game_info", "score", "shot_chart", "player_stats", "timeline", "period_analysis"]'::jsonb,
    '["goals", "shots", "assists", "success_rate", "period_breakdown"]'::jsonb,
    NULL
  ),
  (
    'Player Statistics',
    'Individual player performance report',
    'csv',
    true,
    '["player_info", "stats_summary"]'::jsonb,
    '["goals", "assists", "shots", "minutes_played"]'::jsonb,
    NULL
  )
ON CONFLICT DO NOTHING;
