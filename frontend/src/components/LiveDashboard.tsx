import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import '../styles/LiveDashboard.css';

interface LiveDashboardProps {
  gameId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  currentPeriod: number;
  numberOfPeriods: number;
  timerState?: 'stopped' | 'running' | 'paused';
}

interface PeriodScore {
  period: number;
  home_score: number;
  away_score: number;
}

interface TeamStats {
  team_id: number;
  team_name: string;
  total_shots: number;
  goals: number;
  misses: number;
  blocked: number;
  shooting_percentage: number;
  total_possessions: number;
  total_possession_time: number;
  avg_possession_time: number;
  shots_per_possession: number;
}

const LiveDashboard: React.FC<LiveDashboardProps> = ({
  gameId,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  homeScore,
  awayScore,
  currentPeriod,
  numberOfPeriods,
  timerState
}) => {
  const [periodScores, setPeriodScores] = useState<PeriodScore[]>([]);
  const [homeStats, setHomeStats] = useState<TeamStats | null>(null);
  const [awayStats, setAwayStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch period-by-period scores
  const fetchPeriodScores = useCallback(async () => {
    try {
      const response = await api.get(`/shots/${gameId}`);
      const shots = response.data;

      // Calculate scores by period
      const scoresByPeriod: { [key: number]: { home: number; away: number } } = {};
      
      // Initialize all periods
      for (let i = 1; i <= numberOfPeriods; i++) {
        scoresByPeriod[i] = { home: 0, away: 0 };
      }

      // Count goals per period
      shots.forEach((shot: { period: number; team_id: number; result: string }) => {
        if (shot.result === 'goal' && shot.period <= numberOfPeriods) {
          if (shot.team_id === homeTeamId) {
            scoresByPeriod[shot.period].home++;
          } else if (shot.team_id === awayTeamId) {
            scoresByPeriod[shot.period].away++;
          }
        }
      });

      // Convert to array format
      const scores: PeriodScore[] = Object.keys(scoresByPeriod)
        .map(period => ({
          period: parseInt(period),
          home_score: scoresByPeriod[parseInt(period)].home,
          away_score: scoresByPeriod[parseInt(period)].away
        }))
        .sort((a, b) => a.period - b.period);

      setPeriodScores(scores);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching period scores:', err);
      }
      // Don't set error - this is optional data
    }
  }, [gameId, homeTeamId, awayTeamId, numberOfPeriods]);

  // Fetch team statistics
  const fetchTeamStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch shots for both teams
      const [homeShotsResponse, awayShotsResponse] = await Promise.all([
        api.get(`/shots/${gameId}?team_id=${homeTeamId}`),
        api.get(`/shots/${gameId}?team_id=${awayTeamId}`)
      ]);

      const homeShots = homeShotsResponse.data;
      const awayShots = awayShotsResponse.data;

      // Fetch possessions for both teams
      const [homePossessionsResponse, awayPossessionsResponse] = await Promise.all([
        api.get(`/possessions/${gameId}?team_id=${homeTeamId}`),
        api.get(`/possessions/${gameId}?team_id=${awayTeamId}`)
      ]);

      const homePossessions = homePossessionsResponse.data;
      const awayPossessions = awayPossessionsResponse.data;

      // Calculate home team stats
      const homeGoals = homeShots.filter((s: { result: string }) => s.result === 'goal').length;
      const homeMisses = homeShots.filter((s: { result: string }) => s.result === 'miss').length;
      const homeBlocked = homeShots.filter((s: { result: string }) => s.result === 'blocked').length;
      const homeTotalShots = homeShots.length;
      const homeShootingPct = homeTotalShots > 0 ? (homeGoals / homeTotalShots) * 100 : 0;

      // Calculate possession stats for home team
      const completedHomePossessions = homePossessions.filter((p: { ended_at: string | null }) => p.ended_at !== null);
      const homeTotalPossessionTime = completedHomePossessions.reduce((sum: number, p: { started_at: string; ended_at: string }) => {
        const duration = new Date(p.ended_at).getTime() - new Date(p.started_at).getTime();
        return sum + duration / 1000; // Convert to seconds
      }, 0);
      const homeAvgPossessionTime = completedHomePossessions.length > 0 
        ? homeTotalPossessionTime / completedHomePossessions.length 
        : 0;
      const homeShotsPerPossession = completedHomePossessions.length > 0
        ? homeTotalShots / completedHomePossessions.length
        : 0;

      setHomeStats({
        team_id: homeTeamId,
        team_name: homeTeamName,
        total_shots: homeTotalShots,
        goals: homeGoals,
        misses: homeMisses,
        blocked: homeBlocked,
        shooting_percentage: homeShootingPct,
        total_possessions: completedHomePossessions.length,
        total_possession_time: homeTotalPossessionTime,
        avg_possession_time: homeAvgPossessionTime,
        shots_per_possession: homeShotsPerPossession
      });

      // Calculate away team stats
      const awayGoals = awayShots.filter((s: { result: string }) => s.result === 'goal').length;
      const awayMisses = awayShots.filter((s: { result: string }) => s.result === 'miss').length;
      const awayBlocked = awayShots.filter((s: { result: string }) => s.result === 'blocked').length;
      const awayTotalShots = awayShots.length;
      const awayShootingPct = awayTotalShots > 0 ? (awayGoals / awayTotalShots) * 100 : 0;

      // Calculate possession stats for away team
      const completedAwayPossessions = awayPossessions.filter((p: { ended_at: string | null }) => p.ended_at !== null);
      const awayTotalPossessionTime = completedAwayPossessions.reduce((sum: number, p: { started_at: string; ended_at: string }) => {
        const duration = new Date(p.ended_at).getTime() - new Date(p.started_at).getTime();
        return sum + duration / 1000; // Convert to seconds
      }, 0);
      const awayAvgPossessionTime = completedAwayPossessions.length > 0 
        ? awayTotalPossessionTime / completedAwayPossessions.length 
        : 0;
      const awayShotsPerPossession = completedAwayPossessions.length > 0
        ? awayTotalShots / completedAwayPossessions.length
        : 0;

      setAwayStats({
        team_id: awayTeamId,
        team_name: awayTeamName,
        total_shots: awayTotalShots,
        goals: awayGoals,
        misses: awayMisses,
        blocked: awayBlocked,
        shooting_percentage: awayShootingPct,
        total_possessions: completedAwayPossessions.length,
        total_possession_time: awayTotalPossessionTime,
        avg_possession_time: awayAvgPossessionTime,
        shots_per_possession: awayShotsPerPossession
      });

      setLoading(false);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching team stats:', err);
      }
      setError('Failed to load statistics');
      setLoading(false);
    }
  }, [gameId, homeTeamId, awayTeamId, homeTeamName, awayTeamName]);

  // Fetch data on mount and when game state changes
  useEffect(() => {
    // Perform data fetching - this is intentional and safe
    void fetchTeamStats();
    void fetchPeriodScores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, homeTeamId, awayTeamId]);

  // Auto-refresh stats every 10 seconds when timer is running
  useEffect(() => {
    if (timerState === 'running') {
      const interval = setInterval(() => {
        void fetchTeamStats();
        void fetchPeriodScores();
      }, 10000); // Refresh every 10 seconds

      return () => clearInterval(interval);
    }
  }, [timerState, fetchTeamStats, fetchPeriodScores]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading && !homeStats && !awayStats) {
    return <div className="live-dashboard loading">Loading statistics...</div>;
  }

  if (error && !homeStats && !awayStats) {
    return <div className="live-dashboard error">{error}</div>;
  }

  return (
    <div className="live-dashboard">
      <div className="dashboard-header">
        <h3>📊 Live Match Dashboard</h3>
        {timerState === 'running' && (
          <span className="live-indicator">🔴 LIVE</span>
        )}
      </div>

      {/* Period Breakdown */}
      <div className="period-breakdown">
        <h4>Score by Period</h4>
        <div className="period-scores-table">
          <div className="period-scores-header">
            <div className="team-label">Team</div>
            {Array.from({ length: numberOfPeriods }, (_, i) => (
              <div key={i} className={`period-label ${i + 1 === currentPeriod ? 'current' : ''}`}>
                P{i + 1}
              </div>
            ))}
            <div className="total-label">Total</div>
          </div>
          
          <div className="period-scores-row home">
            <div className="team-name">{homeTeamName}</div>
            {periodScores.map(ps => (
              <div key={ps.period} className={`period-score ${ps.period === currentPeriod ? 'current' : ''}`}>
                {ps.home_score}
              </div>
            ))}
            <div className="total-score">{homeScore}</div>
          </div>
          
          <div className="period-scores-row away">
            <div className="team-name">{awayTeamName}</div>
            {periodScores.map(ps => (
              <div key={ps.period} className={`period-score ${ps.period === currentPeriod ? 'current' : ''}`}>
                {ps.away_score}
              </div>
            ))}
            <div className="total-score">{awayScore}</div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="performance-metrics">
        <h4>Performance Metrics</h4>
        <div className="metrics-grid">
          {/* Shooting Stats */}
          <div className="metric-card">
            <h5>Shooting Percentage</h5>
            <div className="stat-comparison">
              <div className="stat-team home">
                <div className="stat-label">{homeTeamName}</div>
                <div className="stat-value">{homeStats?.shooting_percentage.toFixed(1)}%</div>
                <div className="stat-detail">
                  {homeStats?.goals}/{homeStats?.total_shots} shots
                </div>
              </div>
              <div className="stat-team away">
                <div className="stat-label">{awayTeamName}</div>
                <div className="stat-value">{awayStats?.shooting_percentage.toFixed(1)}%</div>
                <div className="stat-detail">
                  {awayStats?.goals}/{awayStats?.total_shots} shots
                </div>
              </div>
            </div>
          </div>

          {/* Shot Distribution */}
          <div className="metric-card">
            <h5>Shot Distribution</h5>
            <div className="stat-comparison">
              <div className="stat-team home">
                <div className="stat-label">{homeTeamName}</div>
                <div className="shot-breakdown">
                  <span className="shot-stat goal">⚽ {homeStats?.goals}</span>
                  <span className="shot-stat miss">❌ {homeStats?.misses}</span>
                  <span className="shot-stat blocked">🚫 {homeStats?.blocked}</span>
                </div>
              </div>
              <div className="stat-team away">
                <div className="stat-label">{awayTeamName}</div>
                <div className="shot-breakdown">
                  <span className="shot-stat goal">⚽ {awayStats?.goals}</span>
                  <span className="shot-stat miss">❌ {awayStats?.misses}</span>
                  <span className="shot-stat blocked">🚫 {awayStats?.blocked}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Possession Stats */}
          <div className="metric-card">
            <h5>Possession Statistics</h5>
            <div className="stat-comparison">
              <div className="stat-team home">
                <div className="stat-label">{homeTeamName}</div>
                <div className="stat-value">{homeStats?.total_possessions}</div>
                <div className="stat-detail">possessions</div>
                <div className="stat-subdetail">
                  Avg: {formatTime(homeStats?.avg_possession_time || 0)}
                </div>
              </div>
              <div className="stat-team away">
                <div className="stat-label">{awayTeamName}</div>
                <div className="stat-value">{awayStats?.total_possessions}</div>
                <div className="stat-detail">possessions</div>
                <div className="stat-subdetail">
                  Avg: {formatTime(awayStats?.avg_possession_time || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Shots per Possession */}
          <div className="metric-card">
            <h5>Shots per Possession</h5>
            <div className="stat-comparison">
              <div className="stat-team home">
                <div className="stat-label">{homeTeamName}</div>
                <div className="stat-value">{homeStats?.shots_per_possession.toFixed(2)}</div>
                <div className="stat-detail">shots/possession</div>
              </div>
              <div className="stat-team away">
                <div className="stat-label">{awayTeamName}</div>
                <div className="stat-value">{awayStats?.shots_per_possession.toFixed(2)}</div>
                <div className="stat-detail">shots/possession</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveDashboard;
