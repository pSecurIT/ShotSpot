import React, { useState } from 'react';
import api from '../utils/api';

interface CreateUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: {
    id: number;
    username: string;
    email: string;
    role: string;
  }) => void;
}

const CreateUserDialog: React.FC<CreateUserDialogProps> = ({ isOpen, onClose, onSuccess }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'coach' | 'admin'>('user');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Returns a cryptographically secure random integer between min (inclusive) and max (exclusive)
  function secureRandomInt(min: number, max: number): number {
    const range = max - min;
    if (range <= 0) throw new Error("Invalid range");
    const maxUint32 = 0xFFFFFFFF;
    const maxAcceptable = Math.floor(maxUint32 / range) * range - 1;
    let rand;
    do {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      rand = arr[0];
    } while (rand > maxAcceptable);
    return min + (rand % range);
  }

  // Fisher-Yates shuffle using cryptographically secure random numbers
  function secureShuffle(array: string[]): string[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = secureRandomInt(0, i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  const generatePassword = () => {
    const length = 16;
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    // Ensure at least one of each required character type
    let generatedPassword = '';
    generatedPassword += lowercase[secureRandomInt(0, lowercase.length)];
    generatedPassword += uppercase[secureRandomInt(0, uppercase.length)];
    generatedPassword += numbers[secureRandomInt(0, numbers.length)];
    generatedPassword += special[secureRandomInt(0, special.length)];
    
    // Fill the rest randomly
    const allChars = lowercase + uppercase + numbers + special;
    for (let i = generatedPassword.length; i < length; i++) {
      generatedPassword += allChars[secureRandomInt(0, allChars.length)];
    }
    
    // Shuffle the password securely
    generatedPassword = secureShuffle(generatedPassword.split('')).join('');
    
    setPassword(generatedPassword);
    setShowPassword(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await api.post('/users', {
        username,
        email,
        password,
        role
      });

      onSuccess(response.data);
      
      // Reset form
      setUsername('');
      setEmail('');
      setPassword('');
      setRole('user');
      setShowPassword(false);
      
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
        setError(error.response?.data?.error || 'Failed to create user');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.dialog}>
        <div style={styles.header}>
          <h3 style={styles.title}>Create New User</h3>
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
            <label htmlFor="username" style={styles.label}>
              Username *
            </label>
            <input
              id="username"
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
            <label htmlFor="email" style={styles.label}>
              Email *
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={styles.input}
              disabled={loading}
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="password" style={styles.label}>
              Password *
            </label>
            <div style={styles.passwordContainer}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                style={{ ...styles.input, marginBottom: 0 }}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.toggleButton}
                disabled={loading}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            <div style={styles.passwordActions}>
              <button
                type="button"
                onClick={generatePassword}
                style={styles.generateButton}
                disabled={loading}
              >
                Generate Secure Password
              </button>
            </div>
            <small style={styles.hint}>
              Min 8 chars with uppercase, lowercase, number, and special character
            </small>
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="role" style={styles.label}>
              Role *
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'user' | 'coach' | 'admin')}
              style={styles.select}
              disabled={loading}
            >
              <option value="user">User</option>
              <option value="coach">Coach</option>
              <option value="admin">Admin</option>
            </select>
            <small style={styles.hint}>
              User: View only • Coach: Manage teams/games • Admin: Full access
            </small>
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
              {loading ? 'Creating...' : 'Create User'}
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
  select: {
    padding: '10px',
    fontSize: '1rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: 'white',
    marginBottom: '4px'
  },
  hint: {
    fontSize: '0.8rem',
    color: '#666',
    fontStyle: 'italic'
  },
  passwordContainer: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  toggleButton: {
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
    fontSize: '1.2rem'
  },
  passwordActions: {
    marginTop: '4px'
  },
  generateButton: {
    padding: '8px 12px',
    fontSize: '0.85rem',
    border: '1px solid #007bff',
    borderRadius: '4px',
    backgroundColor: 'white',
    color: '#007bff',
    cursor: 'pointer',
    fontWeight: 500
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
    backgroundColor: '#28a745',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 500
  }
};

export default CreateUserDialog;
