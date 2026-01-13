import { render, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import AchievementNotification from '../components/AchievementNotification';
import type { Achievement } from '../types/achievements';

describe('AchievementNotification Component', () => {
  const mockAchievement: Achievement = {
    id: 1,
    name: 'Sharpshooter',
    description: 'Score 10 goals in a single game',
    badge_icon: '🎯',
    category: 'shooting',
    criteria: { goals_in_game: 10 },
    points: 50,
    earned_at: '2024-11-15T10:30:00.000Z',
    game_id: 1
  };

  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when achievement is null', () => {
      const { container } = render(<AchievementNotification achievement={null} onClose={mockOnClose} />);

      expect(container.firstChild).toBeNull();
    });

    it('should render achievement name and description', async () => {
      const { container } = render(<AchievementNotification achievement={mockAchievement} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(container.textContent).toContain('Sharpshooter');
        expect(container.textContent).toContain('Score 10 goals in a single game');
      });
    });

    it('should display badge icon', async () => {
      const { container } = render(<AchievementNotification achievement={mockAchievement} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(container.textContent).toContain('🎯');
      });
    });

    it('should display points value', async () => {
      const { container } = render(<AchievementNotification achievement={mockAchievement} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(container.textContent).toContain('+50 points');
      });
    });

    it('should display category', async () => {
      const { container } = render(<AchievementNotification achievement={mockAchievement} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(container.textContent).toContain('shooting');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle achievement without game_id', async () => {
      const achievementWithoutGame: Achievement = {
        ...mockAchievement,
        game_id: undefined
      };
      const { container } = render(<AchievementNotification achievement={achievementWithoutGame} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(container.textContent).toContain('Sharpshooter');
      });
    });

    it('should handle achievement without earned_at', async () => {
      const achievementWithoutDate: Achievement = {
        ...mockAchievement,
        earned_at: undefined
      };
      const { container } = render(<AchievementNotification achievement={achievementWithoutDate} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(container.textContent).toContain('Sharpshooter');
      });
    });

    it('should handle different categories', async () => {
      const categories: Array<'shooting' | 'consistency' | 'improvement' | 'milestone'> = ['shooting', 'consistency', 'improvement', 'milestone'];
      
      for (const category of categories) {
        const achievement: Achievement = {
          ...mockAchievement,
          category
        };
        const { container } = render(<AchievementNotification achievement={achievement} onClose={mockOnClose} />);
        await waitFor(() => {
          expect(container.textContent).toContain(category);
        });
      }
    });
  });
});
