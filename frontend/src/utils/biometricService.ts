/**
 * biometricService.ts
 *
 * Abstraction layer over Capacitor biometric auth and secure storage plugins.
 * All methods safely return `success: false` (or `false`) on web – never throw.
 * On native (iOS / Android), the actual plugins are loaded via dynamic import
 * so the web bundle is never polluted with native-only code.
 */

import { Capacitor } from '@capacitor/core';
import type { BiometryType } from '@aparajita/capacitor-biometric-auth';

// ─── Error types ─────────────────────────────────────────────────────────────

export type BiometricErrorCode =
  | 'unsupported'          // web or device without biometry hardware
  | 'not_enrolled_device'  // no biometric registered on device
  | 'no_app_enrollment'    // user hasn't enrolled in ShotSpot
  | 'cancelled'            // user dismissed the prompt
  | 'failed'               // biometric not recognised
  | 'locked_out'           // too many failed attempts
  | 'permission_denied'    // OS-level permission not granted
  | 'storage_error'        // secure-storage read/write failed
  | 'unknown';

// ─── Result types ─────────────────────────────────────────────────────────────

export interface BiometricAvailability {
  available: boolean;
  biometryType?: BiometryType;
  errorCode?: BiometricErrorCode;
}

export interface BiometricResult {
  success: boolean;
  errorCode?: BiometricErrorCode;
  /** Only present on a successful `biometricUnlock()` call */
  token?: string;
  /** Only present on a successful `biometricUnlock()` call */
  userJson?: string;
}

type CypressBiometricScenario = 'success' | 'cancel' | 'fail' | 'locked';

interface CypressBiometricMockState {
  available: boolean;
  enrolled: boolean;
  scenario?: CypressBiometricScenario;
  store: Record<string, string>;
}

// ─── Secure-storage key constants ────────────────────────────────────────────

const KEY_TOKEN    = 'bio_token';
const KEY_USER     = 'bio_user';
const KEY_ENROLLED = 'bio_enrolled';

// ─── Platform guard ──────────────────────────────────────────────────────────

const isNative = (): boolean => Capacitor.isNativePlatform();

// ─── Lazy plugin accessors ───────────────────────────────────────────────────

async function getBiometricAuth() {
  const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
  return BiometricAuth;
}

async function getSecureStorage() {
  const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
  return SecureStoragePlugin;
}

const getCypressBiometricMock = (): CypressBiometricMockState | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const win = window as Window & {
    __SHOTSPOT_BIOMETRIC_MOCK?: CypressBiometricMockState;
  };

  if (!win.__SHOTSPOT_BIOMETRIC_MOCK) {
    return null;
  }

  return win.__SHOTSPOT_BIOMETRIC_MOCK;
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns whether the current device supports biometric authentication and
 * the user has at least one biometric credential enrolled on the device.
 */
export async function isBiometricAvailable(): Promise<BiometricAvailability> {
  const cypressMock = getCypressBiometricMock();
  if (cypressMock) {
    return cypressMock.available
      ? { available: true, biometryType: 2 as unknown as BiometryType }
      : { available: false, errorCode: 'unsupported' };
  }

  if (!isNative()) {
    return { available: false, errorCode: 'unsupported' };
  }
  try {
    const BiometricAuth = await getBiometricAuth();
    const info = await BiometricAuth.checkBiometry();
    if (!info.isAvailable) {
      return {
        available: false,
        biometryType: info.biometryType,
        errorCode: mapCheckCode(info.code),
      };
    }
    return { available: true, biometryType: info.biometryType };
  } catch {
    return { available: false, errorCode: 'unknown' };
  }
}

/**
 * Returns whether the user has previously enrolled biometric login in this app
 * (i.e. we have a token stored in secure storage for biometric unlock).
 */
export async function hasAppBiometricEnrollment(): Promise<boolean> {
  const cypressMock = getCypressBiometricMock();
  if (cypressMock) {
    return cypressMock.enrolled;
  }

  if (!isNative()) return false;
  try {
    const storage = await getSecureStorage();
    if (!storage) {
      return false;
    }
    const result = await storage.get({ key: KEY_ENROLLED });
    return result.value === 'true';
  } catch {
    return false;
  }
}

/**
 * Persists `token` and `userJson` in the device secure storage so they can
 * be unlocked biometrically on future app launches.
 */
export async function enrollBiometric(token: string, userJson: string): Promise<BiometricResult> {
  const cypressMock = getCypressBiometricMock();
  if (cypressMock) {
    cypressMock.store[KEY_TOKEN] = token;
    cypressMock.store[KEY_USER] = userJson;
    cypressMock.store[KEY_ENROLLED] = 'true';
    cypressMock.enrolled = true;
    return { success: true };
  }

  if (!isNative()) return { success: false, errorCode: 'unsupported' };
  try {
    const storage = await getSecureStorage();
    if (!storage) {
      return { success: false, errorCode: 'storage_error' };
    }
    await storage.set({ key: KEY_TOKEN,    value: token    });
    await storage.set({ key: KEY_USER,     value: userJson });
    await storage.set({ key: KEY_ENROLLED, value: 'true'   });
    return { success: true };
  } catch {
    return { success: false, errorCode: 'storage_error' };
  }
}

