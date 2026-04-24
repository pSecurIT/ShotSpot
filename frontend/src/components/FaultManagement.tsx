import React, { useState, useEffect } from 'react';
import api from '../utils/api';

interface Player {
  id: number;
  club_id: number;
  first_name: string;
  last_name: string;
  jersey_number: number;
  gender?: string;
}

interface FaultManagementProps {
  gameId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeClubId: number;
  awayClubId: number;
  homeTeamName: string;
  awayTeamName: string;
  currentPeriod: number;
  timeRemaining?: string;
  onFaultRecorded?: () => void;
  canAddEvents?: () => boolean; // Period end check function
  userAssignedTeam?: 'home' | 'away' | null; // Which team the user can record events for
  currentUserRole?: string; // 'admin' | 'coach' | 'user'
}

interface Fault {
  id: number;
  game_id: number;
  event_type: string;
  club_id: number;
  player_id?: number;
  period: number;
  time_remaining?: string;
  details?: {
    reason?: string;
  };
  club_name: string;
  first_name?: string;
  last_name?: string;
  jersey_number?: number;
  event_status?: 'confirmed' | 'unconfirmed';
  client_uuid?: string | null;
  created_at: string;
}

const FaultManagement: React.FC<FaultManagementProps> = ({
  gameId,
  homeTeamId,
  awayTeamId,
  homeClubId,
  awayClubId,
  homeTeamName,
  awayTeamName,
  currentPeriod,
  timeRemaining,
  onFaultRecorded,
  canAddEvents,
  userAssignedTeam
}) => {
  const [players, setPlayers] = useState<{ home: Player[]; away: Player[] }>({ home: [], away: [] });
  const [recentFaults, setRecentFaults] = useState<Fault[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [selectedTeam, setSelectedTeam] = useState<number>(homeTeamId);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [faultType, setFaultType] = useState<'fault_offensive' | 'fault_defensive' | 'fault_out_of_bounds'>('fault_offensive');
  const [faultReason, setFaultReason] = useState('');

  // Ref to track mounted state for cleanup
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Auto-select the user's assigned team
  useEffect(() => {
    if (userAssignedTeam === 'home') {
      setSelectedTeam(homeTeamId);
    } else if (userAssignedTeam === 'away') {
      setSelectedTeam(awayTeamId);
    }
  }, [userAssignedTeam, homeTeamId, awayTeamId]);

  const getTeamPlayers = (teamId: number): Player[] => {
    return teamId === homeTeamId ? players.home : players.away;
  };

  const selectedTeamPlayers = getTeamPlayers(selectedTeam);
  const selectedTeamRequiresPlayerDetails = selectedTeamPlayers.length > 0;
  const faultTypeRequiresPlayer = faultType === 'fault_offensive' || faultType === 'fault_defensive';

  useEffect(() => {
    fetchPlayers();
    fetchRecentFaults();
  }, [gameId, homeTeamId, awayTeamId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const fetchPlayers = async () => {
    try {
      const response = await api.get(`/game-rosters/${gameId}`);
      const allRosterPlayers = response.data || [];
      
      // Filter by club_id locally
      const homePlayers = allRosterPlayers.filter((p: { club_id?: number; is_starting?: boolean }) => p.club_id === homeClubId && p.is_starting);
      const awayPlayers = allRosterPlayers.filter((p: { club_id?: number; is_starting?: boolean }) => p.club_id === awayClubId && p.is_starting);

      setPlayers({
        home: homePlayers || [],
        away: awayPlayers || []
      });
    } catch (err) {
      console.error('Error fetching players:', err);
      setError('Failed to load players');
    }
  };

  const fetchRecentFaults = async () => {
    try {
      const response = await api.get(`/events/${gameId}?event_type=${faultType}`);
      setRecentFaults(response.data.slice(0, 5)); // Show last 5 faults
    } catch (err) {
      console.error('Error fetching recent faults:', err);
    }
  };

  const handleRecordFault = async (eventStatus: 'confirmed' | 'unconfirmed' = 'confirmed') => {
    if (!selectedTeam) {
      setError('Please select a team');
      return;
    }

    // Check if user is allowed to record faults for the selected team
    const selectedTeamType = selectedTeam === homeTeamId ? 'home' : 'away';
    if (userAssignedTeam && selectedTeamType !== userAssignedTeam) {
      setError(`You can only record faults for the ${userAssignedTeam === 'home' ? homeTeamName : awayTeamName}`);
      return;
    }

    if (faultTypeRequiresPlayer && selectedTeamRequiresPlayerDetails && !selectedPlayer) {
      setError('Please select a player for this fault type');
      return;
    }

    // Check if period has ended and require confirmation
    if (canAddEvents && !canAddEvents()) {
      return; // User cancelled, don't record the fault
    }

    setLoading(true);
    setError(null);

    try {
      const clubId = selectedTeam === homeTeamId ? homeClubId : awayClubId;
      const faultData = {
        event_type: faultType,
        club_id: clubId,
        period: currentPeriod,
        time_remaining: timeRemaining || null,
        event_status: eventStatus,
        details: {
          reason: faultReason || null,
          fault_type: faultType
        },
        ...(faultTypeRequiresPlayer && selectedTeamRequiresPlayerDetails && selectedPlayer ? { player_id: selectedPlayer } : {})
      };

      const response = await api.post(`/events/${gameId}`, faultData);
      const wasQueued = Boolean((response.data as { queued?: boolean } | undefined)?.queued);

      setSuccess(wasQueued
        ? `${getFaultDisplayName(faultType)} queued for sync when online`
        : eventStatus === 'unconfirmed'
          ? `${getFaultDisplayName(faultType)} recorded for later review`
          : `${getFaultDisplayName(faultType)} recorded successfully`);
      
      // Reset form
      setSelectedPlayer(null);
      setFaultReason('');
      
      if (!wasQueued) {
        fetchRecentFaults();
      }
      
      // Notify parent component
      if (onFaultRecorded) {
        onFaultRecorded();
      }

      // Clear success message after 3 seconds
      // Clear any existing timeout first
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setSuccess(null);
        timeoutRef.current = null;
      }, 3000);
    } catch (err) {
      const error = err as Error & { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to record fault');
    } finally {
      setLoading(false);
    }
  };

  const getFaultDisplayName = (type: string): string => {
    switch (type) {
      case 'fault_offensive':
        return 'Offensive Fault';
      case 'fault_defensive':
        return 'Defensive Fault';
      case 'fault_out_of_bounds':
        return 'Out of Bounds';
      default:
        return 'Fault';
    }
  };

  const getFaultDescription = (type: string): string => {
    switch (type) {
      case 'fault_offensive':
        return 'Illegal offensive action (e.g., running with ball, obstruction)';
      case 'fault_defensive':
        return 'Illegal defensive action (e.g., hindering, improper defending)';
      case 'fault_out_of_bounds':
        return 'Ball or player went out of bounds';
      default:
        return '';
    }
  };

  const undoFault = async (faultId: number) => {
    try {
      await api.delete(`/events/${gameId}/${faultId}`);
      setSuccess('Fault removed successfully');
      fetchRecentFaults();
      if (onFaultRecorded) {
        onFaultRecorded();
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const error = err as Error & { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to remove fault');
    }
  };

  const updateFaultStatus = async (faultId: number, eventStatus: 'confirmed' | 'unconfirmed', clientUuid?: string | null) => {
    try {
      await api.put(`/events/${gameId}/${faultId}`, {
        event_status: eventStatus,
        ...(clientUuid ? { client_uuid: clientUuid } : {})
      });
      setSuccess(eventStatus === 'unconfirmed' ? 'Fault marked for later review' : 'Fault confirmed');
      fetchRecentFaults();
      if (onFaultRecorded) {
        onFaultRecorded();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setSuccess(null);
        timeoutRef.current = null;
      }, 3000);
    } catch (err) {
      const error = err as Error & { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to update fault review status');
    }
  };

  const confirmFault = async (faultId: number, clientUuid?: string | null) => {
    try {
      if (clientUuid) {
        await api.post(`/events/${gameId}/${faultId}/confirm`, { client_uuid: clientUuid });
      } else {
        await api.post(`/events/${gameId}/${faultId}/confirm`);
      }
      setSuccess('Fault confirmed');
      fetchRecentFaults();
      if (onFaultRecorded) {
        onFaultRecorded();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setSuccess(null);
        timeoutRef.current = null;
      }, 3000);
    } catch (err) {
      const error = err as Error & { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to confirm fault');
    }
  };

  return (
    <div className="fault-management">
      <h4>Record Fault</h4>

      {error && <div className="error-message" role="alert">{error}</div>}
      {success && <div className="success-message" role="status" aria-live="polite">{success}</div>}

      <div className="fault-form">
        {/* Fault Type Selection */}
        <div className="form-group">
          <label>Fault Type:</label>
          <div className="fault-type-buttons">
            <button
              className={`fault-type-btn ${faultType === 'fault_offensive' ? 'active' : ''}`}
              onClick={() => setFaultType('fault_offensive')}
              type="button"
            >
              🔴 Offensive
            </button>
            <button
              className={`fault-type-btn ${faultType === 'fault_defensive' ? 'active' : ''}`}
              onClick={() => setFaultType('fault_defensive')}
              type="button"
            >
              🛡️ Defensive
            </button>
            <button
              className={`fault-type-btn ${faultType === 'fault_out_of_bounds' ? 'active' : ''}`}
              onClick={() => setFaultType('fault_out_of_bounds')}
              type="button"
            >
              ⏹️ Out of Bounds
            </button>
          </div>
          <small className="helper-text">
            {getFaultDescription(faultType)}
          </small>
        </div>

        {/* Team Selection */}
        <div className="form-group">
          <label>Team:</label>
          {userAssignedTeam ? (
            <div className="team-restriction-notice">
              <strong>📍 Your Team:</strong> {userAssignedTeam === 'home' ? homeTeamName : awayTeamName}
              <p className="restriction-text">You can only record faults for your assigned team</p>
            </div>
          ) : (
            <select
              value={selectedTeam}
              onChange={(e) => {
                setSelectedTeam(parseInt(e.target.value));
                setSelectedPlayer(null); // Reset player selection when team changes
              }}
            >
              <option value={homeTeamId}>{homeTeamName} (Home)</option>
              <option value={awayTeamId}>{awayTeamName} (Away)</option>
            </select>
          )}
        </div>

        {/* Player Selection */}
        {faultTypeRequiresPlayer && (
          <div className="form-group">
            <label>Player:</label>
            {selectedTeamRequiresPlayerDetails ? (
              <select
                value={selectedPlayer || ''}
                onChange={(e) => setSelectedPlayer(e.target.value ? parseInt(e.target.value) : null)}
              >
                <option value="">Select player</option>
                {selectedTeamPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    #{player.jersey_number} {player.first_name} {player.last_name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="team-restriction-notice">
                <strong>Team-only mode</strong>
                <p className="restriction-text">No lineup details were configured for this team. Fault is recorded without selecting a player.</p>
              </div>
            )}
          </div>
        )}

        {/* Optional Reason */}
        <div className="form-group">
          <label>Reason (Optional):</label>
          <input
            type="text"
            value={faultReason}
            onChange={(e) => setFaultReason(e.target.value)}
            placeholder="Brief description of the fault"
            maxLength={100}
          />
        </div>

        {/* Submit Button */}
        <div className="panel-form-actions">
          <button
            onClick={() => void handleRecordFault('confirmed')}
            disabled={loading || !selectedTeam || (faultTypeRequiresPlayer && selectedTeamRequiresPlayerDetails && !selectedPlayer)}
            className="primary-button"
          >
            {loading ? 'Recording...' : `Record ${getFaultDisplayName(faultType)}`}
          </button>
          <button
            onClick={() => void handleRecordFault('unconfirmed')}
            disabled={loading || !selectedTeam || (faultTypeRequiresPlayer && selectedTeamRequiresPlayerDetails && !selectedPlayer)}
            className="secondary-button"
          >
            {loading ? 'Recording...' : 'Record And Review Later'}
          </button>
        </div>
      </div>

      {/* Recent Faults */}
      {recentFaults.length > 0 && (
        <div className="recent-faults">
          <h5>Recent Faults (Period {currentPeriod})</h5>
          <div className="fault-list">
            {recentFaults.map((fault) => (
              <div key={fault.id} className="fault-item">
                <div className="fault-info">
                  <span className="fault-type">{getFaultDisplayName(fault.event_type)}</span>
                  <span className="team-name">{fault.club_name}</span>
                  {fault.event_status === 'unconfirmed' && (
                    <span className="detail-badge warning">Pending review</span>
                  )}
                  {fault.first_name && (
                    <span className="player-name">
                      #{fault.jersey_number} {fault.first_name} {fault.last_name}
                    </span>
                  )}
                  {fault.details?.reason && (
                    <span className="fault-reason">({fault.details.reason})</span>
                  )}
                  <span className="fault-time">
                    {fault.time_remaining || `Period ${fault.period}`}
                  </span>
                </div>
                <div className="timeline-actions">
                  {fault.event_status === 'unconfirmed' ? (
                    <button
                      onClick={() => confirmFault(fault.id, fault.client_uuid)}
                      className="save-button"
                      title="Confirm this fault"
                    >
                      ✅ Confirm
                    </button>
                  ) : (
                    <button
                      onClick={() => updateFaultStatus(fault.id, 'unconfirmed', fault.client_uuid)}
                      className="secondary-button"
                      title="Mark this fault to review later"
                    >
                      🏷️ Edit Later
                    </button>
                  )}
                  <button
                    onClick={() => undoFault(fault.id)}
                    className="undo-button"
                    title="Remove this fault"
                  >
                    ↶ Undo
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FaultManagement;