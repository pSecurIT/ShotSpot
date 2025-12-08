import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ChangePasswordDialog from './ChangePasswordDialog';

const Navigation: React.FC = () => {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handlePasswordChangeSuccess = (token?: string, updatedUser?: { id: number; username: string; email: string; role: string; passwordMustChange: boolean }) => {
    if (token && updatedUser) {
      // Update token and user in context (removes passwordMustChange flag)
      updateUser(token, updatedUser);
    }
    
    // Show success message
    alert('Password changed successfully!');
    
    // Navigate to teams page to refresh the view without a full page reload
    navigate('/teams');
  };

  return (
    <nav className="navigation">
      {user ? (
        <>
          <Link to="/games">Games</Link>
          <Link to="/teams">Teams</Link>
          <Link to="/players">Players</Link>
          <Link to="/templates">Templates</Link>
          <Link to="/exports">Exports</Link>
          {user.role === 'admin' && <Link to="/users">Users</Link>}
          <span className="user-info">
            Welcome, {user.username} ({user.role})!
          </span>
          <button onClick={() => setShowPasswordDialog(true)}>Change Password</button>
          <button onClick={handleLogout}>Logout</button>

          {user && (
            <ChangePasswordDialog
              userId={user.id}
              username={user.username}
              isOwnPassword={true}
              isOpen={showPasswordDialog || user.passwordMustChange === true}
              isForced={user.passwordMustChange === true}
              onClose={() => {
                // Don't allow closing if password must be changed
                if (!user.passwordMustChange) {
                  setShowPasswordDialog(false);
                }
              }}
              onSuccess={handlePasswordChangeSuccess}
            />
          )}
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