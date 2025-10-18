import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import api from '../utils/api';
import courtImageUrl from '../img/Korfbalveld-breed.PNG?url';

interface Player {
  id: number;
  team_id: number;
  first_name: string;
  last_name: string;
  jersey_number: number;
  role: string;
  is_active: boolean;
}

interface Shot {
  id: number;
  game_id: number;
  team_id: number;
  player_id: number;
  x_coord: number;
  y_coord: number;
  result: 'goal' | 'miss' | 'blocked';
  shot_type: string | null;
  distance: number | null;
  period: number;
  time_remaining: {
    minutes?: number;
    seconds?: number;
  } | null;
  created_at: string;
  player_first_name?: string;
  player_last_name?: string;
}

interface Possession {
  id: number;
  game_id: number;
  team_id: number;
  period: number;
  started_at: string;
  ended_at: string | null;
  shots_taken: number;
  team_name?: string;
}

interface CourtVisualizationProps {
  gameId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  currentPeriod: number;
  homeAttackingSide: 'left' | 'right' | null | undefined;
  onShotRecorded: (shotInfo: { result: 'goal' | 'miss' | 'blocked'; teamId: number; opposingTeamId: number }) => void;
  activePossession: Possession | null;
  possessionDuration: number;
  onCenterLineCross: (teamId: number) => void;
  homePlayers?: Player[]; // Optional: If provided, won't fetch
  awayPlayers?: Player[]; // Optional: If provided, won't fetch
}

