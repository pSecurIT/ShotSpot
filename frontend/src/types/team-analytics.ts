export interface TeamAnalyticsTeamOption {
  id: number;
  name: string;
  club_id: number;
  club_name?: string | null;
  season_id?: number | null;
  season_name?: string | null;
}

export interface TeamAnalyticsSeasonSummary {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface TeamAnalyticsRecord {
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  win_percentage: number;
}

export interface TeamAnalyticsScoring {
  total_shots: number;
  total_goals: number;
  fg_percentage: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  avg_goals_for: number;
  avg_goals_against: number;
  avg_goal_difference: number;
}

export interface TeamAnalyticsTopScorer {
  player_id: number;
  player_name: string;
  jersey_number: number | null;
  goals: number;
  shots: number;
  fg_percentage: number;
}

export interface TeamAnalyticsPeriodBreakdown {
  period: number;
  shots: number;
  goals: number;
  fg_percentage: number;
}

export interface TeamAnalyticsComparisonDelta {
  win_percentage: number;
  goals_for_per_game: number;
  fg_percentage: number;
  goal_difference_per_game: number;
}

export interface TeamAnalyticsPreviousSeasonComparison {
  season: TeamAnalyticsSeasonSummary;
  record: TeamAnalyticsRecord;
  scoring: TeamAnalyticsScoring;
  deltas: TeamAnalyticsComparisonDelta;
}

export interface TeamAnalyticsOverviewResponse {
  team: TeamAnalyticsTeamOption;
  season: TeamAnalyticsSeasonSummary | null;
  scope_mode: 'team' | 'club_fallback';
  record: TeamAnalyticsRecord;
  scoring: TeamAnalyticsScoring;
  top_scorers: TeamAnalyticsTopScorer[];
  period_breakdown: TeamAnalyticsPeriodBreakdown[];
  previous_season_comparison: TeamAnalyticsPreviousSeasonComparison | null;
}

export interface TeamMomentumPoint {
  game_id: number;
  game_date: string;
  opponent_name: string;
  venue: 'home' | 'away';
  result: 'W' | 'L' | 'D';
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  shots: number;
  goals: number;
  fg_percentage: number;
  momentum_score: number;
  rolling_fg_percentage: number;
  rolling_points_per_game: number;
}

export interface TeamMomentumSummary {
  current_streak: string;
  last_five_record: string;
  last_five_points: number;
  average_momentum: number;
}

export interface TeamMomentumResponse {
  team: TeamAnalyticsTeamOption;
  season: TeamAnalyticsSeasonSummary | null;
  scope_mode: 'team' | 'club_fallback';
  trend: TeamMomentumPoint[];
  summary: TeamMomentumSummary;
}

export interface TeamBenchmarkMetric {
  win_percentage: number;
  goals_for_per_game: number;
  goals_against_per_game: number;
  fg_percentage: number;
  goal_difference_per_game: number;
}

export interface TeamAnalyticsInsight {
  title: string;
  description: string;
  metric: keyof TeamBenchmarkMetric;
  value: number;
  benchmark: number;
  delta: number;
}

export interface TeamStrengthsWeaknessesResponse {
  team: TeamAnalyticsTeamOption;
  season: TeamAnalyticsSeasonSummary | null;
  scope_mode: 'team' | 'club_fallback';
  benchmarks: TeamBenchmarkMetric;
  strengths: TeamAnalyticsInsight[];
  weaknesses: TeamAnalyticsInsight[];
  period_breakdown: TeamAnalyticsPeriodBreakdown[];
}