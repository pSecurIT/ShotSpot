import React from 'react';
import Spinner from './Spinner';

export type StatePanelVariant = 'loading' | 'empty' | 'error' | 'info';

interface StatePanelProps {
  variant: StatePanelVariant;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  className?: string;
}

const iconMap: Record<Exclude<StatePanelVariant, 'loading'>, string> = {
  empty: '◦',
  error: '!',
  info: 'i',
};

const StatePanel: React.FC<StatePanelProps> = ({
  variant,
  title,
  message,
  actionLabel,
  onAction,
  compact = false,
  className = '',
}) => {
  const classes = [
    'state-panel',
    `state-panel--${variant}`,
    compact ? 'state-panel--compact' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const ariaProps = variant === 'error'
    ? { role: 'alert' as const }
    : { role: 'status' as const, 'aria-live': 'polite' as const };

  return (
    <div className={classes} {...ariaProps}>
      <div className="state-panel__media" aria-hidden="true">
        {variant === 'loading' ? <Spinner size={compact ? 'sm' : 'md'} /> : <span className="state-panel__icon">{iconMap[variant]}</span>}
      </div>

      <div className="state-panel__content">
        <strong className="state-panel__title">{title}</strong>
        {message && <p className="state-panel__message">{message}</p>}
        {actionLabel && onAction && (
          <button type="button" className="state-panel__action" onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export default StatePanel;