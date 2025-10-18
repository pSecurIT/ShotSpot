import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import CourtVisualization from './CourtVisualization';
import { useTimer } from '../hooks/useTimer';

interface Game {
  id: number;
  home_team_id: number;
  away_team_id: number;
  home_team_name: string;
  away_team_name: string;
  date: string;
  status: string;
  home_score: number;
  away_score: number;
  current_period: number;
  period_duration: {
    minutes?: number;
    seconds?: number;
    hours?: number;
  } | null;
  time_remaining: {
    minutes?: number;
    seconds?: number;
    hours?: number;
  } | null;
  timer_state: 'stopped' | 'running' | 'paused';
  home_attacking_side?: 'left' | 'right' | null;
  number_of_periods?: number;
}

interface Player {
  id: number;
  team_id: number;
  first_name: string;
  last_name: string;
  jersey_number: number;
  role: string;
  is_active: boolean;
  gender?: string;
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

// Reserved for future analytics feature
// interface PossessionStats {
//   team_id: number;
//   team_name: string;
//   total_possessions: number;
//   total_shots: number;
//   average_shots_per_possession: number;
//   total_duration_seconds: number;
//   average_duration_seconds: number;
// }

const LiveMatch: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  
  // Use custom timer hook with request deduplication
  const { timerState, refetch: fetchTimerState } = useTimer(gameId);
  
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Pre-match setup state
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [homeAttackingSide, setHomeAttackingSide] = useState<'left' | 'right'>('left');
  const [numberOfPeriods, setNumberOfPeriods] = useState<number>(4);
  const [periodDurationMinutes, setPeriodDurationMinutes] = useState<number>(10);
  const [showPreMatchSetup, setShowPreMatchSetup] = useState(false);

  // Roster management state
  const [selectedHomePlayers, setSelectedHomePlayers] = useState<Set<number>>(new Set());
  const [selectedAwayPlayers, setSelectedAwayPlayers] = useState<Set<number>>(new Set());
  const [homeCaptainId, setHomeCaptainId] = useState<number | null>(null);
  const [awayCaptainId, setAwayCaptainId] = useState<number | null>(null);

  // Possession tracking state
  const [activePossession, setActivePossession] = useState<Possession | null>(null);
  const [possessionDuration, setPossessionDuration] = useState<number>(0); // Client-side timer in seconds
  // Note: possessionStats removed - reserved for future analytics feature

  // Reset tracking - incrementing this key forces CourtVisualization to remount and refetch shots
  const [courtResetKey, setCourtResetKey] = useState<number>(0);

