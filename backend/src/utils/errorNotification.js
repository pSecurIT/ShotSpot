/**
 * Error Notification Service
 * Handles multi-channel error notifications with severity-based filtering and rate limiting
 */
class ErrorNotificationService {
  constructor() {
    this.errorCounts = new Map(); // Track error frequency
    this.notificationCooldowns = new Map(); // Prevent spam
    this.enabled = process.env.ENABLE_ERROR_NOTIFICATIONS === 'true';
  }

  /**
   * Main method to send error notifications to configured channels
   * @param {Object} logError - Error log object with details
   */
  async notifyTeam(logError) {
    if (!this.enabled) {
      return;
    }

    const severity = this.determineSeverity(logError.error.status);
    
    // Check if we should notify based on severity and frequency
    if (!this.shouldNotify(logError, severity)) {
      return;
    }

    const message = this.formatErrorMessage(logError, severity);
    
    // Send to all configured channels
    const promises = [];
    
    if (process.env.ERROR_NOTIFICATION_WEBHOOK) {
      promises.push(this.sendWebhook(message, logError));
    }
    
    if (process.env.ERROR_NOTIFICATION_EMAIL) {
      promises.push(this.sendEmail(message, logError));
    }
    
    if (process.env.SLACK_WEBHOOK_URL) {
      promises.push(this.sendSlack(message, logError, severity));
    }
    
    if (process.env.TEAMS_WEBHOOK_URL) {
      promises.push(this.sendTeams(message, logError, severity));
    }

    await Promise.allSettled(promises);
    
    // Update cooldown to prevent spam
    this.setNotificationCooldown(logError.error.name, severity);
  }

  /**
   * Determine error severity based on HTTP status code
   * @param {number} status - HTTP status code
   * @returns {string} Severity level
   */
  determineSeverity(status) {
    if (status >= 500) return 'critical';
    if (status === 401 || status === 403 || status === 429) return 'high';
    if (status >= 400 && status < 500) return 'medium';
    return 'low';
  }

  /**
   * Check if a notification should be sent based on frequency and cooldown
   * @param {Object} logError - Error log object
   * @param {string} severity - Error severity level
   * @returns {boolean} Whether to send notification
   */
  shouldNotify(logError, severity) {
    const errorKey = `${logError.path}-${logError.error.name}`;
    
    // Check cooldown (don't spam notifications)
    const cooldownKey = `${errorKey}-${severity}`;
    if (this.notificationCooldowns.has(cooldownKey)) {
      const cooldownUntil = this.notificationCooldowns.get(cooldownKey);
      if (Date.now() < cooldownUntil) {
        return false;
      }
    }
    
    // Track error frequency
    if (!this.errorCounts.has(errorKey)) {
      this.errorCounts.set(errorKey, { count: 0, firstOccurrence: Date.now() });
    }
    
    const errorData = this.errorCounts.get(errorKey);
    errorData.count++;
    
    // Reset count after 15 minutes
    if (Date.now() - errorData.firstOccurrence > 900000) {
      errorData.count = 1;
      errorData.firstOccurrence = Date.now();
    }
    
    // Check if we've reached the threshold for this severity
    const threshold = {
      critical: 1,    // Notify immediately
      high: 5,        // After 5 occurrences
      medium: 20,     // After 20 occurrences
      low: 100        // After 100 occurrences
    }[severity];
    
    return errorData.count >= threshold;
  }

  /**
   * Set notification cooldown period to prevent spam
   * @param {string} errorName - Name of the error
   * @param {string} severity - Error severity level
   */
  setNotificationCooldown(errorName, severity) {
    const cooldowns = {
      critical: 5 * 60 * 1000,      // 5 minutes
      high: 15 * 60 * 1000,         // 15 minutes
      medium: 60 * 60 * 1000,       // 1 hour
      low: 4 * 60 * 60 * 1000       // 4 hours
    };
    
    const cooldownDuration = cooldowns[severity];
    const cooldownKey = `${errorName}-${severity}`;
    this.notificationCooldowns.set(cooldownKey, Date.now() + cooldownDuration);
  }

  /**
   * Format error details into a structured message
   * @param {Object} logError - Error log object
   * @param {string} severity - Error severity level
   * @returns {Object} Formatted message
   */
  formatErrorMessage(logError, severity) {
    const errorKey = `${logError.path}-${logError.error.name}`;
    return {
      severity,
      errorId: logError.id,
      timestamp: logError.timestamp,
      environment: process.env.NODE_ENV || 'unknown',
      service: 'ShotSpot Backend',
      error: {
        type: logError.error.name,
        message: logError.error.message,
        status: logError.error.status || 500
      },
      request: {
        method: logError.method,
        path: logError.path,
        ip: logError.ip,
        userId: logError.userId
      },
      count: this.errorCounts.get(errorKey)?.count || 1
    };
  }

  /**
   * Send notification to generic webhook endpoint
   * @param {Object} message - Formatted error message
   * @param {Object} logError - Full error log object
   */
  async sendWebhook(message, logError) {
    try {
      const response = await fetch(process.env.ERROR_NOTIFICATION_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...message, fullError: logError }),
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (!response.ok) {
        console.error('Webhook notification failed:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to send webhook notification:', error.message);
    }
  }

