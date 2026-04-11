import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../utils/api';

interface TimerState {
  current_period: number;
  period_duration: {
    hours?: number;
    minutes?: number;
    seconds?: number;
  };
  time_remaining: {
    hours?: number;
    minutes?: number;
    seconds?: number;
  };
  timer_state: 'stopped' | 'running' | 'paused';
  timer_started_at?: string;
  timer_paused_at?: string;
}

interface InternalTimerState extends TimerState {
  _periodDurationSeconds: number | null;
  _remainingBaseSeconds: number | null;
  _baselineCapturedAtMs: number | null;
}

interface UseTimerOptions {
  onPeriodEnd?: () => void;
}

const MIN_FETCH_INTERVAL = 100;
const SERVER_SYNC_INTERVAL = 5000;
const DISPLAY_TICK_INTERVAL = 250;

const retryTimerMutation = async <T,>(
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

      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response && axiosError.response.status && axiosError.response.status >= 400 && axiosError.response.status < 500) {
        throw error;
      }

      if (attempt === maxRetries) {
        throw error;
      }

      const waitTime = delayMs * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
};

const timePartsToSeconds = (time?: { hours?: number; minutes?: number; seconds?: number } | null): number | null => {
  if (!time) {
    return null;
  }

  const hours = Number(time.hours || 0);
  const minutes = Number(time.minutes || 0);
  const seconds = Number(time.seconds || 0);

  return (hours * 3600) + (minutes * 60) + seconds;
};

const secondsToTimeParts = (totalSeconds?: number | null): { hours?: number; minutes?: number; seconds?: number } | undefined => {
  if (totalSeconds === null || totalSeconds === undefined) {
    return undefined;
  }

  const normalizedSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(normalizedSeconds / 3600);
  const minutes = Math.floor((normalizedSeconds % 3600) / 60);
  const seconds = normalizedSeconds % 60;

  return hours > 0
    ? { hours, minutes, seconds }
    : { minutes, seconds };
};

const deriveRemainingSeconds = (timerState: InternalTimerState | null, nowMs: number): number | null => {
  if (!timerState) {
    return null;
  }

  const fallbackSeconds = timerState._remainingBaseSeconds ?? timerState._periodDurationSeconds;
  if (fallbackSeconds === null) {
    return null;
  }

  if (timerState.timer_state !== 'running' || !timerState._baselineCapturedAtMs) {
    return fallbackSeconds;
  }

  const elapsedSeconds = Math.floor((nowMs - timerState._baselineCapturedAtMs) / 1000);
  return Math.max(0, fallbackSeconds - elapsedSeconds);
};

const buildInternalTimerState = (incomingState: TimerState, capturedAtMs: number): InternalTimerState => {
  const periodDurationSeconds = timePartsToSeconds(incomingState.period_duration);
  const remainingBaseSeconds = timePartsToSeconds(incomingState.time_remaining) ?? periodDurationSeconds;

  return {
    ...incomingState,
    _periodDurationSeconds: periodDurationSeconds,
    _remainingBaseSeconds: remainingBaseSeconds,
    _baselineCapturedAtMs: incomingState.timer_state === 'running' ? capturedAtMs : null
  };
};

const toPublicTimerState = (timerState: InternalTimerState | null, nowMs: number): TimerState | null => {
  if (!timerState) {
    return null;
  }

  const remainingSeconds = deriveRemainingSeconds(timerState, nowMs);

  return {
    current_period: timerState.current_period,
    period_duration: secondsToTimeParts(timerState._periodDurationSeconds) || timerState.period_duration,
    time_remaining: secondsToTimeParts(remainingSeconds) || timerState.time_remaining,
    timer_state: timerState.timer_state,
    timer_started_at: timerState.timer_started_at,
    timer_paused_at: timerState.timer_paused_at
  };
};

/**
 * Custom hook for managing game timer state with client-side countdown
 * Calculates time remaining locally for smooth countdown, syncs with server periodically
 */
