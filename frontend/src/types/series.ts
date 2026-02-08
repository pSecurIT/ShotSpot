export interface Series {
  id: number;
  name: string;
  level: number;
  created_at: string;
  updated_at: string;
  competition_count?: number | string | null;
}
