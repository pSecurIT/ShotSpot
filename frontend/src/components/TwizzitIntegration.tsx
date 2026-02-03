import React, { useState, useEffect } from 'react';
import {
  getTwizzitCredentials,
  storeTwizzitCredentials,
  deleteTwizzitCredentials,
  verifyTwizzitConnection,
  syncTwizzitTeams,
  syncTwizzitPlayers,
  getTwizzitSyncOptionsForSeason,
  getTwizzitSyncOptionsForOrganization,
  getTwizzitSyncOptionsWithAccess,
  debugTwizzitAccess,
  previewTwizzitTeams,
  previewTwizzitPlayers,
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
  TwizzitOption,
  TwizzitOrganizationAccess,
  TwizzitTeamsPreview,
  TwizzitPlayersPreview,
} from '../types/twizzit';
import './TwizzitIntegration.css';

type TabType = 'credentials' | 'sync' | 'config' | 'history' | 'mappings';

const ACTIVE_TWIZZIT_CREDENTIAL_STORAGE_KEY = 'shotspot.twizzit.activeCredentialId';

const TwizzitIntegration: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('credentials');
  const [credentials, setCredentials] = useState<TwizzitCredential[]>([]);
  const [selectedCredential, setSelectedCredential] = useState<number | null>(null);
  const [activeCredential, setActiveCredential] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Credentials form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Sync config
  const [syncConfig, setSyncConfig] = useState<TwizzitSyncConfig | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [syncIntervalHours, setSyncIntervalHours] = useState(24);

  // Sync options
  const [syncOptionsLoading, setSyncOptionsLoading] = useState(false);
  const [organizations, setOrganizations] = useState<TwizzitOption[]>([]);
  const [organizationAccess, setOrganizationAccess] = useState<TwizzitOrganizationAccess[]>([]);
  const [organizationAccessKey, setOrganizationAccessKey] = useState<string>('');
  const [groups, setGroups] = useState<TwizzitOption[]>([]);
  const [seasons, setSeasons] = useState<TwizzitOption[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [createMissing, setCreateMissing] = useState(true);

  const [teamsPreview, setTeamsPreview] = useState<TwizzitTeamsPreview | null>(null);
  const [playersPreview, setPlayersPreview] = useState<TwizzitPlayersPreview | null>(null);

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
    if (activeCredential) {
      if (activeTab === 'config') {
        loadSyncConfig();
      } else if (activeTab === 'history') {
        loadSyncHistory();
      } else if (activeTab === 'mappings') {
        loadMappings();
      } else if (activeTab === 'sync') {
        loadTwizzitSyncOptions();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCredential, activeTab, selectedOrganizationId, selectedSeasonId]);

  // Reset previews when selection changes
  useEffect(() => {
    setTeamsPreview(null);
    setPlayersPreview(null);
  }, [activeCredential, selectedOrganizationId, selectedGroupId, selectedSeasonId]);

  useEffect(() => {
    // Reset access diagnostics when switching credential.
    setOrganizationAccess([]);
    setOrganizationAccessKey('');
  }, [activeCredential]);

  const getStoredActiveCredentialId = (): number | null => {
    try {
      const raw = localStorage.getItem(ACTIVE_TWIZZIT_CREDENTIAL_STORAGE_KEY);
      if (!raw) return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const setStoredActiveCredentialId = (credentialId: number | null) => {
    try {
      if (credentialId == null) {
        localStorage.removeItem(ACTIVE_TWIZZIT_CREDENTIAL_STORAGE_KEY);
      } else {
        localStorage.setItem(ACTIVE_TWIZZIT_CREDENTIAL_STORAGE_KEY, String(credentialId));
      }
    } catch {
      // Ignore storage errors (private mode, blocked storage, etc.)
    }
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const getErrorMessage = (err: unknown, defaultMessage: string): string => {
    if (err && typeof err === 'object' && 'response' in err) {
      const response = (err as {
        response?: {
          status?: number;
          data?: {
            error?: string;
            message?: string;
            details?: Array<{ msg?: string; param?: string; path?: string } | string>;
          };
        };
        message?: string;
      }).response;

      const data = response?.data;
      if (data) {
        const details = Array.isArray(data.details) ? data.details : null;
        if (details && details.length > 0) {
          const formattedDetails = details
            .map((d) => {
              if (typeof d === 'string') return d;
              const key = d.param || d.path;
              return key ? `${key}: ${d.msg ?? ''}`.trim() : (d.msg ?? '').trim();
            })
            .filter(Boolean)
            .join(' | ');

          return `${data.error || defaultMessage}${formattedDetails ? `: ${formattedDetails}` : ''}`;
        }

        if (data.error && data.message) {
          return `${data.error}: ${data.message}`;
        }
        if (data.error) return data.error;
        if (data.message) return data.message;
      }
    }

    if (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string') {
      return (err as { message: string }).message || defaultMessage;
    }

    return defaultMessage;
  };

  const loadCredentials = async () => {
    try {
      setLoading(true);
      const data = await getTwizzitCredentials();
      setCredentials(data);

      const hasCredential = (id: number | null) => id != null && data.some((c) => c.id === id);

      const storedActive = getStoredActiveCredentialId();
      const nextActive = hasCredential(activeCredential)
        ? activeCredential
        : hasCredential(storedActive)
          ? storedActive
          : data.length > 0
            ? data[0].id
            : null;

      if (nextActive !== activeCredential) {
        setActiveCredential(nextActive);
        setStoredActiveCredentialId(nextActive);
      }

      // Keep a UI selection, but don't auto-change the active credential unless needed.
      const nextSelected = hasCredential(selectedCredential)
        ? selectedCredential
        : nextActive;

      if (nextSelected !== selectedCredential) {
        setSelectedCredential(nextSelected);
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
      const payload = {
        apiUsername: username,
        apiPassword: password,
        organizationName,
        ...(apiEndpoint.trim() ? { apiEndpoint: apiEndpoint.trim() } : {}),
      };
      const credential = await storeTwizzitCredentials(payload);
      
      setUsername('');
      setPassword('');
      setOrganizationName('');
      setApiEndpoint('');
      setShowAddForm(false);
      
      // Reload credentials and select the new one
      await loadCredentials();
      setSelectedCredential(credential.id);
      setSuccess('Credentials added successfully. Click Activate to use them for sync calls.');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to add credentials'));
    } finally {
      setLoading(false);
    }
  };

  const handleActivateCredential = (credentialId: number) => {
    clearMessages();
    setActiveCredential(credentialId);
    setStoredActiveCredentialId(credentialId);
    setSelectedCredential(credentialId);
    setSuccess('Credential activated');
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

       if (activeCredential === id) {
        setActiveCredential(null);
        setStoredActiveCredentialId(null);
      }
      
      await loadCredentials();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete credentials'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyConnection = async () => {
    if (!activeCredential) {
      setError('Please activate a credential');
      return;
    }

    try {
      setLoading(true);
      clearMessages();
      const result = await verifyTwizzitConnection(activeCredential);
      
      if (result.success) {
        const cap = result.capabilities;
        const usable = result.usableForSync;

        if (usable === false) {
          const capText = cap
            ? ` (organizations=${cap.organizations ? 'yes' : 'no'}, groups=${cap.groups ? 'yes' : 'no'}, seasons=${cap.seasons ? 'yes' : 'no'})`
            : '';
          setError((result.message || 'Twizzit connection verified but missing permissions') + capText);
        } else {
          setSuccess(
            result.organizationName
              ? `Connected successfully! Organization: ${result.organizationName}`
              : (result.message || 'Connected successfully!')
          );
        }
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
    if (!activeCredential) {
      setError('Please activate a credential');
      return;
    }

    if (!teamsPreview) {
      setError('Please preview teams before syncing');
      return;
    }

    try {
      setLoading(true);
      clearMessages();
      const result = await syncTwizzitTeams(activeCredential, {
        organizationId: selectedOrganizationId || undefined,
        groupId: selectedGroupId || undefined,
        seasonId: selectedSeasonId || undefined,
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
    if (!activeCredential) {
      setError('Please activate a credential');
      return;
    }

    if (!playersPreview) {
      setError('Please preview players before syncing');
      return;
    }

    try {
      setLoading(true);
      clearMessages();
      const result = await syncTwizzitPlayers(activeCredential, {
        organizationId: selectedOrganizationId || undefined,
        groupId: selectedGroupId || undefined,
        seasonId: selectedSeasonId || undefined,
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
    if (!activeCredential) return;

    try {
      setLoading(true);
      const config = await getTwizzitSyncConfig(activeCredential);
      setSyncConfig(config);
      setAutoSyncEnabled(config.autoSyncEnabled);
      setSyncIntervalHours(config.syncIntervalHours);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load sync config'));
    } finally {
      setLoading(false);
    }
  };

  const loadTwizzitSyncOptions = async () => {
    if (!activeCredential) return;

    try {
      setSyncOptionsLoading(true);
      clearMessages();
      const result = selectedOrganizationId
        ? await getTwizzitSyncOptionsForOrganization(
            activeCredential,
            selectedOrganizationId,
            selectedSeasonId || undefined
          )
        : await getTwizzitSyncOptionsForSeason(activeCredential, selectedSeasonId || undefined);

      const sortedOrgs = [...(result.organizations || [])].sort((a, b) => a.name.localeCompare(b.name));
      const sortedGroups = [...(result.groups || [])].sort((a, b) => a.name.localeCompare(b.name));
      const sortedSeasons = [...(result.seasons || [])].sort((a, b) => a.name.localeCompare(b.name));

      setOrganizations(sortedOrgs);
      setGroups(sortedGroups);
      setSeasons(sortedSeasons);

      // If the current selection is no longer available under the active filters, reset it.
      if (selectedGroupId && !sortedGroups.some((g) => g.id === selectedGroupId)) {
        setSelectedGroupId('');
      }

      // If no organization chosen yet, prefer the backend's default (may be discovered via access probing).
      if (!selectedOrganizationId && sortedOrgs.length > 0) {
        const preferredOrgId = result.defaultOrganizationId;
        const exists = preferredOrgId && sortedOrgs.some((o) => o.id === preferredOrgId);
        setSelectedOrganizationId(exists ? preferredOrgId! : sortedOrgs[0].id);
      }

      const warningsText = (result.warnings || []).join(' | ').toLowerCase();
      const looksLikeNoAccess =
        warningsText.includes('no access for specified organizations') ||
        warningsText.includes('twizzit responded 403');

      // If warnings are severe (permissions), treat them as an error to avoid a confusing green banner.
      if (result.warnings && result.warnings.length > 0 && !looksLikeNoAccess) {
        setSuccess(`Twizzit options loaded with warnings: ${result.warnings.join(' | ')}`);
      }

      const shouldDiagnose = looksLikeNoAccess && sortedOrgs.length > 0 && sortedGroups.length === 0 && sortedSeasons.length === 0;

      // If Twizzit returns orgs but blocks groups/seasons, fetch access diagnostics once.
      const accessKey = `${activeCredential}:${selectedOrganizationId || 'auto'}`;
      if (shouldDiagnose && organizationAccessKey !== accessKey) {
        setOrganizationAccessKey(accessKey);

        try {
          const accessResult = selectedOrganizationId
            ? await getTwizzitSyncOptionsForOrganization(
                activeCredential,
                selectedOrganizationId,
                selectedSeasonId || undefined,
                { includeAccess: true }
              )
            : await getTwizzitSyncOptionsWithAccess(activeCredential);

          setOrganizationAccess(accessResult.organizationAccess || []);
        } catch {
          // Diagnostics are best-effort; ignore failures.
        }

        setError(
          'Twizzit credentials can list organizations but do not have permission to list teams (groups) or seasons for this organization. Ask your Twizzit admin/federation to grant group/season access to this API user.'
        );
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load Twizzit options'));
    } finally {
      setSyncOptionsLoading(false);
    }
  };

  const copyTwizzitDiagnostics = async () => {
    if (!activeCredential) return;

    let accessDebug: unknown = null;
    try {
      accessDebug = await debugTwizzitAccess(
        activeCredential,
        selectedOrganizationId ? selectedOrganizationId : undefined
      );
    } catch {
      accessDebug = null;
    }

    const payload = {
      credentialId: activeCredential,
      selectedOrganizationId: selectedOrganizationId || null,
      organizationAccess,
      accessDebug,
      timestamp: new Date().toISOString()
    };

    const text = JSON.stringify(payload, null, 2);

    try {
      await navigator.clipboard.writeText(text);
      setSuccess('Diagnostics copied to clipboard');
    } catch {
      // Fallback if clipboard API is blocked.
      prompt('Copy diagnostics JSON:', text);
    }
  };

  const handlePreviewTeams = async () => {
    if (!activeCredential) {
      setError('Please activate a credential');
      return;
    }

    try {
      setLoading(true);
      clearMessages();
      const preview = await previewTwizzitTeams(activeCredential, {
        organizationId: selectedOrganizationId || undefined,
        groupId: selectedGroupId || undefined,
        seasonId: selectedSeasonId || undefined,
      });
      setTeamsPreview(preview);
      setSuccess(`Preview loaded: ${preview.total} team(s)`);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to preview teams'));
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewPlayers = async () => {
    if (!activeCredential) {
      setError('Please activate a credential');
      return;
    }

    if (!selectedGroupId) {
      setError('Please select a team before previewing players');
      return;
    }

    try {
      setLoading(true);
      clearMessages();
      const preview = await previewTwizzitPlayers(activeCredential, {
        organizationId: selectedOrganizationId || undefined,
        groupId: selectedGroupId,
        seasonId: selectedSeasonId || undefined,
      });
      setPlayersPreview(preview);
      setSuccess(`Preview loaded: ${preview.total} player(s)`);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to preview players'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSyncConfig = async () => {
    if (!activeCredential) {
      setError('Please activate a credential');
      return;
    }

    try {
      setLoading(true);
      clearMessages();
      const config = await updateTwizzitSyncConfig(activeCredential, {
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
    if (!activeCredential) return;

    try {
      setLoading(true);
      const history = await getTwizzitSyncHistory(activeCredential);
      setSyncHistory(history);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load sync history'));
    } finally {
      setLoading(false);
    }
  };

  const loadMappings = async () => {
    if (!activeCredential) return;

    try {
      setLoading(true);
      const [teams, players] = await Promise.all([
        getTwizzitTeamMappings(activeCredential),
        getTwizzitPlayerMappings(activeCredential),
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
              placeholder="Your club"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="apiEndpoint">API Endpoint (optional)</label>
            <input
              id="apiEndpoint"
              type="url"
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              placeholder="https://app.twizzit.com"
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
                <div className="credential-info-header">
                  <h4>{cred.organizationName}</h4>
                  {activeCredential === cred.id ? (
                    <span className="credential-badge">Active</span>
                  ) : null}
                </div>
                <p>Username: {cred.apiUsername ?? cred.username}</p>
                <p className="text-muted">Credential ID: {cred.id}</p>
                <p className="text-muted">
                  API Endpoint: {cred.apiEndpoint ? cred.apiEndpoint : 'https://app.twizzit.com (default)'}
                </p>
                <p className="text-muted">
                  Created: {new Date(cred.createdAt).toLocaleDateString()}
                  {cred.createdByUsername && ` by ${cred.createdByUsername}`}
                </p>
              </div>
              <div className="credential-actions">
                <button
                  className="btn btn-success btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleActivateCredential(cred.id);
                  }}
                  disabled={loading || activeCredential === cred.id}
                  title={activeCredential === cred.id ? 'This credential is already active' : 'Use this credential for all Twizzit calls'}
                >
                  {activeCredential === cred.id ? 'Active' : 'Activate'}
                </button>
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

      {!activeCredential ? (
        <p className="empty-state">Please activate a credential first</p>
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
              <label htmlFor="orgSelect">Organization (Twizzit)</label>
              <select
                id="orgSelect"
                value={selectedOrganizationId}
                onChange={(e) => {
                  setSelectedOrganizationId(e.target.value);
                  setSelectedGroupId('');
                  setSelectedSeasonId('');
                }}
                disabled={syncOptionsLoading || organizations.length === 0}
              >
                <option value="">Auto / default</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <p className="text-muted">
                {syncOptionsLoading
                  ? 'Loading organizations from Twizzit...'
                  : organizations.length === 0
                    ? 'No organizations returned by Twizzit for these credentials.'
                    : 'Select the organization you want to sync from.'}
              </p>
              {selectedOrganizationId && organizationAccess.length > 0 ? (
                (() => {
                  const access = organizationAccess.find((a) => a.id === selectedOrganizationId);
                  if (!access) return null;
                  const isDenied = !access.canFetchGroups && !access.canFetchSeasons;
                  return (
                    <p className="text-muted" style={isDenied ? { color: '#b00020' } : undefined}>
                      Access check: groups={access.canFetchGroups ? 'yes' : 'no'}, seasons={access.canFetchSeasons ? 'yes' : 'no'}
                    </p>
                  );
                })()
              ) : null}
            </div>
            <div className="form-group">
              <label htmlFor="seasonSelect">Season (optional)</label>
              <select
                id="seasonSelect"
                value={selectedSeasonId}
                onChange={(e) => {
                  setSelectedSeasonId(e.target.value);
                }}
                disabled={syncOptionsLoading || seasons.length === 0}
              >
                <option value="">All seasons</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="text-muted">Used for preview/filtering when supported by Twizzit.</p>
            </div>
            <div className="form-group">
              <label htmlFor="teamSelect">Team (Twizzit group)</label>
              <select
                id="teamSelect"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                disabled={syncOptionsLoading || groups.length === 0}
              >
                <option value="">All teams</option>
                {(() => {
                  const counts = new Map<string, number>();
                  for (const g of groups) {
                    counts.set(g.name, (counts.get(g.name) || 0) + 1);
                  }
                  return groups.map((g) => {
                    const isDuplicate = (counts.get(g.name) || 0) > 1;
                    const label = isDuplicate ? `${g.name} (${g.id})` : g.name;
                    return (
                      <option key={g.id} value={g.id}>
                        {label}
                      </option>
                    );
                  });
                })()}
              </select>
              <p className="text-muted">
                {syncOptionsLoading
                  ? 'Loading teams from Twizzit...'
                  : groups.length === 0
                    ? 'No teams returned from Twizzit (often a permissions issue for the selected organization and/or season).'
                    : 'Select a team to scope preview/sync, or leave as All teams'}
              </p>
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
            <div className="sync-actions">
              <button
                className="btn btn-secondary"
                onClick={loadTwizzitSyncOptions}
                disabled={loading || syncOptionsLoading}
              >
                {syncOptionsLoading ? 'Loading...' : 'Reload Twizzit Options'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={copyTwizzitDiagnostics}
                disabled={loading || syncOptionsLoading || organizationAccess.length === 0}
                title={organizationAccess.length === 0 ? 'Load options first to generate diagnostics' : undefined}
              >
                Copy diagnostics
              </button>
            </div>
          </div>

          <div className="sync-actions-stack">
            <div className="sync-actions">
              <button
                className="btn btn-secondary"
                onClick={handlePreviewTeams}
                disabled={loading || syncOptionsLoading || groups.length === 0}
                title={groups.length === 0 ? 'No teams available from Twizzit for the selected organization' : undefined}
              >
                {loading ? 'Loading...' : 'Preview Teams'}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSyncTeams}
                disabled={loading || !teamsPreview}
              >
                {loading ? 'Syncing...' : 'Sync Teams'}
              </button>
            </div>

            {teamsPreview && (
              <div className="sync-options">
                <h4>Teams Preview</h4>
                <p className="text-muted">{teamsPreview.total} team(s) will be synced.</p>
                {teamsPreview.teams.length > 0 && (
                  <div style={{ maxHeight: 260, overflow: 'auto' }}>
                    <ul>
                      {teamsPreview.teams.map((t) => (
                        <li key={t.id}>
                          {t.name} ({t.id})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="sync-actions">
              <button
                className="btn btn-secondary"
                onClick={handlePreviewPlayers}
                disabled={loading || !selectedGroupId}
                title={!selectedGroupId ? 'Select a team first' : undefined}
              >
                {loading ? 'Loading...' : 'Preview Players'}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSyncPlayers}
                disabled={loading || !playersPreview}
              >
                {loading ? 'Syncing...' : 'Sync Players'}
              </button>
            </div>

            {playersPreview && (
              <div className="sync-options">
                <h4>Players Preview</h4>
                <p className="text-muted">{playersPreview.total} player(s) will be synced.</p>
                {playersPreview.players.length > 0 && (
                  <div style={{ maxHeight: 260, overflow: 'auto' }}>
                    <ul>
                      {playersPreview.players.map((p) => (
                        <li key={p.id}>
                          {p.firstName} {p.lastName} ({p.id})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  const renderConfig = () => (
    <div className="twizzit-section">
      <h3>Auto-Sync Configuration</h3>

      {!activeCredential ? (
        <p className="empty-state">Please activate a credential first</p>
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

      {!activeCredential ? (
        <p className="empty-state">Please activate a credential first</p>
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

      {!activeCredential ? (
        <p className="empty-state">Please activate a credential first</p>
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
          disabled={!activeCredential}
        >
          Configuration
        </button>
        <button
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
          disabled={!activeCredential}
        >
          History
        </button>
        <button
          className={`tab ${activeTab === 'mappings' ? 'active' : ''}`}
          onClick={() => setActiveTab('mappings')}
          disabled={!activeCredential}
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