  /**
   * Send formatted notification to Slack
   * @param {Object} message - Formatted error message
   * @param {Object} logError - Full error log object
   * @param {string} severity - Error severity level
   */
  async sendSlack(message, logError, severity) {
    const colors = {
      critical: '#FF0000',
      high: '#FF6600',
      medium: '#FFCC00',
      low: '#0099FF'
    };

    const emojis = {
      critical: '🚨',
      high: '⚠️',
      medium: '⚡',
      low: 'ℹ️'
    };

    const slackMessage = {
      attachments: [{
        color: colors[severity],
        title: `${emojis[severity]} ${severity.toUpperCase()} Error in ShotSpot`,
        fields: [
          {
            title: 'Error Type',
            value: message.error.type,
            short: true
          },
          {
            title: 'Status Code',
            value: message.error.status.toString(),
            short: true
          },
          {
            title: 'Environment',
            value: message.environment,
            short: true
          },
          {
            title: 'Error ID',
            value: message.errorId,
            short: true
          },
          {
            title: 'Path',
            value: `${message.request.method} ${message.request.path}`,
            short: false
          },
          {
            title: 'Message',
            value: message.error.message,
            short: false
          },
          {
            title: 'Occurrences',
            value: `${message.count} times in last 15 minutes`,
            short: false
          }
        ],
        footer: 'ShotSpot Error Monitor',
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    try {
      const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackMessage),
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        console.error('Slack notification failed:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to send Slack notification:', error.message);
    }
  }

  /**
   * Send formatted notification to Microsoft Teams
   * @param {Object} message - Formatted error message
   * @param {Object} logError - Full error log object
   * @param {string} severity - Error severity level
   */
  async sendTeams(message, logError, severity) {
    const colors = {
      critical: 'FF0000',
      high: 'FF6600',
      medium: 'FFCC00',
      low: '0099FF'
    };

    const teamsMessage = {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: `${severity.toUpperCase()} Error in ShotSpot`,
      themeColor: colors[severity],
      title: `🚨 ${severity.toUpperCase()} Error Detected`,
      sections: [{
        activityTitle: 'Error Details',
        facts: [
          { name: 'Error Type', value: message.error.type },
          { name: 'Status Code', value: message.error.status.toString() },
          { name: 'Environment', value: message.environment },
          { name: 'Path', value: `${message.request.method} ${message.request.path}` },
          { name: 'Message', value: message.error.message },
          { name: 'Error ID', value: message.errorId },
          { name: 'Occurrences', value: `${message.count} times in last 15 minutes` }
        ]
      }],
      potentialAction: [{
        '@type': 'OpenUri',
        name: 'View Logs',
        targets: [{
          os: 'default',
          uri: `${process.env.LOG_VIEWER_URL || 'http://localhost:3001'}/logs?errorId=${message.errorId}`
        }]
      }]
    };

    try {
      const response = await fetch(process.env.TEAMS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamsMessage),
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        console.error('Teams notification failed:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to send Teams notification:', error.message);
    }
  }

  /**
   * Send notification via email (placeholder for email service integration)
   * @param {Object} message - Formatted error message
   * @param {Object} logError - Full error log object
   */
  async sendEmail(message, logError) {
    // This is a placeholder - integrate with your email service (SendGrid, Mailgun, AWS SES, etc.)
    
    const emailData = {
      to: process.env.ERROR_NOTIFICATION_EMAIL,
      from: process.env.ERROR_EMAIL_FROM || 'errors@shotspot.app',
      subject: `[${message.severity.toUpperCase()}] ShotSpot Error - ${message.error.type}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Error Notification</h2>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Severity:</strong> <span style="color: ${message.severity === 'critical' ? '#FF0000' : '#FF6600'};">${message.severity.toUpperCase()}</span></p>
            <p><strong>Error Type:</strong> ${message.error.type}</p>
            <p><strong>Status:</strong> ${message.error.status}</p>
            <p><strong>Message:</strong> ${message.error.message}</p>
            <p><strong>Path:</strong> ${message.request.method} ${message.request.path}</p>
            <p><strong>Error ID:</strong> ${message.errorId}</p>
            <p><strong>Timestamp:</strong> ${message.timestamp}</p>
            <p><strong>Environment:</strong> ${message.environment}</p>
            <p><strong>Occurrences:</strong> ${message.count} times in last 15 minutes</p>
          </div>
          <hr>
          <h3>Stack Trace</h3>
          <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto;">${logError.error.stack}</pre>
        </div>
      `
    };

    // TODO: Integrate with email service provider
    // Example implementations:
    // 
    // SendGrid:
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // await sgMail.send(emailData);
    //
    // Mailgun:
    // const mailgun = require('mailgun-js')({ apiKey: process.env.MAILGUN_API_KEY, domain: process.env.MAILGUN_DOMAIN });
    // await mailgun.messages().send(emailData);
    //
    // AWS SES:
    // const AWS = require('aws-sdk');
    // const ses = new AWS.SES();
    // await ses.sendEmail({ ... }).promise();
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 Email notification (not sent - email service not configured):', emailData.subject);
    }
  }
}

// Export singleton instance
export const errorNotificationService = new ErrorNotificationService();
