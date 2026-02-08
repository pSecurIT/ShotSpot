import axios from 'axios';
import api from '../utils/api';
import type { Series } from '../types/series';

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
  }
};
