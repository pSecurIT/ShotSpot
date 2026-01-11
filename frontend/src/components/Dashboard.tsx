import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import DashboardWidget from './DashboardWidget';
import QuickActions from './QuickActions';
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

const Dashboard: React.FC = () => {
  const { socket, connected } = useWebSocket();
  const { user } = useAuth();

  const [recentGames, setRecentGames] = useState<GameListItem[]>([]);
  const [upcomingGames, setUpcomingGames] = useState<GameListItem[]>([]);
  const [recentAchievements, setRecentAchievements] = useState<RecentAchievementItem[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  const [loading, setLoading] = useState({
    recent: true,
    upcoming: true,
    achievements: true,
    summary: true
  });

  const [errors, setErrors] = useState<{ [k: string]: string | null }>({
    recent: null,
    upcoming: null,
    achievements: null,
    summary: null
  });

  const fetchRecentGames = useCallback(async () => {
    setLoading((p) => ({ ...p, recent: true }));
    setErrors((p) => ({ ...p, recent: null }));
    try {
      const response = await api.get<GameListItem[]>('/games', {
        params: { limit: 5, sort: 'recent' }
      });
      setRecentGames(response.data);
    } catch {
      setErrors((p) => ({ ...p, recent: 'Failed to load recent matches' }));
    } finally {
      setLoading((p) => ({ ...p, recent: false }));
    }
  }, []);

  const fetchUpcomingGames = useCallback(async () => {
    setLoading((p) => ({ ...p, upcoming: true }));
    setErrors((p) => ({ ...p, upcoming: null }));
    try {
      const response = await api.get<GameListItem[]>('/games', {
        params: { status: 'upcoming' }
      });
      setUpcomingGames(response.data.slice(0, 5));
    } catch {
      setErrors((p) => ({ ...p, upcoming: 'Failed to load upcoming games' }));
    } finally {
      setLoading((p) => ({ ...p, upcoming: false }));
    }
  }, []);

  const fetchRecentAchievements = useCallback(async () => {
    setLoading((p) => ({ ...p, achievements: true }));
    setErrors((p) => ({ ...p, achievements: null }));
    try {
      const response = await api.get<RecentAchievementItem[]>('/achievements/recent', {
        params: { limit: 8 }
      });
      setRecentAchievements(response.data);
    } catch {
      setErrors((p) => ({ ...p, achievements: 'Failed to load achievements feed' }));
    } finally {
      setLoading((p) => ({ ...p, achievements: false }));
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    setLoading((p) => ({ ...p, summary: true }));
    setErrors((p) => ({ ...p, summary: null }));
    try {
      const response = await api.get<DashboardSummary>('/dashboard/summary');
      setSummary(response.data);
    } catch {
      setErrors((p) => ({ ...p, summary: 'Failed to load summary stats' }));
    } finally {
      setLoading((p) => ({ ...p, summary: false }));
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchRecentGames(), fetchUpcomingGames(), fetchRecentAchievements(), fetchSummary()]);
  }, [fetchRecentGames, fetchUpcomingGames, fetchRecentAchievements, fetchSummary]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

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
    <div className="dashboard">
      <div className="dashboard__header">
        <h1 className="dashboard__title">Dashboard</h1>
        <p className="dashboard__subtitle">Quick actions and recent activity</p>
      </div>

      <div className="dashboard__grid">
        <div style={{ gridColumn: 'span 12' }}>
          <DashboardWidget title="Quick Actions" icon="⚡">
            <QuickActions />
          </DashboardWidget>
        </div>

        <div style={{ gridColumn: 'span 6' }}>
          <DashboardWidget title="Recent Matches" icon="🕒" loading={loading.recent} error={errors.recent}>
            {recentGames.length === 0 ? (
              <div>No recent matches found.</div>
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

        <div style={{ gridColumn: 'span 6' }}>
          <DashboardWidget title="Upcoming Games" icon="📅" loading={loading.upcoming} error={errors.upcoming}>
            {upcomingGames.length === 0 ? (
              <div>No upcoming games.</div>
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

        <div style={{ gridColumn: 'span 6' }}>
          <DashboardWidget title="Quick Stats" icon="📈" loading={loading.summary} error={errors.summary}>
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
              <div />
            )}
          </DashboardWidget>
        </div>

        <div style={{ gridColumn: 'span 6' }}>
          <DashboardWidget title="Notifications" icon="🔔">
            <div className="notifications">
              {notifications.map((n) => (
                <div key={n.id} className={`notification notification--${n.kind}`}>{n.text}</div>
              ))}
            </div>
          </DashboardWidget>
        </div>

        <div style={{ gridColumn: 'span 12' }}>
          <DashboardWidget title="Recent Achievements" icon="🏆" loading={loading.achievements} error={errors.achievements}>
            {recentAchievements.length === 0 ? (
              <div>No recent achievements.</div>
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
      </div>
    </div>
  );
};

export default Dashboard;
