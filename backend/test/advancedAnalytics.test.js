import { logError } from '../src/utils/logger.js';
import {
  generatePlayerReport,
  generateHighlightReel,
  generateTeamBenchmarkReport,
  calculatePercentileRank,
  determineTrend,
  formatForPDF
} from '../src/utils/advancedAnalytics.js';

jest.mock('../src/utils/logger.js', () => ({
  __esModule: true,
  logError: jest.fn()
}));

describe('advancedAnalytics utilities', () => {
  beforeEach(() => {
    process.env.API_BASE_URL = 'https://api.test.local';
    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.API_BASE_URL;
  });

  it('generates a complete player report', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ form_trend: 'improving', recent_games: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ fatigue_analysis: [{ fatigue_level: 'low' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ predicted_fg_percentage: 68, confidence_score: 0.92 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ comparison: { fg_vs_league: 5.5 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ historical_benchmarks: [{ period: '2024', avg_fg_percentage: 61 }] }) });

    const report = await generatePlayerReport(12, 44);

    expect(global.fetch).toHaveBeenCalledTimes(5);
    expect(global.fetch).toHaveBeenNthCalledWith(3, 'https://api.test.local/predictions/next-game/12?opponent_id=44');
    expect(report).toMatchObject({
      player_id: 12,
      report_type: 'comprehensive_player_analysis',
      performance_predictions: {
        form_trends: { form_trend: 'improving', recent_games: [] },
        fatigue_analysis: { fatigue_analysis: [{ fatigue_level: 'low' }] },
        next_game_prediction: { predicted_fg_percentage: 68, confidence_score: 0.92 }
      },
      benchmarking: {
        league_comparison: { comparison: { fg_vs_league: 5.5 } }
      },
      summary: {
        current_form: 'improving',
        fatigue_level: 'low',
        predicted_next_game_fg: 68,
        vs_league_average: 5.5,
        confidence_score: 0.92
      }
    });
  });

  it('throws when player report generation has no API base URL configured', async () => {
    delete process.env.API_BASE_URL;

    await expect(generatePlayerReport(1)).rejects.toThrow('API_BASE_URL environment variable is not set');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('logs and wraps player report fetch failures', async () => {
    global.fetch.mockImplementation(async () => ({
      ok: false,
      status: 503,
      text: async () => 'downstream unavailable'
    }));

    await expect(generatePlayerReport(12)).rejects.toThrow('Failed to generate player report');
    expect(logError).toHaveBeenCalledWith('Error generating player report:', expect.any(Error));
  });

  it('generates a highlight reel summary', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        total_clips: 2,
        reel_metadata: { suggested_total_duration: 48 },
        marked_highlights: [{
          timestamp_start: '00:01:00',
          timestamp_end: '00:01:15',
          event_type: 'goal',
          description: 'Opening goal'
        }],
        auto_identified_highlights: [{
          event_type: 'turnover',
          description: 'Forced turnover',
          priority: 'medium',
          suggested_duration: 7
        }]
      })
    });

    const result = await generateHighlightReel(33, 5);

    expect(global.fetch).toHaveBeenCalledWith('https://api.test.local/video/highlights/33?max_clips=5');
    expect(result.total_duration_seconds).toBe(48);
    expect(result.clip_count).toBe(2);
    expect(result.clips).toEqual([
      {
        type: 'marked',
        timestamp_start: '00:01:00',
        timestamp_end: '00:01:15',
        event_type: 'goal',
        description: 'Opening goal'
      },
      {
        type: 'auto',
        event_type: 'turnover',
        description: 'Forced turnover',
        priority: 'medium',
        suggested_duration: 7
      }
    ]);
  });

  it('logs and wraps highlight reel failures', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'boom' });

    await expect(generateHighlightReel(7)).rejects.toThrow('Failed to generate highlight reel');
    expect(logError).toHaveBeenCalledWith('Error generating highlight reel:', expect.any(Error));
  });

  it('generates a team benchmark report', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ averages: [{ metric: 'fg', value: 62 }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ history: [{ season: '2024', fg: 59 }] }) });

    const result = await generateTeamBenchmarkReport(15, 'defense');

    expect(global.fetch).toHaveBeenNthCalledWith(1, 'https://api.test.local/benchmarks/league-averages?position=defense');
    expect(global.fetch).toHaveBeenNthCalledWith(2, 'https://api.test.local/benchmarks/historical/team/15');
    expect(result).toMatchObject({
      team_id: 15,
      report_type: 'team_benchmark_analysis',
      position_filter: 'defense',
      league_benchmarks: { averages: [{ metric: 'fg', value: 62 }] },
      team_historical: { history: [{ season: '2024', fg: 59 }] },
      comparison: {}
    });
  });

  it('logs and wraps benchmark report failures', async () => {
    global.fetch.mockImplementation(async () => ({
      ok: false,
      status: 404,
      text: async () => 'missing averages'
    }));

    await expect(generateTeamBenchmarkReport(8)).rejects.toThrow('Failed to generate team benchmark report');
    expect(logError).toHaveBeenCalledWith('Error generating team benchmark report:', expect.any(Error));
  });

  it('calculates percentile rank with empty and populated datasets', () => {
    expect(calculatePercentileRank(10, [])).toBe(50);
    expect(calculatePercentileRank(30, [10, 20, 30, 40])).toBe(50);
  });

  it('determines improving, declining, and stable trends', () => {
    expect(determineTrend([{ value: 10 }, { value: 11 }, { value: 12 }, { value: 13 }])).toBe('improving');
    expect(determineTrend([{ value: 13 }, { value: 12 }, { value: 11 }, { value: 10 }])).toBe('declining');
    expect(determineTrend([{ value: 10 }, { value: 10.1 }, { value: 10.2 }, { value: 10.3 }])).toBe('stable');
    expect(determineTrend([{ value: 10 }])).toBe('stable');
  });

  it('formats report data for PDF output including charts and summary text', () => {
    const formatted = formatForPDF({
      performance_predictions: {
        form_trends: {
          recent_games: [
            { game_date: '2024-01-01', fg_percentage: 60 },
            { game_date: '2024-01-08', fg_percentage: 65 }
          ]
        }
      },
      benchmarking: {
        historical_performance: {
          historical_benchmarks: [
            { period: '2023', avg_fg_percentage: 58 },
            { period: '2024', avg_fg_percentage: 63 }
          ]
        }
      },
      summary: {
        current_form: 'improving',
        fatigue_level: 'medium',
        predicted_next_game_fg: 67,
        vs_league_average: -2.4
      }
    });

    expect(formatted.metadata.title).toBe('Advanced Analytics Report');
    expect(formatted.content.charts_data).toEqual([
      {
        type: 'line',
        title: 'Performance Trend',
        data: [
          { x: '2024-01-01', y: 60 },
          { x: '2024-01-08', y: 65 }
        ]
      },
      {
        type: 'bar',
        title: 'Historical Performance',
        data: [
          { x: '2023', y: 58 },
          { x: '2024', y: 63 }
        ]
      }
    ]);
    expect(formatted.content.summary_text).toContain('Player is currently in improving form.');
    expect(formatted.content.summary_text).toContain('Fatigue level is medium.');
    expect(formatted.content.summary_text).toContain('Predicted field goal percentage for next game: 67%.');
    expect(formatted.content.summary_text).toContain('Performing 2.4% below league average.');
  });
});