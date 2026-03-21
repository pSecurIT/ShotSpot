import React, { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { FormTrendGame } from '../types/advanced-analytics';
import '../styles/FormTrends.css';

type MetricType = 'fg' | 'points' | 'efficiency';

type TrendStatus = 'improving' | 'declining' | 'stable';

type FormTrendsProps = {
  games: FormTrendGame[];
};

type TooltipPayloadPoint = {
  payload: FormTrendChartPoint;
};

type FormTrendTooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadPoint[];
  label?: string;
  metricLabel: string;
};

type FormTrendChartPoint = {
  game_id: number;
  game_date: string;
  label: string;
  shots: number;
  goals: number;
  fg_percentage: number;
  avg_distance: number;
  points: number;
  efficiency: number;
  metric_value: number;
  zone: 'hot' | 'cold' | 'neutral';
};

const WINDOW_OPTIONS = [5, 10, 15] as const;

const METRIC_OPTIONS: Array<{ key: MetricType; label: string; format: (value: number) => string }> = [
  { key: 'fg', label: 'FG%', format: (value) => `${value.toFixed(1)}%` },
  { key: 'points', label: 'Points', format: (value) => value.toFixed(1) },
  { key: 'efficiency', label: 'Efficiency', format: (value) => value.toFixed(2) },
];

const formatDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
};

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[index];
};

const determineTrend = (values: number[], metric: MetricType): TrendStatus => {
  if (values.length < 2) return 'stable';

  const n = values.length;
  const xValues = values.map((_, index) => index);
  const sumX = xValues.reduce((sum, value) => sum + value, 0);
  const sumY = values.reduce((sum, value) => sum + value, 0);
  const sumXY = xValues.reduce((sum, x, index) => sum + x * values[index], 0);
  const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;

  const epsilonByMetric: Record<MetricType, number> = {
    fg: 1,
    points: 0.2,
    efficiency: 0.15,
  };

  const epsilon = epsilonByMetric[metric];

  if (Math.abs(slope) <= epsilon) return 'stable';
  return slope > 0 ? 'improving' : 'declining';
};

const trendToneClass: Record<TrendStatus, string> = {
  improving: 'form-trends__trend--improving',
  declining: 'form-trends__trend--declining',
  stable: 'form-trends__trend--stable',
};

const zoneToneClass: Record<'hot' | 'cold' | 'neutral', string> = {
  hot: 'form-trends__zone--hot',
  cold: 'form-trends__zone--cold',
  neutral: 'form-trends__zone--neutral',
};

export const FormTrendTooltip: React.FC<FormTrendTooltipProps> = ({ active, payload, label, metricLabel }) => {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0].payload;

  return (
    <div className="form-trends__tooltip">
      <strong>{label || point.label}</strong>
      <div>Game #{point.game_id}</div>
      <div>{metricLabel}: {point.metric_value.toFixed(2)}</div>
      <div>Shots: {point.shots}</div>
      <div>Goals: {point.goals}</div>
      <div>FG%: {point.fg_percentage.toFixed(1)}%</div>
      <div>Avg distance: {point.avg_distance.toFixed(1)}m</div>
    </div>
  );
};

