import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

interface Player {
  id: number;
  team_id: number;
  first_name: string;
  last_name: string;
  jersey_number: number;
  gender?: string;
  team_name?: string;
}

interface ActivePlayersResponse {
  home_team: {
    active: Player[];
    bench: Player[];
  };
  away_team: {
    active: Player[];
    bench: Player[];
  };
}

interface Substitution {
  id: number;
  game_id: number;
  team_id: number;
  player_in_id: number;
  player_out_id: number;
  period: number;
  time_remaining: string | null;
  reason: string;
  player_in_first_name: string;
  player_in_last_name: string;
  player_in_jersey_number: number;
  player_out_first_name: string;
  player_out_last_name: string;
  player_out_jersey_number: number;
  team_name: string;
  created_at: string;
}

interface SubstitutionPanelProps {
  gameId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  currentPeriod: number;
  timeRemaining?: string;
  onSubstitutionRecorded?: () => void;
  canAddEvents?: () => boolean; // Period end check function
}

const SubstitutionPanel: React.FC<SubstitutionPanelProps> = ({
  gameId,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  currentPeriod,
  timeRemaining,
  onSubstitutionRecorded,
  canAddEvents
}) => {
  const [activePlayers, setActivePlayers] = useState<ActivePlayersResponse | null>(null);
  const [recentSubstitutions, setRecentSubstitutions] = useState<Substitution[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<number>(homeTeamId);
  const [playerOut, setPlayerOut] = useState<number | null>(null);
  const [playerIn, setPlayerIn] = useState<number | null>(null);
  const [reason, setReason] = useState<string>('tactical');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch active players and bench players
  const fetchActivePlayers = useCallback(async () => {
    try {
      const response = await api.get(`/substitutions/${gameId}/active-players`);
      setActivePlayers(response.data);
    } catch (err) {
      console.error('Error fetching active players:', err);
      setError('Failed to load player status');
    }
  }, [gameId]);

  // Fetch recent substitutions
  const fetchRecentSubstitutions = useCallback(async () => {
    try {
      const response = await api.get(`/substitutions/${gameId}`);
      // Show only the 5 most recent
      setRecentSubstitutions(response.data.slice(0, 5));
    } catch (err) {
      console.error('Error fetching substitutions:', err);
    }
  }, [gameId]);

  useEffect(() => {
    fetchActivePlayers();
    fetchRecentSubstitutions();
  }, [fetchActivePlayers, fetchRecentSubstitutions]);

  const getCurrentTeamPlayers = () => {
    if (!activePlayers) return { active: [], bench: [] };
    
    if (selectedTeam === homeTeamId) {
      return activePlayers.home_team;
    } else {
      return activePlayers.away_team;
    }
  };

  const handleSubstitution = async () => {
    if (!playerOut || !playerIn) {
      setError('Please select both players for substitution');
      return;
    }

    if (playerOut === playerIn) {
      setError('Player in and player out must be different');
      return;
    }

    // Check if period has ended and require confirmation
    if (canAddEvents && !canAddEvents()) {
      return; // User cancelled, don't record the substitution
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post(`/substitutions/${gameId}`, {
        team_id: selectedTeam,
        player_in_id: playerIn,
        player_out_id: playerOut,
        period: currentPeriod,
        time_remaining: timeRemaining || null,
        reason: reason
      });

      setSuccess('Substitution recorded successfully!');
      
      // Reset form
      setPlayerOut(null);
      setPlayerIn(null);
      setReason('tactical');

      // Refresh data
      await fetchActivePlayers();
      await fetchRecentSubstitutions();

      // Notify parent component
      if (onSubstitutionRecorded) {
        onSubstitutionRecorded();
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const errorMessage = axiosError.response?.data?.error || 'Failed to record substitution';
      setError(errorMessage);
      console.error('Substitution error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSwap = (outPlayer: Player, inPlayer: Player) => {
    setPlayerOut(outPlayer.id);
    setPlayerIn(inPlayer.id);
  };

  const handleUndoSubstitution = async (subId: number) => {
    if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to undo this substitution?')) {
      return;
    }

    try {
      await api.delete(`/substitutions/${gameId}/${subId}`);
      setSuccess('Substitution undone successfully');
      
      // Refresh data
      await fetchActivePlayers();
      await fetchRecentSubstitutions();

      if (onSubstitutionRecorded) {
        onSubstitutionRecorded();
      }

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const errorMessage = axiosError.response?.data?.error || 'Failed to undo substitution';
      setError(errorMessage);
    }
  };

  const teamPlayers = getCurrentTeamPlayers();

  return (
    <div className="substitution-panel">
      <div className="substitution-header">
        <h3>⚡ Substitutions</h3>
        <p className="substitution-info">
          Period {currentPeriod} {timeRemaining && `• ${timeRemaining}`}
        </p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Team Selection */}
      <div className="team-selector">
        <button
          className={`team-button ${selectedTeam === homeTeamId ? 'active' : ''}`}
          onClick={() => {
            setSelectedTeam(homeTeamId);
            setPlayerOut(null);
            setPlayerIn(null);
          }}
        >
          {homeTeamName}
        </button>
        <button
          className={`team-button ${selectedTeam === awayTeamId ? 'active' : ''}`}
          onClick={() => {
            setSelectedTeam(awayTeamId);
            setPlayerOut(null);
            setPlayerIn(null);
          }}
        >
          {awayTeamName}
        </button>
      </div>

      {/* Substitution Form */}
      <div className="substitution-form">
        <div className="substitution-columns">
          {/* Player Out (from court) */}
          <div className="player-selection">
            <label className="selection-label" htmlFor="player-out-select">
              <span className="label-icon">⬇️</span> Player Out (on court)
            </label>
            <select
              id="player-out-select"
              value={playerOut || ''}
              onChange={(e) => setPlayerOut(Number(e.target.value))}
              className="player-select"
              disabled={loading}
              aria-label="Player Out (on court)"
            >
              <option value="">Select player to sub out</option>
              {teamPlayers.active.map((player) => (
                <option key={player.id} value={String(player.id)}>
                  #{player.jersey_number} {player.first_name} {player.last_name}
                  {player.gender && ` (${player.gender === 'male' ? 'M' : 'F'})`}
                </option>
              ))}
            </select>
          </div>

          <div className="swap-icon">⇄</div>

          {/* Player In (from bench) */}
          <div className="player-selection">
            <label className="selection-label" htmlFor="player-in-select">
              <span className="label-icon">⬆️</span> Player In (from bench)
            </label>
            <select
              id="player-in-select"
              value={playerIn || ''}
              onChange={(e) => setPlayerIn(Number(e.target.value))}
              className="player-select"
              disabled={loading}
              aria-label="Player In (from bench)"
            >
              <option value="">Select player to sub in</option>
              {teamPlayers.bench.map((player) => (
                <option key={player.id} value={String(player.id)}>
                  #{player.jersey_number} {player.first_name} {player.last_name}
                  {player.gender && ` (${player.gender === 'male' ? 'M' : 'F'})`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Reason Selection */}
        <div className="reason-selection">
          <label className="selection-label">Reason</label>
          <div className="reason-buttons">
            {['tactical', 'fatigue', 'injury', 'disciplinary'].map((r) => (
              <button
                key={r}
                className={`reason-button ${reason === r ? 'active' : ''}`}
                onClick={() => setReason(r)}
                disabled={loading}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <button
          className="submit-substitution-button"
          onClick={handleSubstitution}
          disabled={loading || !playerOut || !playerIn}
        >
          {loading ? 'Recording...' : '✓ Record Substitution'}
        </button>
      </div>

      {/* Quick Swap Suggestions */}
      {teamPlayers.active.length > 0 && teamPlayers.bench.length > 0 && (
        <div className="quick-swap-section">
          <h4>Quick Swap Suggestions</h4>
          <div className="quick-swap-grid">
            {teamPlayers.active.slice(0, 4).map((activePlayer) => (
              <div key={activePlayer.id} className="quick-swap-row">
                <div className="player-badge active-badge">
                  #{activePlayer.jersey_number} {activePlayer.first_name[0]}.{' '}
                  {activePlayer.last_name}
                </div>
                <span className="swap-arrow">→</span>
                {teamPlayers.bench
                  .filter((p) => p.gender === activePlayer.gender)
                  .slice(0, 1)
                  .map((benchPlayer) => (
                    <button
                      key={benchPlayer.id}
                      className="quick-swap-button"
                      onClick={() => handleQuickSwap(activePlayer, benchPlayer)}
                    >
                      #{benchPlayer.jersey_number} {benchPlayer.first_name[0]}.{' '}
                      {benchPlayer.last_name}
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Substitutions */}
      {recentSubstitutions.length > 0 && (
        <div className="recent-substitutions">
          <h4>Recent Substitutions</h4>
          <div className="substitutions-list">
            {recentSubstitutions.map((sub) => (
              <div key={sub.id} className="substitution-item">
                <div className="substitution-details">
                  <span className="substitution-team">{sub.team_name}</span>
                  <span className="substitution-change">
                    #{sub.player_out_jersey_number} {sub.player_out_first_name[0]}.{' '}
                    {sub.player_out_last_name}
                    <span className="sub-arrow"> → </span>
                    #{sub.player_in_jersey_number} {sub.player_in_first_name[0]}.{' '}
                    {sub.player_in_last_name}
                  </span>
                  <span className="substitution-meta">
                    P{sub.period} • {sub.reason}
                  </span>
                </div>
                {recentSubstitutions[0].id === sub.id && (
                  <button
                    className="undo-button"
                    onClick={() => handleUndoSubstitution(sub.id)}
                    title="Undo this substitution"
                  >
                    ↶ Undo
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Status Summary */}
      <div className="status-summary">
        <div className="team-status">
          <h5>{homeTeamName}</h5>
          <div className="status-line">
            <span className="status-label">On Court:</span>
            <span className="status-count">{activePlayers?.home_team.active.length || 0}</span>
          </div>
          <div className="status-line">
            <span className="status-label">On Bench:</span>
            <span className="status-count">{activePlayers?.home_team.bench.length || 0}</span>
          </div>
        </div>
        <div className="team-status">
          <h5>{awayTeamName}</h5>
          <div className="status-line">
            <span className="status-label">On Court:</span>
            <span className="status-count">{activePlayers?.away_team.active.length || 0}</span>
          </div>
          <div className="status-line">
            <span className="status-label">On Bench:</span>
            <span className="status-count">{activePlayers?.away_team.bench.length || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubstitutionPanel;
