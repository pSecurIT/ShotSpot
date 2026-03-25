import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../utils/api';
import { scheduledReportsApi } from '../services/scheduledReportsApi';

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('scheduledReportsApi', () => {
  const getMock = api.get as unknown as ReturnType<typeof vi.fn>;
  const postMock = api.post as unknown as ReturnType<typeof vi.fn>;
  const putMock = api.put as unknown as ReturnType<typeof vi.fn>;
  const deleteMock = api.delete as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads all schedules', async () => {
    getMock.mockResolvedValueOnce({ data: [] });

    await scheduledReportsApi.getAll();

    expect(getMock).toHaveBeenCalledWith('/scheduled-reports');
  });

  it('creates a schedule', async () => {
    postMock.mockResolvedValueOnce({ data: { id: 1 } });

    await scheduledReportsApi.create({
      name: 'Weekly schedule',
      template_id: 2,
      schedule_type: 'weekly',
    });

    expect(postMock).toHaveBeenCalledWith('/scheduled-reports', {
      name: 'Weekly schedule',
      template_id: 2,
      schedule_type: 'weekly',
    });
  });

  it('updates a schedule', async () => {
    putMock.mockResolvedValueOnce({ data: { id: 10, is_active: false } });

    await scheduledReportsApi.update(10, { is_active: false });

    expect(putMock).toHaveBeenCalledWith('/scheduled-reports/10', { is_active: false });
  });

  it('deletes a schedule', async () => {
    deleteMock.mockResolvedValueOnce({ data: { message: 'deleted' } });

    await scheduledReportsApi.remove(9);

    expect(deleteMock).toHaveBeenCalledWith('/scheduled-reports/9');
  });

  it('runs a schedule manually', async () => {
    postMock.mockResolvedValueOnce({ data: { message: 'ok' } });

    await scheduledReportsApi.runNow(5);

    expect(postMock).toHaveBeenCalledWith('/scheduled-reports/5/run');
  });

  it('loads schedule history with limit', async () => {
    getMock.mockResolvedValueOnce({ data: { history: [] } });

    await scheduledReportsApi.getHistory(4, 25);

    expect(getMock).toHaveBeenCalledWith('/scheduled-reports/4/history', {
      params: { limit: 25 },
    });
  });

  it('uses the default history limit when none is provided', async () => {
    getMock.mockResolvedValueOnce({ data: { history: [] } });

    await scheduledReportsApi.getHistory(4);

    expect(getMock).toHaveBeenCalledWith('/scheduled-reports/4/history', {
      params: { limit: 20 },
    });
  });

  it('maps axios server errors to readable messages', async () => {
    getMock.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { error: 'Server says no' } },
      message: 'Request failed',
    });

    await expect(scheduledReportsApi.getAll()).rejects.toThrow('Server says no');
  });

  it('falls back to axios message when server payload has no error message', async () => {
    deleteMock.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: {} },
      message: 'Network exploded',
    });

    await expect(scheduledReportsApi.remove(4)).rejects.toThrow('Network exploded');
  });

  it('falls back to default error message for unknown failures', async () => {
    postMock.mockRejectedValueOnce('unknown');

    await expect(
      scheduledReportsApi.runNow(12),
    ).rejects.toThrow('Failed to run scheduled report');
  });
});
