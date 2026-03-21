import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import FormTrends, { FormTrendTooltip } from '../components/FormTrends';

vi.mock('recharts', () => {
  const passthrough = (name: string) => {
    const Component = ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': name }, children);
    Component.displayName = name;
    return Component;
  };

  const Tooltip = ({ content }: { content?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'Tooltip' }, content);
  Tooltip.displayName = 'Tooltip';

  return {
    ResponsiveContainer: passthrough('ResponsiveContainer'),
    LineChart: passthrough('LineChart'),
    Line: passthrough('Line'),
    CartesianGrid: passthrough('CartesianGrid'),
    Legend: passthrough('Legend'),
    XAxis: passthrough('XAxis'),
    YAxis: passthrough('YAxis'),
    ReferenceArea: passthrough('ReferenceArea'),
    Tooltip,
  };
});

const games = [
  { game_id: 100, game_date: '2026-03-20T12:00:00.000Z', shots: 10, goals: 8, fg_percentage: 80, avg_distance: 5.4 },
  { game_id: 99, game_date: '2026-03-18T12:00:00.000Z', shots: 12, goals: 8, fg_percentage: 66.7, avg_distance: 5.9 },
  { game_id: 98, game_date: '2026-03-14T12:00:00.000Z', shots: 9, goals: 4, fg_percentage: 44.4, avg_distance: 6.5 },
  { game_id: 97, game_date: '2026-03-10T12:00:00.000Z', shots: 7, goals: 2, fg_percentage: 28.6, avg_distance: 6.8 },
  { game_id: 96, game_date: '2026-03-06T12:00:00.000Z', shots: 8, goals: 5, fg_percentage: 62.5, avg_distance: 5.1 },
  { game_id: 95, game_date: '2026-03-02T12:00:00.000Z', shots: 11, goals: 7, fg_percentage: 63.6, avg_distance: 5.7 },
  { game_id: 94, game_date: '2026-02-26T12:00:00.000Z', shots: 6, goals: 4, fg_percentage: 66.7, avg_distance: 5.4 },
  { game_id: 93, game_date: '2026-02-20T12:00:00.000Z', shots: 10, goals: 7, fg_percentage: 70, avg_distance: 5.2 },
  { game_id: 92, game_date: '2026-02-17T12:00:00.000Z', shots: 8, goals: 6, fg_percentage: 75, avg_distance: 4.9 },
  { game_id: 91, game_date: '2026-02-12T12:00:00.000Z', shots: 8, goals: 5, fg_percentage: 62.5, avg_distance: 5.1 },
  { game_id: 90, game_date: '2026-02-08T12:00:00.000Z', shots: 9, goals: 5, fg_percentage: 55.6, avg_distance: 5.8 },
  { game_id: 89, game_date: '2026-02-05T12:00:00.000Z', shots: 7, goals: 3, fg_percentage: 42.9, avg_distance: 6.2 },
];

describe('FormTrends', () => {
  it('renders chart and controls', () => {
    render(<FormTrends games={games} />);

    expect(screen.getByText('Form Trends')).toBeInTheDocument();
    expect(screen.getByLabelText('Time window')).toBeInTheDocument();
    expect(screen.getByLabelText('Metric')).toBeInTheDocument();
    expect(screen.getByTestId('LineChart')).toBeInTheDocument();
  });

  it('supports adjustable time windows and metric selector', () => {
    render(<FormTrends games={games} />);

    expect(screen.getByText('Showing last 10 of 12 games.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Time window'), { target: { value: '5' } });
    expect(screen.getByText('Showing last 5 of 12 games.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Metric'), { target: { value: 'points' } });
    expect(screen.getAllByText('Metric: 8.0').length).toBeGreaterThan(0);
  });

  it('shows trend indicator and color-coded hot/cold zones', () => {
    render(<FormTrends games={games} />);

    expect(screen.getByLabelText('Trend indicator')).toHaveTextContent(/Trend:/i);
    expect(screen.getByLabelText('Color-coded zones')).toBeInTheDocument();
    expect(screen.getByText('Hot zone')).toBeInTheDocument();
    expect(screen.getByText('Cold zone')).toBeInTheDocument();
  });

  it('renders empty state when there are no games', () => {
    render(<FormTrends games={[]} />);

    expect(screen.getByText('No form-trend games match the selected date range.')).toBeInTheDocument();
  });

  it('renders detailed tooltip content', () => {
    render(
      <FormTrendTooltip
        active
        metricLabel="FG%"
        label="3/20/2026"
        payload={[
          {
            payload: {
              game_id: 100,
              game_date: '2026-03-20T12:00:00.000Z',
              label: '3/20/2026',
              shots: 10,
              goals: 8,
              fg_percentage: 80,
              avg_distance: 5.4,
              points: 8,
              efficiency: 1.4,
              metric_value: 80,
              zone: 'hot',
            },
          },
        ]}
      />
    );

    expect(screen.getByText('Game #100')).toBeInTheDocument();
    expect(screen.getByText('FG%: 80.00')).toBeInTheDocument();
    expect(screen.getByText('Shots: 10')).toBeInTheDocument();
    expect(screen.getByText('Goals: 8')).toBeInTheDocument();
    expect(screen.getByText('Avg distance: 5.4m')).toBeInTheDocument();
  });
});