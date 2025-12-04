import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

interface SyncStatus {
  config: {
    organizationId: number;
    organizationName: string;
    syncEnabled: boolean;
    autoSyncFrequency: string;
    syncInProgress: boolean;
    lastSyncAt: string | null;
  };
  latestSync: {
    sync_type: string;
    status: string;
    records_created: number;
    records_updated: number;
    records_skipped: number;
    started_at: string;
    completed_at: string;
    duration_ms: number;
    error_count: number;
  } | null;
  pendingConflicts: number;
}

interface TwizzitSyncControlsProps {
  organizationId: number;
  onSyncComplete?: () => void;
}

const TwizzitSyncControls: React.FC<TwizzitSyncControlsProps> = ({ organizationId, onSyncComplete }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAdmin && organizationId) {
      fetchStatus();
      
      // Poll for status updates every 5 seconds while sync is in progress
      const interval = setInterval(() => {
        if (status?.config?.syncInProgress) {
          fetchStatus();
        }
      }, 5000);

      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, organizationId, status?.config?.syncInProgress]);

  const fetchStatus = async () => {
    try {
      setError(null);
      const response = await api.get(`/twizzit/status?organizationId=${organizationId}`);
      setStatus(response.data);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      console.error('Failed to fetch sync status:', error);
      setError(error.response?.data?.error || 'Failed to fetch status');
    }
  };

  const handleSync = async (syncType: 'players' | 'teams' | 'full') => {
    if (!isAdmin) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.post(`/twizzit/sync/${syncType}`, {
        organizationId
      });

      if (response.data.success) {
        setSuccess(`✅ ${syncType.charAt(0).toUpperCase() + syncType.slice(1)} sync started successfully`);
        
        // Wait a moment then fetch updated status
        setTimeout(() => {
          fetchStatus();
          onSyncComplete?.();
        }, 1000);
      }
    } catch (err) {
      const error = err as { response?: { status?: number; data?: { error?: string; message?: string } }; message?: string };
      if (error.response?.status === 409) {
        setError('⚠️ A sync is already in progress. Please wait for it to complete.');
      } else {
        setError('❌ Failed to start sync: ' + (error.response?.data?.message || error.response?.data?.error || 'Network error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatSyncType = (type: string): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const formatStatus = (syncStatus: string): string => {
    const statusMap: { [key: string]: string } = {
      'running': '🔄 Running',
      'success': '✅ Success',
      'failed': '❌ Failed',
      'partial': '⚠️ Partial'
    };
    return statusMap[syncStatus] || syncStatus;
  };

  if (!isAdmin) {
    return (
      <div className="twizzit-sync-controls">
        <div className="alert alert-error">
          ⚠️ Admin access required to trigger synchronization.
        </div>
      </div>
    );
  }

  if (loading || !status || !status.config) {
    return (
      <div className="twizzit-sync-controls">
        <div className="loading">Loading sync status...</div>
      </div>
    );
  }

  const isSyncInProgress = status.config.syncInProgress || false;

  return (
    <div className="twizzit-sync-controls">
      <div className="sync-header">
        <h3>🔄 Manual Synchronization</h3>
        <p>Trigger data synchronization from Twizzit</p>
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

      {/* Sync in Progress Indicator */}
      {isSyncInProgress && (
        <div className="sync-progress">
          <div className="progress-spinner">🔄</div>
          <div className="progress-text">
            <strong>Sync in Progress</strong>
            <p>Fetching data from Twizzit...</p>
          </div>
        </div>
      )}

      {/* Manual Sync Buttons */}
      <div className="sync-buttons">
        <button
          onClick={() => handleSync('players')}
          disabled={loading || isSyncInProgress}
          className="btn btn-sync"
        >
          <span className="btn-icon">👥</span>
          <span className="btn-label">
            <strong>Sync Players</strong>
            <small>Import player data</small>
          </span>
        </button>

        <button
          onClick={() => handleSync('teams')}
          disabled={loading || isSyncInProgress}
          className="btn btn-sync"
        >
          <span className="btn-icon">⚽</span>
          <span className="btn-label">
            <strong>Sync Teams</strong>
            <small>Import team data</small>
          </span>
        </button>

        <button
          onClick={() => handleSync('full')}
          disabled={loading || isSyncInProgress}
          className="btn btn-sync btn-full"
        >
          <span className="btn-icon">🔄</span>
          <span className="btn-label">
            <strong>Full Sync</strong>
            <small>Import all data</small>
          </span>
        </button>
      </div>

      {/* Latest Sync Results */}
      {status.latestSync && (
        <div className="sync-results">
          <h4>Last Sync Results</h4>
          
          <div className="result-header">
            <div className="result-info">
              <span className="result-type">{formatSyncType(status.latestSync.sync_type)}</span>
              <span className="result-status">{formatStatus(status.latestSync.status)}</span>
            </div>
            <div className="result-time">
              {new Date(status.latestSync.completed_at).toLocaleString()}
            </div>
          </div>

          <div className="result-stats">
            <div className="stat-item stat-created">
              <span className="stat-value">{status.latestSync.records_created}</span>
              <span className="stat-label">Created</span>
            </div>
            <div className="stat-item stat-updated">
              <span className="stat-value">{status.latestSync.records_updated}</span>
              <span className="stat-label">Updated</span>
            </div>
            <div className="stat-item stat-skipped">
              <span className="stat-value">{status.latestSync.records_skipped}</span>
              <span className="stat-label">Skipped</span>
            </div>
            {status.latestSync.error_count > 0 && (
              <div className="stat-item stat-errors">
                <span className="stat-value">{status.latestSync.error_count}</span>
                <span className="stat-label">Errors</span>
              </div>
            )}
          </div>

          <div className="result-footer">
            <span className="result-duration">
              Duration: {formatDuration(status.latestSync.duration_ms)}
            </span>
          </div>
        </div>
      )}

      {/* Pending Conflicts Warning */}
      {status.pendingConflicts > 0 && (
        <div className="conflicts-warning">
          <span className="warning-icon">⚠️</span>
          <span className="warning-text">
            {status.pendingConflicts} pending conflict{status.pendingConflicts !== 1 ? 's' : ''} require resolution
          </span>
          <button className="btn-link">View Conflicts →</button>
        </div>
      )}

      <style>{`
        .twizzit-sync-controls {
          max-width: 600px;
          margin: 0 auto;
        }

        .sync-header {
          margin-bottom: 24px;
        }

        .sync-header h3 {
          margin: 0 0 8px 0;
          color: #333;
        }

        .sync-header p {
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

        .sync-progress {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background-color: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 6px;
          margin-bottom: 20px;
        }

        .progress-spinner {
          font-size: 32px;
          animation: spin 2s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .progress-text strong {
          display: block;
          color: #856404;
          margin-bottom: 4px;
        }

        .progress-text p {
          margin: 0;
          color: #856404;
          font-size: 14px;
        }

        .sync-buttons {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }

        .btn-sync.btn-full {
          grid-column: 1 / -1;
        }

        .btn-sync {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: white;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-sync:hover:not(:disabled) {
          border-color: #4CAF50;
          background-color: #f8fff9;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }

        .btn-sync:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .btn-icon {
          font-size: 32px;
        }

        .btn-label {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
        }

        .btn-label strong {
          font-size: 16px;
          color: #333;
          margin-bottom: 4px;
        }

        .btn-label small {
          font-size: 12px;
          color: #666;
        }

        .sync-results {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .sync-results h4 {
          margin: 0 0 16px 0;
          font-size: 16px;
          color: #333;
        }

        .result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #eee;
        }

        .result-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .result-type {
          font-weight: 600;
          color: #333;
        }

        .result-status {
          font-size: 14px;
        }

        .result-time {
          font-size: 13px;
          color: #666;
        }

        .result-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
          gap: 12px;
          margin-bottom: 12px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px;
          border-radius: 6px;
          background-color: #f9f9f9;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
        }

        .stat-created {
          background-color: #d4edda;
        }

        .stat-created .stat-value {
          color: #155724;
        }

        .stat-updated {
          background-color: #d1ecf1;
        }

        .stat-updated .stat-value {
          color: #0c5460;
        }

        .stat-skipped {
          background-color: #fff3cd;
        }

        .stat-skipped .stat-value {
          color: #856404;
        }

        .stat-errors {
          background-color: #f8d7da;
        }

        .stat-errors .stat-value {
          color: #721c24;
        }

        .result-footer {
          padding-top: 12px;
          border-top: 1px solid #eee;
          text-align: center;
        }

        .result-duration {
          font-size: 13px;
          color: #666;
        }

        .conflicts-warning {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background-color: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 6px;
        }

        .warning-icon {
          font-size: 20px;
        }

        .warning-text {
          flex: 1;
          color: #856404;
          font-size: 14px;
        }

        .btn-link {
          background: none;
          border: none;
          color: #856404;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          text-decoration: underline;
        }

        .btn-link:hover {
          color: #533f03;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: #666;
        }
      `}</style>
    </div>
  );
};

export default TwizzitSyncControls;
