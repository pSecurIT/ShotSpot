import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import api from '../utils/api';
import { advancedAnalyticsApi } from '../services/advancedAnalyticsApi';
import FormTrends from './FormTrends';
import PredictionsPanel from './PredictionsPanel';
import VideoLinkEditor from './VideoLinkEditor';
import type {
  AnalyticsPlayerOption,
  FatigueGameAnalysis,
  FatigueResponse,
  FormTrendsResponse,
  NextGamePredictionResponse,
  PlayerComparisonResponse,
  VideoEvent,
  VideoHighlightsResponse,
} from '../types/advanced-analytics';
import '../styles/AdvancedAnalytics.css';

type AnalyticsTab = 'form' | 'fatigue' | 'predictions' | 'video';

const RECENT_GAME_LIMIT = 20;

const buildDateFilters = (startDate: string, endDate: string) => ({
  startDate,
  endDate,
});

const formatDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
};

const toInputDate = (value: Date): string => value.toISOString().slice(0, 10);

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

const readThemeVariable = (name: string, fallback: string): string => {
  if (typeof window === 'undefined') return fallback;
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
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
          advancedAnalyticsApi.formTrends(selectedPlayerId, RECENT_GAME_LIMIT, buildDateFilters(dateFrom, dateTo)),
          advancedAnalyticsApi.fatigue(selectedPlayerId, buildDateFilters(dateFrom, dateTo)),
          advancedAnalyticsApi.nextGame(selectedPlayerId, buildDateFilters(dateFrom, dateTo)),
          advancedAnalyticsApi.playerComparison(selectedPlayerId, RECENT_GAME_LIMIT, buildDateFilters(dateFrom, dateTo)),
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
  }, [dateFrom, dateTo, selectedPlayerId]);

  const filteredFormGames = useMemo(() => {
    return formTrends?.recent_games || [];
  }, [formTrends]);

  const filteredFatigueGames = useMemo<FatigueGameAnalysis[]>(() => {
    return fatigue?.fatigue_analysis || [];
  }, [fatigue]);

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
      const backgroundColor = readThemeVariable('--surface-canvas', '#f4f8fb');
      const canvas = await html2canvas(exportRef.current, {
        backgroundColor,
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
      const backgroundColor = readThemeVariable('--surface-canvas', '#f4f8fb');
      const canvas = await html2canvas(exportRef.current, {
        backgroundColor,
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
            Track player form, fatigue, and upcoming performance in one place. Date filters are sent to the analytics
            endpoints so every chart and benchmark reflects the selected analysis window.
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
        <div className="advanced-analytics__status" role="status" aria-live="polite">Loading advanced analytics…</div>
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

          <section className="advanced-analytics__tabs" role="tablist" aria-label="Advanced analytics tabs">
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
                role="tab"
                id={`advanced-analytics-tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls={`advanced-analytics-panel-${tab.id}`}
                tabIndex={activeTab === tab.id ? 0 : -1}
              >
                {tab.label}
              </button>
            ))}
          </section>

          {activeTab === 'form' && (
            <section
              id="advanced-analytics-panel-form"
              className="advanced-analytics__tab-panel"
              role="tabpanel"
              aria-labelledby="advanced-analytics-tab-form"
            >
              <FormTrends games={filteredFormGames} />
            </section>
          )}

          {activeTab === 'fatigue' && (
            <section
              id="advanced-analytics-panel-fatigue"
              className="advanced-analytics__tab-panel"
              role="tabpanel"
              aria-labelledby="advanced-analytics-tab-fatigue"
            >
              <h3>Fatigue Analysis</h3>
              {filteredFatigueGames.length === 0 ? (
                <p className="advanced-analytics__empty" role="status" aria-live="polite">No fatigue samples match the selected date range.</p>
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
                          <Bar dataKey="play_time_percent" fill="var(--chart-series-1)" name="Play time %" />
                          <Bar dataKey="degradation" fill="var(--chart-series-2)" name="Performance degradation" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </article>

                  <article className="advanced-analytics__chart-card">
                    <h3>Latest In-Game Split</h3>
                    {fatiguePeriodChart.length === 0 ? (
                      <p className="advanced-analytics__empty" role="status" aria-live="polite">No period splits available.</p>
                    ) : (
                      <div className="advanced-analytics__chart-shell">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={fatiguePeriodChart}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="label" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="fg_percentage" stroke="var(--chart-series-2)" strokeWidth={3} name="FG%" />
                            <Line type="monotone" dataKey="shots" stroke="var(--chart-series-4)" strokeWidth={2} name="Shots" />
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
            <section
              id="advanced-analytics-panel-predictions"
              className="advanced-analytics__tab-panel"
              role="tabpanel"
              aria-labelledby="advanced-analytics-tab-predictions"
            >
              <PredictionsPanel
                prediction={prediction}
                comparison={comparison}
                latestFatigue={latestFatigueGame}
              />
            </section>
          )}

          {activeTab === 'video' && (
            <section
              id="advanced-analytics-panel-video"
              className="advanced-analytics__tab-panel"
              role="tabpanel"
              aria-labelledby="advanced-analytics-tab-video"
            >
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

              {selectedVideoGameId && (
                <VideoLinkEditor gameId={selectedVideoGameId} />
              )}

              {videoLoading ? (
                <div className="advanced-analytics__status" role="status" aria-live="polite">Loading video insights…</div>
              ) : availableVideoGameIds.length === 0 ? (
                <p className="advanced-analytics__empty" role="status" aria-live="polite">No recent games are available for video analysis within the selected date range.</p>
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
                            <Bar dataKey="count" fill="var(--chart-series-1)" name="Tagged events" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {videoEvents.length === 0 ? (
                      <p className="advanced-analytics__empty" role="status" aria-live="polite">No linked video events were found for this game.</p>
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