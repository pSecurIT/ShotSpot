import React, { useState, useEffect } from 'react';
import {
  getTwizzitCredentials,
  storeTwizzitCredentials,
  deleteTwizzitCredentials,
  verifyTwizzitConnection,
  syncTwizzitTeams,
  syncTwizzitPlayers,
  getTwizzitSyncConfig,
  updateTwizzitSyncConfig,
  getTwizzitSyncHistory,
  getTwizzitTeamMappings,
  getTwizzitPlayerMappings,
} from '../utils/api';
import type {
  TwizzitCredential,
  TwizzitSyncConfig,
  TwizzitSyncHistory,
  TeamMapping,
  PlayerMapping,
} from '../types/twizzit';
import './TwizzitIntegration.css';

type TabType = 'credentials' | 'sync' | 'config' | 'history' | 'mappings';

const TwizzitIntegration: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('credentials');
  const [credentials, setCredentials] = useState<TwizzitCredential[]>([]);
  const [selectedCredential, setSelectedCredential] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Credentials form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Sync config
  const [syncConfig, setSyncConfig] = useState<TwizzitSyncConfig | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [syncIntervalHours, setSyncIntervalHours] = useState(24);

  // Sync options
  const [groupId, setGroupId] = useState('');
  const [seasonId, setSeasonId] = useState('');
  const [createMissing, setCreateMissing] = useState(true);

  // History and mappings
  const [syncHistory, setSyncHistory] = useState<TwizzitSyncHistory[]>([]);
  const [teamMappings, setTeamMappings] = useState<TeamMapping[]>([]);
  const [playerMappings, setPlayerMappings] = useState<PlayerMapping[]>([]);

  // Load credentials on mount
  useEffect(() => {
    loadCredentials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load data when credential is selected
  useEffect(() => {
    if (selectedCredential) {
      if (activeTab === 'config') {
        loadSyncConfig();
      } else if (activeTab === 'history') {
        loadSyncHistory();
      } else if (activeTab === 'mappings') {
        loadMappings();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCredential, activeTab]);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const getErrorMessage = (err: unknown, defaultMessage: string): string => {
    if (err && typeof err === 'object' && 'response' in err) {
      const response = (err as { response?: { data?: { error?: string } } }).response;
      if (response && typeof response === 'object' && 'data' in response && response.data && typeof response.data === 'object' && 'error' in response.data) {
        return response.data.error || defaultMessage;
      }
    }
    return defaultMessage;
  };

  const loadCredentials = async () => {
    try {
      setLoading(true);
      clearMessages();
      const data = await getTwizzitCredentials();
      setCredentials(data);
      
      // Auto-select first credential if none selected
      if (data.length > 0 && !selectedCredential) {
        setSelectedCredential(data[0].id);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load credentials'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password || !organizationName) {
      setError('All fields are required');
      return;
    }

    try {
      setLoading(true);
      clearMessages();
      const credential = await storeTwizzitCredentials({
        username,
        password,
        organizationName,
      });
      
      setSuccess('Credentials added successfully');
      setUsername('');
      setPassword('');
      setOrganizationName('');
      setShowAddForm(false);
      
      // Reload credentials and select the new one
      await loadCredentials();
      setSelectedCredential(credential.id);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to add credentials'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCredential = async (id: number) => {
    if (!confirm('Are you sure you want to delete these credentials?')) {
      return;
    }

    try {
      setLoading(true);
      clearMessages();
      await deleteTwizzitCredentials(id);
      setSuccess('Credentials deleted successfully');
      
      if (selectedCredential === id) {
        setSelectedCredential(null);
      }
      
      await loadCredentials();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete credentials'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyConnection = async () => {
    if (!selectedCredential) {
      setError('Please select a credential');
      return;
    }

    try {
      setLoading(true);
      clearMessages();
      const result = await verifyTwizzitConnection(selectedCredential);
      
      if (result.success) {
        setSuccess(`Connected successfully! Organization: ${result.organizationName}`);
      } else {
        setError(result.message || 'Connection failed');
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to verify connection'));
    } finally {
      setLoading(false);
    }
  };

  const handleSyncTeams = async () => {
    if (!selectedCredential) {
      setError('Please select a credential');
      return;
    }

    try {
      setLoading(true);
      clearMessages();
      const result = await syncTwizzitTeams(selectedCredential, {
        groupId: groupId || undefined,
        createMissing,
      });
      
      setSuccess(result.message || 'Teams synced successfully');
      
      // Reload history if on that tab
      if (activeTab === 'history') {
        loadSyncHistory();
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to sync teams'));
    } finally {
      setLoading(false);
    }
  };

  const handleSyncPlayers = async () => {
    if (!selectedCredential) {
      setError('Please select a credential');
      return;
    }

    try {
      setLoading(true);
      clearMessages();
      const result = await syncTwizzitPlayers(selectedCredential, {
        groupId: groupId || undefined,
        seasonId: seasonId || undefined,
        createMissing,
      });
      
      setSuccess(result.message || 'Players synced successfully');
      
      // Reload history if on that tab
      if (activeTab === 'history') {
        loadSyncHistory();
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to sync players'));
    } finally {
      setLoading(false);
    }
  };

  const loadSyncConfig = async () => {
    if (!selectedCredential) return;

    try {
      setLoading(true);
      clearMessages();
      const config = await getTwizzitSyncConfig(selectedCredential);
      setSyncConfig(config);
      setAutoSyncEnabled(config.autoSyncEnabled);
      setSyncIntervalHours(config.syncIntervalHours);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load sync config'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSyncConfig = async () => {
    if (!selectedCredential) {
      setError('Please select a credential');
      return;
    }

    try {
      setLoading(true);
      clearMessages();
      const config = await updateTwizzitSyncConfig(selectedCredential, {
        autoSyncEnabled,
        syncIntervalHours,
      });
      
      setSyncConfig(config);
      setSuccess('Sync configuration updated successfully');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update sync config'));
    } finally {
      setLoading(false);
    }
  };

  const loadSyncHistory = async () => {
    if (!selectedCredential) return;

    try {
      setLoading(true);
      clearMessages();
      const history = await getTwizzitSyncHistory(selectedCredential);
      setSyncHistory(history);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load sync history'));
    } finally {
      setLoading(false);
    }
  };

  const loadMappings = async () => {
    if (!selectedCredential) return;

    try {
      setLoading(true);
      clearMessages();
      const [teams, players] = await Promise.all([
        getTwizzitTeamMappings(selectedCredential),
        getTwizzitPlayerMappings(selectedCredential),
      ]);
      setTeamMappings(teams);
      setPlayerMappings(players);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load mappings'));
    } finally {
      setLoading(false);
    }
  };

  const renderCredentials = () => (
    <div className="twizzit-section">
      <div className="section-header">
        <h3>Credentials</h3>
        <button
          className="btn btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={loading}
        >
          {showAddForm ? 'Cancel' : 'Add Credential'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddCredential} className="credential-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your.email@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="organizationName">Organization Name</label>
            <input
              id="organizationName"
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="KCOV"
              required
            />
          </div>
          <button type="submit" className="btn btn-success" disabled={loading}>
            {loading ? 'Adding...' : 'Add Credential'}
          </button>
        </form>
      )}

      <div className="credentials-list">
        {credentials.length === 0 ? (
          <p className="empty-state">No credentials configured. Add one to get started.</p>
        ) : (
          credentials.map((cred) => (
            <div
              key={cred.id}
              className={`credential-item ${selectedCredential === cred.id ? 'selected' : ''}`}
              onClick={() => setSelectedCredential(cred.id)}
            >
              <div className="credential-info">
                <h4>{cred.organizationName}</h4>
                <p>Username: {cred.apiUsername}</p>
                <p className="text-muted">
                  Created: {new Date(cred.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="credential-actions">
                <button
                  className="btn btn-danger btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCredential(cred.id);
                  }}
                  disabled={loading}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderSync = () => (
    <div className="twizzit-section">
      <h3>Sync Data</h3>

      {!selectedCredential ? (
        <p className="empty-state">Please select a credential first</p>
      ) : (
        <>
          <div className="sync-actions">
            <button
              className="btn btn-secondary"
              onClick={handleVerifyConnection}
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Verify Connection'}
            </button>
          </div>

          <div className="sync-options">
            <h4>Sync Options</h4>
            <div className="form-group">
              <label htmlFor="groupId">Group ID (optional)</label>
              <input
                id="groupId"
                type="text"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                placeholder="Leave empty to sync all groups"
              />
            </div>
            <div className="form-group">
              <label htmlFor="seasonId">Season ID (optional, for players)</label>
              <input
                id="seasonId"
                type="text"
                value={seasonId}
                onChange={(e) => setSeasonId(e.target.value)}
                placeholder="Leave empty for current season"
              />
            </div>
            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={createMissing}
                  onChange={(e) => setCreateMissing(e.target.checked)}
                />
                Create missing teams/players in local database
              </label>
            </div>
          </div>

          <div className="sync-actions">
            <button
              className="btn btn-primary"
              onClick={handleSyncTeams}
              disabled={loading}
            >
              {loading ? 'Syncing...' : 'Sync Teams'}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSyncPlayers}
              disabled={loading}
            >
              {loading ? 'Syncing...' : 'Sync Players'}
            </button>
          </div>
        </>
      )}
    </div>
  );

  const renderConfig = () => (
    <div className="twizzit-section">
      <h3>Auto-Sync Configuration</h3>

      {!selectedCredential ? (
        <p className="empty-state">Please select a credential first</p>
      ) : !syncConfig ? (
        <p>Loading configuration...</p>
      ) : (
        <div className="config-form">
          <div className="form-group checkbox">
            <label>
              <input
                type="checkbox"
                checked={autoSyncEnabled}
                onChange={(e) => setAutoSyncEnabled(e.target.checked)}
              />
              Enable automatic synchronization
            </label>
          </div>
          <div className="form-group">
            <label htmlFor="syncIntervalHours">Sync Interval (hours)</label>
            <input
              id="syncIntervalHours"
              type="number"
              min="1"
              max="168"
              value={syncIntervalHours}
              onChange={(e) => setSyncIntervalHours(parseInt(e.target.value))}
              disabled={!autoSyncEnabled}
            />
            <p className="text-muted">Set how often data should be synchronized (1-168 hours)</p>
          </div>
          {syncConfig.lastSyncAt && (
            <div className="form-group">
              <label>Last Sync</label>
              <p>{new Date(syncConfig.lastSyncAt).toLocaleString()}</p>
            </div>
          )}
          <button
            className="btn btn-success"
            onClick={handleUpdateSyncConfig}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      )}
    </div>
  );

  const renderHistory = () => (
    <div className="twizzit-section">
      <h3>Sync History</h3>

      {!selectedCredential ? (
        <p className="empty-state">Please select a credential first</p>
      ) : syncHistory.length === 0 ? (
        <p className="empty-state">No sync history yet</p>
      ) : (
        <div className="history-list">
          {syncHistory.map((entry) => (
            <div key={entry.id} className={`history-item status-${entry.status}`}>
              <div className="history-header">
                <span className="history-type">{entry.syncType}</span>
                <span className={`history-status ${entry.status}`}>
                  {entry.status.toUpperCase()}
                </span>
                <span className="history-date">
                  {new Date(entry.syncedAt).toLocaleString()}
                </span>
              </div>
              <div className="history-stats">
                <span>Processed: {entry.itemsProcessed}</span>
                <span>Succeeded: {entry.itemsSucceeded}</span>
                {entry.itemsFailed > 0 && (
                  <span className="text-danger">Failed: {entry.itemsFailed}</span>
                )}
              </div>
              {entry.errorMessage && (
                <div className="history-error">
                  <strong>Error:</strong> {entry.errorMessage}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderMappings = () => (
    <div className="twizzit-section">
      <h3>Data Mappings</h3>

      {!selectedCredential ? (
        <p className="empty-state">Please select a credential first</p>
      ) : (
        <>
          <div className="mappings-section">
            <h4>Team Mappings ({teamMappings.length})</h4>
            {teamMappings.length === 0 ? (
              <p className="empty-state">No team mappings yet</p>
            ) : (
              <table className="mappings-table">
                <thead>
                  <tr>
                    <th>Local Team</th>
                    <th>Twizzit Team</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMappings.map((mapping) => (
                    <tr key={mapping.id}>
                      <td>{mapping.internalTeamName}</td>
                      <td>{mapping.twizzitTeamName}</td>
                      <td>{new Date(mapping.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="mappings-section">
            <h4>Player Mappings ({playerMappings.length})</h4>
            {playerMappings.length === 0 ? (
              <p className="empty-state">No player mappings yet</p>
            ) : (
              <table className="mappings-table">
                <thead>
                  <tr>
                    <th>Local Player</th>
                    <th>Twizzit Player</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {playerMappings.map((mapping) => (
                    <tr key={mapping.id}>
                      <td>{mapping.internalPlayerName}</td>
                      <td>{mapping.twizzitPlayerName}</td>
                      <td>{new Date(mapping.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="twizzit-integration">
      <div className="page-header">
        <h1>Twizzit Integration</h1>
        <p className="page-description">
          Integrate with Twizzit to sync teams and players from the Belgian Korfball Federation
        </p>
      </div>

      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
          <button className="alert-close" onClick={clearMessages}>×</button>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <strong>Success:</strong> {success}
          <button className="alert-close" onClick={clearMessages}>×</button>
        </div>
      )}

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'credentials' ? 'active' : ''}`}
          onClick={() => setActiveTab('credentials')}
        >
          Credentials
        </button>
        <button
          className={`tab ${activeTab === 'sync' ? 'active' : ''}`}
          onClick={() => setActiveTab('sync')}
        >
          Sync
        </button>
        <button
          className={`tab ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab('config')}
          disabled={!selectedCredential}
        >
          Configuration
        </button>
        <button
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
          disabled={!selectedCredential}
        >
          History
        </button>
        <button
          className={`tab ${activeTab === 'mappings' ? 'active' : ''}`}
          onClick={() => setActiveTab('mappings')}
          disabled={!selectedCredential}
        >
          Mappings
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'credentials' && renderCredentials()}
        {activeTab === 'sync' && renderSync()}
        {activeTab === 'config' && renderConfig()}
        {activeTab === 'history' && renderHistory()}
        {activeTab === 'mappings' && renderMappings()}
      </div>
    </div>
  );
};

export default TwizzitIntegration;
