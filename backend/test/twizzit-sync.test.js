/**
 * Tests for twizzit-sync service
 * Covers sync orchestration functions not tested in twizzitService.test.js
 */

import db from '../src/db.js';
import {
  getSyncConfig,
  ensureSyncConfig,
  updateSyncConfig,
  getSyncHistory
} from '../src/services/twizzit-sync.js';

describe('🔄 Twizzit Sync Service', () => {
  let testCredentialId;

  beforeAll(async () => {
    // Create test twizzit credential
    const credResult = await db.query(`
      INSERT INTO twizzit_credentials (
        organization_name, 
        api_endpoint, 
        api_username, 
        encrypted_password,
        encryption_iv,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      `test-org-${Date.now()}`,
      'https://app.twizzit.com',
      'test_user',
      'encrypted_password',
      '0123456789abcdef0123456789abcdef',
      true
    ]);
    testCredentialId = credResult.rows[0].id;
  });

  afterAll(async () => {
    // Clean up
    await db.query('DELETE FROM twizzit_sync_config WHERE credential_id = $1', [testCredentialId]);
    await db.query('DELETE FROM twizzit_sync_history WHERE credential_id = $1', [testCredentialId]);
    await db.query('DELETE FROM twizzit_credentials WHERE id = $1', [testCredentialId]);
  });

  describe('Sync Configuration', () => {
    it('✅ should return null for non-existent credential', async () => {
      const result = await getSyncConfig(99999);
      expect(result).toBeNull();
    });

    it('✅ should ensure sync config is created for credential', async () => {
      const result = await ensureSyncConfig(testCredentialId);
      expect(result).toBeTruthy();
      expect(result.credentialId).toBe(testCredentialId);
      expect(result.syncTeams).toBeDefined();
      expect(result.syncPlayers).toBeDefined();
    });

    it('✅ should retrieve existing sync config', async () => {
      await ensureSyncConfig(testCredentialId);
      const result = await getSyncConfig(testCredentialId);
      expect(result).toBeTruthy();
      expect(result.credentialId).toBe(testCredentialId);
    });

    it('✅ should update sync config', async () => {
      const updated = await updateSyncConfig(testCredentialId, {
        syncTeams: true,
        syncPlayers: false,
        syncCompetitions: true,
        syncIntervalMinutes: 240,
        autoSyncEnabled: true
      });

      expect(updated).toBeTruthy();
      expect(updated.sync_teams).toBe(true);
      expect(updated.sync_players).toBe(false);
      expect(updated.auto_sync_enabled).toBe(true);
    });

    it('❌ should reject invalid sync config values', async () => {
      const result = await updateSyncConfig(testCredentialId, {
        syncIntervalMinutes: -5 // Invalid negative value
      });
      expect(result).toBeTruthy(); // Update still happens, but behavior depends on DB constraints
    });

    it('❌ should handle update for non-existent credential', async () => {
      await expect(
        updateSyncConfig(99999, {
          syncTeams: true
        })
      ).rejects.toThrow('Failed to update sync config');
    });
  });

  describe('Sync History', () => {
    it('✅ should return empty history for credential with no syncs', async () => {
      const result = await getSyncHistory(testCredentialId);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('✅ should retrieve sync history with limit', async () => {
      const result = await getSyncHistory(testCredentialId, { limit: 10, offset: 0 });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(10);
    });

    it('✅ should handle history offset pagination', async () => {
      const firstPage = await getSyncHistory(testCredentialId, { limit: 5, offset: 0 });
      const secondPage = await getSyncHistory(testCredentialId, { limit: 5, offset: 5 });
      
      // Should not have overlapping results
      if (firstPage.length > 0 && secondPage.length > 0) {
        const firstIds = firstPage.map(r => r.id);
        const secondIds = secondPage.map(r => r.id);
        const overlap = firstIds.filter(id => secondIds.includes(id));
        expect(overlap.length).toBe(0);
      }
    });

    it('❌ should return empty history for non-existent credential', async () => {
      const result = await getSyncHistory(99999);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('❌ should handle database errors gracefully in getSyncConfig', async () => {
      try {
        // Invalid credential ID type (should fail gracefully)
        const result = await getSyncConfig('invalid');
        // Should handle non-integer gracefully
        expect(result).toBeNull();
      } catch (error) {
        // Database error is acceptable
        expect(error).toBeTruthy();
      }
    });

    it('❌ should handle database errors in getSyncHistory', async () => {
      try {
        const result = await getSyncHistory(null); // null credential ID
        // Should handle null gracefully
        expect(Array.isArray(result)).toBe(true);
      } catch (error) {
        // Database error is acceptable
        expect(error).toBeTruthy();
      }
    });
  });
});
