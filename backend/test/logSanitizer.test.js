import { sanitizeForLog } from '../src/utils/logSanitizer.js';

describe('Log Sanitizer', () => {
  it('normalizes newline and control characters in strings', () => {
    const value = 'line1\nline2\r\tend\u2028break';
    expect(sanitizeForLog(value)).toBe('line1 line2  end break');
  });

  it('returns primitive non-string values unchanged', () => {
    expect(sanitizeForLog(42)).toBe(42);
    expect(sanitizeForLog(true)).toBe(true);
    expect(sanitizeForLog(null)).toBeNull();
    expect(sanitizeForLog(undefined)).toBeUndefined();
  });

  it('sanitizes Error objects safely', () => {
    const error = new Error('bad\nmessage');
    error.name = 'Type\rError';

    const sanitized = sanitizeForLog(error);

    expect(sanitized).toMatchObject({
      name: 'Type Error',
      message: 'bad message'
    });
    expect(sanitized.stack).toBeDefined();
  });

  it('sanitizes nested objects and limits deep recursion', () => {
    const value = {
      'bad\nkey': {
        nested: {
          veryDeep: {
            value: 'hidden'
          }
        }
      },
      arr: ['a\rb', { label: 'c\nd' }]
    };

    const sanitized = sanitizeForLog(value);

    expect(sanitized).toEqual({
      'bad key': {
        nested: '[Object]'
      },
      arr: ['a b', '[Object]']
    });
  });

  it('replaces deep arrays with compact placeholder', () => {
    const value = [[['x', 'y', 'z']]];
    expect(sanitizeForLog(value)).toEqual([['[Array(3)]']]);
  });
});
