import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import ChangePasswordDialog from './ChangePasswordDialog';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  created_at: string;
  updated_at: string;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { user: currentUser, updateUser } = useAuth();

  const fetchUsers = async () => {
    try {
      setError(null);
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to fetch users');
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      setError(null);
      setSuccess(null);

      // Don&apos;t allow changing own role
      if (userId === currentUser?.id) {
        setError('Cannot change your own role');
        return;
      }

      await api.put(`/users/${userId}/role`, { role: newRole });
      setSuccess('User role updated successfully');
      fetchUsers(); // Refresh user list
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to update user role');
    }
  };

  const handleResetPassword = (user: User) => {
    setSelectedUser(user);
    setPasswordDialogOpen(true);
  };

  const handlePasswordChangeSuccess = (token?: string, updatedUser?: { id: number; username: string; email: string; role: string; passwordMustChange: boolean }) => {
    if (token && updatedUser && currentUser && selectedUser?.id === currentUser.id) {
      // Admin changed their own password - update token and user
      updateUser(token, updatedUser);
    }
    setSuccess(`Password reset successfully for ${selectedUser?.username}`);
    setSelectedUser(null);
  };

  if (!currentUser || currentUser.role !== 'admin') {
    return <div>You don&apos;t have permission to access this page.</div>;
  }

  return (
    <div className="user-management">
      <h2>User Management</h2>

      {error && (
        <div className="alert alert-error" style={{ color: 'red', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ color: 'green', marginBottom: '1rem' }}>
          {success}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={styles.th}>Username</th>
            <th style={styles.th}>Email</th>
            <th style={styles.th}>Current Role</th>
            <th style={styles.th}>Change Role</th>
            <th style={styles.th}>Password</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td style={styles.td}>{user.username}</td>
              <td style={styles.td}>{user.email}</td>
              <td style={styles.td}>{user.role}</td>
              <td style={styles.td}>
                <select
                  value={user.role}
                  onChange={(e) => handleRoleChange(user.id, e.target.value)}
                  disabled={user.id === currentUser.id}
                  style={styles.select}
                >
                  <option value="user">User</option>
                  <option value="coach">Coach</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td style={styles.td}>
                <button
                  onClick={() => handleResetPassword(user)}
                  style={styles.button}
                >
                  Reset Password
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedUser && (
        <ChangePasswordDialog
          userId={selectedUser.id}
          username={selectedUser.username}
          isOwnPassword={selectedUser.id === currentUser?.id}
          isOpen={passwordDialogOpen}
          onClose={() => {
            setPasswordDialogOpen(false);
            setSelectedUser(null);
          }}
          onSuccess={handlePasswordChangeSuccess}
        />
      )}
    </div>
  );
};

const styles = {
  th: {
    backgroundColor: '#f4f4f4',
    padding: '12px',
    textAlign: 'left' as const,
    borderBottom: '2px solid #ddd'
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid #ddd'
  },
  select: {
    padding: '6px',
    borderRadius: '4px',
    border: '1px solid #ddd'
  },
  button: {
    padding: '8px 16px',
    fontSize: '0.9rem',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#007bff',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 500
  }
};

export default UserManagement;