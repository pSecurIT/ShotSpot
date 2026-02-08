import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import type { Mock } from 'vitest';
import CompetitionManagement from '../components/CompetitionManagement';
import { competitionsApi } from '../services/competitionsApi';
import { seasonsApi } from '../services/seasonsApi';
import { seriesApi } from '../services/seriesApi';
import api from '../utils/api';
import type { Competition } from '../types/competitions';

vi.mock('../services/competitionsApi', () => ({
  competitionsApi: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getTeams: vi.fn(),
    addTeam: vi.fn(),
    removeTeam: vi.fn(),
    getBracket: vi.fn(),
    generateBracket: vi.fn(),
    getStandings: vi.fn()
  }
}));

vi.mock('../services/seasonsApi', () => ({
  seasonsApi: {
    list: vi.fn()
  }
}));

vi.mock('../services/seriesApi', () => ({
  seriesApi: {
    list: vi.fn()
  }
}));

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

describe('CompetitionManagement', () => {
  const listMock = competitionsApi.list as unknown as Mock;
  const createMock = competitionsApi.create as unknown as Mock;
  const updateMock = competitionsApi.update as unknown as Mock;
  const deleteMock = competitionsApi.delete as unknown as Mock;

  const getTeamsMock = competitionsApi.getTeams as unknown as Mock;
  const addTeamMock = competitionsApi.addTeam as unknown as Mock;
  const generateBracketMock = competitionsApi.generateBracket as unknown as Mock;

  const seasonsListMock = seasonsApi.list as unknown as Mock;
  const seriesListMock = seriesApi.list as unknown as Mock;

  const apiGetMock = api.get as unknown as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    seasonsListMock.mockResolvedValue([]);
    seriesListMock.mockResolvedValue([]);
  });

  const renderAtCompetitions = () => {
    return render(
      <MemoryRouter initialEntries={['/competitions']}>
        <Routes>
          <Route path="/competitions" element={<CompetitionManagement />} />
          <Route path="/competitions/:id/bracket" element={<div>Bracket Page</div>} />
        </Routes>
      </MemoryRouter>
    );
  };

  const makeCompetition = (overrides: Partial<Competition>): Competition => ({
    id: 1,
    name: 'Competition',
    type: 'tournament',
    season_id: null,
    series_id: null,
    start_date: '2025-01-01',
    end_date: null,
    status: 'upcoming',
    format_config: {},
    created_at: '',
    updated_at: '',
    ...overrides
  });

  it('renders and fetches competitions on mount', async () => {
    listMock.mockResolvedValue([
      makeCompetition({
        id: 1,
        name: 'Summer Tournament',
        type: 'tournament',
        status: 'upcoming',
        start_date: '2025-06-01',
        team_count: 4
      }),
      makeCompetition({
        id: 2,
        name: 'Winter League',
        type: 'league',
        status: 'in_progress',
        start_date: '2025-01-01',
        team_count: 8
      })
    ]);

    renderAtCompetitions();

    expect(screen.getByText('Competitions Management')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create competition/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(competitionsApi.list).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Summer Tournament')).toBeInTheDocument();
      expect(screen.getByText('Winter League')).toBeInTheDocument();
    });
  });

  it('filters competitions by type, status and search', async () => {
    listMock.mockResolvedValue([
      makeCompetition({ id: 1, name: 'Summer Tournament', type: 'tournament', status: 'upcoming', start_date: '2025-06-01' }),
      makeCompetition({ id: 2, name: 'Winter League', type: 'league', status: 'in_progress', start_date: '2025-01-01' })
    ]);

    renderAtCompetitions();

    await screen.findByText('Summer Tournament');

    await userEvent.selectOptions(screen.getByLabelText('Filter by type'), 'tournament');
    expect(screen.getByText('Summer Tournament')).toBeInTheDocument();
    expect(screen.queryByText('Winter League')).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Filter by status'), 'upcoming');
    expect(screen.getByText('Summer Tournament')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Search competitions'));
    await userEvent.type(screen.getByLabelText('Search competitions'), 'winter');
    expect(screen.queryByText('Summer Tournament')).not.toBeInTheDocument();
  });

  it('creates a competition with validation and refreshes list', async () => {
    listMock
      .mockResolvedValueOnce([
        makeCompetition({
          id: 1,
          name: 'Summer Tournament',
          type: 'tournament',
          status: 'upcoming',
          start_date: '2025-06-01'
        })
      ])
      .mockResolvedValueOnce([
        makeCompetition({
          id: 1,
          name: 'Summer Tournament',
          type: 'tournament',
          status: 'upcoming',
          start_date: '2025-06-01'
        }),
        makeCompetition({
          id: 2,
          name: 'New League',
          type: 'league',
          status: 'upcoming',
          start_date: '2025-07-01'
        })
      ]);

    createMock.mockResolvedValue({ id: 2 });

    renderAtCompetitions();

    await screen.findByText('Summer Tournament');

    await userEvent.click(screen.getByRole('button', { name: /create competition/i }));

    // empty submit shows validation
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(screen.getByText('Competition name is required')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Competition name'), 'New League');
    await userEvent.selectOptions(screen.getByLabelText('Competition type'), 'league');
    await userEvent.type(screen.getByLabelText('Start date'), '2025-07-01');

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(competitionsApi.create).toHaveBeenCalledTimes(1);
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New League',
          type: 'league',
          start_date: '2025-07-01',
          format_config: { points_win: 3, points_draw: 1, points_loss: 0 }
        })
      );
    });

    await waitFor(() => {
      expect(competitionsApi.list).toHaveBeenCalledTimes(2);
      expect(screen.getByText('New League')).toBeInTheDocument();
    });
  });

  it('edits a competition and refreshes list', async () => {
    listMock
      .mockResolvedValueOnce([
        makeCompetition({
          id: 1,
          name: 'Summer Tournament',
          type: 'tournament',
          status: 'upcoming',
          start_date: '2025-06-01',
          format_config: { bracket_type: 'single_elimination' }
        })
      ])
      .mockResolvedValueOnce([
        makeCompetition({
          id: 1,
          name: 'Summer Tournament Updated',
          type: 'tournament',
          status: 'in_progress',
          start_date: '2025-06-01',
          format_config: { bracket_type: 'single_elimination' }
        })
      ]);

    updateMock.mockResolvedValue({ id: 1 });

    renderAtCompetitions();

    await screen.findByText('Summer Tournament');

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    const nameInput = screen.getByLabelText('Competition name');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Summer Tournament Updated');

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'in_progress');

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(deleteMock).not.toHaveBeenCalled();
      expect(updateMock).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          name: 'Summer Tournament Updated',
          status: 'in_progress'
        })
      );
    });

    await waitFor(() => {
      expect(listMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Summer Tournament Updated')).toBeInTheDocument();
    });
  });

  it('deletes a competition with confirmation', async () => {
    listMock.mockResolvedValue([
      makeCompetition({ id: 1, name: 'Summer Tournament', type: 'tournament', status: 'upcoming', start_date: '2025-06-01' }),
      makeCompetition({ id: 2, name: 'Winter League', type: 'league', status: 'in_progress', start_date: '2025-01-01' })
    ]);

    deleteMock.mockResolvedValue(undefined);

    renderAtCompetitions();

    await screen.findByText('Summer Tournament');

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    await userEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(deleteMock).toHaveBeenCalledWith(1);
    });

    expect(screen.queryByText('Summer Tournament')).not.toBeInTheDocument();
    expect(screen.getByText('Winter League')).toBeInTheDocument();
  });

  it('registers teams and can generate bracket when enough teams are registered', async () => {
    listMock.mockResolvedValue([
      makeCompetition({
        id: 1,
        name: 'Summer Tournament',
        type: 'tournament',
        status: 'upcoming',
        start_date: '2025-06-01'
      })
    ]);

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/teams') {
        return Promise.resolve({
          data: [
            { id: 10, name: 'Team A', club_name: 'Alpha Club' },
            { id: 11, name: 'Team B', club_name: 'Alpha Club' },
            { id: 12, name: 'Team C', club_name: 'Beta Club' },
            { id: 13, name: 'Team D', club_name: 'Beta Club' }
          ]
        });
      }
      return Promise.resolve({ data: [] });
    });

    getTeamsMock
      .mockResolvedValueOnce([
        { team_id: 10, team_name: 'Team A' },
        { team_id: 11, team_name: 'Team B' },
        { team_id: 12, team_name: 'Team C' },
        { team_id: 13, team_name: 'Team D' }
      ])
      .mockResolvedValueOnce([
        { team_id: 10, team_name: 'Team A' },
        { team_id: 11, team_name: 'Team B' },
        { team_id: 12, team_name: 'Team C' },
        { team_id: 13, team_name: 'Team D' }
      ]);

    addTeamMock.mockResolvedValue(undefined);
    generateBracketMock.mockResolvedValue({ competition_id: 1, rounds: [] });

    renderAtCompetitions();

    await screen.findByText('Summer Tournament');

    await userEvent.click(screen.getByRole('button', { name: /^teams$/i }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/teams');
      expect(getTeamsMock).toHaveBeenCalledWith(1);
    });

    // With 4 registered teams, bracket generation is available.
    expect(screen.getByRole('button', { name: /generate bracket/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /generate bracket/i }));

    await waitFor(() => {
      expect(generateBracketMock).toHaveBeenCalledWith(1);
    });

    await waitFor(() => {
      expect(screen.getByText('Bracket Page')).toBeInTheDocument();
    });
  });
});
