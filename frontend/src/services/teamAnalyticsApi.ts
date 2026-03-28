import { isAxiosError } from 'axios';
import api from '../utils/api';
import type {
  TeamAnalyticsOverviewResponse,
  TeamMomentumResponse,
  TeamStrengthsWeaknessesResponse,
} from '../types/team-analytics';

const apiCall = async <T>(operation: () => Promise<{ data: T }>, fallbackMessage: string): Promise<T> => {
  try {
    const response = await operation();
    return response.data;
  } catch (error) {
    if (isAxiosError(error)) {
      const payload = error.response?.data as { error?: string } | undefined;
      throw new Error(payload?.error || error.message || fallbackMessage);
    }

    if (error instanceof Error) {
      throw new Error(error.message || fallbackMessage);
    }

    throw new Error(fallbackMessage);
  }
};

const buildParams = (seasonId?: number): { season_id?: number } | undefined => {
  if (!seasonId) {
    return undefined;
  }

  return { season_id: seasonId };
};

export const teamAnalyticsApi = {
  seasonOverview: async (teamId: number, seasonId?: number): Promise<TeamAnalyticsOverviewResponse> => {
    return apiCall(
      () => api.get<TeamAnalyticsOverviewResponse>(`/team-analytics/${teamId}/season-overview`, {
        params: buildParams(seasonId),
      }),
      'Failed to fetch season overview',
    );
  },

  momentum: async (teamId: number, seasonId?: number): Promise<TeamMomentumResponse> => {
    return apiCall(
      () => api.get<TeamMomentumResponse>(`/team-analytics/${teamId}/momentum`, {
        params: buildParams(seasonId),
      }),
      'Failed to fetch momentum data',
    );
  },

  strengthsWeaknesses: async (teamId: number, seasonId?: number): Promise<TeamStrengthsWeaknessesResponse> => {
    return apiCall(
      () => api.get<TeamStrengthsWeaknessesResponse>(`/team-analytics/${teamId}/strengths-weaknesses`, {
        params: buildParams(seasonId),
      }),
      'Failed to fetch strengths and weaknesses',
    );
  },
};