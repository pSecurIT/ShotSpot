import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  home_club_id: number;
  away_club_id: number;
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

interface AssignableTeam {
  id: number;
}

type PreMatchSetupMode = 'single_team' | 'both_teams';

interface Possession {
  id: number;
  game_id: number;
  club_id: number;
  team_id?: number;
  period: number;
  started_at: string;
  ended_at: string | null;
  shots_taken: number;
  team_name?: string;
  club_name?: string;
}

interface PossessionTimingState {
  startedAtMs: number;
  accumulatedPausedMs: number;
  pausedAtMs: number | null;
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
    setPossessionTiming(null);
  }, []);

  const {
    timerState,
    currentTimeMs,
    error: timerError,
    refetch: fetchTimerState,
    setTimerStateOptimistic,
    periodHasEnded,
    resetPeriodEndState,
    startTimer,
    pauseTimer
  } = useTimer(gameId, {
    onPeriodEnd: handlePeriodEnd
  });

  useEffect(() => {
    if (timerError) {
      setError(timerError);
    }
  }, [timerError]);

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
  const [userAssignedTeam, setUserAssignedTeam] = useState<'home' | 'away' | null>(null);
  
  // Pre-match setup state
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [homeAttackingSide, setHomeAttackingSide] = useState<'left' | 'right'>('left');
  const [numberOfPeriods, setNumberOfPeriods] = useState<number>(4);
  const [periodDurationMinutes, setPeriodDurationMinutes] = useState<number>(10);
  const [showPreMatchSetup, setShowPreMatchSetup] = useState(false);
  const [preMatchSetupMode, setPreMatchSetupMode] = useState<PreMatchSetupMode>('both_teams');
  const [selectedSingleTeam, setSelectedSingleTeam] = useState<'home' | 'away'>('home');

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
  const [possessionTiming, setPossessionTiming] = useState<PossessionTimingState | null>(null);
  // Note: possessionStats removed - reserved for future analytics feature

  // Reset tracking - incrementing this key forces CourtVisualization to remount and refetch shots
  const [courtResetKey, setCourtResetKey] = useState<number>(0);
  const nextPeriodMutationRef = useRef<Promise<void> | null>(null);
  const resetMatchMutationRef = useRef<Promise<void> | null>(null);

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
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  const currentUserRole = (() => {
    if (typeof window === 'undefined') {
      return 'admin';
    }

    try {
      const rawUser = localStorage.getItem('user');
      if (!rawUser) {
        return 'admin';
      }
      const parsedUser = JSON.parse(rawUser) as { role?: string };
      return parsedUser.role || 'admin';
    } catch {
      return 'admin';
    }
  })();

  const isAdminUser = currentUserRole === 'admin';
  const effectiveSetupMode: PreMatchSetupMode = isAdminUser ? preMatchSetupMode : 'single_team';
  const effectiveSingleTeam = isAdminUser ? selectedSingleTeam : userAssignedTeam;
  const teamsToConfigure: Array<'home' | 'away'> = effectiveSetupMode === 'both_teams'
    ? ['home', 'away']
    : effectiveSingleTeam
      ? [effectiveSingleTeam]
      : [];

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

  const fetchPendingReviewCount = useCallback(async () => {
    if (!gameId) return;

    try {
      const [comprehensiveResponse, shotsResponse, substitutionsResponse] = await Promise.all([
        api.get(`/events/comprehensive/${gameId}?event_status=unconfirmed`),
        api.get(`/shots/${gameId}?event_status=unconfirmed`),
        api.get(`/substitutions/${gameId}?event_status=unconfirmed`)
      ]);

      setPendingReviewCount(
        (comprehensiveResponse.data?.length || 0) +
        (shotsResponse.data?.length || 0) +
        (substitutionsResponse.data?.length || 0)
      );
    } catch (pendingError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching pending review count:', pendingError);
      }
    }
  }, [gameId]);

  const refreshMatchContext = useCallback(() => {
    void Promise.allSettled([fetchGame(), fetchPendingReviewCount()]);
  }, [fetchGame, fetchPendingReviewCount]);

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
          .filter((p: Player & { is_starting: boolean; player_id: number; club_id?: number }) => p.club_id === game.home_club_id && p.is_starting)
          .map((p: Player & { is_starting: boolean; player_id: number; club_id?: number }) => ({
            id: p.player_id,
            team_id: game.home_team_id,
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
          .filter((p: Player & { is_starting: boolean; player_id: number; club_id?: number }) => p.club_id === game.away_club_id && p.is_starting)
          .map((p: Player & { is_starting: boolean; player_id: number; club_id?: number }) => ({
            id: p.player_id,
            team_id: game.away_team_id,
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
  }, [game?.id, game?.status, game?.home_team_id, game?.away_team_id, game?.home_club_id, game?.away_club_id]);

  // Fetch user's assignable teams and determine which team they're assigned to in this game
  const fetchUserAssignedTeam = useCallback(async () => {
    if (isAdminUser) {
      // Admins can record events for both teams.
      setUserAssignedTeam(null);
      return;
    }

    try {
      const response = await api.get('/users/me/assignable-teams');
      const teams = response.data as AssignableTeam[];
      
      // If game is loaded, determine which team the user is assigned to
      if (game?.home_team_id && game?.away_team_id) {
        const userTeamIds = new Set(teams.map((team) => team.id));
        
        // Check if user's team is the home or away team in this game
        if (userTeamIds.has(game.home_team_id)) {
          setUserAssignedTeam('home');
        } else if (userTeamIds.has(game.away_team_id)) {
          setUserAssignedTeam('away');
        } else {
          // User is not assigned to either team (admin without specific team assignment)
          setUserAssignedTeam(null);
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching user assigned team:', error);
      }
      // Silently fail - this is not critical for the match to proceed
      setUserAssignedTeam(null);
    }
  }, [game?.away_team_id, game?.home_team_id, isAdminUser]);

  const validateTeamRequirements = (side: 'home' | 'away'): { valid: boolean; message: string } => {
    const teamName = side === 'home' ? game?.home_team_name : game?.away_team_name;
    const selectedPlayers = side === 'home' ? selectedHomePlayers : selectedAwayPlayers;
    const playersList = side === 'home' ? homePlayers : awayPlayers;
    const captainId = side === 'home' ? homeCaptainId : awayCaptainId;
    const offensePlayers = side === 'home' ? homeOffensePlayers : awayOffensePlayers;

    if (selectedPlayers.size < 8) {
      return {
        valid: false,
        message: `${teamName} needs at least 8 players selected (currently ${selectedPlayers.size}). Korfball requires 4 males and 4 females per team.`
      };
    }

    const genderCount = getGenderCount(Array.from(selectedPlayers), playersList);
    if (genderCount.male !== 4 || genderCount.female !== 4) {
      return {
        valid: false,
        message: `${teamName} must have exactly 4 males and 4 females. Currently: ${genderCount.male} males, ${genderCount.female} females`
      };
    }

    if (!captainId) {
      return {
        valid: false,
        message: `Please select a captain for ${teamName}`
      };
    }

    if (offensePlayers.size !== 4) {
      return {
        valid: false,
        message: `${teamName} must assign exactly 4 players to offense (currently ${offensePlayers.size})`
      };
    }

    const offenseGenderCount = getGenderCount(Array.from(offensePlayers), playersList);
    if (offenseGenderCount.male !== 2 || offenseGenderCount.female !== 2) {
      return {
        valid: false,
        message: `${teamName} offense must have 2 males and 2 females. Currently: ${offenseGenderCount.male} males, ${offenseGenderCount.female} females`
      };
    }

    const defensePlayers = Array.from(selectedPlayers).filter(id => !offensePlayers.has(id));
    const defenseGenderCount = getGenderCount(defensePlayers, playersList);
    if (defenseGenderCount.male !== 2 || defenseGenderCount.female !== 2) {
      return {
        valid: false,
        message: `${teamName} defense must have 2 males and 2 females. Currently: ${defenseGenderCount.male} males, ${defenseGenderCount.female} females`
      };
    }

    return { valid: true, message: `${teamName} meets all requirements` };
  };

  // Check if configured teams meet minimum player requirements
  const checkTeamRequirements = (): { valid: boolean; message: string } => {
    if (teamsToConfigure.length === 0) {
      if (isAdminUser) {
        return { valid: false, message: 'Please select which team to configure before starting the match.' };
      }
      return { valid: false, message: 'No assigned team found for this match. Contact an admin for team assignment.' };
    }

    for (const side of teamsToConfigure) {
      const validation = validateTeamRequirements(side);
      if (!validation.valid) {
        return validation;
      }
    }

    if (effectiveSetupMode === 'both_teams') {
      return { valid: true, message: 'Both teams meet all requirements' };
    }
    const configuredTeamName = teamsToConfigure[0] === 'home' ? game?.home_team_name : game?.away_team_name;
    return { valid: true, message: `${configuredTeamName} meets all requirements` };
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
  const togglePlayerSelection = (playerId: number, side: 'home' | 'away') => {
    const player = (side === 'home' ? homePlayers : awayPlayers).find(p => p.id === playerId);
    if (!player) return;

    if (side === 'home') {
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
  const toggleBenchPlayerSelection = (playerId: number, side: 'home' | 'away') => {
    if (side === 'home') {
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
  const setCaptain = (playerId: number, side: 'home' | 'away') => {
    if (side === 'home') {
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
  const toggleOffenseAssignment = (playerId: number, side: 'home' | 'away') => {
    const player = (side === 'home' ? homePlayers : awayPlayers).find(p => p.id === playerId);
    if (!player) return;

    if (side === 'home') {
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
      const rosterPlayers = teamsToConfigure.flatMap((side) => {
        const clubId = side === 'home' ? game!.home_club_id : game!.away_club_id;
        const selectedPlayers = side === 'home' ? selectedHomePlayers : selectedAwayPlayers;
        const captainId = side === 'home' ? homeCaptainId : awayCaptainId;
        const offensePlayers = side === 'home' ? homeOffensePlayers : awayOffensePlayers;
        const benchPlayers = side === 'home' ? homeBenchPlayers : awayBenchPlayers;

        return [
          ...Array.from(selectedPlayers).map(playerId => ({
            club_id: clubId,
            player_id: playerId,
            is_captain: playerId === captainId,
            is_starting: true,
            starting_position: offensePlayers.has(playerId) ? 'offense' : 'defense'
          })),
          ...Array.from(benchPlayers).map(playerId => ({
            club_id: clubId,
            player_id: playerId,
            is_captain: false,
            is_starting: false
          }))
        ];
      });

      // Format period duration
      const hours = Math.floor(periodDurationMinutes / 60);
      const minutes = periodDurationMinutes % 60;
      const periodDurationFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
      
      // Show loading state
      setSuccess('Starting match...');
      
      // Run in sequence to avoid partial start (status updated without roster)
      await api.post(`/game-rosters/${gameId}`, { players: rosterPlayers });

      await api.put(`/games/${gameId}`, {
        home_attacking_side: homeAttackingSide,
        number_of_periods: numberOfPeriods,
        period_duration: periodDurationFormatted,
        status: 'in_progress'
      });

      // After API calls complete, fetch updated data
      await Promise.all([
        fetchGame(),
        fetchTimerState(),
        fetchPlayers() // Reload players with starting_position data
      ]);

      // NOW hide pre-match setup after everything is updated
      setShowPreMatchSetup(false);
      setSuccess('Match ready! Good luck to both teams!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      const err = error as {
        response?: {
          data?: {
            error?: string;
            errors?: Array<{ msg?: string }>;
          };
        };
        message?: string;
      };
      const validationMessage = err.response?.data?.errors?.[0]?.msg;
      setError(err.response?.data?.error || validationMessage || 'Error starting match');
      setShowPreMatchSetup(true);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchGame(), fetchPendingReviewCount()]);
      setLoading(false);
    };
    
    loadData();
  }, [gameId, fetchGame, fetchPendingReviewCount]);

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

  // Fetch user's assigned team when game is loaded
  useEffect(() => {
    if (game) {
      fetchUserAssignedTeam();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id, game?.home_team_id, game?.away_team_id]);

  // Timer control handlers
  const handleStartTimer = async () => {
    try {
      setError(null);
      
      // Check if this is the first start
      const wasFirstStart = timerState?.timer_state === 'stopped' && timerState?.current_period === 1 && !activePossession;
      await startTimer();
      
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
    }
  };

  const handlePauseTimer = async () => {
    try {
      setError(null);
      await pauseTimer();
      
      setSuccess('Timer paused');
      setTimeout(() => setSuccess(null), 2000);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error pausing timer');
    }
  };

  const handleStopTimer = async () => {
    if (resetMatchMutationRef.current) {
      return resetMatchMutationRef.current;
    }

    if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to stop and reset the entire match? This will:\n\n• Reset scores to 0-0\n• Delete all recorded shots\n• Delete all game events\n• Delete all possession records\n• Reset timer to period 1\n\nThis action cannot be undone!')) {
      return;
    }
    
    try {
      setError(null);
      const previousGame = game ? { ...game } : null;
      const previousPossession = activePossession;
      const previousPossessionTiming = possessionTiming;
      
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
      
      const mutationPromise = (async () => {
        try {
          await retryApiCall(() => api.post(`/timer/${gameId}/reset-match`, {}));
          void Promise.allSettled([
            fetchTimerState(true),
            fetchGame(),
            fetchActivePossession(),
            fetchPossessionStats()
          ]);
          setSuccess('Match reset successfully - all data cleared');
          setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
          const error = err as { response?: { data?: { error?: string } }; message?: string };
          setError(error.response?.data?.error || 'Error resetting match after retries');
          setActivePossession(previousPossession);
          setPossessionTiming(previousPossessionTiming);
          setCourtResetKey(prev => Math.max(0, prev - 1));

          if (previousGame) {
            setGame(previousGame);
            setTimerStateOptimistic({
              current_period: previousGame.current_period,
              timer_state: previousGame.timer_state,
              time_remaining: previousGame.time_remaining || previousGame.period_duration || { minutes: 10, seconds: 0 },
              period_duration: previousGame.period_duration || { minutes: 10, seconds: 0 }
            });
          }

          void Promise.allSettled([
            fetchTimerState(true),
            fetchGame(),
            fetchActivePossession(),
            fetchPossessionStats()
          ]);
        } finally {
          resetMatchMutationRef.current = null;
        }
      })();

      resetMatchMutationRef.current = mutationPromise;
      return mutationPromise;
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error resetting match');
    }
  };

  const handleNextPeriod = async () => {
    if (nextPeriodMutationRef.current) {
      return nextPeriodMutationRef.current;
    }

    try {
      setError(null);

      const previousGame = game ? { ...game } : null;
      const previousPossession = activePossession;
      const previousPossessionTiming = possessionTiming;
      
      // Clear active possession when starting new period
      setActivePossession(null);
      setPossessionTiming(null);
      
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
      
      const mutationPromise = (async () => {
        try {
          await retryApiCall(() => api.post(`/timer/${gameId}/next-period`, {}));
          void Promise.allSettled([
            fetchTimerState(true),
            fetchGame(),
            fetchPossessionStats()
          ]);
        } catch (err) {
          const error = err as { response?: { data?: { error?: string } }; message?: string };
          setError(error.response?.data?.error || 'Error advancing period after retries');
          setActivePossession(previousPossession);
          setPossessionTiming(previousPossessionTiming);

          if (previousGame) {
            setGame(previousGame);
            setTimerStateOptimistic({
              current_period: previousGame.current_period,
              timer_state: previousGame.timer_state,
              time_remaining: previousGame.time_remaining || previousGame.period_duration || { minutes: 10, seconds: 0 },
              period_duration: previousGame.period_duration || { minutes: 10, seconds: 0 }
            });
          }

          void Promise.allSettled([
            fetchTimerState(true),
            fetchGame(),
            fetchActivePossession(),
            fetchPossessionStats()
          ]);
        } finally {
          nextPeriodMutationRef.current = null;
        }
      })();

      nextPeriodMutationRef.current = mutationPromise;
      
      setSuccess('Advanced to next period');
      setTimeout(() => setSuccess(null), 2000);
      return mutationPromise;
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
      
      // Log the export parameters for debugging
      console.log('Export requested:', { gameId, format, options });
      
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
  const mapClubIdToTeamId = useCallback((clubId: number): number => {
    if (!game) return clubId;
    if (clubId === game.home_club_id) return game.home_team_id;
    if (clubId === game.away_club_id) return game.away_team_id;
    return clubId;
  }, [game]);

  const resolvePossessionIds = useCallback((teamOrClubId: number) => {
    if (!game) {
      return { clubId: teamOrClubId, teamId: teamOrClubId, teamName: undefined as string | undefined };
    }

    if (teamOrClubId === game.home_team_id || teamOrClubId === game.home_club_id) {
      return {
        clubId: game.home_club_id,
        teamId: game.home_team_id,
        teamName: game.home_team_name
      };
    }

    if (teamOrClubId === game.away_team_id || teamOrClubId === game.away_club_id) {
      return {
        clubId: game.away_club_id,
        teamId: game.away_team_id,
        teamName: game.away_team_name
      };
    }

    return { clubId: teamOrClubId, teamId: teamOrClubId, teamName: undefined as string | undefined };
  }, [game]);

  const normalizePossession = useCallback((raw: Record<string, unknown>): Possession => {
    const clubId = Number(raw.club_id ?? raw.team_id);
    return {
      ...(raw as unknown as Possession),
      club_id: clubId,
      team_id: mapClubIdToTeamId(clubId),
      team_name: (raw.team_name as string | undefined) || (raw.club_name as string | undefined)
    };
  }, [mapClubIdToTeamId]);

  const fetchActivePossession = useCallback(async () => {
    try {
      const response = await api.get(`/possessions/${gameId}/active`);
      if (!response.data) {
        setActivePossession(null);
        return;
      }
      setActivePossession(normalizePossession(response.data as Record<string, unknown>));
    } catch (error: unknown) {
      // 404 is expected when there's no active possession (before game starts or between possessions)
      const err = error as { response?: { status?: number } };
      // Silently handle 404, only log other errors in development
      if (err?.response?.status !== 404 && process.env.NODE_ENV === 'development') {
        console.error('Error fetching active possession:', error);
      }
      setActivePossession(null);
    }
  }, [gameId, normalizePossession]);

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

  const handleCenterLineCross = useCallback(async (teamOrClubId: number) => {
    if (!game) return;
    
    try {
      setError(null);
      // Use timerState period if available, fallback to game period
      const currentPeriod = timerState?.current_period || game.current_period || 1;
      const ids = resolvePossessionIds(teamOrClubId);
      
      // 🔥 OPTIMISTIC UPDATE: Create possession object immediately
      const optimisticPossession: Possession = {
        id: Date.now(), // Temporary ID
        game_id: parseInt(gameId || '0'),
        club_id: ids.clubId,
        team_id: ids.teamId,
        period: currentPeriod,
        started_at: new Date(currentTimeMs).toISOString(),
        ended_at: null,
        shots_taken: 0,
        team_name: ids.teamName
      };
      setActivePossession(optimisticPossession);
      
      // Fire API in background WITH RETRY
      retryApiCall(() => api.post(`/possessions/${gameId}`, {
        club_id: ids.clubId,
        period: currentPeriod,
        started_at: optimisticPossession.started_at
      }))
        .then((response) => {
          // Update with real possession data immediately
          if (response.data) {
            setActivePossession(normalizePossession(response.data as Record<string, unknown>));
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
  }, [currentTimeMs, game, timerState?.current_period, gameId, fetchActivePossession, normalizePossession, resolvePossessionIds]);

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
      setGame(prev => {
        if (!prev) {
          return null;
        }

        if (shotInfo.teamId === prev.home_team_id) {
          return { ...prev, home_score: prev.home_score + 1 };
        }

        if (shotInfo.teamId === prev.away_team_id) {
          return { ...prev, away_score: prev.away_score + 1 };
        }

        return prev;
      });

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

  const possessionDuration = useMemo(() => {
    if (!activePossession || !possessionTiming) {
      return 0;
    }

    const effectiveNowMs = timerState?.timer_state === 'running'
      ? currentTimeMs
      : possessionTiming.pausedAtMs ?? currentTimeMs;

    const elapsedMs = effectiveNowMs - possessionTiming.startedAtMs - possessionTiming.accumulatedPausedMs;
    return Math.max(0, Math.floor(elapsedMs / 1000));
  }, [activePossession, currentTimeMs, possessionTiming, timerState?.timer_state]);

  useEffect(() => {
    if (activePossession) {
      const newStartTime = new Date(activePossession.started_at).getTime();
      setPossessionTiming(previousState => {
        if (previousState && Math.abs(previousState.startedAtMs - newStartTime) <= 1000) {
          return previousState;
        }

        return {
          startedAtMs: newStartTime,
          accumulatedPausedMs: 0,
          pausedAtMs: timerState?.timer_state === 'running' ? null : currentTimeMs
        };
      });
    } else {
      setPossessionTiming(null);
    }
  }, [activePossession, activePossession?.started_at, currentTimeMs, timerState?.timer_state]);

  useEffect(() => {
    if (!possessionTiming) {
      return;
    }

    if (timerState?.timer_state === 'running') {
      if (possessionTiming.pausedAtMs !== null) {
        setPossessionTiming(previousState => {
          if (!previousState || previousState.pausedAtMs === null) {
            return previousState;
          }

          return {
            ...previousState,
            accumulatedPausedMs: previousState.accumulatedPausedMs + Math.max(0, currentTimeMs - previousState.pausedAtMs),
            pausedAtMs: null
          };
        });
      }

      return;
    }

    if (possessionTiming.pausedAtMs === null) {
      setPossessionTiming(previousState => {
        if (!previousState || previousState.pausedAtMs !== null) {
          return previousState;
        }

        return {
          ...previousState,
          pausedAtMs: currentTimeMs
        };
      });
    }
  }, [currentTimeMs, possessionTiming, timerState?.timer_state]);

  useEffect(() => {
    if (game?.status !== 'in_progress') {
      setPossessionTiming(null);
    }
  }, [game?.status]);

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
    return <div className="loading" role="status" aria-live="polite">Loading match data...</div>;
  }

  if (!game) {
    return <div className="error-message" role="alert">Game not found</div>;
  }

  // Show pre-match setup for scheduled games
  if (showPreMatchSetup && (game.status === 'scheduled' || game.status === 'to_reschedule')) {
    const requirements = checkTeamRequirements();
    const showHomeSetup = teamsToConfigure.includes('home');
    const showAwaySetup = teamsToConfigure.includes('away');
    
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

        {error && <div className="error-message" role="alert">{error}</div>}
        {success && <div className="success-message" role="status" aria-live="polite">{success}</div>}

        <div className="pre-match-setup">
          <h3>{game.home_team_name} vs {game.away_team_name}</h3>
          <p className="match-date">{new Date(game.date).toLocaleString()}</p>

          {isAdminUser && (
            <div className="match-configuration">
              <h4>Setup Scope</h4>
              <div className="config-row">
                <label htmlFor="setupMode">Pre-match setup mode:</label>
                <select
                  id="setupMode"
                  className="config-input"
                  value={preMatchSetupMode}
                  onChange={(e) => setPreMatchSetupMode(e.target.value as PreMatchSetupMode)}
                >
                  <option value="single_team">Only fill in 1 team</option>
                  <option value="both_teams">Fill in both teams</option>
                </select>
              </div>

              {preMatchSetupMode === 'single_team' && (
                <div className="config-row">
                  <label htmlFor="singleTeamSelect">Team to configure:</label>
                  <select
                    id="singleTeamSelect"
                    className="config-input"
                    value={selectedSingleTeam}
                    onChange={(e) => setSelectedSingleTeam(e.target.value as 'home' | 'away')}
                  >
                    <option value="home">{game.home_team_name} (Home)</option>
                    <option value="away">{game.away_team_name} (Away)</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {!isAdminUser && userAssignedTeam && (
            <div className="info-text">
              You can only configure your assigned team for this match.
            </div>
          )}

          {/* Team Requirements Check */}
          <div className="team-requirements">
            <h4>Select Team Rosters</h4>
            <p className="requirement-note">
              {effectiveSetupMode === 'both_teams'
                ? 'Select 8 players per team (4 males and 4 females), designate a captain, and assign 4 players to offense (2M + 2F) and 4 to defense (2M + 2F).'
                : 'Select 8 players (4 males and 4 females) for the configured team, designate a captain, and assign 4 players to offense (2M + 2F) and 4 to defense (2M + 2F).'}
            </p>
            {effectiveSetupMode === 'single_team' && (
              <p className="requirement-note">
                Opponent setup is temporarily disabled for this match start flow.
              </p>
            )}
            
            <div className="team-roster-grid">
              {/* Home Team Roster */}
              {showHomeSetup && <div className="team-roster-section">
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
                          onChange={() => togglePlayerSelection(player.id, 'home')}
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
                            onClick={() => setCaptain(player.id, 'home')}
                            title="Set as captain"
                          >
                            {homeCaptainId === player.id ? '👑 Captain' : 'Make Captain'}
                          </button>
                          <button
                            className={`offense-button ${homeOffensePlayers.has(player.id) ? 'active' : ''}`}
                            onClick={() => toggleOffenseAssignment(player.id, 'home')}
                            title="Assign to offense (need 2M + 2F)"
                          >
                            {homeOffensePlayers.has(player.id) ? '⚔️ Offense' : '🛡️ Defense'}
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>}

              {/* Away Team Roster */}
              {showAwaySetup && <div className="team-roster-section">
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
                          onChange={() => togglePlayerSelection(player.id, 'away')}
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
                            onClick={() => setCaptain(player.id, 'away')}
                            title="Set as captain"
                          >
                            {awayCaptainId === player.id ? '👑 Captain' : 'Make Captain'}
                          </button>
                          <button
                            className={`offense-button ${awayOffensePlayers.has(player.id) ? 'active' : ''}`}
                            onClick={() => toggleOffenseAssignment(player.id, 'away')}
                            title="Assign to offense (need 2M + 2F)"
                          >
                            {awayOffensePlayers.has(player.id) ? '⚔️ Offense' : '🛡️ Defense'}
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>}
            </div>

            {!requirements.valid && (
              <div className="requirements-error" role="alert">
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
                {showHomeSetup && <div className="team-roster-section">
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
                              onChange={() => toggleBenchPlayerSelection(player.id, 'home')}
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
                </div>}

                {/* Away Team Bench */}
                {showAwaySetup && <div className="team-roster-section">
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
                              onChange={() => toggleBenchPlayerSelection(player.id, 'away')}
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
                </div>}
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
                {effectiveSetupMode === 'both_teams'
                  ? 'Both teams must meet the minimum requirements before starting'
                  : 'The configured team must meet the minimum requirements before starting'}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const eventRestrictedTeam = isAdminUser ? null : userAssignedTeam;

  // Check if game is in progress
  if (game.status !== 'in_progress') {
    return (
      <div className="error-message" role="alert">
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
        homeClubId={game.home_club_id}
        awayClubId={game.away_club_id}
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

      {error && <div className="error-message" role="alert">{error}</div>}
      {success && <div className="success-message" role="status" aria-live="polite">{success}</div>}

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
          homeClubId={game.home_club_id}
          awayClubId={game.away_club_id}
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
          timeRemaining={formatTime(timerState?.time_remaining || game.time_remaining || game.period_duration)}
          onResumeTimer={handleStartTimer}
          onPauseTimer={handlePauseTimer}
          canAddEvents={canAddEvents}
          userAssignedTeam={eventRestrictedTeam}
        />
      </div>

      {/* Substitution Panel */}
      <div className="substitution-section">
        <SubstitutionPanel
            gameId={parseInt(gameId!)}
            homeTeamId={game.home_team_id}
            awayTeamId={game.away_team_id}
            homeClubId={game.home_club_id}
            awayClubId={game.away_club_id}
            homeTeamName={game.home_team_name}
            awayTeamName={game.away_team_name}
            currentPeriod={timerState?.current_period || game.current_period}
            timeRemaining={formatTime(timerState?.time_remaining || game.time_remaining)}
            onSubstitutionRecorded={() => {
              fetchPlayers();
              fetchGame();
            }}
            canAddEvents={canAddEvents}
            userAssignedTeam={eventRestrictedTeam}
            currentUserRole={currentUserRole}
          />
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
                    📊 Timeline {pendingReviewCount > 0 ? `(${pendingReviewCount})` : ''}
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
                    onRefresh={refreshMatchContext}
                  />
                )}

                {activeTab === 'faults' && (
                  <FaultManagement
                    gameId={game.id}
                    homeTeamId={game.home_team_id}
                    awayTeamId={game.away_team_id}
                    homeClubId={game.home_club_id}
                    awayClubId={game.away_club_id}
                    homeTeamName={game.home_team_name}
                    awayTeamName={game.away_team_name}
                    currentPeriod={timerState?.current_period || game.current_period}
                    timeRemaining={formatTime(timerState?.time_remaining || game.time_remaining)}
                    onFaultRecorded={() => {
                      refreshMatchContext();
                    }}
                    canAddEvents={canAddEvents}
                    userAssignedTeam={eventRestrictedTeam}
                    currentUserRole={currentUserRole}
                  />
                )}

                {activeTab === 'timeouts' && (
                  <TimeoutManagement
                    gameId={game.id}
                    homeTeamId={game.home_team_id}
                    awayTeamId={game.away_team_id}
                    homeClubId={game.home_club_id}
                    awayClubId={game.away_club_id}
                    homeTeamName={game.home_team_name}
                    awayTeamName={game.away_team_name}
                    currentPeriod={timerState?.current_period || game.current_period}
                    timeRemaining={formatTime(timerState?.time_remaining || game.time_remaining)}
                    onTimeoutRecorded={() => {
                      refreshMatchContext();
                    }}
                    canAddEvents={canAddEvents}
                    userAssignedTeam={eventRestrictedTeam}
                    currentUserRole={currentUserRole}
                  />
                )}

                {activeTab === 'freeshots' && (
                  <FreeShotPanel
                    gameId={game.id}
                    homeTeamId={game.home_team_id}
                    awayTeamId={game.away_team_id}
                    homeClubId={game.home_club_id}
                    awayClubId={game.away_club_id}
                    homeTeamName={game.home_team_name}
                    awayTeamName={game.away_team_name}
                    currentPeriod={timerState?.current_period || game.current_period}
                    timeRemaining={formatTime(timerState?.time_remaining || game.time_remaining)}
                    onFreeShotRecorded={() => {
                      refreshMatchContext();
                    }}
                    userAssignedTeam={eventRestrictedTeam}
                    currentUserRole={currentUserRole}
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
