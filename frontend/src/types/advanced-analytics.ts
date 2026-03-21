export interface AnalyticsPlayerOption {
  id: number;
  first_name: string;
  last_name: string;
  jersey_number: number;
  team_id?: number;
  team_name?: string;
  is_active?: boolean;
}

export interface FormTrendGame {
  game_id: number;
  game_date: string;
  shots: number;
  goals: number;
  fg_percentage: number;
  avg_distance: number;
}

export interface FormTrendsResponse {
  player_id: number;
  form_trend: 'hot' | 'improving' | 'stable' | 'declining' | 'cold' | 'insufficient_data';
  trend_change?: number;
  recent_avg_fg?: number;
  older_avg_fg?: number;
  overall_avg_fg?: number;
  volatility?: number;
  consistency_rating?: 'high' | 'medium' | 'low';
  games_analyzed: number;
  recent_games?: FormTrendGame[];
  message?: string;
}

export interface FatiguePeriodPerformance {
  period: number;
  shots: number;
  goals: number;
  fg_percentage: number;
}

export interface FatigueGameAnalysis {
  game_id: number;
  game_date: string;
  play_time_seconds: number;
  play_time_minutes: number;
  play_time_percent: number;
  performance_degradation: number;
  fatigue_level: 'fresh' | 'normal' | 'tired' | 'exhausted';
  period_performance: FatiguePeriodPerformance[];
}

export interface FatigueResponse {
  player_id: number;
  games_analyzed: number;
  fatigue_analysis: FatigueGameAnalysis[];
}

export interface NextGamePredictionResponse {
  player_id: number;
  opponent_id: number | null;
  predicted_fg_percentage?: number;
  predicted_shots?: number;
  predicted_goals?: number;
  confidence_score?: number;
  form_trend?: string;
  historical_avg?: {
    fg_percentage: number;
    shots_per_game: number;
    goals_per_game: number;
  };
  adjustments?: {
    form_adjustment: number;
    matchup_adjustment: number;
  };
  prediction?: 'insufficient_data';
  message?: string;
}

export interface PlayerComparisonResponse {
  player_id: number;
  games_analyzed?: number;
  player_stats?: {
    avg_shots_per_game: number;
    avg_goals_per_game: number;
    avg_fg_percentage: number;
    avg_shot_distance: number;
  };
  league_averages?: {
    avg_shots_per_game: number;
    avg_goals_per_game: number;
    avg_fg_percentage: number;
    avg_shot_distance: number;
  };
  comparison?: {
    shots_vs_league: number;
    goals_vs_league: number;
    fg_vs_league: number;
    distance_vs_league: number;
  };
  percentile_rank?: {
    fg_percentage: number;
  };
  message?: string;
}

export interface LeagueAveragesResponse {
  competition: string;
  season: string;
  position: 'offense' | 'defense' | 'all';
  league_averages: {
    total_games: number;
    total_players: number;
    avg_shots_per_game: number;
    avg_goals_per_game: number;
    avg_fg_percentage: number;
    avg_shot_distance: number;
  };
  position_averages?: {
    position: 'offense' | 'defense' | 'all';
    total_players: number;
    avg_shots_per_game: number;
    avg_goals_per_game: number;
    avg_fg_percentage: number;
  };
}

export interface HistoricalBenchmarkEntry {
  period: string;
  games_played: number;
  total_shots: number;
  total_goals: number;
  avg_fg_percentage: number;
  avg_distance: number;
  avg_shots_per_game: number;
  avg_goals_per_game: number;
}

export interface HistoricalBenchmarksResponse {
  entity_type: 'player' | 'team';
  entity_id: number;
  historical_benchmarks: HistoricalBenchmarkEntry[];
}

export interface VideoLinkEventPayload {
  game_id: number;
  event_type: string;
  event_id?: number;
  video_url?: string | null;
  timestamp_start: number;
  timestamp_end?: number | null;
  description?: string | null;
  is_highlight?: boolean;
  tags?: string[];
}

export interface VideoLinkEventResponse {
  id: number;
  game_id: number;
  event_type: string;
  event_id?: number | null;
  video_url?: string | null;
  timestamp_start: number;
  timestamp_end?: number | null;
  description?: string | null;
  is_highlight: boolean;
  tags: string[];
}

export interface VideoEvent {
  id?: number;
  game_id: number;
  event_id?: number;
  event_type: string;
  video_url?: string | null;
  timestamp_start?: string | null;
  timestamp_end?: string | null;
  is_highlight?: boolean;
  description?: string | null;
}

export interface VideoHighlight {
  id?: number;
  event_id?: number;
  event_type: string;
  description?: string;
  video_url?: string | null;
  timestamp_start?: string | null;
  timestamp_end?: string | null;
  suggested_duration?: number;
  priority?: string;
}

export interface VideoHighlightsResponse {
  game_id: number;
  total_clips: number;
  marked_highlights: VideoHighlight[];
  auto_identified_highlights: VideoHighlight[];
  reel_metadata: {
    suggested_total_duration: number;
    clip_ordering: string;
    include_transitions: boolean;
  };
}

export interface VideoReportDataResponse {
  game_id: number;
  video_events: Array<VideoEvent & { event_details?: Record<string, unknown> | null }>;
  report_metadata: {
    includes_video_links: boolean;
    total_tagged_events: number;
    highlights_count: number;
    event_types: string[];
  };
}