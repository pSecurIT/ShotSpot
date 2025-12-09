# ShotSpot Documentation

This directory contains comprehensive documentation for specialized features and integrations.

## Available Documentation

### 📡 Twizzit Integration

**File**: `TWIZZIT_INTEGRATION.md`

Complete guide for integrating ShotSpot with the Belgian Korfball Federation API (Twizzit). Includes:

- Architecture overview and data flow diagrams
- Step-by-step setup instructions
- Complete API reference with examples
- Security best practices (AES-256-CBC encryption)
- Troubleshooting guide
- Performance optimization tips
- Database schema documentation

**Quick Links**:
- [Setup Guide](TWIZZIT_INTEGRATION.md#setup-guide)
- [API Reference](TWIZZIT_INTEGRATION.md#api-reference)
- [Security](TWIZZIT_INTEGRATION.md#security-considerations)
- [Troubleshooting](TWIZZIT_INTEGRATION.md#troubleshooting)

**API Structure**: `TWIZZIT_API.json`

Reference JSON document describing the Twizzit API structure, endpoints, authentication, and data formats.

---

## Quick Start by Feature

### Setting Up Twizzit Integration

```bash
# 1. Generate encryption key
openssl rand -hex 32

# 2. Add to .env
echo "TWIZZIT_ENCRYPTION_KEY=<your-key>" >> backend/.env

# 3. Run database migrations
cd backend
npm run setup-db

# 4. Store API credentials
curl -X POST http://localhost:3001/api/twizzit/credentials \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationName": "Your Organization",
    "apiUsername": "your-username",
    "apiPassword": "your-password"
  }'

# 5. Sync data
curl -X POST http://localhost:3001/api/twizzit/sync/teams/<credential-id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"includePlayers": true}'
```

---

## Documentation Standards

When adding new documentation to this directory:

1. **File Naming**: Use `UPPERCASE_WITH_UNDERSCORES.md` for main docs
2. **Structure**: Include these sections:
   - Overview
   - Setup/Installation
   - Usage Examples
   - API Reference (if applicable)
   - Troubleshooting
   - Security Considerations
3. **Code Examples**: Provide complete, runnable examples
4. **Diagrams**: Use ASCII art or link to external images
5. **Cross-Reference**: Link to related documentation

---

## Related Documentation

- **Root Level**:
  - `../QUICKSTART.md` - 5-minute project setup
  - `../INSTALLATION.md` - Complete installation guide
  - `../BUILD.md` - Build commands reference
  - `../SECURITY.md` - Security architecture
  - `../OFFLINE.md` - Offline mode implementation
  - `../REPORTS_API.md` - Analytics and reporting API
  - `../DOCKER.md` - Container deployment

- **Mobile**:
  - `../MOBILE_DEPLOYMENT.md` - iOS/Android app store releases
  - `../MOBILE_ARCHITECTURE.md` - Native app architecture

---

## Contributing Documentation

When documenting new features:

1. Create a comprehensive guide in this directory
2. Add entry to this README
3. Link from relevant root-level docs
4. Include API examples in both curl and JavaScript
5. Add troubleshooting section with common issues
6. Document security implications
7. Provide performance optimization tips

---

## Support

- **Issues**: [GitHub Issues](https://github.com/pSecurIT/Korfball-game-statistics/issues)
- **Discussions**: [GitHub Discussions](https://github.com/pSecurIT/Korfball-game-statistics/discussions)
- **Email**: Contact project maintainers

---

**Last Updated**: December 2025  
**Status**: Production Ready
