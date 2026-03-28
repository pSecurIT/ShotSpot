import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../utils/api';
import { settingsApi } from '../services/settingsApi';

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

describe('settingsApi', () => {
  const getMock = api.get as unknown as ReturnType<typeof vi.fn>;
  const putMock = api.put as unknown as ReturnType<typeof vi.fn>;
  const postMock = api.post as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('🔍 getExportSettings calls GET /export-settings', async () => {
    const data = { id: 1, default_format: 'pdf' };
    getMock.mockResolvedValueOnce({ data });

    const result = await settingsApi.getExportSettings();

    expect(getMock).toHaveBeenCalledWith('/export-settings');
    expect(result).toEqual(data);
  });

  it('💾 updateExportSettings calls PUT /export-settings with payload', async () => {
    const payload = { default_format: 'csv' as const, anonymize_opponents: true };
    const data = { id: 1, ...payload };
    putMock.mockResolvedValueOnce({ data });

    const result = await settingsApi.updateExportSettings(payload);

    expect(putMock).toHaveBeenCalledWith('/export-settings', payload);
    expect(result).toEqual(data);
  });

  it('🔄 resetExportSettings calls POST /export-settings/reset', async () => {
    const data = { id: 1, default_format: 'pdf', anonymize_opponents: false };
    postMock.mockResolvedValueOnce({ data });

    const result = await settingsApi.resetExportSettings();

    expect(postMock).toHaveBeenCalledWith('/export-settings/reset', {});
    expect(result).toEqual(data);
  });
});
