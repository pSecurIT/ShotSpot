import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import DashboardWidget from './DashboardWidget';
import QuickActions from './QuickActions';
import StatePanel from './ui/StatePanel';
import PageLayout from './ui/PageLayout';
import useBreadcrumbs from '../hooks/useBreadcrumbs';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Dashboard.css';

interface GameListItem {
  id: number;
  date: string;
  status: string;
  home_club_name?: string;
  away_club_name?: string;
  home_team_name?: string | null;
  away_team_name?: string | null;
  home_score?: number;
  away_score?: number;
}

interface RecentAchievementItem {
  id: number;
  earned_at: string;
  player_id: number;
  player_name: string;
  name: string;
  description: string;
  badge_icon: string;
  points: number;
  game_id?: number | null;
  game_date?: string | null;
}

interface DashboardSummary {
  teams: number;
  players: number;
  games: number;
}

const formatGameTitle = (g: GameListItem): string => {
  const home = g.home_team_name || g.home_club_name || 'Home';
  const away = g.away_team_name || g.away_club_name || 'Away';
  return `${home} vs ${away}`;
};

type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const Dashboard: React.FC = () => {
  const breadcrumbs = useBreadcrumbs();
  const { socket, connected } = useWebSocket();
  const { user } = useAuth();
  const isCoachOrAdmin = user?.role === 'coach' || user?.role === 'admin';

  const [recentGames, setRecentGames] = useState<GameListItem[]>([]);
  const [upcomingGames, setUpcomingGames] = useState<GameListItem[]>([]);
  const [recentAchievements, setRecentAchievements] = useState<RecentAchievementItem[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [showSecondaryPanels, setShowSecondaryPanels] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);

  const [loading, setLoading] = useState({
    recent: true,
    upcoming: true,
    achievements: false,
    summary: true
  });

  const [errors, setErrors] = useState<{ [k: string]: string | null }>({
    recent: null,
    upcoming: null,
    achievements: null,
    summary: null
  });

  const apiWithPerfHelpers = api as typeof api & {
    getWithCache?: <T>(url: string, config?: unknown, options?: { ttlMs?: number }) => Promise<T>;
    prefetchGet?: (url: string, config?: unknown, options?: { ttlMs?: number }) => Promise<void>;
  };

  const readCached = useCallback(async <T,>(url: string, params?: Record<string, unknown>, ttlMs?: number) => {
    if (typeof apiWithPerfHelpers.getWithCache === 'function') {
      const cachedData = await apiWithPerfHelpers.getWithCache<T>(url, params ? { params } : undefined, { ttlMs });
      if (cachedData !== undefined && cachedData !== null) {
        return cachedData;
      }
    }

    const response = params ? await api.get<T>(url, { params }) : await api.get<T>(url);
    return response.data;
  }, [apiWithPerfHelpers]);

  const safePrefetch = useCallback(async (url: string, params?: Record<string, unknown>, ttlMs?: number) => {
    if (typeof apiWithPerfHelpers.prefetchGet === 'function') {
      await apiWithPerfHelpers.prefetchGet(url, params ? { params } : undefined, { ttlMs });
      return;
    }

    try {
      if (params) {
        await api.get(url, { params });
      } else {
        await api.get(url);
      }
    } catch {
      // Prefetch remains non-blocking in test and runtime fallback paths.
    }
  }, [apiWithPerfHelpers]);

  const fetchRecentGames = useCallback(async () => {
    setLoading((p) => ({ ...p, recent: true }));
    setErrors((p) => ({ ...p, recent: null }));
    try {
      const data = await readCached<GameListItem[]>('/games', { limit: 5, sort: 'recent' }, 12000);
      setRecentGames(data);
    } catch {
      setErrors((p) => ({ ...p, recent: 'Failed to load recent matches' }));
    } finally {
      setLoading((p) => ({ ...p, recent: false }));
    }
  }, [readCached]);

  const fetchUpcomingGames = useCallback(async () => {
    setLoading((p) => ({ ...p, upcoming: true }));
    setErrors((p) => ({ ...p, upcoming: null }));
    try {
      const data = await readCached<GameListItem[]>('/games', { status: 'upcoming' }, 12000);
      setUpcomingGames(data.slice(0, 5));
    } catch {
      setErrors((p) => ({ ...p, upcoming: 'Failed to load upcoming games' }));
    } finally {
      setLoading((p) => ({ ...p, upcoming: false }));
    }
  }, [readCached]);

  const fetchRecentAchievements = useCallback(async () => {
    setLoading((p) => ({ ...p, achievements: true }));
    setErrors((p) => ({ ...p, achievements: null }));
    try {
      const data = await readCached<RecentAchievementItem[]>('/achievements/recent', { limit: 8 }, 8000);
      setRecentAchievements(data);
    } catch {
      setErrors((p) => ({ ...p, achievements: 'Failed to load achievements feed' }));
    } finally {
      setLoading((p) => ({ ...p, achievements: false }));
    }
  }, [readCached]);

  const fetchSummary = useCallback(async () => {
    setLoading((p) => ({ ...p, summary: true }));
    setErrors((p) => ({ ...p, summary: null }));
    try {
      const data = await readCached<DashboardSummary>('/dashboard/summary', undefined, 15000);
      setSummary(data);
    } catch {
      setErrors((p) => ({ ...p, summary: 'Failed to load summary stats' }));
    } finally {
      setLoading((p) => ({ ...p, summary: false }));
    }
  }, [readCached]);

  const refreshCore = useCallback(async () => {
    await Promise.all([fetchRecentGames(), fetchUpcomingGames(), fetchSummary()]);
  }, [fetchRecentGames, fetchUpcomingGames, fetchSummary]);

  const refreshAll = useCallback(async () => {
    if (showSecondaryPanels) {
      await Promise.all([refreshCore(), fetchRecentAchievements()]);
      return;
    }

    await refreshCore();
  }, [showSecondaryPanels, refreshCore, fetchRecentAchievements]);

  useEffect(() => {
    void refreshCore();
  }, [refreshCore]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleCallbackId: number | null = null;
    const idleWindow = window as IdleWindow;

    if (idleWindow.requestIdleCallback) {
      idleCallbackId = idleWindow.requestIdleCallback(() => {
        setShowQuickActions(true);
      });
    } else {
      timeoutId = setTimeout(() => {
        setShowQuickActions(true);
      }, 200);
    }

    return () => {
      if (idleCallbackId !== null && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleCallbackId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleCallbackId: number | null = null;
    const idleWindow = window as IdleWindow;

    if (idleWindow.requestIdleCallback) {
      idleCallbackId = idleWindow.requestIdleCallback(() => {
        setShowSecondaryPanels(true);
      });
    } else {
      timeoutId = setTimeout(() => setShowSecondaryPanels(true), 120);
    }

    return () => {
      if (idleCallbackId !== null && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleCallbackId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    if (!showSecondaryPanels) {
      return;
    }

    void fetchRecentAchievements();
  }, [showSecondaryPanels, fetchRecentAchievements]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleCallbackId: number | null = null;
    const idleWindow = window as IdleWindow;

    const runPrefetch = () => {
      void Promise.all([
        safePrefetch('/games', { status: 'upcoming' }, 12000),
        safePrefetch('/games', { limit: 20, sort: 'recent' }, 12000)
      ]);
    };

    if (idleWindow.requestIdleCallback) {
      idleCallbackId = idleWindow.requestIdleCallback(runPrefetch);
    } else {
      timeoutId = setTimeout(runPrefetch, 200);
    }

    return () => {
      if (idleCallbackId !== null && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleCallbackId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [safePrefetch]);

  // Real-time achievements updates (if WebSocket is connected)
  useEffect(() => {
    if (!socket) return;

    const onUnlocked = () => {
      void fetchRecentAchievements();
    };

    socket.on('achievement-unlocked', onUnlocked);
    return () => {
      socket.off('achievement-unlocked', onUnlocked);
    };
  }, [socket, fetchRecentAchievements]);

  const notifications = useMemo(() => {
    const items: Array<{ id: string; kind: 'ok' | 'warn'; text: string }> = [];

    if (user?.passwordMustChange) {
      items.push({ id: 'pw', kind: 'warn', text: 'Password change required. Use the User menu to update your password.' });
    }

    if (typeof navigator !== 'undefined') {
      items.push({
        id: 'online',
        kind: navigator.onLine ? 'ok' : 'warn',
        text: navigator.onLine ? 'Online' : 'Offline — actions will be queued for sync'
      });
    }

    items.push({
      id: 'ws',
      kind: connected ? 'ok' : 'warn',
      text: connected ? 'Live updates connected' : 'Live updates disconnected'
    });

    return items;
  }, [connected, user?.passwordMustChange]);

  return (
    <PageLayout
      title="Dashboard"
      eyebrow="Performance hub"
      description="Matchday ops, live system signals, and the fastest path back into action."
      breadcrumbs={breadcrumbs}
      actions={(
        <div className="dashboard__header-actions">
          <button
            type="button"
            className="dashboard-action dashboard-action--secondary"
            onClick={() => {
              void refreshAll();
            }}
          >
            Refresh feed
          </button>
          <Link
            to={isCoachOrAdmin ? '/games' : '/analytics'}
            className="dashboard-action dashboard-action--primary"
          >
            {isCoachOrAdmin ? 'Open match center' : 'View analytics'}
          </Link>
        </div>
      )}
    >
    <div className="dashboard">
      <div className="dashboard__header">
        <div className="dashboard__hero-copy">
          <span className="dashboard__eyebrow">Today</span>
          <h2 className="dashboard__title">Dashboard focus</h2>
          <p className="dashboard__subtitle">Live highlights, recovery status, and upcoming actions at a glance.</p>
        </div>
      </div>

      <section className="dashboard__spotlight" aria-label="Dashboard status">
        <div className="dashboard__spotlight-card dashboard__spotlight-card--signal">
          <span className="dashboard__spotlight-label">Sync state</span>
          <strong className="dashboard__spotlight-value">{connected ? 'Live' : 'Standby'}</strong>
          <span className="dashboard__spotlight-meta">{connected ? 'Realtime updates are flowing.' : 'Live updates will resume when the socket reconnects.'}</span>
        </div>
        <div className="dashboard__spotlight-card">
          <span className="dashboard__spotlight-label">Matchday mode</span>
          <strong className="dashboard__spotlight-value">{typeof navigator !== 'undefined' && !navigator.onLine ? 'Offline queue' : 'Ready'}</strong>
          <span className="dashboard__spotlight-meta">{typeof navigator !== 'undefined' && !navigator.onLine ? 'New actions will be queued safely for sync.' : 'Connected for capture, analysis, and export.'}</span>
        </div>
        <div className="dashboard__spotlight-card">
          <span className="dashboard__spotlight-label">Primary focus</span>
          <strong className="dashboard__spotlight-value">{isCoachOrAdmin ? 'Run the next match' : 'Review performance'}</strong>
          <span className="dashboard__spotlight-meta">{isCoachOrAdmin ? 'Use quick actions to jump into match prep and exports.' : 'Use analytics and achievements to review the latest results.'}</span>
        </div>
      </section>

      <div className="dashboard__grid">
        <div className="dashboard__panel dashboard__panel--full">
          <DashboardWidget title="Quick Actions" icon="⚡">
            {showQuickActions ? (
              <QuickActions />
            ) : (
              <StatePanel
                variant="loading"
                compact
                title="Preparing actions"
                message="Loading your shortcuts and navigation targets."
              />
            )}
          </DashboardWidget>
        </div>

        <div className="dashboard__panel dashboard__panel--half">
          <DashboardWidget
            title="Recent Matches"
            icon="🕒"
            loading={loading.recent}
            error={errors.recent}
            onRetry={() => {
              void fetchRecentGames();
            }}
          >
            {recentGames.length === 0 ? (
              <StatePanel
                variant="empty"
                compact
                title="No recent matches yet"
                message="Finished matches will appear here once games have been tracked."
              />
            ) : (
              <ul className="dashboard-list">
                {recentGames.map((g) => (
                  <li key={g.id} className="dashboard-list__item">
                    <div className="dashboard-list__meta">
                      <div className="dashboard-list__title">{formatGameTitle(g)}</div>
                      <div className="dashboard-list__sub">
                        <span className="dashboard-pill">{g.status}</span>{' '}
                        <span className="dashboard-pill">{new Date(g.date).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="dashboard-list__cta">
                      <Link to={`/match/${g.id}`} className="dashboard-pill">Live</Link>
                      <Link to={`/analytics/${g.id}`} className="dashboard-pill">Analytics</Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DashboardWidget>
        </div>

        <div className="dashboard__panel dashboard__panel--half">
          <DashboardWidget
            title="Upcoming Games"
            icon="📅"
            loading={loading.upcoming}
            error={errors.upcoming}
            onRetry={() => {
              void fetchUpcomingGames();
            }}
          >
            {upcomingGames.length === 0 ? (
              <StatePanel
                variant="empty"
                compact
                title="No upcoming games"
                message="Schedule the next match to keep the sideline ready."
              />
            ) : (
              <ul className="dashboard-list">
                {upcomingGames.map((g) => (
                  <li key={g.id} className="dashboard-list__item">
                    <div className="dashboard-list__meta">
                      <div className="dashboard-list__title">{formatGameTitle(g)}</div>
                      <div className="dashboard-list__sub">
                        <span className="dashboard-pill">{new Date(g.date).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="dashboard-list__cta">
                      <Link to={`/match/${g.id}`} className="dashboard-pill">Open</Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DashboardWidget>
        </div>

        <div className="dashboard__panel dashboard__panel--half">
          <DashboardWidget
            title="Quick Stats"
            icon="📈"
            loading={loading.summary}
            error={errors.summary}
            onRetry={() => {
              void fetchSummary();
            }}
          >
            {summary ? (
              <div className="stats-row">
                <div className="stat-card">
                  <div className="stat-card__label">Teams</div>
                  <div className="stat-card__value">{summary.teams}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card__label">Players</div>
                  <div className="stat-card__value">{summary.players}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card__label">Games</div>
                  <div className="stat-card__value">{summary.games}</div>
                </div>
              </div>
            ) : (
              <StatePanel
                variant="empty"
                compact
                title="No summary available"
                message="Team, player, and game totals will appear here once data is available."
              />
            )}
          </DashboardWidget>
        </div>

        {showSecondaryPanels && (
        <div className="dashboard__panel dashboard__panel--half">
          <DashboardWidget title="Notifications" icon="🔔">
            <div className="notifications">
              {notifications.map((n) => (
                <div key={n.id} className={`notification notification--${n.kind}`}>{n.text}</div>
              ))}
            </div>
          </DashboardWidget>
        </div>
        )}

        {showSecondaryPanels && (
        <div className="dashboard__panel dashboard__panel--full">
          <DashboardWidget
            title="Recent Achievements"
            icon="🏆"
            loading={loading.achievements}
            error={errors.achievements}
            onRetry={() => {
              void fetchRecentAchievements();
            }}
          >
            {recentAchievements.length === 0 ? (
              <StatePanel
                variant="empty"
                compact
                title="No recent achievements"
                message="Unlocked milestones will show up here as soon as players start earning them."
              />
            ) : (
              <ul className="dashboard-list">
                {recentAchievements.map((a) => (
                  <li key={a.id} className="dashboard-list__item">
                    <div className="dashboard-list__meta">
                      <div className="dashboard-list__title">{a.badge_icon || '🏆'} {a.name}</div>
                      <div className="dashboard-list__sub">
                        {a.player_name} • {new Date(a.earned_at).toLocaleString()} • {a.points} pts
                      </div>
                    </div>
                    <div className="dashboard-list__cta">
                      {a.game_id ? <span className="dashboard-pill">Game #{a.game_id}</span> : <span className="dashboard-pill">General</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DashboardWidget>
        </div>
        )}
      </div>
    </div>
    </PageLayout>
  );
};

export default Dashboard;
