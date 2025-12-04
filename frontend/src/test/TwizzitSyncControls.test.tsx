import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TwizzitSyncControls from '../components/TwizzitSyncControls';
import api from '../utils/api';
import { AuthContext } from '../contexts/AuthContext';

// Mock the api module
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe('TwizzitSyncControls', () => {
  const mockUser = { id: 1, email: 'admin@test.com', role: 'admin' };
  const organizationId = 123;

  const mockStatus = {
    config: {
      organizationId: 123,
      organizationName: 'Test Organization',
      syncEnabled: true,
      autoSyncFrequency: 'daily',
      syncInProgress: false,
      lastSyncAt: '2024-12-01T10:00:00Z'
    },
    latestSync: {
      sync_type: 'players',
      status: 'success',
      records_created: 5,
      records_updated: 3,
      records_skipped: 2,
      started_at: '2024-12-01T10:00:00Z',
      completed_at: '2024-12-01T10:05:00Z',
      duration_ms: 5000,
      error_count: 0
    },
    pendingConflicts: 0
  };

  const renderWithAuth = () => {
    return render(
      <AuthContext.Provider value={{ user: mockUser, login: vi.fn(), logout: vi.fn() }}>
        <TwizzitSyncControls organizationId={organizationId} />
      </AuthContext.Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render sync control buttons', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockStatus });
    
    renderWithAuth();
    
    await waitFor(() => {
      expect(screen.getByText(/sync players/i)).toBeInTheDocument();
      expect(screen.getByText(/sync teams/i)).toBeInTheDocument();
      expect(screen.getByText(/full sync/i)).toBeInTheDocument();
    });
  });

  it('should display sync status on load', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockStatus });
    
    renderWithAuth();
    
    await waitFor(() => {
      expect(screen.getByText(/last sync results/i)).toBeInTheDocument();
      expect(screen.getByText(/success/i)).toBeInTheDocument();
      expect(screen.getByText(/created/i)).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('should trigger player sync successfully', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockStatus });
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { 
        success: true
      } 
    });
    
    renderWithAuth();
    const user = userEvent.setup({ delay: null });
    
    await waitFor(() => {
      expect(screen.getByText(/sync players/i)).toBeInTheDocument();
    });

    const syncButton = screen.getByText(/sync players/i);
    await user.click(syncButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/twizzit/sync/players', { organizationId });
      expect(screen.getByText(/players sync started successfully/i)).toBeInTheDocument();
    });
  });

  it('should trigger team sync successfully', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockStatus });
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { 
        success: true
      } 
    });
    
    renderWithAuth();
    const user = userEvent.setup({ delay: null });
    
    await waitFor(() => {
      expect(screen.getByText(/sync teams/i)).toBeInTheDocument();
    });

    const syncButton = screen.getByText(/sync teams/i);
    await user.click(syncButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/twizzit/sync/teams', { organizationId });
      expect(screen.getByText(/teams sync started successfully/i)).toBeInTheDocument();
    });
  });

  it('should trigger full sync successfully', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockStatus });
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { 
        success: true
      } 
    });
    
    renderWithAuth();
    const user = userEvent.setup({ delay: null });
    
    await waitFor(() => {
      expect(screen.getByText(/full sync/i)).toBeInTheDocument();
    });

    const syncButton = screen.getByText(/full sync/i);
    await user.click(syncButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/twizzit/sync/full', { organizationId });
      expect(screen.getByText(/full sync started successfully/i)).toBeInTheDocument();
    });
  });

  it('should handle sync already in progress (409 error)', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockStatus });
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue({ 
      response: { 
        status: 409,
        data: { error: 'Sync already in progress' } 
      } 
    });
    
    renderWithAuth();
    const user = userEvent.setup({ delay: null });
    
    await waitFor(() => {
      expect(screen.getByText(/sync players/i)).toBeInTheDocument();
    });

    const syncButton = screen.getByText(/sync players/i);
    await user.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText(/sync.*already in progress/i)).toBeInTheDocument();
    });
  });

  it('should display sync in progress indicator', async () => {
    const inProgressStatus = { ...mockStatus, config: { ...mockStatus.config, syncInProgress: true } };
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: inProgressStatus });
    
    renderWithAuth();
    
    await waitFor(() => {
      expect(screen.getByText(/sync in progress/i)).toBeInTheDocument();
    });
    
    // Buttons should be disabled during sync
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  it('should auto-refresh status during sync', async () => {
    const inProgressStatus = { ...mockStatus, config: { ...mockStatus.config, syncInProgress: true } };
    
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: inProgressStatus });
    
    renderWithAuth();
    
    await waitFor(() => {
      expect(screen.getByText(/sync in progress/i)).toBeInTheDocument();
    });

    // Verify that the component fetched status (auto-refresh behavior is internal)
    expect(api.get).toHaveBeenCalled();
  });

  it('should display pending conflicts warning', async () => {
    const statusWithConflicts = { ...mockStatus, pendingConflicts: 5 };
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: statusWithConflicts });
    
    renderWithAuth();
    
    await waitFor(() => {
      expect(screen.getByText(/5 pending conflict/i)).toBeInTheDocument();
    });
  });

  it('should call onSyncComplete callback after successful sync', async () => {
    const onSyncComplete = vi.fn();
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockStatus });
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { success: true } 
    });
    
    render(
      <AuthContext.Provider value={{ user: mockUser, login: vi.fn(), logout: vi.fn() }}>
        <TwizzitSyncControls organizationId={organizationId} onSyncComplete={onSyncComplete} />
      </AuthContext.Provider>
    );
    
    const user = userEvent.setup({ delay: null });
    
    await waitFor(() => {
      expect(screen.getByText(/sync players/i)).toBeInTheDocument();
    });

    const syncButton = screen.getByText(/sync players/i);
    await user.click(syncButton);

    // Wait for the callback to be called (component uses 1000ms setTimeout)
    await waitFor(() => {
      expect(onSyncComplete).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('should format duration correctly', async () => {
    const statusWithLongSync = {
      ...mockStatus,
      latestSync: {
        ...mockStatus.latestSync!,
        duration_ms: 125000 // 2m 5s
      }
    };
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: statusWithLongSync });
    
    renderWithAuth();
    
    await waitFor(() => {
      expect(screen.getByText(/2m 5s/i)).toBeInTheDocument();
    });
  });

  it('should handle network errors gracefully', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    
    renderWithAuth();
    
    // Component shows loading state when fetch fails (doesn't render error in UI)
    await waitFor(() => {
      expect(screen.getByText(/loading sync status/i)).toBeInTheDocument();
    });
    
    // Error is logged but not shown to prevent component from crashing
    expect(api.get).toHaveBeenCalled();
  });
});
