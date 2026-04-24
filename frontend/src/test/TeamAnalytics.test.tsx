import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import html2canvas from 'html2canvas';
import TeamAnalytics from '../components/TeamAnalytics';
import api from '../utils/api';
import { seasonsApi } from '../services/seasonsApi';
import { teamAnalyticsApi } from '../services/teamAnalyticsApi';

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../services/seasonsApi', () => ({
  seasonsApi: {
    list: vi.fn(),
  },
}));

vi.mock('../services/teamAnalyticsApi', () => ({
  teamAnalyticsApi: {
    seasonOverview: vi.fn(),
    momentum: vi.fn(),
    strengthsWeaknesses: vi.fn(),
  },
}));

vi.mock('html2canvas', () => ({
  default: vi.fn(() => Promise.resolve({
    width: 1200,
    height: 800,
    toDataURL: () => 'data:image/png;base64,mock',
  })),
}));

const { addImageMock, saveMock } = vi.hoisted(() => ({
  addImageMock: vi.fn(),
  saveMock: vi.fn(),
}));

vi.mock('jspdf', () => ({
  jsPDF: class MockJsPdf {
    addImage = addImageMock;
    save = saveMock;
  },
}));

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

describe('TeamAnalytics', () => {
  const apiGetMock = api.get as unknown as Mock;
  const seasonsListMock = seasonsApi.list as unknown as Mock;
  const seasonOverviewMock = teamAnalyticsApi.seasonOverview as unknown as Mock;
  const momentumMock = teamAnalyticsApi.momentum as unknown as Mock;
  const strengthsMock = teamAnalyticsApi.strengthsWeaknesses as unknown as Mock;

  const renderWithRouter = () => {
    return render(
      <MemoryRouter initialEntries={['/team-analytics']}>
        <TeamAnalytics />
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();

    apiGetMock.mockResolvedValue({
      data: [
        { id: 4, name: 'U19 A', club_id: 2, club_name: 'Falcons', season_id: 10 },
        { id: 8, name: 'Senior', club_id: 2, club_name: 'Wolves', season_id: 11 },
      ],
    });

    seasonsListMock.mockResolvedValue([
      { id: 10, name: '2025-2026', start_date: '2025-09-01', end_date: '2026-05-31', is_active: true, created_at: '', updated_at: '' },
      { id: 11, name: '2024-2025', start_date: '2024-09-01', end_date: '2025-05-31', is_active: false, created_at: '', updated_at: '' },
    ]);

    seasonOverviewMock.mockResolvedValue({
      team: { id: 4, name: 'U19 A', club_id: 2, club_name: 'Falcons', season_id: 10 },
      season: { id: 10, name: '2025-2026', start_date: '2025-09-01', end_date: '2026-05-31', is_active: true },
      scope_mode: 'team',
      record: { games_played: 8, wins: 5, losses: 2, draws: 1, points: 11, win_percentage: 62.5 },
      scoring: { total_shots: 98, total_goals: 56, fg_percentage: 57.1, goals_for: 83, goals_against: 69, goal_difference: 14, avg_goals_for: 10.38, avg_goals_against: 8.63, avg_goal_difference: 1.75 },
      top_scorers: [
        { player_id: 12, player_name: 'Alex Arrow', jersey_number: 9, goals: 18, shots: 29, fg_percentage: 62.1 },
      ],
      period_breakdown: [
        { period: 1, goals: 14, shots: 25, fg_percentage: 56 },
        { period: 2, goals: 12, shots: 23, fg_percentage: 52.2 },
      ],
      previous_season_comparison: {
        season: { id: 11, name: '2024-2025', start_date: '2024-09-01', end_date: '2025-05-31', is_active: false },
        record: { games_played: 7, wins: 4, losses: 3, draws: 0, points: 8, win_percentage: 57.1 },
        scoring: { total_shots: 90, total_goals: 46, fg_percentage: 51.1, goals_for: 74, goals_against: 72, goal_difference: 2, avg_goals_for: 10.57, avg_goals_against: 10.29, avg_goal_difference: 0.29 },
        deltas: { win_percentage: 5.4, goals_for_per_game: -0.2, fg_percentage: 6, goal_difference_per_game: 1.46 },
      },
    });

    momentumMock.mockResolvedValue({
      team: { id: 4, name: 'U19 A', club_id: 2, club_name: 'Falcons', season_id: 10 },
      season: { id: 10, name: '2025-2026', start_date: '2025-09-01', end_date: '2026-05-31', is_active: true },
      scope_mode: 'team',
      trend: [
        { game_id: 31, game_date: '2026-03-01T12:00:00.000Z', opponent_name: 'Ravens', venue: 'home', result: 'W', goals_for: 12, goals_against: 9, goal_difference: 3, shots: 14, goals: 12, fg_percentage: 85.7, momentum_score: 74, rolling_fg_percentage: 62.5, rolling_points_per_game: 1.8 },
      ],
      summary: { current_streak: 'W3', last_five_record: '3-1-1', last_five_points: 7, average_momentum: 68.3 },
    });

    strengthsMock.mockResolvedValue({
      team: { id: 4, name: 'U19 A', club_id: 2, club_name: 'Falcons', season_id: 10 },
      season: { id: 10, name: '2025-2026', start_date: '2025-09-01', end_date: '2026-05-31', is_active: true },
      scope_mode: 'team',
      benchmarks: { win_percentage: 48.5, goals_for_per_game: 9.2, goals_against_per_game: 9.7, fg_percentage: 51.8, goal_difference_per_game: -0.1 },
      strengths: [
        { title: 'Shot efficiency', description: 'Converts chances well above the season benchmark.', metric: 'fg_percentage', value: 57.1, benchmark: 51.8, delta: 5.3 },
      ],
      weaknesses: [
        { title: 'Defensive control', description: 'Still concedes slightly more than the strongest teams in the league.', metric: 'goals_against_per_game', value: 8.63, benchmark: 7.9, delta: -0.73 },
      ],
      period_breakdown: [
        { period: 1, goals: 14, shots: 25, fg_percentage: 56 },
      ],
    });
  });

  it('loads the dashboard and renders season overview content', async () => {
    renderWithRouter();

    expect(await screen.findByText('Team Analytics Dashboard')).toBeInTheDocument();

    await waitFor(() => {
      expect(seasonOverviewMock).toHaveBeenCalledWith(4, 10);
      expect(momentumMock).toHaveBeenCalledWith(4, 10);
      expect(strengthsMock).toHaveBeenCalledWith(4, 10);
    });

    expect(screen.getByText(/Alex Arrow/)).toBeInTheDocument();
    expect(screen.getByText('Momentum Tracking')).toBeInTheDocument();
    expect(screen.getByText('Converts chances well above the season benchmark.')).toBeInTheDocument();
  });

  it('reloads analytics when the team selection changes', async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await screen.findByText('Team Analytics Dashboard');
    await user.selectOptions(screen.getByLabelText('Team'), '8');

    await waitFor(() => {
      expect(seasonOverviewMock).toHaveBeenLastCalledWith(8, 10);
    });
  });

  it('exports the dashboard as pdf', async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await screen.findByText('Team Analytics Dashboard');
    await user.click(screen.getByRole('button', { name: 'Export PDF' }));

    await waitFor(() => {
      expect(html2canvas).toHaveBeenCalled();
      expect(addImageMock).toHaveBeenCalled();
      expect(saveMock).toHaveBeenCalled();
    });
  });

  it('shows API errors in an alert', async () => {
    seasonOverviewMock.mockRejectedValueOnce(new Error('Analytics service unavailable'));

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Analytics service unavailable');
    });
  });

  it('reloads analytics when the season selection changes', async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await screen.findByText('Team Analytics Dashboard');
    await user.selectOptions(screen.getByLabelText('Season'), '11');

    await waitFor(() => {
      expect(seasonOverviewMock).toHaveBeenLastCalledWith(4, 11);
      expect(momentumMock).toHaveBeenLastCalledWith(4, 11);
      expect(strengthsMock).toHaveBeenLastCalledWith(4, 11);
    });
  });

  it('shows scope fallback info when overview scope_mode is club_fallback', async () => {
    seasonOverviewMock.mockResolvedValueOnce({
      team: { id: 4, name: 'U19 A', club_id: 2, club_name: 'Falcons', season_id: 10 },
      season: { id: 10, name: '2025-2026', start_date: '2025-09-01', end_date: '2026-05-31', is_active: true },
      scope_mode: 'club_fallback',
      record: { games_played: 8, wins: 5, losses: 2, draws: 1, points: 11, win_percentage: 62.5 },
      scoring: { total_shots: 98, total_goals: 56, fg_percentage: 57.1, goals_for: 83, goals_against: 69, goal_difference: 14, avg_goals_for: 10.38, avg_goals_against: 8.63, avg_goal_difference: 1.75 },
      top_scorers: [],
      period_breakdown: [],
      previous_season_comparison: null,
    });

    renderWithRouter();

    expect(await screen.findByText(/older matches are not linked to team IDs/i)).toBeInTheDocument();
  });

  it('announces when strengths and weaknesses are empty', async () => {
    strengthsMock.mockResolvedValueOnce({
      team: { id: 4, name: 'U19 A', club_id: 2, club_name: 'Falcons', season_id: 10 },
      season: { id: 10, name: '2025-2026', start_date: '2025-09-01', end_date: '2026-05-31', is_active: true },
      scope_mode: 'team',
      benchmarks: { win_percentage: 48.5, goals_for_per_game: 9.2, goals_against_per_game: 9.7, fg_percentage: 51.8, goal_difference_per_game: -0.1 },
      strengths: [],
      weaknesses: [],
      period_breakdown: [],
    });

    renderWithRouter();

    await screen.findByText('Team Analytics Dashboard');
    expect(await screen.findByText('No strengths identified yet.')).toBeInTheDocument();
    expect(await screen.findByText('No weaknesses identified yet.')).toBeInTheDocument();
  });
});