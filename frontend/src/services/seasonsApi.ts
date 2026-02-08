import axios from 'axios';
import api from '../utils/api';
import type { Season } from '../types/seasons';

const extractApiErrorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    const message = err.response?.data?.error || err.response?.data?.details || err.message;
    return message || fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
};

export const seasonsApi = {
  list: async (options?: { active?: boolean }): Promise<Season[]> => {
    try {
      const response = await api.get<Season[]>('/seasons', {
        params: options?.active === undefined ? undefined : { active: options.active }
      });
      return response.data || [];
    } catch (err) {
      throw new Error(extractApiErrorMessage(err, 'Failed to fetch seasons'));
    }
  }
};
