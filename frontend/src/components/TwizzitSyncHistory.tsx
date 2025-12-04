import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

interface SyncLog {
  id: number;
  sync_type: string;
  status: string;
  records_fetched: number;
  records_created: number;
  records_updated: number;
  records_skipped: number;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  error_count: number;
  errors?: Array<{ entity: string; error: string }>;
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface TwizzitSyncHistoryProps {
  organizationId: number;
}

const TwizzitSyncHistory: React.FC<TwizzitSyncHistoryProps> = ({ organizationId }) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    limit: 20,
    offset: 0,
    hasMore: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [detailedLog, setDetailedLog] = useState<SyncLog | null>(null);
  
  // Filters
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAdmin && organizationId && pagination) {
      fetchLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, organizationId, pagination?.offset]);

  const fetchLogs = async () => {
    if (!pagination) return;
    
    setLoading(true);
    setError(null);

    try {
      const response = await api.get(
        `/twizzit/logs?organizationId=${organizationId}&limit=${pagination.limit}&offset=${pagination.offset}`
      );

      setLogs(response.data.logs);
      setPagination(response.data.pagination);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      console.error('Failed to fetch sync logs:', error);
      setError(error.response?.data?.error || 'Failed to fetch sync history');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogDetails = async (logId: number) => {
    try {
      const response = await api.get(`/twizzit/logs/${logId}`);
      setDetailedLog(response.data.log);
      setExpandedLog(logId);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      console.error('Failed to fetch log details:', error);
      setError(error.response?.data?.error || 'Failed to fetch log details');
    }
  };

  const handleToggleExpand = (logId: number) => {
    if (expandedLog === logId) {
      setExpandedLog(null);
      setDetailedLog(null);
    } else {
      fetchLogDetails(logId);
    }
  };

  const handlePreviousPage = () => {
    if (pagination && pagination.offset > 0) {
      setPagination(prev => ({
        ...prev,
        offset: Math.max(0, prev.offset - prev.limit)
      }));
    }
  };

  const handleNextPage = () => {
    if (pagination && pagination.hasMore) {
      setPagination(prev => ({
        ...prev,
        offset: prev.offset + prev.limit
      }));
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

  const formatStatus = (status: string): { icon: string; label: string; className: string } => {
    const statusMap: { [key: string]: { icon: string; label: string; className: string } } = {
      'running': { icon: '🔄', label: 'Running', className: 'status-running' },
      'success': { icon: '✅', label: 'Success', className: 'status-success' },
      'failed': { icon: '❌', label: 'Failed', className: 'status-failed' },
      'partial': { icon: '⚠️', label: 'Partial', className: 'status-partial' }
    };
    return statusMap[status] || { icon: '❓', label: status, className: 'status-unknown' };
  };

  const filteredLogs = (logs || []).filter(log => {
    if (filterType !== 'all' && log.sync_type !== filterType) return false;
    if (filterStatus !== 'all' && log.status !== filterStatus) return false;
    return true;
  });

  if (!isAdmin) {
    return (
      <div className="twizzit-sync-history">
        <div className="alert alert-error">
          ⚠️ Admin access required to view sync history.
        </div>
      </div>
    );
  }

  const currentPage = pagination ? Math.floor(pagination.offset / pagination.limit) + 1 : 1;
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.limit) : 1;

  return (
    <div className="twizzit-sync-history">
      <div className="history-header">
        <h3>📋 Synchronization History</h3>
        <p>View past sync operations and their results</p>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="history-filters">
        <div className="filter-group">
          <label>Type:</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All Types</option>
            <option value="players">Players</option>
            <option value="teams">Teams</option>
            <option value="full">Full Sync</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Status:</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="partial">Partial</option>
            <option value="running">Running</option>
          </select>
        </div>

        <div className="filter-stats">
          Showing {filteredLogs.length} of {pagination?.total || 0} logs
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="loading">Loading sync history...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="no-logs">
          <span className="no-logs-icon">📭</span>
          <p>No sync logs found</p>
        </div>
      ) : (
        <div className="logs-table">
          {filteredLogs.map(log => {
            const statusInfo = formatStatus(log.status);
            const isExpanded = expandedLog === log.id;

            return (
              <div key={log.id} className={`log-row ${isExpanded ? 'expanded' : ''}`}>
                <div className="log-summary" onClick={() => handleToggleExpand(log.id)}>
                  <div className="log-main">
                    <div className="log-type">
                      <span className="type-icon">
                        {log.sync_type === 'players' ? '👥' : log.sync_type === 'teams' ? '⚽' : '🔄'}
                      </span>
                      <span className="type-label">{formatSyncType(log.sync_type)}</span>
                    </div>

                    <div className={`log-status ${statusInfo.className}`}>
                      <span className="status-icon">{statusInfo.icon}</span>
                      <span className="status-label">{statusInfo.label}</span>
                    </div>

                    <div className="log-stats">
                      <span className="stat" title="Created">
                        <span className="stat-icon">➕</span>
                        {log.records_created}
                      </span>
                      <span className="stat" title="Updated">
                        <span className="stat-icon">✏️</span>
                        {log.records_updated}
                      </span>
                      <span className="stat" title="Skipped">
                        <span className="stat-icon">⏭️</span>
                        {log.records_skipped}
                      </span>
                      {log.error_count > 0 && (
                        <span className="stat stat-error" title="Errors">
                          <span className="stat-icon">❌</span>
                          {log.error_count}
                        </span>
                      )}
                    </div>

                    <div className="log-meta">
                      <span className="log-time">
                        {new Date(log.completed_at).toLocaleString()}
                      </span>
                      <span className="log-duration">{formatDuration(log.duration_ms)}</span>
                    </div>
                  </div>

                  <div className="log-expand">
                    <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                  </div>
                </div>

                {isExpanded && detailedLog && detailedLog.id === log.id && (
                  <div className="log-details">
                    <div className="details-section">
                      <h4>Sync Details</h4>
                      <div className="details-grid">
                        <div className="detail-item">
                          <span className="detail-label">Records Fetched:</span>
                          <span className="detail-value">{detailedLog.records_fetched}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Records Created:</span>
                          <span className="detail-value">{detailedLog.records_created}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Records Updated:</span>
                          <span className="detail-value">{detailedLog.records_updated}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Records Skipped:</span>
                          <span className="detail-value">{detailedLog.records_skipped}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Started:</span>
                          <span className="detail-value">
                            {new Date(detailedLog.started_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Completed:</span>
                          <span className="detail-value">
                            {new Date(detailedLog.completed_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {detailedLog.errors && detailedLog.errors.length > 0 && (
                      <div className="details-section errors-section">
                        <h4>Errors ({detailedLog.errors.length})</h4>
                        <div className="errors-list">
                          {detailedLog.errors.map((error, index) => (
                            <div key={index} className="error-item">
                              <div className="error-entity">
                                <span className="error-icon">⚠️</span>
                                <span className="error-entity-name">{error.entity}</span>
                              </div>
                              <div className="error-message">{error.error}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.total > pagination.limit && (
        <div className="pagination">
          <button
            onClick={handlePreviousPage}
            disabled={!pagination || pagination.offset === 0 || loading}
            className="btn-page"
          >
            ← Previous
          </button>

          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={handleNextPage}
            disabled={!pagination || !pagination.hasMore || loading}
            className="btn-page"
          >
            Next →
          </button>
        </div>
      )}

      <style>{`
        .twizzit-sync-history {
          max-width: 1200px;
          margin: 0 auto;
        }

        .history-header {
          margin-bottom: 24px;
        }

        .history-header h3 {
          margin: 0 0 8px 0;
          color: #333;
        }

        .history-header p {
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

        .history-filters {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
          padding: 16px;
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .filter-group label {
          font-size: 14px;
          color: #666;
          font-weight: 500;
        }

        .filter-group select {
          padding: 6px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
        }

        .filter-stats {
          margin-left: auto;
          font-size: 14px;
          color: #666;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: #666;
        }

        .no-logs {
          text-align: center;
          padding: 60px 20px;
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
        }

        .no-logs-icon {
          font-size: 48px;
          display: block;
          margin-bottom: 16px;
        }

        .no-logs p {
          margin: 0;
          color: #666;
          font-size: 16px;
        }

        .logs-table {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .log-row {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          overflow: hidden;
          transition: all 0.2s;
        }

        .log-row:hover {
          border-color: #4CAF50;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .log-row.expanded {
          border-color: #4CAF50;
        }

        .log-summary {
          display: flex;
          align-items: center;
          padding: 16px;
          cursor: pointer;
          user-select: none;
        }

        .log-main {
          flex: 1;
          display: grid;
          grid-template-columns: 150px 120px 1fr auto;
          gap: 16px;
          align-items: center;
        }

        .log-type {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .type-icon {
          font-size: 20px;
        }

        .type-label {
          font-weight: 600;
          color: #333;
        }

        .log-status {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 500;
          width: fit-content;
        }

        .status-success {
          background-color: #d4edda;
          color: #155724;
        }

        .status-failed {
          background-color: #f8d7da;
          color: #721c24;
        }

        .status-partial {
          background-color: #fff3cd;
          color: #856404;
        }

        .status-running {
          background-color: #d1ecf1;
          color: #0c5460;
        }

        .log-stats {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .stat {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: #555;
        }

        .stat-icon {
          font-size: 14px;
        }

        .stat-error {
          color: #c33;
          font-weight: 600;
        }

        .log-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }

        .log-time {
          font-size: 13px;
          color: #666;
        }

        .log-duration {
          font-size: 12px;
          color: #888;
          background-color: #f5f5f5;
          padding: 2px 8px;
          border-radius: 10px;
        }

        .log-expand {
          margin-left: 16px;
          color: #999;
        }

        .expand-icon {
          font-size: 12px;
        }

        .log-details {
          padding: 20px;
          background-color: #f9f9f9;
          border-top: 1px solid #e0e0e0;
        }

        .details-section {
          margin-bottom: 20px;
        }

        .details-section:last-child {
          margin-bottom: 0;
        }

        .details-section h4 {
          margin: 0 0 12px 0;
          font-size: 15px;
          color: #333;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .detail-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
        }

        .detail-value {
          font-size: 14px;
          color: #333;
          font-weight: 500;
        }

        .errors-section {
          background-color: #fff5f5;
          padding: 16px;
          border-radius: 6px;
          border: 1px solid #fcc;
        }

        .errors-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .error-item {
          background: white;
          padding: 12px;
          border-radius: 4px;
          border: 1px solid #fcc;
        }

        .error-entity {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }

        .error-icon {
          font-size: 16px;
        }

        .error-entity-name {
          font-weight: 600;
          color: #721c24;
          font-size: 13px;
        }

        .error-message {
          font-size: 13px;
          color: #555;
          padding-left: 24px;
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-top: 24px;
          padding: 16px;
        }

        .btn-page {
          padding: 8px 16px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-page:hover:not(:disabled) {
          background-color: #f5f5f5;
          border-color: #4CAF50;
        }

        .btn-page:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .page-info {
          font-size: 14px;
          color: #666;
          min-width: 120px;
          text-align: center;
        }

        @media (max-width: 768px) {
          .log-main {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .log-meta {
            align-items: flex-start;
          }

          .details-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default TwizzitSyncHistory;
