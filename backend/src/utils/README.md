# Database Sanitizer Utility

This module provides utilities to sanitize database-related strings and prevent sensitive data from being logged or exposed in error messages.

## Purpose

When working with database queries, it's critical to avoid logging sensitive user data. This utility provides a modular, reusable solution for:

1. **Sanitizing SQL queries** before logging
2. **Removing sensitive data patterns** (passwords, tokens, API keys, etc.)
3. **Truncating long strings** to prevent log bloat
4. **Creating safe error messages** that don't expose sensitive information

## Usage

### Basic Import

```javascript
import { 
  sanitizeQueryForLogging, 
  sanitizeDbError,
  createQueryLogMetadata 
} from './utils/dbSanitizer.js';
```

Or import from db.js (which re-exports these utilities):

```javascript
import db, { sanitizeQueryForLogging, sanitizeDbError } from './db.js';
```

### Sanitizing Query Text for Logging

```javascript
const query = "SELECT * FROM users WHERE email = 'user@example.com'";
const safe = sanitizeQueryForLogging(query);
console.log(safe); // Output: "SELECT * FROM users WHERE email = '***'"
```

### Sanitizing Database Errors

```javascript
try {
  await db.query(queryText, params);
} catch (err) {
  const safeError = sanitizeDbError(err);
  console.error('Query failed:', safeError);
  // Only logs: { message: '...', code: 'XXXXX', severity: 'ERROR' }
}
```

### Creating Safe Query Metadata

```javascript
const metadata = createQueryLogMetadata(
  queryText,      // The SQL query
  duration,       // Execution time in ms
  rowCount,       // Number of rows affected
  false          // includeQueryPreview (false by default)
);
console.log(metadata); // { duration: 150, rows: 10 }
```

### Checking for Parameterized Queries

```javascript
import { isParameterizedQuery } from './utils/dbSanitizer.js';

const safe = isParameterizedQuery('SELECT * FROM users WHERE id = $1'); // true
const unsafe = isParameterizedQuery('SELECT * FROM users WHERE id = ' + userId); // false
```

## Features

### 1. Sensitive Data Pattern Removal

The sanitizer automatically removes common sensitive patterns:

- **String literals**: `'sensitive data'` → `'***'`
- **Password fields**: `password = 'secret'` → `password=***`
- **Token fields**: `token = 'abc123'` → `token=***`
- **API keys**: `api_key = 'key123'` → `api_key=***`
- **Secrets**: `secret = 'xyz'` → `secret=***`

### 2. Truncation

Long queries are automatically truncated with ellipsis:

```javascript
const longQuery = 'SELECT * FROM users WHERE ' + 'condition AND '.repeat(100);
const truncated = sanitizeQueryForLogging(longQuery, 100);
// Returns max 100 chars + '...'
```

### 3. Whitespace Normalization

Multiple spaces, tabs, and newlines are normalized:

```javascript
const query = "SELECT   *\n\nFROM\t\tusers";
const normalized = sanitizeQueryForLogging(query);
// Returns: "SELECT * FROM users"
```

## Security Best Practices

1. **Always use parameterized queries**: Use `$1`, `$2`, etc. instead of string concatenation
2. **Never log raw query text in production**: Use `createQueryLogMetadata` with `includeQueryPreview: false`
3. **Sanitize all error messages**: Use `sanitizeDbError` before logging database errors
4. **Validate query patterns**: Use `isParameterizedQuery` to verify queries use proper parameterization

## API Reference

### `sanitizeQueryForLogging(queryText, maxLength = 100)`
Sanitizes SQL query text for safe logging.

**Parameters:**
- `queryText` (string): The SQL query to sanitize
- `maxLength` (number, optional): Maximum length for output (default: 100)

**Returns:** Sanitized string safe for logging

### `sanitizeDbError(error)`
Sanitizes database error objects.

**Parameters:**
- `error` (Error): The error object to sanitize

**Returns:** Object with safe error information: `{ message, code, severity }`

### `createQueryLogMetadata(queryText, duration, rowCount, includeQueryPreview = false)`
Creates safe metadata object for query logging.

**Parameters:**
- `queryText` (string): The SQL query
- `duration` (number): Execution time in milliseconds
- `rowCount` (number): Number of rows affected/returned
- `includeQueryPreview` (boolean, optional): Whether to include sanitized query preview (default: false)

**Returns:** Metadata object safe for logging

### `isParameterizedQuery(queryText)`
Checks if a query uses parameterized format.

**Parameters:**
- `queryText` (string): The SQL query to check

**Returns:** Boolean indicating if query uses parameters (`$1`, `$2`, etc.)

### `sanitizeQueryObject(queryInfo)`
Sanitizes an entire query object.

**Parameters:**
- `queryInfo` (Object): Object with `text` and `params` properties

**Returns:** Sanitized query information object

### `truncateString(str, maxLength = 50)`
Truncates a string to maximum length.

**Parameters:**
- `str` (string): String to truncate
- `maxLength` (number, optional): Maximum length (default: 50)

**Returns:** Truncated string with ellipsis if needed

## Testing

Comprehensive tests are available in `test/dbSanitizer.test.js`. Run tests with:

```bash
npm test -- dbSanitizer.test.js
```

## Integration Example

Here's how it's integrated into `db.js`:

```javascript
import { sanitizeDbError, createQueryLogMetadata } from './utils/dbSanitizer.js';

const query = async (text, params) => {
  const client = await pool.connect();
  try {
    const start = Date.now();
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    
    // Safe logging without exposing sensitive data
    const logMetadata = createQueryLogMetadata(text, duration, res.rowCount, false);
    console.log('Executed query', logMetadata);
    
    return res;
  } catch (err) {
    // Safe error logging
    const sanitizedError = sanitizeDbError(err);
    console.error('Error executing query', sanitizedError);
    throw err;
  } finally {
    client.release();
  }
};
```

## Contributing

When adding new sensitive data patterns, update the regex patterns in `sanitizeQueryForLogging` and add corresponding tests.
