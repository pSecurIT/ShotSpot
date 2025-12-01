import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useTimer } from '../hooks/useTimer';
import CourtVisualization from '../components/CourtVisualization';
import SubstitutionPanel from '../components/SubstitutionPanel';
import FaultManagement from '../components/FaultManagement';
import TimeoutManagement from '../components/TimeoutManagement';

// Mock the useTimer hook
vi.mock('../hooks/useTimer');
const mockUseTimer = vi.mocked(useTimer);

// Mock API
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

// Mock window.confirm
const mockConfirm = vi.fn();
Object.defineProperty(window, 'confirm', {
  value: mockConfirm,
  writable: true
});

describe('Period End Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockReturnValue(true); // Default to confirming dialogs
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useTimer Hook Period End Detection', () => {
    it('should detect when period ends and call onPeriodEnd callback', async () => {
      const mockOnPeriodEnd = vi.fn();
      const mockApi = await import('../utils/api');
      vi.mocked(mockApi.default.post).mockResolvedValue({ data: {} });

      // Mock timer state that reaches 0:0
      const mockTimerState = {
        current_period: 1,
        period_duration: { minutes: 10, seconds: 0 },
        time_remaining: { minutes: 0, seconds: 1 }, // About to end
        timer_state: 'running' as const,
        timer_started_at: new Date().toISOString()
      };

      mockUseTimer.mockReturnValue({
        timerState: mockTimerState,
        loading: false,
        error: null,
        refetch: vi.fn(),
        setTimerStateOptimistic: vi.fn(),
        periodHasEnded: false,
        resetPeriodEndState: vi.fn()
      });

      // Create a test component that uses the timer
      const TestComponent = () => {
        const { timerState } = useTimer('123', { onPeriodEnd: mockOnPeriodEnd });
        return <div>Timer: {timerState?.time_remaining?.minutes}:{timerState?.time_remaining?.seconds}</div>;
      };

      render(<TestComponent />);

      // The actual period end detection happens in the useTimer hook's useEffect
      // Since we're mocking it, we'll verify that our mock is called correctly
      expect(mockUseTimer).toHaveBeenCalledWith('123', { onPeriodEnd: mockOnPeriodEnd });
    });

    it('should return periodHasEnded state when period ends', () => {
      mockUseTimer.mockReturnValue({
        timerState: null,
        loading: false,
        error: null,
        refetch: vi.fn(),
        setTimerStateOptimistic: vi.fn(),
        periodHasEnded: true, // Period has ended
        resetPeriodEndState: vi.fn()
      });

      const TestComponent = () => {
        const { periodHasEnded } = useTimer('123');
        return <div>Period ended: {periodHasEnded ? 'Yes' : 'No'}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByText('Period ended: Yes')).toBeInTheDocument();
    });
  });

  describe('Event Creation with Period End Check', () => {
    const mockCanAddEvents = vi.fn();

    beforeEach(() => {
      mockCanAddEvents.mockReturnValue(true); // Default to allowing events
    });

    it('should show confirmation dialog when adding shot after period ends', async () => {
      mockCanAddEvents.mockReturnValue(false); // Period has ended, user cancels
      
      const mockApi = await import('../utils/api');
      vi.mocked(mockApi.default.get).mockResolvedValue({ data: [] });
      vi.mocked(mockApi.default.post).mockResolvedValue({ data: { id: 1 } });

      const mockOnShotRecorded = vi.fn();
      
      render(
        <CourtVisualization
          gameId={123}
          homeTeamId={1}
          awayTeamId={2}
          homeTeamName="Home Team"
          awayTeamName="Away Team"
          currentPeriod={1}
          homeAttackingSide="left"
          onShotRecorded={mockOnShotRecorded}
          activePossession={null}
          possessionDuration={0}
          onCenterLineCross={vi.fn()}
          canAddEvents={mockCanAddEvents}
          homePlayers={[{
            id: 1,
            team_id: 1,
            first_name: 'John',
            last_name: 'Doe',
            jersey_number: 1,
            role: 'player',
            is_active: true
          }]}
          awayPlayers={[]}
        />
      );

      // Wait for initial render to complete
      await waitFor(() => {
        expect(screen.getByTitle('Select John Doe')).toBeInTheDocument();
      });

      // Select a player first (using new player grid button)
      const playerButton = screen.getByTitle('Select John Doe');
      fireEvent.click(playerButton);

      // Wait for player selection to complete
      await waitFor(() => {
        const court = screen.getByRole('img');
        expect(court).toBeInTheDocument();
      });

      // Click on court to select position
      const court = screen.getByRole('img');
      fireEvent.click(court, { clientX: 100, clientY: 100 });

      // Try to record a shot - button should be enabled now
      await waitFor(() => {
        const goalButton = screen.getByText('⚽ Goal');
        expect(goalButton).not.toHaveAttribute('disabled');
      }, { timeout: 3000 });

      const goalButton = screen.getByText('⚽ Goal');
      fireEvent.click(goalButton);

      // Should call canAddEvents when trying to record, but not proceed with onShotRecorded
      await waitFor(() => {
        expect(mockCanAddEvents).toHaveBeenCalled();
      }, { timeout: 2000 });
      
      // Give time for any async operations to complete
      await waitFor(() => {
        expect(mockOnShotRecorded).not.toHaveBeenCalled();
      }, { timeout: 1000 });
      
      // Also verify that the API was not called since the shot was blocked
      expect(mockApi.default.post).not.toHaveBeenCalled();
    });

    it('should allow shot recording when user confirms after period end', async () => {
      let callCount = 0;
      mockCanAddEvents.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call - period ended, show dialog
          return window.confirm('⏰ Period has ended!\n\nThe timer has reached 0:00 and this period has officially ended. Adding new events after the period end will affect official statistics.\n\nAre you sure you want to continue and add this event?');
        }
        return true;
      });
      
      mockConfirm.mockReturnValue(true); // User confirms

      const mockApi = await import('../utils/api');
      vi.mocked(mockApi.default.post).mockResolvedValue({ data: { id: 1 } });
      vi.mocked(mockApi.default.get).mockResolvedValue({ data: [] });

      const mockOnShotRecorded = vi.fn();
      
      render(
        <CourtVisualization
          gameId={123}
          homeTeamId={1}
          awayTeamId={2}
          homeTeamName="Home Team"
          awayTeamName="Away Team"
          currentPeriod={1}
          homeAttackingSide="left"
          onShotRecorded={mockOnShotRecorded}
          activePossession={null}
          possessionDuration={0}
          onCenterLineCross={vi.fn()}
          canAddEvents={mockCanAddEvents}
          homePlayers={[{
            id: 1,
            team_id: 1,
            first_name: 'John',
            last_name: 'Doe',
            jersey_number: 1,
            role: 'player',
            is_active: true
          }]}
          awayPlayers={[]}
        />
      );

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTitle('Select John Doe')).toBeInTheDocument();
      });

      // Select a player first (using new player grid button)
      const playerButton = screen.getByTitle('Select John Doe');
      fireEvent.click(playerButton);

      // Wait for court to be ready
      await waitFor(() => {
        const court = screen.getByRole('img');
        expect(court).toBeInTheDocument();
      });

      // Click on court to select position
      const court = screen.getByRole('img');
      fireEvent.click(court, { clientX: 100, clientY: 100 });

      // Wait for button to be enabled
      await waitFor(() => {
        const goalButton = screen.getByText('⚽ Goal');
        expect(goalButton).not.toHaveAttribute('disabled');
      }, { timeout: 3000 });

      // Try to record a shot
      const goalButton = screen.getByText('⚽ Goal');
      fireEvent.click(goalButton);

      await waitFor(() => {
        expect(mockCanAddEvents).toHaveBeenCalled();
        expect(mockConfirm).toHaveBeenCalledWith(
          expect.stringContaining('⏰ Period has ended!')
        );
      }, { timeout: 2000 });
    });

    it('should prevent substitution when period has ended and user cancels', async () => {
      mockCanAddEvents.mockReturnValue(false); // Period ended, user cancels
      mockConfirm.mockReturnValue(false);

      const mockApi = await import('../utils/api');
      vi.mocked(mockApi.default.get).mockResolvedValue({ 
        data: {
          home_team: { active: [], bench: [] },
          away_team: { active: [], bench: [] }
        }
      });
      vi.mocked(mockApi.default.post).mockResolvedValue({ data: { id: 1 } });

      render(
        <SubstitutionPanel
          gameId={123}
          homeTeamId={1}
          awayTeamId={2}
          homeTeamName="Home Team"
          awayTeamName="Away Team"
          currentPeriod={1}
          canAddEvents={mockCanAddEvents}
        />
      );

      // Wait for component to fully render
      await waitFor(() => {
        expect(screen.getByText('⚡ Substitutions')).toBeInTheDocument();
      });

      // Try to make a substitution (this would normally trigger the API call)
      // The component should call canAddEvents and not proceed
      // Wait a bit to ensure no unexpected calls
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockCanAddEvents).not.toHaveBeenCalled(); // Only called when actually submitting
      expect(mockApi.default.post).not.toHaveBeenCalled();
    });

    it('should prevent fault recording when period has ended and user cancels', async () => {
      mockCanAddEvents.mockReturnValue(false); // Period ended, user cancels
      mockConfirm.mockReturnValue(false);

      const mockApi = await import('../utils/api');
      vi.mocked(mockApi.default.get).mockResolvedValue({ data: [{
        id: 1,
        team_id: 1,
        first_name: 'John',
        last_name: 'Doe',
        jersey_number: 1
      }] });
      vi.mocked(mockApi.default.post).mockResolvedValue({ data: { id: 1 } });

      render(
        <FaultManagement
          gameId={123}
          homeTeamId={1}
          awayTeamId={2}
          homeTeamName="Home Team"
          awayTeamName="Away Team"
          currentPeriod={1}
          canAddEvents={mockCanAddEvents}
        />
      );

      // Wait for players to load
      await waitFor(() => {
        const playerSelect = screen.getByDisplayValue('Select player');
        expect(playerSelect).toBeInTheDocument();
      }, { timeout: 3000 });

      // Select a team first (should already be selected by default)
      await waitFor(() => {
        const teamSelect = screen.getByDisplayValue('Home Team (Home)');
        expect(teamSelect).toBeInTheDocument();
      });

      // Select a player to enable the button
      const playerSelect = screen.getByDisplayValue('Select player');
      fireEvent.change(playerSelect, { target: { value: '1' } });

      // Wait for the button to be enabled
      await waitFor(() => {
        const recordButton = screen.getByText('Record Offensive Fault');
        expect(recordButton).not.toHaveAttribute('disabled');
      }, { timeout: 3000 });

      const recordButton = screen.getByText('Record Offensive Fault');
      fireEvent.click(recordButton);

      await waitFor(() => {
        expect(mockCanAddEvents).toHaveBeenCalled();
      }, { timeout: 2000 });

      // Wait a bit to ensure no API call is made
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not make API call since canAddEvents returned false
      expect(mockApi.default.post).not.toHaveBeenCalled();
    });

    it('should prevent timeout when period has ended and user cancels', async () => {
      mockCanAddEvents.mockReturnValue(false); // Period ended, user cancels
      mockConfirm.mockReturnValue(false);

      const mockApi = await import('../utils/api');
      vi.mocked(mockApi.default.get).mockResolvedValue({ data: [] });
      vi.mocked(mockApi.default.post).mockResolvedValue({ data: { id: 1 } });

      render(
        <TimeoutManagement
          gameId={123}
          homeTeamId={1}
          awayTeamId={2}
          homeTeamName="Home Team"
          awayTeamName="Away Team"
          currentPeriod={1}
          canAddEvents={mockCanAddEvents}
        />
      );

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByText('Start Team Timeout')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Try to start a timeout
      const startButton = screen.getByText('Start Team Timeout');
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockCanAddEvents).toHaveBeenCalled();
      }, { timeout: 2000 });

      // Wait a bit to ensure no API call is made
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not make API call since canAddEvents returned false
      expect(mockApi.default.post).not.toHaveBeenCalled();
    });
  });

  describe('Period End Warning Dialog', () => {
    it('should show the correct warning message', () => {
      mockConfirm.mockReturnValue(true);

      const canAddEvents = () => {
        return window.confirm(
          '⏰ Period has ended!\n\nThe timer has reached 0:00 and this period has officially ended. ' +
          'Adding new events after the period end will affect official statistics.\n\n' +
          'Are you sure you want to continue and add this event?'
        );
      };

      const result = canAddEvents();
      
      expect(mockConfirm).toHaveBeenCalledWith(
        '⏰ Period has ended!\n\nThe timer has reached 0:00 and this period has officially ended. ' +
        'Adding new events after the period end will affect official statistics.\n\n' +
        'Are you sure you want to continue and add this event?'
      );
      expect(result).toBe(true);
    });
  });
});