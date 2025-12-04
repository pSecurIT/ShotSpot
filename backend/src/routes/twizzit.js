/**
 * Twizzit Integration API Routes
 * Admin-only endpoints for configuring and managing Twizzit synchronization
 * 
 * Routes:
 * - POST   /api/twizzit/configure - Save/update Twizzit configuration
 * - GET    /api/twizzit/config - Get current configuration
 * - POST   /api/twizzit/test-connection - Test credentials without saving
 * - POST   /api/twizzit/sync/players - Sync players from Twizzit
 * - POST   /api/twizzit/sync/teams - Sync teams from Twizzit
 * - POST   /api/twizzit/sync/full - Full sync (all data)
 * - GET    /api/twizzit/status - Get sync status
 * - GET    /api/twizzit/logs - Get sync history
 * - DELETE /api/twizzit/config/:organizationId - Delete configuration
 */

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { auth, requireRole } from '../middleware/auth.js';
import {
  saveConfig,
  testConnection,
  getConfig,
  getAllConfigs,
  deleteConfig,
} from '../services/twizzit-auth.js';
import {
  syncPlayers,
  syncTeams,
  syncFull,
} from '../services/twizzit-sync.js';
import db from '../db.js';

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

// Apply admin-only access to all routes
router.use(requireRole(['admin']));

/**
 * Validation middleware helper
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// =====================================================
// Configuration Routes
// =====================================================

/**
 * POST /api/twizzit/configure
 * Save or update Twizzit configuration
 */
