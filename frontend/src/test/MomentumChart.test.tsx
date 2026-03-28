import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MomentumChart from '../components/MomentumChart';
import type { TeamMomentumResponse } from '../types/team-analytics';

vi.mock('recharts', () => {
  const passthrough = (name: string) => {
    const Component = ({ children }: { children?: React.ReactNode }) => React.createElement('div', { 'data-testid': name }, children);
    Component.displayName = name;
    return Component;
  };

  return {
    ResponsiveContainer: passthrough('ResponsiveContainer'),
    CartesianGrid: passthrough('CartesianGrid'),
    Legend: passthrough('Legend'),
    Line: passthrough('Line'),
    LineChart: passthrough('LineChart'),
    Tooltip: passthrough('Tooltip'),
    XAxis: passthrough('XAxis'),
    YAxis: passthrough('YAxis'),
  };
});

const baseMomentum: TeamMomentumResponse = {
  team: { id: 4, name: 'U19 A', club_id: 2, club_name: 'Falcons', season_id: 10 },
  season: { id: 10, name: '2025-2026', start_date: '2025-09-01', end_date: '2026-05-31', is_active: true },
  scope_mode: 'team',
  trend: [
    {
      game_id: 31,
      game_date: '2026-03-01T12:00:00.000Z',
      opponent_name: 'Ravens',
      venue: 'home',
      result: 'W',
      goals_for: 12,
      goals_against: 9,
      goal_difference: 3,
      shots: 14,
      goals: 12,
      fg_percentage: 85.7,
      momentum_score: 74,
      rolling_fg_percentage: 62.5,
      rolling_points_per_game: 1.8,
    },
  ],
  summary: { current_streak: 'W3', last_five_record: '3-1-1', last_five_points: 7, average_momentum: 68.3 },
};

describe('MomentumChart', () => {
  it('renders summary cards', () => {
    render(<MomentumChart momentum={baseMomentum} />);

    expect(screen.getByText('Current Streak')).toBeInTheDocument();
    expect(screen.getByText('W3')).toBeInTheDocument();
    expect(screen.getByText('3-1-1')).toBeInTheDocument();
    expect(screen.getByText('68.3')).toBeInTheDocument();
  });

  it('renders chart when trend data exists', () => {
    render(<MomentumChart momentum={baseMomentum} />);

    expect(screen.getByTestId('ResponsiveContainer')).toBeInTheDocument();
    expect(screen.getByTestId('LineChart')).toBeInTheDocument();
    expect(screen.getAllByTestId('Line')).toHaveLength(2);
  });

  it('shows empty message when trend data is empty', () => {
    render(<MomentumChart momentum={{ ...baseMomentum, trend: [] }} />);

    expect(screen.getByText('No recent matches available to chart momentum.')).toBeInTheDocument();
    expect(screen.queryByTestId('LineChart')).not.toBeInTheDocument();
  });

  it('shows N/A when current streak is empty', () => {
    render(<MomentumChart momentum={{ ...baseMomentum, summary: { ...baseMomentum.summary, current_streak: '' } }} />);

    expect(screen.getByText('N/A')).toBeInTheDocument();
  });
});
