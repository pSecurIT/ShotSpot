import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import ChangePasswordDialog from './ChangePasswordDialog';
import CreateUserDialog from './CreateUserDialog';
import EditUserDialog from './EditUserDialog';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
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

  const handleCreateUser = (user: { id: number; username: string; email: string; role: string }) => {
    setSuccess(`User ${user.username} created successfully`);
    fetchUsers();
  };

  const handleEditUser = (userId: number) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setSelectedUser(user);
      setEditDialogOpen(true);
    }
  };

  const handleEditSuccess = (updatedUser: { id: number; username: string; email: string; role: string }) => {
    setSuccess(`User ${updatedUser.username} updated successfully`);
    setSelectedUser(null);
    fetchUsers();
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      setError(null);
      setSuccess(null);

      await api.delete(`/users/${userId}`);
      setSuccess('User deactivated successfully');
      setDeleteConfirm(null);
      fetchUsers();
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to delete user');
      setDeleteConfirm(null);
    }
  };

  const formatLastLogin = (lastLogin: string | null) => {
    if (!lastLogin) return 'Never';
    
    const date = new Date(lastLogin);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };

  const exportToCSV = () => {
    const headers = ['Username', 'Email', 'Role', 'Last Login', 'Created At'];
    const csvData = users.map(user => [
      user.username,
      user.email,
      user.role,
      user.last_login ? new Date(user.last_login).toISOString() : 'Never',
      new Date(user.created_at).toISOString()
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `users_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleUserSelection = (userId: number) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)));
    }
  };

  const handleBulkRoleChange = async (newRole: string) => {
    if (selectedUsers.size === 0) {
      setError('No users selected');
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const userIds = Array.from(selectedUsers);
      
      // Check if trying to change own role
      if (userIds.includes(currentUser!.id)) {
        setError('Cannot change your own role in bulk operation');
        return;
      }

      await api.post('/users/bulk-role-change', {
        userIds,
        role: newRole
      });

      setSuccess(`Successfully updated role for ${userIds.length} user(s)`);
      setSelectedUsers(new Set());
      fetchUsers();
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to update user roles');
    }
  };

  if (!currentUser || currentUser.role !== 'admin') {
    return <div>You don&apos;t have permission to access this page.</div>;
  }

  return (
    <div className="user-management">
      <div style={styles.headerContainer}>
        <h2>User Management</h2>
        <div style={styles.headerActions}>
          <button
            onClick={() => setCreateDialogOpen(true)}
            style={styles.createButton}
          >
            + Create User
          </button>
          <button
            onClick={exportToCSV}
            style={styles.exportButton}
            title="Export users to CSV"
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {selectedUsers.size > 0 && (
        <div style={styles.bulkActionsBar}>
          <span>{selectedUsers.size} user(s) selected</span>
          <div style={styles.bulkButtons}>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkRoleChange(e.target.value);
                  e.target.value = '';
                }
              }}
              style={styles.bulkSelect}
              defaultValue=""
            >
              <option value="" disabled>Change Role...</option>
              <option value="user">Change to User</option>
              <option value="coach">Change to Coach</option>
              <option value="admin">Change to Admin</option>
            </select>
            <button
              onClick={() => setSelectedUsers(new Set())}
              style={styles.clearSelectionButton}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

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
            <th style={styles.th}>
              <input
                type="checkbox"
                checked={selectedUsers.size === users.length && users.length > 0}
                onChange={toggleSelectAll}
                title="Select all users"
              />
            </th>
            <th style={styles.th}>Username</th>
            <th style={styles.th}>Email</th>
            <th style={styles.th}>Role</th>
            <th style={styles.th}>Last Login</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id} style={selectedUsers.has(user.id) ? styles.selectedRow : undefined}>
              <td style={styles.td}>
                <input
                  type="checkbox"
                  checked={selectedUsers.has(user.id)}
                  onChange={() => toggleUserSelection(user.id)}
                />
              </td>
              <td style={styles.td}>{user.username}</td>
              <td style={styles.td}>{user.email}</td>
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
              <td style={styles.td}>{formatLastLogin(user.last_login)}</td>
              <td style={styles.td}>
                <div style={styles.actionButtons}>
                  <button
                    onClick={() => handleEditUser(user.id)}
                    style={styles.editButton}
                    title="Edit profile"
                    aria-label="Edit profile"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleResetPassword(user)}
                    style={styles.passwordButton}
                    title="Reset password"
                    aria-label="Reset password"
                  >
                    🔑
                  </button>
                  {deleteConfirm === user.id ? (
                    <>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        style={styles.confirmDeleteButton}
                        title="Confirm delete"
                        aria-label="Confirm delete"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        style={styles.cancelDeleteButton}
                        title="Cancel"
                        aria-label="Cancel"
                      >
                        ✗
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(user.id)}
                      style={styles.deleteButton}
                      disabled={user.id === currentUser.id}
                      title={user.id === currentUser.id ? 'Cannot delete yourself' : 'Delete user'}
                      aria-label={user.id === currentUser.id ? 'Cannot delete yourself' : 'Delete user'}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <CreateUserDialog
        isOpen={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={handleCreateUser}
      />

      <EditUserDialog
        isOpen={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedUser(null);
        }}
        onSuccess={handleEditSuccess}
        user={selectedUser}
      />

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
  headerContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem'
  },
  headerActions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  },
  createButton: {
    padding: '10px 20px',
    fontSize: '1rem',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#28a745',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 500
  },
  exportButton: {
    padding: '10px 20px',
    fontSize: '1rem',
    border: '1px solid #007bff',
    borderRadius: '4px',
    backgroundColor: 'white',
    color: '#007bff',
    cursor: 'pointer',
    fontWeight: 500
  },
  bulkActionsBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: '#e3f2fd',
    borderRadius: '4px',
    marginBottom: '1rem'
  },
  bulkButtons: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  },
  bulkSelect: {
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #007bff',
    backgroundColor: 'white',
    cursor: 'pointer',
    fontSize: '0.95rem'
  },
  clearSelectionButton: {
    padding: '8px 16px',
    fontSize: '0.95rem',
    border: '1px solid #6c757d',
    borderRadius: '4px',
    backgroundColor: 'white',
    color: '#6c757d',
    cursor: 'pointer'
  },
  selectedRow: {
    backgroundColor: '#e3f2fd'
  },
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
  actionButtons: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  editButton: {
    padding: '6px 10px',
    fontSize: '1rem',
    border: '1px solid #007bff',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer'
  },
  passwordButton: {
    padding: '6px 10px',
    fontSize: '1rem',
    border: '1px solid #ffc107',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer'
  },
  deleteButton: {
    padding: '6px 10px',
    fontSize: '1rem',
    border: '1px solid #dc3545',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer'
  },
  confirmDeleteButton: {
    padding: '6px 10px',
    fontSize: '1rem',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#dc3545',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  cancelDeleteButton: {
    padding: '6px 10px',
    fontSize: '1rem',
    border: '1px solid #6c757d',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
    fontWeight: 'bold'
  }
};

export default UserManagement;