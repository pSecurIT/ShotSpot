import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlayerManagement from '../components/PlayerManagement';
import api from '../utils/api';

// Mock the api module
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn()
  }
}));

describe('PlayerManagement', () => {
  const mockTeams = [
    { id: 1, name: 'Team Alpha' },
    { id: 2, name: 'Team Beta' }
  ];

  const mockPlayers = [
    { id: 1, team_id: 1, first_name: 'John', last_name: 'Doe', jersey_number: 10, role: 'Player', is_active: true },
    { id: 2, team_id: 2, first_name: 'Jane', last_name: 'Smith', jersey_number: 20, role: 'Captain', is_active: true }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API responses
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/teams') {
        return Promise.resolve({ data: mockTeams });
      }
      if (url === '/players') {
        return Promise.resolve({ data: mockPlayers });
      }
    });
    
    (api.post as jest.Mock).mockResolvedValue({
      data: {
        id: 3,
        team_id: 1,
        first_name: 'New',
        last_name: 'Player',
        jersey_number: 30,
        role: 'Player'
      }
    });

    (api.put as jest.Mock).mockResolvedValue({
      data: {
        id: 1,
        team_id: 1,
        first_name: 'Updated',
        last_name: 'Player',
        jersey_number: 10,
        role: 'Player',
        is_active: true
      }
    });
  });

  it('renders the player management interface', () => {
    act(() => {
      render(<PlayerManagement />);
    });
    expect(screen.getByText('Player Management')).toBeInTheDocument();
    expect(screen.getByText('Add Player')).toBeInTheDocument();
  });

  it('fetches and displays teams and players on mount', async () => {
    render(<PlayerManagement />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/teams');
      expect(api.get).toHaveBeenCalledWith('/players');
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
    });
  });

  it('allows adding a new player', async () => {
    render(<PlayerManagement />);

    await waitFor(() => {
      expect(screen.getByText('Select a team')).toBeInTheDocument();
    });

    // Fill in the form - use getByLabelText to avoid ambiguity with filter dropdown
    const teamSelect = screen.getByLabelText(/^team:$/i);
    const firstNameInput = screen.getByRole('textbox', { name: /first name/i });
    const lastNameInput = screen.getByRole('textbox', { name: /last name/i });
    const jerseyInput = screen.getByRole('spinbutton', { name: /jersey number/i });
    const roleSelect = screen.getByRole('combobox', { name: /role/i });

    await userEvent.selectOptions(teamSelect, '1');
    await userEvent.type(firstNameInput, 'New');
    await userEvent.type(lastNameInput, 'Player');
    await userEvent.type(jerseyInput, '30');
    await userEvent.selectOptions(roleSelect, 'Player');

    const submitButton = screen.getByText('Add Player');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/players', {
        team_id: 1,
        first_name: 'New',
        last_name: 'Player',
        jersey_number: 30,
        gender: null,
        role: 'player'
      });
    });
  });

  it('displays validation errors for required fields', async () => {
    render(<PlayerManagement />);

    const submitButton = screen.getByText('Add Player');
    await userEvent.click(submitButton);

    // The form should not be submitted if required fields are empty
    expect(api.post).not.toHaveBeenCalled();
  });

  it('displays error when player creation fails', async () => {
    (api.post as jest.Mock).mockRejectedValueOnce({
      response: { data: { error: 'Jersey number already taken' } }
    });

    render(<PlayerManagement />);

    // Wait for initial data load
    await waitFor(() => {
      expect(screen.getByText('Select a team')).toBeInTheDocument();
    });

    // Fill in the form - use getByLabelText to avoid ambiguity with filter dropdown
    const teamSelect = screen.getByLabelText(/^team:$/i);
    const firstNameInput = screen.getByRole('textbox', { name: /first name/i });
    const lastNameInput = screen.getByRole('textbox', { name: /last name/i });
    const jerseyInput = screen.getByRole('spinbutton', { name: /jersey number/i });

    await userEvent.selectOptions(teamSelect, '1');
    await userEvent.type(firstNameInput, 'New');
    await userEvent.type(lastNameInput, 'Player');
    await userEvent.type(jerseyInput, '30');

    const submitButton = screen.getByText('Add Player');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Jersey number already taken')).toBeInTheDocument();
    });
  });

  it('clears form after successful player creation', async () => {
    render(<PlayerManagement />);

    await waitFor(() => {
      expect(screen.getByText('Select a team')).toBeInTheDocument();
    });

    // Fill in the form - use getByLabelText to avoid ambiguity with filter dropdown
    const teamSelect = screen.getByLabelText(/^team:$/i);
    const firstNameInput = screen.getByRole('textbox', { name: /first name/i });
    const lastNameInput = screen.getByRole('textbox', { name: /last name/i });
    const jerseyInput = screen.getByRole('spinbutton', { name: /jersey number/i });

    await userEvent.selectOptions(teamSelect, '1');
    await userEvent.type(firstNameInput, 'New');
    await userEvent.type(lastNameInput, 'Player');
    await userEvent.type(jerseyInput, '30');

    const submitButton = screen.getByText('Add Player');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(firstNameInput).toHaveValue('');
      expect(lastNameInput).toHaveValue('');
      expect(jerseyInput).toHaveValue(null);
      expect(teamSelect).toHaveValue('');
    });
  });

  it('displays success message after successful player creation', async () => {
    render(<PlayerManagement />);

    await waitFor(() => {
      expect(screen.getByText('Select a team')).toBeInTheDocument();
    });

    // Fill in the form
    const teamSelect = screen.getByLabelText(/^team:$/i);
    const firstNameInput = screen.getByRole('textbox', { name: /first name/i });
    const lastNameInput = screen.getByRole('textbox', { name: /last name/i });
    const jerseyInput = screen.getByRole('spinbutton', { name: /jersey number/i });

    await userEvent.selectOptions(teamSelect, '1');
    await userEvent.type(firstNameInput, 'New');
    await userEvent.type(lastNameInput, 'Player');
    await userEvent.type(jerseyInput, '30');

    const submitButton = screen.getByText('Add Player');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Player added successfully!')).toBeInTheDocument();
    });
  });

  it('allows selecting gender when adding a new player', async () => {
    render(<PlayerManagement />);

    await waitFor(() => {
      expect(screen.getByText('Select a team')).toBeInTheDocument();
    });

    // Select gender
    const genderSelect = screen.getByRole('combobox', { name: /gender/i });
    await userEvent.selectOptions(genderSelect, 'male');
    expect(genderSelect).toHaveValue('male');

    await userEvent.selectOptions(genderSelect, 'female');
    expect(genderSelect).toHaveValue('female');
  });

  it('allows selecting different player roles', async () => {
    render(<PlayerManagement />);

    await waitFor(() => {
      expect(screen.getByText('Select a team')).toBeInTheDocument();
    });

    // Select role - need to distinguish between add form and filter
    const roleSelects = screen.getAllByRole('combobox', { name: /role/i });
    const roleSelect = roleSelects[0]; // First one is the add form
    
    expect(roleSelect).toHaveValue('player'); // default value
    
    await userEvent.selectOptions(roleSelect, 'captain');
    expect(roleSelect).toHaveValue('captain');
  });

  it('filters players by team', async () => {
    render(<PlayerManagement />);

    await waitFor(() => {
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
    });

    // Filter by team
    const teamFilter = screen.getByRole('combobox', { name: /filter by team/i });
    await userEvent.selectOptions(teamFilter, '1');

    // Only players from team 1 should be visible
    expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    expect(screen.queryByText(/Jane Smith/)).not.toBeInTheDocument();
  });

  it('shows all players when no filter is selected', async () => {
    render(<PlayerManagement />);

    await waitFor(() => {
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
    });

    // Filter by team then clear filter
    const teamFilter = screen.getByRole('combobox', { name: /filter by team/i });
    await userEvent.selectOptions(teamFilter, '1');
    await userEvent.selectOptions(teamFilter, '');

    // All players should be visible again
    expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
  });

  it('displays "No players found" when no players match filter', async () => {
    // Mock empty response for players
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/teams') {
        return Promise.resolve({ data: mockTeams });
      }
      if (url === '/players') {
        return Promise.resolve({ data: [] });
      }
    });

    render(<PlayerManagement />);

    await waitFor(() => {
      expect(screen.getByText('No players found.')).toBeInTheDocument();
    });
  });

  it('opens edit form when player card is clicked', async () => {
    render(<PlayerManagement />);

    await waitFor(() => {
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    });

    // Click on player card
    const playerCard = screen.getByText(/John Doe/).closest('.player-card');
    expect(playerCard).toBeInTheDocument();
    
    await userEvent.click(playerCard!);

    // Edit form should appear
    expect(screen.getByText('Edit Player')).toBeInTheDocument();
    expect(screen.getByDisplayValue('John')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
  });

  it('updates player when edit form is submitted', async () => {
    const mockUpdatedPlayer = {
      id: 1,
      team_id: 1,
      first_name: 'John Updated',
      last_name: 'Doe Updated',
      jersey_number: 11,
      role: 'captain',
      is_active: true,
      gender: 'male'
    };

    (api.put as jest.Mock).mockResolvedValue({ data: mockUpdatedPlayer });

    render(<PlayerManagement />);

    await waitFor(() => {
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    });

    // Click on player card to edit
    const playerCard = screen.getByText(/John Doe/).closest('.player-card');
    await userEvent.click(playerCard!);

    // Edit the player
    const editFirstName = screen.getByDisplayValue('John');
    const editLastName = screen.getByDisplayValue('Doe');
    const editJersey = screen.getByDisplayValue('10');
    
    await userEvent.clear(editFirstName);
    await userEvent.type(editFirstName, 'John Updated');
    await userEvent.clear(editLastName);
    await userEvent.type(editLastName, 'Doe Updated');
    await userEvent.clear(editJersey);
    await userEvent.type(editJersey, '11');

    const updateButton = screen.getByText('Update Player');
    await userEvent.click(updateButton);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/players/1', expect.objectContaining({
        first_name: 'John Updated',
        last_name: 'Doe Updated',
        jersey_number: 11
      }));
    });
  });

  it('cancels edit mode when cancel button is clicked', async () => {
    render(<PlayerManagement />);

    await waitFor(() => {
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    });

    // Click on player card to edit
    const playerCard = screen.getByText(/John Doe/).closest('.player-card');
    await userEvent.click(playerCard!);

    // Edit form should be visible
    expect(screen.getByText('Edit Player')).toBeInTheDocument();

    // Cancel edit
    const cancelButton = screen.getByText('Cancel');
    await userEvent.click(cancelButton);

    // Edit form should be gone
    expect(screen.queryByText('Edit Player')).not.toBeInTheDocument();
  });

  it('displays update success message after player update', async () => {
    (api.put as jest.Mock).mockResolvedValue({ 
      data: { ...mockPlayers[0], first_name: 'Updated' }
    });

    render(<PlayerManagement />);

    await waitFor(() => {
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    });

    // Edit and update player
    const playerCard = screen.getByText(/John Doe/).closest('.player-card');
    await userEvent.click(playerCard!);

    const editFirstName = screen.getByDisplayValue('John');
    await userEvent.clear(editFirstName);
    await userEvent.type(editFirstName, 'Updated');

    const updateButton = screen.getByText('Update Player');
    await userEvent.click(updateButton);

    await waitFor(() => {
      expect(screen.getByText('Player updated successfully!')).toBeInTheDocument();
    });
  });

  it('handles update errors gracefully', async () => {
    (api.put as jest.Mock).mockRejectedValue({
      response: { data: { error: 'Failed to update player' } }
    });

    render(<PlayerManagement />);

    await waitFor(() => {
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    });

    // Edit and try to update player
    const playerCard = screen.getByText(/John Doe/).closest('.player-card');
    await userEvent.click(playerCard!);

    const updateButton = screen.getByText('Update Player');
    await userEvent.click(updateButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to update player')).toBeInTheDocument();
    });
  });

  it('validates field formats for player names', async () => {
    render(<PlayerManagement />);

    await waitFor(() => {
      expect(screen.getByText('Select a team')).toBeInTheDocument();
    });

    // Fill all required fields but with invalid name format
    const teamSelect = screen.getByLabelText(/^team:$/i);
    const firstNameInput = screen.getByRole('textbox', { name: /first name/i });
    const lastNameInput = screen.getByRole('textbox', { name: /last name/i });
    const jerseyInput = screen.getByRole('spinbutton', { name: /jersey number/i });
    const submitButton = screen.getByText('Add Player');
    
    await userEvent.selectOptions(teamSelect, '1');
    await userEvent.type(firstNameInput, 'John123'); // Invalid format
    await userEvent.type(lastNameInput, 'Doe');
    await userEvent.type(jerseyInput, '10');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/can only contain letters, spaces, hyphens, and apostrophes/)).toBeInTheDocument();
    });
  });

  it('validates minimum name length', async () => {
    render(<PlayerManagement />);

    await waitFor(() => {
      expect(screen.getByText('Select a team')).toBeInTheDocument();
    });

    // Fill all required fields but with name that's too short
    const teamSelect = screen.getByLabelText(/^team:$/i);
    const firstNameInput = screen.getByRole('textbox', { name: /first name/i });
    const lastNameInput = screen.getByRole('textbox', { name: /last name/i });
    const jerseyInput = screen.getByRole('spinbutton', { name: /jersey number/i });
    const submitButton = screen.getByText('Add Player');
    
    await userEvent.selectOptions(teamSelect, '1');
    await userEvent.type(firstNameInput, 'A'); // Too short
    await userEvent.type(lastNameInput, 'Doe');
    await userEvent.type(jerseyInput, '10');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('First name must be at least 2 characters')).toBeInTheDocument();
    });
  });

  it('displays player status correctly in card view', async () => {
    // Add an inactive player to mock data
    const inactivePlayer = {
      id: 3,
      team_id: 1,
      first_name: 'Inactive',
      last_name: 'Player',
      jersey_number: 99,
      role: 'Player',
      is_active: false
    };

    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/teams') {
        return Promise.resolve({ data: mockTeams });
      }
      if (url === '/players') {
        return Promise.resolve({ data: [...mockPlayers, inactivePlayer] });
      }
    });

    render(<PlayerManagement />);

    await waitFor(() => {
      expect(screen.getByText(/Inactive Player/)).toBeInTheDocument();
      // Check specifically for the inactive status within the inactive player card
      const inactivePlayerCard = screen.getByText(/Inactive Player/).closest('.player-card');
      expect(inactivePlayerCard).toHaveClass('inactive');
    });
  });

  it('updates player active status in edit mode', async () => {
    (api.put as jest.Mock).mockResolvedValue({
      data: { ...mockPlayers[0], is_active: false }
    });

    render(<PlayerManagement />);

    await waitFor(() => {
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    });

    // Edit player
    const playerCard = screen.getByText(/John Doe/).closest('.player-card');
    await userEvent.click(playerCard!);

    // Change status to inactive
    const statusSelect = screen.getByRole('combobox', { name: /status/i });
    await userEvent.selectOptions(statusSelect, 'false');

    const updateButton = screen.getByText('Update Player');
    await userEvent.click(updateButton);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/players/1', expect.objectContaining({
        is_active: false
      }));
    });
  });

  it('handles API errors when fetching data', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/teams') {
        return Promise.reject({ response: { data: { error: 'Failed to fetch teams' } } });
      }
      if (url === '/players') {
        return Promise.reject({ response: { data: { error: 'Failed to fetch players' } } });
      }
    });

    // Mock console.error to avoid noise in test output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<PlayerManagement />);

    // Should still render the component even with API errors
    expect(screen.getByText('Player Management')).toBeInTheDocument();
    
    consoleSpy.mockRestore();
  });
});