import { isAxiosError } from 'axios';
import api from '../utils/api';
import type {
  ScheduledReport,
  ScheduledReportHistoryResponse,
  ScheduledReportPayload,
  ScheduledReportRunResponse,
} from '../types/scheduled-reports';

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

export const scheduledReportsApi = {
  getAll: async (): Promise<ScheduledReport[]> => {
    return apiCall(
      () => api.get<ScheduledReport[]>('/scheduled-reports'),
      'Failed to fetch scheduled reports',
    );
  },

  create: async (payload: ScheduledReportPayload): Promise<ScheduledReport> => {
    return apiCall(
      () => api.post<ScheduledReport>('/scheduled-reports', payload),
      'Failed to create scheduled report',
    );
  },

  update: async (id: number, payload: Partial<ScheduledReportPayload> & { is_active?: boolean }): Promise<ScheduledReport> => {
    return apiCall(
      () => api.put<ScheduledReport>(`/scheduled-reports/${id}`, payload),
      'Failed to update scheduled report',
    );
  },

  remove: async (id: number): Promise<{ message: string }> => {
    return apiCall(
      () => api.delete<{ message: string }>(`/scheduled-reports/${id}`),
      'Failed to delete scheduled report',
    );
  },

  runNow: async (id: number): Promise<ScheduledReportRunResponse> => {
    return apiCall(
      () => api.post<ScheduledReportRunResponse>(`/scheduled-reports/${id}/run`),
      'Failed to run scheduled report',
    );
  },

  getHistory: async (id: number, limit: number = 20): Promise<ScheduledReportHistoryResponse> => {
    return apiCall(
      () => api.get<ScheduledReportHistoryResponse>(`/scheduled-reports/${id}/history`, { params: { limit } }),
      'Failed to fetch scheduled report history',
    );
  },
};
