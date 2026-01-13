import { vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FaultManagement from '../components/FaultManagement';
import api from '../utils/api';
import { waitForSelectOptions } from './helpers/testHelpers';

// Mock the api module
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe('FaultManagement', () => {
  const mockProps = {
    gameId: 1,
    homeTeamId: 1,
    awayTeamId: 2,
    homeTeamName: 'Team Alpha',
    awayTeamName: 'Team Beta',
    currentPeriod: 1,
    timeRemaining: '00:08:30',
    onFaultRecorded: vi.fn()
  };

  const mockHomePlayers = [
    { id: 1, team_id: 1, first_name: 'John', last_name: 'Doe', jersey_number: 10, gender: 'M' },
    { id: 2, team_id: 1, first_name: 'Jane', last_name: 'Smith', jersey_number: 11, gender: 'F' }
  ];

  const mockAwayPlayers = [
    { id: 3, team_id: 2, first_name: 'Bob', last_name: 'Johnson', jersey_number: 20, gender: 'M' },
    { id: 4, team_id: 2, first_name: 'Alice', last_name: 'Wilson', jersey_number: 21, gender: 'F' }
  ];

  const mockRecentFaults = [
    {
      id: 1,
      game_id: 1,
      event_type: 'fault_offensive',
      team_id: 1,
      player_id: 1,
      period: 1,
      time_remaining: '00:09:00',
      details: { reason: 'running_with_ball' },
      team_name: 'Team Alpha',
      first_name: 'John',
      last_name: 'Doe',
      jersey_number: 10,
      created_at: '2024-01-15T10:30:00Z'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock API responses
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/game-rosters')) {
        if (url.includes('team_id=1')) {
          return Promise.resolve({ data: mockHomePlayers });
        } else if (url.includes('team_id=2')) {
          return Promise.resolve({ data: mockAwayPlayers });
        }
      } else if (url.includes('/events')) {
        return Promise.resolve({ data: mockRecentFaults });
      }
      return Promise.resolve({ data: [] });
    });
    
    (api.post as jest.Mock).mockResolvedValue({
      data: { id: 1, event_type: 'fault_offensive', message: 'Fault recorded successfully' }
    });
  });

  it('renders fault management interface correctly', async () => {
    render(<FaultManagement {...mockProps} />);
    
    expect(screen.getByText('Record Fault')).toBeInTheDocument();
    expect(screen.getByText('Fault Type:')).toBeInTheDocument();
    expect(screen.getByText('Team:')).toBeInTheDocument();
    
    // Check fault type buttons
    expect(screen.getByText('🔴 Offensive')).toBeInTheDocument();
    expect(screen.getByText('🛡️ Defensive')).toBeInTheDocument();
    expect(screen.getByText('⏹️ Out of Bounds')).toBeInTheDocument();
  });

  it('loads and displays team players correctly', async () => {
    const user = userEvent.setup();
    render(<FaultManagement {...mockProps} />);
    
    // Wait for players to load
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(`/game-rosters/1?team_id=1&is_starting=true`);
      expect(api.get).toHaveBeenCalledWith(`/game-rosters/1?team_id=2&is_starting=true`);
    });
    
    // Select away team to see players
    const teamSelect = screen.getByDisplayValue('Team Alpha (Home)');
    await user.selectOptions(teamSelect, '2');
    
    // Check if away team players are available in dropdown
    await waitFor(() => {
      expect(screen.getByText('#20 Bob Johnson')).toBeInTheDocument();
      expect(screen.getByText('#21 Alice Wilson')).toBeInTheDocument();
    });
  });

  it('switches between teams and shows correct players', async () => {
    const user = userEvent.setup();
    render(<FaultManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Switch to away team
    const teamSelect = screen.getByDisplayValue('Team Alpha (Home)');
    await user.selectOptions(teamSelect, '2');
    
    // Check if away team players are available
    await waitFor(() => {
      expect(screen.getByText('#20 Bob Johnson')).toBeInTheDocument();
      expect(screen.getByText('#21 Alice Wilson')).toBeInTheDocument();
    });
  });

  it('records offensive fault successfully', async () => {
    const user = userEvent.setup();
    render(<FaultManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Offensive fault is selected by default
    expect(screen.getByText('🔴 Offensive')).toHaveClass('active');
    
    // Wait for player options to load, then select
    await waitForSelectOptions(() => screen.getByDisplayValue('Select player'));
    const playerSelect = screen.getByDisplayValue('Select player');
    await user.selectOptions(playerSelect, '1');
    
    // Add reason
    const reasonInput = screen.getByPlaceholderText('Brief description of the fault');
    await user.type(reasonInput, 'Player took more than 3 steps');
    
    // Submit fault
    const recordButton = screen.getByRole('button', { name: 'Record Offensive Fault' });
    await user.click(recordButton);
    
    // Verify API call
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/events/1', expect.objectContaining({
        event_type: 'fault_offensive',
        player_id: 1,
        team_id: 1,
        period: 1,
        time_remaining: '00:08:30',
        details: expect.objectContaining({
          reason: 'Player took more than 3 steps',
          fault_type: 'fault_offensive'
        })
      }));
    });
    
    // Verify callback was called
    expect(mockProps.onFaultRecorded).toHaveBeenCalled();
  });

  it('records defensive fault successfully', async () => {
    const user = userEvent.setup();
    render(<FaultManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Select defensive fault
    await user.click(screen.getByText('🛡️ Defensive'));
    
    // Select team
    const teamSelect = screen.getByDisplayValue('Team Alpha (Home)');
    await user.selectOptions(teamSelect, '2');
    
    // Select player — wait for the player option to be rendered before selecting
    // Wait for player options to load, then select
    await waitForSelectOptions(() => screen.getByDisplayValue('Select player'));
    const playerSelect = screen.getByDisplayValue('Select player');
    await user.selectOptions(playerSelect, '3');
    
    // Submit fault
    const recordButton = screen.getByRole('button', { name: 'Record Defensive Fault' });
    await user.click(recordButton);
    
    // Verify API call
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/events/1', expect.objectContaining({
        event_type: 'fault_defensive',
        player_id: 3,
        team_id: 2
      }));
    });
  });

  it('records out of bounds fault successfully', async () => {
    const user = userEvent.setup();
    render(<FaultManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Select out of bounds
    await user.click(screen.getByText('⏹️ Out of Bounds'));
    
    // Submit fault (player selection is optional for out of bounds)
    const recordButton = screen.getByRole('button', { name: 'Record Out of Bounds' });
    await user.click(recordButton);
    
    // Verify API call
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/events/1', expect.objectContaining({
        event_type: 'fault_out_of_bounds',
        team_id: 1
      }));
    });
  });

  it('validates required fields before submission', async () => {
    render(<FaultManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Try to submit without selecting player (required for offensive fault)
    const recordButton = screen.getByRole('button', { name: 'Record Offensive Fault' });
    
    // Button should be disabled when no player selected
    expect(recordButton).toBeDisabled();
    
    // Verify API was not called when button is disabled
    expect(api.post).not.toHaveBeenCalled();
    expect(mockProps.onFaultRecorded).not.toHaveBeenCalled();
  });

  it('disables submit button when required fields are missing', async () => {
    act(() => {
      render(<FaultManagement {...mockProps} />);
    });
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Button should be disabled when no player selected for offensive fault
    const recordButton = screen.getByRole('button', { name: 'Record Offensive Fault' });
    expect(recordButton).toBeDisabled();
  });

  it('enables submit button when all required fields are selected', async () => {
    const user = userEvent.setup();
    render(<FaultManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Wait for player options to load, then select
    await waitForSelectOptions(() => screen.getByDisplayValue('Select player'));
    const playerSelect = screen.getByDisplayValue('Select player');
    await user.selectOptions(playerSelect, '1');
    
    // Button should now be enabled
    const recordButton = screen.getByRole('button', { name: 'Record Offensive Fault' });
    expect(recordButton).toBeEnabled();
  });

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup();
    
    // Mock API error
    (api.post as jest.Mock).mockRejectedValue({
      response: { data: { error: 'Network error' } }
    });
    
    render(<FaultManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Wait for player options to be rendered before selecting
    // Select player and submit
    const playerSelect = screen.getByDisplayValue('Select player');
    await waitForSelectOptions(() => screen.getByDisplayValue('Select player'));
    await user.selectOptions(playerSelect, '1');
    
    const recordButton = screen.getByRole('button', { name: 'Record Offensive Fault' });
    await user.click(recordButton);
    
    // Should show error message
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
    
    // Verify callback was not called on error
    expect(mockProps.onFaultRecorded).not.toHaveBeenCalled();
  });

  it('clears form after successful submission', async () => {
    const user = userEvent.setup();
    render(<FaultManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Wait for player options to load, then select
    await waitForSelectOptions(() => screen.getByDisplayValue('Select player'));
    const playerSelect = screen.getByDisplayValue('Select player');
    await user.selectOptions(playerSelect, '1');
    
    const reasonInput = screen.getByPlaceholderText('Brief description of the fault');
    await user.type(reasonInput, 'Test reason');
    
    const recordButton = screen.getByRole('button', { name: 'Record Offensive Fault' });
    await user.click(recordButton);
    
    // Wait for submission and verify form is cleared
    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });
    
    // Check that form fields are reset
    expect(playerSelect).toHaveValue('');
    expect(reasonInput).toHaveValue('');
  });

  it('updates time remaining when prop changes', () => {
    const { rerender } = render(<FaultManagement {...mockProps} />);
    
    // Update time remaining
    act(() => {
      rerender(<FaultManagement {...mockProps} timeRemaining="00:05:00" />);
    });
    
    // Component should handle the updated time
    expect(screen.getByText('Record Fault')).toBeInTheDocument();
  });

  it('handles missing onFaultRecorded callback gracefully', async () => {
    const propsWithoutCallback = { ...mockProps, onFaultRecorded: undefined };
    const user = userEvent.setup();
    
    render(<FaultManagement {...propsWithoutCallback} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Wait for player options to load, then select
    await waitForSelectOptions(() => screen.getByDisplayValue('Select player'));
    const playerSelect = screen.getByDisplayValue('Select player');
    await user.selectOptions(playerSelect, '1');
    
    const recordButton = screen.getByRole('button', { name: 'Record Offensive Fault' });
    await user.click(recordButton);
    
    // Should not throw error even without callback
    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });
  });

  it('switches between fault types correctly', async () => {
    const user = userEvent.setup();
    render(<FaultManagement {...mockProps} />);
    
    // Test different fault types
    await user.click(screen.getByText('🛡️ Defensive'));
    expect(screen.getByText('🛡️ Defensive')).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Record Defensive Fault' })).toBeInTheDocument();
    
    await user.click(screen.getByText('⏹️ Out of Bounds'));
    expect(screen.getByText('⏹️ Out of Bounds')).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Record Out of Bounds' })).toBeInTheDocument();
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    
    // Mock delayed API response
    (api.post as jest.Mock).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ data: { id: 1 } }), 100))
    );
    
    render(<FaultManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Wait for the player option to be available before selecting
    await waitFor(() => {
      expect(screen.getByDisplayValue('Select player').querySelector('option[value="1"]')).toBeInTheDocument();
    });
    
    const playerSelect = screen.getByDisplayValue('Select player');
    await waitForSelectOptions(() => screen.getByDisplayValue('Select player'));
    await user.selectOptions(playerSelect, '1');
    
    const recordButton = screen.getByRole('button', { name: 'Record Offensive Fault' });
    await user.click(recordButton);
    
    // Check for loading state
    expect(screen.getByText('Recording...')).toBeInTheDocument();
    expect(recordButton).toBeDisabled();
  });

  it('displays recent faults correctly', async () => {
    render(<FaultManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Check if recent faults are displayed
    await waitFor(() => {
      expect(screen.getByText('Recent Faults (Period 1)')).toBeInTheDocument();
      expect(screen.getByText('Offensive Fault')).toBeInTheDocument();
      expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    });
  });
});