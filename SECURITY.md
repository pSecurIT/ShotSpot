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
  - Minimum 12 characters
  - Mix of uppercase, lowercase, numbers, symbols
  - Password breach check
  - Bcrypt hashing with work factor 12

### Authorization

- Role-based access control (RBAC)
- Roles:
  - Admin: Full system access
  - Coach: Team and player management
  - Assistant: Event recording only
  - Viewer: Read-only access
- Resource-level permissions
- Action audit logging

### API Security

#### Rate Limiting
- 100 requests per 15 minutes per IP
- Progressive delays after 50 requests
- Custom error responses with retry-after headers
- Separate limits for auth endpoints

#### Request Validation
- JSON schema validation
- Input sanitization
- SQL injection prevention
- XSS protection
- File upload restrictions


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

### Authentication
JWT-based authentication with:
- Secure token storage
- Token expiration and refresh mechanisms
- Password hashing using bcrypt
- Role-based access control

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
- Failed login attempts
- Password changes
- Permission changes
- Data export requests
- Admin actions

#### Alerts
- Unusual traffic patterns
- Multiple failed logins
- Unauthorized access attempts
- Database connection issues
- Certificate expiration warnings

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

