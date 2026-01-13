import { render, screen, waitFor } from '@testing-library/react';
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
    { id: 1, name: 'Team Alpha', club_id: 1, club_name: 'Alpha Club' },
    { id: 2, name: 'Team Beta', club_id: 2, club_name: 'Beta Club' }
  ];

  const mockClubs = [
    { id: 1, name: 'Alpha Club' },
    { id: 2, name: 'Beta Club' }
  ];

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Mock successful API responses
    (api.get as any).mockImplementation((url: string) => {
      if (url === '/teams') return Promise.resolve({ data: mockTeams });
      if (url === '/clubs') return Promise.resolve({ data: mockClubs });
      return Promise.resolve({ data: [] });
    });
    (api.post as any).mockResolvedValue({ data: { id: 3, name: 'New Team', club_id: 1 } });
  });

  it('renders the team management interface', async () => {
    render(<TeamManagement />);
    expect(screen.getByText('Team Management')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter team name')).toBeInTheDocument();
    expect(screen.getByText('Add Team')).toBeInTheDocument();
    expect(screen.getByLabelText('Club')).toBeInTheDocument();

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/clubs');
      expect(api.get).toHaveBeenCalledWith('/teams');
    });
  });

  it('fetches and displays teams on mount', async () => {
    render(<TeamManagement />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/teams');
      expect(screen.getByText('Alpha Club — Team Alpha')).toBeInTheDocument();
      expect(screen.getByText('Beta Club — Team Beta')).toBeInTheDocument();
    });
  });

  it('handles team creation successfully', async () => {
    render(<TeamManagement />);
    
    const input = screen.getByPlaceholderText('Enter team name');
    const submitButton = screen.getByText('Add Team');

    await userEvent.type(input, 'New Team');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/teams', { club_id: 1, name: 'New Team' });
      expect(screen.getByText('New Team')).toBeInTheDocument();
    });

    // Input should be cleared after successful submission
    expect(input).toHaveValue('');
  });

  it('displays error message when team fetch fails', async () => {
    const errorMessage = 'Failed to fetch teams';
    (api.get as any).mockImplementation((url: string) => {
      if (url === '/clubs') return Promise.resolve({ data: mockClubs });
      if (url === '/teams') return Promise.reject({ response: { data: { error: errorMessage } } });
      return Promise.resolve({ data: [] });
    });

    render(<TeamManagement />);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('displays error message when team creation fails', async () => {
    const errorMessage = 'Team name already exists';
    (api.post as any).mockRejectedValueOnce({ response: { data: { error: errorMessage } } });

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