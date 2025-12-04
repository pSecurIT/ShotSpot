import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TwizzitSyncHistory from '../components/TwizzitSyncHistory';
import api from '../utils/api';
import { AuthContext } from '../contexts/AuthContext';

// Mock the api module
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn()
  }
}));

describe('TwizzitSyncHistory', () => {
  const mockUser = { id: 1, email: 'admin@test.com', role: 'admin' };
  const organizationId = 123;

  const mockLogs = [
    {
      id: 1,
      sync_type: 'players',
      status: 'success',
      started_at: '2024-12-01T10:00:00Z',
      completed_at: '2024-12-01T10:05:00Z',
      duration_ms: 300000,
      records_fetched: 10,
      records_created: 5,
      records_updated: 3,
      records_skipped: 2,
      error_count: 0
    },
    {
      id: 2,
      sync_type: 'teams',
      status: 'success',
      started_at: '2024-12-01T09:00:00Z',
      completed_at: '2024-12-01T09:02:00Z',
      duration_ms: 120000,
      records_fetched: 3,
      records_created: 2,
      records_updated: 1,
      records_skipped: 0,
      error_count: 0
    },
    {
      id: 3,
      sync_type: 'full',
      status: 'failed',
      started_at: '2024-12-01T08:00:00Z',
      completed_at: '2024-12-01T08:01:00Z',
      duration_ms: 60000,
      records_fetched: 0,
      records_created: 0,
      records_updated: 0,
      records_skipped: 0,
      error_count: 5
    }
  ];

  const mockDetailedLog = {
    ...mockLogs[2],
    errors: [
      { entity: 'John Doe', error: 'Invalid email format' },
      { entity: 'Jane Smith', error: 'Duplicate player ID' }
    ]
  };

  const renderWithAuth = () => {
    return render(
      <AuthContext.Provider value={{ user: mockUser, login: vi.fn(), logout: vi.fn() }}>
        <TwizzitSyncHistory organizationId={organizationId} />
      </AuthContext.Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render sync history table', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { 
        logs: mockLogs,
        pagination: { total: 3, offset: 0, limit: 20, hasMore: false }
      } 
    });
    
    renderWithAuth();
    
    await waitFor(() => {
      expect(screen.getByText(/synchronization history/i)).toBeInTheDocument();
      // Check that the stats are displayed (numbers are shown without labels)
      expect(screen.getAllByText('5').length).toBeGreaterThan(0);
      expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    });
  });

  it('should display log type indicators', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { 
        logs: mockLogs,
        pagination: { total: 3, offset: 0, limit: 20, hasMore: false }
      } 
    });
    
    renderWithAuth();
    
    await waitFor(() => {
      // Check for log type labels (emojis may not render in test environment)
      expect(screen.getByText('Players')).toBeInTheDocument();
      expect(screen.getByText('Teams')).toBeInTheDocument();
      expect(screen.getByText(/full sync/i)).toBeInTheDocument();
    });
  });

  it('should display status badges with correct colors', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { 
        logs: mockLogs,
        pagination: { total: 3, offset: 0, limit: 20, hasMore: false }
      } 
    });
    
    renderWithAuth();
    
    await waitFor(() => {
      const allSuccess = screen.getAllByText(/success/i);
      // Filter to only status labels (not options)
      const successLabels = allSuccess.filter(el => el.className === 'status-label');
      expect(successLabels.length).toBe(2);
      const allFailed = screen.getAllByText(/failed/i);
      const failedLabel = allFailed.find(el => el.className === 'status-label');
      expect(failedLabel).toBeInTheDocument();
    });
  });

  it('should filter logs by type', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { 
        logs: mockLogs,
        pagination: { total: 3, offset: 0, limit: 20, hasMore: false }
      } 
    });
    
    renderWithAuth();
    const user = userEvent.setup();
    
    await waitFor(() => {
      expect(screen.getByText(/type:/i)).toBeInTheDocument();
    });

    // Get the select by its role and nearby text
    const selects = screen.getAllByRole('combobox');
    const typeFilter = selects[0]; // First select is the type filter
    await user.selectOptions(typeFilter, 'players');
    
    // After filtering, only players logs should be visible
    await waitFor(() => {
      const allPlayers = screen.getAllByText('Players');
      const playerLabel = allPlayers.find(el => el.className === 'type-label');
      expect(playerLabel).toBeInTheDocument();
      // Check that 'Teams' type-label is not present (ignore option element)
      const allTeams = screen.queryAllByText('Teams');
      const teamsLabel = allTeams.find(el => el.className === 'type-label');
      expect(teamsLabel).toBeUndefined();
    });
  });

  it('should filter logs by status', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { 
        logs: mockLogs,
        pagination: { total: 3, offset: 0, limit: 20, hasMore: false }
      } 
    });
    
    renderWithAuth();
    const user = userEvent.setup();
    
    await waitFor(() => {
      expect(screen.getByText(/status:/i)).toBeInTheDocument();
    });

    // Get the select by its role
    const selects = screen.getAllByRole('combobox');
    const statusFilter = selects[1]; // Second select is the status filter
    await user.selectOptions(statusFilter, 'failed');
    
    // After filtering, only failed log should be visible
    await waitFor(() => {
      const allFailed = screen.getAllByText(/failed/i);
      const failedLabel = allFailed.find(el => el.className === 'status-label');
      expect(failedLabel).toBeInTheDocument();
      const allSuccess = screen.queryAllByText(/success/i);
      const successLabels = allSuccess.filter(el => el.className === 'status-label');
      expect(successLabels.length).toBe(0);
    });
  });

  it('should expand log to show details', async () => {
    (api.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ 
        data: { 
          logs: mockLogs,
          pagination: { total: 3, offset: 0, limit: 20, hasMore: false }
        } 
      })
      .mockResolvedValueOnce({ data: { log: mockDetailedLog } });
    
    renderWithAuth();
    const user = userEvent.setup();
    
    await waitFor(() => {
      // Look for logs to be rendered - wait for the type labels to appear
      expect(screen.getByText('Players')).toBeInTheDocument();
    });

    // Click on failed log to expand - get all log rows and find the failed one
    const logRows = document.querySelectorAll('.log-row');
    const failedLog = logRows[2] as HTMLElement; // Third log is the failed full sync
    
    // Click the log summary to expand
    const logSummary = failedLog.querySelector('.log-summary') as HTMLElement;
    await user.click(logSummary);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/twizzit/logs/3');
    });
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Invalid email format')).toBeInTheDocument();
    });
  });

  it('should paginate through logs', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { 
        logs: mockLogs,
        pagination: { total: 50, offset: 0, limit: 20, hasMore: true }
      } 
    });
    
    renderWithAuth();
    const user = userEvent.setup();
    
    await waitFor(() => {
      // Wait for logs to load first
      expect(screen.getByText('Players')).toBeInTheDocument();
    });

    // Find next button using text content
    const nextButton = screen.getByText(/next/i);
    await user.click(nextButton);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/twizzit/logs?organizationId=123&limit=20&offset=20');
    });
  });

  it('should disable previous button on first page', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { 
        logs: mockLogs,
        pagination: { total: 50, offset: 0, limit: 20, hasMore: true }
      } 
    });
    
    renderWithAuth();
    
    // Wait for logs to load
    await waitFor(() => {
      expect(screen.getByText('Players')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /previous/i });
    expect(prevButton).toBeDisabled();
  });

  it('should disable next button on last page', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { 
        logs: mockLogs,
        pagination: { total: 50, offset: 40, limit: 20, hasMore: false }
      } 
    });
    
    renderWithAuth();

    // Wait for logs to load
    await waitFor(() => {
      expect(screen.getByText('Players')).toBeInTheDocument();
    });

    // Pagination buttons should be visible since total (50) > limit (20)
    const nextButton = screen.getByText(/next/i).closest('button');
    expect(nextButton).toBeDisabled();
  });

  it('should show empty state when no logs', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { 
        logs: [],
        pagination: { total: 0, offset: 0, limit: 20, hasMore: false }
      } 
    });
    
    renderWithAuth();
    
    await waitFor(() => {
      expect(screen.getByText(/no sync logs found/i)).toBeInTheDocument();
    });
  });

  it('should display duration in readable format', async () => {
    const logsWithVariedDurations = [
      { ...mockLogs[0], duration_ms: 65000 }, // 1m 5s
      { ...mockLogs[1], duration_ms: 3000 },  // 3s
      { ...mockLogs[2], duration_ms: 125000 } // 2m 5s
    ];
    
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { 
        logs: logsWithVariedDurations,
        pagination: { total: 3, offset: 0, limit: 20, hasMore: false }
      } 
    });
    
    renderWithAuth();
    
    await waitFor(() => {
      expect(screen.getByText(/1m 5s/i)).toBeInTheDocument();
      expect(screen.getByText(/3s/i)).toBeInTheDocument();
      expect(screen.getByText(/2m 5s/i)).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue({ 
      response: { data: { error: 'Failed to fetch logs' } } 
    });
    
    renderWithAuth();
    
    await waitFor(() => {
      expect(screen.getByText(/failed to fetch logs/i)).toBeInTheDocument();
    });
  });

  it('should show error count in stats', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { 
        logs: mockLogs,
        pagination: { total: 3, offset: 0, limit: 20, hasMore: false }
      } 
    });
    
    renderWithAuth();
    
    await waitFor(() => {
      // Error count should be displayed - check for the error stat specifically
      const errorStats = screen.getAllByText('5');
      expect(errorStats.length).toBeGreaterThan(0);
      // Verify error count is shown (the failed log has 5 errors)
      expect(screen.getByTitle('Errors')).toBeInTheDocument();
    });
  });

  it('should combine type and status filters', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { 
        logs: mockLogs,
        pagination: { total: 3, offset: 0, limit: 20, hasMore: false }
      } 
    });
    
    renderWithAuth();
    const user = userEvent.setup();
    
    await waitFor(() => {
      expect(screen.getByText(/type:/i)).toBeInTheDocument();
    });

    // Apply both filters
    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0], 'full'); // Type filter
    await user.selectOptions(selects[1], 'failed'); // Status filter
    
    // Only full sync with failed status should be visible
    await waitFor(() => {
      const failedStatuses = screen.getAllByText('Failed');
      const failedLabel = failedStatuses.find(el => el.className === 'status-label');
      expect(failedLabel).toBeInTheDocument();
      const fullType = screen.getAllByText(/Full/i).find(el => el.className === 'type-label');
      expect(fullType).toBeInTheDocument();
      // Check Players and Teams type-labels are not present (ignore options)
      const allPlayers = screen.queryAllByText('Players');
      const playersLabel = allPlayers.find(el => el.className === 'type-label');
      expect(playersLabel).toBeUndefined();
      const allTeams = screen.queryAllByText('Teams');
      const teamsLabel = allTeams.find(el => el.className === 'type-label');
      expect(teamsLabel).toBeUndefined();
    });
  });
});
