import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ExecutionHistory from '../components/ExecutionHistory';

const mockGetHistory = vi.fn();

vi.mock('../services/scheduledReportsApi', () => ({
  scheduledReportsApi: {
    getHistory: (...args: unknown[]) => mockGetHistory(...args),
  },
}));

describe('ExecutionHistory', () => {
  it('shows a loading state before history resolves', async () => {
    let resolveHistory: ((value: { history: never[] }) => void) | undefined;
    mockGetHistory.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveHistory = resolve;
        }),
    );

    render(<ExecutionHistory scheduleId={10} />);

    expect(screen.getByText('Loading history...')).toBeInTheDocument();
    expect(mockGetHistory).toHaveBeenCalledWith(10, 20);

    resolveHistory?.({ history: [] });

    expect(await screen.findByText('No executions yet.')).toBeInTheDocument();
  });

  it('renders execution rows when history exists', async () => {
    mockGetHistory.mockResolvedValueOnce({
      history: [
        {
          id: 1,
          report_name: 'Weekly Team Insights - run',
          report_type: 'team',
          format: 'json',
          file_path: null,
          file_size_bytes: null,
          access_count: 0,
          created_at: '2026-03-25T09:00:00.000Z',
          generated_by: 1,
          generated_by_username: 'coach',
          status: 'queued',
        },
      ],
    });

    render(<ExecutionHistory scheduleId={11} />);

    expect(await screen.findByText('Weekly Team Insights - run')).toBeInTheDocument();
    expect(screen.getByText('queued')).toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
  });

  it('shows an API error when loading history fails', async () => {
    mockGetHistory.mockRejectedValueOnce(new Error('History failed'));

    render(<ExecutionHistory scheduleId={12} />);

    expect(await screen.findByText('History failed')).toBeInTheDocument();
  });

  it('shows the fallback error for non-error failures', async () => {
    mockGetHistory.mockRejectedValueOnce('unknown');

    render(<ExecutionHistory scheduleId={13} />);

    expect(await screen.findByText('Failed to load execution history')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Loading history...')).not.toBeInTheDocument();
    });
  });
});