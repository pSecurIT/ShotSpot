import api from '../utils/api';
import type { ExportSettings, ExportSettingsUpdatePayload } from '../types/settings';

export const settingsApi = {
  getExportSettings: (): Promise<ExportSettings> =>
    api.get<ExportSettings>('/export-settings').then(r => r.data),

  updateExportSettings: (payload: ExportSettingsUpdatePayload): Promise<ExportSettings> =>
    api.put<ExportSettings>('/export-settings', payload).then(r => r.data),

  resetExportSettings: (): Promise<ExportSettings> =>
    api.post<ExportSettings>('/export-settings/reset', {}).then(r => r.data),
};
