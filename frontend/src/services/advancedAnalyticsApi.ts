import api from '../utils/api';
import { isAxiosError } from 'axios';
import type {
  FatigueResponse,
  FormTrendsResponse,
  HistoricalBenchmarksResponse,
  LeagueAveragesResponse,
  NextGamePredictionResponse,
  PlayerComparisonResponse,
  VideoEvent,
  VideoHighlightsResponse,
  VideoLinkEventPayload,
  VideoLinkEventResponse,
  VideoReportDataResponse,
} from '../types/advanced-analytics';

export type DateFilterParams = {
  startDate?: string;
  endDate?: string;
};

type BenchmarkFilters = {
  competition?: string;
  season?: string;
  position?: 'offense' | 'defense' | 'all';
  minGames?: number;
};

type HistoricalPeriods = 'last_7_days' | 'last_30_days' | 'last_90_days' | 'season';

const apiCall = async <T>(operation: () => Promise<{ data: T }>, fallbackMessage: string): Promise<T> => {
  try {
    const response = await operation();
    return response.data;
  } catch (error) {
    if (isAxiosError(error)) {
      const serverError = error.response?.data as { error?: string } | undefined;
      throw new Error(serverError?.error || error.message || fallbackMessage);
    }

    if (error instanceof Error) {
      throw new Error(error.message || fallbackMessage);
    }

    throw new Error(fallbackMessage);
  }
};

const buildDateParams = (filters?: DateFilterParams): Record<string, string> => {
  const params: Record<string, string> = {};

  if (filters?.startDate) {
    params.start_date = filters.startDate;
  }

  if (filters?.endDate) {
    params.end_date = filters.endDate;
  }

  return params;
};

export const advancedAnalyticsApi = {
  formTrends: async (playerId: number, games: number = 20, filters?: DateFilterParams): Promise<FormTrendsResponse> => {
    return apiCall(
      () => api.get<FormTrendsResponse>(`/advanced-analytics/predictions/form-trends/${playerId}`, {
        params: { games, ...buildDateParams(filters) },
      }),
      'Failed to fetch form trends',
    );
  },

  fatigue: async (playerId: number, filters?: DateFilterParams): Promise<FatigueResponse> => {
    return apiCall(
      () => api.get<FatigueResponse>(`/advanced-analytics/predictions/fatigue/${playerId}`, {
        params: buildDateParams(filters),
      }),
      'Failed to fetch fatigue analysis',
    );
  },

  nextGame: async (playerId: number, filters?: DateFilterParams): Promise<NextGamePredictionResponse> => {
    return apiCall(
      () => api.get<NextGamePredictionResponse>(`/advanced-analytics/predictions/next-game/${playerId}`, {
        params: buildDateParams(filters),
      }),
      'Failed to fetch next game prediction',
    );
  },

  playerComparison: async (playerId: number, games: number = 20, filters?: DateFilterParams): Promise<PlayerComparisonResponse> => {
    return apiCall(
      () => api.get<PlayerComparisonResponse>(`/advanced-analytics/benchmarks/player-comparison/${playerId}`, {
        params: { games, ...buildDateParams(filters) },
      }),
      'Failed to fetch player comparison',
    );
  },

  leagueAverages: async (filters?: BenchmarkFilters): Promise<LeagueAveragesResponse> => {
    return apiCall(
      () => api.get<LeagueAveragesResponse>('/advanced-analytics/benchmarks/league-averages', {
        params: {
          competition: filters?.competition,
          season: filters?.season,
          position: filters?.position,
          min_games: filters?.minGames,
        },
      }),
      'Failed to fetch league averages',
    );
  },

  historicalBenchmarks: async (
    entityType: 'player' | 'team',
    entityId: number,
    periods?: HistoricalPeriods[],
  ): Promise<HistoricalBenchmarksResponse> => {
    return apiCall(
      () => api.get<HistoricalBenchmarksResponse>(`/advanced-analytics/benchmarks/historical/${entityType}/${entityId}`, {
        params: periods && periods.length > 0 ? { periods } : undefined,
      }),
      'Failed to fetch historical benchmarks',
    );
  },

  linkVideoEvent: async (payload: VideoLinkEventPayload): Promise<VideoLinkEventResponse> => {
    return apiCall(
      () => api.post<VideoLinkEventResponse>('/advanced-analytics/video/link-event', payload),
      'Failed to link video event',
    );
  },

  videoEvents: async (gameId: number): Promise<VideoEvent[]> => {
    return apiCall(
      () => api.get<VideoEvent[]>(`/advanced-analytics/video/game/${gameId}`, {
        params: { highlights_only: true },
      }),
      'Failed to fetch video events',
    );
  },

  videoHighlights: async (gameId: number, maxClips: number = 10): Promise<VideoHighlightsResponse> => {
    return apiCall(
      () => api.get<VideoHighlightsResponse>(`/advanced-analytics/video/highlights/${gameId}`, {
        params: { max_clips: maxClips },
      }),
      'Failed to fetch video highlights',
    );
  },

  videoReportData: async (gameId: number): Promise<VideoReportDataResponse> => {
    return apiCall(
      () => api.get<VideoReportDataResponse>(`/advanced-analytics/video/report-data/${gameId}`),
      'Failed to fetch video report data',
    );
  },
};