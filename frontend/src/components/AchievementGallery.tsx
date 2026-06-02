import React, { useMemo } from 'react';
import { List, type RowComponentProps } from 'react-window';
import AchievementBadge from './AchievementBadge';
import type { Achievement } from '../types/achievements';

const VIRTUALIZATION_THRESHOLD = 80;
const ACHIEVEMENT_ROW_HEIGHT = 168;

type AchievementRowProps = {
  achievements: Achievement[];
  earnedByName: Map<string, Achievement>;
  size: 'small' | 'medium' | 'large';
  showDetails: boolean;
};

const AchievementRow = ({
  index,
  style,
  achievements,
  earnedByName,
  size,
  showDetails
}: RowComponentProps<AchievementRowProps>): React.ReactElement => {
  const achievement = achievements[index];
  const earned = earnedByName.get(achievement.name);

  return (
    <div style={style} className="achievements-page__gallery-row">
      <AchievementBadge
        achievement={earned ? { ...achievement, earned_at: earned.earned_at } : achievement}
        isLocked={!earned}
        size={size}
        showDetails={showDetails}
      />
    </div>
  );
};

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
  const earnedByName = useMemo(() => {
    return new Map(earnedAchievements.map((achievement) => [achievement.name, achievement]));
  }, [earnedAchievements]);

  if (achievements.length === 0) {
    return <p className="achievements-page__empty" role="status" aria-live="polite">{emptyMessage}</p>;
  }

  if (achievements.length > VIRTUALIZATION_THRESHOLD) {
    return (
      <div className="achievements-page__gallery achievements-page__gallery--virtualized">
        <List
          rowCount={achievements.length}
          rowHeight={ACHIEVEMENT_ROW_HEIGHT}
          rowComponent={AchievementRow}
          rowProps={{
            achievements,
            earnedByName,
            size,
            showDetails
          }}
          style={{ height: Math.min(720, achievements.length * ACHIEVEMENT_ROW_HEIGHT) }}
        />
      </div>
    );
  }

  return (
    <div className="achievements-page__gallery">
      {achievements.map((achievement) => {
        const earned = earnedByName.get(achievement.name);

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