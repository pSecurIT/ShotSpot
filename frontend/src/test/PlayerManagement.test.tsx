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
    { id: 1, team_id: 1, first_name: 'John', last_name: 'Doe', jersey_number: 10, is_active: true, gender: 'male', games_played: 5, goals: 12, total_shots: 20, team_name: 'Team Alpha' },
    { id: 2, team_id: 2, first_name: 'Jane', last_name: 'Smith', jersey_number: 20, is_active: true, gender: 'female', games_played: 4, goals: 8, total_shots: 15, team_name: 'Team Beta' }
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
        jersey_number: 30
      }
    });

    (api.put as jest.Mock).mockResolvedValue({
      data: {
        id: 1,
        team_id: 1,
        first_name: 'Updated',
        last_name: 'Player',
        jersey_number: 10,
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

    // Fill in the form - use getElementById to avoid ambiguity with filter dropdown
    const teamSelect = document.getElementById('team_id') as HTMLSelectElement;
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
      expect(api.post).toHaveBeenCalledWith('/players', {
        team_id: 1,
        first_name: 'New',
        last_name: 'Player',
        jersey_number: 30,
        gender: null
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
    // Reset and setup mock for this specific test
    vi.clearAllMocks();
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/teams') {
        return Promise.resolve({ data: mockTeams });
      }
      if (url === '/players') {
        return Promise.resolve({ data: mockPlayers });
      }
    });
    
    (api.post as jest.Mock).mockRejectedValueOnce({
      response: { data: { error: 'Jersey number already taken' } }
    });

    render(<PlayerManagement />);

    // Wait for initial data load
    await waitFor(() => {
      expect(screen.getByText('Select a team')).toBeInTheDocument();
    });

    // Fill in the form - use getElementById to avoid ambiguity with filter dropdown
    const teamSelect = document.getElementById('team_id') as HTMLSelectElement;
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
    // Reset and setup mock for this specific test to ensure success
    vi.clearAllMocks();
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/teams') {
        return Promise.resolve({ data: mockTeams });
      }
      if (url === '/players') {
        return Promise.resolve({ data: mockPlayers });
      }
    });
    
    (api.post as jest.Mock).mockResolvedValueOnce({
      data: {
        id: 3,
        team_id: 1,
        first_name: 'New',
        last_name: 'Player',
        jersey_number: 30
      }
    });

    render(<PlayerManagement />);

    await waitFor(() => {
      expect(screen.getByText('Select a team')).toBeInTheDocument();
    });

    // Fill in the form - use getElementById to avoid ambiguity with filter dropdown
    const teamSelect = document.getElementById('team_id') as HTMLSelectElement;
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

    // Fill in the form using getElementById to avoid ambiguity
    const teamSelect = document.getElementById('team_id') as HTMLSelectElement;
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

    // Select gender using getElementById to avoid ambiguity
    const genderSelect = document.getElementById('gender') as HTMLSelectElement;
    await userEvent.selectOptions(genderSelect, 'male');
    expect(genderSelect).toHaveValue('male');

    await userEvent.selectOptions(genderSelect, 'female');
    expect(genderSelect).toHaveValue('female');
  });

  it('filters players by team', async () => {
    render(<PlayerManagement />);

    await waitFor(() => {
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
    });

    // Filter by team using getElementById to avoid ambiguity
    const teamFilter = document.getElementById('team_filter') as HTMLSelectElement;
    await userEvent.selectOptions(teamFilter, '1');

    // Wait for filtering - only players from team 1 should be visible
    await waitFor(() => {
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      expect(screen.queryByText(/Jane Smith/)).not.toBeInTheDocument();
    });
  });

  it('shows all players when no filter is selected', async () => {
    render(<PlayerManagement />);

    await waitFor(() => {
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
    });

    // Filter by team then clear filter using getElementById
    const teamFilter = document.getElementById('team_filter') as HTMLSelectElement;
    await userEvent.selectOptions(teamFilter, '1');
    
    // Wait for filtering
    await waitFor(() => {
      expect(screen.queryByText(/Jane Smith/)).not.toBeInTheDocument();
    });
    
    await userEvent.selectOptions(teamFilter, '');

    // Wait for all players to be visible again
    await waitFor(() => {
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
    });
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

    // Fill all required fields but with invalid name format using getElementById for form
    const teamSelect = document.getElementById('team_id') as HTMLSelectElement;
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

    // Fill all required fields but with name that's too short using getElementById for form
    const teamSelect = document.getElementById('team_id') as HTMLSelectElement;
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

  // ✅ Soft Delete Button Tests (in Edit Form)
  describe('🗄️ Archive/Reactivate Player Button', () => {
    it('✅ archive button not visible on player cards in overview', async () => {
      render(<PlayerManagement />);

      await waitFor(() => {
        expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      });

      // Archive button should NOT be visible in card view
      expect(screen.queryByText(/🗄️ Archive/i)).not.toBeInTheDocument();
    });

    it('✅ displays archive button in edit form for active players', async () => {
      render(<PlayerManagement />);

      await waitFor(() => {
        expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      });

      // Click player card to edit
      const playerCard = screen.getByText(/John Doe/).closest('.player-card');
      await userEvent.click(playerCard!);

      // Archive button should now be visible in edit form
      expect(screen.getByText(/🗄️ Archive Player/i)).toBeInTheDocument();
    });

    it('✅ displays reactivate button in edit form for inactive players', async () => {
      const inactivePlayer = {
        id: 3,
        team_id: 1,
        first_name: 'Inactive',
        last_name: 'Player',
        jersey_number: 99,

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
      });

      // Click inactive player card to edit
      const playerCard = screen.getByText(/Inactive Player/).closest('.player-card');
      await userEvent.click(playerCard!);

      // Reactivate button should be visible in edit form
      expect(screen.getByText(/↩️ Reactivate Player/i)).toBeInTheDocument();
    });

    it('✅ archives player when archive button is clicked in edit form and confirmed', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      
      (api.put as jest.Mock).mockResolvedValue({
        data: { ...mockPlayers[0], is_active: false }
      });

      render(<PlayerManagement />);

      await waitFor(() => {
        expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      });

      // Open edit form
      const playerCard = screen.getByText(/John Doe/).closest('.player-card');
      await userEvent.click(playerCard!);

      // Click archive button
      const archiveButton = screen.getByText(/🗄️ Archive Player/i);
      await userEvent.click(archiveButton);

      // Verify confirmation was shown
      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining('archive John Doe')
      );

      await waitFor(() => {
        expect(api.put).toHaveBeenCalledWith('/players/1', expect.objectContaining({
          is_active: false
        }));
        expect(screen.getByText('Player deactivated successfully!')).toBeInTheDocument();
        // Edit form should close after archiving
        expect(screen.queryByText('Edit Player')).not.toBeInTheDocument();
      });

      confirmSpy.mockRestore();
    });

    it('❌ does not archive player when confirmation is canceled', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(<PlayerManagement />);

      await waitFor(() => {
        expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      });

      // Open edit form
      const playerCard = screen.getByText(/John Doe/).closest('.player-card');
      await userEvent.click(playerCard!);

      // Click archive button
      const archiveButton = screen.getByText(/🗄️ Archive Player/i);
      await userEvent.click(archiveButton);

      // Verify API was not called
      expect(api.put).not.toHaveBeenCalled();
      // Edit form should still be open
      expect(screen.getByText('Edit Player')).toBeInTheDocument();

      confirmSpy.mockRestore();
    });

    it('✅ reactivates player when reactivate button is clicked and confirmed', async () => {
      const inactivePlayer = {
        id: 3,
        team_id: 1,
        first_name: 'Inactive',
        last_name: 'Player',
        jersey_number: 99,

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

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      
      (api.put as jest.Mock).mockResolvedValue({
        data: { ...inactivePlayer, is_active: true }
      });

      render(<PlayerManagement />);

      await waitFor(() => {
        expect(screen.getByText(/Inactive Player/)).toBeInTheDocument();
      });

      // Open edit form
      const playerCard = screen.getByText(/Inactive Player/).closest('.player-card');
      await userEvent.click(playerCard!);

      // Click reactivate button
      const reactivateButton = screen.getByText(/↩️ Reactivate Player/i);
      await userEvent.click(reactivateButton);

      await waitFor(() => {
        expect(api.put).toHaveBeenCalledWith('/players/3', expect.objectContaining({
          is_active: true
        }));
        expect(screen.getByText('Player reactivated successfully!')).toBeInTheDocument();
        // Edit form should close after reactivating
        expect(screen.queryByText('Edit Player')).not.toBeInTheDocument();
      });

      confirmSpy.mockRestore();
    });

    it('❌ handles errors when archiving player fails', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      
      (api.put as jest.Mock).mockRejectedValue({
        response: { data: { error: 'Failed to deactivate player' } }
      });

      render(<PlayerManagement />);

      await waitFor(() => {
        expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      });

      // Open edit form
      const playerCard = screen.getByText(/John Doe/).closest('.player-card');
      await userEvent.click(playerCard!);

      // Click archive button
      const archiveButton = screen.getByText(/🗄️ Archive Player/i);
      await userEvent.click(archiveButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to deactivate player')).toBeInTheDocument();
      });

      confirmSpy.mockRestore();
    });
  });

  // ✅ Show/Hide Inactive Players Filter Tests
  describe('🔍 Show Inactive Players Filter', () => {
    const inactivePlayer = {
      id: 3,
      team_id: 1,
      first_name: 'Inactive',
      last_name: 'Player',
      jersey_number: 99,

      is_active: false
    };

    beforeEach(() => {
      (api.get as jest.Mock).mockImplementation((url: string) => {
        if (url === '/teams') {
          return Promise.resolve({ data: mockTeams });
        }
        if (url === '/players') {
          return Promise.resolve({ data: [...mockPlayers, inactivePlayer] });
        }
      });
    });

    it('✅ displays show inactive players checkbox', async () => {
      render(<PlayerManagement />);

      await waitFor(() => {
        expect(screen.getByLabelText(/show inactive/i)).toBeInTheDocument();
      });
    });

    it('✅ shows inactive players by default', async () => {
      render(<PlayerManagement />);

      await waitFor(() => {
        expect(screen.getByText(/Inactive Player/)).toBeInTheDocument();
      });

      // Checkbox should be checked by default
      const checkbox = screen.getByLabelText(/show inactive/i);
      expect(checkbox).toBeChecked();
    });

    it('✅ hides inactive players when checkbox is unchecked', async () => {
      render(<PlayerManagement />);

      await waitFor(() => {
        expect(screen.getByText(/Inactive Player/)).toBeInTheDocument();
      });

      // Uncheck the checkbox
      const checkbox = screen.getByLabelText(/show inactive/i);
      await userEvent.click(checkbox);

      // Inactive player should be hidden
      await waitFor(() => {
        expect(screen.queryByText(/Inactive Player/)).not.toBeInTheDocument();
      });
      // Active players should still be visible
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    });

    it('✅ shows inactive players again when checkbox is rechecked', async () => {
      render(<PlayerManagement />);

      await waitFor(() => {
        expect(screen.getByText(/Inactive Player/)).toBeInTheDocument();
      });

      // Uncheck then check the checkbox
      const checkbox = screen.getByLabelText(/show inactive/i);
      await userEvent.click(checkbox);
      await userEvent.click(checkbox);

      // Inactive player should be visible again
      await waitFor(() => {
        expect(screen.getByText(/Inactive Player/)).toBeInTheDocument();
      });
    });

    it('🔧 combines team filter and inactive filter correctly', async () => {
      // Add inactive player to team 2
      const inactiveTeam2Player = {
        id: 4,
        team_id: 2,
        first_name: 'Another',
        last_name: 'Inactive',
        jersey_number: 88,

        is_active: false
      };

      (api.get as jest.Mock).mockImplementation((url: string) => {
        if (url === '/teams') {
          return Promise.resolve({ data: mockTeams });
        }
        if (url === '/players') {
          return Promise.resolve({ data: [...mockPlayers, inactivePlayer, inactiveTeam2Player] });
        }
      });

      render(<PlayerManagement />);

      await waitFor(() => {
        expect(screen.getByText(/Inactive Player/)).toBeInTheDocument();
        expect(screen.getByText(/Another Inactive/)).toBeInTheDocument();
      });

      // Filter by team 1 using getElementById
      const teamFilter = document.getElementById('team_filter') as HTMLSelectElement;
      await userEvent.selectOptions(teamFilter, '1');

      // Wait for filtering to complete - should only show team 1 players (including inactive)
      await waitFor(() => {
        expect(screen.getByText(/John Doe/)).toBeInTheDocument();
        expect(screen.getByText(/Inactive Player/)).toBeInTheDocument();
        expect(screen.queryByText(/Jane Smith/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Another Inactive/)).not.toBeInTheDocument();
      });

      // Hide inactive players
      const checkbox = screen.getByLabelText(/show inactive/i);
      await userEvent.click(checkbox);

      // Wait for filtering - should only show active team 1 players
      await waitFor(() => {
        expect(screen.getByText(/John Doe/)).toBeInTheDocument();
        expect(screen.queryByText(/Inactive Player/)).not.toBeInTheDocument();
      });
    });
  });

  // 🔍 Search and Filter Tests
  describe('🔍 Search and Advanced Filters', () => {
    it('✅ displays search input', async () => {
      render(<PlayerManagement />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search by name or jersey number/i)).toBeInTheDocument();
      });
    });

    it('✅ filters players by search query - name match', async () => {
      render(<PlayerManagement />);

      await waitFor(() => {
        expect(screen.getByText(/John Doe/)).toBeInTheDocument();
        expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search by name or jersey number/i);
      await userEvent.type(searchInput, 'John');

      // Only John should be visible
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      expect(screen.queryByText(/Jane Smith/)).not.toBeInTheDocument();
    });

    it('✅ filters players by search query - jersey number match', async () => {
      render(<PlayerManagement />);

      await waitFor(() => {
        expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search by name or jersey number/i);
      await userEvent.type(searchInput, '20');

      // Only player with jersey 20 should be visible
      expect(screen.queryByText(/John Doe/)).not.toBeInTheDocument();
      expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
    });

    it('✅ clears search with clear button', async () => {
      render(<PlayerManagement />);

      await waitFor(() => {
        expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search by name or jersey number/i);
      await userEvent.type(searchInput, 'John');

      // Find and click clear button
      const clearButton = screen.getByTitle('Clear search');
      await userEvent.click(clearButton);

      // Search should be cleared and all players visible
      expect(searchInput).toHaveValue('');
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
    });

    it('✅ filters players by gender', async () => {
      render(<PlayerManagement />);

      await waitFor(() => {
        expect(screen.getByText(/John Doe/)).toBeInTheDocument();
        expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
      });

      const genderFilter = document.getElementById('gender_filter')!;
      await userEvent.selectOptions(genderFilter, 'female');

      // Only female players should be visible
      await waitFor(() => {
        expect(screen.queryByText(/John Doe/)).not.toBeInTheDocument();
        expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
      });
    });

    it('🔧 combines multiple filters correctly', async () => {
      const extendedPlayers = [
        ...mockPlayers,
        { id: 3, team_id: 1, first_name: 'Alice', last_name: 'Johnson', jersey_number: 15, is_active: true, gender: 'female', games_played: 3, goals: 5, total_shots: 10, team_name: 'Team Alpha' }
      ];

      (api.get as jest.Mock).mockImplementation((url: string) => {
        if (url === '/teams') {
          return Promise.resolve({ data: mockTeams });
        }
        if (url === '/players') {
          return Promise.resolve({ data: extendedPlayers });
        }
      });

      render(<PlayerManagement />);

      await waitFor(() => {
        expect(screen.getByText(/Alice Johnson/)).toBeInTheDocument();
      });

      // Filter by team 1 and female gender
      const teamFilter = document.getElementById('team_filter')!;
      const genderFilter = document.getElementById('gender_filter')!;

      await userEvent.selectOptions(teamFilter, '1');
      await userEvent.selectOptions(genderFilter, 'female');

      // Wait for filtering - should only show Alice (Team 1, Female)
      await waitFor(() => {
        expect(screen.queryByText(/John Doe/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Jane Smith/)).not.toBeInTheDocument();
        expect(screen.getByText(/Alice Johnson/)).toBeInTheDocument();
      });
    });
  });

  // 📊 Player Statistics Tests
  describe('📊 Player Statistics Display', () => {
    it('✅ displays player statistics on cards', async () => {
      render(<PlayerManagement />);

      await waitFor(() => {
        expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      });

      // Check for stats display (use getAllByText since stats appear multiple times)
      expect(screen.getAllByText('Games').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Goals').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Shots').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Accuracy').length).toBeGreaterThan(0);
    });

    it('✅ calculates shooting percentage correctly', async () => {
      render(<PlayerManagement />);

      await waitFor(() => {
        expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      });

      // John: 12 goals / 20 shots = 60%
      const johnCard = screen.getByText(/John Doe/).closest('.player-card');
      expect(johnCard).toHaveTextContent('60%');
    });

    it('✅ sorts players by name', async () => {
      render(<PlayerManagement />);

      await waitFor(() => {
        expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      });

      const sortBy = document.getElementById('sort_by') as HTMLSelectElement;
      await userEvent.selectOptions(sortBy, 'name');

      // Players should be sorted alphabetically (Doe before Smith)
      await waitFor(() => {
        const playerCards = screen.getAllByText(/John Doe|Jane Smith/);
        expect(playerCards[0]).toHaveTextContent('John Doe');
      });
    });

    it('✅ sorts players by goals', async () => {
      render(<PlayerManagement />);

      await waitFor(() => {
        expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      });

      const sortBy = document.getElementById('sort_by') as HTMLSelectElement;
      await userEvent.selectOptions(sortBy, 'goals');

      // With ascending order, Jane (8 goals) should come before John (12 goals)
      // Then click sort order to descending
      const sortOrderBtn = screen.getByTitle(/sort descending/i); // Initial state is asc, button shows what will happen next
      await userEvent.click(sortOrderBtn);

      // Now John (12) should be first
      await waitFor(() => {
        const playerCards = screen.getAllByText(/John Doe|Jane Smith/);
        expect(playerCards[0]).toHaveTextContent('John Doe');
      });
    });

    it('✅ toggles sort order', async () => {
      render(<PlayerManagement />);

      await waitFor(() => {
        expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      });

      // Initial state: sort order is asc, button shows "Sort descending"
      const sortOrderBtn = screen.getByTitle(/sort descending/i);
      await userEvent.click(sortOrderBtn);

      // Button title should change after click
      await waitFor(() => {
        expect(screen.getByTitle(/sort ascending/i)).toBeInTheDocument();
      });
    });

    it('✅ displays results count', async () => {
      render(<PlayerManagement />);

      await waitFor(() => {
        expect(screen.getByText(/showing 2 of 2 players/i)).toBeInTheDocument();
      });

      // Filter to reduce count
      const searchInput = screen.getByPlaceholderText(/search by name or jersey number/i);
      await userEvent.type(searchInput, 'John');

      expect(screen.getByText(/showing 1 of 2 players/i)).toBeInTheDocument();
    });
  });
});
