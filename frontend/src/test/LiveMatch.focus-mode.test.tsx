import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LiveMatch from '../components/LiveMatch';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../utils/api';

// Mock API module
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}));

// Mock react-router-dom hooks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ gameId: '1' }),
    useNavigate: () => vi.fn(),
  };
});

// Mock timer hook
vi.mock('../hooks/useTimer', () => ({
  useTimer: () => ({
    timerState: {
      current_period: 1,
      timer_state: 'running',
      time_remaining: { minutes: 8, seconds: 30 },
      period_duration: { minutes: 10, seconds: 0 }
    },
    refetch: vi.fn(),
    setTimerStateOptimistic: vi.fn()
  })
}));

// Mock CourtVisualization component
vi.mock('../components/CourtVisualization', () => ({
  default: ({ homeTeamName, awayTeamName }: { homeTeamName: string; awayTeamName: string }) => (
    <div data-testid="court-visualization">
      Court for {homeTeamName} vs {awayTeamName}
    </div>
  )
}));

// Mock all other components to avoid complexity
vi.mock('../components/SubstitutionPanel', () => ({
  default: () => <div data-testid="substitution-panel">Substitution Panel</div>
}));

vi.mock('../components/MatchTimeline', () => ({
  default: () => <div data-testid="match-timeline">Match Timeline</div>
}));

vi.mock('../components/FaultManagement', () => ({
  default: () => <div data-testid="fault-management">Fault Management</div>
}));

vi.mock('../components/TimeoutManagement', () => ({
  default: () => <div data-testid="timeout-management">Timeout Management</div>
}));

vi.mock('../components/FreeShotPanel', () => ({
  default: () => <div data-testid="free-shot-panel">Free Shot Panel</div>
}));

vi.mock('../components/MatchCommentary', () => ({
  default: () => <div data-testid="match-commentary">Match Commentary</div>
}));

// Mock API responses
const mockGame = {
  id: 1,
  home_team_id: 1,
  away_team_id: 2,
  home_team_name: 'Home Team',
  away_team_name: 'Away Team',
  date: '2024-01-15T19:00:00Z',
  status: 'in_progress',
  home_score: 2,
  away_score: 1,
  current_period: 1,
  period_duration: { minutes: 10, seconds: 0 },
  time_remaining: { minutes: 8, seconds: 30 },
  timer_state: 'running',
  home_attacking_side: 'left',
  number_of_periods: 4
};

const mockPlayers = [
  {
    id: 1,
    team_id: 1,
    first_name: 'John',
    last_name: 'Doe',
    jersey_number: 1,
    role: 'player',
    is_active: true,
    gender: 'male',
    starting_position: 'offense'
  },
  {
    id: 2,
    team_id: 2,
    first_name: 'Jane',
    last_name: 'Smith',
    jersey_number: 2,
    role: 'player',
    is_active: true,
    gender: 'female',
    starting_position: 'defense'
  }
];

describe('LiveMatch Focus Mode', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup default API responses
    (api.get as jest.MockedFunction<typeof api.get>).mockImplementation((url: string) => {
      if (url === '/games/1') {
        return Promise.resolve({ data: mockGame });
      }
      if (url === '/game-rosters/1') {
        return Promise.resolve({ data: mockPlayers });
      }
      if (url === '/possessions/1/active') {
        return Promise.reject({ response: { status: 404 } });
      }
      if (url === '/possessions/1/stats') {
        return Promise.resolve({ data: [] });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
  });

  const renderLiveMatch = () => {
    return render(
      <BrowserRouter>
        <LiveMatch />
      </BrowserRouter>
    );
  };

  it('should render focus mode toggle button', async () => {
    renderLiveMatch();
    
    await waitFor(() => {
      expect(screen.getByText('🎯 Focus Mode')).toBeInTheDocument();
    });
  });

  it('should toggle focus mode when button is clicked', async () => {
    renderLiveMatch();
    
    await waitFor(() => {
      expect(screen.getByText('🎯 Focus Mode')).toBeInTheDocument();
    });

    const focusButton = screen.getByText('🎯 Focus Mode');
    fireEvent.click(focusButton);

    await waitFor(() => {
      expect(document.querySelector('.focus-mode-toggle')).toHaveTextContent('📱 Exit Focus');
    });
  });

  it('should hide timer controls in focus mode', async () => {
    renderLiveMatch();
    
    await waitFor(() => {
      expect(screen.getByText('Timer Controls')).toBeInTheDocument();
    });

    const focusButton = screen.getByText('🎯 Focus Mode');
    fireEvent.click(focusButton);

    await waitFor(() => {
      expect(screen.queryByText('Timer Controls')).not.toBeInTheDocument();
    });
  });

  it('should handle keyboard shortcut (F key) to toggle focus mode', async () => {
    renderLiveMatch();
    
    await waitFor(() => {
      expect(screen.getByText('🎯 Focus Mode')).toBeInTheDocument();
    });

    // Press F key
    fireEvent.keyDown(document, { key: 'f', code: 'KeyF' });

    await waitFor(() => {
      expect(document.querySelector('.focus-mode-toggle')).toHaveTextContent('📱 Exit Focus');
    });
  });
});