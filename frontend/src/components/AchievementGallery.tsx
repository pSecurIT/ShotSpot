import React from 'react';
import AchievementBadge from './AchievementBadge';
import type { Achievement } from '../types/achievements';

interface AchievementGalleryProps {
  achievements: Achievement[];
  earnedAchievements?: Achievement[];
  emptyMessage?: string;
  size?: 'small' | 'medium' | 'large';
  showDetails?: boolean;
}

const AchievementGallery: React.FC<AchievementGalleryProps> = ({
  achievements,
  earnedAchievements = [],
  emptyMessage = 'No achievements match the current filters.',
  size = 'medium',
  showDetails = true,
}) => {
  if (achievements.length === 0) {
    return <p className="achievements-page__empty" role="status" aria-live="polite">{emptyMessage}</p>;
  }

  return (
    <div className="achievements-page__gallery">
      {achievements.map((achievement) => {
        const earned = earnedAchievements.find((item) => item.name === achievement.name);

        return (
          <AchievementBadge
            key={achievement.id}
            achievement={earned ? { ...achievement, earned_at: earned.earned_at } : achievement}
            isLocked={!earned}
            size={size}
            showDetails={showDetails}
          />
        );
      })}
    </div>
  );
};

export default AchievementGallery;