import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Bar
} from 'recharts';
import api from '../utils/api';
import { advancedAnalyticsApi } from '../services/advancedAnalyticsApi';
import FatigueGauge from './FatigueGauge';
import DashboardWidget from './DashboardWidget';
import type { FatigueResponse, FatigueGameAnalysis } from '../types/advanced-analytics';
import '../styles/FatigueAnalysis.css';

interface FatigueAnalysisProps {
  playerId: number;
  teamId?: number;
  dateRange?: { startDate: string; endDate: string };
}

interface TeamStats {
  avg_play_time_percent: number;
  avg_play_time_minutes: number;
}

interface RestRecommendation {
  priority: 'high' | 'medium' | 'low';
  reason: string;
  restDays: number;
  activities?: string[];
}

const FatigueAnalysis: React.FC<FatigueAnalysisProps> = ({
  playerId,
  teamId,
  dateRange
}) => {
  const [fatigueData, setFatigueData] = useState<FatigueResponse | null>(null);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch fatigue data
  const fetchFatigueData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await advancedAnalyticsApi.fatigue(playerId, dateRange);
      setFatigueData(response);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load fatigue data';
      setError(errorMsg);
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching fatigue data:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [playerId, dateRange]);

  // Fetch team statistics for comparison
  const fetchTeamStats = useCallback(async () => {
    if (!teamId) return;

    try {
      const response = await api.get<{ data: FatigueGameAnalysis[] }>('/reports/team-fatigue', {
        params: { team_id: teamId, limit: 20 }
      });

      const games = response.data.data;
      if (games.length > 0) {
        const avgPlayTime = games.reduce((sum, g) => sum + g.play_time_percent, 0) / games.length;
        const avgMinutes = games.reduce((sum, g) => sum + g.play_time_minutes, 0) / games.length;
        setTeamStats({
          avg_play_time_percent: parseFloat(avgPlayTime.toFixed(1)),
          avg_play_time_minutes: parseFloat(avgMinutes.toFixed(1))
        });
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Could not fetch team statistics:', err);
      }
    }
  }, [teamId]);

  useEffect(() => {
    fetchFatigueData();
    fetchTeamStats();
  }, [fetchFatigueData, fetchTeamStats]);

  // Calculate current fatigue score (0-100)
  const currentFatigueScore = useMemo(() => {
    if (!fatigueData || fatigueData.fatigue_analysis.length === 0) return 0;

    const latest = fatigueData.fatigue_analysis[0];
    const baseScore = latest.play_time_percent;
    const degradationPenalty = latest.performance_degradation * 2;
    let score = baseScore + degradationPenalty;

    // Fatigue level modifier
    const fatigueMultiplier: Record<string, number> = {
      fresh: 0,
      normal: 20,
      tired: 60,
      exhausted: 85
    };

    score = Math.max(score, fatigueMultiplier[latest.fatigue_level] || 0);
    return Math.min(100, Math.max(0, Math.round(score)));
  }, [fatigueData]);

  // Generate rest recommendation
  const restRecommendation = useMemo((): RestRecommendation => {
    if (!fatigueData || fatigueData.fatigue_analysis.length === 0) {
      return { priority: 'low', reason: 'No data available', restDays: 0 };
    }

    const latest = fatigueData.fatigue_analysis[0];
    
    if (latest.fatigue_level === 'exhausted') {
      return {
        priority: 'high',
        reason: 'Player is exhausted. Recommend full rest.',
        restDays: 2,
        activities: ['Complete rest', 'Recovery massage', 'Light stretching']
      };
    }

    if (latest.fatigue_level === 'tired') {
      return {
        priority: 'high',
        reason: `Player showed ${latest.performance_degradation.toFixed(1)}% performance degradation.`,
        restDays: 1,
        activities: ['Active recovery', 'Light training', 'Ice bath']
      };
    }

    if (latest.fatigue_level === 'normal' && latest.play_time_percent > 70) {
      return {
        priority: 'medium',
        reason: `Player played ${latest.play_time_percent.toFixed(1)}% of game time.`,
        restDays: 1,
        activities: ['Light recovery session', 'Stretching', 'Hydration']
      };
    }

    return {
      priority: 'low',
      reason: 'Player is in good condition.',
      restDays: 0,
      activities: ['Normal training']
    };
  }, [fatigueData]);

  // Calculate injury risk
  const injuryRisk = useMemo(() => {
    if (!fatigueData || fatigueData.fatigue_analysis.length < 2) {
      return { level: 'low', percentage: 5, reason: 'Insufficient data' };
    }

    let riskScore = 0;

    // Recent fatigue trend (last 2 games)
    const recent = fatigueData.fatigue_analysis.slice(0, 2);
    const fatigueIncrease = recent[1].play_time_percent - recent[0].play_time_percent;
    if (fatigueIncrease > 20) riskScore += 30;
    else if (fatigueIncrease > 10) riskScore += 15;

    // Consistent high play time
    const consistentlyHigh = recent.every(g => g.play_time_percent > 75);
    if (consistentlyHigh) riskScore += 35;

    // Performance degradation
    if (recent[0].performance_degradation > 15) riskScore += 25;

    // Fatigue level
    if (recent[0].fatigue_level === 'exhausted') riskScore += 25;
    else if (recent[0].fatigue_level === 'tired') riskScore += 15;

    let level: 'low' | 'medium' | 'high' = 'low';
    if (riskScore > 70) level = 'high';
    else if (riskScore > 40) level = 'medium';

    return {
      level,
      percentage: Math.min(100, riskScore),
      reason: riskScore > 60 
        ? 'High fatigue levels with recent performance decline'
        : riskScore > 40
        ? 'Moderate fatigue accumulation'
        : 'Low injury risk based on current metrics'
    };
  }, [fatigueData]);

  // Workload comparison
  const workloadComparison = useMemo(() => {
    if (!fatigueData || !teamStats || fatigueData.fatigue_analysis.length === 0) {
      return null;
    }

    const playerAvg = fatigueData.fatigue_analysis.reduce((sum, g) => sum + g.play_time_percent, 0) / fatigueData.fatigue_analysis.length;
    const difference = playerAvg - teamStats.avg_play_time_percent;
    const percentDiff = (difference / teamStats.avg_play_time_percent) * 100;

    return {
      playerAvg: parseFloat(playerAvg.toFixed(1)),
      teamAvg: teamStats.avg_play_time_percent,
      difference: parseFloat(difference.toFixed(1)),
      percentDiff: parseFloat(percentDiff.toFixed(1)),
      status: difference > 10 ? 'above' : difference < -10 ? 'below' : 'average'
    };
  }, [fatigueData, teamStats]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!fatigueData || fatigueData.fatigue_analysis.length === 0) return [];

    return fatigueData.fatigue_analysis
      .slice()
      .reverse()
      .map((game) => ({
        date: new Date(game.game_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        playTime: game.play_time_percent,
        playTimeMinutes: game.play_time_minutes,
        degradation: game.performance_degradation
      }));
  }, [fatigueData]);

  // Alert status based on fatigue score
  const getAlertStatus = (score: number): 'success' | 'warning' | 'critical' => {
    if (score < 40) return 'success';
    if (score < 70) return 'warning';
    return 'critical';
  };

  const alertStatus = getAlertStatus(currentFatigueScore);

  return (
    <div className="fatigue-analysis">
      {/* Header */}
      <div className="fatigue-analysis__header">
        <h1 className="fatigue-analysis__title">Fatigue Analysis</h1>
        <p className="fatigue-analysis__subtitle">Player workload and rest recommendations</p>
      </div>

      {/* Alert Banner */}
      <div className={`fatigue-analysis__alert fatigue-analysis__alert--${alertStatus}`}>
        <span className="fatigue-analysis__alert-icon">
          {alertStatus === 'success' && '✓'}
          {alertStatus === 'warning' && '⚠'}
          {alertStatus === 'critical' && '⚠️'}
        </span>
        <div className="fatigue-analysis__alert-content">
          <strong className="fatigue-analysis__alert-title">
            {alertStatus === 'success' && 'Player in Good Condition'}
            {alertStatus === 'warning' && 'Elevated Fatigue Level'}
            {alertStatus === 'critical' && 'High Fatigue Alert'}
          </strong>
          <p className="fatigue-analysis__alert-message">
            {alertStatus === 'success' && 'No immediate rest required. Player ready for competition.'}
            {alertStatus === 'warning' && 'Monitor player closely. Consider rest or reduced minutes in next game.'}
            {alertStatus === 'critical' && 'Immediate rest recommended. Risk of injury or poor performance is elevated.'}
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="fatigue-analysis__grid">
        {/* Fatigue Score Gauge */}
        <DashboardWidget
          title="Current Fatigue Score"
          icon="📊"
          loading={loading}
          error={error}
        >
          <div className="fatigue-analysis__gauge-container">
            <FatigueGauge score={currentFatigueScore} size="medium" />
          </div>
        </DashboardWidget>

        {/* Injury Risk Indicator */}
        <DashboardWidget
          title="Injury Risk Assessment"
          icon="⚕️"
        >
          <div className="fatigue-analysis__injury-risk">
            <div className="fatigue-analysis__risk-meter">
              <div
                className={`fatigue-analysis__risk-bar fatigue-analysis__risk-bar--${injuryRisk.level}`}
                style={{ width: `${injuryRisk.percentage}%` }}
              />
            </div>
            <div className="fatigue-analysis__risk-info">
              <p className="fatigue-analysis__risk-label">
                Risk Level: <strong>{injuryRisk.level.toUpperCase()}</strong>
              </p>
              <p className="fatigue-analysis__risk-percentage">{injuryRisk.percentage}%</p>
              <p className="fatigue-analysis__risk-reason">{injuryRisk.reason}</p>
            </div>
          </div>
        </DashboardWidget>

        {/* Rest Recommendation */}
        <DashboardWidget
          title="Rest Recommendation"
          icon="😴"
        >
          <div className={`fatigue-analysis__recommendation fatigue-analysis__recommendation--${restRecommendation.priority}`}>
            <div className="fatigue-analysis__rec-header">
              <h4 className="fatigue-analysis__rec-title">
                {restRecommendation.priority === 'high' && '🔴 High Priority'}
                {restRecommendation.priority === 'medium' && '🟡 Medium Priority'}
                {restRecommendation.priority === 'low' && '🟢 Low Priority'}
              </h4>
              <p className="fatigue-analysis__rec-days">
                {restRecommendation.restDays > 0 ? `${restRecommendation.restDays} day${restRecommendation.restDays > 1 ? 's' : ''} rest` : 'Continue regular training'}
              </p>
            </div>
            <p className="fatigue-analysis__rec-reason">{restRecommendation.reason}</p>
            {restRecommendation.activities && restRecommendation.activities.length > 0 && (
              <div className="fatigue-analysis__rec-activities">
                <p className="fatigue-analysis__rec-activities-label">Recommended Activities:</p>
                <ul className="fatigue-analysis__rec-list">
                  {restRecommendation.activities.map((activity, idx) => (
                    <li key={idx}>{activity}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </DashboardWidget>

        {/* Workload Comparison */}
        {workloadComparison && (
          <DashboardWidget
            title="Workload vs Team Average"
            icon="📈"
          >
            <div className="fatigue-analysis__workload-comparison">
              <div className="fatigue-analysis__comparison-bars">
                <div className="fatigue-analysis__comparison-item">
                  <label>Player Avg</label>
                  <div className="fatigue-analysis__bar-container">
                    <div
                      className="fatigue-analysis__bar fatigue-analysis__bar--player"
                      style={{ width: `${Math.min(100, workloadComparison.playerAvg)}%` }}
                    >
                      {workloadComparison.playerAvg.toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="fatigue-analysis__comparison-item">
                  <label>Team Avg</label>
                  <div className="fatigue-analysis__bar-container">
                    <div
                      className="fatigue-analysis__bar fatigue-analysis__bar--team"
                      style={{ width: `${Math.min(100, workloadComparison.teamAvg)}%` }}
                    >
                      {workloadComparison.teamAvg.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
              <div className={`fatigue-analysis__comparison-result fatigue-analysis__comparison-result--${workloadComparison.status}`}>
                <p>Player is {Math.abs(workloadComparison.percentDiff).toFixed(1)}% {workloadComparison.status === 'above' ? 'ABOVE' : workloadComparison.status === 'below' ? 'BELOW' : 'AT'} team average</p>
              </div>
            </div>
          </DashboardWidget>
        )}
      </div>

      {/* Minutes Played Over Time Chart */}
      <DashboardWidget
        title="Minutes Played Over Time"
        icon="⏱️"
        loading={loading}
        error={error}
      >
        {chartData.length > 0 ? (
          <div className="fatigue-analysis__chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" label={{ value: 'Play Time %', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" label={{ value: 'Performance Loss %', angle: 90, position: 'insideRight' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-light)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '10px'
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="playTime" fill="#2196F3" name="Play Time %" />
                <Line yAxisId="right" type="monotone" dataKey="degradation" stroke="#FF9800" name="Performance Degradation %" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="fatigue-analysis__no-data">No game data available</div>
        )}
      </DashboardWidget>

      {/* Period Performance Details */}
      {fatigueData && fatigueData.fatigue_analysis.length > 0 && (
        <DashboardWidget
          title="Recent Game Period Performance"
          icon="📋"
        >
          <div className="fatigue-analysis__period-details">
            {fatigueData.fatigue_analysis.slice(0, 3).map((game, gameIndex) => (
              <div key={`${game.game_id}-${game.game_date}-${gameIndex}`} className="fatigue-analysis__game-card">
                <h4 className="fatigue-analysis__game-date">
                  {new Date(game.game_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </h4>
                <div className="fatigue-analysis__game-stats">
                  <div className="fatigue-analysis__stat">
                    <span className="fatigue-analysis__stat-label">Fatigue Level</span>
                    <span className={`fatigue-analysis__stat-value fatigue-analysis__fatigue-level--${game.fatigue_level}`}>
                      {game.fatigue_level.charAt(0).toUpperCase() + game.fatigue_level.slice(1)}
                    </span>
                  </div>
                  <div className="fatigue-analysis__stat">
                    <span className="fatigue-analysis__stat-label">Play Time</span>
                    <span className="fatigue-analysis__stat-value">{game.play_time_percent.toFixed(1)}%</span>
                  </div>
                  <div className="fatigue-analysis__stat">
                    <span className="fatigue-analysis__stat-label">Minutes</span>
                    <span className="fatigue-analysis__stat-value">{game.play_time_minutes}m</span>
                  </div>
                  <div className="fatigue-analysis__stat">
                    <span className="fatigue-analysis__stat-label">Degradation</span>
                    <span className="fatigue-analysis__stat-value">{game.performance_degradation.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Period Performance */}
                {game.period_performance.length > 0 && (
                  <div className="fatigue-analysis__periods">
                    <p className="fatigue-analysis__periods-label">By Period:</p>
                    <div className="fatigue-analysis__periods-grid">
                      {game.period_performance.map((period, periodIndex) => (
                        <div key={`${game.game_id}-period-${period.period}-${periodIndex}`} className="fatigue-analysis__period-box">
                          <span className="fatigue-analysis__period-num">P{period.period}</span>
                          <span className="fatigue-analysis__period-fg">{period.fg_percentage.toFixed(0)}%</span>
                          <span className="fatigue-analysis__period-shots">{period.shots} shots</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </DashboardWidget>
      )}
    </div>
  );
};

export default FatigueAnalysis;
