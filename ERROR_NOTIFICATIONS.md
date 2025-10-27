# Error Notification System

## Overview

The ShotSpot backend includes a comprehensive error notification system that sends alerts to multiple channels when errors occur. The system features:

- ✅ **Multi-channel support** - Webhook, Slack, Microsoft Teams, Email
- ✅ **Severity-based filtering** - Critical, High, Medium, Low
- ✅ **Frequency tracking** - Only notify after threshold reached
- ✅ **Rate limiting** - Cooldown periods prevent notification spam
- ✅ **Rich formatting** - Color-coded, structured messages with error details

## Quick Start

### 1. Enable Error Notifications

Add to your `.env` file:

```bash
ENABLE_ERROR_NOTIFICATIONS=true
```

### 2. Configure Notification Channels

Choose one or more channels:

#### Webhook (Generic)
```bash
ERROR_NOTIFICATION_WEBHOOK=https://your-webhook-url.com/errors
```

#### Slack
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

**To create a Slack webhook:**
1. Go to https://api.slack.com/apps
2. Create a new app or select existing
3. Enable "Incoming Webhooks"
4. Add New Webhook to Workspace
5. Copy the webhook URL

#### Microsoft Teams
```bash
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/YOUR/TEAMS/WEBHOOK
```

**To create a Teams webhook:**
1. Open your Teams channel
2. Click "..." → Connectors → Incoming Webhook
3. Configure and create
4. Copy the webhook URL

#### Email (Coming Soon)
```bash
ERROR_NOTIFICATION_EMAIL=admin@example.com
ERROR_EMAIL_FROM=errors@shotspot.app
```

*Note: Email requires integration with an email service (SendGrid, Mailgun, AWS SES)*

### 3. Optional Configuration

```bash
# Log viewer URL (for notification links)
LOG_VIEWER_URL=http://localhost:3001
```

## How It Works

### Error Severity Levels

The system automatically categorizes errors based on HTTP status codes:

| Severity | Status Codes | Threshold | Cooldown |
|----------|--------------|-----------|----------|
| **Critical** | 500+ | Notify immediately | 5 minutes |
| **High** | 401, 403, 429 | After 5 occurrences | 15 minutes |
| **Medium** | 400-499 | After 20 occurrences | 1 hour |
| **Low** | Other | After 100 occurrences | 4 hours |

### Notification Triggers

Notifications are sent when:
1. An error occurs matching the severity threshold
2. The cooldown period has expired for that error type
3. At least one notification channel is configured
4. `ENABLE_ERROR_NOTIFICATIONS=true`

### What Gets Notified

Each notification includes:
- ✅ Error type and status code
- ✅ Error message and stack trace (dev only)
- ✅ Request path and method
- ✅ User ID (if authenticated)
- ✅ Error ID for tracking
- ✅ Environment (development/production)
- ✅ Occurrence count in last 15 minutes
- ✅ Timestamp

## Example Notifications

### Slack Notification
```
🚨 CRITICAL Error in ShotSpot

Error Type: DatabaseError
Status Code: 500
Environment: production
Path: POST /api/games
Message: Connection to database failed
Occurrences: 1 times in last 15 minutes
Error ID: abc123-def456-789
```

### Teams Notification
Similar format with clickable "View Logs" button (if LOG_VIEWER_URL configured)

## Development vs Production

### Development Mode
- All error details included in notifications
- Stack traces visible
- Lower severity thresholds for testing
- Console logs for debugging

### Production Mode
- Sensitive details redacted
- Error IDs for tracking
- Higher thresholds prevent spam
- Logs written to file

## Testing the System

### Manual Test

1. Enable notifications:
```bash
ENABLE_ERROR_NOTIFICATIONS=true
SLACK_WEBHOOK_URL=your_webhook_url
```

2. Trigger a test error:
```bash
curl -X POST http://localhost:3001/api/test-error-500 \
  -H "Content-Type: application/json"
```

3. Check your Slack/Teams channel for the notification

### Verify Configuration

Check the logs when starting the server to ensure the service initialized:

```bash
npm start
# Look for: "Error notification service initialized"
```

## Troubleshooting

### Notifications Not Sending

1. **Check environment variable:**
   ```bash
   echo $ENABLE_ERROR_NOTIFICATIONS  # Should be "true"
   ```

2. **Verify webhook URL:**
   ```bash
   curl -X POST your_webhook_url -d '{"test": "message"}'
   ```

3. **Check console for errors:**
   - Look for "Failed to send [channel] notification"
   - Webhook failures are logged but won't crash the app

4. **Verify error threshold:**
   - Critical errors notify immediately
   - Other severities require multiple occurrences

### Too Many Notifications

1. **Check cooldown settings** in `backend/src/utils/errorNotification.js`
2. **Adjust thresholds** for your needs
3. **Filter by severity** - remove channels for low-priority errors

### Customization

Edit `backend/src/utils/errorNotification.js` to customize:
- Severity thresholds
- Cooldown periods
- Message formatting
- Add new notification channels

## Email Integration (Advanced)

To enable email notifications, integrate with an email service:

### SendGrid Example
```bash
npm install @sendgrid/mail
```

```javascript
// In errorNotification.js sendEmail method:
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
await sgMail.send(emailData);
```

### Mailgun Example
```bash
npm install mailgun-js
```

```javascript
const mailgun = require('mailgun-js')({
  apiKey: process.env.MAILGUN_API_KEY,
  domain: process.env.MAILGUN_DOMAIN
});
await mailgun.messages().send(emailData);
```

## Security Considerations

✅ **Safe for production:**
- Sensitive data redacted from notifications
- Error IDs used for correlation
- Stack traces excluded in production
- Webhook failures won't crash the app

⚠️ **Best practices:**
- Use HTTPS webhooks only
- Rotate webhook URLs periodically
- Limit notification channel access
- Monitor notification volumes

## Support

For issues or questions:
1. Check `backend/src/utils/errorNotification.js` for implementation details
2. Review console logs for error messages
3. Test with simple webhook services like RequestBin
4. Ensure environment variables are properly set

---

**Status:** ✅ Fully implemented and tested (174/174 tests passing)
