import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClubManagement from '../components/ClubManagement';
import { clubsApi } from '../services/clubsApi';

vi.mock('../services/clubsApi', () => ({
  clubsApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getTeams: vi.fn(),
    getPlayers: vi.fn()
  }
}));

describe('ClubManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('renders and fetches clubs on mount', async () => {
    (clubsApi.getAll as unknown as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Alpha Club', created_at: '', updated_at: '' },
      { id: 2, name: 'Beta Club', created_at: '', updated_at: '' }
    ]);

    render(<ClubManagement />);

    expect(screen.getByText('Clubs Management')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add club/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(clubsApi.getAll).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Alpha Club')).toBeInTheDocument();
      expect(screen.getByText('Beta Club')).toBeInTheDocument();
    });
  });

  it('filters clubs by search term', async () => {
    (clubsApi.getAll as unknown as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Alpha Club', created_at: '', updated_at: '' },
      { id: 2, name: 'Beta Club', created_at: '', updated_at: '' }
    ]);

    render(<ClubManagement />);

    await screen.findByText('Alpha Club');

    await userEvent.type(screen.getByLabelText('Search clubs'), 'beta');

    expect(screen.queryByText('Alpha Club')).not.toBeInTheDocument();
    expect(screen.getByText('Beta Club')).toBeInTheDocument();
  });

  it('creates a club with validation and refreshes list', async () => {
    (clubsApi.getAll as unknown as jest.Mock)
      .mockResolvedValueOnce([{ id: 1, name: 'Alpha Club', created_at: '', updated_at: '' }])
      .mockResolvedValueOnce([
        { id: 1, name: 'Alpha Club', created_at: '', updated_at: '' },
        { id: 2, name: 'New Club', created_at: '', updated_at: '' }
      ]);

    (clubsApi.create as unknown as jest.Mock).mockResolvedValue({
      id: 2,
      name: 'New Club',
      created_at: '',
      updated_at: ''
    });

    render(<ClubManagement />);

    await screen.findByText('Alpha Club');

    await userEvent.click(screen.getByRole('button', { name: /add club/i }));

    // empty submit shows validation
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(screen.getByText('Club name is required')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Enter club name'), 'New Club');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(clubsApi.create).toHaveBeenCalledWith({ name: 'New Club' });
    });

    await waitFor(() => {
      expect(clubsApi.getAll).toHaveBeenCalledTimes(2);
      expect(screen.getByText('New Club')).toBeInTheDocument();
    });
  });

  it('edits a club', async () => {
    (clubsApi.getAll as unknown as jest.Mock)
      .mockResolvedValueOnce([{ id: 1, name: 'Alpha Club', created_at: '', updated_at: '' }])
      .mockResolvedValueOnce([{ id: 1, name: 'Alpha Club Updated', created_at: '', updated_at: '' }]);

    (clubsApi.update as unknown as jest.Mock).mockResolvedValue({
      id: 1,
      name: 'Alpha Club Updated',
      created_at: '',
      updated_at: ''
    });

    render(<ClubManagement />);

    await screen.findByText('Alpha Club');

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    const input = screen.getByPlaceholderText('Enter club name');
    await userEvent.clear(input);
    await userEvent.type(input, 'Alpha Club Updated');

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(clubsApi.update).toHaveBeenCalledWith(1, { name: 'Alpha Club Updated' });
    });

    await waitFor(() => {
      expect(screen.getByText('Alpha Club Updated')).toBeInTheDocument();
    });
  });

  it('deletes a club with confirmation', async () => {
    (clubsApi.getAll as unknown as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Alpha Club', created_at: '', updated_at: '' },
      { id: 2, name: 'Beta Club', created_at: '', updated_at: '' }
    ]);
    (clubsApi.delete as unknown as jest.Mock).mockResolvedValue(undefined);

    render(<ClubManagement />);

    await screen.findByText('Alpha Club');

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    await userEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(clubsApi.delete).toHaveBeenCalledWith(1);
    });

    expect(screen.queryByText('Alpha Club')).not.toBeInTheDocument();
    expect(screen.getByText('Beta Club')).toBeInTheDocument();
  });

  it('views teams by club', async () => {
    (clubsApi.getAll as unknown as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Alpha Club', created_at: '', updated_at: '' }
    ]);
    (clubsApi.getTeams as unknown as jest.Mock).mockResolvedValue([
      { id: 10, name: 'U19', club_id: 1 }
    ]);

    render(<ClubManagement />);

    await screen.findByText('Alpha Club');

    await userEvent.click(screen.getByRole('button', { name: /view teams/i }));

    await waitFor(() => {
      expect(clubsApi.getTeams).toHaveBeenCalledWith(1);
      expect(screen.getByText('U19')).toBeInTheDocument();
    });
  });

  it('views players by club', async () => {
    (clubsApi.getAll as unknown as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Alpha Club', created_at: '', updated_at: '' }
    ]);
    (clubsApi.getPlayers as unknown as jest.Mock).mockResolvedValue([
      {
        id: 20,
        first_name: 'Jane',
        last_name: 'Doe',
        jersey_number: 7,
        team_name: 'U19'
      }
    ]);

    render(<ClubManagement />);

    await screen.findByText('Alpha Club');

    await userEvent.click(screen.getByRole('button', { name: /view players/i }));

    await waitFor(() => {
      expect(clubsApi.getPlayers).toHaveBeenCalledWith(1);
      expect(screen.getByText('Jane Doe #7')).toBeInTheDocument();
      expect(screen.getByText('U19')).toBeInTheDocument();
    });
  });

  it('paginates clubs for large datasets', async () => {
    const clubs = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      name: `Club ${String(i + 1).padStart(2, '0')}`,
      created_at: '',
      updated_at: ''
    }));

    (clubsApi.getAll as unknown as jest.Mock).mockResolvedValue(clubs);

    render(<ClubManagement />);

    await screen.findByText('Club 01');

    // Page size is 12; Club 13 should not be visible on first page
    expect(screen.queryByText('Club 13')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('Club 13')).toBeInTheDocument();
    });
  });
});
