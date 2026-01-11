import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const UserProfile: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return <div style={{ padding: 20 }}>You must be logged in.</div>;
  }

  return (
    <div style={{ padding: 20, maxWidth: 720, margin: '0 auto' }}>
      <h2>My Profile</h2>
      <div style={{ marginTop: 12 }}>
        <div><strong>Username:</strong> {user.username}</div>
        <div><strong>Email:</strong> {user.email}</div>
        <div><strong>Role:</strong> {user.role}</div>
      </div>
      <p style={{ marginTop: 16, opacity: 0.8 }}>
        More profile settings can be added later.
      </p>
    </div>
  );
};

export default UserProfile;
