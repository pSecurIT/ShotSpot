import React, { useState, useEffect } from 'react';
import api from '../utils/api';

interface EditUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: {
    id: number;
    username: string;
    email: string;
    role: string;
  }) => void;
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
  } | null;
}

const EditUserDialog: React.FC<EditUserDialogProps> = ({ isOpen, onClose, onSuccess, user }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Populate form when user prop changes
  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setEmail(user.email);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    setError(null);
    setLoading(true);

    try {
      const response = await api.patch(`/users/${user.id}`, {
        username,
        email
      });

      onSuccess(response.data);
      onClose();
    } catch (err) {
      const error = err as { 
        response?: { 
          data?: { 
            error?: string;
            errors?: Array<{ msg: string }>;
          } 
        }; 
        message?: string 
      };
      
      if (error.response?.data?.errors) {
        setError(error.response.data.errors.map(e => e.msg).join(', '));
      } else {
        setError(error.response?.data?.error || 'Failed to update user');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.dialog}>
        <div style={styles.header}>
          <h3 style={styles.title}>Edit User Profile</h3>
          <button
            onClick={onClose}
            style={styles.closeButton}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error && (
          <div style={styles.errorAlert}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label htmlFor="edit-username" style={styles.label}>
              Username *
            </label>
            <input
              id="edit-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={50}
              pattern="[a-zA-Z0-9_-]+"
              title="Username can only contain letters, numbers, underscores, and hyphens"
              style={styles.input}
              disabled={loading}
            />
            <small style={styles.hint}>3-50 characters, letters, numbers, _ and - only</small>
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="edit-email" style={styles.label}>
              Email *
            </label>
            <input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={styles.input}
              disabled={loading}
            />
          </div>

          <div style={styles.actions}>
            <button
              type="button"
              onClick={onClose}
              style={styles.cancelButton}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={styles.submitButton}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
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
    padding: '24px',
    width: '90%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
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
    lineHeight: 1,
    padding: 0,
    width: '32px',
    height: '32px'
  },
  errorAlert: {
    backgroundColor: '#fee',
    color: '#c00',
    padding: '12px',
    borderRadius: '4px',
    marginBottom: '16px',
    border: '1px solid #fcc'
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px'
  },
  label: {
    fontWeight: 500,
    fontSize: '0.9rem',
    color: '#333'
  },
  input: {
    padding: '10px',
    fontSize: '1rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    marginBottom: '4px'
  },
  hint: {
    fontSize: '0.8rem',
    color: '#666',
    fontStyle: 'italic'
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '8px'
  },
  cancelButton: {
    padding: '10px 20px',
    fontSize: '1rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
    fontWeight: 500
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

export default EditUserDialog;
