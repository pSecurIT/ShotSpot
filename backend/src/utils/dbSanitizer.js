/**
 * Database Query Sanitizer Utility
 * 
 * This module provides utilities to sanitize and truncate database-related
 * strings to prevent sensitive data from being logged or exposed in error messages.
 */

/**
 * Truncates a string to a maximum length, adding ellipsis if truncated
 * @param {string} str - The string to truncate
 * @param {number} maxLength - Maximum length (default: 50)
 * @returns {string} - Truncated string
 */
function truncateString(str, maxLength = 50) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength) + '...';
}

/**
 * Sanitizes SQL query text for logging purposes
 * Removes sensitive data patterns and truncates the query
 * @param {string} queryText - The SQL query text
 * @param {number} maxLength - Maximum length for the sanitized output (default: 100)
 * @returns {string} - Sanitized query text safe for logging
 */
export function sanitizeQueryForLogging(queryText, maxLength = 100) {
  if (!queryText || typeof queryText !== 'string') {
    return '[empty query]';
  }

  // Remove any potential sensitive data patterns
  let sanitized = queryText
    // First, sanitize sensitive fields (before removing string literals)
    // This catches patterns like: password='value', token='value', etc.
    .replace(/password\s*=\s*'[^']*'/gi, '******')
    .replace(/password\s*=\s*"[^"]*"/gi, '******')
    .replace(/password\s*=\s*[^\s,)'"]+/gi, '******')
    .replace(/token\s*=\s*'[^']*'/gi, 'token=***')
    .replace(/token\s*=\s*"[^"]*"/gi, 'token=***')
    .replace(/token\s*=\s*[^\s,)'"]+/gi, 'token=***')
    .replace(/secret\s*=\s*'[^']*'/gi, 'secret=***')
    .replace(/secret\s*=\s*"[^"]*"/gi, 'secret=***')
    .replace(/secret\s*=\s*[^\s,)'"]+/gi, 'secret=***')
    .replace(/api[_-]?key\s*=\s*'[^']*'/gi, 'api_key=***')
    .replace(/api[_-]?key\s*=\s*"[^"]*"/gi, 'api_key=***')
    .replace(/api[_-]?key\s*=\s*[^\s,)'"]+/gi, 'api_key=***')
    // Then remove remaining string literals that might contain other sensitive data
    .replace(/'[^']*'/g, '\'***\'')
    .replace(/"[^"]*"/g, '"***"')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();

  return truncateString(sanitized, maxLength);
}

/**
 * Sanitizes database error messages
 * Removes potentially sensitive information from error messages
 * @param {Error} error - The error object
 * @returns {Object} - Sanitized error information safe for logging
 */
export function sanitizeDbError(error) {
  if (!error) {
    return { message: 'Unknown error' };
  }

  const sanitized = {
    message: error.message || 'Unknown error',
    code: error.code,
    severity: error.severity
  };

  // Remove sensitive information from error messages
  if (sanitized.message) {
    sanitized.message = sanitized.message
      .replace(/'[^']*'/g, '\'***\'')
      .replace(/"[^"]*"/g, '"***"')
      .replace(/password[^\s]*/gi, 'password***')
      .replace(/token[^\s]*/gi, 'token***');
  }

  return sanitized;
}

/**
 * Creates a safe query metadata object for logging
 * @param {string} queryText - The SQL query text (optional)
 * @param {number} duration - Query execution duration in ms
 * @param {number} rowCount - Number of rows affected/returned
 * @param {boolean} includeQueryPreview - Whether to include sanitized query preview (default: false)
 * @returns {Object} - Safe metadata object for logging
 */
export function createQueryLogMetadata(queryText, duration, rowCount, includeQueryPreview = false) {
  const metadata = {
    duration,
    rows: rowCount
  };

  // Only include query preview if explicitly requested and in development
  if (includeQueryPreview && process.env.NODE_ENV !== 'production') {
    metadata.queryPreview = sanitizeQueryForLogging(queryText, 80);
  }

  return metadata;
}

/**
 * Validates that a query uses parameterized format (has $ placeholders)
 * This helps ensure queries are using safe parameterized approach
 * @param {string} queryText - The SQL query text
 * @returns {boolean} - True if query appears to use parameters
 */
export function isParameterizedQuery(queryText) {
  if (!queryText || typeof queryText !== 'string') {
    return false;
  }
  // Check for PostgreSQL parameterized query placeholders ($1, $2, etc.)
  return /\$\d+/.test(queryText);
}

/**
 * Sanitizes an entire query object for logging
 * @param {Object} queryInfo - Object containing query information
 * @param {string} queryInfo.text - The query text
 * @param {Array} queryInfo.params - The query parameters
 * @returns {Object} - Sanitized query information
 */
export function sanitizeQueryObject(queryInfo) {
  if (!queryInfo) {
    return { text: '[no query]' };
  }

  return {
    text: sanitizeQueryForLogging(queryInfo.text),
    paramCount: Array.isArray(queryInfo.params) ? queryInfo.params.length : 0,
    isParameterized: isParameterizedQuery(queryInfo.text)
  };
}

export default {
  sanitizeQueryForLogging,
  sanitizeDbError,
  createQueryLogMetadata,
  isParameterizedQuery,
  sanitizeQueryObject,
  truncateString
};
