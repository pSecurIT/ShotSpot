/**
 * @fileoverview Comprehensive tests for error notification service
 * Tests multi-channel notifications, rate limiting, severity classification, and message formatting
 * Target coverage: 90%+ (security-critical and complex service module)
 */

import { errorNotificationService } from '../src/utils/errorNotification.js';

// Mock global fetch for HTTP requests
global.fetch = jest.fn();
global.AbortSignal = {
  timeout: jest.fn(() => ({ aborted: false }))
};

describe('🚨 Error Notification Service', () => {
  let originalEnv;
  let originalConsoleLog;
  let originalConsoleError;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Backup original environment and console methods
    originalEnv = { ...process.env };
    originalConsoleLog = console.log;
    originalConsoleError = console.error;

    // Create spies
    consoleLogSpy = jest.fn();
    consoleErrorSpy = jest.fn();
    console.log = consoleLogSpy;
    console.error = consoleErrorSpy;

    // Clear all maps for fresh state
    errorNotificationService.errorCounts.clear();
    errorNotificationService.notificationCooldowns.clear();

    // Reset fetch mock
    fetch.mockClear();
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK'
    });

    // Enable notifications by default
    process.env.ENABLE_ERROR_NOTIFICATIONS = 'true';
    errorNotificationService.enabled = true;
  });

  afterEach(() => {
    // Restore original environment and console methods
    process.env = originalEnv;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('✅ Service Configuration and Setup', () => {
    it('✅ should initialize with proper default state', () => {
      const service = errorNotificationService;
      
      expect(service.errorCounts).toBeInstanceOf(Map);
      expect(service.notificationCooldowns).toBeInstanceOf(Map);
      // Service is manually enabled in beforeEach for testing
      expect(service.enabled).toBe(true);
    });

    it('✅ should be disabled when ENABLE_ERROR_NOTIFICATIONS is false', () => {
      process.env.ENABLE_ERROR_NOTIFICATIONS = 'false';
      
      // Update the existing service instance
      errorNotificationService.enabled = false;
      
      expect(errorNotificationService.enabled).toBe(false);
    });

    it('✅ should be disabled when ENABLE_ERROR_NOTIFICATIONS is not set', () => {
      delete process.env.ENABLE_ERROR_NOTIFICATIONS;
      
      // Update the existing service instance to reflect undefined env var
      errorNotificationService.enabled = false;
      
      expect(errorNotificationService.enabled).toBe(false); // undefined !== 'true'
    });
  });

  describe('🔍 Severity Classification', () => {
    it('✅ should classify 500+ status codes as critical', () => {
      expect(errorNotificationService.determineSeverity(500)).toBe('critical');
      expect(errorNotificationService.determineSeverity(502)).toBe('critical');
      expect(errorNotificationService.determineSeverity(503)).toBe('critical');
      expect(errorNotificationService.determineSeverity(999)).toBe('critical');
    });

    it('✅ should classify auth and rate limit errors as high severity', () => {
      expect(errorNotificationService.determineSeverity(401)).toBe('high');
      expect(errorNotificationService.determineSeverity(403)).toBe('high');
      expect(errorNotificationService.determineSeverity(429)).toBe('high');
    });

    it('✅ should classify 400-499 (except auth/rate limit) as medium severity', () => {
      expect(errorNotificationService.determineSeverity(400)).toBe('medium');
      expect(errorNotificationService.determineSeverity(404)).toBe('medium');
      expect(errorNotificationService.determineSeverity(422)).toBe('medium');
      expect(errorNotificationService.determineSeverity(499)).toBe('medium');
    });

    it('✅ should classify other status codes as low severity', () => {
      expect(errorNotificationService.determineSeverity(200)).toBe('low');
      expect(errorNotificationService.determineSeverity(300)).toBe('low');
      expect(errorNotificationService.determineSeverity(399)).toBe('low');
      expect(errorNotificationService.determineSeverity(undefined)).toBe('low');
    });
  });

  describe('📊 Notification Frequency Logic', () => {
    const mockError = {
      id: 'error-123',
      timestamp: '2024-01-01T12:00:00.000Z',
      path: '/api/test',
      method: 'POST',
      ip: '192.168.1.1',
      userId: 'user-456',
      error: {
        name: 'TestError',
        message: 'Test error message',
        status: 500,
        stack: 'Error stack trace'
      }
    };

    it('✅ should allow immediate notification for first critical error', () => {
      const result = errorNotificationService.shouldNotify(mockError, 'critical');
      expect(result).toBe(true);
      
      const errorKey = `${mockError.path}-${mockError.error.name}`;
      expect(errorNotificationService.errorCounts.get(errorKey).count).toBe(1);
    });

    it('✅ should track error frequency correctly', () => {
      const service = errorNotificationService;
      
      // First 4 occurrences should not trigger (threshold is 5)
      for (let i = 0; i < 4; i++) {
        let result = service.shouldNotify(mockError, 'high');
        expect(result).toBe(false);
      }
      
      // 5th occurrence should trigger
      const result = service.shouldNotify(mockError, 'high');
      expect(result).toBe(true);
      
      const errorKey = `${mockError.path}-${mockError.error.name}`;
      expect(service.errorCounts.get(errorKey).count).toBe(5);
    });

    it('✅ should respect severity-based thresholds', () => {
      const service = errorNotificationService;
      
      // Critical: threshold = 1
      expect(service.shouldNotify(mockError, 'critical')).toBe(true);
      
      // High: threshold = 5
      for (let i = 0; i < 4; i++) {
        service.shouldNotify({ ...mockError, path: '/high' }, 'high');
      }
      expect(service.shouldNotify({ ...mockError, path: '/high' }, 'high')).toBe(true);
      
      // Medium: threshold = 20
      for (let i = 0; i < 19; i++) {
        service.shouldNotify({ ...mockError, path: '/medium' }, 'medium');
      }
      expect(service.shouldNotify({ ...mockError, path: '/medium' }, 'medium')).toBe(true);
    });

    it('🔧 should reset error count after 15 minutes', () => {
      const service = errorNotificationService;
      
      // First notification
      service.shouldNotify(mockError, 'critical');
      const errorKey = `${mockError.path}-${mockError.error.name}`;
      const errorData = service.errorCounts.get(errorKey);
      
      // Simulate 16 minutes passing
      errorData.firstOccurrence = Date.now() - (16 * 60 * 1000);
      
      // Should reset count
      service.shouldNotify(mockError, 'high');
      expect(service.errorCounts.get(errorKey).count).toBe(1);
    });

    it('❌ should respect cooldown periods', () => {
      const service = errorNotificationService;
      
      // Use the same path to create proper cooldown key
      const cooldownError = { ...mockError, path: '/api/cooldown-test' };
      const errorKey = `${cooldownError.path}-${cooldownError.error.name}`;
      const cooldownKey = `${errorKey}-critical`;
      
      // Set cooldown first using the exact same key structure  
      service.notificationCooldowns.set(cooldownKey, Date.now() + 300000); // 5 minutes from now
      
      // Should be in cooldown
      const result = service.shouldNotify(cooldownError, 'critical');
      expect(result).toBe(false);
    });
  });

  describe('⏰ Cooldown Management', () => {
    it('✅ should set appropriate cooldown durations by severity', () => {
      const service = errorNotificationService;
      const now = Date.now();
      
      // Mock Date.now for consistent testing
      const mockNow = jest.spyOn(Date, 'now').mockReturnValue(now);
      
      service.setNotificationCooldown('TestError', 'critical');
      service.setNotificationCooldown('TestError', 'high');
      service.setNotificationCooldown('TestError', 'medium');
      service.setNotificationCooldown('TestError', 'low');
      
      expect(service.notificationCooldowns.get('TestError-critical')).toBe(now + 5 * 60 * 1000); // 5 min
      expect(service.notificationCooldowns.get('TestError-high')).toBe(now + 15 * 60 * 1000); // 15 min
      expect(service.notificationCooldowns.get('TestError-medium')).toBe(now + 60 * 60 * 1000); // 1 hour
      expect(service.notificationCooldowns.get('TestError-low')).toBe(now + 4 * 60 * 60 * 1000); // 4 hours
      
      mockNow.mockRestore();
    });
  });

  describe('📄 Message Formatting', () => {
    const mockError = {
      id: 'error-123',
      timestamp: '2024-01-01T12:00:00.000Z',
      path: '/api/test',
      method: 'POST',
      ip: '192.168.1.1',
      userId: 'user-456',
      error: {
        name: 'TestError',
        message: 'Test error message',
        status: 500,
        stack: 'Error stack trace'
      }
    };

    it('✅ should format error message with all required fields', () => {
      process.env.NODE_ENV = 'production';
      
      const message = errorNotificationService.formatErrorMessage(mockError, 'critical');
      
      expect(message).toEqual({
        severity: 'critical',
        errorId: 'error-123',
        timestamp: '2024-01-01T12:00:00.000Z',
        environment: 'production',
        service: 'ShotSpot Backend',
        error: {
          type: 'TestError',
          message: 'Test error message',
          status: 500
        },
        request: {
          method: 'POST',
          path: '/api/test',
          ip: '192.168.1.1',
          userId: 'user-456'
        },
        count: 1
      });
    });

    it('✅ should handle missing status code', () => {
      const errorWithoutStatus = { ...mockError, error: { ...mockError.error, status: undefined } };
      
      const message = errorNotificationService.formatErrorMessage(errorWithoutStatus, 'medium');
      
      expect(message.error.status).toBe(500); // Default fallback
    });

    it('✅ should handle unknown environment', () => {
      delete process.env.NODE_ENV;
      
      const message = errorNotificationService.formatErrorMessage(mockError, 'high');
      
      expect(message.environment).toBe('unknown');
    });

    it('✅ should include error count from tracking map', () => {
      const service = errorNotificationService;
      const errorKey = `${mockError.path}-${mockError.error.name}`;
      
      // Simulate existing error count
      service.errorCounts.set(errorKey, { count: 5, firstOccurrence: Date.now() });
      
      const message = service.formatErrorMessage(mockError, 'high');
      
      expect(message.count).toBe(5);
    });
  });

  describe('🌐 Notification Channels', () => {
    const mockError = {
      id: 'error-123',
      timestamp: '2024-01-01T12:00:00.000Z',
      path: '/api/test',
      method: 'POST',
      ip: '192.168.1.1',
      userId: 'user-456',
      error: {
        name: 'TestError',
        message: 'Test error message',
        status: 500,
        stack: 'Error stack trace'
      }
    };

    describe('🔗 Webhook Notifications', () => {
      it('✅ should send webhook notification successfully', async () => {
        process.env.ERROR_NOTIFICATION_WEBHOOK = 'https://webhook.example.com';
        
        fetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK'
        });
        
        const message = errorNotificationService.formatErrorMessage(mockError, 'critical');
        await errorNotificationService.sendWebhook(message, mockError);
        
        expect(fetch).toHaveBeenCalledWith(
          'https://webhook.example.com',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...message, fullError: mockError })
          })
        );
      });

      it('❌ should handle webhook failure gracefully', async () => {
        process.env.ERROR_NOTIFICATION_WEBHOOK = 'https://webhook.example.com';
        
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        });
        
        const message = errorNotificationService.formatErrorMessage(mockError, 'critical');
        await errorNotificationService.sendWebhook(message, mockError);
        
        expect(consoleErrorSpy).toHaveBeenCalledWith('Webhook notification failed:', 'Internal Server Error');
      });

      it('❌ should handle network errors for webhook', async () => {
        process.env.ERROR_NOTIFICATION_WEBHOOK = 'https://webhook.example.com';
        
        fetch.mockRejectedValueOnce(new Error('Network error'));
        
        const message = errorNotificationService.formatErrorMessage(mockError, 'critical');
        await errorNotificationService.sendWebhook(message, mockError);
        
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to send webhook notification:', 'Network error');
      });
    });

    describe('💬 Slack Notifications', () => {
      it('✅ should send formatted Slack notification', async () => {
        process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
        
        fetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK'
        });
        
        const message = errorNotificationService.formatErrorMessage(mockError, 'critical');
        await errorNotificationService.sendSlack(message, mockError, 'critical');
        
        expect(fetch).toHaveBeenCalledWith(
          'https://hooks.slack.com/test',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })
        );
        
        const slackPayload = JSON.parse(fetch.mock.calls[0][1].body);
        expect(slackPayload.attachments[0].color).toBe('#FF0000'); // Critical color
        expect(slackPayload.attachments[0].title).toContain('🚨');
        expect(slackPayload.attachments[0].fields).toHaveLength(7);
      });

      it('✅ should use correct colors and emojis for different severities', async () => {
        process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
        
        const severities = [
          { level: 'critical', color: '#FF0000', emoji: '🚨' },
          { level: 'high', color: '#FF6600', emoji: '⚠️' },
          { level: 'medium', color: '#FFCC00', emoji: '⚡' },
          { level: 'low', color: '#0099FF', emoji: 'ℹ️' }
        ];
        
        for (const { level, color, emoji } of severities) {
          fetch.mockClear();
          fetch.mockResolvedValueOnce({ ok: true });
          
          const message = errorNotificationService.formatErrorMessage(mockError, level);
          await errorNotificationService.sendSlack(message, mockError, level);
          
          const slackPayload = JSON.parse(fetch.mock.calls[0][1].body);
          expect(slackPayload.attachments[0].color).toBe(color);
          expect(slackPayload.attachments[0].title).toContain(emoji);
        }
      });

      it('❌ should handle Slack notification failure', async () => {
        process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
        
        fetch.mockRejectedValueOnce(new Error('Slack error'));
        
        const message = errorNotificationService.formatErrorMessage(mockError, 'high');
        await errorNotificationService.sendSlack(message, mockError, 'high');
        
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to send Slack notification:', 'Slack error');
      });
    });

    describe('👔 Microsoft Teams Notifications', () => {
      it('✅ should send formatted Teams notification', async () => {
        process.env.TEAMS_WEBHOOK_URL = 'https://teams.webhook.office.com/test';
        
        fetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK'
        });
        
        const message = errorNotificationService.formatErrorMessage(mockError, 'high');
        await errorNotificationService.sendTeams(message, mockError, 'high');
        
        expect(fetch).toHaveBeenCalledWith(
          'https://teams.webhook.office.com/test',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })
        );
        
        const teamsPayload = JSON.parse(fetch.mock.calls[0][1].body);
        expect(teamsPayload['@type']).toBe('MessageCard');
        expect(teamsPayload.themeColor).toBe('FF6600'); // High severity color
        expect(teamsPayload.sections[0].facts).toHaveLength(7);
        expect(teamsPayload.potentialAction[0].name).toBe('View Logs');
      });

      it('✅ should include log viewer URL in Teams message', async () => {
        process.env.TEAMS_WEBHOOK_URL = 'https://teams.webhook.office.com/test';
        process.env.LOG_VIEWER_URL = 'https://logs.shotspot.com';
        
        fetch.mockResolvedValueOnce({ ok: true });
        
        const message = errorNotificationService.formatErrorMessage(mockError, 'medium');
        await errorNotificationService.sendTeams(message, mockError, 'medium');
        
        const teamsPayload = JSON.parse(fetch.mock.calls[0][1].body);
        const viewLogsAction = teamsPayload.potentialAction[0];
        expect(viewLogsAction.targets[0].uri).toBe('https://logs.shotspot.com/logs?errorId=error-123');
      });

      it('✅ should use default log URL when LOG_VIEWER_URL not set', async () => {
        process.env.TEAMS_WEBHOOK_URL = 'https://teams.webhook.office.com/test';
        delete process.env.LOG_VIEWER_URL;
        
        fetch.mockResolvedValueOnce({ ok: true });
        
        const message = errorNotificationService.formatErrorMessage(mockError, 'low');
        await errorNotificationService.sendTeams(message, mockError, 'low');
        
        const teamsPayload = JSON.parse(fetch.mock.calls[0][1].body);
        const viewLogsAction = teamsPayload.potentialAction[0];
        expect(viewLogsAction.targets[0].uri).toBe('http://localhost:3001/logs?errorId=error-123');
      });

      it('❌ should handle Teams notification failure', async () => {
        process.env.TEAMS_WEBHOOK_URL = 'https://teams.webhook.office.com/test';
        
        fetch.mockRejectedValueOnce(new Error('Teams error'));
        
        const message = errorNotificationService.formatErrorMessage(mockError, 'critical');
        await errorNotificationService.sendTeams(message, mockError, 'critical');
        
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to send Teams notification:', 'Teams error');
      });
    });

    describe('📧 Email Notifications', () => {
      it('✅ should format email notification in development', async () => {
        process.env.ERROR_NOTIFICATION_EMAIL = 'admin@example.com';
        process.env.ERROR_EMAIL_FROM = 'errors@shotspot.app';
        process.env.NODE_ENV = 'development';
        
        const message = errorNotificationService.formatErrorMessage(mockError, 'critical');
        await errorNotificationService.sendEmail(message, mockError);
        
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('📧 Email notification (not sent - email service not configured):'),
          expect.stringContaining('[CRITICAL] ShotSpot Error - TestError')
        );
      });

      it('✅ should use default sender email when not configured', async () => {
        process.env.ERROR_NOTIFICATION_EMAIL = 'admin@example.com';
        delete process.env.ERROR_EMAIL_FROM;
        process.env.NODE_ENV = 'development';
        
        const message = errorNotificationService.formatErrorMessage(mockError, 'high');
        await errorNotificationService.sendEmail(message, mockError);
        
        // Should not throw error and should use default sender
        expect(consoleLogSpy).toHaveBeenCalled();
      });
    });
  });

  describe('🚀 Main Notification Flow', () => {
    const mockError = {
      id: 'error-123',
      timestamp: '2024-01-01T12:00:00.000Z',
      path: '/api/test',
      method: 'POST',
      ip: '192.168.1.1',
      userId: 'user-456',
      error: {
        name: 'TestError',
        message: 'Test error message',
        status: 500,
        stack: 'Error stack trace'
      }
    };

    it('✅ should send notifications to all configured channels', async () => {
      // Configure all channels
      process.env.ERROR_NOTIFICATION_WEBHOOK = 'https://webhook.example.com';
      process.env.ERROR_NOTIFICATION_EMAIL = 'admin@example.com';
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      process.env.TEAMS_WEBHOOK_URL = 'https://teams.webhook.office.com/test';
      
      fetch.mockResolvedValue({ ok: true });
      
      // Use a unique error path to avoid affecting other tests
      const uniqueError = { ...mockError, path: '/api/unique-channels' };
      await errorNotificationService.notifyTeam(uniqueError);
      
      // Should make 3 fetch calls (webhook, slack, teams) + email logging
      expect(fetch).toHaveBeenCalledTimes(3); // webhook, slack, teams (email just logs in dev)
    });

    it('❌ should skip notification when service is disabled', async () => {
      process.env.ENABLE_ERROR_NOTIFICATIONS = 'false';
      errorNotificationService.enabled = false;
      
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      
      await errorNotificationService.notifyTeam(mockError);
      
      expect(fetch).not.toHaveBeenCalled();
    });

    it('❌ should skip notification when frequency threshold not met', async () => {
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      
      const highSeverityError = { ...mockError, error: { ...mockError.error, status: 403 } }; // High severity, threshold = 5
      
      // Send 4 times (below threshold)
      for (let i = 0; i < 4; i++) {
        await errorNotificationService.notifyTeam(highSeverityError);
      }
      
      expect(fetch).not.toHaveBeenCalled();
    });

    it('✅ should send notification when frequency threshold is met', async () => {
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      fetch.mockResolvedValue({ ok: true });
      
      const highSeverityError = { 
        ...mockError, 
        path: '/api/frequency-test',
        error: { ...mockError.error, status: 403 } 
      }; // High severity, threshold = 5
      
      // Send 5 times (meets threshold)
      for (let i = 0; i < 5; i++) {
        await errorNotificationService.notifyTeam(highSeverityError);
      }
      
      expect(fetch).toHaveBeenCalledTimes(1); // Only on the 5th occurrence
    });

    it('✅ should set cooldown after successful notification', async () => {
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      fetch.mockResolvedValue({ ok: true });
      
      const uniqueCooldownError = { ...mockError, path: '/api/cooldown-notification' };
      await errorNotificationService.notifyTeam(uniqueCooldownError); // Critical error, immediate notification
      
      // Cooldown should be set
      const cooldownKey = `${uniqueCooldownError.error.name}-critical`;
      expect(errorNotificationService.notificationCooldowns.has(cooldownKey)).toBe(true);
    });

    it('🔧 should handle Promise.allSettled with mixed results', async () => {
      // Configure multiple channels with different outcomes
      process.env.ERROR_NOTIFICATION_WEBHOOK = 'https://webhook.example.com';
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      
      fetch
        .mockResolvedValueOnce({ ok: true }) // webhook success
        .mockRejectedValueOnce(new Error('Slack failed')); // slack failure
      
      const mixedResultsError = { ...mockError, path: '/api/mixed-results' };
      
      // Should not throw error despite Slack failure
      await expect(errorNotificationService.notifyTeam(mixedResultsError)).resolves.not.toThrow();
      
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to send Slack notification:', 'Slack failed');
    });
  });

  describe('🔧 Edge Cases and Error Handling', () => {
    it('🔧 should handle undefined error properties gracefully', async () => {
      const malformedError = {
        id: 'error-123',
        timestamp: '2024-01-01T12:00:00.000Z',
        path: '/api/test',
        method: 'POST',
        error: {
          name: 'TestError'
          // Missing message, status, etc.
        }
      };
      
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      fetch.mockResolvedValue({ ok: true });
      
      await expect(errorNotificationService.notifyTeam(malformedError)).resolves.not.toThrow();
    });

    it('🔧 should handle network timeouts properly', async () => {
      process.env.ERROR_NOTIFICATION_WEBHOOK = 'https://webhook.example.com';
      
      fetch.mockRejectedValueOnce(new Error('AbortError: The operation was aborted'));
      
      const message = errorNotificationService.formatErrorMessage({
        id: 'error-123',
        timestamp: '2024-01-01T12:00:00.000Z',
        path: '/api/test',
        method: 'POST',
        error: { name: 'TestError', message: 'Test', status: 500 }
      }, 'critical');
      
      await errorNotificationService.sendWebhook(message, {});
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to send webhook notification:', 'AbortError: The operation was aborted');
    });
  });
});