import axios from 'axios';
import api from '../utils/api';
import type {
  Competition,
  CompetitionCreate,
  CompetitionTeam,
  CompetitionUpdate,
  LeagueStanding,
  TournamentBracket,
} from '../types/competitions';

type ApiErrorPayload = {
  error?: string;
  details?: string;
  errors?: Array<{ msg?: string }>;
};

type QueuedActionResponse = {
  queued: true;
  message: string;
};

type CompetitionRow = {
  id: number;
  name: string;
  competition_type: 'tournament' | 'league';
  season_id: number | null;
  series_id: number | null;
  start_date: string;
  end_date: string | null;
  status: 'upcoming' | 'in_progress' | 'completed' | 'cancelled';
  settings?: unknown;
  created_at: string;
  updated_at: string;
  description?: string | null;
  is_official?: boolean;
  season_name?: string | null;
  team_count?: string | number;
  games_played?: string | number;
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

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const normalizeFormatConfig = (settings: unknown): Record<string, unknown> => {
  if (!settings || typeof settings !== 'object') return {};
  const s = settings as { format_config?: unknown };
  if (s.format_config && typeof s.format_config === 'object') return s.format_config as Record<string, unknown>;
  return settings as Record<string, unknown>;
};

const fromRow = (row: CompetitionRow): Competition => {
  return {
    id: row.id,
    name: row.name,
    type: row.competition_type,
    season_id: row.season_id,
    series_id: row.series_id,
    start_date: row.start_date,
    end_date: row.end_date,
    status: row.status,
    format_config: normalizeFormatConfig(row.settings),
    created_at: row.created_at,
    updated_at: row.updated_at,
    description: row.description ?? null,
    is_official: row.is_official,
    season_name: row.season_name ?? null,
    team_count: toNumber(row.team_count),
    games_played: toNumber(row.games_played),
  };
};

/**
 * Competitions API client wrapper.
 */
export const competitionsApi = {
  /**
   * List competitions.
   * Backend supports optional query params: `type`, `season_id`, `status`.
   */
  list: async (filters?: {
    type?: Competition['type'];
    season_id?: number;
    status?: Competition['status'];
  }): Promise<Competition[]> => {
    try {
      const response = await api.get<CompetitionRow[]>('/competitions', {
        params: filters,
      });
      return (response.data || []).map(fromRow);
    } catch (err) {
      throwNormalizedApiError(err, 'Failed to fetch competitions');
      throw err;
    }
  },

  /**
   * Get a single competition by ID.
   */
  getById: async (id: number): Promise<Competition> => {
    try {
      const response = await api.get<CompetitionRow>(`/competitions/${id}`);
      return fromRow(response.data);
    } catch (err) {
      throwNormalizedApiError(err, 'Failed to fetch competition');
      throw err;
    }
  },

  /**
   * Create a competition.
   * Note: when offline, the request may be queued.
   */
  create: async (payload: CompetitionCreate): Promise<Competition | QueuedActionResponse> => {
    try {
      const body = {
        name: payload.name,
        competition_type: payload.type,
        season_id: payload.season_id ?? undefined,
        series_id: payload.series_id ?? undefined,
        start_date: payload.start_date,
        end_date: payload.end_date ?? undefined,
        description: payload.description ?? undefined,
        // Backend stores settings as JSON; we put format config inside settings.format_config
        settings: { format_config: payload.format_config ?? {} },
      };

      const response = await api.post<CompetitionRow | QueuedActionResponse>('/competitions', body);
      if ((response.data as QueuedActionResponse)?.queued) return response.data as QueuedActionResponse;
      return fromRow(response.data as CompetitionRow);
    } catch (err) {
      throwNormalizedApiError(err, 'Failed to create competition');
      throw err;
    }
  },

  /**
   * Update an existing competition.
   * Note: when offline, the request may be queued.
   */
  update: async (id: number, payload: CompetitionUpdate): Promise<Competition | QueuedActionResponse> => {
    try {
      const body: Record<string, unknown> = {};
      if (payload.name !== undefined) body.name = payload.name;
      if (payload.status !== undefined) body.status = payload.status;
      if (payload.start_date !== undefined) body.start_date = payload.start_date;
      if (payload.end_date !== undefined) body.end_date = payload.end_date;
      if (payload.description !== undefined) body.description = payload.description;
      if (payload.season_id !== undefined) body.season_id = payload.season_id;
      if (payload.series_id !== undefined) body.series_id = payload.series_id;
      if (payload.format_config !== undefined) body.settings = { format_config: payload.format_config };

      const response = await api.put<CompetitionRow | QueuedActionResponse>(`/competitions/${id}`, body);
      if ((response.data as QueuedActionResponse)?.queued) return response.data as QueuedActionResponse;
      return fromRow(response.data as CompetitionRow);
    } catch (err) {
      throwNormalizedApiError(err, 'Failed to update competition');
      throw err;
    }
  },

  /**
   * Delete a competition.
   * Note: when offline, the request may be queued.
   */
  delete: async (id: number): Promise<void | QueuedActionResponse> => {
    try {
      const response = await api.delete<QueuedActionResponse>(`/competitions/${id}`);
      return response.data;
    } catch (err) {
      throwNormalizedApiError(err, 'Failed to delete competition');
      throw err;
    }
  },

  /**
   * Get teams registered in a competition.
   */
  getTeams: async (competitionId: number): Promise<CompetitionTeam[]> => {
    try {
      const response = await api.get<Array<{ competition_id: number; team_id: number; team_name: string; seed?: number | null; group_name?: string | null }>>(
        `/competitions/${competitionId}/teams`
      );
      return (response.data || []).map((t) => ({
        competition_id: t.competition_id,
        team_id: t.team_id,
        team_name: t.team_name,
        seed: t.seed ?? null,
        group: t.group_name ?? null,
      }));
    } catch (err) {
      throwNormalizedApiError(err, 'Failed to fetch competition teams');
      throw err;
    }
  },

  /**
   * Register a team for a competition.
   */
  addTeam: async (competitionId: number, teamId: number, options?: { seed?: number; group_name?: string }): Promise<CompetitionTeam | QueuedActionResponse> => {
    try {
      const response = await api.post<
        | { competition_id: number; team_id: number; team_name: string; seed?: number | null; group_name?: string | null }
        | QueuedActionResponse
      >(`/competitions/${competitionId}/teams`, {
        team_id: teamId,
        seed: options?.seed,
        group_name: options?.group_name,
      });

      if ((response.data as QueuedActionResponse)?.queued) return response.data as QueuedActionResponse;

      const t = response.data as { competition_id: number; team_id: number; team_name: string; seed?: number | null; group_name?: string | null };
      return {
        competition_id: t.competition_id,
        team_id: t.team_id,
        team_name: t.team_name,
        seed: t.seed ?? null,
        group: t.group_name ?? null,
      };
    } catch (err) {
      throwNormalizedApiError(err, 'Failed to add team to competition');
      throw err;
    }
  },

  /**
   * Remove a team from a competition.
   */
  removeTeam: async (competitionId: number, teamId: number): Promise<void | QueuedActionResponse> => {
    try {
      const response = await api.delete<QueuedActionResponse>(`/competitions/${competitionId}/teams/${teamId}`);
      return response.data;
    } catch (err) {
      throwNormalizedApiError(err, 'Failed to remove team from competition');
      throw err;
    }
  },

  /**
   * Get tournament bracket for a competition.
   */
  getBracket: async (competitionId: number): Promise<TournamentBracket> => {
    try {
      const response = await api.get<TournamentBracket>(`/competitions/${competitionId}/bracket`);
      return response.data;
    } catch (err) {
      throwNormalizedApiError(err, 'Failed to fetch tournament bracket');
      throw err;
    }
  },

  /**
   * Generate bracket for a tournament competition.
   */
  generateBracket: async (competitionId: number): Promise<TournamentBracket | QueuedActionResponse> => {
    try {
      const response = await api.post<TournamentBracket | QueuedActionResponse>(
        `/competitions/${competitionId}/bracket/generate`
      );
      return response.data;
    } catch (err) {
      throwNormalizedApiError(err, 'Failed to generate tournament bracket');
      throw err;
    }
  },

  /**
   * Update a tournament bracket match.
   */
  updateBracketMatch: async (
    competitionId: number,
    bracketId: number,
    payload: {
      home_team_id?: number | null;
      away_team_id?: number | null;
      winner_team_id?: number;
      game_id?: number;
      scheduled_date?: string;
    }
  ): Promise<unknown | QueuedActionResponse> => {
    try {
      const response = await api.put<unknown | QueuedActionResponse>(
        `/competitions/${competitionId}/bracket/${bracketId}`,
        payload
      );
      return response.data;
    } catch (err) {
      throwNormalizedApiError(err, 'Failed to update bracket match');
      throw err;
    }
  },

  /**
   * Get league standings for a competition.
   */
  getStandings: async (competitionId: number): Promise<LeagueStanding[]> => {
    try {
      const response = await api.get<LeagueStanding[]>(`/competitions/${competitionId}/standings`);
      return response.data;
    } catch (err) {
      throwNormalizedApiError(err, 'Failed to fetch league standings');
      throw err;
    }
  },
};
