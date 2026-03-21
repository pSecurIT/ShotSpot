import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import api from '../utils/api';
import { advancedAnalyticsApi } from '../services/advancedAnalyticsApi';
import type {
  AnalyticsPlayerOption,
  FatigueGameAnalysis,
  FatigueResponse,
  FormTrendGame,
  FormTrendsResponse,
  NextGamePredictionResponse,
  PlayerComparisonResponse,
  VideoEvent,
  VideoHighlightsResponse,
} from '../types/advanced-analytics';
import '../styles/AdvancedAnalytics.css';

type AnalyticsTab = 'form' | 'fatigue' | 'predictions' | 'video';

const RECENT_GAME_LIMIT = 20;

const formatDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
};

const toInputDate = (value: Date): string => value.toISOString().slice(0, 10);

const isWithinRange = (value: string, from: string, to: string): boolean => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return true;

  if (from) {
    const fromDate = new Date(`${from}T00:00:00`);
    if (date < fromDate) return false;
  }

  if (to) {
    const toDate = new Date(`${to}T23:59:59.999`);
    if (date > toDate) return false;
  }

  return true;
};

const playerLabel = (player: AnalyticsPlayerOption): string => {
  const jersey = Number.isFinite(player.jersey_number) ? `#${player.jersey_number}` : '#-';
  const team = player.team_name ? ` • ${player.team_name}` : '';
  return `${jersey} ${player.first_name} ${player.last_name}${team}`;
};

const clipDuration = (event: { timestamp_start?: string | null; timestamp_end?: string | null; suggested_duration?: number }): string => {
  if (event.timestamp_start && event.timestamp_end) {
    return `${event.timestamp_start} - ${event.timestamp_end}`;
  }
  if (typeof event.suggested_duration === 'number') {
    return `~${event.suggested_duration}s clip`;
  }
  return 'Timing unavailable';
};

