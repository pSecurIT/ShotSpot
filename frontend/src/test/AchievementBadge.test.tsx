import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AchievementBadge from '../components/AchievementBadge';
import type { Achievement } from '../types/achievements';

describe('AchievementBadge Component', () => {
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

  describe('Unlocked State', () => {
    it('should render unlocked achievement with all details', () => {
      render(<AchievementBadge achievement={mockAchievement} isLocked={false} />);

      expect(screen.getByText('Sharpshooter')).toBeInTheDocument();
      expect(screen.getByText('Score 10 goals in a single game')).toBeInTheDocument();
      expect(screen.getByText('🎯')).toBeInTheDocument();
      expect(screen.getByText('50 pts')).toBeInTheDocument();
      expect(screen.getByText('shooting')).toBeInTheDocument();
    });

    it('should display earned date when achievement is unlocked', () => {
      render(<AchievementBadge achievement={mockAchievement} isLocked={false} />);

      expect(screen.getByText('Nov 15, 2024')).toBeInTheDocument();
    });

    it('should show checkmark indicator for unlocked achievement', () => {
      render(<AchievementBadge achievement={mockAchievement} isLocked={false} />);

      const checkmark = screen.getByText('✓');
      expect(checkmark).toBeInTheDocument();
      expect(checkmark.closest('.achievement-badge__earned-indicator')).toBeInTheDocument();
    });

    it('should apply correct category color for shooting achievement', () => {
      const { container } = render(<AchievementBadge achievement={mockAchievement} isLocked={false} />);

      const badge = container.querySelector('.achievement-badge');
      expect(badge).toHaveStyle({ borderColor: '#FF6B6B' });
    });

    it('should not show locked overlay for unlocked achievement', () => {
      const { container } = render(<AchievementBadge achievement={mockAchievement} isLocked={false} />);

      const lockedOverlay = container.querySelector('.achievement-badge__locked-overlay');
      expect(lockedOverlay).not.toBeInTheDocument();
    });
  });

  describe('Locked State', () => {
    it('should render locked achievement with hidden description', () => {
      render(<AchievementBadge achievement={mockAchievement} isLocked={true} />);

      expect(screen.getByText('Sharpshooter')).toBeInTheDocument();
      expect(screen.getByText('???')).toBeInTheDocument();
      expect(screen.queryByText('Score 10 goals in a single game')).not.toBeInTheDocument();
    });

    it('should show lock icon for locked achievement', () => {
      render(<AchievementBadge achievement={mockAchievement} isLocked={true} />);

      expect(screen.getByText('🔒')).toBeInTheDocument();
    });

    it('should not display earned date when locked', () => {
      render(<AchievementBadge achievement={mockAchievement} isLocked={true} />);

      expect(screen.queryByText('Nov 15, 2024')).not.toBeInTheDocument();
    });

    it('should apply gray color for locked achievement', () => {
      const { container } = render(<AchievementBadge achievement={mockAchievement} isLocked={true} />);

      const badge = container.querySelector('.achievement-badge');
      expect(badge).toHaveStyle({ borderColor: '#6C757D' });
    });

    it('should have locked class applied', () => {
      const { container } = render(<AchievementBadge achievement={mockAchievement} isLocked={true} />);

      const badge = container.querySelector('.achievement-badge--locked');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('should render small size badge', () => {
      const { container } = render(<AchievementBadge achievement={mockAchievement} size="small" />);

      expect(container.querySelector('.achievement-badge--small')).toBeInTheDocument();
    });

    it('should render medium size badge by default', () => {
      const { container } = render(<AchievementBadge achievement={mockAchievement} />);

      expect(container.querySelector('.achievement-badge--medium')).toBeInTheDocument();
    });

    it('should render large size badge', () => {
      const { container } = render(<AchievementBadge achievement={mockAchievement} size="large" />);

      expect(container.querySelector('.achievement-badge--large')).toBeInTheDocument();
    });
  });

  describe('Category Colors', () => {
    it('should apply correct color for consistency category', () => {
      const consistencyAchievement: Achievement = {
        ...mockAchievement,
        category: 'consistency'
      };
      const { container } = render(<AchievementBadge achievement={consistencyAchievement} isLocked={false} />);

      const badge = container.querySelector('.achievement-badge');
      expect(badge).toHaveStyle({ borderColor: '#4ECDC4' });
    });

    it('should apply correct color for improvement category', () => {
      const improvementAchievement: Achievement = {
        ...mockAchievement,
        category: 'improvement'
      };
      const { container } = render(<AchievementBadge achievement={improvementAchievement} isLocked={false} />);

      const badge = container.querySelector('.achievement-badge');
      expect(badge).toHaveStyle({ borderColor: '#FFD93D' });
    });

    it('should apply correct color for milestone category', () => {
      const milestoneAchievement: Achievement = {
        ...mockAchievement,
        category: 'milestone'
      };
      const { container } = render(<AchievementBadge achievement={milestoneAchievement} isLocked={false} />);

      const badge = container.querySelector('.achievement-badge');
      expect(badge).toHaveStyle({ borderColor: '#A78BFA' });
    });
  });

  describe('showDetails Prop', () => {
    it('should hide details when showDetails is false', () => {
      render(<AchievementBadge achievement={mockAchievement} showDetails={false} />);

      expect(screen.queryByText('Sharpshooter')).not.toBeInTheDocument();
      expect(screen.queryByText('50 pts')).not.toBeInTheDocument();
      expect(screen.getByText('🎯')).toBeInTheDocument(); // Icon still visible
    });

    it('should show details by default', () => {
      render(<AchievementBadge achievement={mockAchievement} />);

      expect(screen.getByText('Sharpshooter')).toBeInTheDocument();
      expect(screen.getByText('50 pts')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle achievement without earned_at date', () => {
      const achievementWithoutDate: Achievement = {
        ...mockAchievement,
        earned_at: undefined
      };
      render(<AchievementBadge achievement={achievementWithoutDate} isLocked={false} />);

      expect(screen.queryByText(/Nov/)).not.toBeInTheDocument();
    });

    it('should handle achievement without game_id', () => {
      const achievementWithoutGame: Achievement = {
        ...mockAchievement,
        game_id: undefined
      };
      render(<AchievementBadge achievement={achievementWithoutGame} isLocked={false} />);

      expect(screen.getByText('Sharpshooter')).toBeInTheDocument();
    });

    it('should render with empty criteria object', () => {
      const achievementWithEmptyCriteria: Achievement = {
        ...mockAchievement,
        criteria: {}
      };
      render(<AchievementBadge achievement={achievementWithEmptyCriteria} isLocked={false} />);

      expect(screen.getByText('Sharpshooter')).toBeInTheDocument();
    });
  });
});
