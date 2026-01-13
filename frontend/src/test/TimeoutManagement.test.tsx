import { vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimeoutManagement from '../components/TimeoutManagement';
import api from '../utils/api';
import { waitForSelectOptions } from './helpers/testHelpers';

// Mock the api module
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

describe('TimeoutManagement', () => {
  const mockProps = {
    gameId: 1,
    homeTeamId: 1,
    awayTeamId: 2,
    homeTeamName: 'Team Alpha',
    awayTeamName: 'Team Beta',
    currentPeriod: 1,
    timeRemaining: '00:08:30',
    onTimeoutRecorded: vi.fn()
  };

  const mockTimeouts = [
    {
      id: 1,
      game_id: 1,
      team_id: 1,
      timeout_type: 'team',
      period: 1,
      time_remaining: '00:10:00',
      duration: '60',
      reason: 'strategic',
      called_by: 'Coach Smith',
      team_name: 'Team Alpha',
      created_at: '2024-01-15T10:30:00Z',
      ended_at: '2024-01-15T10:31:00Z'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock API responses
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/timeouts')) {
        return Promise.resolve({ data: mockTimeouts });
      }
      return Promise.resolve({ data: [] });
    });
    
    (api.post as jest.Mock).mockResolvedValue({
      data: { id: 2, game_id: 1, team_id: 1, message: 'Timeout started successfully' }
    });
    
    (api.put as jest.Mock).mockResolvedValue({
      data: { message: 'Timeout ended successfully' }
    });
    
    (api.delete as jest.Mock).mockResolvedValue({
      data: { message: 'Timeout deleted successfully' }
    });
  });

  it('renders timeout management interface correctly', async () => {
    render(<TimeoutManagement {...mockProps} />);
    
    expect(screen.getByText('Timeout Management')).toBeInTheDocument();
    expect(screen.getByText('Timeout Type:')).toBeInTheDocument();
    expect(screen.getByText('Team:')).toBeInTheDocument();
    expect(screen.getByText('Duration:')).toBeInTheDocument();
    expect(screen.getByText('Called By:')).toBeInTheDocument();
    
    // Check timeout type buttons
    expect(screen.getByText('👥 Team')).toBeInTheDocument();
    expect(screen.getByText('🏥 Injury')).toBeInTheDocument();
    expect(screen.getByText('👨‍⚖️ Official')).toBeInTheDocument();
    expect(screen.getByText('📺 TV')).toBeInTheDocument();
  });

  it('loads and displays timeout history correctly', async () => {
    render(<TimeoutManagement {...mockProps} />);
    
    // Wait for timeouts to load
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/timeouts/1');
    });
    
    // Check if timeout history is displayed
    await waitFor(() => {
      expect(screen.getByText('Recent Timeouts (Period 1)')).toBeInTheDocument();
      expect(screen.getByText('Team Timeout')).toBeInTheDocument();
      expect(screen.getByText('Team Alpha')).toBeInTheDocument();
      expect(screen.getByText('Called by: Coach Smith')).toBeInTheDocument();
    });
  });

  it('records team timeout successfully', async () => {
    const user = userEvent.setup();
    render(<TimeoutManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Team timeout is selected by default
    expect(screen.getByText('👥 Team')).toHaveClass('active');
    
    // Select duration
    const durationSelect = screen.getByDisplayValue('1 minute');
    await waitForSelectOptions(() => screen.getByDisplayValue('1 minute'));
    await user.selectOptions(durationSelect, '2 minutes');
    
    // Add called by
    const calledByInput = screen.getByPlaceholderText('Coach name');
    await user.type(calledByInput, 'Head Coach');
    
    // Add reason
    const reasonInput = screen.getByPlaceholderText('Brief description of timeout reason');
    await user.type(reasonInput, 'Discussing strategy for next attack');
    
    // Start timeout
    const startButton = screen.getByRole('button', { name: 'Start Team Timeout' });
    await user.click(startButton);
    
    // Verify API call
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/timeouts/1', expect.objectContaining({
        team_id: 1,
        timeout_type: 'team',
        period: 1,
        time_remaining: '00:08:30',
        duration: '2 minutes',
        reason: 'Discussing strategy for next attack',
        called_by: 'Head Coach'
      }));
    });
    
    // Verify callback was called
    expect(mockProps.onTimeoutRecorded).toHaveBeenCalled();
  });

  it('records different timeout types correctly', async () => {
    const user = userEvent.setup();
    render(<TimeoutManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Select injury timeout
    await user.click(screen.getByText('🏥 Injury'));
    
    const calledByInput = screen.getByPlaceholderText('Official name');
    await user.type(calledByInput, 'Team Doctor');
    
    const startButton = screen.getByRole('button', { name: 'Start Injury Timeout' });
    await user.click(startButton);
    
    // Verify API call with injury timeout
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/timeouts/1', expect.objectContaining({
        team_id: null,
        timeout_type: 'injury',
        called_by: 'Team Doctor'
      }));
    });
  });

  it('validates team selection for team timeouts', async () => {
    render(<TimeoutManagement {...mockProps} />);
    
    // Team timeout is selected by default but try without selecting team
    // The team should be pre-selected, so button should be enabled
    const startButton = screen.getByRole('button', { name: 'Start Team Timeout' });
    expect(startButton).toBeEnabled();
  });

  it('disables start button when team is not selected for team timeout', async () => {
    const propsWithoutTeam = { ...mockProps, homeTeamId: 0 };
    render(<TimeoutManagement {...propsWithoutTeam} />);
    
    // With invalid team ID, button should be disabled
    const startButton = screen.getByRole('button', { name: 'Start Team Timeout' });
    expect(startButton).toBeDisabled();
  });

  it('enables start button for non-team timeouts', async () => {
    const user = userEvent.setup();
    render(<TimeoutManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Select injury timeout (doesn't require team selection)
    await user.click(screen.getByText('🏥 Injury'));
    
    // Button should be enabled even without team selection
    const startButton = screen.getByRole('button', { name: 'Start Injury Timeout' });
    expect(startButton).toBeEnabled();
  });

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup();
    
    // Mock API error
    (api.post as jest.Mock).mockRejectedValue({
      response: { data: { error: 'Network error' } }
    });
    
    render(<TimeoutManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Try to start timeout
    const startButton = screen.getByRole('button', { name: 'Start Team Timeout' });
    await user.click(startButton);
    
    // Verify error is displayed
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
    
    // Verify callback was not called on error
    expect(mockProps.onTimeoutRecorded).not.toHaveBeenCalled();
  });

  it('clears form after successful submission', async () => {
    const user = userEvent.setup();
    render(<TimeoutManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Fill form
    const calledByInput = screen.getByPlaceholderText('Coach name');
    await user.type(calledByInput, 'Coach');
    
    const reasonInput = screen.getByPlaceholderText('Brief description of timeout reason');
    await user.type(reasonInput, 'Strategy discussion');
    
    const startButton = screen.getByRole('button', { name: 'Start Team Timeout' });
    await user.click(startButton);
    
    // Wait for submission and verify form is cleared
    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });
    
    // Check that form fields are reset
    expect(calledByInput).toHaveValue('');
    expect(reasonInput).toHaveValue('');
    // Duration should reset to default
    expect(screen.getByDisplayValue('1 minute')).toBeInTheDocument();
  });

  it('switches between timeout types correctly', async () => {
    const user = userEvent.setup();
    render(<TimeoutManagement {...mockProps} />);
    
    // Test different timeout types
    const timeoutTypes = [
      { button: '👥 Team', name: 'Start Team Timeout' },
      { button: '🏥 Injury', name: 'Start Injury Timeout' },
      { button: '👨‍⚖️ Official', name: 'Start Official Timeout' },
      { button: '📺 TV', name: 'Start TV Timeout' }
    ];
    
    for (const type of timeoutTypes) {
      await user.click(screen.getByText(type.button));
      expect(screen.getByRole('button', { name: type.name })).toBeInTheDocument();
    }
  });

  it('handles duration selection correctly', async () => {
    const user = userEvent.setup();
    render(<TimeoutManagement {...mockProps} />);
    
    const durationSelect = screen.getByDisplayValue('1 minute');
    
    // Test different durations
    await waitForSelectOptions(() => screen.getByDisplayValue('1 minute'));
    await user.selectOptions(durationSelect, '30 seconds');
    expect(durationSelect).toHaveValue('30 seconds');
    
    await user.selectOptions(durationSelect, '2 minutes');
    expect(durationSelect).toHaveValue('2 minutes');
    
    await user.selectOptions(durationSelect, '5 minutes');
    expect(durationSelect).toHaveValue('5 minutes');
  });

  it('shows team selection only for team timeouts', async () => {
    const user = userEvent.setup();
    render(<TimeoutManagement {...mockProps} />);
    
    // Team timeout selected by default - team selection should be visible
    expect(screen.getByText('Team:')).toBeInTheDocument();
    expect(screen.getByText('Team Alpha (Home)')).toBeInTheDocument();
    
    // Switch to injury timeout - team selection should not be visible
    await user.click(screen.getByText('🏥 Injury'));
    expect(screen.queryByText('Team:')).not.toBeInTheDocument();
  });

  it('updates placeholder text based on timeout type', async () => {
    const user = userEvent.setup();
    render(<TimeoutManagement {...mockProps} />);
    
    // Team timeout - coach placeholder
    expect(screen.getByPlaceholderText('Coach name')).toBeInTheDocument();
    
    // Switch to injury timeout - official placeholder
    await user.click(screen.getByText('🏥 Injury'));
    expect(screen.getByPlaceholderText('Official name')).toBeInTheDocument();
  });

  it('updates time remaining when prop changes', () => {
    const { rerender } = render(<TimeoutManagement {...mockProps} />);
    
    // Update time remaining
    act(() => {
      rerender(<TimeoutManagement {...mockProps} timeRemaining="00:05:00" />);
    });
    
    // Component should handle the updated time
    expect(screen.getByText('Timeout Management')).toBeInTheDocument();
  });

  it('handles missing onTimeoutRecorded callback gracefully', async () => {
    const propsWithoutCallback = { ...mockProps, onTimeoutRecorded: undefined };
    const user = userEvent.setup();
    
    render(<TimeoutManagement {...propsWithoutCallback} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Start timeout
    const startButton = screen.getByRole('button', { name: 'Start Team Timeout' });
    await user.click(startButton);
    
    // Should not throw error even without callback
    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });
  });

  it('displays success message after successful timeout start', async () => {
    const user = userEvent.setup();
    render(<TimeoutManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    const startButton = screen.getByRole('button', { name: 'Start Team Timeout' });
    await user.click(startButton);
    
    // Check for success message
    await waitFor(() => {
      expect(screen.getByText('Team Timeout started successfully')).toBeInTheDocument();
    });
  });

  it('shows loading state during timeout creation', async () => {
    const user = userEvent.setup();
    
    // Mock delayed API response
    (api.post as jest.Mock).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ data: { id: 1 } }), 100))
    );
    
    render(<TimeoutManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    const startButton = screen.getByRole('button', { name: 'Start Team Timeout' });
    await user.click(startButton);
    
    // Check for loading state
    expect(screen.getByText('Starting...')).toBeInTheDocument();
    expect(startButton).toBeDisabled();
  });
});