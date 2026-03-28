import { describe, it, expect, beforeEach, vi } from 'vitest';
import api from '../utils/api';
import { seriesApi } from '../services/seriesApi';

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('seriesApi', () => {
  const getMock = api.get as unknown as ReturnType<typeof vi.fn>;
  const postMock = api.post as unknown as ReturnType<typeof vi.fn>;
  const putMock = api.put as unknown as ReturnType<typeof vi.fn>;
  const deleteMock = api.delete as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists series', async () => {
    getMock.mockResolvedValueOnce({ data: [{ id: 1, name: 'Eerste Klasse', level: 1 }] });

    await seriesApi.list();

    expect(getMock).toHaveBeenCalledWith('/series');
  });

  it('gets series detail', async () => {
    getMock.mockResolvedValueOnce({ data: { id: 1, name: 'Eerste Klasse', level: 1, competitions: [] } });

    await seriesApi.getById(1);

    expect(getMock).toHaveBeenCalledWith('/series/1');
  });

  it('creates series with region', async () => {
    postMock.mockResolvedValueOnce({ data: { id: 1 } });

    await seriesApi.create({ name: 'Eerste Klasse', level: 1, region: 'National' });

    expect(postMock).toHaveBeenCalledWith('/series', {
      name: 'Eerste Klasse',
      level: 1,
      region: 'National',
    });
  });

  it('updates series', async () => {
    putMock.mockResolvedValueOnce({ data: { id: 1 } });

    await seriesApi.update(1, { level: 2 });

    expect(putMock).toHaveBeenCalledWith('/series/1', { level: 2 });
  });

  it('deletes series', async () => {
    deleteMock.mockResolvedValueOnce({ data: { message: 'ok' } });

    await seriesApi.delete(1);

    expect(deleteMock).toHaveBeenCalledWith('/series/1');
  });
});
