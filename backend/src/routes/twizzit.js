/**
 * Twizzit Integration Routes
 * API endpoints for managing Twizzit integration and synchronization
 */

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { auth, requireRole } from '../middleware/auth.js';
import twizzitAuth from '../services/twizzit-auth.js';
import twizzitSync from '../services/twizzit-sync.js';
import TwizzitApiClient from '../services/twizzit-api-client.js';
import db from '../db.js';

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

/**
 * Validation middleware
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array() 
    });
  }
  next();
};

/**
 * POST /api/twizzit/credentials
 * Store Twizzit API credentials (admin only)
 */
router.post(
  '/credentials',
  requireRole(['admin']),
  [
    body('organizationName')
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Organization name must be 1-255 characters'),
    body('apiUsername')
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('API username is required'),
    body('apiPassword')
      .isLength({ min: 1 })
      .withMessage('API password is required'),
    body('apiEndpoint')
      .optional()
      .trim()
      .isURL()
      .withMessage('API endpoint must be a valid URL')
  ],
  validate,
  async (req, res) => {
    try {
      const { organizationName, apiUsername, apiPassword, apiEndpoint } = req.body;

      const credential = await twizzitAuth.storeCredentials({
        organizationName,
        apiUsername,
        apiPassword,
        apiEndpoint
      });

      res.status(201).json({
        message: 'Credentials stored successfully',
        credential: {
          id: credential.id,
          organizationName: credential.organization_name,
          apiUsername: credential.api_username,
          apiEndpoint: credential.api_endpoint
        }
      });
    } catch (error) {
      console.error('Failed to store credentials:', error);
      res.status(500).json({ 
        error: 'Failed to store credentials',
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
      });
    }
  }
);

/**
 * GET /api/twizzit/credentials
 * List all stored credentials (admin only)
 */
router.get(
  '/credentials',
  requireRole(['admin']),
  async (req, res) => {
    try {
      const credentials = await twizzitAuth.listCredentials();
      res.json({ credentials });
    } catch (error) {
      console.error('Failed to list credentials:', error);
      res.status(500).json({ 
        error: 'Failed to list credentials',
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
      });
    }
  }
);

/**
 * DELETE /api/twizzit/credentials/:id
 * Delete stored credentials (admin only)
 */
router.delete(
  '/credentials/:id',
  requireRole(['admin']),
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid credential ID')
  ],
  validate,
  async (req, res) => {
    try {
      await twizzitAuth.deleteCredentials(parseInt(req.params.id));
      res.json({ message: 'Credentials deleted successfully' });
    } catch (error) {
      console.error('Failed to delete credentials:', error);
      res.status(500).json({ 
        error: 'Failed to delete credentials',
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
      });
    }
  }
);

/**
 * POST /api/twizzit/verify/:id
 * Verify API connection (admin/coach)
 */
router.post(
  '/verify/:id',
  requireRole(['admin', 'coach']),
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid credential ID')
  ],
  validate,
  async (req, res) => {
    try {
      const credentialId = parseInt(req.params.id);
      const credentials = await twizzitAuth.getCredentials(credentialId);

      const apiClient = new TwizzitApiClient({
        apiEndpoint: credentials.apiEndpoint,
        username: credentials.apiUsername,
        password: credentials.apiPassword
      });

      const isConnected = await apiClient.verifyConnection();

      if (isConnected) {
        await twizzitAuth.updateVerificationTimestamp(credentialId);
        res.json({ 
          success: true,
          message: 'Connection verified successfully' 
        });
      } else {
        res.status(401).json({ 
          success: false,
          error: 'Connection verification failed' 
        });
      }
    } catch (error) {
      console.error('Failed to verify connection:', error);
      res.status(500).json({ 
        error: 'Failed to verify connection',
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
      });
    }
  }
);

/**
 * POST /api/twizzit/sync/clubs/:credentialId
 * Sync clubs from Twizzit (admin/coach)
 * Note: Twizzit calls these "teams" but they represent clubs/organizations in ShotSpot
 */
router.post(
  '/sync/clubs/:credentialId',
  requireRole(['admin', 'coach']),
  [
    param('credentialId').isInt({ min: 1 }).withMessage('Invalid credential ID'),
    body('includePlayers').optional().isBoolean().withMessage('includePlayers must be boolean')
  ],
  validate,
  async (req, res) => {
    try {
      const credentialId = parseInt(req.params.credentialId);
      const options = {
        includePlayers: req.body.includePlayers || false
      };

      const result = await twizzitSync.syncClubsFromTwizzit(credentialId, options);
      res.json(result);
    } catch (error) {
      console.error('Failed to sync clubs:', error);
      res.status(500).json({ 
        error: 'Failed to sync clubs',
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
      });
    }
  }
);

/**
 * POST /api/twizzit/sync/players/:credentialId
 * Sync players from Twizzit (admin/coach)
 */
