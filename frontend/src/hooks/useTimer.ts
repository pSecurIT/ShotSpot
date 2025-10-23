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

/**
 * Custom hook for managing game timer state with client-side countdown
 * Calculates time remaining locally for smooth countdown, syncs with server periodically
 */
export const useTimer = (gameId: string | undefined) => {
  const [serverTimerState, setServerTimerState] = useState<TimerState | null>(null);
  const [clientTimeRemaining, setClientTimeRemaining] = useState<{ minutes: number; seconds: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
      setServerTimerState(response.data);
      
      // Initialize client-side timer with server data
      // Use time_remaining if available, otherwise fall back to period_duration
      const timeToDisplay = response.data.time_remaining || response.data.period_duration;
      if (timeToDisplay) {
        setClientTimeRemaining({
          minutes: timeToDisplay.minutes || 0,
          seconds: timeToDisplay.seconds || 0
        });
      }
      
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

  // Client-side countdown (runs every second, no network calls)
  useEffect(() => {
    if (clientIntervalRef.current) {
      clearInterval(clientIntervalRef.current);
      clientIntervalRef.current = null;
    }

    if (serverTimerState?.timer_state === 'running' && clientTimeRemaining) {
      clientIntervalRef.current = setInterval(() => {
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
            // Timer reached 0
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
  }, [serverTimerState?.timer_state, clientTimeRemaining]);

  // Periodic server sync when timer is running (every 5 seconds)
  useEffect(() => {
    let syncInterval: NodeJS.Timeout | null = null;
    
    if (serverTimerState?.timer_state === 'running' && gameId) {
      syncInterval = setInterval(() => {
        fetchTimerState();
      }, SERVER_SYNC_INTERVAL);
    }

    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [serverTimerState?.timer_state, gameId, fetchTimerState]);

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
    setTimerStateOptimistic // 🔥 NEW: Allow manual state updates
  };
};
