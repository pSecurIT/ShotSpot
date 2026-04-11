import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface QuickAction {
  label: string;
  icon: string;
  to: string;
  roles?: Array<'user' | 'coach' | 'admin'>;
}

const QuickActions: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const role = (user?.role as 'user' | 'coach' | 'admin' | undefined) ?? undefined;

  const actions: QuickAction[] = [
    { label: 'New Game', icon: '➕', to: '/games', roles: ['coach', 'admin'] },
    { label: 'View Games', icon: '🎮', to: '/games' },
    { label: 'View Analytics', icon: '📊', to: '/analytics' },
    { label: 'Teams', icon: '🏃', to: '/teams' },
    { label: 'Players', icon: '👥', to: '/players' },
    { label: 'Export Center', icon: '📤', to: '/exports', roles: ['coach', 'admin'] },
    { label: 'My Achievements', icon: '🏆', to: '/my-achievements' }
  ];

  const visibleActions = actions.filter((action) => {
    if (!action.roles) return true;
    if (!role) return false;
    return action.roles.includes(role);
  });

  return (
    <div className="quick-actions" aria-label="Quick actions">
      {visibleActions.map((action, index) => (
        <button
          key={action.label}
          type="button"
          className={`quick-actions__button ${index === 0 ? 'quick-actions__button--primary' : 'quick-actions__button--secondary'}`}
          onClick={() => navigate(action.to)}
        >
          <span className="quick-actions__icon" aria-hidden="true">{action.icon}</span>
          <span className="quick-actions__label">{action.label}</span>
        </button>
      ))}
    </div>
  );
};

export default QuickActions;
