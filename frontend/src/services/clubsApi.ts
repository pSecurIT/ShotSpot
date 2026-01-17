import axios from 'axios';
import api from '../utils/api';
import type { Club, ClubCreate, ClubPlayer, ClubTeam, ClubUpdate } from '../types/clubs';

type ApiErrorPayload = {
  error?: string;
  details?: string;
  errors?: Array<{ msg?: string }>;
};

type QueuedActionResponse = {
  queued: true;
  message: string;
};

const extractApiErrorMessage = (data: unknown): string | undefined => {
  if (!data || typeof data !== 'object') return undefined;
  const payload = data as ApiErrorPayload;

  if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
  if (typeof payload.details === 'string' && payload.details.trim()) return payload.details;

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    const messages = payload.errors
      .map((e) => (typeof e?.msg === 'string' ? e.msg.trim() : ''))
      .filter(Boolean);
    if (messages.length > 0) return messages.join(', ');
  }

  return undefined;
};

const throwNormalizedApiError = (err: unknown, fallbackMessage: string): never => {
  if (axios.isAxiosError(err)) {
    const derived = extractApiErrorMessage(err.response?.data);
    err.message = derived || err.message || fallbackMessage;
    throw err;
  }

  if (err instanceof Error) {
    throw new Error(err.message || fallbackMessage);
  }

  throw new Error(fallbackMessage);
};

export const clubsApi = {
  /**
   * Fetch all clubs.
   * @returns All clubs ordered by name.
   */
  getAll: async (): Promise<Club[]> => {
    try {
      const response = await api.get<Club[]>('/clubs');
      return response.data;
    } catch (err) {
      throwNormalizedApiError(err, 'Failed to fetch clubs');
      throw err;
    }
  },

  /**
   * Fetch a club by ID.
   * @param id Club ID.
   */
  getById: async (id: number): Promise<Club> => {
    try {
      const response = await api.get<Club>(`/clubs/${id}`);
      return response.data;
    } catch (err) {
      throwNormalizedApiError(err, 'Failed to fetch club');
      throw err;
    }
  },

  /**
   * Create a new club.
   * Note: when offline, the request may be queued and return a queued response.
   * @param payload Club creation payload.
   */
  create: async (payload: ClubCreate): Promise<Club | QueuedActionResponse> => {
    try {
      const response = await api.post<Club | QueuedActionResponse>('/clubs', payload);
      return response.data;
    } catch (err) {
      throwNormalizedApiError(err, 'Failed to create club');
      throw err;
    }
  },

  /**
   * Update an existing club.
   * Note: when offline, the request may be queued and return a queued response.
   * @param id Club ID.
   * @param payload Club update payload.
   */
  update: async (id: number, payload: ClubUpdate): Promise<Club | QueuedActionResponse> => {
    try {
      const response = await api.put<Club | QueuedActionResponse>(`/clubs/${id}`, payload);
      return response.data;
    } catch (err) {
      throwNormalizedApiError(err, 'Failed to update club');
      throw err;
    }
  },

  /**
   * Delete a club.
   * Note: when offline, the request may be queued.
   * @param id Club ID.
   */
  delete: async (id: number): Promise<void | QueuedActionResponse> => {
    try {
      const response = await api.delete<QueuedActionResponse>(`/clubs/${id}`);
      return response.data;
    } catch (err) {
      throwNormalizedApiError(err, 'Failed to delete club');
      throw err;
    }
  },

  /**
   * Fetch all teams (age groups) for a club.
   * @param id Club ID.
   */
  getTeams: async (id: number): Promise<ClubTeam[]> => {
    try {
      const response = await api.get<ClubTeam[]>(`/clubs/${id}/teams`);
      return response.data;
    } catch (err) {
      throwNormalizedApiError(err, 'Failed to fetch club teams');
      throw err;
    }
  },

  /**
   * Fetch all players for a club.
   * @param id Club ID.
   */
  getPlayers: async (id: number): Promise<ClubPlayer[]> => {
    try {
      const response = await api.get<ClubPlayer[]>(`/clubs/${id}/players`);
      return response.data;
    } catch (err) {
      throwNormalizedApiError(err, 'Failed to fetch club players');
      throw err;
    }
  },
};
