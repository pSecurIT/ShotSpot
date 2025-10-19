import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import api from '../utils/api';
import courtImageUrl from '../img/Korfbalveld-breed.PNG';

interface Player {
  id: number;
  team_id: number;
  first_name: string;
  last_name: string;
  jersey_number: number;
  role: string;
  is_active: boolean;
  starting_position?: 'offense' | 'defense'; // Position at match start
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
  timerState?: string; // 'running' | 'paused' | 'stopped'
  onResumeTimer?: () => void; // Resume timer when clicking court
  onPauseTimer?: () => Promise<void>; // Pause timer immediately when goal scored
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
  awayPlayers: awayPlayersProps,
  timerState,
  onResumeTimer,
  onPauseTimer
}) => {
  const [homePlayers, setHomePlayers] = useState<Player[]>(homePlayersProps || []);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>(awayPlayersProps || []);
  const [shots, setShots] = useState<Shot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Track if we've logged the "no starting_position" warning to avoid console spam
  const hasLoggedPositionWarning = useRef({ home: false, away: false });
  
  // Form state
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'away'>('home');
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [shotType, setShotType] = useState<string>('running_shot'); // Default to most common shot type
  const [clickedCoords, setClickedCoords] = useState<{ x: number; y: number } | null>(null);
  const [lastSelectedPlayerId, setLastSelectedPlayerId] = useState<number | null>(null); // Remember last player
  
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
      // Fetch from game roster to get starting_position data
      const rosterResponse = await api.get(`/game-rosters/${gameId}`);
      const rosterPlayers = rosterResponse.data;
      
      // Separate by team and include starting_position
      const homePlayers = rosterPlayers
        .filter((p: Player & { is_starting: boolean; player_id: number }) => p.team_id === homeTeamId && p.is_starting)
        .map((p: Player & { is_starting: boolean; player_id: number }) => ({
          id: p.player_id,
          team_id: p.team_id,
          first_name: p.first_name,
          last_name: p.last_name,
          jersey_number: p.jersey_number,
          role: 'player',
          is_active: true,
          starting_position: p.starting_position
        }));
      
      const awayPlayers = rosterPlayers
        .filter((p: Player & { is_starting: boolean; player_id: number }) => p.team_id === awayTeamId && p.is_starting)
        .map((p: Player & { is_starting: boolean; player_id: number }) => ({
          id: p.player_id,
          team_id: p.team_id,
          first_name: p.first_name,
          last_name: p.last_name,
          jersey_number: p.jersey_number,
          role: 'player',
          is_active: true,
          starting_position: p.starting_position
        }));
      
      setHomePlayers(homePlayers);
      setAwayPlayers(awayPlayers);
      
      // Auto-select first offensive player
      const firstOffensivePlayer = homePlayers.find((p: Player) => p.starting_position === 'offense');
      if (firstOffensivePlayer) {
        setSelectedPlayerId(firstOffensivePlayer.id);
      } else if (homePlayers.length > 0) {
        setSelectedPlayerId(homePlayers[0].id);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching players:', error);
      }
      setError('Failed to load players');
    }
  }, [gameId, homeTeamId, awayTeamId, homePlayersProps, awayPlayersProps]);

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

  // Auto-select first offensive player when players or shots change
  useEffect(() => {
    if (!selectedPlayerId && (homePlayers.length > 0 || awayPlayers.length > 0)) {
      const teamId = selectedTeam === 'home' ? homeTeamId : awayTeamId;
      
      // Calculate current offensive players inline
      const teamPlayers = teamId === homeTeamId ? homePlayers : awayPlayers;
      const teamGoals = shots.filter(s => s.team_id === teamId && s.result === 'goal').length;
      const switches = Math.floor(teamGoals / 2);
      const positionsSwapped = switches % 2 === 1;
      
      const offensivePlayers = teamPlayers.filter(player => {
        const isStartingOffense = player.starting_position === 'offense';
        return positionsSwapped ? !isStartingOffense : isStartingOffense;
      });
      
      if (offensivePlayers.length > 0) {
        setSelectedPlayerId(offensivePlayers[0].id);
      }
    }
  }, [homePlayers, awayPlayers, shots, selectedPlayerId, selectedTeam, homeTeamId, awayTeamId]);

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

  // Calculate which players are currently in offense for a team
  // Offense and defense switch every 2 goals scored by that team
  const getCurrentOffensivePlayers = useCallback((teamId: number): Player[] => {
    const teamPlayers = teamId === homeTeamId ? homePlayers : awayPlayers;
    
    // If no players have starting_position data, return all players as fallback
    const hasPositionData = teamPlayers.some(p => p.starting_position);
    if (!hasPositionData) {
      // Only log once per team to avoid console spam
      const teamKey = teamId === homeTeamId ? 'home' : 'away';
      if (process.env.NODE_ENV === 'development' && teamPlayers.length > 0 && !hasLoggedPositionWarning.current[teamKey]) {
        console.warn(`[${teamKey === 'home' ? 'Home' : 'Away'} Team] No starting_position data, showing all ${teamPlayers.length} players`);
        hasLoggedPositionWarning.current[teamKey] = true;
      }
      return teamPlayers;
    }
    
    // Count goals scored by this team
    const teamGoals = shots.filter(s => s.team_id === teamId && s.result === 'goal').length;
    
    // Number of position switches (every 2 goals)
    const switches = Math.floor(teamGoals / 2);
    
    // If odd number of switches, offense and defense are swapped
    const positionsSwapped = switches % 2 === 1;
    
    // Filter players based on current position
    const offensivePlayers = teamPlayers.filter(player => {
      const isStartingOffense = player.starting_position === 'offense';
      // If positions swapped, starting defense is now offense and vice versa
      return positionsSwapped ? !isStartingOffense : isStartingOffense;
    });
    
    // Fallback: if no offensive players found, return all players
    if (offensivePlayers.length === 0) {
      console.warn('No offensive players found, showing all players');
      return teamPlayers;
    }
    
    return offensivePlayers;
  }, [homeTeamId, homePlayers, awayPlayers, shots]);

  // Handle court click to record coordinates - memoize with useCallback
  const handleCourtClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current || !courtRef.current) return;

    // Don't register shots when timer is paused (overlay will handle resume)
    if (timerState === 'paused') {
      return;
    }

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
    
    // Auto-select first OFFENSIVE player from that team
    const offensivePlayers = getCurrentOffensivePlayers(teamInfo.teamId);
    if (offensivePlayers.length > 0) {
      // If last selected player is still in offense, keep them selected
      const lastPlayerStillOffense = lastSelectedPlayerId && 
        offensivePlayers.some(p => p.id === lastSelectedPlayerId);
      
      setSelectedPlayerId(lastPlayerStillOffense ? lastSelectedPlayerId : offensivePlayers[0].id);
    } else {
      // Fallback to any player if no offensive players found
      const players = teamInfo.side === 'home' ? homePlayers : awayPlayers;
      if (players.length > 0) {
        setSelectedPlayerId(players[0].id);
      }
    }

    setClickedCoords({ x: clampedX, y: clampedY });
    setError(null);
    
    // Show info about automatic team selection
    setSuccess(`Shot position: ${teamInfo.teamName} attacking half`);
    setTimeout(() => setSuccess(null), 2000);
  }, [getTeamFromPosition, homePlayers, awayPlayers, getCurrentOffensivePlayers, lastSelectedPlayerId, timerState]);

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
      
      // PAUSE TIMER IMMEDIATELY if this is a goal
      if (result === 'goal' && onPauseTimer && timerState === 'running') {
        await onPauseTimer();
      }
      
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
        shot_type: shotType // Always include shot_type (defaults to running_shot)
      };

      await api.post(`/shots/${gameId}`, shotData);
      
      setSuccess(`${result === 'goal' ? 'Goal' : result === 'miss' ? 'Miss' : 'Blocked shot'} recorded!`);
      setTimeout(() => setSuccess(null), 2000);
      
      // Remember the selected player for next shot
      setLastSelectedPlayerId(selectedPlayerId);
      
      // Reset form but keep player and shot type
      setClickedCoords(null);
      // Keep shotType for next shot (don't reset)
      // Keep selectedPlayerId for quick repeat shots
      
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
  }, [clickedCoords, selectedPlayerId, calculateDistanceToKorf, selectedTeam, homeTeamId, awayTeamId, currentPeriod, shotType, gameId, fetchShots, onShotRecorded, onPauseTimer, timerState]);

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
        className={`court-container ${timerState === 'paused' ? 'paused' : ''}`}
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
        
        {/* Pause Overlay - Show when timer is paused */}
        {timerState === 'paused' && (
          <div 
            className="pause-overlay"
            onClick={async (e) => {
              e.stopPropagation(); // Prevent court click handler
              if (onResumeTimer) {
                setSuccess('⏯️ Resuming timer...');
                await onResumeTimer();
                setTimeout(() => setSuccess(null), 2000);
              }
            }}
          >
            <div className="pause-icon">⏸️</div>
            <div className="pause-text">Click to Resume</div>
          </div>
        )}
      </div>

      {/* Shot Recording Controls */}
      <div className="shot-controls">
        {/* Shot Type Buttons - Prominent and always visible */}
        <div className="shot-type-buttons">
          <label className="shot-type-label">Shot Type:</label>
          <div className="button-group">
            <button
              className={`shot-type-btn ${shotType === 'running_shot' ? 'active' : ''}`}
              onClick={() => setShotType('running_shot')}
            >
              🏃 Running
            </button>
            <button
              className={`shot-type-btn ${shotType === 'standing_shot' ? 'active' : ''}`}
              onClick={() => setShotType('standing_shot')}
            >
              🧍 Standing
            </button>
            <button
              className={`shot-type-btn ${shotType === 'free_throw' ? 'active' : ''}`}
              onClick={() => setShotType('free_throw')}
            >
              🎯 Free Throw
            </button>
            <button
              className={`shot-type-btn ${shotType === 'penalty' ? 'active' : ''}`}
              onClick={() => setShotType('penalty')}
            >
              ⚠️ Penalty
            </button>
            <button
              className={`shot-type-btn ${shotType === 'rebound' ? 'active' : ''}`}
              onClick={() => setShotType('rebound')}
            >
              ↩️ Rebound
            </button>
          </div>
        </div>

        <div className="control-row">
          {/* Team Selection */}
          <div className="form-group">
            <label>Team:</label>
            <select
              value={selectedTeam}
              onChange={(e) => {
                const newTeam = e.target.value as 'home' | 'away';
                setSelectedTeam(newTeam);
                // Auto-select first offensive player from new team
                const teamId = newTeam === 'home' ? homeTeamId : awayTeamId;
                const offensivePlayers = getCurrentOffensivePlayers(teamId);
                setSelectedPlayerId(offensivePlayers.length > 0 ? offensivePlayers[0].id : null);
              }}
            >
              <option value="home">{homeTeamName} (Home)</option>
              <option value="away">{awayTeamName} (Away)</option>
            </select>
          </div>

          {/* Player Selection - Only show OFFENSIVE players */}
          <div className="form-group">
            <label>Offensive Player:</label>
            <select
              value={selectedPlayerId || ''}
              onChange={(e) => {
                const playerId = parseInt(e.target.value);
                setSelectedPlayerId(playerId);
                setLastSelectedPlayerId(playerId);
              }}
            >
              <option value="">Select player</option>
              {getCurrentOffensivePlayers(selectedTeam === 'home' ? homeTeamId : awayTeamId).map((player) => (
                <option key={player.id} value={player.id}>
                  #{player.jersey_number} {player.first_name} {player.last_name}
                </option>
              ))}
            </select>
            <small className="helper-text">
              {(() => {
                const teamId = selectedTeam === 'home' ? homeTeamId : awayTeamId;
                const goals = shots.filter(s => s.team_id === teamId && s.result === 'goal').length;
                const nextSwitch = 2 - (goals % 2);
                return `${nextSwitch} goal${nextSwitch !== 1 ? 's' : ''} until position switch`;
              })()}
            </small>
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
      </div>      {/* Shot Statistics by Team */}
      <div className="shot-stats">
        <h4>Match Shots by Team</h4>
        <div className="team-shot-stats">
          {/* Home Team Stats */}
          <div className="team-stat-section">
            <h5>{homeTeamName}</h5>
            {(() => {
              const teamShots = shots.filter(s => s.team_id === homeTeamId);
              const goals = teamShots.filter(s => s.result === 'goal').length;
              const avgDistance = teamShots.length > 0
                ? (teamShots.reduce((sum, s) => sum + (s.distance || 0), 0) / teamShots.length).toFixed(1)
                : '0.0';
              return (
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Total Shots:</span>
                    <span className="stat-value">{teamShots.length}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Goals:</span>
                    <span className="stat-value">{goals}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Misses:</span>
                    <span className="stat-value">{teamShots.filter(s => s.result === 'miss').length}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Blocked:</span>
                    <span className="stat-value">{teamShots.filter(s => s.result === 'blocked').length}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Success Rate:</span>
                    <span className="stat-value">
                      {teamShots.length > 0 
                        ? Math.round((goals / teamShots.length) * 100) 
                        : 0}%
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Avg Distance:</span>
                    <span className="stat-value">{avgDistance}m</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Away Team Stats */}
          <div className="team-stat-section">
            <h5>{awayTeamName}</h5>
            {(() => {
              const teamShots = shots.filter(s => s.team_id === awayTeamId);
              const goals = teamShots.filter(s => s.result === 'goal').length;
              const avgDistance = teamShots.length > 0
                ? (teamShots.reduce((sum, s) => sum + (s.distance || 0), 0) / teamShots.length).toFixed(1)
                : '0.0';
              return (
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Total Shots:</span>
                    <span className="stat-value">{teamShots.length}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Goals:</span>
                    <span className="stat-value">{goals}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Misses:</span>
                    <span className="stat-value">{teamShots.filter(s => s.result === 'miss').length}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Blocked:</span>
                    <span className="stat-value">{teamShots.filter(s => s.result === 'blocked').length}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Success Rate:</span>
                    <span className="stat-value">
                      {teamShots.length > 0 
                        ? Math.round((goals / teamShots.length) * 100) 
                        : 0}%
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Avg Distance:</span>
                    <span className="stat-value">{avgDistance}m</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourtVisualization;
