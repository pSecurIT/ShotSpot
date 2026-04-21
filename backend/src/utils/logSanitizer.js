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

const sanitizeLogString = (value) => {
  const source = String(value);
  let normalized = '';

  for (let index = 0; index < source.length; index += 1) {
    const charCode = source.charCodeAt(index);
    normalized += shouldNormalizeLogChar(charCode) ? ' ' : source[index];
  }

  return normalized;
};

export const sanitizeForLog = (value, depth = 0) => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeLogString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: sanitizeLogString(value.name),
      message: sanitizeLogString(value.message),
      stack: value.stack ? sanitizeLogString(value.stack) : undefined
    };
  }

  if (Array.isArray(value)) {
    if (depth >= 2) {
      return `[Array(${value.length})]`;
    }

    return value.map((item) => sanitizeForLog(item, depth + 1));
  }

  if (typeof value === 'object') {
    if (depth >= 2) {
      return '[Object]';
    }

    return Object.entries(value).reduce((acc, [key, innerValue]) => {
      acc[sanitizeLogString(key)] = sanitizeForLog(innerValue, depth + 1);
      return acc;
    }, {});
  }

  return sanitizeLogString(value);
};
