export interface Club {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ClubCreate {
  name: string;
}

export interface ClubUpdate {
  name: string;
}

export interface ClubTeam {
  id: number;
  name: string;
  club_id: number;
  age_group?: string | null;
  gender?: 'male' | 'female' | 'mixed' | null;
  season_id?: number | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ClubPlayer {
  id: number;
  first_name: string;
  last_name: string;
  jersey_number?: number | null;
  gender?: 'male' | 'female' | null;
  is_active?: boolean;
  team_id?: number | null;
  club_id?: number | null;
  created_at?: string;
  updated_at?: string;
  team_name?: string | null;
}
