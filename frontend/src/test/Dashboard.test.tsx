import { render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();

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

  it('refreshes achievements when achievement-unlocked is received', async () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await screen.findByText(/Sharpshooter/i);

    const getSpy = vi.spyOn(mockApi, 'get');
    emit('achievement-unlocked');

    await waitFor(() => {
      expect(getSpy).toHaveBeenCalledWith('/achievements/recent', expect.anything());
    });
  });
});