const CourtVisualization: React.FC<CourtVisualizationProps> = ({
  gameId,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  currentPeriod,
  homeAttackingSide,
  onShotRecorded,
  activePossession,
  possessionDuration,
  onCenterLineCross,
  homePlayers: homePlayersProps,
  awayPlayers: awayPlayersProps
}) => {
  const [homePlayers, setHomePlayers] = useState<Player[]>(homePlayersProps || []);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>(awayPlayersProps || []);
  const [shots, setShots] = useState<Shot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'away'>('home');
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [shotType, setShotType] = useState<string>('');
  const [clickedCoords, setClickedCoords] = useState<{ x: number; y: number } | null>(null);
  
  // Korf (goal) positions on the field - these are constants, no need to recalculate
  const KORF_LEFT = useMemo(() => ({ x: 13, y: 50 }), []);  // Left korf at 13% from left, center height
  const KORF_RIGHT = useMemo(() => ({ x: 87, y: 50 }), []); // Right korf at 87% from left, center height
  const FIELD_LENGTH = 40; // meters
  const FIELD_WIDTH = 20;  // meters
  const FIELD_CENTER_X = 50; // Center line at 50%

  // Determine which team attacks which korf based on initial setup - memoize to avoid recalculation
  const getAttackingConfiguration = useMemo(() => {
    if (!homeAttackingSide) {
      return { homeAttacksLeft: true, message: 'Attacking side not set' };
    }

    // The home team always attacks the same korf throughout the match
    const homeAttacksLeft = homeAttackingSide === 'left';
    
    return { 
      homeAttacksLeft,
      message: `${homeTeamName} attacks ${homeAttackingSide} korf, ${awayTeamName} attacks ${homeAttackingSide === 'left' ? 'right' : 'left'} korf`
    };
  }, [homeAttackingSide, homeTeamName, awayTeamName]);

  // Determine which team can shoot from a given x-coordinate - use useCallback to memoize the function
  const getTeamFromPosition = useCallback((xCoord: number): { teamId: number; teamName: string; side: 'home' | 'away' } | null => {
    const isLeftHalf = xCoord < FIELD_CENTER_X;
    
    if (getAttackingConfiguration.homeAttacksLeft) {
      if (isLeftHalf) {
        return { teamId: homeTeamId, teamName: homeTeamName, side: 'home' };
      } else {
        return { teamId: awayTeamId, teamName: awayTeamName, side: 'away' };
      }
    } else {
      if (isLeftHalf) {
        return { teamId: awayTeamId, teamName: awayTeamName, side: 'away' };
      } else {
        return { teamId: homeTeamId, teamName: homeTeamName, side: 'home' };
      }
    }
  }, [getAttackingConfiguration, homeTeamId, homeTeamName, awayTeamId, awayTeamName]);
  
  const courtRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const fetchPlayers = useCallback(async () => {
    // Skip fetching if players were provided via props
    if (homePlayersProps && awayPlayersProps) {
      return;
    }

    try {
      const [homeResponse, awayResponse] = await Promise.all([
        api.get(`/players?team_id=${homeTeamId}`),
        api.get(`/players?team_id=${awayTeamId}`)
      ]);
      
      setHomePlayers(homeResponse.data.filter((p: Player) => p.is_active));
      setAwayPlayers(awayResponse.data.filter((p: Player) => p.is_active));
      
      // Auto-select first player
      if (homeResponse.data.length > 0) {
        setSelectedPlayerId(homeResponse.data[0].id);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching players:', error);
      }
      setError('Failed to load players');
    }
  }, [homeTeamId, awayTeamId, homePlayersProps, awayPlayersProps]);

  const fetchShots = useCallback(async () => {
    try {
      const response = await api.get(`/shots/${gameId}`);
      setShots(response.data);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching shots:', error);
      }
    }
  }, [gameId]);

  // Update players when props change
  useEffect(() => {
    if (homePlayersProps) {
      setHomePlayers(homePlayersProps);
    }
    if (awayPlayersProps) {
      setAwayPlayers(awayPlayersProps);
      // Auto-select first player if not already selected
      if (awayPlayersProps.length > 0 && !selectedPlayerId) {
        setSelectedPlayerId(homePlayersProps?.[0]?.id || awayPlayersProps[0].id);
      }
    }
  }, [homePlayersProps, awayPlayersProps, selectedPlayerId]);

  // Fetch players and shots on mount (only if players not provided via props)
  useEffect(() => {
    if (!homePlayersProps || !awayPlayersProps) {
      fetchPlayers();
    }
    fetchShots();
  }, [fetchPlayers, fetchShots, homePlayersProps, awayPlayersProps]);

  // Calculate distance from a point to the nearest korf in meters - memoize with useCallback
  const calculateDistanceToKorf = useCallback((x: number, y: number): number => {
    const distToLeft = Math.sqrt(
      Math.pow((x - KORF_LEFT.x) / 100 * FIELD_LENGTH, 2) + 
      Math.pow((y - KORF_LEFT.y) / 100 * FIELD_WIDTH, 2)
    );
    
    const distToRight = Math.sqrt(
      Math.pow((x - KORF_RIGHT.x) / 100 * FIELD_LENGTH, 2) + 
      Math.pow((y - KORF_RIGHT.y) / 100 * FIELD_WIDTH, 2)
    );
    
    // Return distance to nearest korf, rounded to 1 decimal
    return Math.round(Math.min(distToLeft, distToRight) * 10) / 10;
  }, [KORF_LEFT, KORF_RIGHT]);

  // Handle court click to record coordinates - memoize with useCallback
  const handleCourtClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current || !courtRef.current) return;

    const rect = courtRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convert to percentage (0-100)
    const xPercent = Math.round((x / rect.width) * 100);
    const yPercent = Math.round((y / rect.height) * 100);

    // Clamp to 0-100 range
    const clampedX = Math.max(0, Math.min(100, xPercent));
    const clampedY = Math.max(0, Math.min(100, yPercent));

    // Automatically determine which team should shoot from this position
    const teamInfo = getTeamFromPosition(clampedX);
    
    if (!teamInfo) {
      setError('Unable to determine which team shoots from this position');
      return;
    }
    
    // Auto-select the correct team
    setSelectedTeam(teamInfo.side);
    
    // Auto-select first player from that team
    const players = teamInfo.side === 'home' ? homePlayers : awayPlayers;
    if (players.length > 0) {
      setSelectedPlayerId(players[0].id);
    }

    setClickedCoords({ x: clampedX, y: clampedY });
    setError(null);
    
    // Show info about automatic team selection
    setSuccess(`Shot position: ${teamInfo.teamName} attacking half`);
    setTimeout(() => setSuccess(null), 2000);
  }, [getTeamFromPosition, homePlayers, awayPlayers]);

  // Record shot with specific result - memoize with useCallback
  const handleRecordShot = useCallback(async (result: 'goal' | 'miss' | 'blocked') => {
    if (!clickedCoords) {
      setError('Please click on the court to select shot location');
      return;
    }

    if (!selectedPlayerId) {
      setError('Please select a player');
      return;
    }

    try {
      setError(null);
      
      // Calculate distance to nearest korf automatically
      const calculatedDistance = calculateDistanceToKorf(clickedCoords.x, clickedCoords.y);
      
      const shotData = {
        team_id: selectedTeam === 'home' ? homeTeamId : awayTeamId,
        player_id: selectedPlayerId,
        x_coord: clickedCoords.x,
        y_coord: clickedCoords.y,
        result: result,
        period: currentPeriod,
        distance: calculatedDistance,
        ...(shotType && { shot_type: shotType }) // Only add shot_type if provided
      };

      await api.post(`/shots/${gameId}`, shotData);
      
      setSuccess(`${result === 'goal' ? 'Goal' : result === 'miss' ? 'Miss' : 'Blocked shot'} recorded!`);
      setTimeout(() => setSuccess(null), 3000);
      
      // Reset form
      setClickedCoords(null);
      setShotType('');
      
      // Refresh data
      await fetchShots();
      
      // Notify parent with shot information
      const scoringTeamId = selectedTeam === 'home' ? homeTeamId : awayTeamId;
      const opposingTeamId = selectedTeam === 'home' ? awayTeamId : homeTeamId;
      onShotRecorded({ result, teamId: scoringTeamId, opposingTeamId });
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error recording shot');
    }
  }, [clickedCoords, selectedPlayerId, calculateDistanceToKorf, selectedTeam, homeTeamId, awayTeamId, currentPeriod, shotType, gameId, fetchShots, onShotRecorded]);

  // Get current team players - memoize to avoid recalculation
  const currentPlayers = useMemo(() => 
    selectedTeam === 'home' ? homePlayers : awayPlayers,
    [selectedTeam, homePlayers, awayPlayers]
  );

  // Render shot markers on court
  const renderShotMarkers = () => {
    if (!courtRef.current) return null;

    return shots.map((shot) => {
      const color = shot.result === 'goal' ? '#4CAF50' : shot.result === 'miss' ? '#f44336' : '#FF9800';
      
      return (
        <div
          key={shot.id}
          className="shot-marker"
          style={{
            left: `${shot.x_coord}%`,
            top: `${shot.y_coord}%`,
            backgroundColor: color,
            border: `2px solid ${color}`,
          }}
          title={`${shot.player_first_name} ${shot.player_last_name} - ${shot.result} (Period ${shot.period})`}
        />
      );
    });
  };

  // Render clicked position indicator
  const renderClickedPosition = () => {
    if (!clickedCoords) return null;

    return (
      <div
        className="shot-marker selected"
        style={{
          left: `${clickedCoords.x}%`,
          top: `${clickedCoords.y}%`,
        }}
      />
    );
  };

  // Render korf (goal) markers
  const renderKorfMarkers = () => {
    return (
      <>
        <div
          className="korf-marker"
          style={{
            left: `${KORF_LEFT.x}%`,
            top: `${KORF_LEFT.y}%`,
          }}
          title="Left Korf (Goal)"
        >
          🥅
        </div>
        <div
          className="korf-marker"
          style={{
            left: `${KORF_RIGHT.x}%`,
            top: `${KORF_RIGHT.y}%`,
          }}
          title="Right Korf (Goal)"
        >
          🥅
        </div>
      </>
    );
  };

  return (
    <div className="court-visualization">
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Attacking Configuration Info with Possession Tracking */}
      {homeAttackingSide && (
        <div className="attacking-info">
          <div className="attacking-config">
            <div className="info-header">
              <div className="team-attacking-info">
                <div className="config-item">
                  <strong>{homeTeamName}:</strong> Attacking {getAttackingConfiguration.homeAttacksLeft ? 'LEFT' : 'RIGHT'} korf
                </div>
                <div className="config-item">
                  <strong>{awayTeamName}:</strong> Attacking {getAttackingConfiguration.homeAttacksLeft ? 'RIGHT' : 'LEFT'} korf
                </div>
              </div>
              
              {/* Active Possession Indicator */}
              {activePossession && (
                <div className="active-possession-inline">
                  <span className="possession-team">{activePossession.team_name}</span>
                  <span className="possession-duration">{possessionDuration}s</span>
                  <span className="possession-shots">{activePossession.shots_taken} shot{activePossession.shots_taken !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
          
          {/* Possession Control Buttons */}
          <div className="possession-buttons-inline">
            <button 
              onClick={() => onCenterLineCross(homeTeamId)}
              className={`possession-button-compact home-team ${activePossession?.team_id === homeTeamId ? 'has-possession' : ''}`}
            >
              {activePossession?.team_id === homeTeamId ? '🏀' : '📍'} {homeTeamName}
            </button>
            <button 
              onClick={() => onCenterLineCross(awayTeamId)}
              className={`possession-button-compact away-team ${activePossession?.team_id === awayTeamId ? 'has-possession' : ''}`}
            >
              {activePossession?.team_id === awayTeamId ? '🏀' : '📍'} {awayTeamName}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Court Image with Click Handling */}
      <div 
        ref={courtRef}
        className="court-container"
        onClick={handleCourtClick}
      >
        <img 
          ref={imageRef}
          src={courtImageUrl} 
          alt="Korfball Court" 
          className="court-image"
          draggable={false}
        />
        {renderKorfMarkers()}
        {renderShotMarkers()}
        {renderClickedPosition()}
      </div>

      {/* Shot Recording Controls */}
      <div className="shot-controls">
        <div className="control-row">
          {/* Team Selection */}
          <div className="form-group">
            <label>Team:</label>
            <select
              value={selectedTeam}
              onChange={(e) => {
                setSelectedTeam(e.target.value as 'home' | 'away');
                // Reset player selection when switching teams
                const players = e.target.value === 'home' ? homePlayers : awayPlayers;
                setSelectedPlayerId(players.length > 0 ? players[0].id : null);
              }}
            >
              <option value="home">{homeTeamName} (Home)</option>
              <option value="away">{awayTeamName} (Away)</option>
            </select>
          </div>

          {/* Player Selection */}
          <div className="form-group">
            <label>Player:</label>
            <select
              value={selectedPlayerId || ''}
              onChange={(e) => setSelectedPlayerId(parseInt(e.target.value))}
            >
              <option value="">Select player</option>
              {currentPlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  #{player.jersey_number} {player.first_name} {player.last_name}
                </option>
              ))}
            </select>
          </div>

          {/* Shot Type (Optional) */}
          <div className="form-group">
            <label>Shot Type:</label>
            <select
              value={shotType}
              onChange={(e) => setShotType(e.target.value)}
            >
              <option value="">Not specified</option>
              <option value="running_shot">Running Shot</option>
              <option value="standing_shot">Standing Shot</option>
              <option value="penalty">Penalty</option>
              <option value="rebound">Rebound</option>
            </select>
          </div>

          {/* Auto-calculated Distance Display */}
          {clickedCoords && (
            <div className="form-group">
              <label>Distance to Korf:</label>
              <div className="distance-display">
                {calculateDistanceToKorf(clickedCoords.x, clickedCoords.y).toFixed(1)} m
              </div>
            </div>
          )}
        </div>

        {/* Result Buttons */}
        <div className="result-buttons">
          <button
            onClick={() => handleRecordShot('goal')}
            className="primary-button goal-button"
            disabled={!clickedCoords || !selectedPlayerId}
          >
            ⚽ Goal
          </button>
          <button
            onClick={() => handleRecordShot('miss')}
            className="secondary-button miss-button"
            disabled={!clickedCoords || !selectedPlayerId}
          >
            ✗ Miss
          </button>
          <button
            onClick={() => handleRecordShot('blocked')}
            className="secondary-button blocked-button"
            disabled={!clickedCoords || !selectedPlayerId}
          >
            🛡️ Blocked
          </button>
          
          {clickedCoords && (
            <button
              onClick={() => setClickedCoords(null)}
              className="danger-button"
            >
              Clear Position
            </button>
          )}
        </div>

        {clickedCoords && (
          <div className="coordinates-display">
            Selected position: ({clickedCoords.x}, {clickedCoords.y}) • 
            Distance: {calculateDistanceToKorf(clickedCoords.x, clickedCoords.y).toFixed(1)}m to nearest korf
          </div>
        )}
      </div>

      {/* Shot Legend */}
      <div className="shot-legend">
        <h4>Shot Legend:</h4>
        <div className="legend-items">
          <div className="legend-item">
            <div className="legend-marker goal-marker"></div>
            <span>Goal</span>
          </div>
          <div className="legend-item">
            <div className="legend-marker miss-marker"></div>
            <span>Miss</span>
          </div>
          <div className="legend-item">
            <div className="legend-marker blocked-marker"></div>
            <span>Blocked</span>
          </div>
          <div className="legend-item">
            <div className="legend-marker selected-marker"></div>
            <span>Selected Position</span>
          </div>
          <div className="legend-item">
            <span className="korf-emoji">🥅</span>
            <span>Korf (Goal)</span>
          </div>
        </div>
      </div>

          {/* Field Info */}
      <div className="field-info">
        <p>
          <strong>Field Dimensions:</strong> 40m × 20m • 
          <strong> Korfs:</strong> Located at 13% and 87% horizontally, center vertically • 
          <strong> Note:</strong> Within each team, attacking and defending players switch sides every 2 goals
        </p>
      </div>      {/* Shot Statistics */}
      <div className="shot-stats">
        <h4>Match Shots: {shots.length}</h4>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Goals:</span>
            <span className="stat-value">{shots.filter(s => s.result === 'goal').length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Misses:</span>
            <span className="stat-value">{shots.filter(s => s.result === 'miss').length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Blocked:</span>
            <span className="stat-value">{shots.filter(s => s.result === 'blocked').length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Success Rate:</span>
            <span className="stat-value">
              {shots.length > 0 
                ? Math.round((shots.filter(s => s.result === 'goal').length / shots.length) * 100) 
                : 0}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourtVisualization;
