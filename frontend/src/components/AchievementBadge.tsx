import React from 'react';
import type { Achievement } from '../types/achievements';
import '../styles/AchievementBadge.css';

interface AchievementBadgeProps {
  achievement: Achievement;
  isLocked?: boolean;
  size?: 'small' | 'medium' | 'large';
  showDetails?: boolean;
}

const AchievementBadge: React.FC<AchievementBadgeProps> = ({
  achievement,
  isLocked = false,
  size = 'medium',
  showDetails = true
}) => {
  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'shooting':
        return '#FF6B6B';
      case 'consistency':
        return '#4ECDC4';
      case 'improvement':
        return '#FFD93D';
      case 'milestone':
        return '#A78BFA';
      default:
        return '#6C757D';
    }
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div 
      className={`achievement-badge achievement-badge--${size} ${isLocked ? 'achievement-badge--locked' : 'achievement-badge--unlocked'}`}
      style={{ borderColor: isLocked ? '#6C757D' : getCategoryColor(achievement.category) }}
    >
      <div className="achievement-badge__icon-container">
        <div 
          className="achievement-badge__icon"
          style={{
            backgroundColor: isLocked ? '#E9ECEF' : getCategoryColor(achievement.category) + '20'
          }}
        >
          <span className={isLocked ? 'achievement-badge__icon-locked' : ''}>
            {achievement.badge_icon}
          </span>
        </div>
        {!isLocked && achievement.earned_at && (
          <div className="achievement-badge__earned-indicator">✓</div>
        )}
      </div>

      {showDetails && (
        <div className="achievement-badge__content">
          <div className="achievement-badge__header">
            <h4 className="achievement-badge__name">{achievement.name}</h4>
            <span 
              className="achievement-badge__points"
              style={{ 
                backgroundColor: isLocked ? '#6C757D' : getCategoryColor(achievement.category),
                opacity: isLocked ? 0.5 : 1
              }}
            >
              {achievement.points} pts
            </span>
          </div>

          <p className={`achievement-badge__description ${isLocked ? 'achievement-badge__description--locked' : ''}`}>
            {isLocked ? '???' : achievement.description}
          </p>

          <div className="achievement-badge__footer">
            <span 
              className="achievement-badge__category"
              style={{ 
                color: isLocked ? '#6C757D' : getCategoryColor(achievement.category) 
              }}
            >
              {achievement.category}
            </span>
            {!isLocked && achievement.earned_at && (
              <span className="achievement-badge__date">
                {formatDate(achievement.earned_at)}
              </span>
            )}
          </div>
        </div>
      )}

      {isLocked && (
        <div className="achievement-badge__locked-overlay">
          <span className="achievement-badge__locked-icon">🔒</span>
        </div>
      )}
    </div>
  );
};

export default AchievementBadge;
