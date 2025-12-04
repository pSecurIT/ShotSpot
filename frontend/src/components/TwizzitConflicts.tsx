import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

interface Conflict {
  id: number;
  entity_type: 'player' | 'team' | 'roster';
  shotspot_id: number;
  twizzit_id: number;
  conflict_type: 'duplicate' | 'data_mismatch' | 'deleted_in_twizzit' | 'deleted_in_shotspot';
  shotspot_data: Record<string, unknown>;
  twizzit_data: Record<string, unknown>;
  created_at: string;
}

interface TwizzitConflictsProps {
  organizationId: number;
  onConflictResolved?: () => void;
}

const TwizzitConflicts: React.FC<TwizzitConflictsProps> = ({ organizationId, onConflictResolved }) => {
  const { user } = useAuth();
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedConflict, setSelectedConflict] = useState<number | null>(null);
  const [resolving, setResolving] = useState<number | null>(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAdmin && organizationId) {
      fetchConflicts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, organizationId]);

  const fetchConflicts = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/twizzit/conflicts?organizationId=${organizationId}`);
      setConflicts(response.data.conflicts);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      console.error('Failed to fetch conflicts:', error);
      setError(error.response?.data?.error || 'Failed to fetch conflicts');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (conflictId: number, resolution: 'twizzit_wins' | 'shotspot_wins' | 'ignored') => {
    setResolving(conflictId);
    setError(null);

    try {
      // Note: This endpoint would need to be implemented in the backend
      await api.put(`/twizzit/conflicts/${conflictId}/resolve`, { resolution });
      
      // Remove resolved conflict from list
      setConflicts(prev => prev.filter(c => c.id !== conflictId));
      setSelectedConflict(null);
      
      onConflictResolved?.();
    } catch (err) {
      const error = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
      console.error('Failed to resolve conflict:', error);
      setError('Failed to resolve conflict: ' + (error.response?.data?.message || error.response?.data?.error || 'Network error'));
    } finally {
      setResolving(null);
    }
  };

  const formatConflictType = (type: string): string => {
    const typeMap: { [key: string]: string } = {
      'duplicate': 'Duplicate Record',
      'data_mismatch': 'Data Mismatch',
      'deleted_in_twizzit': 'Deleted in Twizzit',
      'deleted_in_shotspot': 'Deleted in ShotSpot'
    };
    return typeMap[type] || type;
  };

  const formatEntityType = (type: string): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const renderDataComparison = (conflict: Conflict) => {
    const allKeys = new Set([
      ...Object.keys(conflict.shotspot_data || {}),
      ...Object.keys(conflict.twizzit_data || {})
    ]);

    return (
      <div className="data-comparison">
        <div className="comparison-header">
          <div className="comparison-column shotspot-column">
            <h4>ShotSpot Data</h4>
          </div>
          <div className="comparison-column twizzit-column">
            <h4>Twizzit Data</h4>
          </div>
        </div>

        <div className="comparison-body">
          {Array.from(allKeys).map(key => {
            const shotsVal = conflict.shotspot_data?.[key];
            const twizVal = conflict.twizzit_data?.[key];
            const isDifferent = JSON.stringify(shotsVal) !== JSON.stringify(twizVal);

            return (
              <div key={key} className={`comparison-row ${isDifferent ? 'different' : ''}`}>
                <div className="field-name">{key}</div>
                <div className="comparison-values">
                  <div className="value-cell shotspot-value">
                    {shotsVal !== undefined ? String(shotsVal) : <span className="empty-value">—</span>}
                  </div>
                  <div className="value-cell twizzit-value">
                    {twizVal !== undefined ? String(twizVal) : <span className="empty-value">—</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!isAdmin) {
    return (
      <div className="twizzit-conflicts">
        <div className="alert alert-error">
          ⚠️ Admin access required to manage conflicts.
        </div>
      </div>
    );
  }

  return (
    <div className="twizzit-conflicts">
      <div className="conflicts-header">
        <h3>⚠️ Synchronization Conflicts</h3>
        <p>Review and resolve data conflicts between ShotSpot and Twizzit</p>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading">Loading conflicts...</div>
      ) : conflicts.length === 0 ? (
        <div className="no-conflicts">
          <span className="no-conflicts-icon">✅</span>
          <h4>No Conflicts Found</h4>
          <p>All synchronization data is consistent</p>
        </div>
      ) : (
        <div className="conflicts-list">
          {conflicts.map(conflict => {
            const isExpanded = selectedConflict === conflict.id;
            const isResolving = resolving === conflict.id;

            return (
              <div key={conflict.id} className={`conflict-card ${isExpanded ? 'expanded' : ''}`}>
                <div 
                  className="conflict-summary"
                  onClick={() => setSelectedConflict(isExpanded ? null : conflict.id)}
                >
                  <div className="conflict-icon">⚠️</div>
                  
                  <div className="conflict-info">
                    <div className="conflict-title">
                      <span className="conflict-type">{formatConflictType(conflict.conflict_type)}</span>
                      <span className="conflict-entity">{formatEntityType(conflict.entity_type)}</span>
                    </div>
                    <div className="conflict-ids">
                      <span className="id-label">ShotSpot ID:</span> {conflict.shotspot_id}
                      <span className="separator">•</span>
                      <span className="id-label">Twizzit ID:</span> {conflict.twizzit_id}
                    </div>
                  </div>

                  <div className="conflict-meta">
                    <span className="conflict-date">
                      {new Date(conflict.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="expand-toggle">
                    {isExpanded ? '▼' : '▶'}
                  </div>
                </div>

                {isExpanded && (
                  <div className="conflict-details">
                    {renderDataComparison(conflict)}

                    <div className="resolution-actions">
                      <h4>Choose Resolution</h4>
                      <p className="resolution-help">
                        Select which data source should be considered correct
                      </p>

                      <div className="action-buttons">
                        <button
                          onClick={() => handleResolve(conflict.id, 'twizzit_wins')}
                          disabled={isResolving}
                          className="btn btn-resolve btn-twizzit"
                        >
                          {isResolving ? '🔄 Resolving...' : '✓ Use Twizzit Data'}
                        </button>

                        <button
                          onClick={() => handleResolve(conflict.id, 'shotspot_wins')}
                          disabled={isResolving}
                          className="btn btn-resolve btn-shotspot"
                        >
                          {isResolving ? '🔄 Resolving...' : '✓ Use ShotSpot Data'}
                        </button>

                        <button
                          onClick={() => handleResolve(conflict.id, 'ignored')}
                          disabled={isResolving}
                          className="btn btn-resolve btn-ignore"
                        >
                          {isResolving ? '🔄 Resolving...' : '⏭️ Ignore Conflict'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .twizzit-conflicts {
          max-width: 1000px;
          margin: 0 auto;
        }

        .conflicts-header {
          margin-bottom: 24px;
        }

        .conflicts-header h3 {
          margin: 0 0 8px 0;
          color: #333;
        }

        .conflicts-header p {
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

        .loading {
          text-align: center;
          padding: 40px;
          color: #666;
        }

        .no-conflicts {
          text-align: center;
          padding: 60px 20px;
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
        }

        .no-conflicts-icon {
          font-size: 64px;
          display: block;
          margin-bottom: 16px;
        }

        .no-conflicts h4 {
          margin: 0 0 8px 0;
          color: #333;
        }

        .no-conflicts p {
          margin: 0;
          color: #666;
        }

        .conflicts-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .conflict-card {
          background: white;
          border: 2px solid #ff9800;
          border-radius: 8px;
          overflow: hidden;
          transition: all 0.2s;
        }

        .conflict-card.expanded {
          border-color: #f57c00;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .conflict-summary {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          cursor: pointer;
          user-select: none;
        }

        .conflict-summary:hover {
          background-color: #fff3e0;
        }

        .conflict-icon {
          font-size: 32px;
          flex-shrink: 0;
        }

        .conflict-info {
          flex: 1;
        }

        .conflict-title {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 6px;
        }

        .conflict-type {
          font-weight: 700;
          color: #e65100;
          font-size: 16px;
        }

        .conflict-entity {
          padding: 2px 8px;
          background-color: #fff3e0;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          color: #ef6c00;
        }

        .conflict-ids {
          font-size: 13px;
          color: #666;
        }

        .id-label {
          font-weight: 500;
          color: #555;
        }

        .separator {
          margin: 0 8px;
          color: #ddd;
        }

        .conflict-meta {
          margin-right: 12px;
        }

        .conflict-date {
          font-size: 13px;
          color: #888;
        }

        .expand-toggle {
          color: #999;
          font-size: 14px;
        }

        .conflict-details {
          border-top: 1px solid #ffe0b2;
          background-color: #fffaf0;
          padding: 24px;
        }

        .data-comparison {
          background: white;
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 24px;
          border: 1px solid #e0e0e0;
        }

        .comparison-header {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          background-color: #e0e0e0;
        }

        .comparison-column {
          padding: 12px 16px;
          background-color: #f5f5f5;
        }

        .comparison-column h4 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
        }

        .shotspot-column {
          color: #1976d2;
        }

        .twizzit-column {
          color: #388e3c;
        }

        .comparison-body {
          display: flex;
          flex-direction: column;
        }

        .comparison-row {
          display: grid;
          grid-template-columns: 150px 1fr;
          border-bottom: 1px solid #f0f0f0;
        }

        .comparison-row:last-child {
          border-bottom: none;
        }

        .comparison-row.different {
          background-color: #fff3e0;
        }

        .field-name {
          padding: 12px 16px;
          font-weight: 600;
          color: #555;
          font-size: 13px;
          border-right: 1px solid #f0f0f0;
          background-color: #fafafa;
        }

        .comparison-values {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          background-color: #f0f0f0;
        }

        .value-cell {
          padding: 12px 16px;
          font-size: 14px;
          background-color: white;
          word-break: break-word;
        }

        .shotspot-value {
          border-right: 1px solid #f0f0f0;
        }

        .empty-value {
          color: #bbb;
          font-style: italic;
        }

        .resolution-actions {
          background: white;
          padding: 20px;
          border-radius: 6px;
          border: 1px solid #e0e0e0;
        }

        .resolution-actions h4 {
          margin: 0 0 8px 0;
          font-size: 16px;
          color: #333;
        }

        .resolution-help {
          margin: 0 0 20px 0;
          font-size: 14px;
          color: #666;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .btn-resolve {
          padding: 12px 24px;
          border: 2px solid;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          flex: 1;
          min-width: 180px;
        }

        .btn-resolve:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-twizzit {
          background-color: #e8f5e9;
          border-color: #4caf50;
          color: #2e7d32;
        }

        .btn-twizzit:hover:not(:disabled) {
          background-color: #4caf50;
          color: white;
        }

        .btn-shotspot {
          background-color: #e3f2fd;
          border-color: #2196f3;
          color: #1565c0;
        }

        .btn-shotspot:hover:not(:disabled) {
          background-color: #2196f3;
          color: white;
        }

        .btn-ignore {
          background-color: #f5f5f5;
          border-color: #9e9e9e;
          color: #616161;
        }

        .btn-ignore:hover:not(:disabled) {
          background-color: #9e9e9e;
          color: white;
        }

        @media (max-width: 768px) {
          .comparison-header,
          .comparison-values {
            grid-template-columns: 1fr;
          }

          .comparison-row {
            grid-template-columns: 1fr;
          }

          .field-name {
            border-right: none;
            border-bottom: 1px solid #f0f0f0;
          }

          .shotspot-value {
            border-right: none;
          }

          .action-buttons {
            flex-direction: column;
          }

          .btn-resolve {
            min-width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default TwizzitConflicts;
