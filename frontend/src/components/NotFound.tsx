import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const NotFound: React.FC = () => {
  const location = useLocation();

  return (
    <div style={{ padding: 20, maxWidth: 720, margin: '0 auto' }}>
      <h2>Page not found</h2>
      <p style={{ marginTop: 12 }}>
        No route matches <code>{location.pathname}</code>.
      </p>
      <p style={{ marginTop: 12 }}>
        Go back to the <Link to="/dashboard">dashboard</Link>.
      </p>
    </div>
  );
};

export default NotFound;
