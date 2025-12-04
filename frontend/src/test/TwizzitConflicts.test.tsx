import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TwizzitConflicts from '../components/TwizzitConflicts';
import api from '../utils/api';
import { AuthContext } from '../contexts/AuthContext';

// Mock the api module
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn()
  }
}));

describe('TwizzitConflicts', () => {
  const mockAdminUser = { id: 1, email: 'admin@test.com', role: 'admin' };
  const mockCoachUser = { id: 2, email: 'coach@test.com', role: 'coach' };
  const organizationId = 123;

  const mockConflicts = [
    {
      id: 1,
      entity_type: 'player',
      shotspot_id: 10,
      twizzit_id: 1001,
      conflict_type: 'data_mismatch',
      shotspot_data: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        jersey_number: 5
      },
      twizzit_data: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        jersey_number: 7
      },
      created_at: '2024-12-01T10:00:00Z'
    },
    {
      id: 2,
      entity_type: 'team',
      shotspot_id: 20,
      twizzit_id: 2001,
      conflict_type: 'duplicate',
      shotspot_data: {
        name: 'Team Alpha',
        city: 'Amsterdam'
      },
      twizzit_data: {
        name: 'Team Alpha',
        city: 'Rotterdam'
      },
      created_at: '2024-12-01T09:00:00Z'
    }
  ];

  const renderWithAuth = (user = mockAdminUser) => {
    return render(
      <AuthContext.Provider value={{ user, login: vi.fn(), logout: vi.fn() }}>
        <TwizzitConflicts organizationId={organizationId} />
      </AuthContext.Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show admin-only message for non-admin users', () => {
    renderWithAuth(mockCoachUser);
    expect(screen.getByText(/admin access required/i)).toBeInTheDocument();
  });

  it('should render conflicts list for admin users', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { conflicts: mockConflicts } 
    });
    
    renderWithAuth(mockAdminUser);
    
    await waitFor(() => {
      expect(screen.getByText(/synchronization conflicts/i)).toBeInTheDocument();
      expect(screen.getByText(/data mismatch/i)).toBeInTheDocument();
      expect(screen.getByText(/duplicate/i)).toBeInTheDocument();
    });
  });

  it('should display entity types correctly', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { conflicts: mockConflicts } 
    });
    
    renderWithAuth(mockAdminUser);
    
    await waitFor(() => {
      expect(screen.getByText('Player')).toBeInTheDocument();
      expect(screen.getByText('Team')).toBeInTheDocument();
    });
  });

  it('should show no conflicts message when list is empty', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { conflicts: [] } 
    });
    
    renderWithAuth(mockAdminUser);
    
    await waitFor(() => {
      expect(screen.getByText(/no conflicts found/i)).toBeInTheDocument();
      expect(screen.getByText(/all synchronization data is consistent/i)).toBeInTheDocument();
    });
  });

  it('should expand conflict to show data comparison', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { conflicts: mockConflicts } 
    });
    
    renderWithAuth(mockAdminUser);
    const user = userEvent.setup();
    
    await waitFor(() => {
      expect(screen.getByText(/data mismatch/i)).toBeInTheDocument();
    });

    // Click on conflict to expand
    const conflictCard = screen.getByText(/data mismatch/i).closest('.conflict-summary');
    await user.click(conflictCard!);

    await waitFor(() => {
      expect(screen.getByText('ShotSpot Data')).toBeInTheDocument();
      expect(screen.getByText('Twizzit Data')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
    });
  });

  it('should highlight different values in comparison', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { conflicts: mockConflicts } 
    });
    
    renderWithAuth(mockAdminUser);
    const user = userEvent.setup();
    
    await waitFor(() => {
      expect(screen.getByText(/data mismatch/i)).toBeInTheDocument();
    });

    const conflictCard = screen.getByText(/data mismatch/i).closest('.conflict-summary');
    await user.click(conflictCard!);

    await waitFor(() => {
      // Check that email and jersey_number rows exist (they differ)
      expect(screen.getByText('email')).toBeInTheDocument();
      expect(screen.getByText('jersey_number')).toBeInTheDocument();
    });
  });

  it('should resolve conflict with Twizzit wins', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { conflicts: mockConflicts } 
    });
    (api.put as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { success: true } 
    });
    
    renderWithAuth(mockAdminUser);
    const user = userEvent.setup();
    
    await waitFor(() => {
      expect(screen.getByText(/data mismatch/i)).toBeInTheDocument();
    });

    // Expand conflict
    const conflictCard = screen.getByText(/data mismatch/i).closest('.conflict-summary');
    await user.click(conflictCard!);

    await waitFor(() => {
      expect(screen.getByText(/use twizzit data/i)).toBeInTheDocument();
    });

    // Click Twizzit wins button
    const twizzitButton = screen.getByText(/use twizzit data/i);
    await user.click(twizzitButton);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/twizzit/conflicts/1/resolve', { 
        resolution: 'twizzit_wins' 
      });
      // Conflict should be removed from list
      expect(screen.queryByText(/data mismatch/i)).not.toBeInTheDocument();
    });
  });

  it('should resolve conflict with ShotSpot wins', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { conflicts: mockConflicts } 
    });
    (api.put as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { success: true } 
    });
    
    renderWithAuth(mockAdminUser);
    const user = userEvent.setup();
    
    await waitFor(() => {
      expect(screen.getByText(/data mismatch/i)).toBeInTheDocument();
    });

    const conflictCard = screen.getByText(/data mismatch/i).closest('.conflict-summary');
    await user.click(conflictCard!);

    await waitFor(() => {
      expect(screen.getByText(/use shotspot data/i)).toBeInTheDocument();
    });

    const shotsButton = screen.getByText(/use shotspot data/i);
    await user.click(shotsButton);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/twizzit/conflicts/1/resolve', { 
        resolution: 'shotspot_wins' 
      });
    });
  });

  it('should ignore conflict', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { conflicts: mockConflicts } 
    });
    (api.put as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { success: true } 
    });
    
    renderWithAuth(mockAdminUser);
    const user = userEvent.setup();
    
    await waitFor(() => {
      expect(screen.getByText(/data mismatch/i)).toBeInTheDocument();
    });

    const conflictCard = screen.getByText(/data mismatch/i).closest('.conflict-summary');
    await user.click(conflictCard!);

    await waitFor(() => {
      expect(screen.getByText(/ignore conflict/i)).toBeInTheDocument();
    });

    const ignoreButton = screen.getByText(/ignore conflict/i);
    await user.click(ignoreButton);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/twizzit/conflicts/1/resolve', { 
        resolution: 'ignored' 
      });
    });
  });

  it('should disable buttons during resolution', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { conflicts: mockConflicts } 
    });
    (api.put as ReturnType<typeof vi.fn>).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ data: { success: true } }), 1000))
    );
    
    renderWithAuth(mockAdminUser);
    const user = userEvent.setup();
    
    await waitFor(() => {
      expect(screen.getByText(/data mismatch/i)).toBeInTheDocument();
    });

    const conflictCard = screen.getByText(/data mismatch/i).closest('.conflict-summary');
    await user.click(conflictCard!);

    await waitFor(() => {
      expect(screen.getByText(/use twizzit data/i)).toBeInTheDocument();
    });

    const twizzitButton = screen.getByText(/use twizzit data/i);
    await user.click(twizzitButton);

    // Buttons should be disabled during resolution
    await waitFor(() => {
      // Find button that contains "Resolving" text (component shows emoji + "Resolving...")
      const allButtons = screen.getAllByRole('button');
      const resolvingButton = allButtons.find(btn => btn.textContent?.includes('Resolving'));
      expect(resolvingButton).toBeDefined();
      expect(resolvingButton).toBeDisabled();
    });
  });

  it('should call onConflictResolved callback after resolution', async () => {
    const onConflictResolved = vi.fn();
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { conflicts: mockConflicts } 
    });
    (api.put as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { success: true } 
    });
    
    render(
      <AuthContext.Provider value={{ user: mockAdminUser, login: vi.fn(), logout: vi.fn() }}>
        <TwizzitConflicts organizationId={organizationId} onConflictResolved={onConflictResolved} />
      </AuthContext.Provider>
    );
    
    const user = userEvent.setup();
    
    await waitFor(() => {
      expect(screen.getByText(/data mismatch/i)).toBeInTheDocument();
    });

    const conflictCard = screen.getByText(/data mismatch/i).closest('.conflict-summary');
    await user.click(conflictCard!);

    await waitFor(() => {
      expect(screen.getByText(/use twizzit data/i)).toBeInTheDocument();
    });

    const twizzitButton = screen.getByText(/use twizzit data/i);
    await user.click(twizzitButton);

    await waitFor(() => {
      expect(onConflictResolved).toHaveBeenCalled();
    });
  });

  it('should handle resolution errors gracefully', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { conflicts: mockConflicts } 
    });
    (api.put as ReturnType<typeof vi.fn>).mockRejectedValue({ 
      response: { data: { message: 'Failed to resolve conflict' } } 
    });
    
    renderWithAuth(mockAdminUser);
    const user = userEvent.setup();
    
    await waitFor(() => {
      expect(screen.getByText(/data mismatch/i)).toBeInTheDocument();
    });

    const conflictCard = screen.getByText(/data mismatch/i).closest('.conflict-summary');
    await user.click(conflictCard!);

    await waitFor(() => {
      expect(screen.getByText(/use twizzit data/i)).toBeInTheDocument();
    });

    const twizzitButton = screen.getByText(/use twizzit data/i);
    await user.click(twizzitButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to resolve conflict/i)).toBeInTheDocument();
    });
  });

  it('should display conflict IDs', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { conflicts: mockConflicts } 
    });
    
    renderWithAuth(mockAdminUser);
    
    // Wait for conflicts to load
    await waitFor(() => {
      expect(screen.getByText(/data mismatch/i)).toBeInTheDocument();
    });

    // Check that conflict-ids divs exist and contain the IDs
    const conflictIdsElements = document.querySelectorAll('.conflict-ids');
    expect(conflictIdsElements.length).toBeGreaterThanOrEqual(2);
    
    // Check that the IDs appear somewhere in the conflict cards
    const conflictCards = document.querySelectorAll('.conflict-card');
    const firstCardText = conflictCards[0].textContent;
    const secondCardText = conflictCards[1].textContent;
    
    expect(firstCardText).toContain('10');
    expect(firstCardText).toContain('1001');
    expect(secondCardText).toContain('20');
    expect(secondCardText).toContain('2001');
  });

  it('should format conflict types correctly', async () => {
    const conflictsWithVariedTypes = [
      { ...mockConflicts[0], conflict_type: 'deleted_in_twizzit' },
      { ...mockConflicts[1], conflict_type: 'deleted_in_shotspot' }
    ];
    
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { conflicts: conflictsWithVariedTypes } 
    });
    
    renderWithAuth(mockAdminUser);
    
    await waitFor(() => {
      expect(screen.getByText('Deleted in Twizzit')).toBeInTheDocument();
      expect(screen.getByText('Deleted in ShotSpot')).toBeInTheDocument();
    });
  });
});
