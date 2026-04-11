import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Dashboard from '../components/Dashboard';
import api from '../utils/api';

vi.mock('../utils/api');

const mockUseAuth = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}));

const listeners = new Map<string, Array<() => void>>();
const mockSocket = {
  on: (event: string, cb: () => void) => {
    const list = listeners.get(event) ?? [];
    list.push(cb);
    listeners.set(event, list);
  },
  off: (event: string, cb: () => void) => {
    const list = listeners.get(event) ?? [];
    listeners.set(event, list.filter((x) => x !== cb));
  }
};

const emit = (event: string) => {
  (listeners.get(event) ?? []).forEach((cb) => cb());
};

vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: () => ({ socket: mockSocket, connected: true })
}));

describe('Dashboard', () => {
  const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    listeners.clear();

    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', role: 'user', passwordMustChange: false }
    });

    mockApi.get = vi.fn((url: string) => {
      if (url === '/games') {
        return Promise.resolve({
          data: [
            { id: 1, date: new Date().toISOString(), status: 'completed', home_club_name: 'A', away_club_name: 'B' }
          ]
        });
      }
      if (url === '/achievements/recent') {
        return Promise.resolve({
          data: [
            {
              id: 10,
              earned_at: new Date().toISOString(),
              player_id: 99,
              player_name: 'Test Achiever',
              name: 'Sharpshooter',
              description: '10 goals',
              badge_icon: '🏆',
              points: 10,
              game_id: 1,
              game_date: new Date().toISOString()
            }
          ]
        });
      }
      if (url === '/dashboard/summary') {
        return Promise.resolve({ data: { teams: 3, players: 10, games: 5 } });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it('renders widgets and loads data', async () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Performance hub')).toBeInTheDocument();
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh feed' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View analytics' })).toHaveAttribute('href', '/analytics');
    expect(screen.getByLabelText('Dashboard status')).toBeInTheDocument();

    const recentMatches = screen.getByLabelText('Recent Matches');
    await waitFor(() => {
      expect(within(recentMatches).getByText(/A vs B/i)).toBeInTheDocument();
    });

    const quickStats = screen.getByLabelText('Quick Stats');
    expect(within(quickStats).getByText('Quick Stats')).toBeInTheDocument();
    await waitFor(() => {
      expect(within(quickStats).getByText('Teams')).toBeInTheDocument();
      expect(within(quickStats).getByText('3')).toBeInTheDocument();
    });

    expect(screen.getByText('Recent Achievements')).toBeInTheDocument();
    expect(screen.getByText(/Sharpshooter/i)).toBeInTheDocument();
  });

  it('shows the coach/admin primary action when the user can manage matches', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, username: 'coach', role: 'coach', passwordMustChange: false }
    });

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await screen.findByText(/Sharpshooter/i);
    expect(screen.getByRole('link', { name: 'Open match center' })).toHaveAttribute('href', '/games');
  });

  it('refreshes all dashboard feeds when the refresh action is clicked', async () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await screen.findByText(/Sharpshooter/i);

    mockApi.get.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh feed' }));

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/games', { params: { limit: 5, sort: 'recent' } });
      expect(mockApi.get).toHaveBeenCalledWith('/games', { params: { status: 'upcoming' } });
      expect(mockApi.get).toHaveBeenCalledWith('/achievements/recent', { params: { limit: 8 } });
      expect(mockApi.get).toHaveBeenCalledWith('/dashboard/summary');
    });
  });

  it('refreshes achievements when achievement-unlocked is received', async () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await screen.findByText(/Sharpshooter/i);

    const getSpy = vi.spyOn(mockApi, 'get');
    act(() => {
      emit('achievement-unlocked');
    });

    await waitFor(() => {
      expect(getSpy).toHaveBeenCalledWith('/achievements/recent', expect.anything());
    });
  });

  it('shows a retry action for widget errors and recovers on retry', async () => {
    let achievementsShouldFail = true;

    mockApi.get = vi.fn((url: string) => {
      if (url === '/games') {
        return Promise.resolve({ data: [] });
      }
      if (url === '/achievements/recent') {
        if (achievementsShouldFail) {
          return Promise.reject(new Error('boom'));
        }

        return Promise.resolve({
          data: [
            {
              id: 10,
              earned_at: new Date().toISOString(),
              player_id: 99,
              player_name: 'Test Achiever',
              name: 'Sharpshooter',
              description: '10 goals',
              badge_icon: '🏆',
              points: 10,
              game_id: 1,
              game_date: new Date().toISOString(),
            },
          ],
        });
      }
      if (url === '/dashboard/summary') {
        return Promise.resolve({ data: { teams: 3, players: 10, games: 5 } });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    const achievementsWidget = screen.getByLabelText('Recent Achievements');

    await waitFor(() => {
      expect(within(achievementsWidget).getByRole('alert')).toHaveTextContent('Failed to load achievements feed');
    });

    achievementsShouldFail = false;
    fireEvent.click(within(achievementsWidget).getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(within(achievementsWidget).getByText(/Sharpshooter/i)).toBeInTheDocument();
    });
  });
});