const FormTrends: React.FC<FormTrendsProps> = ({ games }) => {
  const [windowSize, setWindowSize] = useState<number>(10);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('fg');

  const metricMeta = METRIC_OPTIONS.find((option) => option.key === selectedMetric) || METRIC_OPTIONS[0];

  const recentGames = useMemo(() => {
    return games.slice(0, windowSize);
  }, [games, windowSize]);

  const metricValues = useMemo(() => {
    return recentGames.map((game) => {
      if (selectedMetric === 'fg') return game.fg_percentage;
      if (selectedMetric === 'points') return game.goals;

      const misses = Math.max(0, game.shots - game.goals);
      return parseFloat(((game.goals * 2 - misses) / Math.max(game.shots, 1)).toFixed(2));
    });
  }, [recentGames, selectedMetric]);

  const hotThreshold = useMemo(() => percentile(metricValues, 75), [metricValues]);
  const coldThreshold = useMemo(() => percentile(metricValues, 25), [metricValues]);

  const chartData = useMemo<FormTrendChartPoint[]>(() => {
    return recentGames
      .map((game) => {
        const misses = Math.max(0, game.shots - game.goals);
        const efficiency = parseFloat(((game.goals * 2 - misses) / Math.max(game.shots, 1)).toFixed(2));
        const metricValue = selectedMetric === 'fg'
          ? game.fg_percentage
          : selectedMetric === 'points'
            ? game.goals
            : efficiency;

        const zone: 'hot' | 'cold' | 'neutral' = metricValue >= hotThreshold
          ? 'hot'
          : metricValue <= coldThreshold
            ? 'cold'
            : 'neutral';

        return {
          ...game,
          label: formatDate(game.game_date),
          points: game.goals,
          efficiency,
          metric_value: metricValue,
          zone,
        };
      })
      .reverse();
  }, [coldThreshold, hotThreshold, recentGames, selectedMetric]);

  const trend = useMemo(() => {
    const chronologicalValues = [...metricValues].reverse();
    return determineTrend(chronologicalValues, selectedMetric);
  }, [metricValues, selectedMetric]);

  const trendLabel = trend.charAt(0).toUpperCase() + trend.slice(1);

  if (games.length === 0) {
    return (
      <div className="form-trends form-trends--empty">
        <h3>Form Trends</h3>
        <p className="advanced-analytics__empty">No form-trend games match the selected date range.</p>
      </div>
    );
  }

  const maxMetric = Math.max(...chartData.map((point) => point.metric_value), hotThreshold, coldThreshold, 1);
  const minMetric = Math.min(...chartData.map((point) => point.metric_value), hotThreshold, coldThreshold, 0);

  return (
    <div className="form-trends" aria-label="Form trends visualization">
      <div className="form-trends__header-row">
        <h3>Form Trends</h3>
        <div className={`form-trends__trend ${trendToneClass[trend]}`} role="status" aria-label="Trend indicator">
          Trend: {trendLabel}
        </div>
      </div>

      <div className="form-trends__controls">
        <label htmlFor="form-trends-window">
          Time window
          <select
            id="form-trends-window"
            value={windowSize}
            onChange={(event) => setWindowSize(Number(event.target.value))}
          >
            {WINDOW_OPTIONS.map((option) => (
              <option key={option} value={option}>Last {option} games</option>
            ))}
          </select>
        </label>

        <label htmlFor="form-trends-metric">
          Metric
          <select
            id="form-trends-metric"
            value={selectedMetric}
            onChange={(event) => setSelectedMetric(event.target.value as MetricType)}
          >
            {METRIC_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="form-trends__summary">Showing last {recentGames.length} of {games.length} games.</p>

      <div className="form-trends__chart-shell">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <ReferenceArea y1={hotThreshold} y2={maxMetric} fill="rgba(245, 124, 0, 0.12)" />
            <ReferenceArea y1={minMetric} y2={coldThreshold} fill="rgba(30, 136, 229, 0.12)" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip content={<FormTrendTooltip metricLabel={metricMeta.label} />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="metric_value"
              stroke="#1f6f78"
              strokeWidth={3}
              name={metricMeta.label}
              dot={(dotProps: { cx?: number; cy?: number; payload?: FormTrendChartPoint }) => {
                if (!dotProps.payload) return null;

                const color = dotProps.payload.zone === 'hot'
                  ? '#ef6c00'
                  : dotProps.payload.zone === 'cold'
                    ? '#1e88e5'
                    : '#607d8b';

                return (
                  <circle
                    cx={dotProps.cx}
                    cy={dotProps.cy}
                    r={5}
                    stroke="#ffffff"
                    strokeWidth={2}
                    fill={color}
                  />
                );
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="form-trends__zone-legend" aria-label="Color-coded zones">
        <span className="form-trends__zone form-trends__zone--hot">Hot zone</span>
        <span className="form-trends__zone form-trends__zone--neutral">Neutral zone</span>
        <span className="form-trends__zone form-trends__zone--cold">Cold zone</span>
      </div>

      <div className="form-trends__list-card">
        <h3>Recent Games</h3>
        <ul className="form-trends__list">
          {[...recentGames].map((game) => {
            const misses = Math.max(0, game.shots - game.goals);
            const efficiency = parseFloat(((game.goals * 2 - misses) / Math.max(game.shots, 1)).toFixed(2));
            const metricValue = selectedMetric === 'fg'
              ? game.fg_percentage
              : selectedMetric === 'points'
                ? game.goals
                : efficiency;
            const zone: 'hot' | 'cold' | 'neutral' = metricValue >= hotThreshold
              ? 'hot'
              : metricValue <= coldThreshold
                ? 'cold'
                : 'neutral';

            return (
              <li key={game.game_id}>
                <div className="form-trends__list-title">
                  <strong>{formatDate(game.game_date)}</strong>
                  <span className={`form-trends__zone ${zoneToneClass[zone]}`}>{zone}</span>
                </div>
                <div>{game.goals} goals from {game.shots} shots</div>
                <div className="form-trends__stats">
                  <span>Metric: {metricMeta.format(metricValue)}</span>
                  <span>FG%: {game.fg_percentage.toFixed(1)}%</span>
                  <span>Distance: {game.avg_distance.toFixed(1)}m</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default FormTrends;