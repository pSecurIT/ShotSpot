import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import CourtVisualization from './CourtVisualization';
import MatchTimeline from './MatchTimeline';
import SubstitutionPanel from './SubstitutionPanel';
import FaultManagement from './FaultManagement';
import TimeoutManagement from './TimeoutManagement';
import FreeShotPanel from './FreeShotPanel';
import MatchCommentary from './MatchCommentary';
import FocusMode from './FocusMode';
import LiveDashboard from './LiveDashboard';
import ExportDialog, { ExportFormat, ExportOptions } from './ExportDialog';
import { useTimer } from '../hooks/useTimer';

/**
 * Retry utility for API calls with exponential backoff
 * @param fn - The async function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param delayMs - Initial delay in milliseconds (default: 1000)
 * @returns Promise that resolves with the function result or rejects after max retries
 */
const retryApiCall = async <T,>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> => {
  let lastError: Error | unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      
      // Don't retry on 4xx errors (client errors) - only retry server/network errors
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response && axiosError.response.status && axiosError.response.status >= 400 && axiosError.response.status < 500) {
        throw error;
      }
      
      // If we've exhausted retries, throw the error
      if (attempt === maxRetries) {
        if (process.env.NODE_ENV === 'development') {
          console.error(`API call failed after ${maxRetries + 1} attempts:`, error);
        }
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      const waitTime = delayMs * Math.pow(2, attempt);
      if (process.env.NODE_ENV === 'development') {
        console.warn(`API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${waitTime}ms...`);
      }
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
};

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
  starting_position?: 'offense' | 'defense'; // Position at match start
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
  
  // Use custom timer hook with request deduplication and optimistic updates
  // Period end handler
  const handlePeriodEnd = useCallback(() => {
    setError(null);
    setSuccess('⏰ Period has ended! Timer paused automatically.');
    setTimeout(() => setSuccess(null), 4000);
    
    // Clear active possession when period ends
    setActivePossession(null);
    setPossessionDuration(0);
  }, []);

  const { timerState, refetch: fetchTimerState, setTimerStateOptimistic, periodHasEnded, resetPeriodEndState } = useTimer(gameId, {
    onPeriodEnd: handlePeriodEnd
  });

  // Check if events can be added (returns false if period has ended and user hasn't confirmed)
  const canAddEvents = useCallback(() => {
    return !periodHasEnded || (typeof window !== 'undefined' && window.confirm(
      '⏰ Period has ended!\n\nThe timer has reached 0:00 and this period has officially ended. ' +
      'Adding new events after the period end will affect official statistics.\n\n' +
      'Are you sure you want to continue and add this event?'
    ));
  }, [periodHasEnded]);
  
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
  
  // Bench players state (not starting)
  const [homeBenchPlayers, setHomeBenchPlayers] = useState<Set<number>>(new Set());
  const [awayBenchPlayers, setAwayBenchPlayers] = useState<Set<number>>(new Set());
  
  // Starting position state (offense/defense)
  const [homeOffensePlayers, setHomeOffensePlayers] = useState<Set<number>>(new Set());
  const [awayOffensePlayers, setAwayOffensePlayers] = useState<Set<number>>(new Set());

  // Possession tracking state
  const [activePossession, setActivePossession] = useState<Possession | null>(null);
  const [possessionDuration, setPossessionDuration] = useState<number>(0); // Client-side timer in seconds
  // Note: possessionStats removed - reserved for future analytics feature

  // Reset tracking - incrementing this key forces CourtVisualization to remount and refetch shots
  const [courtResetKey, setCourtResetKey] = useState<number>(0);

  // Active tab for Enhanced Match Events
  const [activeTab, setActiveTab] = useState<'timeline' | 'faults' | 'timeouts' | 'freeshots' | 'commentary'>('timeline');

  // Export dialog state
  const [showExportDialog, setShowExportDialog] = useState(false);

  /**
   * Focus mode state for mobile-optimized fullscreen experience
   * 
   * DATA PERSISTENCE GUARANTEE:
   * Toggling between normal view and focus mode does NOT lose any data because:
   * 1. All game state (game, players, timer, possession, scores) remains in LiveMatch parent component
   * 2. FocusMode component is stateless and receives ALL data via props
   * 3. Both views share the same event handlers (onShotRecorded, onSubstitutionRecorded, etc.)
   * 4. When focusMode boolean changes, only the rendered component changes - state persists
   * 
   * Example flow:
   * - User records shot in focus mode → handleShotRecorded updates game state in LiveMatch
   * - User exits focus mode → focusMode set to false, normal view renders
   * - Shot data remains in game.home_score/away_score and is visible in both views
   */
  const [focusMode, setFocusMode] = useState<boolean>(false);

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
      // Use different endpoints based on game status
      if (game.status === 'in_progress') {
        // During match: Fetch from game roster to get starting_position data
        const rosterResponse = await api.get(`/game-rosters/${game.id}`);
        const rosterPlayers = rosterResponse.data;
        
        // Separate by team and include starting_position
        const homePlayers = rosterPlayers
          .filter((p: Player & { is_starting: boolean; player_id: number }) => p.team_id === game.home_team_id && p.is_starting)
          .map((p: Player & { is_starting: boolean; player_id: number }) => ({
            id: p.player_id,
            team_id: p.team_id,
            first_name: p.first_name,
            last_name: p.last_name,
            jersey_number: p.jersey_number,
            gender: p.gender,
            role: 'player',
            is_active: true,
            starting_position: p.starting_position
          }))
          .sort((a: Player, b: Player) => a.jersey_number - b.jersey_number);
        
        const awayPlayers = rosterPlayers
          .filter((p: Player & { is_starting: boolean; player_id: number }) => p.team_id === game.away_team_id && p.is_starting)
          .map((p: Player & { is_starting: boolean; player_id: number }) => ({
            id: p.player_id,
            team_id: p.team_id,
            first_name: p.first_name,
            last_name: p.last_name,
            jersey_number: p.jersey_number,
            gender: p.gender,
            role: 'player',
            is_active: true,
            starting_position: p.starting_position
          }))
          .sort((a: Player, b: Player) => a.jersey_number - b.jersey_number);
        
        setHomePlayers(homePlayers);
        setAwayPlayers(awayPlayers);
      } else {
        // Pre-match: Fetch ALL players from both teams
        const [homeResponse, awayResponse] = await Promise.all([
          api.get(`/players?team_id=${game.home_team_id}`),
          api.get(`/players?team_id=${game.away_team_id}`)
        ]);
        
        const homePlayers = homeResponse.data
          .sort((a: Player, b: Player) => a.jersey_number - b.jersey_number);
        const awayPlayers = awayResponse.data
          .sort((a: Player, b: Player) => a.jersey_number - b.jersey_number);
        
        setHomePlayers(homePlayers);
        setAwayPlayers(awayPlayers);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching players:', error);
      }
      setError('Failed to load players');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id, game?.status, game?.home_team_id, game?.away_team_id]);

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

    // Check offense/defense assignment for home team
    const homeOffenseCount = homeOffensePlayers.size;
    if (homeOffenseCount !== 4) {
      return {
        valid: false,
        message: `${game?.home_team_name} must assign exactly 4 players to offense (currently ${homeOffenseCount})`
      };
    }

    // Check gender composition in home offense
    const homeOffenseGenderCount = getGenderCount(Array.from(homeOffensePlayers), homePlayers);
    if (homeOffenseGenderCount.male !== 2 || homeOffenseGenderCount.female !== 2) {
      return {
        valid: false,
        message: `${game?.home_team_name} offense must have 2 males and 2 females. Currently: ${homeOffenseGenderCount.male} males, ${homeOffenseGenderCount.female} females`
      };
    }

    // Check gender composition in home defense (remaining 4 players)
    const homeDefensePlayers = Array.from(selectedHomePlayers).filter(id => !homeOffensePlayers.has(id));
    const homeDefenseGenderCount = getGenderCount(homeDefensePlayers, homePlayers);
    if (homeDefenseGenderCount.male !== 2 || homeDefenseGenderCount.female !== 2) {
      return {
        valid: false,
        message: `${game?.home_team_name} defense must have 2 males and 2 females. Currently: ${homeDefenseGenderCount.male} males, ${homeDefenseGenderCount.female} females`
      };
    }

    // Check offense/defense assignment for away team
    const awayOffenseCount = awayOffensePlayers.size;
    if (awayOffenseCount !== 4) {
      return {
        valid: false,
        message: `${game?.away_team_name} must assign exactly 4 players to offense (currently ${awayOffenseCount})`
      };
    }

    // Check gender composition in away offense
    const awayOffenseGenderCount = getGenderCount(Array.from(awayOffensePlayers), awayPlayers);
    if (awayOffenseGenderCount.male !== 2 || awayOffenseGenderCount.female !== 2) {
      return {
        valid: false,
        message: `${game?.away_team_name} offense must have 2 males and 2 females. Currently: ${awayOffenseGenderCount.male} males, ${awayOffenseGenderCount.female} females`
      };
    }

    // Check gender composition in away defense (remaining 4 players)
    const awayDefensePlayers = Array.from(selectedAwayPlayers).filter(id => !awayOffensePlayers.has(id));
    const awayDefenseGenderCount = getGenderCount(awayDefensePlayers, awayPlayers);
    if (awayDefenseGenderCount.male !== 2 || awayDefenseGenderCount.female !== 2) {
      return {
        valid: false,
        message: `${game?.away_team_name} defense must have 2 males and 2 females. Currently: ${awayDefenseGenderCount.male} males, ${awayDefenseGenderCount.female} females`
      };
    }
    
    return { valid: true, message: 'Both teams meet all requirements' };
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

  // Toggle bench player selection (no gender/count limits)
  const toggleBenchPlayerSelection = (playerId: number, teamId: number) => {
    if (teamId === game?.home_team_id) {
      setHomeBenchPlayers(prev => {
        const newSet = new Set(prev);
        if (newSet.has(playerId)) {
          newSet.delete(playerId);
        } else {
          // Check if player is not in starting lineup
          if (selectedHomePlayers.has(playerId)) {
            setError('Player is already in the starting lineup');
            setTimeout(() => setError(null), 3000);
            return prev;
          }
          newSet.add(playerId);
        }
        return newSet;
      });
    } else {
      setAwayBenchPlayers(prev => {
        const newSet = new Set(prev);
        if (newSet.has(playerId)) {
          newSet.delete(playerId);
        } else {
          // Check if player is not in starting lineup
          if (selectedAwayPlayers.has(playerId)) {
            setError('Player is already in the starting lineup');
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

  // Toggle offense assignment (can only assign selected players)
  const toggleOffenseAssignment = (playerId: number, teamId: number) => {
    const player = (teamId === game?.home_team_id ? homePlayers : awayPlayers).find(p => p.id === playerId);
    if (!player) return;

    if (teamId === game?.home_team_id) {
      setHomeOffensePlayers(prev => {
        const newSet = new Set(prev);
        if (newSet.has(playerId)) {
          // Remove from offense (will be defense)
          newSet.delete(playerId);
        } else {
          // Check if we already have 4 offense players
          if (newSet.size >= 4) {
            setError(`${game?.home_team_name} can only have 4 offense players`);
            setTimeout(() => setError(null), 3000);
            return prev;
          }
          
          // Check gender limits for offense (2 males, 2 females)
          const currentOffenseCounts = getGenderCount(Array.from(newSet), homePlayers);
          if (player.gender === 'male' && currentOffenseCounts.male >= 2) {
            setError('Offense can only have 2 male players');
            setTimeout(() => setError(null), 3000);
            return prev;
          }
          if (player.gender === 'female' && currentOffenseCounts.female >= 2) {
            setError('Offense can only have 2 female players');
            setTimeout(() => setError(null), 3000);
            return prev;
          }
          
          newSet.add(playerId);
        }
        return newSet;
      });
    } else {
      setAwayOffensePlayers(prev => {
        const newSet = new Set(prev);
        if (newSet.has(playerId)) {
          // Remove from offense (will be defense)
          newSet.delete(playerId);
        } else {
          // Check if we already have 4 offense players
          if (newSet.size >= 4) {
            setError(`${game?.away_team_name} can only have 4 offense players`);
            setTimeout(() => setError(null), 3000);
            return prev;
          }
          
          // Check gender limits for offense (2 males, 2 females)
          const currentOffenseCounts = getGenderCount(Array.from(newSet), awayPlayers);
          if (player.gender === 'male' && currentOffenseCounts.male >= 2) {
            setError('Offense can only have 2 male players');
            setTimeout(() => setError(null), 3000);
            return prev;
          }
          if (player.gender === 'female' && currentOffenseCounts.female >= 2) {
            setError('Offense can only have 2 female players');
            setTimeout(() => setError(null), 3000);
            return prev;
          }
          
          newSet.add(playerId);
        }
        return newSet;
      });
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
        // Starting players
        ...Array.from(selectedHomePlayers).map(playerId => ({
          team_id: game!.home_team_id,
          player_id: playerId,
          is_captain: playerId === homeCaptainId,
          is_starting: true,
          starting_position: homeOffensePlayers.has(playerId) ? 'offense' : 'defense'
        })),
        ...Array.from(selectedAwayPlayers).map(playerId => ({
          team_id: game!.away_team_id,
          player_id: playerId,
          is_captain: playerId === awayCaptainId,
          is_starting: true,
          starting_position: awayOffensePlayers.has(playerId) ? 'offense' : 'defense'
        })),
        // Bench players (don't include starting_position field at all)
        ...Array.from(homeBenchPlayers).map(playerId => ({
          team_id: game!.home_team_id,
          player_id: playerId,
          is_captain: false,
          is_starting: false
        })),
        ...Array.from(awayBenchPlayers).map(playerId => ({
          team_id: game!.away_team_id,
          player_id: playerId,
          is_captain: false,
          is_starting: false
        }))
      ];

      // Format period duration
      const hours = Math.floor(periodDurationMinutes / 60);
      const minutes = periodDurationMinutes % 60;
      const periodDurationFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
      
      // Show loading state
      setSuccess('Starting match...');
      
      // Execute API operations first, THEN hide pre-match setup
      Promise.all([
        api.post(`/game-rosters/${gameId}`, { players: rosterPlayers }),
        api.put(`/games/${gameId}`, {
          home_attacking_side: homeAttackingSide,
          number_of_periods: numberOfPeriods,
          period_duration: periodDurationFormatted,
          status: 'in_progress'
        })
      ])
        .then(() => {
          // After API calls complete, fetch updated data
          return Promise.all([
            fetchGame(),
            fetchTimerState(),
            fetchPlayers() // Reload players with starting_position data
          ]);
        })
        .then(() => {
          // NOW hide pre-match setup after everything is updated
          setShowPreMatchSetup(false);
          setSuccess('Match ready! Good luck to both teams!');
          setTimeout(() => setSuccess(null), 3000);
        })
        .catch(err => {
          const error = err as { response?: { data?: { error?: string } }; message?: string };
          setError(error.response?.data?.error || 'Error starting match');
        });
    } catch (error) {
      // Handle synchronous errors (e.g., validation errors)
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error starting match');
      setShowPreMatchSetup(true);
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

  // Fetch players when game is loaded or status changes
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
  }, [game?.id, game?.status, game?.home_attacking_side]);

  // Timer control handlers
  const handleStartTimer = async () => {
    try {
      setError(null);
      
      // Check if this is the first start
      const wasFirstStart = timerState?.timer_state === 'stopped' && timerState?.current_period === 1 && !activePossession;
      
      // 🔥 INSTANT OPTIMISTIC UPDATE: Change UI immediately before API call
      setTimerStateOptimistic({ timer_state: 'running' });
      
      // 🔥 Fire API calls in background WITH RETRY for reliability
      retryApiCall(() => api.post(`/timer/${gameId}/start`, {}))
        .then(() => {
          // Sync with server after successful start (background refresh)
          setTimeout(() => fetchTimerState(), 100);
        })
        .catch(err => {
          const error = err as { response?: { data?: { error?: string } }; message?: string };
          setError(error.response?.data?.error || 'Error starting timer after retries');
          // Revert optimistic update on error
          setTimerStateOptimistic({ timer_state: 'paused' });
        });
      
      // If this is the first start, give home team possession (fire and forget)
      if (wasFirstStart && game) {
        handleCenterLineCross(game.home_team_id).catch(err => {
          console.error('Error creating initial possession:', err);
        });
        setSuccess('Game started! Home team has possession.');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setSuccess('Timer started');
        setTimeout(() => setSuccess(null), 2000);
      }
      
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error starting timer');
      setTimerStateOptimistic({ timer_state: 'paused' });
    }
  };

  const handlePauseTimer = async () => {
    try {
      setError(null);
      
      // 🔥 INSTANT OPTIMISTIC UPDATE: Pause UI immediately
      setTimerStateOptimistic({ timer_state: 'paused' });
      
      // Pause timer in background WITH RETRY
      retryApiCall(() => api.post(`/timer/${gameId}/pause`, {}))
        .then(() => {
          setTimeout(() => fetchTimerState(), 100);
        })
        .catch(err => {
          const error = err as { response?: { data?: { error?: string } }; message?: string };
          setError(error.response?.data?.error || 'Error pausing timer after retries');
          // Revert on error
          setTimerStateOptimistic({ timer_state: 'running' });
        });
      
      setSuccess('Timer paused');
      setTimeout(() => setSuccess(null), 2000);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error pausing timer');
      setTimerStateOptimistic({ timer_state: 'running' });
    }
  };

  const handleStopTimer = async () => {
    if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to stop and reset the entire match? This will:\n\n• Reset scores to 0-0\n• Delete all recorded shots\n• Delete all game events\n• Delete all possession records\n• Reset timer to period 1\n\nThis action cannot be undone!')) {
      return;
    }
    
    try {
      setError(null);
      
      // 🔥 OPTIMISTIC UPDATE: Reset UI immediately
      setTimerStateOptimistic({ 
        current_period: 1, 
        timer_state: 'stopped',
        time_remaining: timerState?.period_duration || { minutes: 10, seconds: 0 }
      });
      setGame(prev => prev ? { 
        ...prev, 
        current_period: 1, 
        home_score: 0, 
        away_score: 0 
      } : null);
      setActivePossession(null);
      
      // Increment reset key to force CourtVisualization to remount and clear shots
      setCourtResetKey(prev => prev + 1);
      
      setSuccess('Resetting match...');
      
      // Fire API in background WITH RETRY
      retryApiCall(() => api.post(`/timer/${gameId}/reset-match`, {}))
        .then(() => {
          // Refresh all game data after API success
          setTimeout(() => {
            Promise.all([
              fetchTimerState(),
              fetchGame(),
              fetchActivePossession(),
              fetchPossessionStats()
            ]);
          }, 100);
          setSuccess('Match reset successfully - all data cleared');
          setTimeout(() => setSuccess(null), 3000);
        })
        .catch(err => {
          const error = err as { response?: { data?: { error?: string } }; message?: string };
          setError(error.response?.data?.error || 'Error resetting match after retries');
          // Revert on error
          fetchTimerState();
          fetchGame();
          fetchActivePossession();
        });
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error resetting match');
    }
  };

  const handleNextPeriod = async () => {
    try {
      setError(null);
      
      // Clear active possession when starting new period
      setActivePossession(null);
      setPossessionDuration(0);
      
      // 🔥 OPTIMISTIC UPDATE: Increment period immediately
      if (timerState && game) {
        const nextPeriod = timerState.current_period + 1;
        setTimerStateOptimistic({ 
          current_period: nextPeriod,
          timer_state: 'stopped',
          time_remaining: timerState.period_duration
        });
        // Optimistically update game state
        setGame(prev => prev ? { ...prev, current_period: nextPeriod } : null);
      }
      
      // Fire API in background WITH RETRY
      retryApiCall(() => api.post(`/timer/${gameId}/next-period`, {}))
        .then(() => {
          setTimeout(() => {
            fetchTimerState();
            fetchGame();
          }, 100);
        })
        .catch(err => {
          const error = err as { response?: { data?: { error?: string } }; message?: string };
          setError(error.response?.data?.error || 'Error advancing period after retries');
          // Revert on error
          fetchTimerState();
          fetchGame();
        });
      
      setSuccess('Advanced to next period');
      setTimeout(() => setSuccess(null), 2000);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error advancing period');
    }
  };

  const handleEndGame = async () => {
    if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to end this game?')) {
      return;
    }

    try {
      setError(null);
      
      // 🔥 OPTIMISTIC UPDATE: Set game status to completed immediately
      setGame(prev => prev ? { ...prev, status: 'completed' } : null);
      setSuccess('Ending game...');
      
      // Fire API in background WITH RETRY
      retryApiCall(() => api.post(`/games/${gameId}/end`, {}))
        .then(() => {
          setSuccess('Game ended successfully');
          setTimeout(() => {
            navigate('/games');
          }, 2000);
        })
        .catch(err => {
          const error = err as { response?: { data?: { error?: string } }; message?: string };
          setError(error.response?.data?.error || 'Error ending game after retries');
          // Revert on error
          fetchGame();
        });
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error ending game');
    }
  };

  const handleExport = async (format: ExportFormat, options: ExportOptions) => {
    try {
      setError(null);
      setSuccess('Generating export...');
      
      // This would be an actual API call in production
      // await api.post(`/exports/game/${gameId}`, { format, options });
      
      // Simulate export generation
      setTimeout(() => {
        setSuccess(`Export generated successfully! Format: ${format.toUpperCase()}`);
      }, 1000);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error generating export');
    }
  };

  // Possession tracking handlers
  const fetchActivePossession = useCallback(async () => {
    try {
      const response = await api.get(`/possessions/${gameId}/active`);
      setActivePossession(response.data);
    } catch (error: unknown) {
      // 404 is expected when there's no active possession (before game starts or between possessions)
      const err = error as { response?: { status?: number } };
      // Silently handle 404, only log other errors in development
      if (err?.response?.status !== 404 && process.env.NODE_ENV === 'development') {
        console.error('Error fetching active possession:', error);
      }
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
      
      // 🔥 OPTIMISTIC UPDATE: Create possession object immediately
      const optimisticPossession: Possession = {
        id: Date.now(), // Temporary ID
        game_id: parseInt(gameId || '0'),
        team_id: teamId,
        period: currentPeriod,
        started_at: new Date().toISOString(),
        ended_at: null,
        shots_taken: 0,
        team_name: game.home_team_id === teamId ? game.home_team_name : game.away_team_name
      };
      setActivePossession(optimisticPossession);
      
      // Fire API in background WITH RETRY
      retryApiCall(() => api.post(`/possessions/${gameId}`, {
        team_id: teamId,
        period: currentPeriod
      }))
        .then((response) => {
          // Update with real possession data immediately
          if (response.data) {
            setActivePossession(response.data);
          } else {
            // Fallback: fetch if response doesn't include data
            fetchActivePossession();
          }
        })
        .catch(err => {
          const error = err as { response?: { data?: { error?: string } }; message?: string };
          setError(error.response?.data?.error || 'Error starting possession after retries');
          // Revert on error
          setActivePossession(null);
        });
      
      setSuccess('New attack started');
      setTimeout(() => setSuccess(null), 2000);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error starting possession');
    }
  }, [game, timerState?.current_period, gameId, fetchActivePossession]);

  const handleShotRecorded = useCallback(async (shotInfo: { result: 'goal' | 'miss' | 'blocked'; teamId: number; opposingTeamId: number }) => {
    // Check if period has ended and require confirmation
    if (!canAddEvents()) {
      return; // User cancelled, don't record the shot
    }

    // Reset period end state since user confirmed they want to continue
    if (periodHasEnded) {
      resetPeriodEndState();
    }

    // 🔥 OPTIMISTIC UPDATE: Increment shot counter immediately
    if (activePossession) {
      setActivePossession(prev => {
        if (!prev) return null;
        return { ...prev, shots_taken: prev.shots_taken + 1 };
      });
      
      // Only fire API if we have a real possession ID (not the temporary optimistic one)
      // Temporary IDs are large timestamps (> 1 billion), real IDs are sequential (< 10000)
      if (activePossession.id < 1000000000) {
        // Fire API in background WITH RETRY
        retryApiCall(() => api.patch(`/possessions/${gameId}/${activePossession.id}/increment-shots`, {}))
          .catch(error => {
            if (process.env.NODE_ENV === 'development') {
              console.error('Error incrementing shot counter after retries:', error);
            }
            // Revert on error
            setActivePossession(prev => {
              if (!prev) return null;
              return { ...prev, shots_taken: Math.max(0, prev.shots_taken - 1) };
            });
          });
      }
      // If using temporary ID, the counter will sync when real possession is fetched
    }
    
    // Handle goal-specific actions
    if (shotInfo.result === 'goal') {
      // Give possession to the opposing team (non-blocking)
      handleCenterLineCross(shotInfo.opposingTeamId)
        .catch(error => {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error switching possession:', error);
          }
        });
      
      setSuccess('⚽ GOAL! Possession switched to opposing team.');
      setTimeout(() => setSuccess(null), 3000);
    }
    
    // Refresh game data in parallel (non-blocking)
    Promise.all([
      fetchGame(),
      fetchPossessionStats(),
      fetchActivePossession()
    ]).catch(error => {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error refreshing game data:', error);
      }
    });
  }, [activePossession, gameId, handleCenterLineCross, fetchActivePossession, fetchGame, fetchPossessionStats, canAddEvents, periodHasEnded, resetPeriodEndState]);

  // Load possession data
  useEffect(() => {
    if (game && game.status === 'in_progress') {
      fetchActivePossession();
      fetchPossessionStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id, game?.status, fetchActivePossession, fetchPossessionStats]);

  // Use ref to track possession start time - prevents resets when optimistic ID updates to real ID
  const possessionStartTimeRef = useRef<number | null>(null);
  const possessionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const totalPausedDurationRef = useRef<number>(0); // Track total time spent paused (in ms)
  const lastPauseTimeRef = useRef<number | null>(null); // Track when timer was paused
  const wasRunningRef = useRef<boolean>(false); // Track if timer was running
  
  // Update possession start time ref when possession changes (but not when ID just updates)
  // Track when possession starts (using state to trigger timer effect)
  const [possessionStarted, setPossessionStarted] = useState<number | null>(null);
  
  useEffect(() => {
    if (activePossession) {
      const newStartTime = new Date(activePossession.started_at).getTime();
      
      // Only update ref if this is actually a NEW possession (different start time by more than 1 second)
      // This prevents reset when optimistic possession gets replaced with server response
      if (!possessionStartTimeRef.current || 
          Math.abs(newStartTime - possessionStartTimeRef.current) > 1000) {
        possessionStartTimeRef.current = newStartTime;
        totalPausedDurationRef.current = 0; // Reset paused time for new possession
        lastPauseTimeRef.current = null;
        wasRunningRef.current = false;
        setPossessionStarted(newStartTime); // Trigger timer effect
      }
    } else {
      possessionStartTimeRef.current = null;
      totalPausedDurationRef.current = 0;
      lastPauseTimeRef.current = null;
      wasRunningRef.current = false;
      setPossessionStarted(null);
    }
    // Intentionally NOT depending on activePossession to prevent reset when optimistic ID updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePossession?.started_at]);

  // Client-side possession duration timer (pauses when game timer is paused)
  useEffect(() => {
    // Clear existing interval
    if (possessionIntervalRef.current) {
      clearInterval(possessionIntervalRef.current);
      possessionIntervalRef.current = null;
    }
    
    const isRunning = timerState?.timer_state === 'running';
    
    if (activePossession && isRunning && possessionStartTimeRef.current) {
      // Timer is running - count up from current position
      
      // If we're resuming from pause, add the paused duration to our total
      if (wasRunningRef.current === false && lastPauseTimeRef.current !== null) {
        const pauseDuration = Date.now() - lastPauseTimeRef.current;
        totalPausedDurationRef.current += pauseDuration;
        lastPauseTimeRef.current = null;
      }
      wasRunningRef.current = true;
      
      const calculateDuration = () => {
        if (!possessionStartTimeRef.current) return;
        const now = Date.now();
        // Calculate elapsed time minus total paused duration
        const elapsed = now - possessionStartTimeRef.current - totalPausedDurationRef.current;
        const durationSeconds = Math.floor(elapsed / 1000);
        setPossessionDuration(durationSeconds);
      };
      
      // Set initial duration
      calculateDuration();
      
      // Update duration every second only when timer is running
      possessionIntervalRef.current = setInterval(() => {
        calculateDuration();
      }, 1000);
    } else if (activePossession && !isRunning && possessionStartTimeRef.current) {
      // Timer paused/stopped - freeze duration at current value
      if (wasRunningRef.current === true) {
        // Just paused - record the pause time
        lastPauseTimeRef.current = Date.now();
        wasRunningRef.current = false;
      }
      
      // Keep displaying the frozen duration (calculate without adding more paused time)
      if (lastPauseTimeRef.current !== null) {
        const elapsed = lastPauseTimeRef.current - possessionStartTimeRef.current - totalPausedDurationRef.current;
        const durationSeconds = Math.floor(elapsed / 1000);
        setPossessionDuration(durationSeconds);
      }
    } else {
      // No active possession, reset duration
      setPossessionDuration(0);
      lastPauseTimeRef.current = null;
      wasRunningRef.current = false;
    }

    return () => {
      if (possessionIntervalRef.current) {
        clearInterval(possessionIntervalRef.current);
        possessionIntervalRef.current = null;
      }
    };
    // Timer state and possession start time changes should trigger interval update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerState?.timer_state, possessionStarted]);

  // Format time remaining
  const formatTime = (timeObj: { minutes?: number; seconds?: number; hours?: number } | null): string => {
    if (!timeObj) return '0:00';
    
    const minutes = timeObj.minutes || 0;
    const seconds = timeObj.seconds || 0;
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Toggle focus mode for mobile-optimized experience
  const toggleFocusMode = () => {
    setFocusMode(prev => !prev);
  };

  // Keyboard shortcut for focus mode (F key)
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only trigger on F key if no input is focused
      if (event.key === 'f' || event.key === 'F') {
        const activeElement = document.activeElement as HTMLElement;
        const isInputFocused = activeElement && (
          activeElement.tagName === 'INPUT' || 
          activeElement.tagName === 'TEXTAREA' || 
          activeElement.contentEditable === 'true'
        );
        
        if (!isInputFocused) {
          event.preventDefault();
          toggleFocusMode();
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Auto-hide cursor in focus mode for cleaner mobile experience
  useEffect(() => {
    if (focusMode) {
      document.body.style.cursor = 'none';
      let timeoutId: NodeJS.Timeout;
      
      const showCursor = () => {
        document.body.style.cursor = 'default';
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          if (focusMode) {
            document.body.style.cursor = 'none';
          }
        }, 3000);
      };

      const handleMouseMove = () => showCursor();
      const handleTouch = () => showCursor();

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('touchstart', handleTouch);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('touchstart', handleTouch);
        clearTimeout(timeoutId);
        document.body.style.cursor = 'default';
      };
    } else {
      document.body.style.cursor = 'default';
    }
  }, [focusMode]);

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
              Select 8 players per team (4 males and 4 females), designate a captain, and assign 4 players to offense (2M + 2F) and 4 to defense (2M + 2F).
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
                  {selectedHomePlayers.size === 8 && (
                    <div className="position-count">
                      {(() => {
                        const offenseCount = getGenderCount(Array.from(homeOffensePlayers), homePlayers);
                        const defenseCount = getGenderCount(
                          Array.from(selectedHomePlayers).filter(id => !homeOffensePlayers.has(id)),
                          homePlayers
                        );
                        return (
                          <>
                            <span className={offenseCount.male === 2 && offenseCount.female === 2 ? 'position-valid' : 'position-invalid'}>
                              ⚔️ Offense: {offenseCount.male}M {offenseCount.female}F
                            </span>
                            <span className={defenseCount.male === 2 && defenseCount.female === 2 ? 'position-valid' : 'position-invalid'}>
                              🛡️ Defense: {defenseCount.male}M {defenseCount.female}F
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  )}
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
                        <>
                          <button
                            className={`captain-button ${homeCaptainId === player.id ? 'active' : ''}`}
                            onClick={() => setCaptain(player.id, game.home_team_id)}
                            title="Set as captain"
                          >
                            {homeCaptainId === player.id ? '👑 Captain' : 'Make Captain'}
                          </button>
                          <button
                            className={`offense-button ${homeOffensePlayers.has(player.id) ? 'active' : ''}`}
                            onClick={() => toggleOffenseAssignment(player.id, game.home_team_id)}
                            title="Assign to offense (need 2M + 2F)"
                          >
                            {homeOffensePlayers.has(player.id) ? '⚔️ Offense' : '🛡️ Defense'}
                          </button>
                        </>
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
                  {selectedAwayPlayers.size === 8 && (
                    <div className="position-count">
                      {(() => {
                        const offenseCount = getGenderCount(Array.from(awayOffensePlayers), awayPlayers);
                        const defenseCount = getGenderCount(
                          Array.from(selectedAwayPlayers).filter(id => !awayOffensePlayers.has(id)),
                          awayPlayers
                        );
                        return (
                          <>
                            <span className={offenseCount.male === 2 && offenseCount.female === 2 ? 'position-valid' : 'position-invalid'}>
                              ⚔️ Offense: {offenseCount.male}M {offenseCount.female}F
                            </span>
                            <span className={defenseCount.male === 2 && defenseCount.female === 2 ? 'position-valid' : 'position-invalid'}>
                              🛡️ Defense: {defenseCount.male}M {defenseCount.female}F
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  )}
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
                        <>
                          <button
                            className={`captain-button ${awayCaptainId === player.id ? 'active' : ''}`}
                            onClick={() => setCaptain(player.id, game.away_team_id)}
                            title="Set as captain"
                          >
                            {awayCaptainId === player.id ? '👑 Captain' : 'Make Captain'}
                          </button>
                          <button
                            className={`offense-button ${awayOffensePlayers.has(player.id) ? 'active' : ''}`}
                            onClick={() => toggleOffenseAssignment(player.id, game.away_team_id)}
                            title="Assign to offense (need 2M + 2F)"
                          >
                            {awayOffensePlayers.has(player.id) ? '⚔️ Offense' : '🛡️ Defense'}
                          </button>
                        </>
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

            {/* Bench Players Section */}
            <div className="bench-players-section">
              <h4>Bench Players (Optional)</h4>
              <p className="requirement-note">
                Select additional players who will start on the bench and can be substituted during the match.
              </p>
              
              <div className="team-roster-grid">
                {/* Home Team Bench */}
                <div className="team-roster-section">
                  <h5>{game.home_team_name} Bench</h5>
                  <div className="roster-count">
                    <div>{homeBenchPlayers.size} bench player{homeBenchPlayers.size !== 1 ? 's' : ''}</div>
                  </div>
                  
                  <div className="player-selection-list">
                    {homePlayers
                      .filter(p => !selectedHomePlayers.has(p.id))
                      .map(player => (
                        <div
                          key={player.id}
                          className={`player-selection-item ${homeBenchPlayers.has(player.id) ? 'selected bench-player' : ''}`}
                        >
                          <label className="player-checkbox">
                            <input
                              type="checkbox"
                              checked={homeBenchPlayers.has(player.id)}
                              onChange={() => toggleBenchPlayerSelection(player.id, game.home_team_id)}
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
                        </div>
                      ))}
                  </div>
                </div>

                {/* Away Team Bench */}
                <div className="team-roster-section">
                  <h5>{game.away_team_name} Bench</h5>
                  <div className="roster-count">
                    <div>{awayBenchPlayers.size} bench player{awayBenchPlayers.size !== 1 ? 's' : ''}</div>
                  </div>
                  
                  <div className="player-selection-list">
                    {awayPlayers
                      .filter(p => !selectedAwayPlayers.has(p.id))
                      .map(player => (
                        <div
                          key={player.id}
                          className={`player-selection-item ${awayBenchPlayers.has(player.id) ? 'selected bench-player' : ''}`}
                        >
                          <label className="player-checkbox">
                            <input
                              type="checkbox"
                              checked={awayBenchPlayers.has(player.id)}
                              onChange={() => toggleBenchPlayerSelection(player.id, game.away_team_id)}
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
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
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

  // Render Focus Mode if enabled
  if (focusMode) {
    return (
      <FocusMode
        gameId={parseInt(gameId!)}
        homeTeamId={game.home_team_id}
        awayTeamId={game.away_team_id}
        homeTeamName={game.home_team_name}
        awayTeamName={game.away_team_name}
        homeScore={game.home_score}
        awayScore={game.away_score}
        currentPeriod={timerState?.current_period || game.current_period}
        numberOfPeriods={game.number_of_periods || 4}
        homeAttackingSide={game.home_attacking_side}
        timerState={timerState?.timer_state}
        timeRemaining={formatTime(timerState?.time_remaining || game.time_remaining || game.period_duration)}
        homePlayers={homePlayers}
        awayPlayers={awayPlayers}
        activePossession={activePossession}
        possessionDuration={possessionDuration}
        onShotRecorded={handleShotRecorded}
        onCenterLineCross={handleCenterLineCross}
        onStartTimer={handleStartTimer}
        onPauseTimer={handlePauseTimer}
        onNextPeriod={handleNextPeriod}
        onEndGame={handleEndGame}
        onExitFocus={toggleFocusMode}
        onSubstitutionRecorded={() => {
          fetchPlayers();
          fetchGame();
        }}
        canAddEvents={canAddEvents}
        onResumeTimer={handleStartTimer}
        courtResetKey={courtResetKey}
      />
    );
  }

  return (
    <div className="live-match-container">
      <div className="live-match-header">
        <button onClick={() => navigate('/games')} className="back-button">
          ← Back to Games
        </button>
        <h2>Live Match</h2>
        <button 
          onClick={toggleFocusMode} 
          className="focus-mode-toggle"
          title="Enter Focus Mode (Press F) - Optimized fullscreen view for mobile devices"
        >
          🎯 Focus Mode
        </button>
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
              {formatTime(
                timerState?.time_remaining || 
                game.time_remaining || 
                game.period_duration
              )}
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

      {/* Live Dashboard */}
      <LiveDashboard
        gameId={parseInt(gameId!)}
        homeTeamId={game.home_team_id}
        awayTeamId={game.away_team_id}
        homeTeamName={game.home_team_name}
        awayTeamName={game.away_team_name}
        homeScore={game.home_score}
        awayScore={game.away_score}
        currentPeriod={timerState?.current_period || game.current_period}
        numberOfPeriods={game.number_of_periods || 4}
        timerState={timerState?.timer_state}
      />

      {/* Timer Controls - Hidden in focus mode */}
      {!focusMode && (
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
      )}

      {/* Court Visualization */}
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
          timerState={timerState?.timer_state}
          onResumeTimer={handleStartTimer}
          onPauseTimer={handlePauseTimer}
          canAddEvents={canAddEvents}
        />
      </div>

      {/* Substitution Panel */}
      <div className="substitution-section">
        <SubstitutionPanel
            gameId={parseInt(gameId!)}
            homeTeamId={game.home_team_id}
            awayTeamId={game.away_team_id}
            homeTeamName={game.home_team_name}
            awayTeamName={game.away_team_name}
            currentPeriod={timerState?.current_period || game.current_period}
            timeRemaining={formatTime(timerState?.time_remaining || game.time_remaining)}
            onSubstitutionRecorded={() => {
              fetchPlayers();
              fetchGame();
            }}
            canAddEvents={canAddEvents}
          />
      </div>

      {/* Enhanced Match Events Dashboard */}
      <div className="match-content">
          <div className="content-section full-width">
            <div className="enhanced-events-dashboard">
              <div className="dashboard-header">
                <h3>Match Events Dashboard</h3>
                <div className="tab-navigation">
                  <button
                    className={`tab-button ${activeTab === 'timeline' ? 'active' : ''}`}
                    onClick={() => setActiveTab('timeline')}
                  >
                    📊 Timeline
                  </button>
                  <button
                    className={`tab-button ${activeTab === 'faults' ? 'active' : ''}`}
                    onClick={() => setActiveTab('faults')}
                  >
                    ⚠️ Faults
                  </button>
                  <button
                    className={`tab-button ${activeTab === 'timeouts' ? 'active' : ''}`}
                    onClick={() => setActiveTab('timeouts')}
                  >
                    ⏸️ Timeouts
                  </button>
                  <button
                    className={`tab-button ${activeTab === 'freeshots' ? 'active' : ''}`}
                    onClick={() => setActiveTab('freeshots')}
                  >
                    🎯 Free Shots
                  </button>
                  <button
                    className={`tab-button ${activeTab === 'commentary' ? 'active' : ''}`}
                    onClick={() => setActiveTab('commentary')}
                  >
                    📝 Commentary
                  </button>
                  <button
                    className="tab-button analytics-button"
                    onClick={() => navigate(`/analytics/${gameId}`)}
                  >
                    📈 Analytics
                  </button>
                  <button
                    className="tab-button export-button"
                    onClick={() => setShowExportDialog(true)}
                  >
                    📥 Export
                  </button>
                </div>
              </div>

              <div className="tab-content">
                {activeTab === 'timeline' && (
                  <MatchTimeline
                    gameId={game.id}
                    homeTeamId={game.home_team_id}
                    awayTeamId={game.away_team_id}
                    homeTeamName={game.home_team_name}
                    awayTeamName={game.away_team_name}
                    homePlayers={homePlayers}
                    awayPlayers={awayPlayers}
                    onRefresh={fetchGame}
                  />
                )}

                {activeTab === 'faults' && (
                  <FaultManagement
                    gameId={game.id}
                    homeTeamId={game.home_team_id}
                    awayTeamId={game.away_team_id}
                    homeTeamName={game.home_team_name}
                    awayTeamName={game.away_team_name}
                    currentPeriod={timerState?.current_period || game.current_period}
                    timeRemaining={formatTime(timerState?.time_remaining || game.time_remaining)}
                    onFaultRecorded={() => {
                      // Refresh timeline to show new fault events
                      fetchGame();
                    }}
                    canAddEvents={canAddEvents}
                  />
                )}

                {activeTab === 'timeouts' && (
                  <TimeoutManagement
                    gameId={game.id}
                    homeTeamId={game.home_team_id}
                    awayTeamId={game.away_team_id}
                    homeTeamName={game.home_team_name}
                    awayTeamName={game.away_team_name}
                    currentPeriod={timerState?.current_period || game.current_period}
                    timeRemaining={formatTime(timerState?.time_remaining || game.time_remaining)}
                    onTimeoutRecorded={() => {
                      // Refresh timeline to show new timeout events
                      fetchGame();
                    }}
                    canAddEvents={canAddEvents}
                  />
                )}

                {activeTab === 'freeshots' && (
                  <FreeShotPanel
                    gameId={game.id}
                    homeTeamId={game.home_team_id}
                    awayTeamId={game.away_team_id}
                    homeTeamName={game.home_team_name}
                    awayTeamName={game.away_team_name}
                    currentPeriod={timerState?.current_period || game.current_period}
                    timeRemaining={formatTime(timerState?.time_remaining || game.time_remaining)}
                    onFreeShotRecorded={() => {
                      // Refresh timeline and game data to show new free shot events
                      fetchGame();
                    }}
                  />
                )}

                {activeTab === 'commentary' && (
                  <MatchCommentary
                    gameId={game.id}
                    currentPeriod={timerState?.current_period || game.current_period}
                    timeRemaining={formatTime(timerState?.time_remaining || game.time_remaining)}
                    onCommentaryAdded={() => {
                      // Refresh game data to update any match state
                      fetchGame();
                    }}
                  />
                )}
              </div>
            </div>
          </div>
      </div>

      {showExportDialog && (
        <ExportDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          onExport={handleExport}
          title={`Export Game: ${game.home_team_name} vs ${game.away_team_name}`}
          dataType="game"
        />
      )}
    </div>
  );
};

export default LiveMatch;
