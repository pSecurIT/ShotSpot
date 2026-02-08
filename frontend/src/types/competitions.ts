export type CompetitionType = 'tournament' | 'league';
export type CompetitionStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled';

export type TournamentBracketType = 'single_elimination' | 'double_elimination';

export interface CompetitionFormatConfig {
  bracket_type?: TournamentBracketType;
  points_win?: number;
  points_draw?: number;
  points_loss?: number;
  groups?: number;
  teams_per_group?: number;
}

export interface Competition {
  id: number;
  name: string;
  type: CompetitionType;
  season_id: number | null;
  series_id: number | null;
  start_date: string;
  end_date: string | null;
  status: CompetitionStatus;
  format_config: CompetitionFormatConfig;
  created_at: string;
  updated_at: string;

  // Optional fields returned by backend list/detail endpoints
  description?: string | null;
  is_official?: boolean;
  season_name?: string | null;
  team_count?: number;
  games_played?: number;
}

export interface CompetitionCreate {
  name: string;
  type: CompetitionType;
  season_id?: number;
  series_id?: number;
  start_date: string;
  end_date?: string;
  description?: string;
  status?: CompetitionStatus;
  format_config?: CompetitionFormatConfig;
}

export interface CompetitionUpdate {
  name?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
  status?: CompetitionStatus;
  format_config?: CompetitionFormatConfig;
  season_id?: number | null;
  series_id?: number | null;
}

export interface CompetitionTeam {
  competition_id: number;
  team_id: number;
  team_name: string;
  seed?: number | null;
  group?: string | null;
}

export interface TournamentBracketMatch {
  id: number;
  competition_id: number;
  round_number: number;
  round_name: string;
  match_number: number;
  home_team_id: number | null;
  away_team_id: number | null;
  winner_team_id: number | null;
  game_id: number | null;
  home_team_name?: string | null;
  away_team_name?: string | null;
  winner_team_name?: string | null;
  home_score?: number | null;
  away_score?: number | null;
  game_status?: string | null;
}

export interface TournamentBracketRound {
  round_number: number;
  round_name: string;
  matches: TournamentBracketMatch[];
}

export interface TournamentBracket {
  competition_id: number;
  rounds: TournamentBracketRound[];
}

export interface LeagueStanding {
  id: number;
  competition_id: number;
  team_id: number;
  team_name: string;
  rank: number | null;
  games_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  form?: string | null;
}
