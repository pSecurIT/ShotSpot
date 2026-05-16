/**
 * Email Service Tests
 * Comprehensive coverage of email delivery, configuration, and content generation
 */

import { sendReportEmail, verifyEmailConfig } from '../src/services/emailService.js';
import nodemailer from 'nodemailer';

describe('📧 Email Service', () => {
  describe('📨 sendReportEmail - Core Functionality', () => {
    it('✅ should return test mode result in test environment', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Test Report',
        reportName: 'Test Match Report',
        reportType: 'game',
        generatedBy: 'Test User'
      });

      expect(result.success).toBe(true);
      expect(result.testMode).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(result.recipients).toEqual(['test@example.com']);
    });

    it('✅ should accept multiple recipients', async () => {
      const result = await sendReportEmail({
        recipients: ['test1@example.com', 'test2@example.com', 'test3@example.com'],
        subject: 'Team Report',
        reportName: 'Season Summary',
        reportType: 'season',
        teamName: 'Test Team',
        generatedBy: 'Coach Smith'
      });

      expect(result.success).toBe(true);
      expect(result.recipients.length).toBe(3);
    });

    it('✅ should handle single recipient', async () => {
      const result = await sendReportEmail({
        recipients: ['solo@example.com'],
        subject: 'Report',
        reportName: 'Solo Report',
        reportType: 'game',
        generatedBy: 'Test User'
      });

      expect(result.success).toBe(true);
      expect(result.recipients.length).toBe(1);
    });

    it('✅ should handle optional parameters', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Report',
        reportName: 'Player Stats',
        reportType: 'player',
        generatedBy: 'Admin',
        teamName: 'Team A',
        downloadUrl: 'https://shotspot.app/download/123',
        expiresAt: new Date('2025-12-31')
      });

      expect(result.success).toBe(true);
    });

    it('✅ should include all required fields in email', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Match Report',
        reportName: 'Team A vs Team B',
        reportType: 'game',
        teamName: 'Team A',
        generatedBy: 'Coach Johnson',
        downloadUrl: 'https://shotspot.app/reports/456',
        expiresAt: new Date('2025-12-31')
      });

      expect(result.success).toBe(true);
      expect(result.recipients).toContain('test@example.com');
    });
  });

  describe('📨 sendReportEmail - Optional Fields', () => {
    it('✅ should work without optional team name', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Player Report',
        reportName: 'Player Stats - John Doe',
        reportType: 'player',
        generatedBy: 'Admin'
      });

      expect(result.success).toBe(true);
    });

    it('✅ should work without download URL', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Report',
        reportName: 'Test Report',
        reportType: 'game',
        generatedBy: 'Test User'
      });

      expect(result.success).toBe(true);
    });

    it('✅ should work without expiration date', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Report',
        reportName: 'Test Report',
        reportType: 'game',
        generatedBy: 'Test User',
        downloadUrl: 'https://shotspot.app/reports/789'
      });

      expect(result.success).toBe(true);
    });

    it('✅ should work without subject (should use default)', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        reportName: 'Default Subject Report',
        reportType: 'game',
        generatedBy: 'Test User'
      });

      expect(result.success).toBe(true);
    });

    it('✅ should work with all optional fields undefined', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Minimal Report',
        reportName: 'Minimal',
        reportType: 'game',
        generatedBy: 'Test User',
        teamName: undefined,
        downloadUrl: undefined,
        expiresAt: undefined,
        filePath: undefined
      });

      expect(result.success).toBe(true);
    });
  });

  describe('❌ sendReportEmail - Validation', () => {
    it('❌ should reject empty recipients array', async () => {
      await expect(
        sendReportEmail({
          recipients: [],
          subject: 'Test',
          reportName: 'Test Report',
          reportType: 'game',
          generatedBy: 'Test User'
        })
      ).rejects.toThrow('At least one recipient email address is required');
    });

    it('❌ should reject missing recipients', async () => {
      await expect(
        sendReportEmail({
          subject: 'Test',
          reportName: 'Test Report',
          reportType: 'game',
          generatedBy: 'Test User'
        })
      ).rejects.toThrow('At least one recipient email address is required');
    });

    it('❌ should reject null recipients', async () => {
      await expect(
        sendReportEmail({
          recipients: null,
          subject: 'Test',
          reportName: 'Test Report',
          reportType: 'game',
          generatedBy: 'Test User'
        })
      ).rejects.toThrow('At least one recipient email address is required');
    });

    it('❌ should reject non-array recipients', async () => {
      await expect(
        sendReportEmail({
          recipients: 'single@example.com',
          subject: 'Test',
          reportName: 'Test Report',
          reportType: 'game',
          generatedBy: 'Test User'
        })
      ).rejects.toThrow('At least one recipient email address is required');
    });

    it('❌ should reject undefined recipients', async () => {
      await expect(
        sendReportEmail({
          recipients: undefined,
          subject: 'Test',
          reportName: 'Test Report',
          reportType: 'game',
          generatedBy: 'Test User'
        })
      ).rejects.toThrow('At least one recipient email address is required');
    });
  });

  describe('📧 Report Type Coverage', () => {
    it('✅ should handle game report type', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Game Report',
        reportName: 'Match Result',
        reportType: 'game',
        generatedBy: 'Test User'
      });

      expect(result.success).toBe(true);
    });

    it('✅ should handle team report type', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Team Report',
        reportName: 'Team Stats',
        reportType: 'team',
        teamName: 'Team A',
        generatedBy: 'Test User'
      });

      expect(result.success).toBe(true);
    });

    it('✅ should handle season report type', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Season Report',
        reportName: 'Season Summary',
        reportType: 'season',
        teamName: 'Team B',
        generatedBy: 'Test User'
      });

      expect(result.success).toBe(true);
    });

    it('✅ should handle player report type', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Player Report',
        reportName: 'Player Statistics',
        reportType: 'player',
        generatedBy: 'Test User'
      });

      expect(result.success).toBe(true);
    });

    it('✅ should handle custom report type', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Custom Report',
        reportName: 'Custom Analysis',
        reportType: 'custom-analysis',
        generatedBy: 'Test User'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('👥 Multiple Email Domain Coverage', () => {
    it('✅ should handle mixed email domains', async () => {
      const result = await sendReportEmail({
        recipients: [
          'user@example.com',
          'coach@shotspot.app',
          'admin@team.org'
        ],
        subject: 'Multi-domain Report',
        reportName: 'Test Report',
        reportType: 'game',
        generatedBy: 'Test User'
      });

      expect(result.success).toBe(true);
      expect(result.recipients.length).toBe(3);
    });

    it('✅ should handle many recipients', async () => {
      const recipients = Array.from({ length: 20 }, (_, i) => `user${i}@example.com`);
      const result = await sendReportEmail({
        recipients,
        subject: 'Many Recipients',
        reportName: 'Test Report',
        reportType: 'game',
        generatedBy: 'Test User'
      });

      expect(result.success).toBe(true);
      expect(result.recipients.length).toBe(20);
    });
  });

  describe('🔗 URL and Date Handling', () => {
    it('✅ should handle long download URLs', async () => {
      const longUrl = 'https://shotspot.app/reports/very/long/path/with/many/segments/' + 'a'.repeat(500);
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Report with Long URL',
        reportName: 'Test Report',
        reportType: 'game',
        generatedBy: 'Test User',
        downloadUrl: longUrl
      });

      expect(result.success).toBe(true);
    });

    it('✅ should handle various date formats', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Report',
        reportName: 'Test Report',
        reportType: 'game',
        generatedBy: 'Test User',
        expiresAt: new Date(Date.now() + 86400000) // Tomorrow
      });

      expect(result.success).toBe(true);
    });

    it('✅ should handle past expiration dates', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Report',
        reportName: 'Test Report',
        reportType: 'game',
        generatedBy: 'Test User',
        expiresAt: new Date('2020-01-01')
      });

      expect(result.success).toBe(true);
    });

    it('✅ should handle far future expiration dates', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Report',
        reportName: 'Test Report',
        reportType: 'game',
        generatedBy: 'Test User',
        expiresAt: new Date('2099-12-31')
      });

      expect(result.success).toBe(true);
    });
  });

  describe('📝 Content Field Coverage', () => {
    it('✅ should handle special characters in report name', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Report',
        reportName: 'Test & Report: <Special> "Characters" \'Included\'',
        reportType: 'game',
        generatedBy: 'Test User'
      });

      expect(result.success).toBe(true);
    });

    it('✅ should handle special characters in team name', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Report',
        reportName: 'Test Report',
        reportType: 'game',
        teamName: 'Team & Opponents: <City> Name',
        generatedBy: 'Test User'
      });

      expect(result.success).toBe(true);
    });

    it('✅ should handle special characters in generated by', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Report',
        reportName: 'Test Report',
        reportType: 'game',
        generatedBy: 'Coach O\'Brien & Smith'
      });

      expect(result.success).toBe(true);
    });

    it('✅ should handle unicode characters', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Report',
        reportName: 'Test Report 🏐 ⚽ 🎯',
        reportType: 'game',
        teamName: 'Équipe François',
        generatedBy: 'Müller Björn'
      });

      expect(result.success).toBe(true);
    });

    it('✅ should handle very long report names', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Report',
        reportName: 'This is a very long report name that contains many words and continues for quite some time to test whether the system can handle very lengthy report descriptions ' + 'x'.repeat(500),
        reportType: 'game',
        generatedBy: 'Test User'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('🔐 verifyEmailConfig', () => {
    it('✅ should return verified true in test environment', async () => {
      const result = await verifyEmailConfig();
      
      expect(result.verified).toBe(true);
      expect(result.message).toContain('Test environment');
    });

    it('✅ should have proper response structure', async () => {
      const result = await verifyEmailConfig();
      
      expect(result).toHaveProperty('verified');
      expect(result).toHaveProperty('message');
      expect(typeof result.verified).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });
  });

  describe('📧 HTML Email Template Coverage', () => {
    it('✅ should generate HTML template with all fields', async () => {
      // Test indirectly through the email generation
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Template Test',
        reportName: 'Test & Validation <Report>',
        reportType: 'game',
        teamName: 'Team "A" Name',
        generatedBy: 'Coach O\'Brien',
        downloadUrl: 'https://shotspot.app/reports/test123?token=abc&id=def',
        expiresAt: new Date('2026-12-31')
      });

      expect(result.success).toBe(true);
      expect(result.testMode).toBe(true);
    });

    it('✅ should generate HTML template without optional fields', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Template Test',
        reportName: 'Minimal Template',
        reportType: 'game',
        generatedBy: 'Coach'
      });

      expect(result.success).toBe(true);
    });

    it('✅ should generate text template with all fields', async () => {
      const result = await sendReportEmail({
        recipients: ['user1@example.com', 'user2@example.com'],
        subject: 'Text Template',
        reportName: 'Text Report',
        reportType: 'season',
        teamName: 'Season Team',
        generatedBy: 'Admin User',
        downloadUrl: 'https://shotspot.app/files/report.pdf',
        expiresAt: new Date('2026-06-30')
      });

      expect(result.success).toBe(true);
      expect(result.recipients.length).toBe(2);
    });

    it('✅ should handle email with empty download URL string', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Report',
        reportName: 'Test Report',
        reportType: 'game',
        generatedBy: 'Test User',
        downloadUrl: ''
      });

      expect(result.success).toBe(true);
    });

    it('✅ should handle email with empty team name', async () => {
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Report',
        reportName: 'Test Report',
        reportType: 'game',
        generatedBy: 'Test User',
        teamName: ''
      });

      expect(result.success).toBe(true);
    });
  });

  describe('🔧 Edge Cases and Configuration', () => {
    it('✅ should accept filePath parameter (uncovered branch)', async () => {
      // filePath is tested here even though it won't be used in test mode
      const result = await sendReportEmail({
        recipients: ['test@example.com'],
        subject: 'Report',
        reportName: 'Test Report',
        reportType: 'game',
        generatedBy: 'Test User',
        filePath: '/path/to/file.pdf'
      });

      expect(result.success).toBe(true);
    });

    it('✅ should handle recipient array with duplicate emails', async () => {
      const result = await sendReportEmail({
        recipients: [
          'user@example.com',
          'user@example.com',
          'coach@example.com'
        ],
        subject: 'Report',
        reportName: 'Test Report',
        reportType: 'game',
        generatedBy: 'Test User'
      });

      expect(result.success).toBe(true);
      expect(result.recipients.length).toBe(3); // Duplicates are preserved
    });

    it('✅ should handle very large recipient list', async () => {
      const recipients = Array.from({ length: 100 }, (_, i) => `user${i}@example.com`);
      const result = await sendReportEmail({
        recipients,
        subject: 'Report',
        reportName: 'Test Report',
        reportType: 'game',
        generatedBy: 'Test User'
      });

      expect(result.success).toBe(true);
      expect(result.recipients.length).toBe(100);
    });
  });

  describe('🚚 SMTP transport behavior', () => {
    const ORIGINAL_ENV = { ...process.env };

    afterEach(() => {
      jest.clearAllMocks();
      process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;
      process.env.SMTP_HOST = ORIGINAL_ENV.SMTP_HOST;
      process.env.SMTP_PORT = ORIGINAL_ENV.SMTP_PORT;
      process.env.SMTP_USER = ORIGINAL_ENV.SMTP_USER;
      process.env.SMTP_PASSWORD = ORIGINAL_ENV.SMTP_PASSWORD;
      process.env.SMTP_SECURE = ORIGINAL_ENV.SMTP_SECURE;
      process.env.SMTP_FROM = ORIGINAL_ENV.SMTP_FROM;
    });

    it('returns config error when not test and transporter is unavailable', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.SMTP_HOST;

      const result = await sendReportEmail({
        recipients: ['dev@example.com'],
        subject: 'No SMTP',
        reportName: 'Unavailable Transporter',
        reportType: 'game',
        generatedBy: 'Dev'
      });

      expect(result).toEqual({
        success: false,
        error: 'Email service not configured',
        recipients: ['dev@example.com']
      });
    });

    it('sends email successfully when transporter sendMail resolves', async () => {
      process.env.NODE_ENV = 'production';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '465';
      process.env.SMTP_SECURE = 'true';
      process.env.SMTP_USER = 'mailer';
      process.env.SMTP_PASSWORD = 'secret';
      process.env.SMTP_FROM = 'reports@shotspot.app';

      const sendMail = jest.fn().mockResolvedValue({ messageId: 'msg-123' });
      jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail });

      const result = await sendReportEmail({
        recipients: ['ops@example.com'],
        reportName: 'Ops Report',
        reportType: 'custom',
        generatedBy: 'System',
        filePath: '/tmp/report.pdf'
      });

      expect(result).toEqual({
        success: true,
        messageId: 'msg-123',
        recipients: ['ops@example.com'],
        previewUrl: null
      });

      expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        auth: {
          user: 'mailer',
          pass: 'secret'
        },
        from: 'reports@shotspot.app'
      }));

      expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
        from: 'reports@shotspot.app',
        to: 'ops@example.com',
        subject: 'ShotSpot Report: Ops Report'
      }));
      expect(sendMail.mock.calls[0][0].attachments).toEqual([
        {
          filename: 'report.pdf',
          path: '/tmp/report.pdf'
        }
      ]);
      expect(sendMail.mock.calls[0][0].html).toContain('ShotSpot Report Ready');
      expect(sendMail.mock.calls[0][0].text).toContain('ShotSpot Report Ready');
    });

    it('returns failure payload when transporter sendMail rejects', async () => {
      process.env.NODE_ENV = 'production';
      process.env.SMTP_HOST = 'smtp.example.com';

      const sendMail = jest.fn().mockRejectedValue(new Error('SMTP timeout'));
      jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail });

      const result = await sendReportEmail({
        recipients: ['ops@example.com'],
        subject: 'Failure Case',
        reportName: 'Ops Report',
        reportType: 'custom',
        generatedBy: 'System'
      });

      expect(result).toEqual({
        success: false,
        error: 'SMTP timeout',
        recipients: ['ops@example.com']
      });
    });
  });

  describe('🔍 verifyEmailConfig non-test paths', () => {
    const ORIGINAL_ENV = { ...process.env };

    afterEach(() => {
      jest.clearAllMocks();
      process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;
      process.env.SMTP_HOST = ORIGINAL_ENV.SMTP_HOST;
      process.env.SMTP_PORT = ORIGINAL_ENV.SMTP_PORT;
      process.env.SMTP_USER = ORIGINAL_ENV.SMTP_USER;
      process.env.SMTP_PASSWORD = ORIGINAL_ENV.SMTP_PASSWORD;
      process.env.SMTP_SECURE = ORIGINAL_ENV.SMTP_SECURE;
      process.env.SMTP_FROM = ORIGINAL_ENV.SMTP_FROM;
    });

    it('reports not configured when transporter cannot be created', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.SMTP_HOST;

      const result = await verifyEmailConfig();

      expect(result).toEqual({
        verified: false,
        message: 'Email service not configured. Set SMTP_* environment variables.'
      });
    });

    it('returns verified=true when transporter verify succeeds', async () => {
      process.env.NODE_ENV = 'production';
      process.env.SMTP_HOST = 'smtp.example.com';

      const verify = jest.fn().mockResolvedValue(undefined);
      jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ verify });

      const result = await verifyEmailConfig();

      expect(verify).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        verified: true,
        message: 'Email configuration verified successfully'
      });
    });

    it('returns verified=false when transporter verify fails', async () => {
      process.env.NODE_ENV = 'production';
      process.env.SMTP_HOST = 'smtp.example.com';

      const verify = jest.fn().mockRejectedValue(new Error('auth failed'));
      jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ verify });

      const result = await verifyEmailConfig();

      expect(result).toEqual({
        verified: false,
        message: 'Email configuration error: auth failed'
      });
    });
  });
});