export const useTimer = (gameId: string | undefined, options?: UseTimerOptions) => {
  const [timerSnapshot, setTimerSnapshot] = useState<InternalTimerState | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodHasEnded, setPeriodHasEnded] = useState(false);
  
  const fetchingRef = useRef(false);
  const lastFetchRef = useRef<number>(0);
  const currentRemainingSecondsRef = useRef<number | null>(null);
  const autoPauseInFlightRef = useRef(false);
  const startMutationRef = useRef<Promise<void> | null>(null);
  const pauseMutationRef = useRef<Promise<void> | null>(null);

  const setTimerStateOptimistic = useCallback((updates: Partial<TimerState>) => {
    setTimerSnapshot(prevState => {
      if (!prevState) {
        return null;
      }

      const nextPeriodDurationSeconds = updates.period_duration
        ? timePartsToSeconds(updates.period_duration)
        : prevState._periodDurationSeconds;
      const currentRemainingSeconds = currentRemainingSecondsRef.current
        ?? prevState._remainingBaseSeconds
        ?? prevState._periodDurationSeconds;
      const nextTimerMode = updates.timer_state ?? prevState.timer_state;

      const nextRemainingBaseSeconds = updates.time_remaining
        ? timePartsToSeconds(updates.time_remaining)
        : nextTimerMode === 'stopped'
          ? nextPeriodDurationSeconds
          : nextTimerMode === 'running'
            ? currentRemainingSeconds
            : currentRemainingSeconds;

      return {
        ...prevState,
        ...updates,
        period_duration: updates.period_duration ?? prevState.period_duration,
        time_remaining: secondsToTimeParts(nextRemainingBaseSeconds) || prevState.time_remaining,
        timer_started_at: nextTimerMode === 'running'
          ? new Date().toISOString()
          : prevState.timer_started_at,
        timer_paused_at: nextTimerMode === 'paused'
          ? new Date().toISOString()
          : nextTimerMode === 'running'
            ? undefined
            : prevState.timer_paused_at,
        _periodDurationSeconds: nextPeriodDurationSeconds,
        _remainingBaseSeconds: nextRemainingBaseSeconds,
        _baselineCapturedAtMs: nextTimerMode === 'running' ? Date.now() : null
      };
    });
  }, []);

  const resetPeriodEndState = useCallback(() => {
    setPeriodHasEnded(false);
  }, []);

  const applyFetchedTimerState = useCallback((incomingState: TimerState) => {
    const capturedAtMs = Date.now();
    setNowMs(capturedAtMs);
    setTimerSnapshot(buildInternalTimerState(incomingState, capturedAtMs));
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

      applyFetchedTimerState(response.data);
      if (response.data.timer_state === 'running') {
        setPeriodHasEnded(false);
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
  }, [applyFetchedTimerState, gameId]);

  const reconcileTimerStateInBackground = useCallback(() => {
    void fetchTimerState(true);
  }, [fetchTimerState]);

  const timerState = useMemo(() => toPublicTimerState(timerSnapshot, nowMs), [timerSnapshot, nowMs]);
  const currentRemainingSeconds = useMemo(() => deriveRemainingSeconds(timerSnapshot, nowMs), [timerSnapshot, nowMs]);

  useEffect(() => {
    currentRemainingSecondsRef.current = currentRemainingSeconds;
  }, [currentRemainingSeconds]);

  const startTimer = useCallback(async () => {
    if (startMutationRef.current) {
      return startMutationRef.current;
    }

    if (!gameId) {
      throw new Error('Game ID is required to start the timer');
    }

    if (timerSnapshot?.timer_state === 'running') {
      return;
    }

    const mutationPromise = (async () => {
      const previousSnapshot = timerSnapshot ? { ...timerSnapshot } : null;
      const startFromPeriodDuration = timerSnapshot?.timer_state === 'stopped';

      setError(null);
      setTimerStateOptimistic({
        timer_state: 'running',
        ...(startFromPeriodDuration && timerSnapshot?._periodDurationSeconds !== null
          ? { time_remaining: secondsToTimeParts(timerSnapshot._periodDurationSeconds) }
          : {})
      });

      try {
        await retryTimerMutation(() => api.post(`/timer/${gameId}/start`, {}));
        reconcileTimerStateInBackground();
      } catch (err) {
        setError('Failed to start timer');
        if (previousSnapshot) {
          setTimerSnapshot(previousSnapshot);
        }
        await fetchTimerState(true);
        throw err;
      } finally {
        startMutationRef.current = null;
      }
    })();

    startMutationRef.current = mutationPromise;
    return mutationPromise;
  }, [fetchTimerState, gameId, reconcileTimerStateInBackground, setTimerStateOptimistic, timerSnapshot]);

  const pauseTimer = useCallback(async () => {
    if (pauseMutationRef.current) {
      return pauseMutationRef.current;
    }

    if (!gameId) {
      throw new Error('Game ID is required to pause the timer');
    }

    if (timerSnapshot?.timer_state !== 'running') {
      return;
    }

    const mutationPromise = (async () => {
      const previousSnapshot = timerSnapshot ? { ...timerSnapshot } : null;
      const frozenTime = secondsToTimeParts(currentRemainingSecondsRef.current);

      setError(null);
      setTimerStateOptimistic({
        timer_state: 'paused',
        ...(frozenTime ? { time_remaining: frozenTime } : {})
      });

      try {
        await retryTimerMutation(() => api.post(`/timer/${gameId}/pause`, {}));
        reconcileTimerStateInBackground();
      } catch (err) {
        setError('Failed to pause timer');
        if (previousSnapshot) {
          setTimerSnapshot(previousSnapshot);
        }
        await fetchTimerState(true);
        throw err;
      } finally {
        pauseMutationRef.current = null;
      }
    })();

    pauseMutationRef.current = mutationPromise;
    return mutationPromise;
  }, [fetchTimerState, gameId, reconcileTimerStateInBackground, setTimerStateOptimistic, timerSnapshot]);

  useEffect(() => {
    if (timerSnapshot?.timer_state !== 'running') {
      setNowMs(Date.now());
      return;
    }

    const tick = () => setNowMs(Date.now());
    tick();

    const intervalId = setInterval(tick, DISPLAY_TICK_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [timerSnapshot?._baselineCapturedAtMs, timerSnapshot?.timer_state]);

  useEffect(() => {
    if (timerSnapshot?.timer_state !== 'running' || currentRemainingSeconds !== 0 || autoPauseInFlightRef.current) {
      if (timerSnapshot?.timer_state !== 'running' || currentRemainingSeconds !== 0) {
        autoPauseInFlightRef.current = false;
      }
      return;
    }

    autoPauseInFlightRef.current = true;
    setPeriodHasEnded(true);

    if (options?.onPeriodEnd) {
      setTimeout(() => options.onPeriodEnd?.(), 100);
    }

    pauseTimer().catch(err => {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error auto-pausing timer at period end:', err);
      }
    });
  }, [currentRemainingSeconds, options, pauseTimer, timerSnapshot?.timer_state]);

  useEffect(() => {
    let syncInterval: NodeJS.Timeout | null = null;
    
    if (timerSnapshot?.timer_state === 'running' && gameId) {
      syncInterval = setInterval(() => {
        fetchTimerState(false);
      }, SERVER_SYNC_INTERVAL);
    }

    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [fetchTimerState, gameId, timerSnapshot?.timer_state]);

  useEffect(() => {
    if (!gameId || typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    const syncIfVisible = () => {
      if (document.visibilityState === 'visible') {
        void fetchTimerState(true);
      }
    };

    document.addEventListener('visibilitychange', syncIfVisible);
    window.addEventListener('focus', syncIfVisible);

    return () => {
      document.removeEventListener('visibilitychange', syncIfVisible);
      window.removeEventListener('focus', syncIfVisible);
    };
  }, [fetchTimerState, gameId]);

  useEffect(() => {
    if (gameId) {
      fetchTimerState(true);
    }
  }, [gameId, fetchTimerState]);

  return {
    timerState,
    currentTimeMs: nowMs,
    loading,
    error,
    refetch: fetchTimerState,
    setTimerStateOptimistic,
    periodHasEnded,
    resetPeriodEndState,
    startTimer,
    pauseTimer
  };
};
