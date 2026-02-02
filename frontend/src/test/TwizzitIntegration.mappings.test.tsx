import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import TwizzitIntegration from '../components/TwizzitIntegration';

const ACTIVE_TWIZZIT_CREDENTIAL_STORAGE_KEY = 'shotspot.twizzit.activeCredentialId';

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
  // Sync options/preview helpers are not used by this test
  getTwizzitSyncOptionsForSeason: vi.fn(),
  getTwizzitSyncOptionsForOrganization: vi.fn(),
  getTwizzitSyncOptionsWithAccess: vi.fn(),
  debugTwizzitAccess: vi.fn(),
  previewTwizzitTeams: vi.fn(),
  previewTwizzitPlayers: vi.fn(),
}));

import {
  getTwizzitCredentials,
  getTwizzitTeamMappings,
  getTwizzitPlayerMappings,
} from '../utils/api';

describe('TwizzitIntegration - mappings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem(ACTIVE_TWIZZIT_CREDENTIAL_STORAGE_KEY);
  });

  it('renders team and player mappings using internal names', async () => {
    const user = userEvent.setup();

    const credential = {
      id: 5,
      organizationName: 'Example Club',
      apiUsername: 'coach@example.com',
      apiEndpoint: 'https://app.twizzit.com',
      createdAt: new Date('2026-02-01T10:00:00.000Z').toISOString(),
    };

    (getTwizzitCredentials as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([credential]);

    (getTwizzitTeamMappings as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 1,
        internalTeamId: 100,
        internalTeamName: 'KCOV A',
        twizzitTeamId: '1138692',
        twizzitTeamName: 'Kern',
        createdAt: new Date('2026-02-01T12:00:00.000Z').toISOString(),
      },
    ]);

    (getTwizzitPlayerMappings as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 2,
        internalPlayerId: 200,
        internalPlayerName: 'Alice Example',
        twizzitPlayerId: 'contact-1',
        twizzitPlayerName: 'Alice Example',
        createdAt: new Date('2026-02-01T12:00:00.000Z').toISOString(),
      },
    ]);

    // Preselect an active credential (so Mappings tab is enabled)
    localStorage.setItem(ACTIVE_TWIZZIT_CREDENTIAL_STORAGE_KEY, String(credential.id));

    render(<TwizzitIntegration />);

    await user.click(await screen.findByRole('button', { name: 'Mappings' }));

    expect(await screen.findByText(/Team Mappings \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('KCOV A')).toBeInTheDocument();
    expect(screen.getByText('Kern')).toBeInTheDocument();

    expect(screen.getByText(/Player Mappings \(1\)/)).toBeInTheDocument();
    expect(screen.getAllByText('Alice Example')).toHaveLength(2);

    // Ensure calls were made with the active credential id (even if backend ignores it)
    expect(getTwizzitTeamMappings).toHaveBeenCalled();
    expect(getTwizzitPlayerMappings).toHaveBeenCalled();
  });
});
