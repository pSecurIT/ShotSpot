import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../utils/api';
import { reportTemplatesApi } from '../services/reportTemplatesApi';

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('reportTemplatesApi', () => {
  const getMock = api.get as unknown as ReturnType<typeof vi.fn>;
  const postMock = api.post as unknown as ReturnType<typeof vi.fn>;
  const putMock = api.put as unknown as ReturnType<typeof vi.fn>;
  const deleteMock = api.delete as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and normalizes templates', async () => {
    getMock.mockResolvedValueOnce({
      data: [
        {
          id: 3,
          name: 'Detailed Weekly',
          type: 'detailed',
          description: 'Loaded from API',
          sections: ['game_info', 'player_stats'],
          metrics: ['goals'],
          is_default: false,
          is_active: true,
        },
      ],
    });

    const templates = await reportTemplatesApi.getAll();

    expect(getMock).toHaveBeenCalledWith('/report-templates');
    expect(templates[0].sections).toHaveLength(2);
    expect(templates[0].sections[0].title).toBe('Game Info');
  });

  it('creates a template', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        id: 10,
        name: 'Coach Report',
        type: 'custom',
        sections: [],
        metrics: [],
        is_default: false,
        is_active: true,
      },
    });

    await reportTemplatesApi.create({
      name: 'Coach Report',
      type: 'custom',
      sections: [],
      metrics: [],
    });

    expect(postMock).toHaveBeenCalledWith('/report-templates', {
      name: 'Coach Report',
      type: 'custom',
      sections: [],
      metrics: [],
    });
  });

  it('updates a template', async () => {
    putMock.mockResolvedValueOnce({
      data: {
        id: 7,
        name: 'Updated Report',
        type: 'custom',
        sections: [],
        metrics: [],
        is_default: false,
        is_active: true,
      },
    });

    await reportTemplatesApi.update(7, { name: 'Updated Report' });

    expect(putMock).toHaveBeenCalledWith('/report-templates/7', { name: 'Updated Report' });
  });

  it('deletes a template', async () => {
    deleteMock.mockResolvedValueOnce({ data: { message: 'ok' } });

    await reportTemplatesApi.remove(12);

    expect(deleteMock).toHaveBeenCalledWith('/report-templates/12');
  });

  it('maps axios errors to readable messages', async () => {
    getMock.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { error: 'Server says no' } },
      message: 'Request failed',
    });

    await expect(reportTemplatesApi.getAll()).rejects.toThrow('Server says no');
  });
});