router.post(
  '/sync/players/:credentialId',
  requireRole(['admin', 'coach']),
  [
    param('credentialId').isInt({ min: 1 }).withMessage('Invalid credential ID')
  ],
  validate,
  async (req, res) => {
    try {
      const credentialId = parseInt(req.params.credentialId);
      const result = await twizzitSync.syncPlayersFromTwizzit(credentialId);
      res.json(result);
    } catch (error) {
      console.error('Failed to sync players:', error);
      res.status(500).json({ 
        error: 'Failed to sync players',
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
      });
    }
  }
);

/**
 * GET /api/twizzit/sync/config/:credentialId
 * Get sync configuration (admin/coach)
 */
router.get(
  '/sync/config/:credentialId',
  requireRole(['admin', 'coach']),
  [
    param('credentialId').isInt({ min: 1 }).withMessage('Invalid credential ID')
  ],
  validate,
  async (req, res) => {
    try {
      const credentialId = parseInt(req.params.credentialId);
      const config = await twizzitSync.getSyncConfig(credentialId);
      
      if (!config) {
        return res.status(404).json({ error: 'Sync configuration not found' });
      }

      res.json({ config });
    } catch (error) {
      console.error('Failed to get sync config:', error);
      res.status(500).json({ 
        error: 'Failed to get sync configuration',
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
      });
    }
  }
);

/**
 * PUT /api/twizzit/sync/config/:credentialId
 * Update sync configuration (admin only)
 */
router.put(
  '/sync/config/:credentialId',
  requireRole(['admin']),
  [
    param('credentialId').isInt({ min: 1 }).withMessage('Invalid credential ID'),
    body('syncTeams').optional().isBoolean(),
    body('syncPlayers').optional().isBoolean(),
    body('syncCompetitions').optional().isBoolean(),
    body('syncIntervalMinutes').optional().isInt({ min: 1, max: 1440 }),
    body('autoSyncEnabled').optional().isBoolean()
  ],
  validate,
  async (req, res) => {
    try {
      const credentialId = parseInt(req.params.credentialId);
      const config = await twizzitSync.updateSyncConfig(credentialId, req.body);
      res.json({ 
        message: 'Sync configuration updated',
        config 
      });
    } catch (error) {
      console.error('Failed to update sync config:', error);
      res.status(500).json({ 
        error: 'Failed to update sync configuration',
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
      });
    }
  }
);

/**
 * GET /api/twizzit/sync/history/:credentialId
 * Get sync history (admin/coach)
 */
router.get(
  '/sync/history/:credentialId',
  requireRole(['admin', 'coach']),
  [
    param('credentialId').isInt({ min: 1 }).withMessage('Invalid credential ID'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be >= 0')
  ],
  validate,
  async (req, res) => {
    try {
      const credentialId = parseInt(req.params.credentialId);
      const options = {
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0
      };

      const history = await twizzitSync.getSyncHistory(credentialId, options);
      res.json({ history });
    } catch (error) {
      console.error('Failed to get sync history:', error);
      res.status(500).json({ 
        error: 'Failed to get sync history',
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
      });
    }
  }
);

/**
 * GET /api/twizzit/mappings/teams
 * Get team mappings (admin/coach)
 */
router.get(
  '/mappings/teams',
  requireRole(['admin', 'coach']),
  async (req, res) => {
    try {
      const result = await db.query(
        `SELECT 
          tm.id,
          tm.local_club_id,
          t.name as local_club_name,
          tm.twizzit_team_id,
          tm.twizzit_team_name,
          tm.last_synced_at,
          tm.sync_status,
          tm.sync_error
         FROM twizzit_team_mappings tm
         JOIN clubs t ON tm.local_club_id = t.id
         ORDER BY tm.last_synced_at DESC`
      );

      res.json({ mappings: result.rows });
    } catch (error) {
      console.error('Failed to get team mappings:', error);
      res.status(500).json({ 
        error: 'Failed to get team mappings',
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
      });
    }
  }
);

/**
 * GET /api/twizzit/mappings/players
 * Get player mappings (admin/coach)
 */
router.get(
  '/mappings/players',
  requireRole(['admin', 'coach']),
  [
    query('teamId').optional().isInt({ min: 1 }).withMessage('Invalid team ID')
  ],
  validate,
  async (req, res) => {
    try {
      let query = `
        SELECT 
          pm.id,
          pm.local_player_id,
          p.first_name,
          p.last_name,
          p.jersey_number,
          pm.twizzit_player_id,
          pm.twizzit_player_name,
          pm.last_synced_at,
          pm.sync_status,
          pm.sync_error,
          tm.local_club_id,
          t.name as club_name
        FROM twizzit_player_mappings pm
        JOIN players p ON pm.local_player_id = p.id
        JOIN twizzit_team_mappings tm ON pm.team_mapping_id = tm.id
        JOIN clubs t ON tm.local_club_id = t.id`;

      const params = [];
      if (req.query.teamId) {
        query += ' WHERE tm.local_club_id = $1';
        params.push(parseInt(req.query.teamId));
      }

      query += ' ORDER BY pm.last_synced_at DESC';

      const result = await db.query(query, params);
      res.json({ mappings: result.rows });
    } catch (error) {
      console.error('Failed to get player mappings:', error);
      res.status(500).json({ 
        error: 'Failed to get player mappings',
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
      });
    }
  }
);

export default router;
