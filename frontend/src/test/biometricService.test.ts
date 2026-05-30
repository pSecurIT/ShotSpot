import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckBiometry = vi.fn();
const mockAuthenticate = vi.fn();
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockRemove = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
}));

vi.mock('@aparajita/capacitor-biometric-auth', () => ({
  BiometricAuth: {
    checkBiometry: mockCheckBiometry,
    authenticate: mockAuthenticate,
  },
}));

vi.mock('capacitor-secure-storage-plugin', () => ({
  SecureStoragePlugin: {
    get: mockGet,
    set: mockSet,
    remove: mockRemove,
  },
}));

import { Capacitor } from '@capacitor/core';
import {
  biometricErrorMessage,
  biometricUnlock,
  disableBiometric,
  enrollBiometric,
  hasAppBiometricEnrollment,
  isBiometricAvailable,
} from '../utils/biometricService';

describe('biometricService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports unsupported on web', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    await expect(isBiometricAvailable()).resolves.toEqual({
      available: false,
      errorCode: 'unsupported',
    });
  });

  it('detects native biometric availability', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    mockCheckBiometry.mockResolvedValue({
      isAvailable: true,
      biometryType: 2,
      strongBiometryIsAvailable: true,
      biometryTypes: [2],
      deviceIsSecure: true,
      reason: '',
      code: '',
    });

    await expect(isBiometricAvailable()).resolves.toMatchObject({
      available: true,
      biometryType: 2,
    });
  });

  it('enrolls and unlocks using secure storage', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    mockGet.mockResolvedValueOnce({ value: 'true' });
    mockAuthenticate.mockResolvedValue(undefined);
    mockGet
      .mockResolvedValueOnce({ value: 'token-123' })
      .mockResolvedValueOnce({ value: '{"id":1,"username":"test"}' });

    await expect(hasAppBiometricEnrollment()).resolves.toBe(true);
    await expect(enrollBiometric('token-123', '{"id":1,"username":"test"}')).resolves.toEqual({ success: true });
    await expect(biometricUnlock()).resolves.toEqual({
      success: true,
      token: 'token-123',
      userJson: '{"id":1,"username":"test"}',
    });
  });

  it('maps common biometric errors to user-friendly copy', () => {
    expect(biometricErrorMessage('cancelled')).toContain('cancelled');
    expect(biometricErrorMessage('locked_out')).toContain('Too many failed attempts');
  });

  it('disables biometric enrollment by clearing secure storage', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

    await disableBiometric();

    expect(mockRemove).toHaveBeenCalled();
  });
});
