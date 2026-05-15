const MAX_DEPTH = 4;

const shouldNormalizeLogChar = (charCode) => (
  charCode === 0
  || charCode === 9
  || charCode === 10
  || charCode === 11
  || charCode === 12
  || charCode === 13
  || charCode === 0x2028
  || charCode === 0x2029
);

const normalizeLogString = (value) => {
  const source = String(value);
  let normalized = '';

  for (let index = 0; index < source.length; index += 1) {
    const charCode = source.charCodeAt(index);
    normalized += shouldNormalizeLogChar(charCode) ? ' ' : source[index];
  }

  return normalized.replace(/\s{2,}/g, ' ').trim();
};

const sanitizeForLog = (value, depth = 0) => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return normalizeLogString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: normalizeLogString(value.name),
      message: normalizeLogString(value.message),
      stack: value.stack ? normalizeLogString(value.stack) : undefined,
    };
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) {
      return `[Array(${value.length})]`;
    }
    return value.map((item) => sanitizeForLog(item, depth + 1));
  }

  if (typeof value === 'object') {
    if (depth >= MAX_DEPTH) {
      return '[Object]';
    }
    return Object.entries(value).reduce((acc, [key, innerValue]) => {
      acc[normalizeLogString(key)] = sanitizeForLog(innerValue, depth + 1);
      return acc;
    }, {});
  }

  return normalizeLogString(value);
};

const sanitizeArgs = (args) => args.map((arg) => sanitizeForLog(arg));

export const logInfo = (...args) => {
  console.log(...sanitizeArgs(args));
};

export const logWarn = (...args) => {
  console.warn(...sanitizeArgs(args));
};

export const logError = (...args) => {
  console.error(...sanitizeArgs(args));
};
