import api from '../utils/api';
import type {
  FatigueResponse,
  FormTrendsResponse,
  NextGamePredictionResponse,
  PlayerComparisonResponse,
  VideoEvent,
  VideoHighlightsResponse,
} from '../types/advanced-analytics';

export const advancedAnalyticsApi = {
  formTrends: async (playerId: number, games: number = 20): Promise<FormTrendsResponse> => {
    const response = await api.get<FormTrendsResponse>(`/advanced-analytics/predictions/form-trends/${playerId}`, {
      params: { games },
    });
    return response.data;
  },

  fatigue: async (playerId: number): Promise<FatigueResponse> => {
    const response = await api.get<FatigueResponse>(`/advanced-analytics/predictions/fatigue/${playerId}`);
    return response.data;
  },

  nextGame: async (playerId: number): Promise<NextGamePredictionResponse> => {
    const response = await api.get<NextGamePredictionResponse>(`/advanced-analytics/predictions/next-game/${playerId}`);
    return response.data;
  },

  playerComparison: async (playerId: number, games: number = 20): Promise<PlayerComparisonResponse> => {
    const response = await api.get<PlayerComparisonResponse>(`/advanced-analytics/benchmarks/player-comparison/${playerId}`, {
      params: { games },
    });
    return response.data;
  },

  videoEvents: async (gameId: number): Promise<VideoEvent[]> => {
    const response = await api.get<VideoEvent[]>(`/advanced-analytics/video/game/${gameId}`, {
      params: { highlights_only: true },
    });
    return response.data;
  },

  videoHighlights: async (gameId: number, maxClips: number = 10): Promise<VideoHighlightsResponse> => {
    const response = await api.get<VideoHighlightsResponse>(`/advanced-analytics/video/highlights/${gameId}`, {
      params: { max_clips: maxClips },
    });
    return response.data;
  },
};