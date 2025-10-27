import React, { useState, useEffect } from 'react';
import api from '../utils/api';

interface Player {
  id: number;
  team_id: number;
  first_name: string;
  last_name: string;
  jersey_number: number;
  gender?: string;
}

interface FaultManagementProps {
  gameId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  currentPeriod: number;
  timeRemaining?: string;
  onFaultRecorded?: () => void;
}

interface Fault {
  id: number;
  game_id: number;
  event_type: string;
  team_id: number;
  player_id?: number;
  period: number;
  time_remaining?: string;
  details?: {
    reason?: string;
  };
  team_name: string;
  first_name?: string;
  last_name?: string;
  jersey_number?: number;
  created_at: string;
}

const FaultManagement: React.FC<FaultManagementProps> = ({
  gameId,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  currentPeriod,
  timeRemaining,
  onFaultRecorded
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

  useEffect(() => {
    fetchPlayers();
    fetchRecentFaults();
  }, [gameId, homeTeamId, awayTeamId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPlayers = async () => {
    try {
      const [homeResponse, awayResponse] = await Promise.all([
        api.get(`/game-rosters/${gameId}?team_id=${homeTeamId}&is_starting=true`),
        api.get(`/game-rosters/${gameId}?team_id=${awayTeamId}&is_starting=true`)
      ]);

      setPlayers({
        home: homeResponse.data || [],
        away: awayResponse.data || []
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

  const handleRecordFault = async () => {
    if (!selectedTeam) {
      setError('Please select a team');
      return;
    }

    // For out of bounds, player selection is optional
    if ((faultType === 'fault_offensive' || faultType === 'fault_defensive') && !selectedPlayer) {
      setError('Please select a player for this fault type');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const faultData = {
        event_type: faultType,
        team_id: selectedTeam,
        player_id: selectedPlayer || null,
        period: currentPeriod,
        time_remaining: timeRemaining || null,
        details: {
          reason: faultReason || null,
          fault_type: faultType
        }
      };

      await api.post(`/events/${gameId}`, faultData);

      setSuccess(`${getFaultDisplayName(faultType)} recorded successfully`);
      
      // Reset form
      setSelectedPlayer(null);
      setFaultReason('');
      
      // Refresh recent faults
      fetchRecentFaults();
      
      // Notify parent component
      if (onFaultRecorded) {
        onFaultRecorded();
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
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

  const getTeamPlayers = (teamId: number): Player[] => {
    return teamId === homeTeamId ? players.home : players.away;
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

  return (
    <div className="fault-management">
      <h4>Record Fault</h4>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

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
        </div>

        {/* Player Selection */}
        {(faultType === 'fault_offensive' || faultType === 'fault_defensive') && (
          <div className="form-group">
            <label>Player:</label>
            <select
              value={selectedPlayer || ''}
              onChange={(e) => setSelectedPlayer(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">Select player</option>
              {getTeamPlayers(selectedTeam).map((player) => (
                <option key={player.id} value={player.id}>
                  #{player.jersey_number} {player.first_name} {player.last_name}
                </option>
              ))}
            </select>
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
        <button
          onClick={handleRecordFault}
          disabled={loading || !selectedTeam || ((faultType === 'fault_offensive' || faultType === 'fault_defensive') && !selectedPlayer)}
          className="primary-button"
        >
          {loading ? 'Recording...' : `Record ${getFaultDisplayName(faultType)}`}
        </button>
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
                  <span className="team-name">{fault.team_name}</span>
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
                <button
                  onClick={() => undoFault(fault.id)}
                  className="undo-button"
                  title="Remove this fault"
                >
                  ↶ Undo
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FaultManagement;