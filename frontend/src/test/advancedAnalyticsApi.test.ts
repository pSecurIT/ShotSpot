import { describe, it, expect, beforeEach, vi } from 'vitest';
import { advancedAnalyticsApi } from '../services/advancedAnalyticsApi';
import api from '../utils/api';

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('advancedAnalyticsApi', () => {
  const getMock = api.get as unknown as ReturnType<typeof vi.fn>;
  const postMock = (api as unknown as { post: ReturnType<typeof vi.fn> }).post;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls form trends endpoint with typed params', async () => {
    getMock.mockResolvedValueOnce({ data: { player_id: 1, form_trend: 'stable', games_analyzed: 2 } });

    await advancedAnalyticsApi.formTrends(1, 15, { startDate: '2026-01-01', endDate: '2026-01-31' });

    expect(getMock).toHaveBeenCalledWith('/advanced-analytics/predictions/form-trends/1', {
      params: { games: 15, start_date: '2026-01-01', end_date: '2026-01-31' },
    });
  });

  it('calls fatigue endpoint with date filters', async () => {
    getMock.mockResolvedValueOnce({ data: { player_id: 1, games_analyzed: 0, fatigue_analysis: [] } });

    await advancedAnalyticsApi.fatigue(1, { startDate: '2026-01-01' });

    expect(getMock).toHaveBeenCalledWith('/advanced-analytics/predictions/fatigue/1', {
      params: { start_date: '2026-01-01' },
    });
  });

  it('calls next game endpoint with date filters', async () => {
    getMock.mockResolvedValueOnce({ data: { player_id: 1, opponent_id: null } });

    await advancedAnalyticsApi.nextGame(1, { endDate: '2026-01-31' });

    expect(getMock).toHaveBeenCalledWith('/advanced-analytics/predictions/next-game/1', {
      params: { end_date: '2026-01-31' },
    });
  });

  it('calls player comparison endpoint', async () => {
    getMock.mockResolvedValueOnce({ data: { player_id: 1 } });

    await advancedAnalyticsApi.playerComparison(1, 10, { startDate: '2026-01-01' });

    expect(getMock).toHaveBeenCalledWith('/advanced-analytics/benchmarks/player-comparison/1', {
      params: { games: 10, start_date: '2026-01-01' },
    });
  });

  it('calls league averages endpoint', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        competition: 'default',
        season: 'current',
        position: 'all',
        league_averages: { total_games: 1, total_players: 1, avg_shots_per_game: 1, avg_goals_per_game: 1, avg_fg_percentage: 50, avg_shot_distance: 4 },
      },
    });

    await advancedAnalyticsApi.leagueAverages({ competition: 'cup', season: '2026', position: 'offense', minGames: 5 });

    expect(getMock).toHaveBeenCalledWith('/advanced-analytics/benchmarks/league-averages', {
      params: { competition: 'cup', season: '2026', position: 'offense', min_games: 5 },
    });
  });

  it('calls historical benchmarks endpoint', async () => {
    getMock.mockResolvedValueOnce({ data: { entity_type: 'player', entity_id: 1, historical_benchmarks: [] } });

    await advancedAnalyticsApi.historicalBenchmarks('player', 1, ['last_7_days', 'season']);

    expect(getMock).toHaveBeenCalledWith('/advanced-analytics/benchmarks/historical/player/1', {
      params: { periods: ['last_7_days', 'season'] },
    });
  });

  it('calls video link endpoint', async () => {
    const payload = {
      game_id: 10,
      event_type: 'goal',
      timestamp_start: 12,
      is_highlight: true,
    };
    postMock.mockResolvedValueOnce({ data: { id: 3, ...payload, tags: [] } });

    await advancedAnalyticsApi.linkVideoEvent(payload);

    expect(postMock).toHaveBeenCalledWith('/advanced-analytics/video/link-event', payload);
  });

  it('calls video events endpoint', async () => {
    getMock.mockResolvedValueOnce({ data: [] });

    await advancedAnalyticsApi.videoEvents(22);

    expect(getMock).toHaveBeenCalledWith('/advanced-analytics/video/game/22', {
      params: { highlights_only: true },
    });
  });

  it('calls video highlights endpoint', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        game_id: 22,
        total_clips: 0,
        marked_highlights: [],
        auto_identified_highlights: [],
        reel_metadata: { suggested_total_duration: 0, clip_ordering: 'chronological', include_transitions: true },
      },
    });

    await advancedAnalyticsApi.videoHighlights(22, 7);

    expect(getMock).toHaveBeenCalledWith('/advanced-analytics/video/highlights/22', {
      params: { max_clips: 7 },
    });
  });

  it('calls video report data endpoint', async () => {
    getMock.mockResolvedValueOnce({ data: { game_id: 22, video_events: [], report_metadata: { includes_video_links: false, total_tagged_events: 0, highlights_count: 0, event_types: [] } } });

    await advancedAnalyticsApi.videoReportData(22);

    expect(getMock).toHaveBeenCalledWith('/advanced-analytics/video/report-data/22');
  });

  it('normalizes server errors into readable Error messages', async () => {
    getMock.mockRejectedValueOnce({ isAxiosError: true, response: { data: { error: 'Bad request payload' } }, message: 'Request failed' });

    await expect(advancedAnalyticsApi.formTrends(1)).rejects.toThrow('Bad request payload');
  });
});