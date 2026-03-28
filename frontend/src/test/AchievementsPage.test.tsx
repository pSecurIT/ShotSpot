import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AchievementsPage from '../components/AchievementsPage';

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

import api from '../utils/api';

const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockWriteText = vi.fn().mockResolvedValue(undefined);

const achievements = [
  {
    id: 1,
    name: 'Sharpshooter',
    description: 'Score 10 goals in a single game',
    badge_icon: '🎯',
    category: 'shooting' as const,
    criteria: { goals_in_game: 10 },
    points: 50,
  },
  {
    id: 2,
    name: 'Century Club',
    description: 'Reach 100 total goals',
    badge_icon: '💯',
    category: 'milestone' as const,
    criteria: { career_goals: 100 },
    points: 100,
  },
];

const players = [
  { id: 10, first_name: 'John', last_name: 'Doe', jersey_number: 7, team_id: 1, team_name: 'Team A' },
  { id: 11, first_name: 'Jane', last_name: 'Smith', jersey_number: 11, team_id: 2, team_name: 'Team B' },
];

const teams = [
  { id: 1, name: 'Team A' },
  { id: 2, name: 'Team B' },
];

const globalLeaderboard = {
  season: 'Current Season',
  leaderboard: [
    {
      rank: 1,
      id: 10,
      first_name: 'John',
      last_name: 'Doe',
      team_name: 'Team A',
      jersey_number: 7,
      total_shots: 80,
      total_goals: 52,
      fg_percentage: 65,
      achievement_points: 150,
      games_played: 12,
    },
  ],
};

const teamLeaderboard = {
  team_id: 1,
  leaderboard: [
    {
      rank: 1,
      id: 10,
      first_name: 'John',
      last_name: 'Doe',
      jersey_number: 7,
      total_shots: 80,
      total_goals: 52,
      fg_percentage: 65,
      achievement_points: 150,
      achievements_earned: 1,
    },
  ],
};

const playerAchievements = {
  achievements: [
    {
      id: 101,
      name: 'Sharpshooter',
      description: 'Score 10 goals in a single game',
      badge_icon: '🎯',
      category: 'shooting' as const,
      criteria: { goals_in_game: 10 },
      points: 50,
      earned_at: '2026-03-20T10:00:00.000Z',
    },
  ],
  total_points: 50,
};

function mockApiResponses() {
  mockGet.mockImplementation((url: string) => {
    if (url === '/achievements/list') return Promise.resolve({ data: achievements });
    if (url === '/players') return Promise.resolve({ data: players });
    if (url === '/teams') return Promise.resolve({ data: teams });
    if (url === '/achievements/leaderboard') return Promise.resolve({ data: globalLeaderboard });
    if (url === '/achievements/player/10') return Promise.resolve({ data: playerAchievements });
    if (url === '/achievements/player/11') return Promise.resolve({ data: { achievements: [], total_points: 0 } });
    if (url === '/achievements/team/1/leaderboard') return Promise.resolve({ data: teamLeaderboard });
    if (url === '/achievements/team/2/leaderboard') return Promise.resolve({ data: { team_id: 2, leaderboard: [] } });
    return Promise.reject(new Error(`Unhandled URL: ${url}`));
  });
}

describe('AchievementsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteText.mockResolvedValue(undefined);
    mockApiResponses();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: mockWriteText,
      },
    });
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  it('renders the achievements hub with gallery and leaderboard data', async () => {
    render(
      <BrowserRouter>
        <AchievementsPage />
      </BrowserRouter>
    );

    expect(await screen.findByText(/Achievements Hub/i)).toBeInTheDocument();
    expect(await screen.findByText('Sharpshooter')).toBeInTheDocument();
    expect(await screen.findByText('Player achievement showcase')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /global leaderboard/i })).toBeInTheDocument();
  });

  it('filters achievements by search and category', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <AchievementsPage />
      </BrowserRouter>
    );

    await screen.findByText('Century Club');

    await user.type(screen.getByLabelText('Search achievements'), 'century');

    await waitFor(() => {
      expect(screen.getByText('Century Club')).toBeInTheDocument();
      expect(screen.queryByText('Sharpshooter')).not.toBeInTheDocument();
    });

    await user.clear(screen.getByLabelText('Search achievements'));
    await user.click(screen.getByRole('button', { name: 'Shooting' }));

    await waitFor(() => {
      expect(screen.getByText('Sharpshooter')).toBeInTheDocument();
      expect(screen.queryByText('Century Club')).not.toBeInTheDocument();
    });
  });

  it('loads selected player progress and badge collection', async () => {
    render(
      <BrowserRouter>
        <AchievementsPage />
      </BrowserRouter>
    );

    expect(await screen.findByText('Badge collection display')).toBeInTheDocument();
    expect(await screen.findByText('50')).toBeInTheDocument();
    expect(await screen.findByText('1 unlocked')).toBeInTheDocument();
  });

  it('switches to the team leaderboard and loads team data', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <AchievementsPage />
      </BrowserRouter>
    );

    await screen.findByText('Leaderboards');
    await user.click(screen.getByRole('button', { name: 'Team leaderboard' }));

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/achievements/team/1/leaderboard');
    });
  });

  it('copies the player summary for social sharing', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <AchievementsPage />
      </BrowserRouter>
    );

    await screen.findByText('Copy summary');
    await user.click(screen.getByRole('button', { name: 'Copy summary' }));

    expect(await screen.findByText('Achievement summary copied.')).toBeInTheDocument();
  });
});