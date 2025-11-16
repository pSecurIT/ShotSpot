import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Leaderboard from '../components/Leaderboard';
import type { LeaderboardPlayer } from '../types/achievements';

describe('Leaderboard Component', () => {
  const mockPlayers: LeaderboardPlayer[] = [
    {
      rank: 1,
      id: 1,
      first_name: 'John',
      last_name: 'Doe',
      team_name: 'Team A',
      jersey_number: 10,
      total_shots: 50,
      total_goals: 35,
      fg_percentage: 70.0,
      achievement_points: 250,
      achievements_earned: 8,
      games_played: 10
    },
    {
      rank: 2,
      id: 2,
      first_name: 'Jane',
      last_name: 'Smith',
      team_name: 'Team B',
      jersey_number: 11,
      total_shots: 45,
      total_goals: 30,
      fg_percentage: 66.7,
      achievement_points: 200,
      achievements_earned: 6,
      games_played: 9
    },
    {
      rank: 3,
      id: 3,
      first_name: 'Bob',
      last_name: 'Johnson',
      team_name: 'Team A',
      jersey_number: 20,
      total_shots: 40,
      total_goals: 25,
      fg_percentage: 62.5,
      achievement_points: 180,
      achievements_earned: 5,
      games_played: 8
    },
    {
      rank: 4,
      id: 4,
      first_name: 'Alice',
      last_name: 'Williams',
      team_name: 'Team C',
      jersey_number: 5,
      total_shots: 38,
      total_goals: 22,
      fg_percentage: 57.9,
      achievement_points: 150,
      achievements_earned: 4,
      games_played: 7
    }
  ];

  describe('Global Leaderboard', () => {
    it('should render global leaderboard with all players', () => {
      render(<Leaderboard players={mockPlayers} type="global" season="2024-2025" />);

      expect(screen.getByText('🌍 Global Leaderboard')).toBeInTheDocument();
      expect(screen.getByText('2024-2025')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      expect(screen.getByText('Alice Williams')).toBeInTheDocument();
    });

    it('should display team column for global leaderboard', () => {
      render(<Leaderboard players={mockPlayers} type="global" />);

      expect(screen.getByText('Team')).toBeInTheDocument();
      expect(screen.getAllByText('Team A')).toHaveLength(2); // Two players from Team A
      expect(screen.getByText('Team B')).toBeInTheDocument();
      expect(screen.getByText('Team C')).toBeInTheDocument();
    });

    it('should show correct footer note for global leaderboard', () => {
      render(<Leaderboard players={mockPlayers} type="global" />);

      expect(screen.getByText('Minimum 10 shots required')).toBeInTheDocument();
    });
  });

  describe('Team Leaderboard', () => {
    it('should render team leaderboard with team name', () => {
      render(<Leaderboard players={mockPlayers} type="team" teamName="Warriors" />);

      expect(screen.getByText('🏆 Warriors Leaderboard')).toBeInTheDocument();
    });

    it('should display achievements column for team leaderboard', () => {
      render(<Leaderboard players={mockPlayers} type="team" />);

      expect(screen.getByText('🏆')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
      expect(screen.getByText('6')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('should not display team column for team leaderboard', () => {
      render(<Leaderboard players={mockPlayers} type="team" />);

      expect(screen.queryByText('Team')).not.toBeInTheDocument();
    });

    it('should show correct footer note for team leaderboard', () => {
      render(<Leaderboard players={mockPlayers} type="team" />);

      expect(screen.getByText('Minimum 5 shots required')).toBeInTheDocument();
    });

    it('should use default team name when not provided', () => {
      render(<Leaderboard players={mockPlayers} type="team" />);

      expect(screen.getByText('🏆 Team Leaderboard')).toBeInTheDocument();
    });
  });

  describe('Rank Display', () => {
    it('should show gold medal emoji for rank 1', () => {
      render(<Leaderboard players={mockPlayers} type="global" />);

      expect(screen.getByText('🥇')).toBeInTheDocument();
    });

    it('should show silver medal emoji for rank 2', () => {
      render(<Leaderboard players={mockPlayers} type="global" />);

      expect(screen.getByText('🥈')).toBeInTheDocument();
    });

    it('should show bronze medal emoji for rank 3', () => {
      render(<Leaderboard players={mockPlayers} type="global" />);

      expect(screen.getByText('🥉')).toBeInTheDocument();
    });

    it('should show numeric rank for positions 4+', () => {
      render(<Leaderboard players={mockPlayers} type="global" />);

      expect(screen.getByText('#4')).toBeInTheDocument();
    });

    it('should apply podium styling to top 3 rows', () => {
      const { container } = render(<Leaderboard players={mockPlayers} type="global" />);

      const podiumRows = container.querySelectorAll('.leaderboard__row--podium');
      expect(podiumRows).toHaveLength(3);
    });
  });

  describe('Player Information', () => {
    it('should display player names correctly', () => {
      render(<Leaderboard players={mockPlayers} type="global" />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('should display jersey numbers', () => {
      render(<Leaderboard players={mockPlayers} type="global" />);

      expect(screen.getByText('#10')).toBeInTheDocument();
      expect(screen.getByText('#11')).toBeInTheDocument();
      expect(screen.getByText('#20')).toBeInTheDocument();
      expect(screen.getByText('#5')).toBeInTheDocument();
    });

    it('should handle player without jersey number', () => {
      const playersWithoutJersey: LeaderboardPlayer[] = [
        {
          ...mockPlayers[0],
          jersey_number: undefined
        }
      ];
      render(<Leaderboard players={playersWithoutJersey} type="global" />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('#10')).not.toBeInTheDocument();
    });
  });

  describe('Statistics Display', () => {
    it('should display all statistics correctly', () => {
      render(<Leaderboard players={mockPlayers} type="global" />);

      expect(screen.getByText('50')).toBeInTheDocument(); // total_shots
      expect(screen.getByText('35')).toBeInTheDocument(); // total_goals
      expect(screen.getByText('70.0%')).toBeInTheDocument(); // fg_percentage
      expect(screen.getByText('250')).toBeInTheDocument(); // achievement_points
    });

    it('should format field goal percentage to one decimal', () => {
      render(<Leaderboard players={mockPlayers} type="global" />);

      expect(screen.getByText('66.7%')).toBeInTheDocument();
      expect(screen.getByText('62.5%')).toBeInTheDocument();
      expect(screen.getByText('57.9%')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner when loading', () => {
      render(<Leaderboard players={[]} type="global" loading={true} />);

      expect(screen.getByText('Loading leaderboard...')).toBeInTheDocument();
    });

    it('should display header while loading', () => {
      render(<Leaderboard players={[]} type="global" loading={true} season="2024-2025" />);

      expect(screen.getByText('🌍 Global Leaderboard')).toBeInTheDocument();
      expect(screen.getByText('2024-2025')).toBeInTheDocument();
    });

    it('should not show table while loading', () => {
      const { container } = render(<Leaderboard players={mockPlayers} type="global" loading={true} />);

      expect(container.querySelector('.leaderboard__table')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no players', () => {
      render(<Leaderboard players={[]} type="global" />);

      expect(screen.getByText('No players found')).toBeInTheDocument();
      expect(screen.getByText('📊')).toBeInTheDocument();
    });

    it('should display header in empty state', () => {
      render(<Leaderboard players={[]} type="team" teamName="Warriors" />);

      expect(screen.getByText('🏆 Warriors Leaderboard')).toBeInTheDocument();
    });

    it('should not show table in empty state', () => {
      const { container } = render(<Leaderboard players={[]} type="global" />);

      expect(container.querySelector('.leaderboard__table')).not.toBeInTheDocument();
    });
  });

  describe('Footer Information', () => {
    it('should display correct player count in footer', () => {
      render(<Leaderboard players={mockPlayers} type="global" />);

      expect(screen.getByText('Showing 4 players')).toBeInTheDocument();
    });

    it('should use singular form for single player', () => {
      render(<Leaderboard players={[mockPlayers[0]]} type="global" />);

      expect(screen.getByText('Showing 1 player')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle player without team name', () => {
      const playersWithoutTeam: LeaderboardPlayer[] = [
        {
          ...mockPlayers[0],
          team_name: undefined
        }
      ];
      render(<Leaderboard players={playersWithoutTeam} type="global" />);

      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('should render without season prop', () => {
      render(<Leaderboard players={mockPlayers} type="global" />);

      expect(screen.getByText('🌍 Global Leaderboard')).toBeInTheDocument();
      expect(screen.queryByText(/2024/)).not.toBeInTheDocument();
    });

    it('should handle achievements_earned undefined in team view', () => {
      const playersWithoutAchievements: LeaderboardPlayer[] = [
        {
          ...mockPlayers[0],
          achievements_earned: undefined
        }
      ];
      render(<Leaderboard players={playersWithoutAchievements} type="team" />);

      // Should not crash and render the player
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });
});
