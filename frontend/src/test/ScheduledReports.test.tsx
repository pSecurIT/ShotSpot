import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ScheduledReports from '../components/ScheduledReports';
import type { ScheduledReport } from '../types/scheduled-reports';

const mockGetAll = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockRunNow = vi.fn();
const mockGetHistory = vi.fn();

vi.mock('../services/scheduledReportsApi', () => ({
  scheduledReportsApi: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
    runNow: (...args: unknown[]) => mockRunNow(...args),
    getHistory: (...args: unknown[]) => mockGetHistory(...args),
  },
}));

const mockApiGet = vi.fn();

vi.mock('../utils/api', () => ({
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

const seededSchedule: ScheduledReport = {
  id: 10,
  name: 'Weekly Team Insights',
  created_by: 1,
  template_id: 2,
  schedule_type: 'weekly',
  is_active: true,
  team_id: 12,
  game_filters: {
    schedule_options: { weeklyDay: 2, monthlyDay: 1, hour: 9, minute: 0 },
  },
  send_email: true,
  email_recipients: ['coach@example.com'],
  email_subject: 'Weekly digest',
  email_body: null,
  last_run_at: null,
  next_run_at: null,
  run_count: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  template_name: 'Default Weekly',
  team_name: 'U19 A',
};

const disabledSchedule: ScheduledReport = {
  ...seededSchedule,
  id: 11,
  name: 'Disabled Schedule',
  is_active: false,
};

const afterMatchSchedule: ScheduledReport = {
  ...seededSchedule,
  id: 12,
  name: 'After Match Schedule',
  schedule_type: 'after_match',
};

describe('ScheduledReports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));

    mockGetAll.mockResolvedValue([seededSchedule]);
    mockCreate.mockResolvedValue({ id: 11 });
    mockUpdate.mockResolvedValue({ id: 10, is_active: false });
    mockRemove.mockResolvedValue({ message: 'ok' });
    mockRunNow.mockResolvedValue({ message: 'ok', execution: { id: 33 } });
    mockGetHistory.mockResolvedValue({
      history: [
        {
          id: 1,
          report_name: 'Weekly Team Insights - run',
          report_type: 'team',
          format: 'json',
          file_path: null,
          file_size_bytes: null,
          access_count: 0,
          created_at: new Date().toISOString(),
          generated_by: 1,
          generated_by_username: 'coach',
          status: 'queued',
        },
      ],
    });

    mockApiGet.mockImplementation((url: string) => {
      if (url.startsWith('/report-templates')) {
        return Promise.resolve({
          data: [
            { id: 2, name: 'Default Weekly', type: 'summary', is_default: true, is_active: true },
          ],
        });
      }

      if (url === '/teams') {
        return Promise.resolve({ data: [{ id: 12, name: 'U19 A' }] });
      }

      return Promise.reject(new Error('Unhandled endpoint'));
    });
  });

  it('renders schedule list with next run fallback', async () => {
    render(<ScheduledReports />);

    expect(await screen.findByText('Weekly Team Insights')).toBeInTheDocument();
    expect(screen.getByText('Pending recalculation')).toBeInTheDocument();
  });

  it('renders disabled and after-match next run fallback states', async () => {
    mockGetAll.mockResolvedValueOnce([disabledSchedule, afterMatchSchedule]);

    render(<ScheduledReports />);

    expect(await screen.findByText('Disabled Schedule')).toBeInTheDocument();
    expect(screen.getAllByText('Disabled')).toHaveLength(2);
    expect(screen.getByText('After Match Schedule')).toBeInTheDocument();
    expect(screen.getByText('After next completed match')).toBeInTheDocument();
  });

  it('creates a new schedule from dialog', async () => {
    const user = userEvent.setup();
    render(<ScheduledReports />);

    await screen.findByText('Weekly Team Insights');

    await user.click(screen.getByRole('button', { name: '+ New Schedule' }));

    await user.type(screen.getByLabelText('Name'), 'Monthly Recap');
    await user.selectOptions(screen.getByLabelText('Template'), '2');
    await user.click(screen.getByLabelText('Monthly'));
    await user.clear(screen.getByLabelText('Day of Month'));
    await user.type(screen.getByLabelText('Day of Month'), '5');

    await user.click(screen.getByRole('button', { name: 'Save Schedule' }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    });

    expect(await screen.findByText('Scheduled report created successfully')).toBeInTheDocument();
  });

  it('edits an existing schedule and shows the update success banner', async () => {
    const user = userEvent.setup();
    render(<ScheduledReports />);

    await screen.findByText('Weekly Team Insights');

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Updated Weekly Team Insights');
    await user.click(screen.getByRole('button', { name: 'Save Schedule' }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          name: 'Updated Weekly Team Insights',
        }),
      );
    });

    expect(await screen.findByText('Scheduled report updated successfully')).toBeInTheDocument();
  });

  it('runs schedule now and opens history', async () => {
    const user = userEvent.setup();
    render(<ScheduledReports />);

    await screen.findByText('Weekly Team Insights');

    await user.click(screen.getByRole('button', { name: 'Run Now' }));

    await waitFor(() => {
      expect(mockRunNow).toHaveBeenCalledWith(10);
    });

    await waitFor(() => {
      expect(mockGetHistory).toHaveBeenCalledWith(10, 20);
    });

    expect(await screen.findByText('Weekly Team Insights - run')).toBeInTheDocument();
  });

  it('shows empty state when no schedules exist', async () => {
    mockGetAll.mockResolvedValueOnce([]);

    render(<ScheduledReports />);

    expect(await screen.findByText('No schedules configured yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create First Schedule' })).toBeInTheDocument();
  });

  it('shows error banner when loading schedules fails', async () => {
    mockGetAll.mockRejectedValueOnce(new Error('Failed to load data'));

    render(<ScheduledReports />);

    expect(await screen.findByText('Failed to load data')).toBeInTheDocument();
  });

  it('toggles schedule active state', async () => {
    const user = userEvent.setup();
    render(<ScheduledReports />);

    await screen.findByText('Weekly Team Insights');

    await user.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(10, { is_active: false });
    });

    expect(await screen.findByText('Schedule disabled successfully')).toBeInTheDocument();
  });

  it('does not delete schedule when confirmation is cancelled', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('confirm', vi.fn(() => false));

    render(<ScheduledReports />);

    await screen.findByText('Weekly Team Insights');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('deletes schedule when confirmation is accepted', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<ScheduledReports />);

    await screen.findByText('Weekly Team Insights');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalledWith(10);
    });

    expect(await screen.findByText('Scheduled report deleted successfully')).toBeInTheDocument();
  });

  it('shows error banner when manual run fails', async () => {
    const user = userEvent.setup();
    mockRunNow.mockRejectedValueOnce(new Error('Manual run failed'));

    render(<ScheduledReports />);

    await screen.findByText('Weekly Team Insights');
    await user.click(screen.getByRole('button', { name: 'Run Now' }));

    expect(await screen.findByText('Manual run failed')).toBeInTheDocument();
  });
});
