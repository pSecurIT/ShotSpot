# Default Admin User Setup

## Overview

ShotSpot automatically creates a default administrator account on first startup if no admin users exist in the database. This ensures you can always access the system for initial setup and configuration.

## 🔐 Security Features

- ✅ **Forced Password Change**: Default admin MUST change password on first login
- ✅ **Auto-Generated Password**: Cryptographically secure password generated if not provided
- ✅ **One-Time Display**: Credentials shown only once during creation
- ✅ **API Restrictions**: Most endpoints blocked until password is changed
- ✅ **Idempotent**: Safe to run multiple times, won't create duplicates

## 📋 Quick Start

### Local Installation

1. **Start the application**:
   ```bash
   npm run dev
   ```

2. **Check console output** for default admin credentials:
   ```
   ================================================================================
   🎉 DEFAULT ADMIN USER CREATED SUCCESSFULLY
   ================================================================================
   
   📋 Admin Credentials:
      Username: admin
      Email:    admin@shotspot.local
      Password: Xy9#mK2$pL5&qR8^
   
   ⚠️  IMPORTANT SECURITY NOTES:
      1. This password will NOT be shown again
      2. You MUST change this password on first login
      3. Most API operations are blocked until password is changed
      4. Save these credentials in a secure location NOW
   ```

3. **Save credentials** immediately

4. **Login** with provided credentials

5. **Change password** (required before accessing other features)

### Docker Installation

1. **Configure environment** in `.env` or `docker-compose.yml`:
   ```env
   DEFAULT_ADMIN_USERNAME=admin
   DEFAULT_ADMIN_EMAIL=admin@shotspot.local
   DEFAULT_ADMIN_PASSWORD=        # Leave empty for auto-generation
   ```

2. **Start containers**:
   ```bash
   docker-compose up -d
   ```

3. **Check logs** for credentials:
   ```bash
   docker-compose logs app | grep "DEFAULT ADMIN"
   ```

4. **Follow steps 3-5** from Local Installation above

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DEFAULT_ADMIN_USERNAME` | `admin` | Username for default admin |
| `DEFAULT_ADMIN_EMAIL` | `admin@shotspot.local` | Email for default admin |
| `DEFAULT_ADMIN_PASSWORD` | *(auto-generated)* | Password (leave empty for auto-generation) |

### Custom Password

If you want to set a specific password, it must meet these requirements:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

**Example**:
```env
DEFAULT_ADMIN_PASSWORD=MySecure123!Pass
```

## 🔄 Password Change Flow

### 1. First Login

**Request**:
```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "Xy9#mK2$pL5&qR8^"
}
```

**Response**:
```json
{
  "message": "Logged in successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@shotspot.local",
    "role": "admin",
    "passwordMustChange": true
  }
}
```

### 2. Access Other Endpoints (Blocked)

Any attempt to access protected endpoints returns:

```json
{
  "error": "Password change required",
  "message": "You must change your password before accessing other resources",
  "passwordMustChange": true
}
```

### 3. Change Password

**Request**:
```bash
POST /api/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "Xy9#mK2$pL5&qR8^",
  "newPassword": "MyNewSecure123!Password"
}
```

**Response**:
```json
{
  "message": "Password changed successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@shotspot.local",
    "role": "admin",
    "passwordMustChange": false
  }
}
```

### 4. Full Access Granted

After password change, you can access all admin features.

## 🛠️ Troubleshooting

### Admin Already Exists

If admin users already exist in the database:
```
ℹ️  Admin user(s) already exist, skipping default admin creation
```

**Solution**: Use existing admin credentials or create new admin via existing admin account.

### Migration Not Applied

If you see:
```
❌ Error creating default admin user: column "password_must_change" does not exist
```

**Solution**: Run database migrations:
```bash
npm run setup-db
# or for Docker:
docker-compose down -v && docker-compose up -d
```

### Lost Default Password

If you didn't save the auto-generated password:

**Solution**:
1. Stop the application
2. Delete the default admin user from database:
   ```sql
   DELETE FROM users WHERE username = 'admin';
   ```
3. Restart application - new credentials will be generated

### Can't Access After Login

If `passwordMustChange` is still `true` after changing password:

**Solution**:
1. Check that you're using the new token from change-password response
2. Verify database was updated:
   ```sql
   SELECT password_must_change FROM users WHERE username = 'admin';
   ```

## 🔒 Security Best Practices

### ✅ DO

- Leave `DEFAULT_ADMIN_PASSWORD` empty for auto-generation (uses crypto.randomInt)
- Save initial credentials immediately in a secure password manager
- Change password on first login (enforced by system)
- Remove default password from environment after setup
- Use a password manager for admin credentials
- Rotate admin passwords regularly (every 90 days recommended)
- Monitor admin login attempts and activities
- Use different passwords for each admin account
- Keep bcrypt work factor at 12+ (current: 12)

### ❌ DON'T

- Commit default admin credentials to version control
- Share default credentials via insecure channels (email, Slack, etc.)
- Use default credentials in production without changing
- Reuse the default password for other accounts
- Skip password change (system enforces this anyway)
- Use weak passwords that don't meet requirements
- Store credentials in plain text files

### 🛡️ Additional Security Measures

**Implemented:**
- ✅ Bcrypt work factor: 12 (OWASP 2024 standard)
- ✅ Timing attack protection on login endpoints
- ✅ Forced password change with database flag
- ✅ Input sanitization (username: alphanumeric/-/_, email: RFC 5322)
- ✅ Cryptographically secure password generation (crypto.randomInt)
- ✅ Fisher-Yates shuffle for password randomization
- ✅ Token expiration handling with clear error messages
- ✅ Password reuse prevention (current password check)

**Recommended Additional Measures:**
- 📋 Password history (prevent last 3-5 passwords)
- 📋 Account lockout after N failed attempts
- 📋 Two-factor authentication (2FA/MFA)
- 📋 Session management and concurrent login limits
- 📋 IP whitelisting for admin accounts
- 📋 Audit logging for all admin actions

## 📚 API Reference

### Allowed Endpoints (Before Password Change)

- `POST /api/auth/login` - Login
- `POST /api/auth/change-password` - Change password (required)
- `GET /api/health` - Health check
- `POST /api/auth/logout` - Logout

### Blocked Endpoints (Before Password Change)

All other endpoints return `403 Forbidden` with password change requirement.

## 🐳 Docker-Specific Notes

### Persistent Credentials

Default admin is created only once when database is initialized. If you recreate containers but keep the database volume, the default admin won't be recreated.

### Viewing Logs

```bash
# View all logs
docker-compose logs app

# Follow logs in real-time
docker-compose logs -f app

# Search for admin creation
docker-compose logs app | grep -A 20 "DEFAULT ADMIN"
```

### Recreating Default Admin

To recreate (e.g., lost credentials):

```bash
# Stop and remove volumes
docker-compose down -v

# Start fresh
docker-compose up -d

# Check logs for new credentials
docker-compose logs app | grep -A 20 "DEFAULT ADMIN"
```

## 🔄 Migration Information

The default admin feature requires the `add_password_must_change` migration:

**File**: `backend/src/migrations/add_password_must_change.sql`

**Applied automatically** by:
- `npm run setup-db` (local)
- `npm run setup-test-db` (testing)
- Docker initialization scripts
- Server startup (checks migrations)

## 📞 Support

If you encounter issues:

1. Check server logs for error messages
2. Verify database migrations are applied
3. Ensure environment variables are set correctly
4. See [SECURITY.md](SECURITY.md) for security documentation
5. Open an issue on GitHub

---

**Last Updated**: November 2025  
**Version**: 1.0.0
