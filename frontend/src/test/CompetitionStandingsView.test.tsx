import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import CompetitionStandingsView from '../components/CompetitionStandingsView';
import { competitionsApi } from '../services/competitionsApi';

vi.mock('../services/competitionsApi', () => ({
  competitionsApi: {
    getStandings: vi.fn(),
  },
}));

describe('CompetitionStandingsView', () => {
  const getStandingsMock = competitionsApi.getStandings as ReturnType<typeof vi.fn>;

  const renderPage = (path = '/competitions/1/standings') => render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/competitions/:id/standings" element={<CompetitionStandingsView />} />
      </Routes>
    </MemoryRouter>,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('announces loading state accessibly', () => {
    getStandingsMock.mockImplementation(() => new Promise(() => {}));

    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Loading standings…');
  });

  it('announces invalid route ids as alerts', async () => {
    renderPage('/competitions/not-a-number/standings');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid competition id');
    });
  });

  it('renders empty state and labeled table accessibly', async () => {
    getStandingsMock.mockResolvedValueOnce([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('No standings available');
    });

    getStandingsMock.mockResolvedValueOnce([
      {
        id: 1,
        competition_id: 1,
        team_id: 2,
        team_name: 'Alpha',
        rank: 1,
        games_played: 2,
        wins: 2,
        draws: 0,
        losses: 0,
        goals_for: 8,
        goals_against: 3,
        goal_difference: 5,
        points: 6,
      },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('table', { name: 'Competition standings table' })).toBeInTheDocument();
    });
  });
});