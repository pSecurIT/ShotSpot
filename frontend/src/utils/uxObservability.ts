export type UxEventType = 'flow_timing' | 'api_latency' | 'long_task' | 'slow_render' | 'feedback';

export interface UxMetricEvent {
  routePath: string;
  flowName: string;
  eventType: UxEventType;
  metricName: string;
  valueMs?: number;
  rating?: number;
  endpoint?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

interface RouteContext {
  routePath: string;
  flowName: string | null;
}

const UX_EVENTS_ENDPOINT = '/api/ux-observability/events';
const FLUSH_INTERVAL_MS = 3000;
const MAX_QUEUE_SIZE = 10;
const SLOW_RENDER_THRESHOLD_MS = 1200;

const flowStartTimes = new Map<string, number>();
const queuedEvents: UxMetricEvent[] = [];

let flushTimer: number | null = null;
let observersInitialized = false;

let routeContext: RouteContext = {
  routePath: '/',
  flowName: null,
};

const ensureSessionId = (): string => {
  if (typeof window === 'undefined') {
    return 'server-session';
  }

  const key = 'shotspot:ux:session-id:v1';
  const existing = window.sessionStorage.getItem(key);
  if (existing) {
    return existing;
  }

  const generated = `ux_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  window.sessionStorage.setItem(key, generated);
  return generated;
};

const scheduleFlush = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  if (flushTimer !== null) {
    window.clearTimeout(flushTimer);
  }

  flushTimer = window.setTimeout(() => {
    void flushQueuedEvents();
  }, FLUSH_INTERVAL_MS);
};

const shouldTrackEndpoint = (endpoint: string): boolean => {
  if (!endpoint || endpoint.includes('/ux-observability')) {
    return false;
  }

  return endpoint.includes('/games')
    || endpoint.includes('/analytics')
    || endpoint.includes('/dashboard')
    || endpoint.includes('/achievements')
    || endpoint.includes('/auth/login');
};

export const inferTrackedFlowFromPath = (pathname: string): string | null => {
  if (pathname === '/games') {
    return 'open_games_list';
  }
  if (pathname.startsWith('/match/')) {
    return 'start_live_match';
  }
  if (pathname.startsWith('/analytics/')) {
    return 'open_match_analytics';
  }
  return null;
};

export const setUxRouteContext = (routePath: string, flowName: string | null): void => {
  routeContext = {
    routePath,
    flowName,
  };
};

export const getUxRouteContext = (): RouteContext => routeContext;

export const flushQueuedEvents = async (): Promise<void> => {
  if (queuedEvents.length === 0 || typeof window === 'undefined') {
    return;
  }

  const token = window.localStorage.getItem('token');
  if (!token) {
    return;
  }

  const batch = queuedEvents.splice(0, queuedEvents.length);

  try {
    await window.fetch(UX_EVENTS_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ events: batch }),
    });
  } catch {
    // Non-blocking telemetry path: drop errors silently to avoid impacting UX.
  }
};

export const queueUxEvent = (event: UxMetricEvent): void => {
  const normalizedValue = typeof event.valueMs === 'number' && Number.isFinite(event.valueMs)
    ? Math.max(0, Math.round(event.valueMs))
    : undefined;

  const payload: UxMetricEvent = {
    ...event,
    valueMs: normalizedValue,
    routePath: event.routePath || routeContext.routePath,
    flowName: event.flowName || routeContext.flowName || 'unknown_flow',
    sessionId: event.sessionId || ensureSessionId(),
    timestamp: event.timestamp || new Date().toISOString(),
  };

  queuedEvents.push(payload);

  if (queuedEvents.length >= MAX_QUEUE_SIZE) {
    void flushQueuedEvents();
    return;
  }

  scheduleFlush();
};

const flowKey = (flowName: string, routePath: string): string => `${flowName}::${routePath}`;

export const startFlowTiming = (flowName: string, routePath: string): void => {
  const key = flowKey(flowName, routePath);
  if (flowStartTimes.has(key)) {
    return;
  }
  flowStartTimes.set(key, performance.now());
};

export const completeFlowTiming = (
  flowName: string,
  routePath: string,
  metadata?: Record<string, unknown>
): void => {
  const key = flowKey(flowName, routePath);
  const startAt = flowStartTimes.get(key);
  if (typeof startAt !== 'number') {
    return;
  }

  const duration = performance.now() - startAt;
  flowStartTimes.delete(key);

  queueUxEvent({
    routePath,
    flowName,
    eventType: 'flow_timing',
    metricName: 'route_load_ms',
    valueMs: duration,
    metadata,
  });

  if (duration >= SLOW_RENDER_THRESHOLD_MS) {
    queueUxEvent({
      routePath,
      flowName,
      eventType: 'slow_render',
      metricName: 'render_block_ms',
      valueMs: duration,
      metadata: {
        thresholdMs: SLOW_RENDER_THRESHOLD_MS,
        ...metadata,
      },
    });
  }
};

export const cancelFlowTiming = (flowName: string, routePath: string): void => {
  flowStartTimes.delete(flowKey(flowName, routePath));
};

interface ApiLatencyInput {
  endpoint: string;
  method?: string;
  status?: number;
  valueMs: number;
  routePath?: string;
  flowName?: string | null;
}

export const trackApiLatency = (input: ApiLatencyInput): void => {
  if (!shouldTrackEndpoint(input.endpoint)) {
    return;
  }

  queueUxEvent({
    routePath: input.routePath || routeContext.routePath,
    flowName: input.flowName || routeContext.flowName || inferTrackedFlowFromPath(routeContext.routePath) || 'unknown_flow',
    eventType: 'api_latency',
    metricName: 'api_latency_ms',
    valueMs: input.valueMs,
    endpoint: input.endpoint,
    metadata: {
      method: input.method || 'GET',
      status: input.status,
    },
  });
};

export const initializeUxObservers = (): void => {
  if (observersInitialized || typeof window === 'undefined') {
    return;
  }

  observersInitialized = true;

  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const observer = new PerformanceObserver((entryList) => {
        const flowName = routeContext.flowName || inferTrackedFlowFromPath(routeContext.routePath) || 'unknown_flow';

        for (const entry of entryList.getEntries()) {
          queueUxEvent({
            routePath: routeContext.routePath,
            flowName,
            eventType: 'long_task',
            metricName: 'long_task_ms',
            valueMs: entry.duration,
            metadata: {
              entryType: entry.entryType,
              name: entry.name,
            },
          });
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
    } catch {
      // Browser does not support long task observer.
    }
  }

  window.addEventListener('beforeunload', () => {
    void flushQueuedEvents();
  });
};