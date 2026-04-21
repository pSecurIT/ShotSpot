import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import ChangePasswordDialog from './ChangePasswordDialog';
import CreateUserDialog from './CreateUserDialog';
import EditUserDialog from './EditUserDialog';
import StatePanel from './ui/StatePanel';
import Toast from './ui/Toast';
import PageLayout from './ui/PageLayout';
import useBreadcrumbs from '../hooks/useBreadcrumbs';

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
  const breadcrumbs = useBreadcrumbs();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'coach' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'username_asc' | 'username_desc' | 'role_asc' | 'last_login_desc' | 'created_desc'>('username_asc');
  const { user: currentUser, updateUser } = useAuth();

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const result = users.filter((user) => {
      if (roleFilter !== 'all' && user.role !== roleFilter) {
        return false;
      }

      if (statusFilter === 'active' && !user.is_active) {
        return false;
      }

      if (statusFilter === 'inactive' && user.is_active) {
        return false;
      }

      if (!query) {
        return true;
      }

      const lastLogin = user.last_login ? formatLastLogin(user.last_login).toLowerCase() : 'never';
      return (
        user.username.toLowerCase().includes(query)
        || user.email.toLowerCase().includes(query)
        || user.role.toLowerCase().includes(query)
        || lastLogin.includes(query)
      );
    });

    return result.sort((left, right) => {
      if (sortBy === 'username_asc') {
        return left.username.localeCompare(right.username);
      }

      if (sortBy === 'username_desc') {
        return right.username.localeCompare(left.username);
      }

      if (sortBy === 'role_asc') {
        return left.role.localeCompare(right.role) || left.username.localeCompare(right.username);
      }

      if (sortBy === 'last_login_desc') {
        const leftValue = left.last_login ? new Date(left.last_login).getTime() : 0;
        const rightValue = right.last_login ? new Date(right.last_login).getTime() : 0;
        return rightValue - leftValue;
      }

      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });
  }, [users, searchQuery, roleFilter, statusFilter, sortBy]);

  const hasActiveRefinements = Boolean(searchQuery.trim() || roleFilter !== 'all' || statusFilter !== 'all' || sortBy !== 'username_asc');

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];

    const sortLabelMap: Record<'username_asc' | 'username_desc' | 'role_asc' | 'last_login_desc' | 'created_desc', string> = {
      username_asc: 'Username A-Z',
      username_desc: 'Username Z-A',
      role_asc: 'Role A-Z',
      last_login_desc: 'Recently logged in',
      created_desc: 'Newest accounts'
    };

    if (searchQuery.trim()) {
      chips.push(`Search: ${searchQuery.trim()}`);
    }
    if (roleFilter !== 'all') {
      chips.push(`Role: ${roleFilter}`);
    }
    if (statusFilter !== 'all') {
      chips.push(`Status: ${statusFilter}`);
    }
    if (sortBy !== 'username_asc') {
      chips.push(`Sort: ${sortLabelMap[sortBy]}`);
    }

    return chips;
  }, [searchQuery, roleFilter, statusFilter, sortBy]);

  const clearAllRefinements = useCallback(() => {
    setSearchQuery('');
    setRoleFilter('all');
    setStatusFilter('all');
    setSortBy('username_asc');
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') {
      return;
    }

    fetchUsers();
  }, [currentUser]);

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
    const filteredUserIds = filteredUsers.map((item) => item.id);
    const allFilteredSelected = filteredUserIds.length > 0 && filteredUserIds.every((id) => selectedUsers.has(id));

    if (allFilteredSelected) {
      const nextSelected = new Set(selectedUsers);
      filteredUserIds.forEach((id) => nextSelected.delete(id));
      setSelectedUsers(nextSelected);
      return;
    }

    const nextSelected = new Set(selectedUsers);
    filteredUserIds.forEach((id) => nextSelected.add(id));
    setSelectedUsers(nextSelected);
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

  const showLoadErrorState = !loading && Boolean(error) && users.length === 0;
  const showInlineError = Boolean(error) && !showLoadErrorState;
  const filteredUserIds = filteredUsers.map((item) => item.id);
  const allFilteredSelected = filteredUserIds.length > 0 && filteredUserIds.every((id) => selectedUsers.has(id));

  return (
    <PageLayout
      title="User Management"
      eyebrow="Settings > User Management"
      description="Manage user roles, passwords, and account lifecycle."
      breadcrumbs={breadcrumbs}
      actions={(
        <div style={styles.headerActions}>
          <button
            onClick={() => setCreateDialogOpen(true)}
            style={styles.createButton}
            type="button"
          >
            + Create User
          </button>
          <button
            onClick={exportToCSV}
            style={styles.exportButton}
            title="Export users to CSV"
            type="button"
          >
            📥 Export CSV
          </button>
        </div>
      )}
    >
    <div className="user-management">

      {selectedUsers.size > 0 && (
        <div style={styles.bulkActionsBar}>
          <span role="status" aria-live="polite">{selectedUsers.size} user(s) selected</span>
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

      {loading && (
        <StatePanel
          variant="loading"
          title="Loading users"
          message="Preparing the admin roster, bulk actions, and role controls."
          className="user-management__feedback"
        />
      )}

      {showLoadErrorState && (
        <StatePanel
          variant="error"
          title="Couldn’t load users"
          message={error ?? undefined}
          actionLabel="Retry"
          onAction={() => {
            void fetchUsers();
          }}
          className="user-management__feedback"
        />
      )}

      {showInlineError && (
        <StatePanel
          variant="error"
          title="User action failed"
          message={error ?? undefined}
          actionLabel="Reload users"
          onAction={() => {
            void fetchUsers();
          }}
          compact
          className="user-management__feedback"
        />
      )}

      {!showLoadErrorState && !loading && (
        <div className="search-filters-container">
          <div className="search-box">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="search-input"
              placeholder="Search by username, email, role, or last login"
              aria-label="Search users"
            />
            {searchQuery.trim() && (
              <button
                type="button"
                className="clear-search"
                onClick={() => setSearchQuery('')}
                aria-label="Clear user search"
                title="Clear search"
              >
                x
              </button>
            )}
          </div>

          <div className="filters-row">
            <div className="filter-group">
              <label htmlFor="users_role_filter">Role filter</label>
              <select
                id="users_role_filter"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as 'all' | 'user' | 'coach' | 'admin')}
                className="filter-select"
              >
                <option value="all">All roles</option>
                <option value="user">User</option>
                <option value="coach">Coach</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="users_status_filter">Status filter</label>
              <select
                id="users_status_filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
                className="filter-select"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="users_sort">Sort by</label>
              <select
                id="users_sort"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as 'username_asc' | 'username_desc' | 'role_asc' | 'last_login_desc' | 'created_desc')}
                className="filter-select"
              >
                <option value="username_asc">Username A-Z</option>
                <option value="username_desc">Username Z-A</option>
                <option value="role_asc">Role A-Z</option>
                <option value="last_login_desc">Recently logged in</option>
                <option value="created_desc">Newest accounts</option>
              </select>
            </div>

            <button
              type="button"
              onClick={clearAllRefinements}
              className="secondary-button"
              disabled={!hasActiveRefinements}
            >
              Clear all
            </button>
          </div>

          <div className="active-filters" aria-label="Active user filters">
            {activeFilterChips.length > 0 ? (
              activeFilterChips.map((chip) => (
                <span key={chip} className="active-filter-chip">{chip}</span>
              ))
            ) : (
              <span className="active-filter-chip active-filter-chip--muted">No active filters</span>
            )}
          </div>

          <div className="results-count" aria-live="polite">
            Showing {filteredUsers.length} of {users.length} users
          </div>
        </div>
      )}

      {!showLoadErrorState && !loading && filteredUsers.length === 0 ? (
        <StatePanel
          variant="empty"
          title="No users found"
          message={hasActiveRefinements ? 'Try broadening your search or clear all filters to find the user faster.' : 'Create the first user account to start assigning roles and permissions.'}
          actionLabel={hasActiveRefinements ? 'Clear all filters' : 'Create user'}
          onAction={hasActiveRefinements ? clearAllRefinements : () => setCreateDialogOpen(true)}
          className="user-management__feedback"
        />
      ) : !loading && !showLoadErrorState ? (
      <table style={{ width: '100%', borderCollapse: 'collapse' }} aria-label="User management table">
        <thead>
          <tr>
            <th style={styles.th}>
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleSelectAll}
                title="Select all visible users"
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
          {filteredUsers.map(user => (
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
      ) : null}

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

      {success && (
        <Toast
          title="User updated"
          message={success}
          onDismiss={() => setSuccess(null)}
        />
      )}
    </div>
    </PageLayout>
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
    backgroundColor: 'var(--secondary-color)',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 500
  },
  exportButton: {
    padding: '10px 20px',
    fontSize: '1rem',
    border: '1px solid var(--primary-color)',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-light)',
    color: 'var(--primary-color)',
    cursor: 'pointer',
    fontWeight: 500
  },
  bulkActionsBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: 'rgba(41, 98, 255, 0.12)',
    color: 'var(--text-primary)',
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
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--background-light)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: '0.95rem'
  },
  clearSelectionButton: {
    padding: '8px 16px',
    fontSize: '0.95rem',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-light)',
    color: 'var(--text-primary)',
    cursor: 'pointer'
  },
  selectedRow: {
    backgroundColor: 'rgba(41, 98, 255, 0.12)'
  },
  th: {
    backgroundColor: 'var(--hover-bg)',
    color: 'var(--text-primary)',
    padding: '12px',
    textAlign: 'left' as const,
    borderBottom: '2px solid var(--border-color)'
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid var(--border-color)',
    color: 'var(--text-primary)'
  },
  select: {
    padding: '6px',
    borderRadius: '4px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--background-light)',
    color: 'var(--text-primary)'
  },
  actionButtons: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  editButton: {
    padding: '6px 10px',
    fontSize: '1rem',
    border: '1px solid var(--primary-color)',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-light)',
    color: 'var(--text-primary)',
    cursor: 'pointer'
  },
  passwordButton: {
    padding: '6px 10px',
    fontSize: '1rem',
    border: '1px solid #ffc107',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-light)',
    color: 'var(--text-primary)',
    cursor: 'pointer'
  },
  deleteButton: {
    padding: '6px 10px',
    fontSize: '1rem',
    border: '1px solid var(--danger-color)',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-light)',
    color: 'var(--text-primary)',
    cursor: 'pointer'
  },
  confirmDeleteButton: {
    padding: '6px 10px',
    fontSize: '1rem',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: 'var(--danger-color)',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  cancelDeleteButton: {
    padding: '6px 10px',
    fontSize: '1rem',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-light)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontWeight: 'bold'
  }
};

export default UserManagement;