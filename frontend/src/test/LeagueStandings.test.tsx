import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { Mock } from 'vitest';
import LeagueStandings from '../components/LeagueStandings';
import { competitionsApi } from '../services/competitionsApi';
import type { LeagueStanding } from '../types/competitions';

vi.mock('../services/competitionsApi', () => ({
  competitionsApi: {
    getStandings: vi.fn(),
    initializeStandings: vi.fn(),
    updateStandings: vi.fn(),
    updateStandingPoints: vi.fn()
  }
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'test', role: 'coach', passwordMustChange: false }
  })
}));

describe('LeagueStandings', () => {
  const getStandingsMock = competitionsApi.getStandings as unknown as Mock;
  const updateStandingsMock = competitionsApi.updateStandings as unknown as Mock;
  const updateStandingPointsMock = competitionsApi.updateStandingPoints as unknown as Mock;

  const mockStanding = (overrides: Partial<LeagueStanding> = {}): LeagueStanding => ({
    id: 1,
    competition_id: 1,
    team_id: 1,
    team_name: 'Team A',
    rank: 1,
    games_played: 10,
    wins: 8,
    draws: 1,
    losses: 1,
    goals_for: 30,
    goals_against: 15,
    goal_difference: 15,
    points: 25,
    form: 'WWDWW',
    ...overrides
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    getStandingsMock.mockImplementation(() => new Promise(() => {})); // never resolves
    
    render(<LeagueStandings competitionId={1} />);
    
    expect(screen.getByText('Loading standings…')).toBeInTheDocument();
  });

  it('renders standings table with data', async () => {
    const standings: LeagueStanding[] = [
      mockStanding({ team_id: 1, team_name: 'Team A', points: 25, rank: 1 }),
      mockStanding({ team_id: 2, team_name: 'Team B', points: 20, rank: 2 }),
      mockStanding({ team_id: 3, team_name: 'Team C', points: 15, rank: 3 })
    ];

    getStandingsMock.mockResolvedValue(standings);

    render(<LeagueStandings competitionId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Team A')).toBeInTheDocument();
      expect(screen.getByText('Team B')).toBeInTheDocument();
      expect(screen.getByText('Team C')).toBeInTheDocument();
    });

    expect(getStandingsMock).toHaveBeenCalledWith(1);
  });

  it('displays all columns correctly', async () => {
    const standings: LeagueStanding[] = [
      mockStanding({ 
        team_name: 'Team A', 
        games_played: 10, 
        wins: 8, 
        draws: 2, 
        losses: 0,
        goals_for: 30,
        goals_against: 15,
        goal_difference: 15,
        points: 26
      })
    ];

    getStandingsMock.mockResolvedValue(standings);

    render(<LeagueStandings competitionId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Team A')).toBeInTheDocument();
      expect(screen.getByText('26')).toBeInTheDocument(); // Points is unique
    });
  });

  it('allows clicking column headers to sort', async () => {
    const standings: LeagueStanding[] = [
      mockStanding({ team_id: 1, team_name: 'Team A', wins: 8 }),
      mockStanding({ team_id: 2, team_name: 'Team B', wins: 6 }),
      mockStanding({ team_id: 3, team_name: 'Team C', wins: 7 })
    ];

    getStandingsMock.mockResolvedValue(standings);

    render(<LeagueStandings competitionId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Team A')).toBeInTheDocument();
    });

    const winsHeader = screen.getByRole('button', { name: /W/ });
    await userEvent.click(winsHeader);

    // After clicking once, wins column should be sorted ascending
    const rows = screen.getAllByRole('row');
    // Should have Team B (6 wins), Team C (7 wins), Team A (8 wins)
    expect(rows.length).toBeGreaterThan(2);
  });

  it('highlights promotion zone', async () => {
    const standings: LeagueStanding[] = [
      mockStanding({ team_id: 1, team_name: 'Team A', points: 25 }),
      mockStanding({ team_id: 2, team_name: 'Team B', points: 20 })
    ];

    getStandingsMock.mockResolvedValue(standings);

    render(
      <LeagueStandings
        competitionId={1}
        promotionZones={[{ from: 1, to: 2, type: 'promotion' }]}
      />
    );

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveClass('position-promotion');
      expect(rows[2]).toHaveClass('position-promotion');
    });
  });

  it('highlights relegation zone', async () => {
    const standings: LeagueStanding[] = [
      mockStanding({ team_id: 1, team_name: 'Team A', points: 25 }),
      mockStanding({ team_id: 2, team_name: 'Team B', points: 3 }),
      mockStanding({ team_id: 3, team_name: 'Team C', points: 2 })
    ];

    getStandingsMock.mockResolvedValue(standings);

    render(
      <LeagueStandings
        competitionId={1}
        relegationZone={{ from: 2, to: 3 }}
      />
    );

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      expect(rows[2]).toHaveClass('position-relegated');
      expect(rows[3]).toHaveClass('position-relegated');
    });
  });

  it('exports standings to CSV', async () => {
    const standings: LeagueStanding[] = [
      mockStanding({ team_id: 1, team_name: 'Team A', points: 25 }),
      mockStanding({ team_id: 2, team_name: 'Team B', points: 20 })
    ];

    getStandingsMock.mockResolvedValue(standings);

    const createElementSpy = vi.spyOn(document, 'createElement');
    const removeChildSpy = vi.spyOn(document.body, 'removeChild');

    render(<LeagueStandings competitionId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Team A')).toBeInTheDocument();
    });

    const exportButton = screen.getByRole('button', { name: /Export CSV/i });
    await userEvent.click(exportButton);

    await waitFor(() => {
      expect(createElementSpy).toHaveBeenCalledWith('a');
    });

    createElementSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it('calls onUpdate callback when data changes', async () => {
    const standings: LeagueStanding[] = [
      mockStanding({ team_id: 1, team_name: 'Team A' })
    ];

    getStandingsMock.mockResolvedValue(standings);

    const onUpdate = vi.fn();

    render(<LeagueStandings competitionId={1} onUpdate={onUpdate} />);

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(standings);
    });
  });

  it('reloads standings on refresh button click', async () => {
    const standings: LeagueStanding[] = [
      mockStanding({ team_id: 1, team_name: 'Team A' })
    ];

    getStandingsMock.mockResolvedValue(standings);

    render(<LeagueStandings competitionId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Team A')).toBeInTheDocument();
    });

    expect(getStandingsMock).toHaveBeenCalledTimes(1);

    const refreshButton = screen.getByRole('button', { name: /Refresh/i });
    await userEvent.click(refreshButton);

    await waitFor(() => {
      expect(getStandingsMock).toHaveBeenCalledTimes(2);
    });
  });

  it('allows admin to edit points', async () => {
    const standings: LeagueStanding[] = [
      mockStanding({ team_id: 1, team_name: 'Team A', points: 25 })
    ];

    getStandingsMock.mockResolvedValue(standings);

    render(<LeagueStandings competitionId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Team A')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: /Edit points/i });
    expect(editButtons.length).toBeGreaterThan(0);

    await userEvent.click(editButtons[0]);

    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    expect(inputs[0].value).toBe('25');
  });

  it('persists edited points via API', async () => {
    const standings: LeagueStanding[] = [
      mockStanding({ team_id: 1, team_name: 'Team A', points: 25 })
    ];
    const updated: LeagueStanding[] = [
      mockStanding({ team_id: 1, team_name: 'Team A', points: 30 })
    ];

    getStandingsMock.mockResolvedValue(standings);
    updateStandingPointsMock.mockResolvedValue(updated);

    render(<LeagueStandings competitionId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Team A')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /Edit points/i });
    await userEvent.click(editButton);

    const input = screen.getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '30');

    const saveButton = screen.getByRole('button', { name: '✓' });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(updateStandingPointsMock).toHaveBeenCalledWith(1, 1, 30);
    });
  });

  it('updates standings from a game result', async () => {
    const standings: LeagueStanding[] = [
      mockStanding({ team_id: 1, team_name: 'Team A', points: 25 })
    ];
    const updated: LeagueStanding[] = [
      mockStanding({ team_id: 1, team_name: 'Team A', points: 27 })
    ];

    getStandingsMock.mockResolvedValue(standings);
    updateStandingsMock.mockResolvedValue(updated);

    render(<LeagueStandings competitionId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Team A')).toBeInTheDocument();
    });

    await userEvent.type(screen.getByLabelText('Game ID'), '12');
    await userEvent.click(screen.getByRole('button', { name: /Update from game/i }));

    await waitFor(() => {
      expect(updateStandingsMock).toHaveBeenCalledWith(1, 12);
    });
  });

  it('shows edit buttons for admin/coach users', async () => {
    const standings: LeagueStanding[] = [
      mockStanding({ team_id: 1, team_name: 'Team A' })
    ];

    getStandingsMock.mockResolvedValue(standings);

    // The default mock already sets role to 'coach', so edit buttons should appear
    render(<LeagueStandings competitionId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Team A')).toBeInTheDocument();
    });

    const editButtons = screen.queryAllByRole('button', { name: /Edit points/i });
    expect(editButtons.length).toBeGreaterThan(0);
  });

  it('displays legend for zones', async () => {
    const standings: LeagueStanding[] = [
      mockStanding({ team_id: 1, team_name: 'Team A' })
    ];

    getStandingsMock.mockResolvedValue(standings);

    render(
      <LeagueStandings
        competitionId={1}
        promotionZones={[{ from: 1, to: 1, type: 'promotion' }]}
        relegationZone={{ from: 14, to: 14 }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Promotion/)).toBeInTheDocument();
      expect(screen.getByText(/Relegation/)).toBeInTheDocument();
    });
  });

  it('handles null values in standings data', async () => {
    const standings: LeagueStanding[] = [
      {
        ...mockStanding(),
        points: null as unknown as number,
        goal_difference: null as unknown as number
      }
    ];

    getStandingsMock.mockResolvedValue(standings);

    render(<LeagueStandings competitionId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Team A')).toBeInTheDocument();
      // Should show 0 for null values
      const cells = screen.getAllByText('0');
      expect(cells.length).toBeGreaterThan(0);
    });
  });
});
