# Security Policy

## Reporting Security Issues

If you discover a security vulnerability, please DO NOT create a public issue. Instead:

1. Start a new discussion in the Report security issue section at https://github.com/pSecurIT/ShotSpot/discussions/categories/report-security-issue
2. Include detailed description and steps to reproduce
3. Allow up to 48 hours for initial response
4. Do not disclose publicly until patched

## Security Features

### Authentication

- JWT-based authentication
- Token rotation every 1 hour
- Refresh tokens valid for 7 days
- Rate limiting on auth endpoints
- Password requirements:
  - Minimum 8 characters
  - Mix of uppercase, lowercase, numbers, symbols
  - Bcrypt hashing with salt rounds 12 (OWASP 2024 recommendation)
- Timing attack protection on login (prevents user enumeration)
- Token expiration with clear error messages
- Secure password generation using crypto.randomInt() with Fisher-Yates shuffle

#### Default Admin User

For first-time installations, the system automatically creates a default admin user on startup if no admin accounts exist:

**Security Features:**
- **Auto-generated secure password** (if not provided via environment)
- **Forced password change** on first login - user cannot access other APIs until password is changed
- **One-time credential display** - credentials shown only once during initial creation
- **Idempotent creation** - safe to restart server, won't create duplicates

**Configuration (Environment Variables):**
```env
DEFAULT_ADMIN_USERNAME=admin                    # Default: 'admin'
DEFAULT_ADMIN_EMAIL=admin@shotspot.local       # Default: 'admin@shotspot.local'
DEFAULT_ADMIN_PASSWORD=                        # Leave empty for auto-generation (recommended)
```

**First Login Process:**
1. Start application → Default admin created automatically
2. Check server logs for generated credentials (displayed once)
3. Login with provided credentials
4. System forces password change via `/api/auth/change-password` endpoint
5. After password change, full system access is granted

**Best Practices:**
- ✅ Leave `DEFAULT_ADMIN_PASSWORD` empty for cryptographically secure auto-generation
- ✅ Save initial credentials immediately from server logs
- ✅ Change password on first login (enforced by system)
- ✅ Remove `DEFAULT_ADMIN_PASSWORD` from environment after first login
- ❌ Never commit default admin credentials to version control
- ❌ Never use default credentials in production without changing them

**Docker Usage:**
Set environment variables in `.env` file or docker-compose.yml. The admin will be created when the container first starts with a clean database.

### Authorization

- Role-based access control (RBAC)
- Roles:
  - **Admin**: Full system access including user management
  - **Coach**: Team, player, and game management
  - **User**: Read-only access to assigned content
- Resource-level permissions with middleware enforcement
- Action audit logging with login history tracking

#### User Management Security

**Admin Controls:**
- Create new users with automatic password generation
- Assign and modify user roles with hierarchy enforcement
- Deactivate/delete users with soft delete (preserves data integrity)
- Bulk operations for role changes with validation
- View login history and user activity monitoring
- Export user data to CSV for compliance reporting

**Security Measures:**
- Admins cannot demote or delete themselves
- System prevents deletion of the last admin account
- Forced password change on first login for admin-created users
- Role hierarchy enforcement (admins > coaches > users)
- Login attempt tracking with IP address and user agent
- Failed login attempt logging for security monitoring
- Profile editing with username/email uniqueness validation

**Audit Trail:**
- All user management actions logged
- Login history with success/failure status
- Timestamp tracking for last login
- IP address and user agent logging
- Searchable and paginated login history (up to 100 records per query)

### API Security

#### Rate Limiting
- 100 requests per 15 minutes per IP (configurable via RATE_LIMIT_MAX)
- Progressive delays after 50 requests using express-slow-down
- Trusted IP bypass support (configurable via TRUSTED_IPS)
- Custom error responses with retry-after headers
- Separate limits for auth endpoints
- IP and user-based rate limiting
- Configurable window size (RATE_LIMIT_WINDOW_MS)

#### CSRF Protection
- Token-based CSRF protection using 'csrf' package
- Secure token generation and validation
- Automatic token rotation
- Token validation on all state-changing requests
- Custom CSRF middleware implementation
- Configurable via CSRF_SECRET environment variable

#### Content Security Policy
- Strict CSP configuration with no unsafe-inline
- Default-src restricted to self
- Frame ancestors disabled
- Base URI restrictions
- Form action restrictions
- Configurable report URI (CSP_REPORT_URI)
- CSP violation reporting endpoint

#### Request Validation
- JSON schema validation
- Input sanitization
- SQL injection prevention
- XSS protection
- File upload restrictions
- Content-Type validation
- Circular reference detection
- Empty payload detection
- Configurable payload size limits (API_MAX_PAYLOAD_SIZE)


```

### Database Security
- Connection pooling is configured with limits to prevent resource exhaustion
- SSL/TLS is enabled for production database connections
- Parameterized queries are used to prevent SQL injection
- Database credentials are stored securely in environment variables

### API Security
- CORS is configured to allow only specified origins
- Rate limiting is enabled to prevent abuse
- Request size limits are in place
- Helmet.js is configured for secure HTTP headers
- HTTPS is required in production

### Authentication & Session Management
JWT-based authentication with:
- Secure token storage in HttpOnly cookies
- Token expiration and refresh mechanisms
- Password hashing using bcrypt
- Role-based access control

Session security:
- Secure session storage with express-session
- Session secret management (SESSION_SECRET)
- Secure cookie settings:
  - HttpOnly: true
  - Secure: true in production
  - SameSite: strict
  - Custom domain in production
- Session rotation and timeout
- Rolling session updates

### Data Protection

#### Database Security
- Parameterized queries only
- Limited database user permissions
- Connection pooling with limits
- Regular security audits
- Encrypted backups

#### Transport Security
- HTTPS required
- TLS 1.3 preferred
- Strong cipher suites
- HSTS preloading
- Certificate pinning

### Monitoring & Auditing

#### Security Events
- Failed and successful login attempts (logged to login_history table)
- Password changes and forced password resets
- User creation and role changes
- User deactivation/deletion attempts
- Permission changes and privilege escalation attempts
- Data export requests (CSV exports)
- Admin actions (bulk operations, profile edits)
- Last admin deletion attempts (blocked and logged)
- Self-modification attempts (blocked and logged)
- CSP violations
- Rate limit violations
- CSRF token failures

#### Logging & Alerts
- Structured error logging with unique IDs
- Configurable log levels (LOG_LEVEL)
- Separate security event logging
- Multiple log destinations:
  - File logging (LOG_FILE_PATH)
  - Console output in development
  - External logging service in production
- Error notification system:
  - Webhook notifications (ERROR_NOTIFICATION_WEBHOOK)
  - Email alerts (ERROR_NOTIFICATION_EMAIL)
- Environment-specific logging:
  - Development: detailed error information
  - Production: sanitized error messages
- Regular log rotation and archiving

## Security Checklist

### Development
- [ ] Dependencies scanned for vulnerabilities
- [ ] Security linting enabled
- [ ] SAST/DAST tools configured
- [ ] Secrets detection in commits
- [ ] Code review security checklist

### Deployment
- [ ] Environment variables verified
- [ ] Production configurations tested
- [ ] SSL/TLS certificates valid
- [ ] Firewall rules configured
- [ ] Logging enabled and verified

### Maintenance
- [ ] Regular security updates
- [ ] Dependency audits
- [ ] Log review procedures
- [ ] Incident response plan
- [ ] Backup verification

## Incident Response

### Steps
1. Identify and isolate affected systems
2. Document incident details
3. Assess impact and data exposure
4. Implement fixes and patches
5. Review and improve security measures

