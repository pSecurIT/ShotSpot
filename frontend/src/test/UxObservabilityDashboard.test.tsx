
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import UxObservabilityDashboard from '../components/UxObservabilityDashboard';
import api from '../utils/api';

vi.mock('../utils/api');
const mockApi = api as jest.Mocked<typeof api>;

const mockUseAuth = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../hooks/useBreadcrumbs', () => ({
  default: () => [],
}));

const ADMIN_USER = { id: 1, username: 'admin', role: 'admin', email: 'admin@test.com' };

/** Return 4 resolved mocks for the standard data endpoints. */
function mockDataResponses() {
  mockApi.get
    .mockResolvedValueOnce({ data: { overview: {
      total_events: 12,
      feedback_count: 0,
      negative_feedback_count: 0,
      long_task_count: 2,
      slow_render_count: 1,
      avg_flow_ms: 420,
      p95_flow_ms: 880,
      avg_api_latency_ms: 210,
      p95_api_latency_ms: 540,
    } } })
    .mockResolvedValueOnce({ data: { flows: [{ flow_name: 'open_games_list', route_path: '/games', sample_count: 4, avg_ms: 300, p95_ms: 470, max_ms: 520 }] } })
    .mockResolvedValueOnce({ data: { latency: [{ endpoint: '/games', sample_count: 6, avg_ms: 180, p95_ms: 330, max_ms: 410 }] } })
    .mockResolvedValueOnce({ data: { indicators: [{ event_type: 'long_task', sample_count: 2, avg_ms: 150, p95_ms: 220, max_ms: 260 }] } });
}

function renderDashboard() {
  return render(
    <BrowserRouter>
      <UxObservabilityDashboard />
    </BrowserRouter>
  );
}