router.post(
  '/configure',
  [
    body('organizationId').isInt().withMessage('Organization ID must be an integer'),
    body('organizationName').optional().isString(),
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
    body('syncEnabled').optional().isBoolean(),
    body('autoSyncFrequency').optional().isIn(['manual', 'hourly', 'daily', 'weekly']),
  ],
  validate,
  async (req, res) => {
    try {
      const { organizationId, organizationName, username, password, syncEnabled, autoSyncFrequency } = req.body;

      const configId = await saveConfig({
        organizationId,
        organizationName,
        username,
        password,
        syncEnabled: syncEnabled || false,
        autoSyncFrequency: autoSyncFrequency || 'manual',
      });

      if (process.env.NODE_ENV !== 'test') {
        console.log(`✅ Twizzit configuration saved for organization ${organizationId} (config ID: ${configId})`);
      }

      res.json({
        success: true,
        message: 'Twizzit configuration saved successfully',
        configId,
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('❌ Failed to save Twizzit configuration:', error);
      }
      res.status(500).json({
        error: 'Failed to save configuration',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/twizzit/config
 * Get Twizzit configuration for an organization (without sensitive data)
 */
router.get(
  '/config',
  [query('organizationId').optional().isInt()],
  validate,
  async (req, res) => {
    try {
      const { organizationId } = req.query;

      if (organizationId) {
        const config = await getConfig(parseInt(organizationId));
        res.json({ config });
      } else {
        const configs = await getAllConfigs();
        res.json({ configs });
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('❌ Failed to get Twizzit configuration:', error);
      }
      res.status(500).json({
        error: 'Failed to get configuration',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/twizzit/test-connection
 * Test Twizzit credentials without saving
 */
router.post(
  '/test-connection',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { username, password } = req.body;
      const result = await testConnection(username, password);

      if (result.success) {
        res.json({
          success: true,
          message: 'Connection successful',
        });
      } else {
        res.status(401).json({
          success: false,
          error: 'Authentication failed',
          message: result.error,
        });
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('❌ Connection test failed:', error);
      }
      res.status(500).json({
        error: 'Connection test failed',
        message: error.message,
      });
    }
  }
);

/**
 * DELETE /api/twizzit/config/:organizationId
 * Delete Twizzit configuration
 */
router.delete(
  '/config/:organizationId',
  [param('organizationId').isInt()],
  validate,
  async (req, res) => {
    try {
      const { organizationId } = req.params;

      // Get config ID from organization ID
      const config = await getConfig(parseInt(organizationId));
      if (!config) {
        return res.status(404).json({ error: 'Configuration not found' });
      }

      const deleted = await deleteConfig(config.id);

      if (deleted) {
        if (process.env.NODE_ENV !== 'test') {
          console.log(`🗑️ Twizzit configuration deleted for organization ${organizationId}`);
        }
        res.json({
          success: true,
          message: 'Configuration deleted successfully',
        });
      } else {
        res.status(404).json({ error: 'Configuration not found' });
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('❌ Failed to delete Twizzit configuration:', error);
      }
      res.status(500).json({
        error: 'Failed to delete configuration',
        message: error.message,
      });
    }
  }
);

// =====================================================
// Sync Operation Routes
// =====================================================

/**
 * POST /api/twizzit/sync/players
 * Sync players from Twizzit
 */
router.post(
  '/sync/players',
  [body('organizationId').isInt().withMessage('Organization ID is required')],
  validate,
  async (req, res) => {
    try {
      const { organizationId } = req.body;

      // Get config for organization
      const config = await getConfig(organizationId);
      if (!config) {
        return res.status(404).json({ error: 'Twizzit configuration not found for this organization' });
      }

      // Check if sync already in progress
      if (config.sync_in_progress) {
        return res.status(409).json({
          error: 'Sync already in progress',
          message: 'Please wait for the current sync to complete',
        });
      }

      // Start sync (async, don't wait)
      syncPlayers(config.id).catch(error => {
        if (process.env.NODE_ENV !== 'test') {
          console.error('❌ Player sync error:', error);
        }
      });

      res.json({
        success: true,
        message: 'Player sync started',
        configId: config.id,
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('❌ Failed to start player sync:', error);
      }
      res.status(500).json({
        error: 'Failed to start sync',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/twizzit/sync/teams
 * Sync teams from Twizzit
 */
router.post(
  '/sync/teams',
  [body('organizationId').isInt().withMessage('Organization ID is required')],
  validate,
  async (req, res) => {
    try {
      const { organizationId } = req.body;

      const config = await getConfig(organizationId);
      if (!config) {
        return res.status(404).json({ error: 'Twizzit configuration not found for this organization' });
      }

      if (config.sync_in_progress) {
        return res.status(409).json({
          error: 'Sync already in progress',
          message: 'Please wait for the current sync to complete',
        });
      }

      syncTeams(config.id).catch(error => {
        if (process.env.NODE_ENV !== 'test') {
          console.error('❌ Team sync error:', error);
        }
      });

      res.json({
        success: true,
        message: 'Team sync started',
        configId: config.id,
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('❌ Failed to start team sync:', error);
      }
      res.status(500).json({
        error: 'Failed to start sync',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/twizzit/sync/full
 * Full sync (players + teams)
 */
router.post(
  '/sync/full',
  [body('organizationId').isInt().withMessage('Organization ID is required')],
  validate,
  async (req, res) => {
    try {
      const { organizationId } = req.body;

      const config = await getConfig(organizationId);
      if (!config) {
        return res.status(404).json({ error: 'Twizzit configuration not found for this organization' });
      }

      if (config.sync_in_progress) {
        return res.status(409).json({
          error: 'Sync already in progress',
          message: 'Please wait for the current sync to complete',
        });
      }

      syncFull(config.id).catch(error => {
        if (process.env.NODE_ENV !== 'test') {
          console.error('❌ Full sync error:', error);
        }
      });

      res.json({
        success: true,
        message: 'Full sync started',
        configId: config.id,
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('❌ Failed to start full sync:', error);
      }
      res.status(500).json({
        error: 'Failed to start sync',
        message: error.message,
      });
    }
  }
);

// =====================================================
// Status and Logging Routes
// =====================================================

/**
 * GET /api/twizzit/status
 * Get sync status for an organization
 */
router.get(
  '/status',
  [query('organizationId').isInt()],
  validate,
  async (req, res) => {
    try {
      const { organizationId } = req.query;
      const config = await getConfig(parseInt(organizationId));

      if (!config) {
        return res.status(404).json({ error: 'Twizzit configuration not found' });
      }

      // Get latest sync log
      const logResult = await db.query(
        `SELECT sync_type, status, records_created, records_updated, records_skipped, 
                started_at, completed_at, duration_ms, errors
         FROM twizzit_sync_log
         WHERE config_id = $1
         ORDER BY started_at DESC
         LIMIT 1`,
        [config.id]
      );

      const latestSync = logResult.rows.length > 0 ? logResult.rows[0] : null;

      // Get pending conflicts count
      const conflictsResult = await db.query(
        `SELECT COUNT(*) as count
         FROM twizzit_sync_conflicts
         WHERE config_id = $1 AND resolution = 'pending'`,
        [config.id]
      );

      res.json({
        config: {
          organizationId: config.organization_id,
          organizationName: config.organization_name,
          syncEnabled: config.sync_enabled,
          autoSyncFrequency: config.auto_sync_frequency,
          syncInProgress: config.sync_in_progress,
          lastSyncAt: config.last_sync_at,
        },
        latestSync,
        pendingConflicts: parseInt(conflictsResult.rows[0].count),
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('❌ Failed to get sync status:', error);
      }
      res.status(500).json({
        error: 'Failed to get sync status',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/twizzit/logs
 * Get sync history logs with pagination
 */
router.get(
  '/logs',
  [
    query('organizationId').isInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { organizationId } = req.query;
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      const config = await getConfig(parseInt(organizationId));
      if (!config) {
        return res.status(404).json({ error: 'Twizzit configuration not found' });
      }

      // Get sync logs
      const logsResult = await db.query(
        `SELECT id, sync_type, status, records_fetched, records_created, records_updated, 
                records_skipped, started_at, completed_at, duration_ms,
                CASE 
                  WHEN errors IS NOT NULL THEN jsonb_array_length(errors)
                  ELSE 0
                END as error_count
         FROM twizzit_sync_log
         WHERE config_id = $1
         ORDER BY started_at DESC
         LIMIT $2 OFFSET $3`,
        [config.id, limit, offset]
      );

      // Get total count
      const countResult = await db.query(
        'SELECT COUNT(*) as total FROM twizzit_sync_log WHERE config_id = $1',
        [config.id]
      );

      res.json({
        logs: logsResult.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          limit,
          offset,
          hasMore: offset + logsResult.rows.length < parseInt(countResult.rows[0].total),
        },
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('❌ Failed to get sync logs:', error);
      }
      res.status(500).json({
        error: 'Failed to get sync logs',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/twizzit/logs/:logId
 * Get detailed sync log with full error information
 */
router.get(
  '/logs/:logId',
  [param('logId').isInt()],
  validate,
  async (req, res) => {
    try {
      const { logId } = req.params;

      const logResult = await db.query(
        `SELECT l.*, c.organization_id, c.organization_name
         FROM twizzit_sync_log l
         JOIN twizzit_config c ON l.config_id = c.id
         WHERE l.id = $1`,
        [logId]
      );

      if (logResult.rows.length === 0) {
        return res.status(404).json({ error: 'Sync log not found' });
      }

      res.json({ log: logResult.rows[0] });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('❌ Failed to get sync log details:', error);
      }
      res.status(500).json({
        error: 'Failed to get sync log',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/twizzit/conflicts
 * Get pending sync conflicts
 */
router.get(
  '/conflicts',
  [query('organizationId').isInt()],
  validate,
  async (req, res) => {
    try {
      const { organizationId } = req.query;

      const config = await getConfig(parseInt(organizationId));
      if (!config) {
        return res.status(404).json({ error: 'Twizzit configuration not found' });
      }

      const conflictsResult = await db.query(
        `SELECT id, entity_type, shotspot_id, twizzit_id, conflict_type,
                shotspot_data, twizzit_data, created_at
         FROM twizzit_sync_conflicts
         WHERE config_id = $1 AND resolution = 'pending'
         ORDER BY created_at DESC`,
        [config.id]
      );

      res.json({ conflicts: conflictsResult.rows });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('❌ Failed to get conflicts:', error);
      }
      res.status(500).json({
        error: 'Failed to get conflicts',
        message: error.message,
      });
    }
  }
);

export default router;