/**
 * Triggers the native biometric prompt. On success, returns the token and
 * userJson that were previously stored via `enrollBiometric()`.
 */
export async function biometricUnlock(
  promptTitle = 'Sign in to ShotSpot',
): Promise<BiometricResult> {
  const cypressMock = getCypressBiometricMock();
  if (cypressMock) {
    if (cypressMock.scenario === 'cancel') {
      return { success: false, errorCode: 'cancelled' };
    }
    if (cypressMock.scenario === 'fail') {
      return { success: false, errorCode: 'failed' };
    }
    if (cypressMock.scenario === 'locked') {
      return { success: false, errorCode: 'locked_out' };
    }

    const token = cypressMock.store[KEY_TOKEN];
    const userJson = cypressMock.store[KEY_USER];
    if (!token || !userJson) {
      return { success: false, errorCode: 'no_app_enrollment' };
    }

    return { success: true, token, userJson };
  }

  if (!isNative()) return { success: false, errorCode: 'unsupported' };

  try {
    const BiometricAuth = await getBiometricAuth();
    await BiometricAuth.authenticate({
      reason:      promptTitle,
      cancelTitle: 'Use password instead',
    });
  } catch (err: unknown) {
    return { success: false, errorCode: mapAuthError(err) };
  }

  // Authentication succeeded – read stored credentials
  try {
    const storage = await getSecureStorage();
    if (!storage) {
      return { success: false, errorCode: 'storage_error' };
    }
    const { value: token }    = await storage.get({ key: KEY_TOKEN });
    const { value: userJson } = await storage.get({ key: KEY_USER  });

    if (!token || !userJson) {
      return { success: false, errorCode: 'no_app_enrollment' };
    }
    return { success: true, token, userJson };
  } catch {
    return { success: false, errorCode: 'storage_error' };
  }
}

/**
 * Removes all biometric-related data from secure storage.
 * Called on explicit user opt-out and on logout.
 */
export async function disableBiometric(): Promise<void> {
  const cypressMock = getCypressBiometricMock();
  if (cypressMock) {
    delete cypressMock.store[KEY_TOKEN];
    delete cypressMock.store[KEY_USER];
    delete cypressMock.store[KEY_ENROLLED];
    cypressMock.enrolled = false;
    return;
  }

  if (!isNative()) return;
  try {
    const storage = await getSecureStorage();
    if (!storage) {
      return;
    }
    await storage.remove({ key: KEY_TOKEN    });
    await storage.remove({ key: KEY_USER     });
    await storage.remove({ key: KEY_ENROLLED });
  } catch {
    // Best-effort cleanup; do not surface errors to callers
  }
}

/**
 * Human-readable message for display in UI error states.
 */
export function biometricErrorMessage(code: BiometricErrorCode | undefined): string {
  switch (code) {
    case 'unsupported':         return 'Biometric authentication is not available on this device.';
    case 'not_enrolled_device': return 'No biometric credential is registered on this device. Please set up Face ID or fingerprint in your device settings.';
    case 'no_app_enrollment':   return 'Biometric login has not been set up for this app. Please log in with your password.';
    case 'cancelled':           return 'Biometric authentication was cancelled.';
    case 'failed':              return 'Biometric authentication failed. Please try again or use your password.';
    case 'locked_out':          return 'Too many failed attempts. Please use your password to log in.';
    case 'permission_denied':   return 'Biometric permission was denied. Please enable it in device settings.';
    case 'storage_error':       return 'Could not access secure storage. Please log in with your password.';
    default:                    return 'Biometric authentication failed. Please log in with your password.';
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function mapCheckCode(code: string): BiometricErrorCode {
  // BiometryErrorType is a string enum; compare values directly
  switch (code) {
    case 'biometryNotEnrolled':  return 'not_enrolled_device';
    case 'biometryNotAvailable': return 'unsupported';
    default:                     return 'unknown';
  }
}

function mapAuthError(err: unknown): BiometricErrorCode {
  if (!err || typeof err !== 'object') return 'unknown';
  const code = (err as Record<string, unknown>)['code'] as string | undefined;
  if (!code) return 'unknown';

  // Map BiometryErrorType string values
  switch (code) {
    case 'userCancel':
    case 'appCancel':
    case 'systemCancel':
      return 'cancelled';
    case 'authenticationFailed':
      return 'failed';
    case 'biometryLockout':
      return 'locked_out';
    case 'biometryNotAvailable':
      return 'unsupported';
    case 'biometryNotEnrolled':
      return 'not_enrolled_device';
    case 'userFallback':
      return 'cancelled'; // User chose "use password" fallback
    default:
      return 'unknown';
  }
}
