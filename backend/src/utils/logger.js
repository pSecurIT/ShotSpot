const MAX_DEPTH = 4;

const normalizeLogString = (value) => String(value)
  // Neutralize line-breaking/control characters used for log forging.
  .replace(/[\u0000\t\n\v\f\r\u2028\u2029]+/g, ' ')
  .replace(/\s{2,}/g, ' ')
  .trim();

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
