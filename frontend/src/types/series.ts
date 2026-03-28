export interface Series {
  id: number;
  name: string;
  level: number;
  region?: string | null;
  created_at: string;
  updated_at: string;
  competition_count?: number | string | null;
}

export interface SeriesCompetitionSummary {
  id: number;
  name: string;
  competition_type: string;
  status: string;
  season_id: number | null;
  season_name?: string | null;
  team_count?: number | string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface SeriesDetail extends Series {
  competitions: SeriesCompetitionSummary[];
}

export interface SeriesCreatePayload {
  name: string;
  level: number;
  region?: string | null;
}

export interface SeriesUpdatePayload {
  name?: string;
  level?: number;
  region?: string | null;
}
