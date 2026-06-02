let deterministicCounter = 0;

const deterministicBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  const nowMs = Date.now() >>> 0;
  const perfUs = (typeof performance !== 'undefined' ? ((performance.now() * 1000) | 0) : 0) >>> 0;
  deterministicCounter = (deterministicCounter + 1) >>> 0;

  // Deterministic fallback for runtimes without Web Crypto.
  let state = (nowMs ^ perfUs ^ deterministicCounter) >>> 0;
  for (let index = 0; index < bytes.length; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    bytes[index] = state & 0xff;
  }

  return bytes;
};

const getRandomBytes = (length: number): Uint8Array => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(length);
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }

  return deterministicBytes(length);
};

const formatUuidV4FromBytes = (bytes: Uint8Array): string => {
  const uuidBytes = bytes.slice(0, 16);
  uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x40;
  uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80;

  const hex = Array.from(uuidBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join('-');
};

export const createSecureUuidV4 = (): string => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return formatUuidV4FromBytes(getRandomBytes(16));
};

export const createSecureHexId = (hexLength: number): string => {
  const bytesNeeded = Math.max(1, Math.ceil(hexLength / 2));
  const hex = Array.from(getRandomBytes(bytesNeeded), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, hexLength);
};
