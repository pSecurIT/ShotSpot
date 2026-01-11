import React from 'react';

interface DashboardWidgetProps {
  title: string;
  icon?: string;
  loading?: boolean;
  error?: string | null;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const DashboardWidget: React.FC<DashboardWidgetProps> = ({
  title,
  icon,
  loading = false,
  error,
  actions,
  children
}) => {
  return (
    <section className="dashboard-widget" aria-label={title}>
      <div className="dashboard-widget__header">
        <h2 className="dashboard-widget__title">
          {icon && <span className="dashboard-widget__icon" aria-hidden="true">{icon}</span>}
          <span>{title}</span>
        </h2>
        {actions && <div className="dashboard-widget__actions">{actions}</div>}
      </div>

      <div className="dashboard-widget__body">
        {loading ? (
          <div className="dashboard-widget__loading">Loading…</div>
        ) : error ? (
          <div className="dashboard-widget__error" role="alert">{error}</div>
        ) : (
          children
        )}
      </div>
    </section>
  );
};

export default DashboardWidget;
