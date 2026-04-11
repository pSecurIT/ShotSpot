import React from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TeamMomentumResponse } from '../types/team-analytics';

type MomentumChartProps = {
  momentum: TeamMomentumResponse;
};

const formatDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const MomentumChart: React.FC<MomentumChartProps> = ({ momentum }) => {
  return (
    <section className="team-analytics__section" aria-labelledby="team-analytics-momentum">
      <div className="team-analytics__section-heading">
        <div>
          <h2 id="team-analytics-momentum">Momentum Tracking</h2>
          <p>Form and shot quality over the last completed matches.</p>
        </div>
      </div>

      <div className="team-analytics__cards">
        <article className="team-analytics__card">
          <span className="team-analytics__card-label">Current Streak</span>
          <strong>{momentum.summary.current_streak || 'N/A'}</strong>
          <span>Based on latest completed matches</span>
        </article>
        <article className="team-analytics__card">
          <span className="team-analytics__card-label">Last Five Record</span>
          <strong>{momentum.summary.last_five_record}</strong>
          <span>{momentum.summary.last_five_points} points collected</span>
        </article>
        <article className="team-analytics__card">
          <span className="team-analytics__card-label">Average Momentum</span>
          <strong>{momentum.summary.average_momentum.toFixed(1)}</strong>
          <span>Higher values indicate stronger recent form</span>
        </article>
      </div>

      <article className="team-analytics__panel team-analytics__panel--chart">
        {momentum.trend.length === 0 ? (
          <p className="team-analytics__empty" role="status" aria-live="polite">No recent matches available to chart momentum.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={momentum.trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="game_date" tickFormatter={formatDate} />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
              <Tooltip labelFormatter={(label) => formatDate(String(label))} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="momentum_score" stroke="#0f766e" strokeWidth={3} name="Momentum" />
              <Line yAxisId="right" type="monotone" dataKey="fg_percentage" stroke="#d97706" strokeWidth={2} name="FG%" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </article>
    </section>
  );
};

export default MomentumChart;