# Email Service Configuration Guide

## Overview

The ShotSpot email service enables automated delivery of scheduled reports to team members, coaches, and administrators. This guide covers setup, configuration, and usage.

## Features

- 📧 **HTML & Plain Text Emails** - Beautifully formatted with fallback support
- 🔒 **Secure SMTP** - Industry-standard email protocols
- 📎 **File Attachments** - Attach PDF/CSV reports directly to emails
- ⏰ **Scheduled Delivery** - Automatic report distribution
- 🧪 **Test Mode** - Safe testing without sending actual emails
- 🎨 **Branded Templates** - Professional email design with ShotSpot branding

## Quick Start

### 1. Environment Configuration

Add the following variables to your `.env` file:

```bash
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
SMTP_FROM=noreply@shotspot.app
```

### 2. Verify Configuration

Run the verification script to test your SMTP settings:

```javascript
import { verifyEmailConfig } from './src/services/emailService.js';

const result = await verifyEmailConfig();
console.log(result);
// { verified: true, message: 'Email configuration verified successfully' }
```

### 3. Send Your First Report Email

```javascript
import { sendReportEmail } from './src/services/emailService.js';

const result = await sendReportEmail({
  recipients: ['coach@team.com', 'admin@team.com'],
  subject: 'Weekly Team Report',
  reportName: 'Team Performance - Week 12',
  reportType: 'team',
  teamName: 'Phoenix Korfball Club',
  generatedBy: 'Coach Smith',
  downloadUrl: 'https://your-domain.com/reports/download/123',
  filePath: '/path/to/report.pdf',
  expiresAt: new Date('2025-12-31')
});

console.log(result);
// { success: true, messageId: '...', recipients: [...] }
```

## SMTP Provider Setup

### Gmail

1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password:
   - Go to Google Account Settings → Security
   - Select "App passwords"
   - Generate a new app password for "Mail"
3. Use the generated password in `SMTP_PASSWORD`

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
```

### Microsoft 365 / Outlook

```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
```

### SendGrid

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

### AWS SES (Amazon Simple Email Service)

```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password
```

### Custom SMTP Server

```bash
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your-password
```

## API Reference

### `sendReportEmail(options)`

Send a report email to one or more recipients.

**Parameters:**

```typescript
{
  recipients: string[];          // Required: Array of email addresses
  subject: string;               // Required: Email subject line
  reportName: string;            // Required: Name of the report
  reportType: string;            // Required: 'game' | 'team' | 'player' | 'season'
  generatedBy: string;           // Required: Username who generated the report
  teamName?: string;             // Optional: Team name if applicable
  downloadUrl?: string;          // Optional: URL to download the report
  filePath?: string;             // Optional: Local path to attach the file
  expiresAt?: Date;              // Optional: Report expiration date
}
```

**Returns:**

```typescript
{
  success: boolean;
  messageId?: string;
  recipients: string[];
  error?: string;
  previewUrl?: string;  // Only in development mode
  testMode?: boolean;   // Only in test environment
}
```

**Example:**

```javascript
const result = await sendReportEmail({
  recipients: ['coach@team.com'],
  subject: 'Match Report: Team A vs Team B',
  reportName: 'Full Match Analysis',
  reportType: 'game',
  teamName: 'Team A',
  generatedBy: 'Coach Johnson',
  downloadUrl: 'https://shotspot.app/reports/456',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
});

if (result.success) {
  console.log(`Email sent successfully! Message ID: ${result.messageId}`);
} else {
  console.error(`Failed to send email: ${result.error}`);
}
```

### `verifyEmailConfig()`

Verify that the SMTP configuration is correct and the service can connect.

**Returns:**

```typescript
{
  verified: boolean;
  message: string;
}
```

**Example:**

```javascript
const verification = await verifyEmailConfig();

if (verification.verified) {
  console.log('✅ Email service configured correctly');
} else {
  console.error('❌ Email configuration error:', verification.message);
}
```

## Email Templates

### HTML Template Features

- **Professional Design** - Gradient header with ShotSpot branding
- **Responsive Layout** - Works on all devices and email clients
- **Report Details Card** - Clearly formatted report information
- **Download Button** - Prominent call-to-action
- **Expiration Warning** - Highlighted notice if report has expiration
- **Footer** - Standard branding and contact information

### Customization

To customize email templates, edit the `generateReportEmailHTML()` function in `src/services/emailService.js`:

```javascript
// Example: Add custom logo
<div class="header">
  <img src="https://your-domain.com/logo.png" alt="Team Logo" />
  <h1>🏐 ShotSpot Report Ready</h1>
