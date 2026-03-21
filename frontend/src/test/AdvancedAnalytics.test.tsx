import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { Mock } from 'vitest';
import html2canvas from 'html2canvas';
import AdvancedAnalytics from '../components/AdvancedAnalytics';
import api from '../utils/api';
import { advancedAnalyticsApi } from '../services/advancedAnalyticsApi';

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../services/advancedAnalyticsApi', () => ({
  advancedAnalyticsApi: {
    formTrends: vi.fn(),
    fatigue: vi.fn(),
    nextGame: vi.fn(),
    playerComparison: vi.fn(),
    videoEvents: vi.fn(),
    videoHighlights: vi.fn(),
  },
}));

vi.mock('html2canvas', () => ({
  default: vi.fn(() => Promise.resolve({
    width: 1200,
    height: 900,
    toDataURL: () => 'data:image/png;base64,mock',
  })),
}));

const { addImageMock, saveMock } = vi.hoisted(() => ({
  addImageMock: vi.fn(),
  saveMock: vi.fn(),
}));

vi.mock('jspdf', () => ({
  jsPDF: class MockJsPDF {
    addImage = addImageMock;
    save = saveMock;
  },
}));

vi.mock('recharts', () => {
  const React = require('react') as typeof import('react');
  const passthrough = (name: string) => ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': name }, children);

  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => React.createElement('div', { 'data-testid': 'ResponsiveContainer' }, children),
    LineChart: passthrough('LineChart'),
    Line: passthrough('Line'),
    BarChart: passthrough('BarChart'),
    Bar: passthrough('Bar'),
    RadarChart: passthrough('RadarChart'),
    Radar: passthrough('Radar'),
    PolarGrid: passthrough('PolarGrid'),
    PolarAngleAxis: passthrough('PolarAngleAxis'),
    PolarRadiusAxis: passthrough('PolarRadiusAxis'),
    CartesianGrid: passthrough('CartesianGrid'),
    XAxis: passthrough('XAxis'),
    YAxis: passthrough('YAxis'),
    Tooltip: passthrough('Tooltip'),
    Legend: passthrough('Legend'),
  };
});