describe('🔭 UxObservabilityDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('🔒 access control', () => {
    it('🚫 denies access for non-admin users', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 12, username: 'coach', role: 'coach', email: 'coach@test.com' },
      });

      renderDashboard();

      expect(screen.getByText('You do not have permission to access this page.')).toBeInTheDocument();
    });
  });

  describe('📊 initial load', () => {
    it('✅ loads UX observability metrics for admins', async () => {
      mockUseAuth.mockReturnValue({ user: ADMIN_USER });
      mockDataResponses();

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('UX Observability')).toBeInTheDocument();
      });

      expect(mockApi.get).toHaveBeenCalledWith(
        '/dashboard/ux/overview',
        expect.objectContaining({ params: expect.objectContaining({ from: expect.any(String), to: expect.any(String) }) })
      );
      expect(screen.getByText('Slowest Tracked Flows')).toBeInTheDocument();
      expect(screen.getByText('API Latency Impact')).toBeInTheDocument();
      expect(screen.getAllByText('/games').length).toBeGreaterThan(0);
    });

    it('✅ defaults to "Last 7 days" preset in the selector', async () => {
      mockUseAuth.mockReturnValue({ user: ADMIN_USER });
      mockDataResponses();

      renderDashboard();

      await waitFor(() => screen.getByText('UX Observability'));

      expect(screen.getByRole('combobox', { name: /time window/i })).toHaveValue('7d');
    });

    it('✅ initial from param is ~7 days before to', async () => {
      mockUseAuth.mockReturnValue({ user: ADMIN_USER });
      mockDataResponses();

      const before = Date.now();
      renderDashboard();

      await waitFor(() => screen.getByText('UX Observability'));

      const call = mockApi.get.mock.calls[0] as [string, { params: { from: string; to: string } }];
      const { from, to } = call[1].params;
      const diffMs = new Date(to).getTime() - new Date(from).getTime();
      const sevenDaysMs = 7 * 24 * 3_600_000;
      expect(diffMs).toBeGreaterThanOrEqual(sevenDaysMs - 5000);
      expect(diffMs).toBeLessThanOrEqual(sevenDaysMs + 5000);
      expect(new Date(to).getTime()).toBeGreaterThanOrEqual(before);
    });
  });

  describe('⏱️ preset filter', () => {
    it('✅ switching preset reloads data with updated from/to', async () => {
      mockUseAuth.mockReturnValue({ user: ADMIN_USER });
      // Initial load (7d)
      mockDataResponses();
      // Reload after preset change (1h)
      mockDataResponses();

      renderDashboard();
      await waitFor(() => screen.getByText('UX Observability'));

      const select = screen.getByRole('combobox', { name: /time window/i });
      await userEvent.selectOptions(select, '1h');

      await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(8));

      // Last batch of calls should have from/to ~1 hour apart
      const call = mockApi.get.mock.calls[4] as [string, { params: { from: string; to: string } }];
      const { from, to } = call[1].params;
      const diffMs = new Date(to).getTime() - new Date(from).getTime();
      const oneHourMs = 3_600_000;
      expect(diffMs).toBeGreaterThanOrEqual(oneHourMs - 5000);
      expect(diffMs).toBeLessThanOrEqual(oneHourMs + 5000);
    });

    it('✅ each granular preset computes the correct window duration', async () => {
      mockUseAuth.mockReturnValue({ user: ADMIN_USER });

      const cases: Array<[string, number]> = [
        ['1h',  1   * 3_600_000],
        ['6h',  6   * 3_600_000],
        ['12h', 12  * 3_600_000],
        ['24h', 24  * 3_600_000],
        ['3d',  3   * 86_400_000],
        ['14d', 14  * 86_400_000],
        ['30d', 30  * 86_400_000],
      ];

      for (const [presetValue, expectedMs] of cases) {
        vi.clearAllMocks();
        mockDataResponses();

        renderDashboard();
        await waitFor(() => screen.getByText('UX Observability'));

        // Switch to the preset under test
        mockDataResponses();
        await userEvent.selectOptions(
          screen.getByRole('combobox', { name: /time window/i }),
          presetValue
        );

        await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(8));

        const call = mockApi.get.mock.calls[4] as [string, { params: { from: string; to: string } }];
        const diffMs = new Date(call[1].params.to).getTime() - new Date(call[1].params.from).getTime();
        expect(diffMs).toBeGreaterThanOrEqual(expectedMs - 5000);
        expect(diffMs).toBeLessThanOrEqual(expectedMs + 5000);

        cleanup();
      }
    });
  });

  describe('📅 custom range filter', () => {
    it('✅ selecting "Custom range" shows From/To date inputs', async () => {
      mockUseAuth.mockReturnValue({ user: ADMIN_USER });
      mockDataResponses();

      renderDashboard();
      await waitFor(() => screen.getByText('UX Observability'));

      await userEvent.selectOptions(
        screen.getByRole('combobox', { name: /time window/i }),
        'custom'
      );

      expect(screen.getByLabelText(/custom range from/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/custom range to/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /apply/i })).toBeInTheDocument();
    });

    it('✅ From/To inputs are pre-filled with the current active range', async () => {
      mockUseAuth.mockReturnValue({ user: ADMIN_USER });
      mockDataResponses();

      renderDashboard();
      await waitFor(() => screen.getByText('UX Observability'));

      await userEvent.selectOptions(
        screen.getByRole('combobox', { name: /time window/i }),
        'custom'
      );

      // Both inputs should have a datetime-local value (YYYY-MM-DDTHH:MM)
      const fromInput = screen.getByLabelText(/custom range from/i) as HTMLInputElement;
      const toInput   = screen.getByLabelText(/custom range to/i) as HTMLInputElement;
      expect(fromInput.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      expect(toInput.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    it('✅ Apply fires API call with user-supplied from/to', async () => {
      mockUseAuth.mockReturnValue({ user: ADMIN_USER });
      mockDataResponses();
      mockDataResponses(); // after Apply

      renderDashboard();
      await waitFor(() => screen.getByText('UX Observability'));

      await userEvent.selectOptions(
        screen.getByRole('combobox', { name: /time window/i }),
        'custom'
      );

      const fromInput = screen.getByLabelText(/custom range from/i);
      const toInput   = screen.getByLabelText(/custom range to/i);

      await userEvent.clear(fromInput);
      await userEvent.type(fromInput, '2026-04-01T08:00');
      await userEvent.clear(toInput);
      await userEvent.type(toInput, '2026-04-02T08:00');

      await userEvent.click(screen.getByRole('button', { name: /apply/i }));

      await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(8));

      const call = mockApi.get.mock.calls[4] as [string, { params: { from: string; to: string } }];
      const { from, to } = call[1].params;
      // Diff should be exactly 1 day
      const diffMs = new Date(to).getTime() - new Date(from).getTime();
      expect(diffMs).toBe(86_400_000);
    });

    it('🚫 shows error when From is missing', async () => {
      mockUseAuth.mockReturnValue({ user: ADMIN_USER });
      mockDataResponses();

      renderDashboard();
      await waitFor(() => screen.getByText('UX Observability'));

      await userEvent.selectOptions(
        screen.getByRole('combobox', { name: /time window/i }),
        'custom'
      );

      await userEvent.clear(screen.getByLabelText(/custom range from/i));
      await userEvent.click(screen.getByRole('button', { name: /apply/i }));

      expect(screen.getByRole('alert')).toHaveTextContent('Both from and to are required');
      // Should not have fired a second batch of API calls
      expect(mockApi.get).toHaveBeenCalledTimes(4);
    });

    it('🚫 shows error when From is after To', async () => {
      mockUseAuth.mockReturnValue({ user: ADMIN_USER });
      mockDataResponses();

      renderDashboard();
      await waitFor(() => screen.getByText('UX Observability'));

      await userEvent.selectOptions(
        screen.getByRole('combobox', { name: /time window/i }),
        'custom'
      );

      const fromInput = screen.getByLabelText(/custom range from/i);
      const toInput   = screen.getByLabelText(/custom range to/i);

      await userEvent.clear(fromInput);
      await userEvent.type(fromInput, '2026-04-02T08:00');
      await userEvent.clear(toInput);
      await userEvent.type(toInput, '2026-04-01T08:00');

      await userEvent.click(screen.getByRole('button', { name: /apply/i }));

      expect(screen.getByRole('alert')).toHaveTextContent('"From" must be before "To"');
      expect(mockApi.get).toHaveBeenCalledTimes(4);
    });

    it('✅ error clears when a valid range is applied', async () => {
      mockUseAuth.mockReturnValue({ user: ADMIN_USER });
      mockDataResponses();
      mockDataResponses();

      renderDashboard();
      await waitFor(() => screen.getByText('UX Observability'));

      await userEvent.selectOptions(
        screen.getByRole('combobox', { name: /time window/i }),
        'custom'
      );

      // Trigger an error first
      const fromInput = screen.getByLabelText(/custom range from/i);
      const toInput   = screen.getByLabelText(/custom range to/i);
      await userEvent.clear(fromInput);
      await userEvent.type(fromInput, '2026-04-02T08:00');
      await userEvent.clear(toInput);
      await userEvent.type(toInput, '2026-04-01T08:00');
      await userEvent.click(screen.getByRole('button', { name: /apply/i }));
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Fix the range and apply again
      await userEvent.clear(fromInput);
      await userEvent.type(fromInput, '2026-04-01T08:00');
      await userEvent.clear(toInput);
      await userEvent.type(toInput, '2026-04-03T08:00');
      await userEvent.click(screen.getByRole('button', { name: /apply/i }));

      await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(8));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});