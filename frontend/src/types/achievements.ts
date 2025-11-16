// Achievement types
export interface Achievement {
  id: number;
  name: string;
  description: string;
  badge_icon: string;
  category: 'shooting' | 'consistency' | 'improvement' | 'milestone';
  criteria: Record<string, unknown>;
  points: number;
  earned_at?: string;
  game_id?: number;
}

// Leaderboard types
export interface LeaderboardPlayer {
  rank: number;
  id: number;
  first_name: string;
  last_name: string;
  team_name?: string;
  jersey_number?: number;
  total_shots: number;
  total_goals: number;
  fg_percentage: number;
  achievement_points: number;
  achievements_earned?: number;
  games_played?: number;
}
