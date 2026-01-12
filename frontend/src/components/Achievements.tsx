import React from 'react';
import { Link } from 'react-router-dom';

const Achievements: React.FC = () => {
  return (
    <div style={{ padding: 20, maxWidth: 720, margin: '0 auto' }}>
      <h2>Achievements</h2>
      <p style={{ marginTop: 12 }}>
        Achievements are currently shown inside Match Analytics for a selected game.
      </p>
      <p style={{ marginTop: 12 }}>
        Go to <Link to="/games">Games</Link> and open analytics for a match.
      </p>
    </div>
  );
};

export default Achievements;
