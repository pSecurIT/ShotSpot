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
import * as twizzitService from '../services/twizzitService.js';

const router = express.Router();

// Dev-only helper: allow calling Twizzit debug endpoints from a browser tab
// (which cannot set Authorization headers) by providing ?token=<jwt>.
// Disabled in tests and production.
router.use((req, _res, next) => {
  const env = process.env.NODE_ENV;
  if (env === 'production' || env === 'test') return next();

  if (typeof req.headers?.authorization === 'string' && req.headers.authorization.trim().length > 0) {
    return next();
  }

  // Only enable for /api/twizzit/debug/* routes
  if (!req.path.startsWith('/debug/')) return next();

  const token = req.query?.token;
  if (typeof token === 'string' && token.trim().length > 0) {
    req.headers.authorization = `Bearer ${token.trim()}`;
  }

  next();
});

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
 * Store Twizzit API credentials (admin/coach)
 */
router.post(
  '/credentials',
  requireRole(['admin', 'coach']),
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
 * List all stored credentials (admin/coach)
 */
router.get(
  '/credentials',
  requireRole(['admin', 'coach']),
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
 * Delete stored credentials (admin/coach)
 */
router.delete(
  '/credentials/:id',
  requireRole(['admin', 'coach']),
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
        password: credentials.apiPassword,
        organizationName: credentials.organizationName
      });

      const verification = await apiClient.verifyConnectionDetailed();

      if (verification.success) {
        await twizzitAuth.updateVerificationTimestamp(credentialId);
        res.json({ 
          success: true,
          message: verification.message || 'Connection verified successfully',
          apiEndpointStored: credentials.apiEndpoint,
          apiEndpointEffective: apiClient.apiEndpoint,
          organizationName: verification.organizationName,
          ...(verification.organizationId ? { organizationId: verification.organizationId } : {}),
          ...(typeof verification.usableForSync === 'boolean' ? { usableForSync: verification.usableForSync } : {}),
          ...(verification.capabilities ? { capabilities: verification.capabilities } : {})
        });
      } else {
        const status = verification.status && verification.status >= 400 && verification.status < 600 ? verification.status : 401;

        if (process.env.NODE_ENV !== 'test') {
          console.warn('[twizzit] verify failed', {
            credentialId,
            status,
            apiEndpointStored: credentials.apiEndpoint,
            apiEndpointEffective: apiClient.apiEndpoint,
            message: verification.message
          });
        }

        res.status(status).json({
          success: false,
          error: 'Connection verification failed',
          message: verification.message,
          apiEndpointStored: credentials.apiEndpoint,
          apiEndpointEffective: apiClient.apiEndpoint,
          status: verification.status,
          details: verification.details
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
 * GET /api/twizzit/verify
 * Verify Twizzit API connection
 */
router.get('/verify', async (req, res) => {
  try {
    const isConnected = await twizzitService.verifyTwizzitConnection();
    if (isConnected) {
      return res.status(200).json({ message: 'Twizzit API connection verified successfully.' });
    }
    return res.status(500).json({ message: 'Failed to verify Twizzit API connection.' });
  } catch (error) {
    console.error('Error verifying Twizzit API connection:', error);
    return res.status(500).json({ 
      error: 'Failed to verify Twizzit API connection',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

/**
 * POST /api/twizzit/sync/clubs
 * Sync clubs from Twizzit API (legacy endpoint)
 */
router.post('/sync/clubs', requireRole(['admin', 'coach']), async (req, res) => {
  try {
    const clubs = await twizzitService.syncClubs();
    return res.status(200).json({ message: 'Clubs synced successfully.', clubs });
  } catch (error) {
    console.error('Error syncing clubs:', error);
    return res.status(500).json({ 
      error: 'Failed to sync clubs',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

/**
 * POST /api/twizzit/sync/players/club/:clubId
 * Sync players for a specific club from Twizzit API (legacy endpoint)
 *
 * Note: this route must NOT conflict with the credential-based endpoint:
 * POST /api/twizzit/sync/players/:credentialId
 */
router.post(
  '/sync/players/club/:clubId',
  requireRole(['admin', 'coach']),
  async (req, res) => {
    const { clubId } = req.params;
    try {
      const players = await twizzitService.syncPlayers(clubId);
      return res.status(200).json({ message: `Players synced successfully for club ${clubId}.`, players });
    } catch (error) {
    // Avoid user-controlled format strings; log structured context
      console.error('Error syncing players for club %s:', clubId, error);
      return res.status(500).json({ 
        error: 'Failed to sync players',
        clubId,
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
      });
    }
  }
);

/**
 * POST /api/twizzit/sync/seasons
 * Sync seasons from Twizzit API (legacy endpoint)
 */
router.post('/sync/seasons', requireRole(['admin', 'coach']), async (req, res) => {
  try {
    const seasons = await twizzitService.syncSeasons();
    return res.status(200).json({ message: 'Seasons synced successfully.', seasons });
  } catch (error) {
    console.error('Error syncing seasons:', error);
    return res.status(500).json({ 
      error: 'Failed to sync seasons',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

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
 * GET /api/twizzit/sync/options/:credentialId
 * Load groups (teams) and seasons from Twizzit for dropdowns (admin/coach)
 */
router.get(
  '/sync/options/:credentialId',
  requireRole(['admin', 'coach']),
  [
    param('credentialId').isInt({ min: 1 }).withMessage('Invalid credential ID'),
    query('organizationId').optional().isString().withMessage('organizationId must be a string'),
    query('seasonId').optional().isString().withMessage('seasonId must be a string'),
    query('includeAccess').optional().isIn(['0', '1', 'true', 'false']).withMessage('includeAccess must be a boolean-like value')
  ],
  validate,
  async (req, res) => {
    const credentialId = parseInt(req.params.credentialId);
    try {
      const organizationId = req.query.organizationId ? String(req.query.organizationId) : null;
      const seasonId = req.query.seasonId ? String(req.query.seasonId) : null;
      const includeAccess = req.query.includeAccess === '1' || req.query.includeAccess === 'true';
      const options = organizationId
        ? await twizzitSync.getRemoteSyncOptionsForOrganization(credentialId, { organizationId, seasonId, includeAccess })
        : await twizzitSync.getRemoteSyncOptions(credentialId, { seasonId, includeAccess });
      res.json(options);
    } catch (error) {
      console.error('Failed to load Twizzit sync options:', error);

      let credentialContext;
      if (process.env.NODE_ENV !== 'production') {
        try {
          const creds = await twizzitAuth.getCredentials(credentialId);
          credentialContext = {
            id: credentialId,
            organizationName: creds.organizationName,
            apiUsername: creds.apiUsername,
            apiEndpointStored: creds.apiEndpoint,
            apiEndpointEffective: creds.apiEndpoint || 'https://app.twizzit.com'
          };
        } catch {
          credentialContext = { id: credentialId };
        }
      }

      if (process.env.NODE_ENV !== 'test' && credentialContext) {
        console.warn('[twizzit] sync options failed', {
          credential: credentialContext,
          upstreamStatus: error?.status,
          message: error?.message
        });
      }

      const upstreamStatus = error?.status;
      const status = upstreamStatus
        ? (upstreamStatus >= 400 && upstreamStatus < 500 ? upstreamStatus : 502)
        : 500;
      res.status(status).json({
        error: 'Failed to load sync options',
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
        ...(upstreamStatus ? { upstreamStatus } : {}),
        ...(process.env.NODE_ENV === 'production' ? {} : (error?.details ? { upstreamDetails: error.details } : {})),
        ...(credentialContext ? { credential: credentialContext } : {})
      });
    }
  }
);

/**
 * GET /api/twizzit/debug/access/:credentialId
 * Diagnostics endpoint to debug organization scoping issues (admin/coach)
 *
 * Returns upstream status/details for multiple request shapes. Does not include secrets.
 */
router.get(
  '/debug/access/:credentialId',
  requireRole(['admin', 'coach']),
  [
    param('credentialId').isInt({ min: 1 }).withMessage('Invalid credential ID'),
    query('organizationId').optional().isString().withMessage('organizationId must be a string'),
    query('seasonId').optional().isString().withMessage('seasonId must be a string'),
    query('groupType').optional().isString().withMessage('groupType must be a string')
  ],
  validate,
  async (req, res) => {
    if (process.env.NODE_ENV === 'production' && process.env.TWIZZIT_DEBUG !== '1') {
      return res.status(404).json({ error: 'Not found' });
    }

    try {
      const credentialId = parseInt(req.params.credentialId);
      const overrideOrganizationId = req.query.organizationId ? String(req.query.organizationId) : null;
      const overrideSeasonId = req.query.seasonId ? String(req.query.seasonId) : null;
      const overrideGroupType = req.query.groupType ? String(req.query.groupType) : null;

      const credentials = await twizzitAuth.getCredentials(credentialId);

      const apiClient = new TwizzitApiClient({
        apiEndpoint: credentials.apiEndpoint,
        username: credentials.apiUsername,
        password: credentials.apiPassword,
        organizationName: credentials.organizationName,
        ...(overrideOrganizationId ? { organizationId: overrideOrganizationId } : {})
      });

      await apiClient.ensureAuthenticated();

      const decodeJwtPayload = (token) => {
        try {
          if (!token || typeof token !== 'string') return null;
          const parts = token.split('.');
          if (parts.length < 2) return null;
          const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
          const json = Buffer.from(padded, 'base64').toString('utf8');
          return JSON.parse(json);
        } catch {
          return null;
        }
      };

      const tokenPayload = decodeJwtPayload(apiClient.accessToken);

      const normalizeOrganizationsPayload = (payload) => {
        if (Array.isArray(payload)) return payload;
        if (payload && Array.isArray(payload.organizations)) return payload.organizations;
        if (payload && Array.isArray(payload.data)) return payload.data;
        return [];
      };

      // Some Twizzit accounts return 400 "no access for current endpoint" for /organizations.
      // Keep the diagnostics endpoint useful even in that case.
      let organizationsPayload;
      let organizationsNormalized = [];
      let firstOrg = null;
      let organizationsAttempt = { ok: true, status: null, error: null };
      try {
        const rawOrganizationsResponse = await apiClient.client.get('/v2/api/organizations');
        organizationsAttempt.status = rawOrganizationsResponse.status;
        organizationsPayload = rawOrganizationsResponse.data;
        organizationsNormalized = normalizeOrganizationsPayload(organizationsPayload);
        firstOrg = organizationsNormalized[0] || null;
      } catch (error) {
        organizationsAttempt = {
          ok: false,
          status: error?.response?.status || null,
          error: error?.response?.data || error?.message || 'Request failed'
        };
        organizationsPayload = organizationsAttempt.error;
        organizationsNormalized = [];
        firstOrg = null;
      }

      const selectedOrgId = overrideOrganizationId || (firstOrg ? (firstOrg.organization_id ?? firstOrg.id ?? null) : null);

      const attemptGet = async (path, params) => {
        try {
          const response = await apiClient.client.get(path, { params });
          const data = response.data;
          return {
            ok: true,
            status: response.status,
            params,
            dataType: Array.isArray(data) ? 'array' : typeof data,
            dataLength: Array.isArray(data) ? data.length : null,
            sample: Array.isArray(data) ? data.slice(0, 1) : data
          };
        } catch (error) {
          return {
            ok: false,
            status: error?.response?.status || null,
            params,
            error: error?.response?.data || error?.message || 'Request failed'
          };
        }
      };

      const orgIdStr = selectedOrgId != null ? String(selectedOrgId) : null;
      const orgIdNum = orgIdStr && !Number.isNaN(Number(orgIdStr)) ? Number(orgIdStr) : null;

      const seasonId = overrideSeasonId != null && String(overrideSeasonId).trim() !== ''
        ? String(overrideSeasonId)
        : null;

      const groupType = overrideGroupType != null && String(overrideGroupType).trim() !== ''
        ? String(overrideGroupType)
        : null;

      const buildParamVariants = () => {
        const base = {
          limit: 1,
          ...(groupType ? { 'group-type': groupType } : {})
        };

        const variants = [{ label: 'no_params', params: { ...base } }];

        if (orgIdStr) {
          variants.push({ label: 'organization-ids[]', params: { ...base, 'organization-ids[]': orgIdStr } });
          variants.push({ label: 'organization-ids', params: { ...base, 'organization-ids': orgIdStr } });
          variants.push({ label: 'organization_id_string', params: { ...base, organization_id: orgIdStr } });
          variants.push({ label: 'organization_id_bracket', params: { ...base, 'organization_id[]': orgIdStr } });
          variants.push({ label: 'organization_ids', params: { ...base, organization_ids: orgIdStr } });
          variants.push({ label: 'organization_ids_bracket', params: { ...base, 'organization_ids[]': orgIdStr } });
          variants.push({ label: 'organizations_bracket', params: { ...base, 'organizations[]': orgIdStr } });
          variants.push({ label: 'organisation_id', params: { ...base, organisation_id: orgIdStr } });
          variants.push({ label: 'organisation_id_bracket', params: { ...base, 'organisation_id[]': orgIdStr } });
          variants.push({ label: 'organizationId', params: { ...base, organizationId: orgIdStr } });
          variants.push({ label: 'organization', params: { ...base, organization: orgIdStr } });
          variants.push({ label: 'organizations', params: { ...base, organizations: orgIdStr } });
        }

        if (orgIdNum != null) {
          variants.push({ label: 'organization-ids[]_number', params: { ...base, 'organization-ids[]': orgIdNum } });
          variants.push({ label: 'organization_id_number', params: { ...base, organization_id: orgIdNum } });
          variants.push({ label: 'organization_id_bracket_number', params: { ...base, 'organization_id[]': orgIdNum } });
        }

        return variants;
      };

      const variants = buildParamVariants();

      const withSeasonParamVariants = (params) => {
        if (!seasonId) return [{ labelSuffix: null, params }];
        return [
          { labelSuffix: 'season-ids[]', params: { ...params, 'season-ids[]': seasonId } },
          { labelSuffix: 'season_ids[]', params: { ...params, 'season_ids[]': seasonId } },
          { labelSuffix: 'season-ids', params: { ...params, 'season-ids': seasonId } },
          { labelSuffix: 'season-id', params: { ...params, 'season-id': seasonId } },
          { labelSuffix: 'season_id', params: { ...params, season_id: seasonId } },
          { labelSuffix: 'seasonId', params: { ...params, seasonId: seasonId } }
        ];
      };

      const probeEndpoint = async (path) => {
        const attempts = [];
        for (const v of variants) {
          const r = await attemptGet(path, v.params);
          attempts.push({ label: v.label, ...r });
        }
        return attempts;
      };

      const probeEndpointWithSeason = async (path) => {
        const attempts = [];
        for (const v of variants) {
          for (const variant of withSeasonParamVariants(v.params)) {
            const label = variant.labelSuffix ? `${v.label}|${variant.labelSuffix}` : v.label;
            const r = await attemptGet(path, variant.params);
            attempts.push({ label, ...r });
          }
        }
        return attempts;
      };

      const [
        groupsAttempts,
        groupsSeasonAttempts,
        groupRelationsSeasonAttempts,
        groupSeasonAltEndpointAttempts,
        seasonsAttempts,
        contactsAttempts,
        groupTypesAttempts,
        groupCategoriesAttempts,
        contactFunctionsAttempts,
        eventTypesAttempts,
        eventSubtypesAttempts
      ] = await Promise.all([
        probeEndpoint('/v2/api/groups'),
        probeEndpointWithSeason('/v2/api/groups'),
        probeEndpointWithSeason('/v2/api/group-relations'),
        probeEndpointWithSeason('/v2/api/group'),
        probeEndpoint('/v2/api/seasons'),
        probeEndpoint('/v2/api/contacts'),
        probeEndpoint('/v2/api/group-types'),
        probeEndpoint('/v2/api/group-categories'),
        probeEndpoint('/v2/api/contact-functions'),
        probeEndpoint('/v2/api/event-types'),
        probeEndpoint('/v2/api/event-subtypes')
      ]);

      res.json({
        credentialId,
        apiEndpoint: credentials.apiEndpoint,
        apiEndpointEffective: apiClient.apiEndpoint,
        storedOrganizationName: credentials.organizationName,
        selectedOrganizationId: orgIdStr,
        tokenPayload: tokenPayload || undefined,
        organizationsAttempt,
        organizationsRawType: Array.isArray(organizationsPayload) ? 'array' : typeof organizationsPayload,
        organizationSample: firstOrg,
        organizationSampleKeys: firstOrg ? Object.keys(firstOrg) : [],
        attempts: {
          groups: groupsAttempts,
          ...(seasonId ? { groupsSeason: groupsSeasonAttempts } : {}),
          ...(seasonId ? { groupRelationsSeason: groupRelationsSeasonAttempts } : {}),
          ...(seasonId ? { groupAltSeason: groupSeasonAltEndpointAttempts } : {}),
          seasons: seasonsAttempts,
          contacts: contactsAttempts,
          groupTypes: groupTypesAttempts,
          groupCategories: groupCategoriesAttempts,
          contactFunctions: contactFunctionsAttempts,
          eventTypes: eventTypesAttempts,
          eventSubtypes: eventSubtypesAttempts
        }
      });
    } catch (error) {
      console.error('Failed to run Twizzit access diagnostics:', error);
      res.status(500).json({
        error: 'Failed to run access diagnostics',
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
      });
    }
  }
);

/**
 * POST /api/twizzit/sync/preview/teams/:credentialId
 * Preview teams (groups) that would be synced (admin/coach)
 */
router.post(
  '/sync/preview/teams/:credentialId',
  requireRole(['admin', 'coach']),
  [
    param('credentialId').isInt({ min: 1 }).withMessage('Invalid credential ID'),
    body('groupId').optional().isString().withMessage('groupId must be a string'),
    body('seasonId').optional().isString().withMessage('seasonId must be a string'),
    body('organizationId').optional().isString().withMessage('organizationId must be a string')
  ],
  validate,
  async (req, res) => {
    try {
      const credentialId = parseInt(req.params.credentialId);
      const preview = await twizzitSync.previewTeamsFromTwizzit(credentialId, {
        groupId: req.body.groupId,
        seasonId: req.body.seasonId,
        organizationId: req.body.organizationId
      });
      res.json(preview);
    } catch (error) {
      console.error('Failed to preview teams:', error);
      const upstreamStatus = error?.status;
      const status = upstreamStatus
        ? (upstreamStatus >= 400 && upstreamStatus < 500 ? upstreamStatus : 502)
        : 500;
      res.status(status).json({
        error: 'Failed to preview teams',
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
        ...(upstreamStatus ? { upstreamStatus } : {}),
        ...(process.env.NODE_ENV === 'production' ? {} : (error?.details ? { upstreamDetails: error.details } : {}))
      });
    }
  }
);

/**
 * POST /api/twizzit/sync/preview/players/:credentialId
 * Preview players that would be synced for a selected team/season (admin/coach)
 */
router.post(
  '/sync/preview/players/:credentialId',
  requireRole(['admin', 'coach']),
  [
    param('credentialId').isInt({ min: 1 }).withMessage('Invalid credential ID'),
    body('groupId').isString().notEmpty().withMessage('groupId is required'),
    body('seasonId').optional().isString().withMessage('seasonId must be a string'),
    body('organizationId').optional().isString().withMessage('organizationId must be a string')
  ],
  validate,
  async (req, res) => {
    try {
      const credentialId = parseInt(req.params.credentialId);
      const preview = await twizzitSync.previewPlayersFromTwizzit(credentialId, {
        groupId: req.body.groupId,
        seasonId: req.body.seasonId,
        organizationId: req.body.organizationId
      });

      if (process.env.NODE_ENV !== 'test') {
        const playersCount = Array.isArray(preview?.players) ? preview.players.length : 0;
        console.log('[twizzit] preview players', {
          credentialId,
          organizationId: req.body.organizationId,
          groupId: req.body.groupId,
          seasonId: req.body.seasonId,
          playersCount
        });
      }

      res.json(preview);
    } catch (error) {
      console.error('Failed to preview players:', error);
      const upstreamStatus = error?.status;
      const status = upstreamStatus
        ? (upstreamStatus >= 400 && upstreamStatus < 500 ? upstreamStatus : 502)
        : 500;
      res.status(status).json({
        error: 'Failed to preview players',
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
        ...(upstreamStatus ? { upstreamStatus } : {}),
        ...(process.env.NODE_ENV === 'production' ? {} : (error?.details ? { upstreamDetails: error.details } : {}))
      });
    }
  }
);

/**
 * POST /api/twizzit/sync/teams/:credentialId
 * Alias of clubs sync that matches frontend naming (admin/coach)
 */
router.post(
  '/sync/teams/:credentialId',
  requireRole(['admin', 'coach']),
  [
    param('credentialId').isInt({ min: 1 }).withMessage('Invalid credential ID'),
    body('groupId').optional().isString().withMessage('groupId must be a string'),
    body('seasonId').optional().isString().withMessage('seasonId must be a string'),
    body('organizationId').optional().isString().withMessage('organizationId must be a string'),
    body('createMissing').optional().isBoolean().withMessage('createMissing must be boolean')
  ],
  validate,
  async (req, res) => {
    try {
      const credentialId = parseInt(req.params.credentialId);
      const result = await twizzitSync.syncClubsFromTwizzit(credentialId, {
        groupId: req.body.groupId,
        seasonId: req.body.seasonId,
        organizationId: req.body.organizationId,
        createMissing: req.body.createMissing
      });
      res.json(result);
    } catch (error) {
      console.error('Failed to sync teams:', error);
      res.status(500).json({
        error: 'Failed to sync teams',
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
    param('credentialId').isInt({ min: 1 }).withMessage('Invalid credential ID'),
    body('groupId').optional().isString().withMessage('groupId must be a string'),
    body('seasonId').optional().isString().withMessage('seasonId must be a string'),
    body('createMissing').optional().isBoolean().withMessage('createMissing must be boolean')
  ],
  validate,
  async (req, res) => {
    try {
      const credentialId = parseInt(req.params.credentialId);
      const result = await twizzitSync.syncPlayersFromTwizzit(credentialId, {
        groupId: req.body.groupId,
        seasonId: req.body.seasonId,
        createMissing: req.body.createMissing
      });
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
      const config = await twizzitSync.ensureSyncConfig(credentialId);

      if (!config) {
        return res.status(404).json({ error: 'Twizzit credential not found' });
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
          tm.local_club_id AS internal_team_id,
          team.name AS internal_team_name,
          club.name AS internal_club_name,
          tm.twizzit_team_id,
          tm.twizzit_team_name,
          tm.created_at,
          tm.last_synced_at,
          tm.sync_status,
          tm.sync_error
         FROM twizzit_team_mappings tm
         JOIN teams team ON tm.local_club_id = team.id
         JOIN clubs club ON team.club_id = club.id
         ORDER BY tm.last_synced_at DESC`
      );

      const mappings = result.rows.map((row) => ({
        id: row.id,
        internalTeamId: row.internal_team_id,
        internalTeamName: row.internal_team_name,
        internalClubName: row.internal_club_name,
        twizzitTeamId: row.twizzit_team_id,
        twizzitTeamName: row.twizzit_team_name,
        createdAt: row.created_at,
        lastSyncedAt: row.last_synced_at,
        syncStatus: row.sync_status,
        syncError: row.sync_error
      }));

      res.json({ mappings });
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
          pm.local_player_id AS internal_player_id,
          p.first_name,
          p.last_name,
          p.jersey_number,
          pm.twizzit_player_id,
          pm.twizzit_player_name,
          pm.created_at,
          pm.last_synced_at,
          pm.sync_status,
          pm.sync_error,
          tm.local_club_id AS internal_team_id,
          team.name AS internal_team_name,
          club.name AS internal_club_name
        FROM twizzit_player_mappings pm
        JOIN players p ON pm.local_player_id = p.id
        JOIN twizzit_team_mappings tm ON pm.team_mapping_id = tm.id
        JOIN teams team ON tm.local_club_id = team.id
        JOIN clubs club ON team.club_id = club.id`;

      const params = [];
      if (req.query.teamId) {
        query += ' WHERE tm.local_club_id = $1';
        params.push(parseInt(req.query.teamId));
      }

      query += ' ORDER BY pm.last_synced_at DESC';

      const result = await db.query(query, params);
      const mappings = result.rows.map((row) => ({
        id: row.id,
        internalPlayerId: row.internal_player_id,
        internalPlayerName: `${row.first_name} ${row.last_name}`.trim(),
        jerseyNumber: row.jersey_number,
        twizzitPlayerId: row.twizzit_player_id,
        twizzitPlayerName: row.twizzit_player_name,
        internalTeamId: row.internal_team_id,
        internalTeamName: row.internal_team_name,
        internalClubName: row.internal_club_name,
        createdAt: row.created_at,
        lastSyncedAt: row.last_synced_at,
        syncStatus: row.sync_status,
        syncError: row.sync_error
      }));

      res.json({ mappings });
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
