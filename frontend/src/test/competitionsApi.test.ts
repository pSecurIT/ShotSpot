import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { competitionsApi } from '../services/competitionsApi';
import api from '../utils/api';
import type { Competition } from '../types/competitions';

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn()
  }
}));

describe('competitionsApi', () => {
  const apiGetMock = api.get as unknown as Mock;
  const apiPostMock = api.post as unknown as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps competition rows on list', async () => {
    apiGetMock.mockResolvedValue({
      data: [
        {
          id: 10,
          name: 'League Alpha',
          competition_type: 'league',
          season_id: 2,
          series_id: null,
          start_date: '2025-01-01',
          end_date: null,
          status: 'in_progress',
          settings: { format_config: { points_win: 3 } },
          created_at: '2025-01-01',
          updated_at: '2025-01-02',
          team_count: '8',
          games_played: '4'
        }
      ]
    });

    const result = await competitionsApi.list({ type: 'league' });

    expect(api.get).toHaveBeenCalledWith('/competitions', { params: { type: 'league' } });
    expect(result).toEqual<Competition[]>([
      {
        id: 10,
        name: 'League Alpha',
        type: 'league',
        season_id: 2,
        series_id: null,
        start_date: '2025-01-01',
        end_date: null,
        status: 'in_progress',
        format_config: { points_win: 3 },
        created_at: '2025-01-01',
        updated_at: '2025-01-02',
        description: null,
        is_official: undefined,
        season_name: null,
        team_count: 8,
        games_played: 4
      }
    ]);
  });

  it('creates competitions with normalized payload', async () => {
    apiPostMock.mockResolvedValue({
      data: {
        id: 11,
        name: 'Cup',
        competition_type: 'tournament',
        season_id: null,
        series_id: null,
        start_date: '2025-02-01',
        end_date: null,
        status: 'upcoming',
        settings: { format_config: { bracket_type: 'single_elimination' } },
        created_at: '2025-02-01',
        updated_at: '2025-02-01'
      }
    });

    const result = await competitionsApi.create({
      name: 'Cup',
      type: 'tournament',
      start_date: '2025-02-01',
      format_config: { bracket_type: 'single_elimination' }
    });

    expect(api.post).toHaveBeenCalledWith('/competitions', {
      name: 'Cup',
      competition_type: 'tournament',
      season_id: undefined,
      series_id: undefined,
      start_date: '2025-02-01',
      end_date: undefined,
      description: undefined,
      settings: { format_config: { bracket_type: 'single_elimination' } }
    });

    expect(result).toEqual({
      id: 11,
      name: 'Cup',
      type: 'tournament',
      season_id: null,
      series_id: null,
      start_date: '2025-02-01',
      end_date: null,
      status: 'upcoming',
      format_config: { bracket_type: 'single_elimination' },
      created_at: '2025-02-01',
      updated_at: '2025-02-01',
      description: null,
      is_official: undefined,
      season_name: null,
      team_count: undefined,
      games_played: undefined
    });
  });

  it('normalizes team registration responses', async () => {
    apiGetMock.mockResolvedValue({
      data: [
        {
          competition_id: 1,
          team_id: 5,
          team_name: 'Team Five',
          seed: 2,
          group_name: 'Group A'
        }
      ]
    });

    const result = await competitionsApi.getTeams(1);

    expect(api.get).toHaveBeenCalledWith('/competitions/1/teams');
    expect(result).toEqual([
      {
        competition_id: 1,
        team_id: 5,
        team_name: 'Team Five',
        seed: 2,
        group: 'Group A'
      }
    ]);
  });

  it('converts generated bracket payloads into grouped rounds', async () => {
    apiPostMock.mockResolvedValue({
      data: {
        message: 'Tournament bracket generated successfully',
        total_rounds: 2,
        total_matches: 3,
        bracket: [
          {
            id: 1,
            competition_id: 1,
            round_number: 1,
            round_name: 'Semi Finals',
            match_number: 1,
            home_team_id: 1,
            away_team_id: 2,
            winner_team_id: null,
            game_id: null
          },
          {
            id: 2,
            competition_id: 1,
            round_number: 1,
            round_name: 'Semi Finals',
            match_number: 2,
            home_team_id: 3,
            away_team_id: 4,
            winner_team_id: null,
            game_id: null
          },
          {
            id: 3,
            competition_id: 1,
            round_number: 2,
            round_name: 'Final',
            match_number: 3,
            home_team_id: null,
            away_team_id: null,
            winner_team_id: null,
            game_id: null
          }
        ]
      }
    });

    const result = await competitionsApi.generateBracket(1);

    expect(api.post).toHaveBeenCalledWith('/competitions/1/bracket/generate');
    expect(result).toEqual({
      competition_id: 1,
      rounds: [
        {
          round_number: 1,
          round_name: 'Semi Finals',
          matches: [
            {
              id: 1,
              competition_id: 1,
              round_number: 1,
              round_name: 'Semi Finals',
              match_number: 1,
              home_team_id: 1,
              away_team_id: 2,
              winner_team_id: null,
              game_id: null
            },
            {
              id: 2,
              competition_id: 1,
              round_number: 1,
              round_name: 'Semi Finals',
              match_number: 2,
              home_team_id: 3,
              away_team_id: 4,
              winner_team_id: null,
              game_id: null
            }
          ]
        },
        {
          round_number: 2,
          round_name: 'Final',
          matches: [
            {
              id: 3,
              competition_id: 1,
              round_number: 2,
              round_name: 'Final',
              match_number: 3,
              home_team_id: null,
              away_team_id: null,
              winner_team_id: null,
              game_id: null
            }
          ]
        }
      ]
    });
  });

  it('throws API error messages from axios responses', async () => {
    const err = {
      isAxiosError: true,
      response: {
        data: {
          error: 'Competition not found'
        }
      },
      message: 'Request failed'
    };

    apiGetMock.mockRejectedValue(err);

    await expect(competitionsApi.getById(999)).rejects.toThrow('Competition not found');
  });
});
