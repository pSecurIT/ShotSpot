import React, { useEffect, useState } from 'react';
import type { Achievement } from '../types/achievements';
import '../styles/AchievementNotification.css';

interface AchievementNotificationProps {
  achievement: Achievement | null;
  onClose: () => void;
  autoHideDuration?: number;
}

const AchievementNotification: React.FC<AchievementNotificationProps> = ({
  achievement,
  onClose,
  autoHideDuration = 5000
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = React.useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 400); // Match exit animation duration
  }, [onClose]);

  useEffect(() => {
    if (achievement) {
      // Use requestAnimationFrame to avoid cascading renders
      requestAnimationFrame(() => {
        setIsVisible(true);
        setIsExiting(false);
      });

      const hideTimer = setTimeout(() => {
        handleClose();
      }, autoHideDuration);

      return () => clearTimeout(hideTimer);
    }
  }, [achievement, autoHideDuration, handleClose]);

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

  if (!achievement || !isVisible) {
    return null;
  }

  return (
    <div className={`achievement-notification ${isExiting ? 'achievement-notification--exiting' : ''}`}>
      <div 
        className="achievement-notification__content"
        style={{
          borderLeftColor: getCategoryColor(achievement.category)
        }}
      >
        <div className="achievement-notification__header">
          <div className="achievement-notification__title-container">
            <span className="achievement-notification__trophy">🎉</span>
            <h4 className="achievement-notification__title">Achievement Unlocked!</h4>
          </div>
          <button
            className="achievement-notification__close"
            onClick={handleClose}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>

        <div className="achievement-notification__body">
          <div 
            className="achievement-notification__icon"
            style={{
              backgroundColor: getCategoryColor(achievement.category) + '20'
            }}
          >
            <span className="achievement-notification__badge">
              {achievement.badge_icon}
            </span>
          </div>

          <div className="achievement-notification__details">
            <h5 className="achievement-notification__name">{achievement.name}</h5>
            <p className="achievement-notification__description">
              {achievement.description}
            </p>
            <div className="achievement-notification__footer">
              <span 
                className="achievement-notification__points"
                style={{
                  backgroundColor: getCategoryColor(achievement.category)
                }}
              >
                +{achievement.points} points
              </span>
              <span 
                className="achievement-notification__category"
                style={{
                  color: getCategoryColor(achievement.category)
                }}
              >
                {achievement.category}
              </span>
            </div>
          </div>
        </div>

        <div 
          className="achievement-notification__progress"
          style={{
            backgroundColor: getCategoryColor(achievement.category)
          }}
        ></div>
      </div>
    </div>
  );
};

export default AchievementNotification;
