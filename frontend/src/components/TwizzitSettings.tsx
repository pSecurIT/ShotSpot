import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

interface TwizzitConfig {
  id: number;
  organization_id: number;
  organization_name: string;
  sync_enabled: boolean;
  auto_sync_frequency: 'manual' | 'hourly' | 'daily' | 'weekly';
  last_sync_at: string | null;
  sync_in_progress: boolean;
}

const TwizzitSettings: React.FC = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState<TwizzitConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state
  const [organizationId, setOrganizationId] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [autoSyncFrequency, setAutoSyncFrequency] = useState<'manual' | 'hourly' | 'daily' | 'weekly'>('manual');

  // Admin-only check
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      fetchConfig();
    }
  }, [isAdmin]);

  const fetchConfig = async () => {
    try {
      setError(null);
      const response = await api.get('/twizzit/config');
      
      if (response.data.configs && response.data.configs.length > 0) {
        const firstConfig = response.data.configs[0];
        setConfig(firstConfig);
        setOrganizationId(firstConfig.organization_id.toString());
        setOrganizationName(firstConfig.organization_name || '');
        setSyncEnabled(firstConfig.sync_enabled);
        setAutoSyncFrequency(firstConfig.auto_sync_frequency);
      }
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      console.error('Failed to fetch Twizzit config:', error);
      // Don't show error if no config exists yet
      if (error.response?.data?.error && !error.response.data.error.includes('not found')) {
        setError(error.response.data.error || 'Failed to fetch configuration');
      }
    }
  };

  const handleTestConnection = async () => {
    if (!username || !password) {
      setError('Username and password are required for testing');
      return;
    }

    setTesting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.post('/twizzit/test-connection', {
        username,
        password
      });

      if (response.data.success) {
        setSuccess('✅ Connection successful! Credentials are valid.');
      } else {
        setError('❌ Connection failed: ' + (response.data.message || 'Invalid credentials'));
      }
    } catch (err) {
      const error = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
      setError('❌ Connection failed: ' + (error.response?.data?.message || error.response?.data?.error || 'Network error'));
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfiguration = async () => {
    if (!organizationId || !username || !password) {
      setError('Organization ID, username, and password are required');
      return;
    }

    const orgId = parseInt(organizationId);
    if (isNaN(orgId) || orgId <= 0) {
      setError('Organization ID must be a positive number');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.post('/twizzit/configure', {
        organizationId: orgId,
        organizationName: organizationName || undefined,
        username,
        password,
        syncEnabled,
        autoSyncFrequency
      });

      if (response.data.success) {
        setSuccess('✅ Configuration saved successfully!');
        setPassword(''); // Clear password after successful save
        await fetchConfig(); // Refresh configuration
      }
    } catch (err) {
      const error = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
      setError('❌ Failed to save configuration: ' + (error.response?.data?.message || error.response?.data?.error || 'Network error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfiguration = async () => {
    if (!config || !window.confirm('Are you sure you want to delete this Twizzit configuration?')) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await api.delete(`/twizzit/config/${config.organization_id}`);
      setSuccess('✅ Configuration deleted successfully');
      
      // Reset form
      setConfig(null);
      setOrganizationId('');
      setOrganizationName('');
      setUsername('');
      setPassword('');
      setSyncEnabled(false);
      setAutoSyncFrequency('manual');
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError('❌ Failed to delete configuration: ' + (error.response?.data?.error || 'Network error'));
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="twizzit-settings">
        <div className="alert alert-error">
          ⚠️ Admin access required to configure Twizzit integration.
        </div>
      </div>
    );
  }

  return (
    <div className="twizzit-settings">
      <div className="settings-header">
        <h2>🔄 Twizzit Integration Settings</h2>
        <p className="settings-description">
          Configure synchronization with KBKB&apos;s Twizzit member management system.
        </p>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      <div className="settings-form">
        {/* Organization Configuration */}
        <div className="form-section">
          <h3>Organization Details</h3>
          
          <div className="form-group">
            <label htmlFor="organizationId">
              Organization ID <span className="required">*</span>
            </label>
            <input
              id="organizationId"
              type="number"
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              placeholder="e.g., 12345"
              disabled={loading}
              min="1"
            />
            <small>Your Twizzit organization ID (numeric value)</small>
          </div>

          <div className="form-group">
            <label htmlFor="organizationName">Organization Name</label>
            <input
              id="organizationName"
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="e.g., My Korfball Club"
              disabled={loading}
            />
            <small>Optional: Display name for your organization</small>
          </div>
        </div>

        {/* Authentication Credentials */}
        <div className="form-section">
          <h3>Twizzit Credentials</h3>
          
          <div className="form-group">
            <label htmlFor="username">
              Username <span className="required">*</span>
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Twizzit service account username"
              disabled={loading}
              autoComplete="off"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Password <span className="required">*</span>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Twizzit service account password"
              disabled={loading}
              autoComplete="new-password"
            />
            <small>Password is encrypted before storage</small>
          </div>

          <div className="form-actions">
            <button
              onClick={handleTestConnection}
              disabled={testing || loading || !username || !password}
              className="btn btn-secondary"
            >
              {testing ? '🔄 Testing...' : '🧪 Test Connection'}
            </button>
          </div>
        </div>

        {/* Sync Configuration */}
        <div className="form-section">
          <h3>Synchronization Settings</h3>
          
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={syncEnabled}
                onChange={(e) => setSyncEnabled(e.target.checked)}
                disabled={loading}
              />
              <span>Enable automatic synchronization</span>
            </label>
          </div>

          <div className="form-group">
            <label htmlFor="autoSyncFrequency">Sync Frequency</label>
            <select
              id="autoSyncFrequency"
              value={autoSyncFrequency}
              onChange={(e) => setAutoSyncFrequency(e.target.value as typeof autoSyncFrequency)}
              disabled={loading || !syncEnabled}
            >
              <option value="manual">Manual only</option>
              <option value="hourly">Every hour</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            <small>How often to automatically sync data from Twizzit</small>
          </div>
        </div>

        {/* Sync Status */}
        {config && (
          <div className="form-section status-section">
            <h3>Current Status</h3>
            
            <div className="status-info">
              <div className="status-row">
                <span className="status-label">Sync Enabled:</span>
                <span className={`status-badge ${config.sync_enabled ? 'enabled' : 'disabled'}`}>
                  {config.sync_enabled ? '✅ Enabled' : '❌ Disabled'}
                </span>
              </div>

              <div className="status-row">
                <span className="status-label">Sync In Progress:</span>
                <span className={`status-badge ${config.sync_in_progress ? 'in-progress' : 'idle'}`}>
                  {config.sync_in_progress ? '🔄 Running' : '✅ Idle'}
                </span>
              </div>

              <div className="status-row">
                <span className="status-label">Last Sync:</span>
                <span className="status-value">
                  {config.last_sync_at 
                    ? new Date(config.last_sync_at).toLocaleString()
                    : 'Never'}
                </span>
              </div>

              <div className="status-row">
                <span className="status-label">Frequency:</span>
                <span className="status-value">
                  {config.auto_sync_frequency.charAt(0).toUpperCase() + config.auto_sync_frequency.slice(1)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="form-actions">
          <button
            onClick={handleSaveConfiguration}
            disabled={loading || !organizationId || !username || !password}
            className="btn btn-primary"
          >
            {loading ? '💾 Saving...' : '💾 Save Configuration'}
          </button>

          {config && (
            <button
              onClick={handleDeleteConfiguration}
              disabled={loading}
              className="btn btn-danger"
            >
              🗑️ Delete Configuration
            </button>
          )}
        </div>
      </div>

      <style>{`
        .twizzit-settings {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }

        .settings-header {
          margin-bottom: 30px;
        }

        .settings-header h2 {
          margin: 0 0 10px 0;
          color: #333;
        }

        .settings-description {
          margin: 0;
          color: #666;
          font-size: 14px;
        }

        .alert {
          padding: 12px 16px;
          border-radius: 4px;
          margin-bottom: 20px;
          font-size: 14px;
        }

        .alert-error {
          background-color: #fee;
          border: 1px solid #fcc;
          color: #c33;
        }

        .alert-success {
          background-color: #efe;
          border: 1px solid #cfc;
          color: #3c3;
        }

        .settings-form {
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 24px;
        }

        .form-section {
          margin-bottom: 32px;
          padding-bottom: 32px;
          border-bottom: 1px solid #eee;
        }

        .form-section:last-child {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;
        }

        .form-section h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
          color: #333;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          color: #555;
          font-size: 14px;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          box-sizing: border-box;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #4CAF50;
          box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.1);
        }

        .form-group input:disabled,
        .form-group select:disabled {
          background-color: #f5f5f5;
          cursor: not-allowed;
        }

        .form-group small {
          display: block;
          margin-top: 4px;
          color: #888;
          font-size: 12px;
        }

        .required {
          color: #e74c3c;
        }

        .checkbox-group label {
          display: flex;
          align-items: center;
          cursor: pointer;
          font-weight: normal;
        }

        .checkbox-group input[type="checkbox"] {
          width: auto;
          margin-right: 8px;
          cursor: pointer;
        }

        .status-section {
          background-color: #f9f9f9;
          padding: 20px;
          border-radius: 6px;
        }

        .status-info {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .status-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .status-label {
          font-weight: 500;
          color: #555;
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-badge.enabled {
          background-color: #d4edda;
          color: #155724;
        }

        .status-badge.disabled {
          background-color: #f8d7da;
          color: #721c24;
        }

        .status-badge.in-progress {
          background-color: #fff3cd;
          color: #856404;
        }

        .status-badge.idle {
          background-color: #d1ecf1;
          color: #0c5460;
        }

        .status-value {
          color: #333;
          font-size: 14px;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background-color: #4CAF50;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background-color: #45a049;
        }

        .btn-secondary {
          background-color: #2196F3;
          color: white;
        }

        .btn-secondary:hover:not(:disabled) {
          background-color: #0b7dda;
        }

        .btn-danger {
          background-color: #f44336;
          color: white;
        }

        .btn-danger:hover:not(:disabled) {
          background-color: #da190b;
        }
      `}</style>
    </div>
  );
};

export default TwizzitSettings;
