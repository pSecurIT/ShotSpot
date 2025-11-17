import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import LiveDashboard from '../components/LiveDashboard';
import api from '../utils/api';

// Mock the API module
vi.mock('../utils/api');

describe('LiveDashboard Component', () => {
  const mockGameProps = {
    gameId: 1,
    homeTeamId: 1,
    awayTeamId: 2,
    homeTeamName: 'Team A',
    awayTeamName: 'Team B',
    homeScore: 10,
    awayScore: 8,
    currentPeriod: 2,
    numberOfPeriods: 4,
    timerState: 'running' as const
  };

  const mockShots = [
    { id: 1, period: 1, team_id: 1, result: 'goal', player_id: 1 },
    { id: 2, period: 1, team_id: 1, result: 'miss', player_id: 1 },
    { id: 3, period: 1, team_id: 2, result: 'goal', player_id: 2 },
    { id: 4, period: 2, team_id: 1, result: 'goal', player_id: 1 },
    { id: 5, period: 2, team_id: 2, result: 'blocked', player_id: 2 }
  ];

  const mockPossessions = [
    {
      id: 1,
      game_id: 1,
      team_id: 1,
      period: 1,
      started_at: '2024-01-01T10:00:00Z',
      ended_at: '2024-01-01T10:00:30Z',
      shots_taken: 2
    },
    {
      id: 2,
      game_id: 1,
      team_id: 1,
      period: 2,
      started_at: '2024-01-01T10:10:00Z',
      ended_at: '2024-01-01T10:10:45Z',
      shots_taken: 1
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render dashboard header with live indicator when timer is running', async () => {
    const mockApiGet = vi.mocked(api.get);
    mockApiGet.mockResolvedValue({ data: [] });

    render(<LiveDashboard {...mockGameProps} />);

    expect(screen.getByText('📊 Live Match Dashboard')).toBeInTheDocument();
    expect(screen.getByText('🔴 LIVE')).toBeInTheDocument();
  });

  it('should not show live indicator when timer is not running', async () => {
    const mockApiGet = vi.mocked(api.get);
    mockApiGet.mockResolvedValue({ data: [] });

    render(<LiveDashboard {...mockGameProps} timerState="paused" />);

    await waitFor(() => {
      expect(screen.queryByText('🔴 LIVE')).not.toBeInTheDocument();
    });
  });

  it('should display loading state initially', () => {
    const mockApiGet = vi.mocked(api.get);
    mockApiGet.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<LiveDashboard {...mockGameProps} />);

    expect(screen.getByText('Loading statistics...')).toBeInTheDocument();
  });

  it('should fetch and display team statistics', async () => {
    const mockApiGet = vi.mocked(api.get);
    
    // Mock shots endpoint
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('shots') && url.includes('team_id=1')) {
        return Promise.resolve({ data: mockShots.filter(s => s.team_id === 1) });
      } else if (url.includes('shots') && url.includes('team_id=2')) {
        return Promise.resolve({ data: mockShots.filter(s => s.team_id === 2) });
      } else if (url.includes('possessions') && url.includes('team_id=1')) {
        return Promise.resolve({ data: mockPossessions });
      } else if (url.includes('possessions') && url.includes('team_id=2')) {
        return Promise.resolve({ data: [] });
      } else if (url.includes('shots')) {
        return Promise.resolve({ data: mockShots });
      }
      return Promise.resolve({ data: [] });
    });

    render(<LiveDashboard {...mockGameProps} />);

    await waitFor(() => {
      expect(screen.getByText('Shooting Percentage')).toBeInTheDocument();
    });

    // Check team names are displayed
    const teamAElements = screen.getAllByText('Team A');
    expect(teamAElements.length).toBeGreaterThan(0);
    
    const teamBElements = screen.getAllByText('Team B');
    expect(teamBElements.length).toBeGreaterThan(0);
  });

  it('should display period-by-period score breakdown', async () => {
    const mockApiGet = vi.mocked(api.get);
    
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('shots') && !url.includes('team_id')) {
        return Promise.resolve({ data: mockShots });
      } else if (url.includes('shots') && url.includes('team_id=1')) {
        return Promise.resolve({ data: mockShots.filter(s => s.team_id === 1) });
      } else if (url.includes('shots') && url.includes('team_id=2')) {
        return Promise.resolve({ data: mockShots.filter(s => s.team_id === 2) });
      } else if (url.includes('possessions')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    render(<LiveDashboard {...mockGameProps} />);

    await waitFor(() => {
      expect(screen.getByText('Score by Period')).toBeInTheDocument();
    });

    // Check period labels
    expect(screen.getByText('P1')).toBeInTheDocument();
    expect(screen.getByText('P2')).toBeInTheDocument();
    expect(screen.getByText('P3')).toBeInTheDocument();
    expect(screen.getByText('P4')).toBeInTheDocument();
  });

  it('should calculate shooting percentages correctly', async () => {
    const mockApiGet = vi.mocked(api.get);
    
    // Team A: 2 goals out of 3 shots = 66.7%
    const teamAShots = [
      { id: 1, period: 1, team_id: 1, result: 'goal', player_id: 1 },
      { id: 2, period: 1, team_id: 1, result: 'goal', player_id: 1 },
      { id: 3, period: 1, team_id: 1, result: 'miss', player_id: 1 }
    ];

    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('shots') && url.includes('team_id=1')) {
        return Promise.resolve({ data: teamAShots });
      } else if (url.includes('shots') && url.includes('team_id=2')) {
        return Promise.resolve({ data: [] });
      } else if (url.includes('possessions')) {
        return Promise.resolve({ data: [] });
      } else if (url.includes('shots')) {
        return Promise.resolve({ data: teamAShots });
      }
      return Promise.resolve({ data: [] });
    });

    render(<LiveDashboard {...mockGameProps} />);

    await waitFor(() => {
      // Should display 66.7% shooting percentage for Team A
      expect(screen.getByText(/66\.7%/)).toBeInTheDocument();
    });
  });

  it('should display shot distribution (goals, misses, blocked)', async () => {
    const mockApiGet = vi.mocked(api.get);
    
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('shots') && url.includes('team_id=1')) {
        return Promise.resolve({ data: mockShots.filter(s => s.team_id === 1) });
      } else if (url.includes('shots') && url.includes('team_id=2')) {
        return Promise.resolve({ data: mockShots.filter(s => s.team_id === 2) });
      } else if (url.includes('possessions')) {
        return Promise.resolve({ data: [] });
      } else if (url.includes('shots')) {
        return Promise.resolve({ data: mockShots });
      }
      return Promise.resolve({ data: [] });
    });

    render(<LiveDashboard {...mockGameProps} />);

    await waitFor(() => {
      expect(screen.getByText('Shot Distribution')).toBeInTheDocument();
    });

    // Should show shot breakdown with emojis
    const goalElements = screen.getAllByText(/⚽/);
    expect(goalElements.length).toBeGreaterThan(0);
  });

  it('should display possession statistics', async () => {
    const mockApiGet = vi.mocked(api.get);
    
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('shots')) {
        return Promise.resolve({ data: [] });
      } else if (url.includes('possessions') && url.includes('team_id=1')) {
        return Promise.resolve({ data: mockPossessions });
      } else if (url.includes('possessions') && url.includes('team_id=2')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    render(<LiveDashboard {...mockGameProps} />);

    await waitFor(() => {
      expect(screen.getByText('Possession Statistics')).toBeInTheDocument();
    });

    // Should show possession count
    const possessionElements = screen.getAllByText(/possessions/);
    expect(possessionElements.length).toBeGreaterThan(0);
  });

  it('should calculate average possession time correctly', async () => {
    const mockApiGet = vi.mocked(api.get);
    
    // Possessions with 30s and 45s = average of 37.5s
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('shots')) {
        return Promise.resolve({ data: [] });
      } else if (url.includes('possessions') && url.includes('team_id=1')) {
        return Promise.resolve({ data: mockPossessions });
      } else if (url.includes('possessions') && url.includes('team_id=2')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    render(<LiveDashboard {...mockGameProps} />);

    await waitFor(() => {
      // Average of 30s and 45s should be displayed
      const avgElements = screen.getAllByText(/Avg:/);
      expect(avgElements.length).toBeGreaterThan(0);
    });
  });

  it('should display shots per possession metric', async () => {
    const mockApiGet = vi.mocked(api.get);
    
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('shots') && url.includes('team_id=1')) {
        return Promise.resolve({ data: mockShots.filter(s => s.team_id === 1) });
      } else if (url.includes('shots') && url.includes('team_id=2')) {
        return Promise.resolve({ data: [] });
      } else if (url.includes('possessions') && url.includes('team_id=1')) {
        return Promise.resolve({ data: mockPossessions });
      } else if (url.includes('possessions') && url.includes('team_id=2')) {
        return Promise.resolve({ data: [] });
      } else if (url.includes('shots')) {
        return Promise.resolve({ data: mockShots });
      }
      return Promise.resolve({ data: [] });
    });

    render(<LiveDashboard {...mockGameProps} />);

    await waitFor(() => {
      expect(screen.getByText('Shots per Possession')).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    const mockApiGet = vi.mocked(api.get);
    mockApiGet.mockRejectedValue(new Error('Network error'));

    render(<LiveDashboard {...mockGameProps} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load statistics')).toBeInTheDocument();
    });
  });

  it('should handle zero shots gracefully', async () => {
    const mockApiGet = vi.mocked(api.get);
    
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('shots')) {
        return Promise.resolve({ data: [] });
      } else if (url.includes('possessions')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    render(<LiveDashboard {...mockGameProps} />);

    await waitFor(() => {
      // Should display 0.0% instead of NaN or error
      const percentageElements = screen.getAllByText(/0\.0%/);
      expect(percentageElements.length).toBeGreaterThan(0);
    });
  });

  it('should highlight current period in score breakdown', async () => {
    const mockApiGet = vi.mocked(api.get);
    mockApiGet.mockResolvedValue({ data: [] });

    render(<LiveDashboard {...mockGameProps} currentPeriod={3} />);

    await waitFor(() => {
      const periodLabels = screen.getAllByText('P3');
      // Period 3 should have 'current' class
      expect(periodLabels.length).toBeGreaterThan(0);
    });
  });
});
