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

## Secret Scanning & Push Protection

### GitHub Secret Scanning

Secret Scanning and Push Protection are enabled on this repository. GitHub automatically detects and blocks commits containing known credential patterns (JWT tokens, API keys, private keys, etc.) before they reach the remote.

**Repository configuration files:**
- `.github/secret_scanning.yml` — defines path exclusions (test fixtures, `.env.example` files) and lists the custom patterns that should be registered via the GitHub UI
- `.gitleaks.toml` — project-specific patterns used by the CI Gitleaks job and for local scanning

**Custom patterns — availability note:**

Registering custom patterns via the GitHub UI (Settings → Security → Secret scanning → Custom patterns) requires **GitHub Secret Protection**, which is only available on GitHub Team or Enterprise plans for organization-owned repositories. It is **not available for personal repositories**.

For this project, custom patterns are enforced via the **Gitleaks CI job** instead (see `.gitleaks.toml` and the `scan-secrets` job in `.github/workflows/security-scan.yml`). This covers the same patterns on every PR and push without requiring a paid plan.

**Local scanning (optional pre-commit check):**
```bash
# Install gitleaks
npm install -g gitleaks   # or: brew install gitleaks

# Scan working tree
gitleaks detect --config .gitleaks.toml --source . --redact

# Scan commit history
gitleaks detect --config .gitleaks.toml --source . --redact --log-opts "HEAD~10..HEAD"
```

### Secret Rotation Process

Follow this process whenever a secret is compromised, rotated on schedule, or an employee with secret access departs.

#### 1. JWT_SECRET / SESSION_SECRET / CSRF_SECRET

```bash
# Generate a new secret (minimum 32 bytes)
openssl rand -base64 48
```

1. Generate a new value and update the environment variable in the deployment environment (`.env` in production, Docker secret, or CI/CD secret store).
2. Restart the backend process — all active JWT tokens become invalid immediately.
3. Users will be forced to log in again (tokens signed with the old secret are rejected).
4. Remove the old secret from all secret stores and CI/CD variables.

#### 2. TWIZZIT_ENCRYPTION_KEY

> **Warning:** Rotating this key requires re-encrypting all stored Twizzit API credentials. Failure to do so will break the Twizzit integration.

```bash
# Generate a new 32-byte (64 hex character) key
openssl rand -hex 32
```

1. Back up the current value.
2. Run the re-encryption migration (to be implemented when Twizzit credential storage is added to the database).
3. Update the environment variable.
4. Restart the backend and verify that Twizzit sync still works.
5. Securely delete the old key backup.

#### 3. DB_PASSWORD / POSTGRES_PASSWORD

1. Connect to the PostgreSQL instance as superuser.
2. Change the password: `ALTER USER shotspot_user PASSWORD 'new_secure_password';`
3. Update `DB_PASSWORD` in the environment and restart the backend.
4. Verify database connectivity.

#### 4. GitHub Actions / CI Secrets

1. Navigate to **Settings → Secrets and variables → Actions**.
2. Update the affected secret in place.
3. Re-run any failed workflows to confirm the new value works.

#### Secret Rotation Checklist

- [ ] New secret generated with sufficient entropy (≥ 32 bytes / 256 bits)
- [ ] Old secret invalidated at the source (revoked / password changed)
- [ ] All deployment environments updated (prod, staging, CI)
- [ ] Backend restarted and health-checked
- [ ] Old secret removed from all secret stores
- [ ] Incident documented with rotation timestamp

---

## Vulnerability Scanning Pipeline

### Overview

ShotSpot employs a **multi-layered vulnerability scanning approach** to protect the entire attack surface of the monorepo:

| Scanner | Coverage | Trigger | Threshold | Location |
|---------|----------|---------|-----------|----------|
| **Snyk** (npm) | Frontend + backend npm packages | PR/push/weekly | HIGH+CRITICAL | `.github/workflows/node.js.yml` |
| **Snyk** (Docker) | Container images & dependencies | PR/push/weekly | HIGH+CRITICAL | `.github/workflows/docker.yml` |
| **Trivy** | Filesystem, OS packages, IaC, secrets | PR/push/weekly | CRITICAL (fails), MEDIUM (reports) | `.github/workflows/security-scan.yml` |
| **CodeQL** | Static analysis (JavaScript/TypeScript) | Weekly + on-demand | All findings reported | `.github/workflows/codeql.yml` |
| **npm audit** | npm packages (baseline/local) | Manual or pre-commit | CRITICAL (fail) | Per-directory or CI |

### Snyk Integration

**Purpose:** Identify and remediate vulnerabilities in npm packages (backend Express, frontend React) and Docker container images with actionable remediation guidance.

**CI/CD Pipeline:**

1. **Node.js Workflow** (`.github/workflows/node.js.yml`):
   - Scans `backend/` and `frontend/` npm dependencies
   - Runs after install; fails build on HIGH or CRITICAL severity
   - Uploads findings to GitHub Code Scanning (SARIF format)
   - Runs on: PR, push to main, weekly schedule

2. **Docker Workflow** (`.github/workflows/docker.yml`):
   - Scans built Docker image after multi-stage build
   - Includes base image + npm dependencies + application code
   - Fails build on HIGH or CRITICAL severity
   - Uploads findings to GitHub Code Scanning
   - Runs on: PR, push to main (if Dockerfile/docker-compose.yml changes), weekly schedule

**Failure Behavior:**

