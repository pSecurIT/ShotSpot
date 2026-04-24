import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import CompetitionBracketView from '../components/CompetitionBracketView';

const mockNavigate = vi.fn();
const mockGetTeams = vi.fn();
const mockGetBracket = vi.fn();
const mockGenerateBracket = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../services/competitionsApi', () => ({
  competitionsApi: {
    getTeams: (...args: unknown[]) => mockGetTeams(...args),
    getBracket: (...args: unknown[]) => mockGetBracket(...args),
    generateBracket: (...args: unknown[]) => mockGenerateBracket(...args),
    updateBracketMatch: vi.fn(),
  },
}));

vi.mock('../components/TournamentBracket', () => ({
  TournamentBracket: () => <div data-testid="tournament-bracket">Bracket</div>,
}));

const renderView = (path = '/competitions/7/bracket') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/competitions/:id/bracket" element={<CompetitionBracketView />} />
      </Routes>
    </MemoryRouter>,
  );

describe('CompetitionBracketView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTeams.mockResolvedValue([{ id: 1, name: 'Falcons' }]);
    mockGetBracket.mockResolvedValue({ rounds: [{ round: 1, matches: [] }] });
    mockGenerateBracket.mockResolvedValue({ rounds: [{ round: 1, matches: [] }] });
  });

  it('shows a loading status while the bracket loads', async () => {
    let resolveTeams: ((value: { id: number; name: string }[]) => void) | undefined;
    let resolveBracket: ((value: { rounds: never[] }) => void) | undefined;

    mockGetTeams.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveTeams = resolve;
        }),
    );
    mockGetBracket.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveBracket = resolve;
        }),
    );

    renderView();

    expect(screen.getByRole('status')).toHaveTextContent('Loading bracket…');

    resolveTeams?.([{ id: 1, name: 'Falcons' }]);
    resolveBracket?.({ rounds: [] });

    await waitFor(() => {
      expect(screen.getByText('No rounds available')).toBeInTheDocument();
    });
  });

  it('shows API errors as alerts', async () => {
    mockGetBracket.mockRejectedValueOnce(new Error('Bracket failed'));

    renderView();

    expect(await screen.findByRole('alert')).toHaveTextContent('Bracket failed');
  });

  it('announces when the bracket has no rounds', async () => {
    mockGetBracket.mockResolvedValueOnce({ rounds: [] });

    renderView();

    expect(await screen.findByText('No rounds available')).toBeInTheDocument();
  });

  it('renders the bracket component when rounds are available', async () => {
    renderView();

    expect(await screen.findByTestId('tournament-bracket')).toBeInTheDocument();
  });

  it('triggers bracket generation from the action button', async () => {
    const user = userEvent.setup();
    renderView();

    await screen.findByTestId('tournament-bracket');
    await user.click(screen.getByRole('button', { name: /generate \/ regenerate bracket/i }));

    await waitFor(() => {
      expect(mockGenerateBracket).toHaveBeenCalledWith(7);
    });
  });
});