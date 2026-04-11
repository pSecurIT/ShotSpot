import React from 'react';
import StatePanel from './ui/StatePanel';

interface DashboardWidgetProps {
  title: string;
  icon?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const DashboardWidget: React.FC<DashboardWidgetProps> = ({
  title,
  icon,
  loading = false,
  error,
  onRetry,
  actions,
  children
}) => {
  return (
    <section className="dashboard-widget" aria-label={title}>
      <div className="dashboard-widget__header">
        <h2 className="dashboard-widget__title">
          {icon && (
            <span className="dashboard-widget__icon-shell" aria-hidden="true">
              <span className="dashboard-widget__icon">{icon}</span>
            </span>
          )}
          <span>{title}</span>
        </h2>
        {actions && <div className="dashboard-widget__actions">{actions}</div>}
      </div>

      <div className="dashboard-widget__body">
        {loading ? (
          <StatePanel
            variant="loading"
            title={`Loading ${title.toLowerCase()}`}
            message="Pulling in the latest data without shifting the layout."
            compact
            className="dashboard-widget__state"
          />
        ) : error ? (
          <StatePanel
            variant="error"
            title={`Couldn’t load ${title.toLowerCase()}`}
            message={error}
            actionLabel={onRetry ? 'Retry' : undefined}
            onAction={onRetry}
            compact
            className="dashboard-widget__state"
          />
        ) : (
          children
        )}
      </div>
    </section>
  );
};

export default DashboardWidget;
