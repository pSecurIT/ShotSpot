import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navigation: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navigation">
      {user ? (
        <>
          <Link to="/games">Games</Link>
          <Link to="/teams">Teams</Link>
          <Link to="/players">Players</Link>
          {user.role === 'admin' && <Link to="/users">Users</Link>}
          <span className="user-info">
            Welcome, {user.username} ({user.role})!
          </span>
          <button onClick={handleLogout}>Logout</button>
        </>
      ) : (
        <>
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
        </>
      )}
    </nav>
  );
};

export default Navigation;