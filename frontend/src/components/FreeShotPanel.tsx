import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';

interface Player {
  id: number;
  club_id: number;
  first_name: string;
  last_name: string;
  jersey_number: number;
  gender?: string;
}

interface FreeShotPanelProps {
  gameId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeClubId: number;
  awayClubId: number;
  homeTeamName: string;
  awayTeamName: string;
  currentPeriod: number;
  timeRemaining?: string;
  onFreeShotRecorded?: () => void;
  userAssignedTeam?: 'home' | 'away' | null;
  currentUserRole?: string; // 'admin' | 'coach' | 'user'
}

interface FreeShot {
  id: number;
  game_id: number;
  player_id: number;
  club_id: number;
  period: number;
  time_remaining?: string;
  free_shot_type: string;
  reason?: string;
  x_coord?: number;
  y_coord?: number;
  result: string;
  distance?: number;
  first_name: string;
  last_name: string;
  jersey_number: number;
  club_name: string;
  created_at: string;
}

const FreeShotPanel: React.FC<FreeShotPanelProps> = ({
  gameId,
  homeTeamId,
  awayTeamId,
  homeClubId,
  awayClubId,
  homeTeamName,
  awayTeamName,
  currentPeriod,
  timeRemaining,
  onFreeShotRecorded,
  userAssignedTeam,
  currentUserRole
}) => {
  const [players, setPlayers] = useState<{ home: Player[]; away: Player[] }>({ home: [], away: [] });
  const [recentFreeShots, setRecentFreeShots] = useState<FreeShot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [selectedTeam, setSelectedTeam] = useState<number>(homeTeamId);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [freeShotType, setFreeShotType] = useState<'free_shot' | 'penalty'>('free_shot');
  const [result, setResult] = useState<'goal' | 'miss' | 'blocked'>('miss');
  const [reason, setReason] = useState('');
  const [distance, setDistance] = useState<string>('');

  // Ref to track timeout for cleanup
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchPlayers();
    fetchRecentFreeShots();
  }, [gameId, homeTeamId, awayTeamId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
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

  const fetchRecentFreeShots = async () => {
    try {
      const response = await api.get(`/free-shots/${gameId}`);
      setRecentFreeShots(response.data.slice(0, 5)); // Show last 5 free shots
    } catch (err) {
      console.error('Error fetching recent free shots:', err);
    }
  };

  const handleRecordFreeShot = async () => {
    if (!selectedTeam || !selectedPlayer) {
      setError('Please select a team and player');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Restrict coaches to their assigned team
      if (currentUserRole === 'coach' && userAssignedTeam && selectedTeam !== (userAssignedTeam === 'home' ? homeTeamId : awayTeamId)) {
        setError('You can only record free shots for your assigned team');
        setLoading(false);
        return;
      }

      const clubId = selectedTeam === homeTeamId ? homeClubId : awayClubId;
      const freeShotData = {
        game_id: gameId,
        player_id: selectedPlayer,
        club_id: clubId,
        period: currentPeriod,
        time_remaining: timeRemaining || null,
        free_shot_type: freeShotType,
        reason: reason || null,
        result: result,
        distance: distance ? parseFloat(distance) : null,
        // For now, we don't collect coordinates - could be added later
        x_coord: null,
        y_coord: null
      };

      await api.post(`/free-shots`, freeShotData);

      setSuccess(`${getFreeShotDisplayName(freeShotType)} recorded successfully`);
      
      // Reset form
      setSelectedPlayer(null);
      setReason('');
      setDistance('');
      setResult('miss');
      
      // Refresh recent free shots
      fetchRecentFreeShots();
      
      // Notify parent component
      if (onFreeShotRecorded) {
        onFreeShotRecorded();
      }

      // Clear success message after 3 seconds
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => {
        setSuccess(null);
        successTimeoutRef.current = null;
      }, 3000);
    } catch (err) {
      const error = err as Error & { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to record free shot');
    } finally {
      setLoading(false);
    }
  };

  const deleteFreeShot = async (freeShotId: number) => {
    try {
      await api.delete(`/free-shots/${freeShotId}`, { data: { game_id: gameId } });
      setSuccess('Free shot removed successfully');
      fetchRecentFreeShots();
      if (onFreeShotRecorded) {
        onFreeShotRecorded();
      }
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => {
        setSuccess(null);
        successTimeoutRef.current = null;
      }, 3000);
    } catch (err) {
      const error = err as Error & { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to remove free shot');
    }
  };

  const getFreeShotDisplayName = (type: string): string => {
    switch (type) {
      case 'free_shot':
        return 'Free Shot';
      case 'penalty':
        return 'Penalty';
      default:
        return 'Free Shot';
    }
  };

  const getFreeShotDescription = (type: string): string => {
    switch (type) {
      case 'free_shot':
        return 'Free shot awarded for rule violation (shot from violation location)';
      case 'penalty':
        return 'Penalty shot awarded for serious infraction (shot from 2.5m from post)';
      default:
        return '';
    }
  };

  const getResultIcon = (result: string): string => {
    switch (result) {
      case 'goal':
        return '⚽';
      case 'miss':
        return '❌';
      case 'blocked':
        return '🛡️';
      default:
        return '';
    }
  };

  const getResultColor = (result: string): string => {
    switch (result) {
      case 'goal':
        return 'success';
      case 'miss':
        return 'danger';
      case 'blocked':
        return 'warning';
      default:
        return '';
    }
  };

  const getTeamPlayers = (teamId: number): Player[] => {
    return teamId === homeTeamId ? players.home : players.away;
  };

  return (
    <div className="free-shot-panel">
      <h4>Record Free Shot / Penalty</h4>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="free-shot-form">
        {/* Free Shot Type Selection */}
        <div className="form-group">
          <label>Shot Type:</label>
          <div className="shot-type-buttons">
            <button
              className={`shot-type-btn ${freeShotType === 'free_shot' ? 'active' : ''}`}
              onClick={() => setFreeShotType('free_shot')}
              type="button"
            >
              🎯 Free Shot
            </button>
            <button
              className={`shot-type-btn ${freeShotType === 'penalty' ? 'active' : ''}`}
              onClick={() => setFreeShotType('penalty')}
              type="button"
            >
              🚨 Penalty
            </button>
          </div>
          <small className="helper-text">
            {getFreeShotDescription(freeShotType)}
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

        {/* Result Selection */}
        <div className="form-group">
          <label>Result:</label>
          <div className="result-buttons">
            <button
              className={`result-btn ${result === 'goal' ? 'active' : ''} success`}
              onClick={() => setResult('goal')}
              type="button"
            >
              ⚽ Goal
            </button>
            <button
              className={`result-btn ${result === 'miss' ? 'active' : ''} danger`}
              onClick={() => setResult('miss')}
              type="button"
            >
              ❌ Miss
            </button>
            <button
              className={`result-btn ${result === 'blocked' ? 'active' : ''} warning`}
              onClick={() => setResult('blocked')}
              type="button"
            >
              🛡️ Blocked
            </button>
          </div>
        </div>

        {/* Reason */}
        <div className="form-group">
          <label>Reason:</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What caused this free shot/penalty to be awarded?"
            maxLength={100}
          />
        </div>

        {/* Distance (Optional) */}
        <div className="form-group">
          <label>Distance to Korf (Optional):</label>
          <input
            type="number"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            placeholder="Distance in meters"
            min="0"
            max="50"
            step="0.1"
          />
          <small className="helper-text">
            {freeShotType === 'penalty' 
              ? 'Penalties are typically shot from 2.5m from the post' 
              : 'Distance from shooting location to the korf'
            }
          </small>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleRecordFreeShot}
          disabled={loading || !selectedTeam || !selectedPlayer}
          className="primary-button"
        >
          {loading ? 'Recording...' : `Record ${getFreeShotDisplayName(freeShotType)}`}
        </button>
      </div>

      {/* Recent Free Shots */}
      {recentFreeShots.length > 0 && (
        <div className="recent-free-shots">
          <h5>Recent Free Shots (Period {currentPeriod})</h5>
          <div className="free-shot-list">
            {recentFreeShots.map((freeShot) => (
              <div key={freeShot.id} className="free-shot-item">
                <div className="free-shot-info">
                  <span className="shot-type">{getFreeShotDisplayName(freeShot.free_shot_type)}</span>
                  <span className="team-name">{freeShot.club_name}</span>
                  <span className="player-name">
                    #{freeShot.jersey_number} {freeShot.first_name} {freeShot.last_name}
                  </span>
                  <span className={`result ${getResultColor(freeShot.result)}`}>
                    {getResultIcon(freeShot.result)} {freeShot.result.charAt(0).toUpperCase() + freeShot.result.slice(1)}
                  </span>
                  {freeShot.distance && (
                    <span className="distance">{freeShot.distance}m</span>
                  )}
                  {freeShot.reason && (
                    <span className="reason">({freeShot.reason})</span>
                  )}
                  <span className="shot-time">
                    {freeShot.time_remaining || `Period ${freeShot.period}`}
                  </span>
                </div>
                <button
                  onClick={() => deleteFreeShot(freeShot.id)}
                  className="delete-button"
                  title="Remove this free shot"
                >
                  🗑️ Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FreeShotPanel;