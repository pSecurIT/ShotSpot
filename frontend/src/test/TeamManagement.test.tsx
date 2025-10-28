import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TeamManagement from '../components/TeamManagement';
import api from '../utils/api';

// Mock the api module with proper types
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe('TeamManagement', () => {
  const mockTeams = [
    { id: 1, name: 'Team Alpha' },
    { id: 2, name: 'Team Beta' }
  ];

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    
    // Mock successful API responses
    (api.get as jest.Mock).mockResolvedValue({ data: mockTeams });
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 3, name: 'New Team' } });
  });

  it('renders the team management interface', () => {
    act(() => {
      render(<TeamManagement />);
    });
    expect(screen.getByText('Team Management')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter team name')).toBeInTheDocument();
    expect(screen.getByText('Add Team')).toBeInTheDocument();
  });

  it('fetches and displays teams on mount', async () => {
    render(<TeamManagement />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/teams');
      expect(screen.getByText('Team Alpha')).toBeInTheDocument();
      expect(screen.getByText('Team Beta')).toBeInTheDocument();
    });
  });

  it('handles team creation successfully', async () => {
    render(<TeamManagement />);
    
    const input = screen.getByPlaceholderText('Enter team name');
    const submitButton = screen.getByText('Add Team');

    await userEvent.type(input, 'New Team');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/teams', { name: 'New Team' });
      expect(screen.getByText('New Team')).toBeInTheDocument();
    });

    // Input should be cleared after successful submission
    expect(input).toHaveValue('');
  });

  it('displays error message when team fetch fails', async () => {
    const errorMessage = 'Failed to fetch teams';
    (api.get as jest.Mock).mockRejectedValueOnce({ response: { data: { error: errorMessage } } });

    render(<TeamManagement />);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('displays error message when team creation fails', async () => {
    const errorMessage = 'Team name already exists';
    (api.post as jest.Mock).mockRejectedValueOnce({ response: { data: { error: errorMessage } } });

    render(<TeamManagement />);

    const input = screen.getByPlaceholderText('Enter team name');
    const submitButton = screen.getByText('Add Team');

    await userEvent.type(input, 'New Team');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('requires team name input before submission', async () => {
    render(<TeamManagement />);
    
    const submitButton = screen.getByText('Add Team');
    await userEvent.click(submitButton);

    // Post should not be called if input is empty
    expect(api.post).not.toHaveBeenCalled();
  });
});