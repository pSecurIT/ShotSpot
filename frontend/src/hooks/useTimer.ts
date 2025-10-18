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
}

/**
 * Custom hook for managing game timer state with request deduplication
 * Prevents multiple simultaneous API calls for the same game timer
 */
export const useTimer = (gameId: string | undefined) => {
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track in-flight requests to prevent duplicates
  const fetchingRef = useRef(false);
  const lastFetchRef = useRef<number>(0);
  
  // Minimum time between fetches (ms) - prevents rapid successive calls
  const MIN_FETCH_INTERVAL = 100;

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
      setTimerState(response.data);
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

  // Auto-refresh timer when running
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (timerState?.timer_state === 'running' && gameId) {
      // Fetch immediately when timer starts running
      fetchTimerState();
      
      // Then poll every second
      interval = setInterval(() => {
        fetchTimerState();
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [timerState?.timer_state, gameId, fetchTimerState]);

  // Initial fetch
  useEffect(() => {
    if (gameId) {
      fetchTimerState(true); // Force initial fetch
    }
  }, [gameId, fetchTimerState]);

  return {
    timerState,
    loading,
    error,
    refetch: fetchTimerState
  };
};