When Snyk detects HIGH or CRITICAL vulnerabilities:
- ❌ Build fails; PR cannot be merged
- 📊 Findings reported in GitHub Code Scanning tab (visible as "Snyk" / "Snyk Docker" categories)
- 🔗 Each finding links to Snyk.io for remediation guidance (e.g., patch versions, workarounds)

**Remediation Workflow:**

1. **Check Snyk Findings:** View GitHub Code Scanning → Snyk category or run locally (see below)
2. **Review Guidance:** Click finding → Snyk link → see patch recommendations, CVE details, exploitability
3. **Apply Fix:** 
   - Upgrade vulnerable package: `npm update <package>`
   - Or use `npm audit fix` (use with caution; may introduce breaking changes)
4. **Verify:** Commit and push; Snyk re-scans automatically
5. **Follow-up:** For complex vulnerabilities, consider upgrading Node.js or the base Docker image

### Local Vulnerability Scanning

**Install Snyk CLI:**
```bash
npm install -g snyk
```

**Authenticate with Snyk (one-time):**
```bash
snyk auth
# Opens browser to https://app.snyk.io/auth/login
# Creates ~/.snyk file with API token
```

**Scan Frontend & Backend Locally:**
```bash
# Scan all packages (both frontend + backend)
npm run snyk:scan

# Or scan individually:
cd backend && npm run snyk:scan
cd frontend && npm run snyk:scan

# Scan and show detailed output
snyk test --severity-threshold=high --verbose

# Generate interactive report (opens in browser)
snyk test --json > snyk-report.json
```

**Options:**

```bash
snyk test                                  # Basic scan; exits 1 if vulns found
snyk test --severity-threshold=high       # Only HIGH and CRITICAL (default for ShotSpot)
snyk test --severity-threshold=medium     # Include MEDIUM vulnerabilities
snyk test --dry-run                       # Scan without failing build
snyk test --file=package-lock.json        # Scan specific lock file
snyk test --json                          # Output as JSON (for parsing)
snyk test --sarif                         # Output as SARIF (for GitHub Code Scanning)
snyk test --help                          # Full option list
```

**Docker Image Scanning (Local):**
```bash
# Scan a locally built Docker image
docker build -t shotspot:test .
snyk container test shotspot:test --severity-threshold=high
```

### Snyk Setup & Authentication

**GitHub Actions Authentication:**

The CI/CD workflows use the `SNYK_TOKEN` GitHub secret for authentication. To set this up:

1. **Create Snyk Free Tier Account:**
   - Go to https://snyk.io/free
   - Sign up with email or GitHub account
   - Create organization (or use existing pSecurIT org if available)

2. **Generate API Token:**
   - Log in to https://app.snyk.io
   - Settings → API Token → Click to reveal
   - Copy the token (40-character hex string)

3. **Add GitHub Secret:**
   - Repository settings → Secrets and variables → Actions
   - New repository secret → Name: `SNYK_TOKEN`
   - Paste token value → Save

4. **Verify Setup:**
   - Push a commit or PR to trigger workflows
   - Check GitHub Actions → Node.js CI or Docker Build
   - Confirm Snyk scans run without "Missing SNYK_TOKEN" errors

**Local Authentication (Optional for developers):**

```bash
snyk auth                    # Opens browser; saves token to ~/.snyk
snyk auth <token-string>     # Or pass token directly (avoid in scripts)
snyk config unset api        # Revoke local authentication
```

### Snyk vs. npm audit vs. Trivy

**When to use each:**

- **npm audit** (lightweight baseline): Local pre-commit checks; fast but limited remediation guidance
- **Snyk** (comprehensive npm + Docker): Full CI/CD pipeline; superior remediation, both package + container scanning; requires auth token
- **Trivy** (filesystem/IaC/OS): Complements Snyk with OS package scanning, secrets, IaC analysis; no auth required

**Example Workflow:**

```
Developer commits code
  ↓
Pre-commit (optional): npm audit quick check
  ↓
Push to PR
  ↓
GitHub Actions:
  1. npm audit (quick baseline)
  2. Snyk test (npm packages) → HIGH+CRITICAL fail
  3. Snyk container (Docker image) → HIGH+CRITICAL fail
  4. Trivy (filesystem + OS packages + secrets) → CRITICAL fail, MEDIUM report
  5. CodeQL (static analysis)
  ↓
All pass? → Merge allowed
Any fail? → Fix vulnerabilities, push again
```

### Interpreting Snyk Findings

**Example Finding:**

```
⚠️ HIGH | Prototype Pollution
   Package: lodash
   Fixed in: >= 4.17.21
   Introduced through: express-validator@7.3.0
   Exploitability: Easily Exploitable
   Maturity: Established
```

**How to respond:**

1. **Click the finding** → Snyk.io link for full details
2. **Check "Fixed in"** → Upgrade to or above that version
3. **Review "Introduced through"** → May need to update a transitive dependency
4. **Consider "Exploitability"** → High exploitability = higher priority
5. **Update package:** `npm update <package>` and re-scan
6. **If unpatched:** Use `npm audit --audit-level=critical` to determine if it's acceptable (temporary gap)

### Further Resources

- **Snyk Documentation:** https://docs.snyk.io/
- **Snyk CLI Reference:** https://docs.snyk.io/snyk-cli
- **Snyk GitHub Integration:** https://docs.snyk.io/integrations/ci-cd-integrations/github-actions-integration
- **CVE Search:** https://cve.mitre.org/
- **CVSS Scoring:** https://www.first.org/cvss/

---

## Incident Response

### Steps
1. Identify and isolate affected systems
2. Document incident details
3. Assess impact and data exposure
4. Implement fixes and patches
5. Review and improve security measures

