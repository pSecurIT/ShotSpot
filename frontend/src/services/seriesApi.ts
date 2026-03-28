import axios from 'axios';
import api from '../utils/api';
import type { Series, SeriesCreatePayload, SeriesDetail, SeriesUpdatePayload } from '../types/series';

const extractApiErrorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    const message = err.response?.data?.error || err.response?.data?.details || err.message;
    return message || fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
};

export const seriesApi = {
  list: async (): Promise<Series[]> => {
    try {
      const response = await api.get<Series[]>('/series');
      return response.data || [];
    } catch (err) {
      throw new Error(extractApiErrorMessage(err, 'Failed to fetch series'));
    }
  },

  getById: async (id: number): Promise<SeriesDetail> => {
    try {
      const response = await api.get<SeriesDetail>(`/series/${id}`);
      return response.data;
    } catch (err) {
      throw new Error(extractApiErrorMessage(err, 'Failed to fetch series details'));
    }
  },

  create: async (payload: SeriesCreatePayload): Promise<Series> => {
    try {
      const response = await api.post<Series>('/series', payload);
      return response.data;
    } catch (err) {
      throw new Error(extractApiErrorMessage(err, 'Failed to create series'));
    }
  },

  update: async (id: number, payload: SeriesUpdatePayload): Promise<Series> => {
    try {
      const response = await api.put<Series>(`/series/${id}`, payload);
      return response.data;
    } catch (err) {
      throw new Error(extractApiErrorMessage(err, 'Failed to update series'));
    }
  },

  delete: async (id: number): Promise<{ message: string }> => {
    try {
      const response = await api.delete<{ message: string }>(`/series/${id}`);
      return response.data;
    } catch (err) {
      throw new Error(extractApiErrorMessage(err, 'Failed to delete series'));
    }
  }
};
