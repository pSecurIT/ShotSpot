import React from 'react';
import Spinner from './Spinner';

const RoutePending: React.FC = () => {
  return (
    <div className="route-pending" role="status" aria-live="polite">
      <div className="route-pending__hero">
        <Spinner size="lg" />
        <div>
          <strong className="route-pending__title">Loading page</strong>
          <p className="route-pending__message">Preparing your workspace and pulling in the latest data.</p>
        </div>
      </div>

      <div className="route-pending__grid" aria-hidden="true">
        <div className="route-pending__card route-pending__card--wide" />
        <div className="route-pending__card" />
        <div className="route-pending__card" />
      </div>
    </div>
  );
};

export default RoutePending;