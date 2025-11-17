import React, { useState } from 'react';
import api from '../utils/api';

interface ChangePasswordDialogProps {
  userId: number;
  username: string;
  isOwnPassword: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token?: string, user?: { id: number; username: string; email: string; role: string; passwordMustChange: boolean }) => void;
  isForced?: boolean;
}

const ChangePasswordDialog: React.FC<ChangePasswordDialogProps> = ({
  userId,
  username,
  isOwnPassword,
  isOpen,
  onClose,
  onSuccess,
  isForced = false
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(password)) {
      return 'Password must contain at least one number';
    }
    if (!/(?=.*[^a-zA-Z0-9])/.test(password)) {
      return 'Password must contain at least one special character';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (isOwnPassword && !currentPassword) {
      setError('Current password is required');
      return;
    }

    setLoading(true);

    try {
      let token: string | undefined;
      let user: { id: number; username: string; email: string; role: string; passwordMustChange: boolean } | undefined;

      if (isOwnPassword) {
        // User changing their own password - backend returns new token
        const response = await api.post('/auth/change-password', {
          currentPassword,
          newPassword
        });
        token = response.data.token;
        user = response.data.user;
      } else {
        // Admin resetting another user's password
        await api.put(`/users/${userId}/password`, {
          newPassword
        });
      }

      onSuccess(token, user);
      handleClose();
    } catch (err) {
      const error = err as { response?: { data?: { error?: string; errors?: Array<{ msg: string }> } }; message?: string };
      if (error.response?.data?.errors) {
        setError(error.response.data.errors.map(e => e.msg).join(', '));
      } else {
        setError(error.response?.data?.error || 'Failed to change password');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.dialog}>
        <div style={styles.header}>
          <h3 style={styles.title}>
            {isOwnPassword ? 'Change Your Password' : `Reset Password for ${username}`}
          </h3>
          {!isForced && (
            <button
              onClick={handleClose}
              style={styles.closeButton}
              disabled={loading}
              aria-label="Close dialog"
            >
              ×
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {isForced && (
            <div style={styles.warning}>
              ⚠️ You must change your password before continuing. This is your first login or your password was reset by an administrator.
            </div>
          )}
          
          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          {isOwnPassword && (
            <div style={styles.field}>
              <label htmlFor="currentPassword" style={styles.label}>
                Current Password *
              </label>
              <input
                type="password"
                id="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={styles.input}
                disabled={loading}
                required
                autoComplete="current-password"
              />
            </div>
          )}

          <div style={styles.field}>
            <label htmlFor="newPassword" style={styles.label}>
              New Password *
            </label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={styles.input}
              disabled={loading}
              required
              autoComplete="new-password"
            />
            <small style={styles.hint}>
              Must be at least 8 characters with uppercase, lowercase, number, and special character
            </small>
          </div>

          <div style={styles.field}>
            <label htmlFor="confirmPassword" style={styles.label}>
              Confirm New Password *
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={styles.input}
              disabled={loading}
              required
              autoComplete="new-password"
            />
          </div>

          <div style={styles.actions}>
            {!isForced && (
              <button
                type="button"
                onClick={handleClose}
                style={styles.cancelButton}
                disabled={loading}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              style={styles.submitButton}
              disabled={loading}
            >
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  dialog: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    maxWidth: '500px',
    width: '90%',
    maxHeight: '90vh',
    overflow: 'auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #e0e0e0'
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 600
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '2rem',
    cursor: 'pointer',
    color: '#666',
    padding: '0',
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1
  },
  error: {
    backgroundColor: '#fee',
    color: '#c33',
    padding: '12px',
    borderRadius: '4px',
    marginBottom: '16px',
    fontSize: '0.9rem'
  },
  warning: {
    backgroundColor: '#fff3cd',
    color: '#856404',
    padding: '12px',
    borderRadius: '4px',
    marginBottom: '16px',
    fontSize: '0.9rem',
    border: '1px solid #ffeaa7'
  },
  field: {
    marginBottom: '20px',
    padding: '0 20px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 500,
    color: '#333'
  },
  input: {
    width: '100%',
    padding: '10px',
    fontSize: '1rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    boxSizing: 'border-box' as const
  },
  hint: {
    display: 'block',
    marginTop: '6px',
    fontSize: '0.85rem',
    color: '#666'
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '20px',
    borderTop: '1px solid #e0e0e0'
  },
  cancelButton: {
    padding: '10px 20px',
    fontSize: '1rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: 'white',
    color: '#333',
    cursor: 'pointer'
  },
  submitButton: {
    padding: '10px 20px',
    fontSize: '1rem',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#007bff',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 500
  }
};

export default ChangePasswordDialog;