</div>
```

## Environment-Specific Behavior

### Test Environment (`NODE_ENV=test`)

- No actual emails are sent
- Returns mock success responses
- Useful for running test suites

### Development Environment (`NODE_ENV=development`)

- Emails are sent to configured SMTP server
- Preview URLs are logged to console (if using Ethereal)
- Additional logging for debugging

### Production Environment (`NODE_ENV=production`)

- Full email delivery
- Minimal logging
- Error tracking

## Integration with Scheduled Reports

The email service integrates seamlessly with the scheduled reports feature:

```javascript
// In scheduled report processor
import { sendReportEmail } from './services/emailService.js';

async function processScheduledReport(schedule) {
  // Generate report
  const exportId = await generateReport(schedule);
  
  // Send email if configured
  if (schedule.send_email && schedule.email_recipients.length > 0) {
    await sendReportEmail({
      recipients: schedule.email_recipients,
      subject: schedule.email_subject || `Scheduled Report: ${schedule.name}`,
      reportName: schedule.name,
      reportType: schedule.report_type,
      teamName: schedule.team_name,
      generatedBy: schedule.created_by_username,
      downloadUrl: `${process.env.APP_URL}/exports/download/${exportId}`
    });
  }
}
```

## Troubleshooting

### Common Issues

#### "Email service not configured"

**Solution:** Ensure all required SMTP environment variables are set:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`

#### "Authentication failed"

**Solutions:**
- Verify username and password are correct
- For Gmail, use an App Password, not your regular password
- Check if 2FA is required for your email provider
- Verify SMTP server allows connections from your IP

#### "Connection timeout"

**Solutions:**
- Check firewall settings allow outbound SMTP connections
- Verify `SMTP_PORT` is correct (usually 587 or 465)
- Try `SMTP_SECURE=true` with port 465
- Test with telnet: `telnet smtp.gmail.com 587`

#### "Certificate verification failed"

**Solution:** For self-signed certificates in development:
```javascript
// Add to transporter config (development only!)
transporter = nodemailer.createTransporter({
  // ... other config
  tls: {
    rejectUnauthorized: false
  }
});
```

### Debug Mode

Enable verbose logging:

```bash
DEBUG=nodemailer:* npm start
```

### Test Email Delivery

Use Ethereal Email (fake SMTP service) for testing:

```bash
# No SMTP config needed - service will auto-create test account
NODE_ENV=development npm start
```

Check console for preview URLs to view sent emails.

## Security Best Practices

1. **Never commit credentials** - Use environment variables
2. **Use App Passwords** - Don't use primary email passwords
3. **Enable TLS/SSL** - Always use secure connections
4. **Validate recipients** - Sanitize email addresses
5. **Rate limiting** - Implement email sending limits
6. **Monitor delivery** - Track failed sends and bounces

## Performance Considerations

### Rate Limits

Most email providers have rate limits:
- Gmail: 500 emails/day (free), 2000/day (Google Workspace)
- SendGrid: Based on your plan
- AWS SES: Request increase from default limits

### Queueing

For bulk emails, implement a queue system:

```javascript
import { Queue } from 'bull';

const emailQueue = new Queue('email-queue');

emailQueue.process(async (job) => {
  await sendReportEmail(job.data);
});

// Add to queue
await emailQueue.add({
  recipients: ['user@example.com'],
  // ... other params
});
```

### Async Processing

Always send emails asynchronously to avoid blocking:

```javascript
// Don't wait for email to send
sendReportEmail(options).catch(err => {
  console.error('Email send failed:', err);
});

// Continue with other operations
res.json({ success: true, message: 'Report generated' });
```

## Testing

Run email service tests:

```bash
npm test -- emailService.test.js
```

Test actual email delivery (development):

```bash
NODE_ENV=development node -e "
import { sendReportEmail } from './src/services/emailService.js';
await sendReportEmail({
  recipients: ['your-email@example.com'],
  subject: 'Test Email',
  reportName: 'Test Report',
  reportType: 'game',
  generatedBy: 'Test User'
});
"
```

## Support

For issues or questions:
1. Check this documentation
2. Review test examples in `test/emailService.test.js`
3. Check nodemailer documentation: https://nodemailer.com
4. Contact your system administrator

## Future Enhancements

Planned features:
- [ ] Email template library with multiple designs
- [ ] Inline PDF preview in email
- [ ] Email analytics (open rates, click tracking)
- [ ] Internationalization (i18n) support
- [ ] Custom branding per team
- [ ] Email scheduling (send at specific time)
- [ ] Bounce handling and retry logic
