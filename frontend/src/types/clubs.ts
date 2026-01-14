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
  club_id?: number;
}

export interface ClubPlayer {
  id: number;
  first_name: string;
  last_name: string;
  jersey_number: number;
  is_active?: boolean;
  team_id?: number;
  club_id?: number;
  team_name?: string | null;
}
