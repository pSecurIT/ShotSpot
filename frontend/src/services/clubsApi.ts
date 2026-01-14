import api from '../utils/api';
import type { Club, ClubCreate, ClubPlayer, ClubTeam, ClubUpdate } from '../types/clubs';

export const clubsApi = {
  getAll: async (): Promise<Club[]> => {
    const response = await api.get('/clubs');
    return response.data;
  },

  getById: async (id: number): Promise<Club> => {
    const response = await api.get(`/clubs/${id}`);
    return response.data;
  },

  create: async (payload: ClubCreate): Promise<Club> => {
    const response = await api.post('/clubs', payload);
    return response.data;
  },

  update: async (id: number, payload: ClubUpdate): Promise<Club> => {
    const response = await api.put(`/clubs/${id}`, payload);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/clubs/${id}`);
  },

  getTeams: async (id: number): Promise<ClubTeam[]> => {
    const response = await api.get(`/clubs/${id}/teams`);
    return response.data;
  },

  getPlayers: async (id: number): Promise<ClubPlayer[]> => {
    const response = await api.get(`/clubs/${id}/players`);
    return response.data;
  }
};
