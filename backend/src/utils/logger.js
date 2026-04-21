import { sanitizeForLog } from './logSanitizer.js';

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
