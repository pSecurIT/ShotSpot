import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlayerManagement from '../components/PlayerManagement';
import api from '../utils/api';

// Mock the api module
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe('PlayerManagement', () => {
  const mockTeams = [
    { id: 1, name: 'Team Alpha' },
    { id: 2, name: 'Team Beta' }
  ];

  const mockPlayers = [
    { id: 1, team_id: 1, first_name: 'John', last_name: 'Doe', jersey_number: 10, role: 'Player' },
    { id: 2, team_id: 2, first_name: 'Jane', last_name: 'Smith', jersey_number: 20, role: 'Captain' }
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
  });

  it('renders the player management interface', () => {
    render(<PlayerManagement />);
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

    // Fill in the form
    const teamSelect = screen.getByRole('combobox', { name: /team/i });
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
        role: 'Player'
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

    // Fill in the form
    const teamSelect = screen.getByRole('combobox', { name: /team/i });
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

    // Fill in the form
    const teamSelect = screen.getByRole('combobox', { name: /team/i });
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
      expect(jerseyInput).toHaveValue('');
      expect(teamSelect).toHaveValue('');
    });
  });
});