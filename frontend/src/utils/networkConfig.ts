import { Capacitor } from '@capacitor/core';

const ANDROID_EMULATOR_HOST = '10.0.2.2';
const LOCAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1)$/i;

const isAndroidNative = (): boolean => Capacitor.getPlatform() === 'android';

const rewriteHostForAndroidEmulator = (value: string): string => {
  if (!isAndroidNative()) {
    return value;
  }

  try {
    const parsed = new URL(value);
    if (LOCAL_HOST_PATTERN.test(parsed.hostname)) {
      parsed.hostname = ANDROID_EMULATOR_HOST;
      return parsed.toString();
    }
  } catch {
    // Keep original value when URL parsing fails.
  }

  return value;
};

export const resolveApiBaseUrl = (envApiUrl?: string): string => {
  const configured = (envApiUrl || '').trim();
  const fallback = '/api';

  if (!configured) {
    if (isAndroidNative()) {
      return `http://${ANDROID_EMULATOR_HOST}:3001${fallback}`;
    }
    return fallback;
  }

  if (configured.startsWith('/')) {
    if (isAndroidNative()) {
      return `http://${ANDROID_EMULATOR_HOST}:3001${configured}`;
    }
    return configured;
  }

  return rewriteHostForAndroidEmulator(configured);
};

export const resolveSocketBaseUrl = (envApiUrl?: string): string => {
  const resolvedApiBase = resolveApiBaseUrl(envApiUrl);

  if (resolvedApiBase.startsWith('/')) {
    return resolvedApiBase;
  }

  try {
    const parsed = new URL(resolvedApiBase);
    parsed.pathname = parsed.pathname.replace(/\/api\/?$/, '');
    return parsed.toString();
  } catch {
    return resolvedApiBase;
  }
};