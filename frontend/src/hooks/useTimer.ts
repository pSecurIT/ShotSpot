import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';

interface TimerState {
  current_period: number;
  period_duration: {
    minutes?: number;
    seconds?: number;
  };
  time_remaining: {
    minutes?: number;
    seconds?: number;
  };
  timer_state: 'stopped' | 'running' | 'paused';
  timer_started_at?: string;
}

interface UseTimerOptions {
  onPeriodEnd?: () => void;
}

/**
 * Custom hook for managing game timer state with client-side countdown
 * Calculates time remaining locally for smooth countdown, syncs with server periodically
 */
export const useTimer = (gameId: string | undefined, options?: UseTimerOptions) => {
  const [serverTimerState, setServerTimerState] = useState<TimerState | null>(null);
  const [clientTimeRemaining, setClientTimeRemaining] = useState<{ minutes: number; seconds: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodHasEnded, setPeriodHasEnded] = useState(false);
  
  // Track in-flight requests to prevent duplicates
  const fetchingRef = useRef(false);
  const lastFetchRef = useRef<number>(0);
  const clientIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Minimum time between server fetches (ms)
  const MIN_FETCH_INTERVAL = 100;
  // Server sync interval when timer is running (sync every 5 seconds)
  const SERVER_SYNC_INTERVAL = 5000;

  // 🔥 NEW: Function to manually update timer state (optimistic updates)
  const setTimerStateOptimistic = useCallback((updates: Partial<TimerState>) => {
    setServerTimerState(prev => {
      if (!prev) return null;
      return { ...prev, ...updates };
    });
  }, []);

  // 🔥 NEW: Function to reset period end state (when continuing after period end)
  const resetPeriodEndState = useCallback(() => {
    setPeriodHasEnded(false);
  }, []);

  const fetchTimerState = useCallback(async (force: boolean = false) => {
    if (!gameId) return;
    
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchRef.current;
    
    // Deduplicate: Skip if already fetching or too soon since last fetch
    if (!force && (fetchingRef.current || timeSinceLastFetch < MIN_FETCH_INTERVAL)) {
      return;
    }

    fetchingRef.current = true;
    lastFetchRef.current = now;
    
    try {
      setLoading(true);
      const response = await api.get(`/timer/${gameId}`);
      
      setServerTimerState(prevState => {
        const newState = response.data;
        
        // Ensure time_remaining is populated (fallback to period_duration if not set)
        if (!newState.time_remaining && newState.period_duration) {
          newState.time_remaining = newState.period_duration;
        }
        
        // Reset period end flag when timer is started fresh
        if (newState.timer_state === 'running' && 
            (!prevState || prevState.timer_state !== 'running')) {
          setPeriodHasEnded(false);
          
          // Only reset client time when transitioning TO running state (new period/resume)
          const timeToDisplay = newState.time_remaining || newState.period_duration;
          if (timeToDisplay) {
            setClientTimeRemaining({
              minutes: timeToDisplay.minutes || 0,
              seconds: timeToDisplay.seconds || 0
            });
          }
        } else if (newState.timer_state !== 'running' && prevState?.timer_state === 'running') {
          // Timer was paused or stopped - update client time to match server
          const timeToDisplay = newState.time_remaining || newState.period_duration;
          if (timeToDisplay) {
            setClientTimeRemaining({
              minutes: timeToDisplay.minutes || 0,
              seconds: timeToDisplay.seconds || 0
            });
          }
        }
        // If timer is already running, DON'T update clientTimeRemaining
        // Let it continue counting down smoothly
        
        return newState;
      });
      
      setError(null);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching timer state:', err);
      }
      setError('Failed to fetch timer state');
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [gameId]);

  // Store timer state for countdown to prevent re-renders on server sync
  const timerStateRef = useRef<'stopped' | 'running' | 'paused'>('stopped');
  
  // Update ref when server state changes
  useEffect(() => {
    if (serverTimerState?.timer_state) {
      timerStateRef.current = serverTimerState.timer_state;
    }
  }, [serverTimerState?.timer_state]);

  // Client-side countdown (runs every second, no network calls)
  useEffect(() => {
    if (clientIntervalRef.current) {
      clearInterval(clientIntervalRef.current);
      clientIntervalRef.current = null;
    }

    if (serverTimerState?.timer_state === 'running' && clientTimeRemaining) {
      clientIntervalRef.current = setInterval(() => {
        // Check current timer state from ref to avoid recreating interval
        if (timerStateRef.current !== 'running') {
          return;
        }
        
        setClientTimeRemaining(prev => {
          if (!prev) return null;
          
          let { minutes, seconds } = prev;
          
          // Countdown
          if (seconds > 0) {
            seconds--;
          } else if (minutes > 0) {
            minutes--;
            seconds = 59;
          } else {
            // Timer reached 0:0 - Period has ended!
            setPeriodHasEnded(true);
            
            // Trigger period end callback if provided
            if (options?.onPeriodEnd) {
              setTimeout(() => options.onPeriodEnd!(), 100); // Small delay to ensure state updates
            }
            
            // Stop the timer automatically by making API call
            if (gameId) {
              api.post(`/timer/${gameId}/pause`)
                .catch(err => {
                  if (process.env.NODE_ENV === 'development') {
                    console.error('Error auto-pausing timer at period end:', err);
                  }
                });
            }
            
            return { minutes: 0, seconds: 0 };
          }
          
          return { minutes, seconds };
        });
      }, 1000);
    }

    return () => {
      if (clientIntervalRef.current) {
        clearInterval(clientIntervalRef.current);
        clientIntervalRef.current = null;
      }
    };
    // Only recreate interval when transitioning to/from running state or gameId changes
    // clientTimeRemaining and serverTimerState changes don't recreate interval
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverTimerState?.timer_state, gameId]);

  // Periodic server sync when timer is running (every 5 seconds)
  useEffect(() => {
    let syncInterval: NodeJS.Timeout | null = null;
    
    if (serverTimerState?.timer_state === 'running' && gameId) {
      syncInterval = setInterval(() => {
        // Use force=false to respect deduplication
        fetchTimerState(false);
      }, SERVER_SYNC_INTERVAL);
    }

    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
    // fetchTimerState excluded - it's stable via useCallback with gameId dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverTimerState?.timer_state, gameId]);

  // Initial fetch
  useEffect(() => {
    if (gameId) {
      fetchTimerState(true); // Force initial fetch
    }
  }, [gameId, fetchTimerState]);

  // Return combined state (server state + client-side time)
  const timerState = serverTimerState ? {
    ...serverTimerState,
    time_remaining: clientTimeRemaining || serverTimerState.time_remaining
  } : null;

  return {
    timerState,
    loading,
    error,
    refetch: fetchTimerState,
    setTimerStateOptimistic, // 🔥 NEW: Allow manual state updates
    periodHasEnded, // 🔥 NEW: Indicates if period has ended
    resetPeriodEndState // 🔥 NEW: Reset period end state
  };
};
