# Deployment Guide

This guide outlines the process for securely deploying the Korfball Game Statistics application, with a focus on environment variable management.

## Environment Setup

### Local Development

1. Create environment files:
   ```bash
   # Backend
   cp backend/.env.example backend/.env
   # Frontend
   cp frontend/.env.example frontend/.env
   ```

2. Update environment variables with your local configuration
3. Never commit `.env` files to version control

### Staging/Production Deployment

#### Prerequisites
- Access to production database
- SSL/TLS certificates
- Production API keys
- Access to secrets management system

#### Environment Variables Management

1. **Development**
   - Use local `.env` files
   - Store sensitive data in password manager
   - Use dummy data for development

2. **Staging**
   - Use environment-specific configuration
   - Store secrets in CI/CD platform's secret manager
   - Use separate databases for staging

3. **Production**
   - Use secret management service (e.g., AWS Secrets Manager, HashiCorp Vault)
   - Rotate secrets regularly
   - Use production-grade SSL certificates
   - Enable additional security measures

## Deployment Checklist

### Pre-deployment Verification
- [ ] All required environment variables are set
- [ ] Database connection is secure
- [ ] CORS origins are correctly configured
- [ ] Rate limiting is properly set
- [ ] SSL/TLS is enabled
- [ ] JWT secret is secure and unique per environment

### Database Configuration
- [ ] Connection pool settings match environment resources
- [ ] SSL/TLS is enabled for database connections
- [ ] Database user has appropriate permissions
- [ ] Backup strategy is in place

### Security Measures
- [ ] API endpoints are protected
- [ ] Authentication is properly configured
- [ ] Rate limiting is active
- [ ] CORS is properly configured
- [ ] Security headers are set

## Continuous Integration/Deployment

### Environment Variable Validation
- CI/CD pipeline includes environment validation
- All required variables are checked before deployment
- Sensitive data is properly masked in logs

### Deployment Process
1. Run environment validation scripts
2. Execute database migrations
3. Deploy backend services
4. Deploy frontend application
5. Run smoke tests
6. Monitor application metrics

## Troubleshooting

### Common Issues
1. Missing environment variables
   - Check deployment logs
   - Verify secret manager access
   - Validate CI/CD configuration

2. Database connection issues
   - Verify connection strings
   - Check network security groups
   - Validate SSL certificates

3. CORS errors
   - Verify allowed origins
   - Check environment-specific settings

## Monitoring and Maintenance

### Regular Tasks
- Rotate secrets every 90 days
- Update SSL certificates before expiry
- Review access logs
- Audit environment variables

### Emergency Procedures
1. If secrets are compromised:
   - Rotate affected credentials immediately
   - Review access logs
   - Update all affected services
   - Document incident

2. If deployment fails:
   - Check deployment logs
   - Verify environment variables
   - Roll back to last known good state
   - Document resolution steps