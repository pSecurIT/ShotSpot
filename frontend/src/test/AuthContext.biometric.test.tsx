import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

const mockGetStoredAuthSession = vi.fn();
const mockGetStoredAuthToken = vi.fn();
const mockGetStoredAuthUser = vi.fn();
const mockSetStoredAuthToken = vi.fn();
const mockSetStoredAuthUser = vi.fn();
const mockClearStoredAuthSession = vi.fn();

const mockIsBiometricAvailable = vi.fn();
const mockHasAppBiometricEnrollment = vi.fn();
const mockEnrollBiometric = vi.fn();
const mockBiometricUnlock = vi.fn();
const mockDisableBiometricService = vi.fn();
const mockBiometricErrorMessage = vi.fn();

vi.mock('../utils/authSessionStorage', () => ({
  getStoredAuthSession: () => mockGetStoredAuthSession(),
  getStoredAuthToken: () => mockGetStoredAuthToken(),
  getStoredAuthUser: () => mockGetStoredAuthUser(),
  setStoredAuthToken: (...args: unknown[]) => mockSetStoredAuthToken(...args),
  setStoredAuthUser: (...args: unknown[]) => mockSetStoredAuthUser(...args),
  clearStoredAuthSession: () => mockClearStoredAuthSession(),
}));

vi.mock('../utils/biometricService', () => ({
  isBiometricAvailable: () => mockIsBiometricAvailable(),
  hasAppBiometricEnrollment: () => mockHasAppBiometricEnrollment(),
  enrollBiometric: (...args: unknown[]) => mockEnrollBiometric(...args),
  biometricUnlock: () => mockBiometricUnlock(),
  disableBiometric: () => mockDisableBiometricService(),
  biometricErrorMessage: (...args: unknown[]) => mockBiometricErrorMessage(...args),
}));

vi.mock('../utils/serviceWorker', () => ({
  registerServiceWorker: vi.fn(),
}));

vi.mock('../utils/api', () => ({
  default: {
    post: vi.fn(),
  },
  getCsrfToken: vi.fn(),
  resetCsrfToken: vi.fn(),
}));

function Probe() {
  const auth = useAuth();

  return (
    <div>
      <div data-testid="username">{auth.user?.username ?? 'none'}</div>
      <div data-testid="enrolled">{String(auth.biometricEnrolled)}</div>
      <div data-testid="result">-</div>

      <button
        data-testid="can-use"
        onClick={async () => {
          const result = await auth.canUseBiometric();
          const node = document.querySelector('[data-testid="result"]');
          if (node) {
            node.textContent = JSON.stringify(result);
          }
        }}
      >
        can-use
      </button>

      <button
        data-testid="enroll"
        onClick={async () => {
          const result = await auth.enrollBiometricAfterLogin();
          const node = document.querySelector('[data-testid="result"]');
          if (node) {
            node.textContent = JSON.stringify(result);
          }
        }}
      >
        enroll
      </button>

      <button
        data-testid="bio-login"
        onClick={async () => {
          const result = await auth.biometricLogin();
          const node = document.querySelector('[data-testid="result"]');
          if (node) {
            node.textContent = JSON.stringify(result);
          }
        }}
      >
        bio-login
      </button>

      <button
        data-testid="disable"
        onClick={async () => {
          await auth.disableBiometric();
        }}
      >
        disable
      </button>

      <button data-testid="logout" onClick={auth.logout}>logout</button>
    </div>
  );
}

