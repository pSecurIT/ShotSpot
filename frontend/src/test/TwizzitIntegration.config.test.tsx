import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import TwizzitIntegration from '../components/TwizzitIntegration';

vi.mock('../utils/api', () => ({
  getTwizzitCredentials: vi.fn(),
  storeTwizzitCredentials: vi.fn(),
  deleteTwizzitCredentials: vi.fn(),
  verifyTwizzitConnection: vi.fn(),
  syncTwizzitTeams: vi.fn(),
  syncTwizzitPlayers: vi.fn(),
  getTwizzitSyncConfig: vi.fn(),
  updateTwizzitSyncConfig: vi.fn(),
  getTwizzitSyncHistory: vi.fn(),
  getTwizzitTeamMappings: vi.fn(),
  getTwizzitPlayerMappings: vi.fn(),
}));

import {
  getTwizzitCredentials,
  getTwizzitSyncConfig,
  updateTwizzitSyncConfig,
} from '../utils/api';

describe('TwizzitIntegration - configuration interval units', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves sync config using hours', async () => {
    const user = userEvent.setup();
    const credential = {
      id: 3,
      organizationName: 'KCOV',
      apiUsername: 'svc_ShotSpot',
      apiEndpoint: 'https://app.twizzit.com',
      createdAt: new Date('2026-02-01T10:00:00.000Z').toISOString(),
    };

    (getTwizzitCredentials as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([credential]);
    (getTwizzitSyncConfig as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      credentialId: 3,
      autoSyncEnabled: true,
      syncIntervalHours: 12,
      syncIntervalDays: 1,
      syncIntervalUnit: 'hours',
      lastSyncAt: null,
      createdAt: new Date('2026-02-01T10:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-02-01T10:00:00.000Z').toISOString(),
    });
    (updateTwizzitSyncConfig as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      credentialId: 3,
      autoSyncEnabled: true,
      syncIntervalHours: 18,
      syncIntervalDays: 1,
      syncIntervalUnit: 'hours',
      lastSyncAt: null,
      createdAt: new Date('2026-02-01T10:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-02-01T10:00:00.000Z').toISOString(),
    });

    render(<TwizzitIntegration />);

    await user.click(await screen.findByRole('button', { name: 'Configuration' }));
    await screen.findByText('Auto-Sync Configuration');

    const configSection = document.querySelector('.config-form') as HTMLElement;
    const intervalInput = within(configSection).getByLabelText('Sync Interval') as HTMLInputElement;
    fireEvent.change(intervalInput, { target: { value: '18' } });
    await user.click(within(configSection).getByRole('button', { name: 'Save Configuration' }));

    await waitFor(() => {
      expect(updateTwizzitSyncConfig).toHaveBeenCalledWith(3, {
        autoSyncEnabled: true,
        syncIntervalHours: 18,
      });
    });
  });

  it('saves sync config using days', async () => {
    const user = userEvent.setup();
    const credential = {
      id: 7,
      organizationName: 'KCOV',
      apiUsername: 'svc_ShotSpot',
      apiEndpoint: 'https://app.twizzit.com',
      createdAt: new Date('2026-02-01T10:00:00.000Z').toISOString(),
    };

    (getTwizzitCredentials as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([credential]);
    (getTwizzitSyncConfig as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 2,
      credentialId: 7,
      autoSyncEnabled: true,
      syncIntervalHours: 24,
      syncIntervalDays: 1,
      syncIntervalUnit: 'hours',
      lastSyncAt: null,
      createdAt: new Date('2026-02-01T10:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-02-01T10:00:00.000Z').toISOString(),
    });
    (updateTwizzitSyncConfig as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 2,
      credentialId: 7,
      autoSyncEnabled: true,
      syncIntervalHours: 72,
      syncIntervalDays: 3,
      syncIntervalUnit: 'days',
      lastSyncAt: null,
      createdAt: new Date('2026-02-01T10:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-02-01T10:00:00.000Z').toISOString(),
    });

    render(<TwizzitIntegration />);

    await user.click(await screen.findByRole('button', { name: 'Configuration' }));
    await screen.findByText('Auto-Sync Configuration');

    const configSection = document.querySelector('.config-form') as HTMLElement;
    await user.selectOptions(within(configSection).getByLabelText('Interval Unit'), 'days');

    const intervalInput = within(configSection).getByLabelText('Sync Interval') as HTMLInputElement;
    fireEvent.change(intervalInput, { target: { value: '3' } });

    await user.click(within(configSection).getByRole('button', { name: 'Save Configuration' }));

    await waitFor(() => {
      expect(updateTwizzitSyncConfig).toHaveBeenCalledWith(7, {
        autoSyncEnabled: true,
        syncIntervalDays: 3,
      });
    });
  });
});
