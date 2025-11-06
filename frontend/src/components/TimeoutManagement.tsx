import React, { useState, useEffect } from 'react';
import api from '../utils/api';

interface TimeoutManagementProps {
  gameId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  currentPeriod: number;
  timeRemaining?: string;
  onTimeoutRecorded?: () => void;
  canAddEvents?: () => boolean; // Period end check function
}

interface Timeout {
  id: number;
  game_id: number;
  team_id?: number;
  timeout_type: string;
  period: number;
  time_remaining?: string;
  duration: string;
  reason?: string;
  called_by?: string;
  team_name?: string;
  created_at: string;
  ended_at?: string;
}

const TimeoutManagement: React.FC<TimeoutManagementProps> = ({
  gameId,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  currentPeriod,
  timeRemaining,
  onTimeoutRecorded,
  canAddEvents
}) => {
  const [recentTimeouts, setRecentTimeouts] = useState<Timeout[]>([]);
  const [activeTimeouts, setActiveTimeouts] = useState<Timeout[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [selectedTeam, setSelectedTeam] = useState<number | null>(homeTeamId);
  const [timeoutType, setTimeoutType] = useState<'team' | 'injury' | 'official' | 'tv'>('team');
  const [duration, setDuration] = useState('1 minute');
  const [reason, setReason] = useState('');
  const [calledBy, setCalledBy] = useState('');

  useEffect(() => {
    fetchRecentTimeouts();
  }, [gameId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Reset team selection based on timeout type
    if (timeoutType === 'team') {
      setSelectedTeam(homeTeamId);
    } else {
      setSelectedTeam(null);
    }
  }, [timeoutType, homeTeamId]);

  const fetchRecentTimeouts = async () => {
    try {
      const response = await api.get(`/timeouts/${gameId}`);
      const timeouts = response.data;
      
      setRecentTimeouts(timeouts.slice(0, 5)); // Show last 5 timeouts
      setActiveTimeouts(timeouts.filter((t: Timeout) => !t.ended_at)); // Active timeouts
    } catch (err) {
      console.error('Error fetching timeouts:', err);
    }
  };

  const handleStartTimeout = async () => {
    if (timeoutType === 'team' && !selectedTeam) {
      setError('Please select a team for team timeout');
      return;
    }

    // Check if period has ended and require confirmation
    if (canAddEvents && !canAddEvents()) {
      return; // User cancelled, don't start the timeout
    }

    setLoading(true);
    setError(null);

    try {
      const timeoutData = {
        team_id: timeoutType === 'team' ? selectedTeam : null,
        timeout_type: timeoutType,
        period: currentPeriod,
        time_remaining: timeRemaining || null,
        duration: duration,
        reason: reason || null,
        called_by: calledBy || null
      };

      await api.post(`/timeouts/${gameId}`, timeoutData);

      setSuccess(`${getTimeoutDisplayName(timeoutType)} started successfully`);
      
      // Reset form
      setReason('');
      setCalledBy('');
      setDuration('1 minute');
      
      // Refresh timeouts
      fetchRecentTimeouts();
      
      // Notify parent component
      if (onTimeoutRecorded) {
        onTimeoutRecorded();
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const error = err as Error & { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to start timeout');
    } finally {
      setLoading(false);
    }
  };

  const handleEndTimeout = async (timeoutId: number) => {
    try {
      await api.put(`/timeouts/${gameId}/${timeoutId}/end`);
      setSuccess('Timeout ended successfully');
      fetchRecentTimeouts();
      if (onTimeoutRecorded) {
        onTimeoutRecorded();
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const error = err as Error & { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to end timeout');
    }
  };

  const deleteTimeout = async (timeoutId: number) => {
    try {
      await api.delete(`/timeouts/${gameId}/${timeoutId}`);
      setSuccess('Timeout removed successfully');
      fetchRecentTimeouts();
      if (onTimeoutRecorded) {
        onTimeoutRecorded();
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const error = err as Error & { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to remove timeout');
    }
  };

  const getTimeoutDisplayName = (type: string): string => {
    switch (type) {
      case 'team':
        return 'Team Timeout';
      case 'injury':
        return 'Injury Timeout';
      case 'official':
        return 'Official Timeout';
      case 'tv':
        return 'TV Timeout';
      default:
        return 'Timeout';
    }
  };

  const getTimeoutDescription = (type: string): string => {
    switch (type) {
      case 'team':
        return 'Strategic timeout called by team coach';
      case 'injury':
        return 'Timeout due to player injury';
      case 'official':
        return 'Timeout called by match referee';
      case 'tv':
        return 'Television/broadcast timeout';
      default:
        return '';
    }
  };

  const formatDuration = (duration: string): string => {
    // Convert PostgreSQL interval to readable format
    if (duration.includes('minute')) return duration;
    if (duration.includes(':')) {
      const parts = duration.split(':');
      const minutes = parseInt(parts[0]);
      const seconds = parseInt(parts[1]);
      if (minutes > 0) {
        return `${minutes} minute${minutes !== 1 ? 's' : ''}${seconds > 0 ? ` ${seconds}s` : ''}`;
      }
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
    return duration;
  };

  return (
    <div className="timeout-management">
      <h4>Timeout Management</h4>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Active Timeouts */}
      {activeTimeouts.length > 0 && (
        <div className="active-timeouts">
          <h5>⏰ Active Timeouts</h5>
          <div className="timeout-list">
            {activeTimeouts.map((timeout) => (
              <div key={timeout.id} className="timeout-item active">
                <div className="timeout-info">
                  <span className="timeout-type">{getTimeoutDisplayName(timeout.timeout_type)}</span>
                  {timeout.team_name && <span className="team-name">{timeout.team_name}</span>}
                  <span className="timeout-duration">{formatDuration(timeout.duration)}</span>
                  {timeout.called_by && <span className="called-by">Called by: {timeout.called_by}</span>}
                </div>
                <button
                  onClick={() => handleEndTimeout(timeout.id)}
                  className="end-timeout-button"
                  title="End this timeout"
                >
                  ⏹️ End
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="timeout-form">
        {/* Timeout Type Selection */}
        <div className="form-group">
          <label>Timeout Type:</label>
          <div className="timeout-type-buttons">
            <button
              className={`timeout-type-btn ${timeoutType === 'team' ? 'active' : ''}`}
              onClick={() => setTimeoutType('team')}
              type="button"
            >
              👥 Team
            </button>
            <button
              className={`timeout-type-btn ${timeoutType === 'injury' ? 'active' : ''}`}
              onClick={() => setTimeoutType('injury')}
              type="button"
            >
              🏥 Injury
            </button>
            <button
              className={`timeout-type-btn ${timeoutType === 'official' ? 'active' : ''}`}
              onClick={() => setTimeoutType('official')}
              type="button"
            >
              👨‍⚖️ Official
            </button>
            <button
              className={`timeout-type-btn ${timeoutType === 'tv' ? 'active' : ''}`}
              onClick={() => setTimeoutType('tv')}
              type="button"
            >
              📺 TV
            </button>
          </div>
          <small className="helper-text">
            {getTimeoutDescription(timeoutType)}
          </small>
        </div>

        {/* Team Selection (only for team timeouts) */}
        {timeoutType === 'team' && (
          <div className="form-group">
            <label>Team:</label>
            <select
              value={selectedTeam || ''}
              onChange={(e) => setSelectedTeam(parseInt(e.target.value))}
            >
              <option value={homeTeamId}>{homeTeamName} (Home)</option>
              <option value={awayTeamId}>{awayTeamName} (Away)</option>
            </select>
          </div>
        )}

        {/* Duration */}
        <div className="form-group">
          <label>Duration:</label>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          >
            <option value="30 seconds">30 seconds</option>
            <option value="1 minute">1 minute</option>
            <option value="2 minutes">2 minutes</option>
            <option value="5 minutes">5 minutes</option>
          </select>
        </div>

        {/* Called By */}
        <div className="form-group">
          <label>Called By:</label>
          <input
            type="text"
            value={calledBy}
            onChange={(e) => setCalledBy(e.target.value)}
            placeholder={timeoutType === 'team' ? 'Coach name' : 'Official name'}
            maxLength={100}
          />
        </div>

        {/* Reason */}
        <div className="form-group">
          <label>Reason (Optional):</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Brief description of timeout reason"
            maxLength={200}
          />
        </div>

        {/* Submit Button */}
        <button
          onClick={handleStartTimeout}
          disabled={loading || (timeoutType === 'team' && !selectedTeam)}
          className="primary-button"
        >
          {loading ? 'Starting...' : `Start ${getTimeoutDisplayName(timeoutType)}`}
        </button>
      </div>

      {/* Recent Timeouts */}
      {recentTimeouts.length > 0 && (
        <div className="recent-timeouts">
          <h5>Recent Timeouts (Period {currentPeriod})</h5>
          <div className="timeout-list">
            {recentTimeouts.map((timeout) => (
              <div key={timeout.id} className={`timeout-item ${timeout.ended_at ? 'completed' : 'active'}`}>
                <div className="timeout-info">
                  <span className="timeout-type">{getTimeoutDisplayName(timeout.timeout_type)}</span>
                  {timeout.team_name && <span className="team-name">{timeout.team_name}</span>}
                  <span className="timeout-duration">{formatDuration(timeout.duration)}</span>
                  {timeout.called_by && <span className="called-by">Called by: {timeout.called_by}</span>}
                  {timeout.reason && <span className="timeout-reason">({timeout.reason})</span>}
                  <span className="timeout-time">
                    {timeout.time_remaining || `Period ${timeout.period}`}
                  </span>
                  {timeout.ended_at && <span className="status">✓ Completed</span>}
                  {!timeout.ended_at && <span className="status">⏰ Active</span>}
                </div>
                <div className="timeout-actions">
                  {!timeout.ended_at && (
                    <button
                      onClick={() => handleEndTimeout(timeout.id)}
                      className="end-timeout-button"
                      title="End this timeout"
                    >
                      ⏹️ End
                    </button>
                  )}
                  <button
                    onClick={() => deleteTimeout(timeout.id)}
                    className="delete-button"
                    title="Remove this timeout"
                  >
                    🗑️ Delete
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

export default TimeoutManagement;