describe('AuthContext biometric flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockGetStoredAuthSession.mockResolvedValue({ token: null, userJson: null });
    mockGetStoredAuthToken.mockReturnValue(null);
    mockGetStoredAuthUser.mockReturnValue(null);
    mockIsBiometricAvailable.mockResolvedValue({ available: false });
    mockHasAppBiometricEnrollment.mockResolvedValue(false);
    mockEnrollBiometric.mockResolvedValue({ success: true });
    mockBiometricUnlock.mockResolvedValue({ success: false, errorCode: 'failed' });
    mockDisableBiometricService.mockResolvedValue(undefined);
    mockBiometricErrorMessage.mockReturnValue('Biometric failed');
  });

  it('hydrates user and biometric enrollment from bootstrap session', async () => {
    mockGetStoredAuthSession.mockResolvedValue({
      token: 'session-token',
      userJson: JSON.stringify({ id: 5, username: 'coach', email: 'coach@test.com', role: 'coach' }),
    });
    mockHasAppBiometricEnrollment.mockResolvedValue(true);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('username')).toHaveTextContent('coach');
      expect(screen.getByTestId('enrolled')).toHaveTextContent('true');
    });
  });

  it('maps canUseBiometric biometryType to string', async () => {
    mockIsBiometricAvailable.mockResolvedValue({ available: true, biometryType: 2 });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await screen.findByTestId('can-use');

    await act(async () => {
      screen.getByTestId('can-use').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('result').textContent).toContain('"available":true');
      expect(screen.getByTestId('result').textContent).toContain('"biometryType":"2"');
    });
  });

  it('returns no-active-session error when enrolling without token/user', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await screen.findByTestId('enroll');

    await act(async () => {
      screen.getByTestId('enroll').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('result').textContent).toContain('No active session to enrol.');
    });
    expect(mockEnrollBiometric).not.toHaveBeenCalled();
  });

  it('enrolls biometric and updates enrolled state', async () => {
    mockGetStoredAuthToken.mockReturnValue('token-1');
    mockGetStoredAuthUser.mockReturnValue('{"id":1,"username":"coach"}');
    mockEnrollBiometric.mockResolvedValue({ success: true });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await screen.findByTestId('enroll');

    await act(async () => {
      screen.getByTestId('enroll').click();
    });

    await waitFor(() => {
      expect(mockEnrollBiometric).toHaveBeenCalledWith('token-1', '{"id":1,"username":"coach"}');
      expect(screen.getByTestId('result').textContent).toContain('"success":true');
      expect(screen.getByTestId('enrolled')).toHaveTextContent('true');
    });
  });

  it('uses biometricErrorMessage when enrollment fails', async () => {
    mockGetStoredAuthToken.mockReturnValue('token-1');
    mockGetStoredAuthUser.mockReturnValue('{"id":1,"username":"coach"}');
    mockEnrollBiometric.mockResolvedValue({ success: false, errorCode: 'permission_denied' });
    mockBiometricErrorMessage.mockReturnValue('Permission denied');

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await screen.findByTestId('enroll');

    await act(async () => {
      screen.getByTestId('enroll').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('result').textContent).toContain('Permission denied');
    });
  });

  it('biometricLogin stores unlocked session and sets user', async () => {
    mockBiometricUnlock.mockResolvedValue({
      success: true,
      token: 'bio-token',
      userJson: JSON.stringify({ id: 9, username: 'bioUser', email: 'bio@test.com', role: 'coach' }),
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await screen.findByTestId('bio-login');

    await act(async () => {
      screen.getByTestId('bio-login').click();
    });

    await waitFor(() => {
      expect(mockSetStoredAuthToken).toHaveBeenCalledWith('bio-token');
      expect(mockSetStoredAuthUser).toHaveBeenCalled();
      expect(screen.getByTestId('username')).toHaveTextContent('bioUser');
      expect(screen.getByTestId('enrolled')).toHaveTextContent('true');
      expect(screen.getByTestId('result').textContent).toContain('"success":true');
    });
  });

  it('returns corrupted-session error when biometric user payload is invalid', async () => {
    mockBiometricUnlock.mockResolvedValue({
      success: true,
      token: 'bio-token',
      userJson: '{bad-json',
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await screen.findByTestId('bio-login');

    await act(async () => {
      screen.getByTestId('bio-login').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('result').textContent).toContain('Session data corrupted.');
    });
  });

  it('disableBiometric and logout clear biometric enrollment state', async () => {
    mockHasAppBiometricEnrollment.mockResolvedValue(true);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await screen.findByTestId('disable');

    await waitFor(() => {
      expect(screen.getByTestId('enrolled')).toHaveTextContent('true');
    });

    await act(async () => {
      screen.getByTestId('disable').click();
    });

    await waitFor(() => {
      expect(mockDisableBiometricService).toHaveBeenCalled();
      expect(screen.getByTestId('enrolled')).toHaveTextContent('false');
    });

    await act(async () => {
      screen.getByTestId('logout').click();
    });

    expect(mockClearStoredAuthSession).toHaveBeenCalled();
    expect(screen.getByTestId('username')).toHaveTextContent('none');
    expect(screen.getByTestId('enrolled')).toHaveTextContent('false');
  });
});