describe('AdvancedAnalytics', () => {
  const apiGetMock = api.get as unknown as Mock;
  const html2canvasMock = html2canvas as unknown as Mock;
  const formTrendsMock = advancedAnalyticsApi.formTrends as unknown as Mock;
  const fatigueMock = advancedAnalyticsApi.fatigue as unknown as Mock;
  const nextGameMock = advancedAnalyticsApi.nextGame as unknown as Mock;
  const comparisonMock = advancedAnalyticsApi.playerComparison as unknown as Mock;
  const videoEventsMock = advancedAnalyticsApi.videoEvents as unknown as Mock;
  const videoHighlightsMock = advancedAnalyticsApi.videoHighlights as unknown as Mock;
  const anchorClickMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(anchorClickMock);

    apiGetMock.mockResolvedValue({
      data: [
        { id: 2, first_name: 'Alex', last_name: 'Arrow', jersey_number: 9, team_name: 'Falcons' },
        { id: 7, first_name: 'Jamie', last_name: 'Baker', jersey_number: 4, team_name: 'Falcons' },
      ],
    });

    formTrendsMock.mockResolvedValue({
      player_id: 2,
      form_trend: 'improving',
      trend_change: 8.4,
      recent_avg_fg: 61.2,
      older_avg_fg: 52.8,
      overall_avg_fg: 57,
      volatility: 7.2,
      consistency_rating: 'high',
      games_analyzed: 4,
      recent_games: [
        { game_id: 301, game_date: '2026-03-12T18:00:00.000Z', shots: 10, goals: 6, fg_percentage: 60, avg_distance: 5.4 },
        { game_id: 300, game_date: '2026-02-03T18:00:00.000Z', shots: 8, goals: 4, fg_percentage: 50, avg_distance: 4.9 },
      ],
    });

    fatigueMock.mockResolvedValue({
      player_id: 2,
      games_analyzed: 2,
      fatigue_analysis: [
        {
          game_id: 301,
          game_date: '2026-03-12T18:00:00.000Z',
          play_time_seconds: 1800,
          play_time_minutes: 30,
          play_time_percent: 75,
          performance_degradation: 9.4,
          fatigue_level: 'tired',
          period_performance: [
            { period: 1, shots: 4, goals: 3, fg_percentage: 75 },
            { period: 2, shots: 3, goals: 1, fg_percentage: 33.3 },
          ],
        },
      ],
    });

    nextGameMock.mockResolvedValue({
      player_id: 2,
      opponent_id: null,
      predicted_fg_percentage: 63.2,
      predicted_shots: 9,
      predicted_goals: 6,
      confidence_score: 81,
      form_trend: 'improving',
      historical_avg: {
        fg_percentage: 58.5,
        shots_per_game: 8.6,
        goals_per_game: 5,
      },
      adjustments: {
        form_adjustment: 5,
        matchup_adjustment: 0,
      },
    });

    comparisonMock.mockResolvedValue({
      player_id: 2,
      games_analyzed: 10,
      player_stats: {
        avg_shots_per_game: 8.6,
        avg_goals_per_game: 5,
        avg_fg_percentage: 58.5,
        avg_shot_distance: 5.1,
      },
      league_averages: {
        avg_shots_per_game: 7.8,
        avg_goals_per_game: 4.1,
        avg_fg_percentage: 51,
        avg_shot_distance: 4.8,
      },
      comparison: {
        shots_vs_league: 10.2,
        goals_vs_league: 21.9,
        fg_vs_league: 7.5,
        distance_vs_league: 0.3,
      },
      percentile_rank: {
        fg_percentage: 88,
      },
    });

    videoEventsMock.mockResolvedValue([
      {
        game_id: 301,
        event_id: 9001,
        event_type: 'goal',
        description: 'Goal from the left wing',
        is_highlight: true,
        timestamp_start: '00:12:03',
        timestamp_end: '00:12:14',
      },
    ]);

    videoHighlightsMock.mockResolvedValue({
      game_id: 301,
      total_clips: 2,
      marked_highlights: [
        {
          event_id: 9001,
          event_type: 'goal',
          description: 'Goal from the left wing',
          timestamp_start: '00:12:03',
          timestamp_end: '00:12:14',
        },
      ],
      auto_identified_highlights: [
        {
          event_id: 9002,
          event_type: 'goal',
          description: 'Goal by Alex Arrow (Falcons)',
          suggested_duration: 10,
          priority: 'high',
        },
      ],
      reel_metadata: {
        suggested_total_duration: 25,
        clip_ordering: 'chronological',
        include_transitions: true,
      },
    });
  });

  it('loads players, auto-selects one, and shows analytics summaries', async () => {
    render(<AdvancedAnalytics />);

    await waitFor(() => {
      expect(formTrendsMock).toHaveBeenCalledWith(2, 20);
      expect(screen.getByText('Advanced Analytics Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText('improving')).toBeInTheDocument();
    expect(screen.getByText('tired')).toBeInTheDocument();
    expect(screen.getByText('63.2%')).toBeInTheDocument();
    expect(screen.getByText('+7.5%')).toBeInTheDocument();
    expect(screen.getByTestId('selected-player-label')).toHaveTextContent('Alex Arrow');
  });

  it('applies date filters and shows video insights through tab navigation', async () => {
    const user = userEvent.setup();
    render(<AdvancedAnalytics />);

    await screen.findByText('Recent Games');

    expect(screen.getByText(/Game #300/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Date from'));
    await user.type(screen.getByLabelText('Date from'), '2026-03-01');

    expect(screen.queryByText(/Game #300/)).not.toBeInTheDocument();
    expect(screen.getByText(/Game #301/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Video' }));

    await waitFor(() => {
      expect(videoEventsMock).toHaveBeenCalledWith(301);
      expect(screen.getAllByText('Goal from the left wing').length).toBeGreaterThan(0);
    });
  });

  it('shows errors from analytics loading failures', async () => {
    formTrendsMock.mockRejectedValueOnce(new Error('Prediction service down'));

    render(<AdvancedAnalytics />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Prediction service down');
    });
  });

  it('exports the dashboard as image and pdf', async () => {
    const user = userEvent.setup();
    render(<AdvancedAnalytics />);

    await screen.findByText('Advanced Analytics Dashboard');

    await user.click(screen.getByRole('button', { name: 'Export Image' }));
    await waitFor(() => {
      expect(html2canvasMock).toHaveBeenCalledTimes(1);
      expect(anchorClickMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: 'Export PDF' }));
    await waitFor(() => {
      expect(html2canvasMock).toHaveBeenCalledTimes(2);
      expect(addImageMock).toHaveBeenCalled();
      expect(saveMock).toHaveBeenCalled();
    });
  });
});