import { describe, it, expect, beforeEach, vi } from 'vitest';
import api from '../utils/api';
import { teamAnalyticsApi } from '../services/teamAnalyticsApi';

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('teamAnalyticsApi', () => {
  const getMock = api.get as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the season overview endpoint with season params', async () => {
    getMock.mockResolvedValueOnce({ data: { team: { id: 5 }, record: {}, scoring: {}, top_scorers: [], period_breakdown: [], previous_season_comparison: null } });

    await teamAnalyticsApi.seasonOverview(5, 2);

    expect(getMock).toHaveBeenCalledWith('/team-analytics/5/season-overview', {
      params: { season_id: 2 },
    });
  });

  it('calls the momentum endpoint without season params when omitted', async () => {
    getMock.mockResolvedValueOnce({ data: { team: { id: 5 }, trend: [], summary: {} } });

    await teamAnalyticsApi.momentum(5);

    expect(getMock).toHaveBeenCalledWith('/team-analytics/5/momentum', {
      params: undefined,
    });
  });

  it('calls the strengths and weaknesses endpoint', async () => {
    getMock.mockResolvedValueOnce({ data: { team: { id: 5 }, strengths: [], weaknesses: [], benchmarks: {}, period_breakdown: [] } });

    await teamAnalyticsApi.strengthsWeaknesses(5, 7);

    expect(getMock).toHaveBeenCalledWith('/team-analytics/5/strengths-weaknesses', {
      params: { season_id: 7 },
    });
  });

  it('maps axios payload errors to readable messages', async () => {
    getMock.mockRejectedValueOnce({ isAxiosError: true, response: { data: { error: 'No analytics available' } }, message: 'Request failed' });

    await expect(teamAnalyticsApi.seasonOverview(3)).rejects.toThrow('No analytics available');
  });
});