const AdvancedAnalytics: React.FC = () => {
  const exportRef = useRef<HTMLDivElement>(null);
  const [players, setPlayers] = useState<AnalyticsPlayerOption[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('form');
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const from = new Date();
    from.setMonth(from.getMonth() - 3);
    return toInputDate(from);
  });
  const [dateTo, setDateTo] = useState<string>(() => toInputDate(new Date()));
  const [loading, setLoading] = useState<boolean>(true);
  const [videoLoading, setVideoLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<'image' | 'pdf' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formTrends, setFormTrends] = useState<FormTrendsResponse | null>(null);
  const [fatigue, setFatigue] = useState<FatigueResponse | null>(null);
  const [prediction, setPrediction] = useState<NextGamePredictionResponse | null>(null);
  const [comparison, setComparison] = useState<PlayerComparisonResponse | null>(null);
  const [videoEvents, setVideoEvents] = useState<VideoEvent[]>([]);
  const [videoHighlights, setVideoHighlights] = useState<VideoHighlightsResponse | null>(null);
  const [selectedVideoGameId, setSelectedVideoGameId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPlayers = async () => {
      try {
        const response = await api.get<AnalyticsPlayerOption[]>('/players');
        if (cancelled) return;

        const sortedPlayers = [...response.data].sort((left, right) => {
          const leftName = `${left.last_name} ${left.first_name}`.toLowerCase();
          const rightName = `${right.last_name} ${right.first_name}`.toLowerCase();
          return leftName.localeCompare(rightName);
        });

        setPlayers(sortedPlayers);
        setSelectedPlayerId((current) => current ?? sortedPlayers[0]?.id ?? null);
      } catch (err) {
        if (cancelled) return;
        const nextError = err as { response?: { data?: { error?: string } }; message?: string };
        setError(nextError.response?.data?.error || nextError.message || 'Failed to load players');
        setLoading(false);
      }
    };

    void loadPlayers();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedPlayerId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadAnalytics = async () => {
      setLoading(true);
      setError(null);

      try {
        const [formData, fatigueData, nextGameData, comparisonData] = await Promise.all([
          advancedAnalyticsApi.formTrends(selectedPlayerId, RECENT_GAME_LIMIT),
          advancedAnalyticsApi.fatigue(selectedPlayerId),
          advancedAnalyticsApi.nextGame(selectedPlayerId),
          advancedAnalyticsApi.playerComparison(selectedPlayerId, RECENT_GAME_LIMIT),
        ]);

        if (cancelled) return;

        setFormTrends(formData);
        setFatigue(fatigueData);
        setPrediction(nextGameData);
        setComparison(comparisonData);
      } catch (err) {
        if (cancelled) return;
        const nextError = err as { response?: { data?: { error?: string } }; message?: string };
        setError(nextError.response?.data?.error || nextError.message || 'Failed to load advanced analytics');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [selectedPlayerId]);

  const filteredFormGames = useMemo<FormTrendGame[]>(() => {
    return (formTrends?.recent_games || []).filter((game) => isWithinRange(game.game_date, dateFrom, dateTo));
  }, [dateFrom, dateTo, formTrends]);

  const filteredFatigueGames = useMemo<FatigueGameAnalysis[]>(() => {
    return (fatigue?.fatigue_analysis || []).filter((game) => isWithinRange(game.game_date, dateFrom, dateTo));
  }, [dateFrom, dateTo, fatigue]);

  const availableVideoGameIds = useMemo<number[]>(() => {
    const values = new Set<number>();
    filteredFormGames.forEach((game) => values.add(game.game_id));
    filteredFatigueGames.forEach((game) => values.add(game.game_id));
    return Array.from(values.values()).sort((left, right) => right - left);
  }, [filteredFatigueGames, filteredFormGames]);

  useEffect(() => {
    if (availableVideoGameIds.length === 0) {
      setSelectedVideoGameId(null);
      return;
    }

    setSelectedVideoGameId((current) => {
      if (current && availableVideoGameIds.includes(current)) {
        return current;
      }
      return availableVideoGameIds[0];
    });
  }, [availableVideoGameIds]);

  useEffect(() => {
    if (!selectedVideoGameId) {
      setVideoEvents([]);
      setVideoHighlights(null);
      return;
    }

    let cancelled = false;

    const loadVideo = async () => {
      setVideoLoading(true);

      try {
        const [events, highlights] = await Promise.all([
          advancedAnalyticsApi.videoEvents(selectedVideoGameId),
          advancedAnalyticsApi.videoHighlights(selectedVideoGameId),
        ]);

        if (cancelled) return;
        setVideoEvents(events);
        setVideoHighlights(highlights);
      } catch (err) {
        if (cancelled) return;
        const nextError = err as { response?: { data?: { error?: string } }; message?: string };
        setError(nextError.response?.data?.error || nextError.message || 'Failed to load video insights');
      } finally {
        if (!cancelled) {
          setVideoLoading(false);
        }
      }
    };

    void loadVideo();

    return () => {
      cancelled = true;
    };
  }, [selectedVideoGameId]);

  const selectedPlayer = useMemo(() => {
    return players.find((player) => player.id === selectedPlayerId) ?? null;
  }, [players, selectedPlayerId]);

  const formChartData = useMemo(() => {
    return filteredFormGames
      .slice()
      .reverse()
      .map((game) => ({
        label: formatDate(game.game_date),
        fg_percentage: game.fg_percentage,
        shots: game.shots,
        goals: game.goals,
      }));
  }, [filteredFormGames]);

  const fatigueChartData = useMemo(() => {
    return filteredFatigueGames
      .slice()
      .reverse()
      .map((game) => ({
        label: formatDate(game.game_date),
        play_time_percent: game.play_time_percent,
        degradation: game.performance_degradation,
      }));
  }, [filteredFatigueGames]);

  const latestFatigueGame = filteredFatigueGames[0] ?? fatigue?.fatigue_analysis?.[0] ?? null;

  const fatiguePeriodChart = useMemo(() => {
    return (latestFatigueGame?.period_performance || []).map((period) => ({
      label: `P${period.period}`,
      fg_percentage: period.fg_percentage,
      shots: period.shots,
    }));
  }, [latestFatigueGame]);

  const comparisonRadarData = useMemo(() => {
    if (!comparison?.player_stats || !comparison.league_averages) {
      return [];
    }

    return [
      {
        metric: 'Shots',
        player: comparison.player_stats.avg_shots_per_game,
        league: comparison.league_averages.avg_shots_per_game,
      },
      {
        metric: 'Goals',
        player: comparison.player_stats.avg_goals_per_game,
        league: comparison.league_averages.avg_goals_per_game,
      },
      {
        metric: 'FG%',
        player: comparison.player_stats.avg_fg_percentage,
        league: comparison.league_averages.avg_fg_percentage,
      },
      {
        metric: 'Distance',
        player: comparison.player_stats.avg_shot_distance,
        league: comparison.league_averages.avg_shot_distance,
      },
    ];
  }, [comparison]);

  const videoEventChartData = useMemo(() => {
    const counts = new Map<string, number>();
    videoEvents.forEach((event) => {
      counts.set(event.event_type, (counts.get(event.event_type) || 0) + 1);
    });

    return Array.from(counts.entries()).map(([eventType, count]) => ({
      event_type: eventType,
      count,
    }));
  }, [videoEvents]);

  const exportImage = async () => {
    if (!exportRef.current) return;

    setExporting('image');
    try {
      const canvas = await html2canvas(exportRef.current, {
        backgroundColor: '#f4f8fb',
        scale: 2,
      });

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `advanced-analytics-${selectedPlayerId || 'player'}.png`;
      link.click();
    } finally {
      setExporting(null);
    }
  };

  const exportPdf = async () => {
    if (!exportRef.current) return;

    setExporting('pdf');
    try {
      const canvas = await html2canvas(exportRef.current, {
        backgroundColor: '#f4f8fb',
        scale: 2,
      });

      const image = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(image, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`advanced-analytics-${selectedPlayerId || 'player'}.pdf`);
    } finally {
      setExporting(null);
    }
  };

  const summaryCards = [
    {
      label: 'Current Form',
      value: formTrends?.form_trend ? formTrends.form_trend.replace('_', ' ') : 'Unavailable',
      detail: formTrends?.message || `${formTrends?.games_analyzed || 0} games analyzed`,
    },
    {
      label: 'Latest Fatigue',
      value: latestFatigueGame?.fatigue_level || 'Unavailable',
      detail: latestFatigueGame ? `${latestFatigueGame.play_time_percent}% court time` : 'No fatigue sample in range',
    },
    {
      label: 'Predicted FG%',
      value: prediction?.predicted_fg_percentage !== undefined ? `${prediction.predicted_fg_percentage}%` : 'Unavailable',
      detail: prediction?.message || `Confidence ${prediction?.confidence_score || 0}%`,
    },
    {
      label: 'Vs League FG%',
      value: comparison?.comparison?.fg_vs_league !== undefined ? `${comparison.comparison.fg_vs_league > 0 ? '+' : ''}${comparison.comparison.fg_vs_league}%` : 'Unavailable',
      detail: comparison?.percentile_rank?.fg_percentage !== undefined ? `${comparison.percentile_rank.fg_percentage}th percentile` : 'Comparison unavailable',
    },
  ];

  return (
    <div className="advanced-analytics" ref={exportRef}>
      <section className="advanced-analytics__hero">
        <div>
          <h2>Advanced Analytics Dashboard</h2>
          <p>
            Track player form, fatigue, and upcoming performance in one place. Date filters apply to time-series views,
            while predictive endpoints continue to use the backend model&apos;s current historical window.
          </p>
        </div>
        <div className="advanced-analytics__actions">
          <button
            className="advanced-analytics__action-button"
            type="button"
            onClick={() => void exportImage()}
            disabled={exporting !== null || loading}
          >
            {exporting === 'image' ? 'Exporting image…' : 'Export Image'}
          </button>
          <button
            className="advanced-analytics__action-button"
            type="button"
            onClick={() => void exportPdf()}
            disabled={exporting !== null || loading}
          >
            {exporting === 'pdf' ? 'Exporting PDF…' : 'Export PDF'}
          </button>
        </div>
      </section>

      <section className="advanced-analytics__controls" aria-label="Advanced analytics filters">
        <div className="advanced-analytics__selector">
          <label htmlFor="advanced-analytics-player">Player selector</label>
          <select
            id="advanced-analytics-player"
            value={selectedPlayerId ?? ''}
            onChange={(event) => setSelectedPlayerId(event.target.value ? Number(event.target.value) : null)}
          >
            {players.length === 0 && <option value="">No players available</option>}
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {playerLabel(player)}
              </option>
            ))}
          </select>
        </div>

        <div className="advanced-analytics__filters">
          <label htmlFor="advanced-analytics-from">Date from</label>
          <input
            id="advanced-analytics-from"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </div>

        <div className="advanced-analytics__filters">
          <label htmlFor="advanced-analytics-to">Date to</label>
          <input
            id="advanced-analytics-to"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </div>
      </section>

      {selectedPlayer && (
        <p className="advanced-analytics__helper" data-testid="selected-player-label">
          Showing analytics for {playerLabel(selectedPlayer)}.
        </p>
      )}

      {error && (
        <div className="advanced-analytics__error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="advanced-analytics__status">Loading advanced analytics…</div>
      ) : (
        <>
          <section className="advanced-analytics__summary-grid" aria-label="Advanced analytics summary">
            {summaryCards.map((card) => (
              <article className="advanced-analytics__summary-card" key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <small>{card.detail}</small>
              </article>
            ))}
          </section>

          <section className="advanced-analytics__tabs" aria-label="Advanced analytics tabs">
            {[
              { id: 'form', label: 'Form Trends' },
              { id: 'fatigue', label: 'Fatigue' },
              { id: 'predictions', label: 'Predictions' },
              { id: 'video', label: 'Video' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`advanced-analytics__tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id as AnalyticsTab)}
              >
                {tab.label}
              </button>
            ))}
          </section>

          {activeTab === 'form' && (
            <section className="advanced-analytics__tab-panel" aria-label="Form trends panel">
              <h3>Form Trends</h3>
              {filteredFormGames.length === 0 ? (
                <p className="advanced-analytics__empty">No form-trend games match the selected date range.</p>
              ) : (
                <div className="advanced-analytics__chart-grid">
                  <article className="advanced-analytics__chart-card">
                    <h3>Field Goal Trend</h3>
                    <div className="advanced-analytics__chart-shell">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={formChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="fg_percentage" stroke="#1f6f78" strokeWidth={3} name="FG%" />
                          <Line type="monotone" dataKey="shots" stroke="#f6bd60" strokeWidth={2} name="Shots" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </article>

                  <article className="advanced-analytics__list-card">
                    <h3>Recent Games</h3>
                    <ul className="advanced-analytics__list">
                      {filteredFormGames.map((game) => (
                        <li key={game.game_id}>
                          <div className="advanced-analytics__list-title">
                            <strong>{formatDate(game.game_date)}</strong>
                            <span>{game.fg_percentage}% FG</span>
                          </div>
                          <div>{game.goals} goals from {game.shots} shots</div>
                          <div className="advanced-analytics__tag-row">
                            <span className="advanced-analytics__tag">Avg distance {game.avg_distance}m</span>
                            <span className="advanced-analytics__tag">Game #{game.game_id}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </article>
                </div>
              )}
            </section>
          )}

          {activeTab === 'fatigue' && (
            <section className="advanced-analytics__tab-panel" aria-label="Fatigue panel">
              <h3>Fatigue Analysis</h3>
              {filteredFatigueGames.length === 0 ? (
                <p className="advanced-analytics__empty">No fatigue samples match the selected date range.</p>
              ) : (
                <div className="advanced-analytics__chart-grid">
                  <article className="advanced-analytics__chart-card">
                    <h3>Court Load vs Degradation</h3>
                    <div className="advanced-analytics__chart-shell">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={fatigueChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="play_time_percent" fill="#1f6f78" name="Play time %" />
                          <Bar dataKey="degradation" fill="#d1495b" name="Performance degradation" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </article>

                  <article className="advanced-analytics__chart-card">
                    <h3>Latest In-Game Split</h3>
                    {fatiguePeriodChart.length === 0 ? (
                      <p className="advanced-analytics__empty">No period splits available.</p>
                    ) : (
                      <div className="advanced-analytics__chart-shell">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={fatiguePeriodChart}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="label" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="fg_percentage" stroke="#d1495b" strokeWidth={3} name="FG%" />
                            <Line type="monotone" dataKey="shots" stroke="#edae49" strokeWidth={2} name="Shots" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </article>

                  <article className="advanced-analytics__list-card">
                    <h3>Fatigue Samples</h3>
                    <ul className="advanced-analytics__list">
                      {filteredFatigueGames.map((game) => (
                        <li key={game.game_id}>
                          <div className="advanced-analytics__list-title">
                            <strong>{formatDate(game.game_date)}</strong>
                            <span>{game.fatigue_level}</span>
                          </div>
                          <div>{game.play_time_minutes} minutes played</div>
                          <div className="advanced-analytics__tag-row">
                            <span className="advanced-analytics__tag">Court load {game.play_time_percent}%</span>
                            <span className="advanced-analytics__tag">Degradation {game.performance_degradation}%</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </article>
                </div>
              )}
            </section>
          )}

          {activeTab === 'predictions' && (
            <section className="advanced-analytics__tab-panel" aria-label="Predictions panel">
              <h3>Predictions and Benchmarks</h3>
              <p className="advanced-analytics__insight-note">
                Prediction and comparison cards are generated from the backend prediction model and the current historical window.
              </p>

              <div className="advanced-analytics__comparison-grid">
                <article className="advanced-analytics__chart-card">
                  <h3>Player vs League Radar</h3>
                  {comparisonRadarData.length === 0 ? (
                    <p className="advanced-analytics__empty">League comparison data is unavailable for this player.</p>
                  ) : (
                    <div className="advanced-analytics__chart-shell">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={comparisonRadarData}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="metric" />
                          <PolarRadiusAxis />
                          <Radar dataKey="player" stroke="#1f6f78" fill="#1f6f78" fillOpacity={0.35} name="Player" />
                          <Radar dataKey="league" stroke="#d1495b" fill="#d1495b" fillOpacity={0.2} name="League" />
                          <Legend />
                          <Tooltip />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </article>

                <article className="advanced-analytics__list-card">
                  <h3>Prediction Summary</h3>
                  {prediction?.prediction === 'insufficient_data' ? (
                    <p className="advanced-analytics__empty">{prediction.message || 'Not enough data for prediction.'}</p>
                  ) : (
                    <ul className="advanced-analytics__list">
                      <li>
                        <div className="advanced-analytics__list-title">
                          <strong>Next game output</strong>
                          <span>{prediction?.predicted_fg_percentage ?? 0}% FG</span>
                        </div>
                        <div>{prediction?.predicted_goals ?? 0} projected goals from {prediction?.predicted_shots ?? 0} shots</div>
                      </li>
                      <li>
                        <div className="advanced-analytics__list-title">
                          <strong>Historical baseline</strong>
                          <span>{prediction?.historical_avg?.fg_percentage ?? 0}% FG</span>
                        </div>
                        <div>{prediction?.historical_avg?.goals_per_game ?? 0} goals per game</div>
                      </li>
                      <li>
                        <div className="advanced-analytics__list-title">
                          <strong>Model adjustments</strong>
                          <span>{prediction?.confidence_score ?? 0}% confidence</span>
                        </div>
                        <div className="advanced-analytics__tag-row">
                          <span className="advanced-analytics__tag">Form {prediction?.adjustments?.form_adjustment ?? 0}%</span>
                          <span className="advanced-analytics__tag">Matchup {prediction?.adjustments?.matchup_adjustment ?? 0}%</span>
                        </div>
                      </li>
                    </ul>
                  )}
                </article>
              </div>
            </section>
          )}

          {activeTab === 'video' && (
            <section className="advanced-analytics__tab-panel" aria-label="Video panel">
              <div className="advanced-analytics__video-toolbar">
                <div>
                  <h3>Video Insights</h3>
                  <p className="advanced-analytics__helper">Video uses the most recent filtered game with linked footage or auto-identified highlights.</p>
                </div>
                <div className="advanced-analytics__selector">
                  <label htmlFor="advanced-analytics-video-game">Analyzed game</label>
                  <select
                    id="advanced-analytics-video-game"
                    className="advanced-analytics__video-select"
                    value={selectedVideoGameId ?? ''}
                    onChange={(event) => setSelectedVideoGameId(event.target.value ? Number(event.target.value) : null)}
                    disabled={availableVideoGameIds.length === 0}
                  >
                    {availableVideoGameIds.length === 0 && <option value="">No recent games</option>}
                    {availableVideoGameIds.map((gameId) => (
                      <option key={gameId} value={gameId}>Game #{gameId}</option>
                    ))}
                  </select>
                </div>
              </div>

              {videoLoading ? (
                <div className="advanced-analytics__status">Loading video insights…</div>
              ) : availableVideoGameIds.length === 0 ? (
                <p className="advanced-analytics__empty">No recent games are available for video analysis within the selected date range.</p>
              ) : (
                <div className="advanced-analytics__video-grid">
                  <article className="advanced-analytics__video-card">
                    <h3>Highlight Reel</h3>
                    <div className="advanced-analytics__video-meta">
                      <span>{videoHighlights?.total_clips || 0} clips</span>
                      <span>{videoHighlights?.reel_metadata?.suggested_total_duration || 0}s suggested duration</span>
                    </div>
                    <div className="advanced-analytics__tag-row">
                      {(videoHighlights?.marked_highlights || []).map((highlight, index) => (
                        <span className="advanced-analytics__tag" key={`marked-${highlight.event_id || index}`}>
                          {highlight.event_type}
                        </span>
                      ))}
                    </div>
                    <ul className="advanced-analytics__list">
                      {[...(videoHighlights?.marked_highlights || []), ...(videoHighlights?.auto_identified_highlights || [])]
                        .slice(0, 6)
                        .map((highlight, index) => (
                          <li className="advanced-analytics__video-highlight" key={`highlight-${highlight.event_id || index}`}>
                            <div className="advanced-analytics__video-title">
                              <strong>{highlight.description || highlight.event_type}</strong>
                              <span>{clipDuration(highlight)}</span>
                            </div>
                            <div className="advanced-analytics__tag-row">
                              <span className="advanced-analytics__tag">{highlight.priority || 'standard'}</span>
                              <span className="advanced-analytics__tag">{highlight.event_type}</span>
                            </div>
                          </li>
                        ))}
                    </ul>
                  </article>

                  <article className="advanced-analytics__video-card">
                    <h3>Tagged Events</h3>
                    {videoEventChartData.length > 0 && (
                      <div className="advanced-analytics__chart-shell">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={videoEventChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="event_type" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="count" fill="#1f6f78" name="Tagged events" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {videoEvents.length === 0 ? (
                      <p className="advanced-analytics__empty">No linked video events were found for this game.</p>
                    ) : (
                      <ul className="advanced-analytics__list">
                        {videoEvents.slice(0, 5).map((event, index) => (
                          <li className="advanced-analytics__video-event" key={`event-${event.id || event.event_id || index}`}>
                            <div className="advanced-analytics__video-title">
                              <strong>{event.description || event.event_type}</strong>
                              <span>{clipDuration(event)}</span>
                            </div>
                            <div className="advanced-analytics__tag-row">
                              <span className="advanced-analytics__tag">{event.event_type}</span>
                              {event.is_highlight && <span className="advanced-analytics__tag">highlight</span>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default AdvancedAnalytics;