  // Fetch game data
  const fetchGame = useCallback(async () => {
    if (!gameId) return;
    
    try {
      setError(null);
      const response = await api.get(`/games/${gameId}`);
      setGame(response.data);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error fetching game data');
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching game:', error);
      }
    }
  }, [gameId]);

  // Fetch players for both teams
  const fetchPlayers = useCallback(async () => {
    if (!game) return;
    
    try {
      const [homeResponse, awayResponse] = await Promise.all([
        api.get(`/players?team_id=${game.home_team_id}`),
        api.get(`/players?team_id=${game.away_team_id}`)
      ]);
      
      // Filter active players and sort by jersey number
      const sortedHomePlayers = homeResponse.data
        .filter((p: Player) => p.is_active)
        .sort((a: Player, b: Player) => a.jersey_number - b.jersey_number);
      
      const sortedAwayPlayers = awayResponse.data
        .filter((p: Player) => p.is_active)
        .sort((a: Player, b: Player) => a.jersey_number - b.jersey_number);
      
      setHomePlayers(sortedHomePlayers);
      setAwayPlayers(sortedAwayPlayers);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching players:', error);
      }
      setError('Failed to load players');
    }
  }, [game]);

  // Check if teams meet minimum player requirements
  const checkTeamRequirements = (): { valid: boolean; message: string } => {
    const homeCount = selectedHomePlayers.size;
    const awayCount = selectedAwayPlayers.size;
    
    if (homeCount < 8) {
      return { 
        valid: false, 
        message: `${game?.home_team_name} needs at least 8 players selected (currently ${homeCount}). Korfball requires 4 males and 4 females per team.` 
      };
    }
    
    if (awayCount < 8) {
      return { 
        valid: false, 
        message: `${game?.away_team_name} needs at least 8 players selected (currently ${awayCount}). Korfball requires 4 males and 4 females per team.` 
      };
    }

    // Check gender composition for home team
    const homeGenderCount = getGenderCount(Array.from(selectedHomePlayers), homePlayers);
    if (homeGenderCount.male !== 4 || homeGenderCount.female !== 4) {
      return {
        valid: false,
        message: `${game?.home_team_name} must have exactly 4 males and 4 females. Currently: ${homeGenderCount.male} males, ${homeGenderCount.female} females`
      };
    }

    // Check gender composition for away team
    const awayGenderCount = getGenderCount(Array.from(selectedAwayPlayers), awayPlayers);
    if (awayGenderCount.male !== 4 || awayGenderCount.female !== 4) {
      return {
        valid: false,
        message: `${game?.away_team_name} must have exactly 4 males and 4 females. Currently: ${awayGenderCount.male} males, ${awayGenderCount.female} females`
      };
    }

    if (!homeCaptainId) {
      return {
        valid: false,
        message: `Please select a captain for ${game?.home_team_name}`
      };
    }

    if (!awayCaptainId) {
      return {
        valid: false,
        message: `Please select a captain for ${game?.away_team_name}`
      };
    }
    
    return { valid: true, message: 'Both teams meet minimum requirements' };
  };

  // Helper function to count genders in selected players
  const getGenderCount = (selectedIds: number[], playersList: Player[]): { male: number; female: number; unknown: number } => {
    const counts = { male: 0, female: 0, unknown: 0 };
    
    selectedIds.forEach(id => {
      const player = playersList.find(p => p.id === id);
      if (player) {
        if (player.gender === 'male') {
          counts.male++;
        } else if (player.gender === 'female') {
          counts.female++;
        } else {
          counts.unknown++;
        }
      }
    });
    
    return counts;
  };

  // Toggle player selection
  const togglePlayerSelection = (playerId: number, teamId: number) => {
    const player = (teamId === game?.home_team_id ? homePlayers : awayPlayers).find(p => p.id === playerId);
    if (!player) return;

    if (teamId === game?.home_team_id) {
      setSelectedHomePlayers(prev => {
        const newSet = new Set(prev);
        if (newSet.has(playerId)) {
          // Allow deselection
          newSet.delete(playerId);
          // Clear captain if deselected
          if (homeCaptainId === playerId) {
            setHomeCaptainId(null);
          }
        } else {
          // Check if adding this player would exceed gender limit
          const currentCounts = getGenderCount(Array.from(newSet), homePlayers);
          
          if (player.gender === 'male' && currentCounts.male >= 4) {
            setError('Cannot select more than 4 male players for the home team');
            setTimeout(() => setError(null), 3000);
            return prev;
          }
          
          if (player.gender === 'female' && currentCounts.female >= 4) {
            setError('Cannot select more than 4 female players for the home team');
            setTimeout(() => setError(null), 3000);
            return prev;
          }
          
          newSet.add(playerId);
        }
        return newSet;
      });
    } else {
      setSelectedAwayPlayers(prev => {
        const newSet = new Set(prev);
        if (newSet.has(playerId)) {
          // Allow deselection
          newSet.delete(playerId);
          // Clear captain if deselected
          if (awayCaptainId === playerId) {
            setAwayCaptainId(null);
          }
        } else {
          // Check if adding this player would exceed gender limit
          const currentCounts = getGenderCount(Array.from(newSet), awayPlayers);
          
          if (player.gender === 'male' && currentCounts.male >= 4) {
            setError('Cannot select more than 4 male players for the away team');
            setTimeout(() => setError(null), 3000);
            return prev;
          }
          
          if (player.gender === 'female' && currentCounts.female >= 4) {
            setError('Cannot select more than 4 female players for the away team');
            setTimeout(() => setError(null), 3000);
            return prev;
          }
          
          newSet.add(playerId);
        }
        return newSet;
      });
    }
  };

  // Set captain (can only select from selected players)
  const setCaptain = (playerId: number, teamId: number) => {
    if (teamId === game?.home_team_id) {
      if (selectedHomePlayers.has(playerId)) {
        setHomeCaptainId(playerId);
      }
    } else {
      if (selectedAwayPlayers.has(playerId)) {
        setAwayCaptainId(playerId);
      }
    }
  };

  // Start the match
  const handleStartMatch = async () => {
    const requirements = checkTeamRequirements();
    
    if (!requirements.valid) {
      setError(requirements.message);
      return;
    }
    
    try {
      setError(null);

      // Prepare roster data
      const rosterPlayers = [
        ...Array.from(selectedHomePlayers).map(playerId => ({
          team_id: game!.home_team_id,
          player_id: playerId,
          is_captain: playerId === homeCaptainId,
          is_starting: true
        })),
        ...Array.from(selectedAwayPlayers).map(playerId => ({
          team_id: game!.away_team_id,
          player_id: playerId,
          is_captain: playerId === awayCaptainId,
          is_starting: true
        }))
      ];

      // Save game roster
      await api.post(`/game-rosters/${gameId}`, {
        players: rosterPlayers
      });
      
      // Set game configuration (attacking side, periods, duration)
      const periodDurationFormatted = `${String(periodDurationMinutes).padStart(2, '0')}:00:00`;
      await api.put(`/games/${gameId}`, {
        home_attacking_side: homeAttackingSide,
        number_of_periods: numberOfPeriods,
        period_duration: periodDurationFormatted,
        status: 'in_progress'
      });
      
      await fetchGame();
      setShowPreMatchSetup(false);
      setSuccess('Match started! Good luck to both teams!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error starting match');
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchGame(); // Timer state is now handled by useTimer hook
      setLoading(false);
    };
    
    loadData();
  }, [gameId, fetchGame]);

  // Fetch players when game is loaded
  useEffect(() => {
    if (game) {
      fetchPlayers();
      
      // Show pre-match setup if game is scheduled
      if (game.status === 'scheduled' || game.status === 'to_reschedule') {
        setShowPreMatchSetup(true);
        
        // If attacking side is already set, use it
        if (game.home_attacking_side) {
          setHomeAttackingSide(game.home_attacking_side);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id, game?.status, game?.home_attacking_side, fetchPlayers]);

  // Timer control handlers
  const handleStartTimer = async () => {
    try {
      setError(null);
      
      // Optimistically update UI first for instant feedback
      const wasFirstStart = timerState?.timer_state === 'stopped' && timerState?.current_period === 1 && !activePossession;
      
      // If this is the first start, give home team possession (don't wait)
      if (wasFirstStart) {
        // Start possession creation in background
        handleCenterLineCross(game!.home_team_id).catch(err => {
          console.error('Error creating initial possession:', err);
        });
        setSuccess('Game started! Home team has possession.');
        setTimeout(() => setSuccess(null), 3000);
      }
      
      // Start timer and fetch state in parallel, don't block UI
      api.post(`/timer/${gameId}/start`, {})
        .then(() => fetchTimerState())
        .catch(err => {
          const error = err as { response?: { data?: { error?: string } }; message?: string };
          setError(error.response?.data?.error || 'Error starting timer');
        });
      
      if (!wasFirstStart) {
        setSuccess('Timer started');
        setTimeout(() => setSuccess(null), 2000);
      }
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error starting timer');
    }
  };

  const handlePauseTimer = async () => {
    try {
      setError(null);
      
      // Optimistically show paused state immediately
      setSuccess('Timer paused');
      setTimeout(() => setSuccess(null), 2000);
      
      // Update backend asynchronously
      api.post(`/timer/${gameId}/pause`, {})
        .then(() => fetchTimerState())
        .catch(err => {
          const error = err as { response?: { data?: { error?: string } }; message?: string };
          setError(error.response?.data?.error || 'Error pausing timer');
        });
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error pausing timer');
    }
  };

  const handleStopTimer = async () => {
    if (!window.confirm('Are you sure you want to stop and reset the entire match? This will:\n\n• Reset scores to 0-0\n• Delete all recorded shots\n• Delete all game events\n• Delete all possession records\n• Reset timer to period 1\n\nThis action cannot be undone!')) {
      return;
    }
    
    try {
      setError(null);
      
      // Call the comprehensive reset endpoint
      await api.post(`/timer/${gameId}/reset-match`, {});
      
      // Increment reset key to force CourtVisualization to remount and clear shots
      setCourtResetKey(prev => prev + 1);
      
      // Refresh all game data
      await Promise.all([
        fetchTimerState(),
        fetchGame(),
        fetchActivePossession(),
        fetchPossessionStats()
      ]);
      
      setSuccess('Match reset successfully - all data cleared');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error resetting match');
    }
  };

  const handleNextPeriod = async () => {
    try {
      setError(null);
      await api.post(`/timer/${gameId}/next-period`, {});
      await Promise.all([fetchTimerState(), fetchGame()]);
      setSuccess('Advanced to next period');
      setTimeout(() => setSuccess(null), 2000);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error advancing period');
    }
  };

  const handleEndGame = async () => {
    if (!window.confirm('Are you sure you want to end this game?')) {
      return;
    }

    try {
      setError(null);
      await api.post(`/games/${gameId}/end`, {});
      setSuccess('Game ended successfully');
      setTimeout(() => {
        navigate('/games');
      }, 2000);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error ending game');
    }
  };

  // Possession tracking handlers
  const fetchActivePossession = useCallback(async () => {
    try {
      const response = await api.get(`/possessions/${gameId}/active`);
      setActivePossession(response.data);
    } catch (error) {
      // No active possession is normal
      setActivePossession(null);
    }
  }, [gameId]);

  const fetchPossessionStats = useCallback(async () => {
    try {
      const response = await api.get(`/possessions/${gameId}/stats`);
      // Future use: Display possession statistics
      // setPossessionStats(response.data);
      return response.data;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching possession stats:', error);
      }
    }
  }, [gameId]);

  const handleCenterLineCross = useCallback(async (teamId: number) => {
    if (!game) return;
    
    try {
      setError(null);
      // Use timerState period if available, fallback to game period
      const currentPeriod = timerState?.current_period || game.current_period || 1;
      
      await api.post(`/possessions/${gameId}`, {
        team_id: teamId,
        period: currentPeriod
      });
      await fetchActivePossession();
      setSuccess('New attack started');
      setTimeout(() => setSuccess(null), 2000);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error starting possession');
    }
  }, [game, timerState?.current_period, gameId, fetchActivePossession]);

  const handleShotRecorded = useCallback(async (shotInfo: { result: 'goal' | 'miss' | 'blocked'; teamId: number; opposingTeamId: number }) => {
    // Increment shot counter for active possession
    if (activePossession) {
      try {
        await api.patch(`/possessions/${gameId}/${activePossession.id}/increment-shots`);
        await fetchActivePossession();
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error incrementing shot counter:', error);
        }
      }
    }
    
    // If it's a goal, pause the timer and switch possession to opposing team
    if (shotInfo.result === 'goal') {
      try {
        // Pause the timer
        if (timerState?.timer_state === 'running') {
          await api.post(`/timer/${gameId}/pause`, {});
          await fetchTimerState();
        }
        
        // Give possession to the opposing team automatically
        await handleCenterLineCross(shotInfo.opposingTeamId);
        
        setSuccess('⚽ GOAL! Timer paused. Press Start to resume with opposing team possession.');
        setTimeout(() => setSuccess(null), 5000);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error handling goal:', error);
        }
      }
    }
    
    // Refresh game data
    await fetchGame();
    await fetchPossessionStats();
  }, [activePossession, gameId, timerState?.timer_state, handleCenterLineCross, fetchActivePossession, fetchTimerState, fetchGame, fetchPossessionStats]);

  // Load possession data
  useEffect(() => {
    if (game && game.status === 'in_progress') {
      fetchActivePossession();
      fetchPossessionStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id, game?.status, fetchActivePossession, fetchPossessionStats]);

  // Client-side possession duration timer (pauses when game timer is paused)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (activePossession && timerState?.timer_state === 'running') {
      // Calculate initial duration based on started_at
      const calculateDuration = () => {
        const startTime = new Date(activePossession.started_at).getTime();
        const now = Date.now();
        const durationSeconds = Math.floor((now - startTime) / 1000);
        setPossessionDuration(durationSeconds);
      };
      
      // Set initial duration
      calculateDuration();
      
      // Update duration every second only when timer is running
      interval = setInterval(() => {
        calculateDuration();
      }, 1000);
    } else if (activePossession && timerState?.timer_state !== 'running') {
      // Timer paused/stopped - freeze duration at current value
      const startTime = new Date(activePossession.started_at).getTime();
      const now = Date.now();
      const durationSeconds = Math.floor((now - startTime) / 1000);
      setPossessionDuration(durationSeconds);
    } else {
      // No active possession, reset duration
      setPossessionDuration(0);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePossession?.id, activePossession?.started_at, timerState?.timer_state]);

  // Format time remaining
  const formatTime = (timeObj: { minutes?: number; seconds?: number; hours?: number } | null): string => {
    if (!timeObj) return '0:00';
    
    const minutes = timeObj.minutes || 0;
    const seconds = timeObj.seconds || 0;
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="loading">Loading match data...</div>;
  }

  if (!game) {
    return <div className="error-message">Game not found</div>;
  }

  // Show pre-match setup for scheduled games
  if (showPreMatchSetup && (game.status === 'scheduled' || game.status === 'to_reschedule')) {
    const requirements = checkTeamRequirements();
    
    // Calculate gender counts for display
    const homeGenderCount = getGenderCount(Array.from(selectedHomePlayers), homePlayers);
    const awayGenderCount = getGenderCount(Array.from(selectedAwayPlayers), awayPlayers);
    
    return (
      <div className="live-match-container">
        <div className="live-match-header">
          <button onClick={() => navigate('/games')} className="back-button">
            ← Back to Games
          </button>
          <h2>Pre-Match Setup</h2>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="pre-match-setup">
          <h3>{game.home_team_name} vs {game.away_team_name}</h3>
          <p className="match-date">{new Date(game.date).toLocaleString()}</p>

          {/* Team Requirements Check */}
          <div className="team-requirements">
            <h4>Select Team Rosters</h4>
            <p className="requirement-note">
              Select at least 8 players per team (4 males and 4 females) and designate a captain for each team.
            </p>
            
            <div className="team-roster-grid">
              {/* Home Team Roster */}
              <div className="team-roster-section">
                <h5>{game.home_team_name} (Home)</h5>
                <div className="roster-count">
                  <div>{selectedHomePlayers.size} / 8 players selected</div>
                  <div className="gender-count">
                    <span className={homeGenderCount.male === 4 ? 'gender-valid' : homeGenderCount.male > 4 ? 'gender-invalid' : ''}>
                      ♂️ {homeGenderCount.male}/4
                    </span>
                    <span className={homeGenderCount.female === 4 ? 'gender-valid' : homeGenderCount.female > 4 ? 'gender-invalid' : ''}>
                      ♀️ {homeGenderCount.female}/4
                    </span>
                  </div>
                  {homeCaptainId && <span className="captain-selected">👑 Captain selected</span>}
                </div>
                
                <div className="player-selection-list">
                  {homePlayers.map(player => (
                    <div
                      key={player.id}
                      className={`player-selection-item ${selectedHomePlayers.has(player.id) ? 'selected' : ''} ${homeCaptainId === player.id ? 'captain' : ''}`}
                    >
                      <label className="player-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedHomePlayers.has(player.id)}
                          onChange={() => togglePlayerSelection(player.id, game.home_team_id)}
                        />
                        <span className="player-info">
                          <span className="player-name-jersey">
                            {player.first_name} {player.last_name} #{player.jersey_number}
                          </span>
                          {player.gender && (
                            <span className="player-gender-badge">
                              {player.gender === 'male' ? '♂️ Male' : '♀️ Female'}
                            </span>
                          )}
                        </span>
                      </label>
                      {selectedHomePlayers.has(player.id) && (
                        <button
                          className={`captain-button ${homeCaptainId === player.id ? 'active' : ''}`}
                          onClick={() => setCaptain(player.id, game.home_team_id)}
                          title="Set as captain"
                        >
                          {homeCaptainId === player.id ? '👑 Captain' : 'Make Captain'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Away Team Roster */}
              <div className="team-roster-section">
                <h5>{game.away_team_name} (Away)</h5>
                <div className="roster-count">
                  <div>{selectedAwayPlayers.size} / 8 players selected</div>
                  <div className="gender-count">
                    <span className={awayGenderCount.male === 4 ? 'gender-valid' : awayGenderCount.male > 4 ? 'gender-invalid' : ''}>
                      ♂️ {awayGenderCount.male}/4
                    </span>
                    <span className={awayGenderCount.female === 4 ? 'gender-valid' : awayGenderCount.female > 4 ? 'gender-invalid' : ''}>
                      ♀️ {awayGenderCount.female}/4
                    </span>
                  </div>
                  {awayCaptainId && <span className="captain-selected">👑 Captain selected</span>}
                </div>
                
                <div className="player-selection-list">
                  {awayPlayers.map(player => (
                    <div
                      key={player.id}
                      className={`player-selection-item ${selectedAwayPlayers.has(player.id) ? 'selected' : ''} ${awayCaptainId === player.id ? 'captain' : ''}`}
                    >
                      <label className="player-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedAwayPlayers.has(player.id)}
                          onChange={() => togglePlayerSelection(player.id, game.away_team_id)}
                        />
                        <span className="player-info">
                          <span className="player-name-jersey">
                            {player.first_name} {player.last_name} #{player.jersey_number}
                          </span>
                          {player.gender && (
                            <span className="player-gender-badge">
                              {player.gender === 'male' ? '♂️ Male' : '♀️ Female'}
                            </span>
                          )}
                        </span>
                      </label>
                      {selectedAwayPlayers.has(player.id) && (
                        <button
                          className={`captain-button ${awayCaptainId === player.id ? 'active' : ''}`}
                          onClick={() => setCaptain(player.id, game.away_team_id)}
                          title="Set as captain"
                        >
                          {awayCaptainId === player.id ? '👑 Captain' : 'Make Captain'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {!requirements.valid && (
              <div className="requirements-error">
                {requirements.message}
              </div>
            )}
          </div>

          {/* Attacking Side Selection */}
          <div className="attacking-side-selection">
            <h4>Initial Attacking Side</h4>
            <p className="instruction-text">
              The home team ({game.home_team_name}) decides which korf they will attack initially.
              This determines which half of the field each team starts in.
            </p>
            
            <div className="side-selector">
              <button
                className={`side-button ${homeAttackingSide === 'left' ? 'selected' : ''}`}
                onClick={() => setHomeAttackingSide('left')}
              >
                <div className="side-label">Left Side</div>
                <div className="side-detail">{game.home_team_name} attacks left korf (13% position)</div>
                <div className="side-detail">{game.away_team_name} attacks right korf (87% position)</div>
              </button>

              <button
                className={`side-button ${homeAttackingSide === 'right' ? 'selected' : ''}`}
                onClick={() => setHomeAttackingSide('right')}
              >
                <div className="side-label">Right Side</div>
                <div className="side-detail">{game.home_team_name} attacks right korf (87% position)</div>
                <div className="side-detail">{game.away_team_name} attacks left korf (13% position)</div>
              </button>
            </div>

            <p className="info-text">
              <strong>Remember:</strong> Within each team, attacking and defending players switch sides every 2 goals scored. The teams&apos; attacking korfs remain the same throughout the match.
            </p>
          </div>

          {/* Match Configuration */}
          <div className="match-configuration">
            <h4>Match Configuration</h4>
            
            <div className="config-row">
              <label htmlFor="numberOfPeriods">Number of Periods:</label>
              <input
                type="number"
                id="numberOfPeriods"
                value={numberOfPeriods}
                onChange={(e) => setNumberOfPeriods(Number(e.target.value))}
                min={1}
                max={10}
                className="config-input"
              />
              <span className="config-info">1-10 periods (teams switch sides every period)</span>
            </div>

            <div className="config-row">
              <label htmlFor="periodDuration">Period Duration (minutes):</label>
              <input
                type="number"
                id="periodDuration"
                value={periodDurationMinutes}
                onChange={(e) => setPeriodDurationMinutes(Number(e.target.value))}
                min={5}
                max={60}
                className="config-input"
              />
              <span className="config-info">5-60 minutes per period</span>
            </div>
          </div>

          {/* Start Match Button */}
          <div className="start-match-section">
            <button
              onClick={handleStartMatch}
              disabled={!requirements.valid}
              className="primary-button start-match-button"
            >
              Start Match
            </button>
            
            {!requirements.valid && (
              <p className="button-note">
                Both teams must meet the minimum requirements before starting
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Check if game is in progress
  if (game.status !== 'in_progress') {
    return (
      <div className="error-message">
        This game is not in progress. Status: {game.status}
        <button onClick={() => navigate('/games')} className="secondary-button">
          Back to Games
        </button>
      </div>
    );
  }

  return (
    <div className="live-match-container">
      <div className="live-match-header">
        <button onClick={() => navigate('/games')} className="back-button">
          ← Back to Games
        </button>
        <h2>Live Match</h2>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Scoreboard */}
      <div className="scoreboard">
        <div className="team-section home-team">
          <h3>{game.home_team_name}</h3>
          <div className="score">{game.home_score}</div>
        </div>
        
        <div className="scoreboard-center">
          <div className="period-indicator">
            Period {timerState?.current_period || game.current_period}
          </div>
          <div className="timer-display">
            <div className="time-remaining">
              {formatTime(timerState?.time_remaining || game.time_remaining)}
            </div>
            <div className="timer-status">
              {timerState?.timer_state || game.timer_state}
            </div>
          </div>
        </div>
        
        <div className="team-section away-team">
          <h3>{game.away_team_name}</h3>
          <div className="score">{game.away_score}</div>
        </div>
      </div>

      {/* Timer Controls */}
      <div className="timer-controls">
        <h3>Timer Controls</h3>
        <div className="control-buttons">
          {timerState?.timer_state === 'stopped' && (
            <button onClick={handleStartTimer} className="primary-button start-timer-button">
              ▶️ Start Match
            </button>
          )}
          
          {timerState?.timer_state === 'paused' && (
            <button onClick={handleStartTimer} className="primary-button">
              ▶️ Resume
            </button>
          )}
          
          {timerState?.timer_state === 'running' && (
            <button onClick={handlePauseTimer} className="secondary-button">
              ⏸️ Pause
            </button>
          )}
          
          {timerState?.timer_state === 'running' && (
            <button onClick={handleStopTimer} className="danger-button">
              ⏹️ Reset Match
            </button>
          )}
          
          {timerState?.timer_state === 'paused' && (
            <button onClick={handleStopTimer} className="danger-button">
              ⏹️ Reset Match
            </button>
          )}
          
          {(timerState?.current_period || 1) < (game.number_of_periods || 4) && (
            <button onClick={handleNextPeriod} className="secondary-button">
              ⏭️ Next Period
            </button>
          )}
          
          <button onClick={handleEndGame} className="danger-button">
            🏁 End Game
          </button>
        </div>
      </div>

      {/* Court Visualization - Shot Tracking with Possession */}
      <div className="court-section">
        <CourtVisualization
          key={courtResetKey}
          gameId={parseInt(gameId!)}
          homeTeamId={game.home_team_id}
          awayTeamId={game.away_team_id}
          homeTeamName={game.home_team_name}
          awayTeamName={game.away_team_name}
          currentPeriod={timerState?.current_period || game.current_period}
          homeAttackingSide={game.home_attacking_side}
          onShotRecorded={handleShotRecorded}
          activePossession={activePossession}
          possessionDuration={possessionDuration}
          onCenterLineCross={handleCenterLineCross}
          homePlayers={homePlayers}
          awayPlayers={awayPlayers}
        />
      </div>

      {/* Main content area - placeholders for future components */}
      <div className="match-content">
        <div className="content-section">
          <h3>Game Events</h3>
          <div className="placeholder-box">
            <p>Event logging forms will appear here</p>
            <p>Record fouls, substitutions, and timeouts</p>
          </div>
        </div>

        <div className="content-section full-width">
          <h3>Match Timeline</h3>
          <div className="placeholder-box">
            <p>Chronological list of all shots and events will appear here</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveMatch;
