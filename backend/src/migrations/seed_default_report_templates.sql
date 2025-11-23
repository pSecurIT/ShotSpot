-- Seed Default Report Templates
-- This migration adds the default report templates that are available to all users

-- Summary Template - Quick overview of a match
INSERT INTO report_templates (
    name,
    type,
    is_default,
    is_active,
    description,
    sections,
    metrics,
    branding,
    language
)
SELECT
    'Summary Report',
    'summary',
    true,
    true,
    'Quick overview report with final score, key statistics, and top performers',
    '["game_info", "final_score", "top_scorers", "team_comparison"]'::jsonb,
    '["total_shots", "field_goal_percentage", "goals", "top_3_players"]'::jsonb,
    '{"primary_color": "#1976d2", "secondary_color": "#424242"}'::jsonb,
    'en'
WHERE NOT EXISTS (
    SELECT 1 FROM report_templates WHERE name = 'Summary Report' AND is_default = true
);

-- Detailed Template - Comprehensive match analysis
INSERT INTO report_templates (
    name,
    type,
    is_default,
    is_active,
    description,
    sections,
    metrics,
    branding,
    language
)
SELECT
    'Detailed Report',
    'detailed',
    true,
    true,
    'Comprehensive match report with detailed analytics, shot charts, and period-by-period breakdown',
    '["game_info", "final_score", "shot_chart", "player_stats", "period_breakdown", "possession_stats", "zone_analysis", "substitutions"]'::jsonb,
    '["total_shots", "field_goal_percentage", "goals", "misses", "blocked", "avg_distance", "zone_performance", "play_time", "possession_duration"]'::jsonb,
    '{"primary_color": "#1976d2", "secondary_color": "#424242"}'::jsonb,
    'en'
WHERE NOT EXISTS (
    SELECT 1 FROM report_templates WHERE name = 'Detailed Report' AND is_default = true
);

-- Coach-Focused Template - Tactical insights for coaches
INSERT INTO report_templates (
    name,
    type,
    is_default,
    is_active,
    description,
    sections,
    metrics,
    branding,
    language
)
SELECT
    'Coach-Focused Report',
    'coach_focused',
    true,
    true,
    'Tactical analysis report highlighting player performance, hot/cold zones, trends, and strategic insights',
    '["game_info", "final_score", "player_performance", "zone_analysis", "hot_cold_zones", "trends", "streaks", "substitution_impact", "tactical_notes"]'::jsonb,
    '["field_goal_percentage", "zone_success_rates", "streak_data", "period_trends", "player_efficiency", "play_time", "shot_selection"]'::jsonb,
    '{"primary_color": "#2e7d32", "secondary_color": "#424242"}'::jsonb,
    'en'
WHERE NOT EXISTS (
    SELECT 1 FROM report_templates WHERE name = 'Coach-Focused Report' AND is_default = true
);

-- Season Summary Template - End of season comprehensive report
INSERT INTO report_templates (
    name,
    type,
    is_default,
    is_active,
    description,
    sections,
    metrics,
    branding,
    language
)
SELECT
    'Season Summary Report',
    'summary',
    true,
    true,
    'Comprehensive season overview with aggregate statistics across all matches',
    '["season_info", "win_loss_record", "total_stats", "player_development", "team_progression", "top_performers", "season_highlights"]'::jsonb,
    '["total_games", "wins", "losses", "total_goals", "avg_fg_percentage", "best_performers", "improvement_trends"]'::jsonb,
    '{"primary_color": "#f57c00", "secondary_color": "#424242"}'::jsonb,
    'en'
WHERE NOT EXISTS (
    SELECT 1 FROM report_templates WHERE name = 'Season Summary Report' AND is_default = true
);
