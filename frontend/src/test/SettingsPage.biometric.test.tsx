import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from '../components/SettingsPage';

const mockUseAuth = vi.fn();
const mockIsBiometricAvailable = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../hooks/useBreadcrumbs', () => ({
  default: () => [],
}));

vi.mock('../utils/biometricService', () => ({
  isBiometricAvailable: () => mockIsBiometricAvailable(),
}));

vi.mock('../components/ExportSettings', () => ({
  default: () => <div>Export Settings Stub</div>,
}));

vi.mock('../components/UserPreferences', () => ({
  default: () => <div>User Preferences Stub</div>,
}));

vi.mock('../components/NotificationPreferences', () => ({
  default: () => <div>Notification Preferences Stub</div>,
}));

vi.mock('../components/ui/PageLayout', () => ({
  default: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h1>{title}</h1>
      {children}
    </section>
  ),
}));

describe('SettingsPage biometric security tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setup({
    enrolled = false,
    available = true,
    enrollResult = { success: true as const },
  }: {
    enrolled?: boolean;
    available?: boolean;
    enrollResult?: { success: boolean; error?: string };
  } = {}) {
    const enrollBiometricAfterLogin = vi.fn().mockResolvedValue(enrollResult);
    const disableBiometric = vi.fn().mockResolvedValue(undefined);

    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'coach', email: 'coach@test.com', role: 'coach' },
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
      updateUser: vi.fn(),
      biometricEnrolled: enrolled,
      canUseBiometric: vi.fn(),
      enrollBiometricAfterLogin,
      biometricLogin: vi.fn(),
      disableBiometric,
    });

    mockIsBiometricAvailable.mockResolvedValue({ available });

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    return { enrollBiometricAfterLogin, disableBiometric };
  }

  it('shows unsupported-device message in Security tab when biometric is unavailable', async () => {
    const user = userEvent.setup();
    setup({ available: false });

    await user.click(screen.getByRole('button', { name: 'Security' }));

    expect(await screen.findByText(/not available on this device or in the web browser/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /enable biometric login/i })).not.toBeInTheDocument();
  });

  it('enables biometric login from Security tab and shows success status', async () => {
    const user = userEvent.setup();
    const { enrollBiometricAfterLogin } = setup({ available: true, enrolled: false });

    await user.click(screen.getByRole('button', { name: 'Security' }));

    expect(await screen.findByText('⬜ Disabled')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /enable biometric login/i }));

    await waitFor(() => {
      expect(enrollBiometricAfterLogin).toHaveBeenCalledOnce();
    });
    expect(await screen.findByRole('status')).toHaveTextContent(/biometric login enabled/i);
  });

  it('surfaces enrollment error from AuthContext in Security tab', async () => {
    const user = userEvent.setup();
    setup({
      available: true,
      enrolled: false,
      enrollResult: { success: false, error: 'Device permission denied' },
    });

    await user.click(screen.getByRole('button', { name: 'Security' }));
    await user.click(await screen.findByRole('button', { name: /enable biometric login/i }));

    expect(await screen.findByRole('status')).toHaveTextContent('Device permission denied');
  });

  it('disables biometric login from Security tab and shows disabled status', async () => {
    const user = userEvent.setup();
    const { disableBiometric } = setup({ available: true, enrolled: true });

    await user.click(screen.getByRole('button', { name: 'Security' }));
    await user.click(await screen.findByRole('button', { name: /disable biometric login/i }));

    await waitFor(() => {
      expect(disableBiometric).toHaveBeenCalledOnce();
    });
    expect(await screen.findByRole('status')).toHaveTextContent(/biometric login has been disabled/i);
  });
});
