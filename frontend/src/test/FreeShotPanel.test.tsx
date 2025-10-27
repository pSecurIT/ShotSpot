import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FreeShotPanel from '../components/FreeShotPanel';
import api from '../utils/api';

// Mock the api module
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe('FreeShotPanel', () => {
  const mockProps = {
    gameId: 1,
    homeTeamId: 1,
    awayTeamId: 2,
    homeTeamName: 'Team Alpha',
    awayTeamName: 'Team Beta',
    currentPeriod: 1,
    timeRemaining: '00:08:30',
    onFreeShotRecorded: vi.fn()
  };

  const mockHomePlayers = [
    { id: 1, team_id: 1, first_name: 'John', last_name: 'Doe', jersey_number: 10, gender: 'M' },
    { id: 2, team_id: 1, first_name: 'Jane', last_name: 'Smith', jersey_number: 11, gender: 'F' }
  ];

  const mockAwayPlayers = [
    { id: 3, team_id: 2, first_name: 'Bob', last_name: 'Johnson', jersey_number: 20, gender: 'M' },
    { id: 4, team_id: 2, first_name: 'Alice', last_name: 'Wilson', jersey_number: 21, gender: 'F' }
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
      } else if (url.includes('/free-shots')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });
    
    (api.post as jest.Mock).mockResolvedValue({
      data: { id: 1, free_shot_type: 'free_shot', message: 'Free shot recorded successfully' }
    });
  });

  it('renders free shot panel interface correctly', async () => {
    render(<FreeShotPanel {...mockProps} />);
    
    expect(screen.getByText('Record Free Shot / Penalty')).toBeInTheDocument();
    expect(screen.getByText('Shot Type:')).toBeInTheDocument();
    expect(screen.getByText('Team:')).toBeInTheDocument();
    expect(screen.getByText('Player:')).toBeInTheDocument();
    expect(screen.getByText('Result:')).toBeInTheDocument();
    
    // Check shot type buttons
    expect(screen.getByText('🎯 Free Shot')).toBeInTheDocument();
    expect(screen.getByText('🚨 Penalty')).toBeInTheDocument();
    
    // Check result buttons
    expect(screen.getByText('⚽ Goal')).toBeInTheDocument();
    expect(screen.getByText('❌ Miss')).toBeInTheDocument();
    expect(screen.getByText('🛡️ Blocked')).toBeInTheDocument();
  });

  it('loads and displays team players correctly', async () => {
    const user = userEvent.setup();
    render(<FreeShotPanel {...mockProps} />);
    
    // Wait for players to load
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(`/game-rosters/1?team_id=1&is_starting=true`);
      expect(api.get).toHaveBeenCalledWith(`/game-rosters/1?team_id=2&is_starting=true`);
    });
    
    // Switch to away team
    const teamSelect = screen.getByDisplayValue('Team Alpha (Home)');
    await user.selectOptions(teamSelect, '2');
    
    // Check if away team players are available in dropdown
    await waitFor(() => {
      expect(screen.getByText('#20 Bob Johnson')).toBeInTheDocument();
      expect(screen.getByText('#21 Alice Wilson')).toBeInTheDocument();
    });
  });

  it('records successful free shot', async () => {
    const user = userEvent.setup();
    render(<FreeShotPanel {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Free shot is selected by default
    expect(screen.getByText('🎯 Free Shot')).toHaveClass('active');
    
    // Select player
    const playerSelect = screen.getByDisplayValue('Select player');
    await user.selectOptions(playerSelect, '1');
    
    // Select result
    await user.click(screen.getByText('⚽ Goal'));
    
    // Add reason
    const reasonInput = screen.getByPlaceholderText('What caused this free shot/penalty to be awarded?');
    await user.type(reasonInput, 'Clean shot after defensive fault');
    
    // Submit free shot
    const recordButton = screen.getByRole('button', { name: 'Record Free Shot' });
    await user.click(recordButton);
    
    // Verify API call
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/free-shots/1', expect.objectContaining({
        player_id: 1,
        team_id: 1,
        period: 1,
        time_remaining: '00:08:30',
        free_shot_type: 'free_shot',
        result: 'goal',
        reason: 'Clean shot after defensive fault'
      }));
    });
    
    // Verify callback was called
    expect(mockProps.onFreeShotRecorded).toHaveBeenCalled();
  });

  it('records missed free shot', async () => {
    const user = userEvent.setup();
    render(<FreeShotPanel {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Switch to away team
    const teamSelect = screen.getByDisplayValue('Team Alpha (Home)');
    await user.selectOptions(teamSelect, '2');
    
    // Select away team player
    const playerSelect = screen.getByDisplayValue('Select player');
    await user.selectOptions(playerSelect, '3');
    
    // Result is miss by default
    expect(screen.getByText('❌ Miss')).toHaveClass('active');
    
    // Submit
    const recordButton = screen.getByRole('button', { name: 'Record Free Shot' });
    await user.click(recordButton);
    
    // Verify API call
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/free-shots/1', expect.objectContaining({
        player_id: 3,
        team_id: 2,
        free_shot_type: 'free_shot',
        result: 'miss'
      }));
    });
  });

  it('records blocked free shot', async () => {
    const user = userEvent.setup();
    render(<FreeShotPanel {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Select penalty type
    await user.click(screen.getByText('🚨 Penalty'));
    
    // Select player
    const playerSelect = screen.getByDisplayValue('Select player');
    await user.selectOptions(playerSelect, '2');
    
    // Select blocked result
    await user.click(screen.getByText('🛡️ Blocked'));
    
    // Submit
    const recordButton = screen.getByRole('button', { name: 'Record Penalty' });
    await user.click(recordButton);
    
    // Verify API call
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/free-shots/1', expect.objectContaining({
        player_id: 2,
        team_id: 1,
        free_shot_type: 'penalty',
        result: 'blocked'
      }));
    });
  });

  it('validates required fields before submission', async () => {
    render(<FreeShotPanel {...mockProps} />);
    
    // Try to submit without selecting player
    const recordButton = screen.getByRole('button', { name: 'Record Free Shot' });
    
    // Button should be disabled when no player selected
    expect(recordButton).toBeDisabled();
    
    // Verify API was not called
    expect(api.post).not.toHaveBeenCalled();
    expect(mockProps.onFreeShotRecorded).not.toHaveBeenCalled();
  });

  it('disables submit button when required fields are missing', async () => {
    render(<FreeShotPanel {...mockProps} />);
    
    const recordButton = screen.getByRole('button', { name: 'Record Free Shot' });
    expect(recordButton).toBeDisabled();
  });

  it('enables submit button when all required fields are selected', async () => {
    const user = userEvent.setup();
    render(<FreeShotPanel {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Select player
    const playerSelect = screen.getByDisplayValue('Select player');
    await user.selectOptions(playerSelect, '1');
    
    // Button should now be enabled
    const recordButton = screen.getByRole('button', { name: 'Record Free Shot' });
    expect(recordButton).toBeEnabled();
  });

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup();
    
    // Mock API error
    (api.post as jest.Mock).mockRejectedValue({
      response: { data: { error: 'Network error' } }
    });
    
    render(<FreeShotPanel {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Select player and submit
    const playerSelect = screen.getByDisplayValue('Select player');
    await user.selectOptions(playerSelect, '1');
    
    const recordButton = screen.getByRole('button', { name: 'Record Free Shot' });
    await user.click(recordButton);
    
    // Should show error message
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
    
    // Verify callback was not called on error
    expect(mockProps.onFreeShotRecorded).not.toHaveBeenCalled();
  });

  it('clears form after successful submission', async () => {
    const user = userEvent.setup();
    render(<FreeShotPanel {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Fill and submit form
    const playerSelect = screen.getByDisplayValue('Select player');
    await user.selectOptions(playerSelect, '1');
    
    const reasonInput = screen.getByPlaceholderText('What caused this free shot/penalty to be awarded?');
    await user.type(reasonInput, 'Test reason');
    
    const recordButton = screen.getByRole('button', { name: 'Record Free Shot' });
    await user.click(recordButton);
    
    // Wait for submission and verify form is cleared
    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });
    
    // Check that form fields are reset
    expect(playerSelect).toHaveValue('');
    expect(reasonInput).toHaveValue('');
  });

  it('switches between teams and shows correct players', async () => {
    const user = userEvent.setup();
    render(<FreeShotPanel {...mockProps} />);
    
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

  it('handles different shot types correctly', async () => {
    const user = userEvent.setup();
    render(<FreeShotPanel {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Test switching shot types
    await user.click(screen.getByText('🚨 Penalty'));
    expect(screen.getByText('🚨 Penalty')).toHaveClass('active');
    
    await user.click(screen.getByText('🎯 Free Shot'));
    expect(screen.getByText('🎯 Free Shot')).toHaveClass('active');
  });

  it('handles result selection correctly', async () => {
    const user = userEvent.setup();
    render(<FreeShotPanel {...mockProps} />);
    
    // Test different results
    await user.click(screen.getByText('⚽ Goal'));
    expect(screen.getByText('⚽ Goal')).toHaveClass('active');
    
    await user.click(screen.getByText('❌ Miss'));
    expect(screen.getByText('❌ Miss')).toHaveClass('active');
    
    await user.click(screen.getByText('🛡️ Blocked'));
    expect(screen.getByText('🛡️ Blocked')).toHaveClass('active');
  });

  it('updates time remaining when prop changes', () => {
    const { rerender } = render(<FreeShotPanel {...mockProps} />);
    
    // Update time remaining
    rerender(<FreeShotPanel {...mockProps} timeRemaining="00:05:00" />);
    
    // Component should handle the updated time
    expect(screen.getByText('Record Free Shot / Penalty')).toBeInTheDocument();
  });

  it('handles missing onFreeShotRecorded callback gracefully', async () => {
    const propsWithoutCallback = { ...mockProps, onFreeShotRecorded: undefined };
    const user = userEvent.setup();
    
    render(<FreeShotPanel {...propsWithoutCallback} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    const playerSelect = screen.getByDisplayValue('Select player');
    await user.selectOptions(playerSelect, '1');
    
    const recordButton = screen.getByRole('button', { name: 'Record Free Shot' });
    await user.click(recordButton);
    
    // Should not throw error even without callback
    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });
  });
});