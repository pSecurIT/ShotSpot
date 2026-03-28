import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SeasonOverview from '../components/SeasonOverview';
import type { TeamAnalyticsOverviewResponse } from '../types/team-analytics';

const baseOverview: TeamAnalyticsOverviewResponse = {
  team: { id: 4, name: 'U19 A', club_id: 2, club_name: 'Falcons', season_id: 10 },
  season: { id: 10, name: '2025-2026', start_date: '2025-09-01', end_date: '2026-05-31', is_active: true },
  scope_mode: 'team',
  record: { games_played: 8, wins: 5, losses: 2, draws: 1, points: 11, win_percentage: 62.5 },
  scoring: {
    total_shots: 98,
    total_goals: 56,
    fg_percentage: 57.1,
    goals_for: 83,
    goals_against: 69,
    goal_difference: 14,
    avg_goals_for: 10.38,
    avg_goals_against: 8.63,
    avg_goal_difference: 1.75,
  },
  top_scorers: [
    { player_id: 12, player_name: 'Alex Arrow', jersey_number: 9, goals: 18, shots: 29, fg_percentage: 62.1 },
  ],
  period_breakdown: [
    { period: 1, goals: 14, shots: 25, fg_percentage: 56.0 },
  ],
  previous_season_comparison: {
    season: { id: 11, name: '2024-2025', start_date: '2024-09-01', end_date: '2025-05-31', is_active: false },
    record: { games_played: 7, wins: 4, losses: 3, draws: 0, points: 8, win_percentage: 57.1 },
    scoring: {
      total_shots: 90,
      total_goals: 46,
      fg_percentage: 51.1,
      goals_for: 74,
      goals_against: 72,
      goal_difference: 2,
      avg_goals_for: 10.57,
      avg_goals_against: 10.29,
      avg_goal_difference: 0.29,
    },
    deltas: { win_percentage: 5.4, goals_for_per_game: -0.2, fg_percentage: 6.0, goal_difference_per_game: 1.46 },
  },
};

describe('SeasonOverview', () => {
  it('renders scorer and period sections', () => {
    render(<SeasonOverview overview={baseOverview} />);

    expect(screen.getByText(/Alex Arrow/)).toBeInTheDocument();
    expect(screen.getByText('P1')).toBeInTheDocument();
  });

  it('shows no-data messages for empty scorers and periods', () => {
    render(
      <SeasonOverview
        overview={{
          ...baseOverview,
          top_scorers: [],
          period_breakdown: [],
        }}
      />,
    );

    expect(screen.getByText('No scorer data available for this season.')).toBeInTheDocument();
    expect(screen.getByText('No period data available for this season.')).toBeInTheDocument();
  });

  it('shows no previous baseline message when comparison is null', () => {
    render(
      <SeasonOverview
        overview={{
          ...baseOverview,
          previous_season_comparison: null,
        }}
      />,
    );

    expect(screen.getByText('No previous-season baseline is available yet.')).toBeInTheDocument();
  });

  it('formats signed delta values in previous season comparison', () => {
    render(<SeasonOverview overview={baseOverview} />);

    expect(screen.getByText('+5.4%')).toBeInTheDocument();
    expect(screen.getByText('-0.2')).toBeInTheDocument();
  });
});
