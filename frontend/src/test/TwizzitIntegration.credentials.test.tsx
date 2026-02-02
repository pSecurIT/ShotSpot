import { render, screen, waitFor } from '@testing-library/react';
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
  storeTwizzitCredentials,
} from '../utils/api';

describe('TwizzitIntegration - credentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits credentials using backend field names and shows success', async () => {
    const user = userEvent.setup();

    const created = {
      id: 10,
      organizationName: 'Example Club',
      apiUsername: 'coach@example.com',
      apiEndpoint: 'https://app.twizzit.com',
      createdAt: new Date('2026-01-17T10:00:00.000Z').toISOString(),
    };

    (getTwizzitCredentials as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([created]);

    (storeTwizzitCredentials as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(created);

    render(<TwizzitIntegration />);

    // Open add form
    await user.click(await screen.findByRole('button', { name: 'Add Credential' }));

    await user.type(screen.getByLabelText('Username'), 'coach@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.type(screen.getByLabelText('Organization Name'), 'Example Club');

    await user.click(screen.getByRole('button', { name: 'Add Credential' }));

    await waitFor(() => {
      expect(storeTwizzitCredentials).toHaveBeenCalledWith({
        apiUsername: 'coach@example.com',
        apiPassword: 'secret',
        organizationName: 'Example Club',
      });
    });

    expect(await screen.findByText(/Success:/)).toBeInTheDocument();
    expect(screen.getByText(/Credentials added successfully/i)).toBeInTheDocument();
  });

  it('shows detailed validation errors returned by backend', async () => {
    const user = userEvent.setup();

    (getTwizzitCredentials as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    (storeTwizzitCredentials as unknown as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: {
        status: 400,
        data: {
          error: 'Validation failed',
          details: [{ msg: 'API username is required', param: 'apiUsername' }],
        },
      },
    });

    render(<TwizzitIntegration />);

    await user.click(await screen.findByRole('button', { name: 'Add Credential' }));

    // Fill required fields so submit reaches API and backend-style validation errors can surface.
    await user.type(screen.getByLabelText('Username'), 'coach@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.type(screen.getByLabelText('Organization Name'), 'Example Club');

    await user.click(screen.getByRole('button', { name: 'Add Credential' }));

    const alert = await screen.findByText(/Error:/);
    expect(alert).toBeInTheDocument();
    expect(screen.getByText(/Validation failed/i)).toBeInTheDocument();
    expect(screen.getByText(/apiUsername: API username is required/i)).toBeInTheDocument();
  });

  it('includes apiEndpoint when provided', async () => {
    const user = userEvent.setup();

    const created = {
      id: 11,
      organizationName: 'Example Club',
      apiUsername: 'coach@example.com',
      apiEndpoint: 'https://app.twizzit.com',
      createdAt: new Date('2026-01-17T10:00:00.000Z').toISOString(),
    };

    (getTwizzitCredentials as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([created]);

    (storeTwizzitCredentials as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(created);

    render(<TwizzitIntegration />);

    await user.click(await screen.findByRole('button', { name: 'Add Credential' }));

    await user.type(screen.getByLabelText('Username'), 'coach@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.type(screen.getByLabelText('Organization Name'), 'Example Club');
    await user.type(screen.getByLabelText(/API Endpoint/i), 'https://app.twizzit.com');

    await user.click(screen.getByRole('button', { name: 'Add Credential' }));

    await waitFor(() => {
      expect(storeTwizzitCredentials).toHaveBeenCalledWith({
        apiUsername: 'coach@example.com',
        apiPassword: 'secret',
        organizationName: 'Example Club',
        apiEndpoint: 'https://app.twizzit.com',
      });
    });
  });
});
