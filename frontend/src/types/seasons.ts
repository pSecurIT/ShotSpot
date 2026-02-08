export type SeasonType = 'indoor' | 'outdoor' | 'mixed';

export interface Season {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  season_type?: SeasonType | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
