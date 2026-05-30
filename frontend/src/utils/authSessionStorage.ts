import { Capacitor } from '@capacitor/core';

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
const isNative = () => Capacitor.isNativePlatform();

const AUTH_TOKEN_KEY = 'token';
const AUTH_USER_KEY = 'user';

type SecureStoragePluginType = {
  get: (options: { key: string }) => Promise<{ value: string }>;
  set: (options: { key: string; value: string }) => Promise<{ value: boolean }>;
  remove: (options: { key: string }) => Promise<{ value: boolean }>;
};

export interface StoredAuthSession {
  token: string | null;
  userJson: string | null;
}

const getSecureStorage = async (): Promise<SecureStoragePluginType | null> => {
  if (!isNative()) {
    return null;
  }

  try {
    const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
    return SecureStoragePlugin as SecureStoragePluginType;
  } catch {
    return null;
  }
};

const readStorage = (key: string): string | null => {
  if (!isBrowser) {
    return null;
  }

  return window.localStorage.getItem(key);
};

const writeStorage = (key: string, value: string): void => {
  if (!isBrowser) {
    return;
  }

  window.localStorage.setItem(key, value);
};

const removeStorage = (key: string): void => {
  if (!isBrowser) {
    return;
  }

  window.localStorage.removeItem(key);
};

const readNativeStorage = async (key: string): Promise<string | null> => {
  const storage = await getSecureStorage();
  if (!storage) {
    return null;
  }

  try {
    const result = await storage.get({ key });
    return result.value || null;
  } catch {
    return null;
  }
};

const writeNativeStorage = async (key: string, value: string): Promise<void> => {
  const storage = await getSecureStorage();
  if (!storage) {
    return;
  }

  try {
    await storage.set({ key, value });
  } catch {
    // Best effort only; password auth still works as fallback.
  }
};

const removeNativeStorage = async (key: string): Promise<void> => {
  const storage = await getSecureStorage();
  if (!storage) {
    return;
  }

  try {
    await storage.remove({ key });
  } catch {
    // Best effort only.
  }
};

const hydrateNativeValue = async (key: string): Promise<string | null> => {
  const value = await readNativeStorage(key);
  if (value !== null && isBrowser) {
    window.localStorage.setItem(key, value);
  }
  return value;
};

export const getStoredAuthToken = (): string | null => {
  if (isNative()) {
    void readNativeStorage(AUTH_TOKEN_KEY).then(value => {
      if (value !== null) {
        window.localStorage?.setItem(AUTH_TOKEN_KEY, value);
      }
    });
  }

  return readStorage(AUTH_TOKEN_KEY);
};

export const setStoredAuthToken = (token: string): void => {
  writeStorage(AUTH_TOKEN_KEY, token);
  void writeNativeStorage(AUTH_TOKEN_KEY, token);
};

export const clearStoredAuthToken = (): void => {
  removeStorage(AUTH_TOKEN_KEY);
  void removeNativeStorage(AUTH_TOKEN_KEY);
};

export const getStoredAuthUser = (): string | null => {
  if (isNative()) {
    void readNativeStorage(AUTH_USER_KEY).then(value => {
      if (value !== null) {
        window.localStorage?.setItem(AUTH_USER_KEY, value);
      }
    });
  }

  return readStorage(AUTH_USER_KEY);
};

export const getStoredAuthSession = async (): Promise<StoredAuthSession> => {
  if (!isNative()) {
    return {
      token: readStorage(AUTH_TOKEN_KEY),
      userJson: readStorage(AUTH_USER_KEY),
    };
  }

  const [token, userJson] = await Promise.all([
    hydrateNativeValue(AUTH_TOKEN_KEY),
    hydrateNativeValue(AUTH_USER_KEY),
  ]);

  return { token, userJson };
};

export const setStoredAuthUser = (userJson: string): void => {
  writeStorage(AUTH_USER_KEY, userJson);
  void writeNativeStorage(AUTH_USER_KEY, userJson);
};

export const clearStoredAuthUser = (): void => {
  removeStorage(AUTH_USER_KEY);
  void removeNativeStorage(AUTH_USER_KEY);
};

export const clearStoredAuthSession = (): void => {
  clearStoredAuthToken();
  clearStoredAuthUser();
};
