const MATCH_EVENT_CREATE_PATHS = [
  /^\/api\/shots\/\d+$/,
  /^\/api\/events\/\d+$/,
  /^\/api\/substitutions\/\d+$/,
  /^\/api\/possessions\/\d+$/,
  /^\/api\/free-shots$/,
  /^\/api\/timeouts$/,
  /^\/api\/match-commentary\/\d+$/,
  /^\/shots\/\d+$/,
  /^\/events\/\d+$/,
  /^\/substitutions\/\d+$/,
  /^\/possessions\/\d+$/,
  /^\/free-shots$/,
  /^\/timeouts$/,
  /^\/match-commentary\/\d+$/
];

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createFallbackUuid = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const randomValue = Math.floor(Math.random() * 16);
    const nibble = char === 'x' ? randomValue : ((randomValue & 0x3) | 0x8);
    return nibble.toString(16);
  });
};

export const createClientUuid = (): string => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return createFallbackUuid();
};

const normalizePath = (url: string): string => {
  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return url;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const parsePayload = (data: unknown): { payload: Record<string, unknown> | null; wasString: boolean } => {
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as unknown;
      return {
        payload: isRecord(parsed) ? parsed : null,
        wasString: true
      };
    } catch {
      return { payload: null, wasString: true };
    }
  }

  return {
    payload: isRecord(data) ? data : null,
    wasString: false
  };
};

export const isMatchEventCreateRequest = (method?: string, url?: string): boolean => {
  if ((method || '').toUpperCase() !== 'POST' || !url) {
    return false;
  }

  const normalizedPath = normalizePath(url);
  return MATCH_EVENT_CREATE_PATHS.some((pattern) => pattern.test(normalizedPath));
};

export const ensureMatchEventClientUuid = <T,>(method: string | undefined, url: string | undefined, data: T): T => {
  if (!isMatchEventCreateRequest(method, url)) {
    return data;
  }

  const { payload, wasString } = parsePayload(data);
  if (!payload) {
    return data;
  }

  const existingClientUuid = payload.client_uuid;
  if (typeof existingClientUuid === 'string' && uuidPattern.test(existingClientUuid)) {
    return data;
  }

  const nextPayload = {
    ...payload,
    client_uuid: createClientUuid()
  };

  return (wasString ? JSON.stringify(nextPayload) : nextPayload) as T;
};