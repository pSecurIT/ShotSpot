/**
 * Email Service Tests
 */

import { sendReportEmail, verifyEmailConfig } from '../src/services/emailService.js';

describe('📧 Email Service', () => {
  describe('sendReportEmail', () => {
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
  });

  describe('verifyEmailConfig', () => {
    it('✅ should return verified true in test environment', async () => {
      const result = await verifyEmailConfig();
      
      expect(result.verified).toBe(true);
      expect(result.message).toContain('Test environment');
    });
  });

  describe('Email Content Generation', () => {
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
  });
});


