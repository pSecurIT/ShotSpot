/**
 * Twizzit Sync Service
 * Orchestrates data synchronization between ShotSpot and Twizzit API
 */

import db from '../db.js';
import TwizzitApiClient from './twizzit-api-client.js';
import { getCredentials, updateVerificationTimestamp } from './twizzit-auth.js';

const SYNC_OPTIONS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SYNC_OPTIONS_ERROR_TTL_MS = 15 * 60 * 1000; // 15 minutes (avoid hammering on quota/429)
const syncOptionsCache = new Map();
const syncOptionsErrorCache = new Map();

function makeSyncOptionsCacheKey(credentialId, options = {}) {
  const organizationId = options.organizationId ? String(options.organizationId) : '';
  const seasonId = options.seasonId ? String(options.seasonId) : '';
  const includeAccess = options.includeAccess ? '1' : '0';
  return `${credentialId}|org:${organizationId}|season:${seasonId}|access:${includeAccess}`;
}

function getCachedSyncOptions(credentialId, options = {}) {
  const key = makeSyncOptionsCacheKey(credentialId, options);
  const now = Date.now();

  const cachedError = syncOptionsErrorCache.get(key);
  if (cachedError && cachedError.expiresAt > now) {
    const err = new Error(cachedError.message);
    err.status = cachedError.status;
    err.details = cachedError.details;
    throw err;
  }

  const cached = syncOptionsCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  return null;
}

function setCachedSyncOptions(credentialId, options = {}, value) {
  const key = makeSyncOptionsCacheKey(credentialId, options);
  syncOptionsCache.set(key, { value, expiresAt: Date.now() + SYNC_OPTIONS_CACHE_TTL_MS });
  syncOptionsErrorCache.delete(key);
}

function setCachedSyncOptionsError(credentialId, options = {}, error) {
  const key = makeSyncOptionsCacheKey(credentialId, options);
  syncOptionsErrorCache.set(key, {
    status: error?.status,
    details: error?.details,
    message: error?.message || 'Twizzit request failed',
    expiresAt: Date.now() + SYNC_OPTIONS_ERROR_TTL_MS
  });
}

/**
 * Create a Twizzit API client from stored credentials
 * @param {number} credentialId - Credential ID
 * @returns {Promise<TwizzitApiClient>} Configured API client
 */
async function createApiClient(credentialId) {
  const credentials = await getCredentials(credentialId);
  
  return new TwizzitApiClient({
    apiEndpoint: credentials.apiEndpoint,
    username: credentials.apiUsername,
    password: credentials.apiPassword,
    organizationName: credentials.organizationName
  });
}

async function createApiClientWithOptions(credentialId, options = {}) {
  const credentials = await getCredentials(credentialId);

  return new TwizzitApiClient({
    apiEndpoint: credentials.apiEndpoint,
    username: credentials.apiUsername,
    password: credentials.apiPassword,
    organizationName: credentials.organizationName,
    ...(options.organizationId ? { organizationId: String(options.organizationId) } : {})
  });
}

function pickDefaultOrganizationIdForClient(apiClient, organizations = []) {
  if (apiClient.organizationId != null && String(apiClient.organizationId).trim() !== '') return;
  if (!Array.isArray(organizations) || organizations.length === 0) return;

  const desiredName = TwizzitApiClient._normalizeName(apiClient.organizationName);
  const matched = desiredName
    ? organizations.find((o) => TwizzitApiClient._normalizeName(o?.organization_name ?? o?.name) === desiredName)
    : null;
  const chosen = matched || organizations[0];
  const id = TwizzitApiClient._extractOrganizationId(chosen);
  if (id) apiClient.organizationId = String(id);
}

async function ensureLocalClubByName(name) {
  const clubName = String(name ?? '').trim();
  if (!clubName) {
    throw new Error('Unable to resolve a local club name for Twizzit sync');
  }

  const existing = await db.query('SELECT id FROM clubs WHERE name = $1', [clubName]);
  if (existing.rows.length > 0) return existing.rows[0].id;

  try {
    const inserted = await db.query(
      'INSERT INTO clubs (name) VALUES ($1) RETURNING id',
      [clubName]
    );
    return inserted.rows[0].id;
  } catch (e) {
    // Concurrent creation or already exists.
    if (e?.code === '23505') {
      const again = await db.query('SELECT id FROM clubs WHERE name = $1', [clubName]);
      if (again.rows.length > 0) return again.rows[0].id;
    }
    throw e;
  }
}

async function resolveLocalClubIdForSync(apiClient, options = {}) {
  const requestedOrgId = options.organizationId ? String(options.organizationId) : null;
  let organizations = [];

  try {
    organizations = await apiClient.getOrganizations();
    pickDefaultOrganizationIdForClient(apiClient, organizations);
  } catch {
    organizations = [];
  }

  const effectiveOrgId = requestedOrgId || (apiClient.organizationId != null ? String(apiClient.organizationId) : null);

  const match = effectiveOrgId
    ? organizations.find((o) => {
      const id = TwizzitApiClient._extractOrganizationId(o);
      return id != null && String(id) === effectiveOrgId;
    })
    : null;

  const orgName =
    match?.organization_name ??
    match?.name ??
    apiClient.organizationName ??
    organizations?.[0]?.organization_name ??
    organizations?.[0]?.name ??
    null;

  return ensureLocalClubByName(orgName);
}

function mapTwizzitGroupToOption(group) {
  // Twizzit sometimes exposes season-specific "group relation" identifiers
  // (used by the Twizzit UI) in addition to a base group id.
  const nestedGroup =
    group?.group ??
    group?.groupInfo ??
    group?.group_info ??
    group?.baseGroup ??
    group?.base_group ??
    null;

  const nestedRelation =
    group?.groupRelation ??
    group?.group_relation ??
    group?.relation ??
    group?.relationInfo ??
    group?.relation_info ??
    null;

  const nestedRelationId =
    nestedRelation?.id ??
    nestedRelation?.groupRelationId ??
    nestedRelation?.group_relation_id ??
    nestedRelation?.relationId ??
    nestedRelation?.relation_id ??
    null;

  const explicitRelationId =
    nestedRelationId ??
    group?.groupRelationId ??
    group?.group_relation_id ??
    group?.group_relationId ??
    group?.groupRelation_id ??
    group?.relationId ??
    group?.relation_id;

  const baseGroupId =
    group?.group_id ??
    group?.groupId ??
    group?.['group-id'] ??
    nestedGroup?.id ??
    nestedGroup?.group_id;

  // If this is a relation row, `id` is often the relation id and `group_id` is the base.
  const inferredRelationId =
    group?.id != null && baseGroupId != null && String(group.id) !== String(baseGroupId)
      ? group.id
      : null;

  const id =
    explicitRelationId ??
    inferredRelationId ??
    group?.id ??
    baseGroupId;

  const name =
    group?.name ??
    group?.group_name ??
    group?.['group-name'] ??
    nestedGroup?.name ??
    nestedGroup?.group_name;

  return {
    id: id != null ? String(id) : '',
    name: name != null ? String(name) : ''
  };
}

function normalizeSeasonName(value) {
  if (value == null) return '';
  return String(value)
    .trim()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function extractTwizzitSeasonInfo(value, options = {}) {
  if (value == null) return { id: null, name: null };

  const allowGenericName = Boolean(options.allowGenericName);

  // Strings often represent the season label (e.g. "2025-2026").
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const looksLikeSeasonLabel = /\b\d{4}\s*[-–—]\s*\d{4}\b/.test(trimmed);
    return looksLikeSeasonLabel ? { id: null, name: trimmed } : { id: null, name: null };
  }

  if (typeof value !== 'object') return { id: null, name: null };

  let id = null;
  let name = null;

  const idKeys = ['seasonId', 'season_id', 'season-id', 'seasonIds', 'season_ids', 'season-ids'];
  for (const k of idKeys) {
    const v = value?.[k];
    if (v == null) continue;
    if (Array.isArray(v)) {
      const first = v.find((x) => x != null && String(x).trim() !== '');
      if (first != null) {
        id = String(first);
        break;
      }
    } else if (String(v).trim() !== '') {
      id = String(v);
      break;
    }
  }

  // IMPORTANT: do NOT include a generic `name` key by default, because groups
  // themselves have `name` (group name like "Kern") which would break season filtering.
  // When we are parsing a nested season object, we allow `name`.
  const nameKeys = allowGenericName
    ? ['seasonName', 'season_name', 'season-name', 'seasonLabel', 'season_label', 'season-label', 'label', 'name']
    : ['seasonName', 'season_name', 'season-name', 'seasonLabel', 'season_label', 'season-label', 'label'];
  for (const k of nameKeys) {
    const v = value?.[k];
    if (v == null) continue;
    if (String(v).trim() !== '') {
      name = String(v);
      break;
    }
  }

  // Some Twizzit objects may carry nested season info.
  const nested = value?.seasonInfo ?? value?.season_info ?? value?.seasonData ?? value?.season_data ?? value?.season;
  if (nested != null && (id == null || name == null)) {
    // Nested season objects commonly use `{ id, name }`.
    const extracted = extractTwizzitSeasonInfo(nested, { allowGenericName: true });
    if (id == null && extracted.id != null) id = extracted.id;
    if (name == null && extracted.name != null) name = extracted.name;
  }

  // Some group payloads use `season` as a season label string.
  if (name == null && typeof value?.season === 'string') {
    const extracted = extractTwizzitSeasonInfo(value.season);
    if (extracted.name != null) name = extracted.name;
  }

  return { id, name };
}

function filterGroupsBySeason(groups = [], season) {
  const seasonId = season?.seasonId ? String(season.seasonId) : null;
  const seasonName = season?.seasonName ? String(season.seasonName) : null;

  if (!seasonId && !seasonName) return groups;
  if (!Array.isArray(groups) || groups.length === 0) return groups;

  const normalizedTargetName = seasonName ? normalizeSeasonName(seasonName) : '';

  let anyHasName = false;
  let anyHasId = false;
  for (const g of groups) {
    const info = extractTwizzitSeasonInfo(g);
    if (info.name != null) anyHasName = true;
    if (info.id != null) anyHasId = true;
    if (anyHasName && anyHasId) break;
  }

  // Prefer filtering by season *name* when available, because Twizzit sometimes
  // exposes season as a label like "2025-2026" on groups.
  if (seasonName && anyHasName) {
    return groups.filter((g) => {
      const info = extractTwizzitSeasonInfo(g);
      return info.name != null && normalizeSeasonName(info.name) === normalizedTargetName;
    });
  }

  if (seasonId && anyHasId) {
    return groups.filter((g) => {
      const info = extractTwizzitSeasonInfo(g);
      return info.id != null && String(info.id) === seasonId;
    });
  }

  return groups;
}

function mapTwizzitSeasonToOption(season) {
  const id = season?.id ?? season?.season_id;
  const name = season?.name ?? season?.season_name;

  return {
    id: id != null ? String(id) : '',
    name: name != null ? String(name) : ''
  };
}

function mapTwizzitOrganizationToOption(org) {
  const id = org?.organization_id ?? org?.id ?? org?.organizationId;
  const name = org?.organization_name ?? org?.name ?? org?.organizationName;

  return {
    id: id != null ? String(id) : '',
    name: name != null ? String(name) : ''
  };
}

async function getOrganizationAccess(apiClient, orgOptions) {
  const checks = await Promise.allSettled(
    orgOptions.map(async (org) => {
      const [groupsRes, seasonsRes] = await Promise.allSettled([
        apiClient.getGroups({ 'organization-ids[]': org.id, limit: 1 }),
        apiClient.getSeasons({ 'organization-ids[]': org.id, limit: 1 })
      ]);

      return {
        id: org.id,
        name: org.name,
        canFetchGroups: groupsRes.status === 'fulfilled',
        canFetchSeasons: seasonsRes.status === 'fulfilled',
        groupsError: groupsRes.status === 'rejected' ? (groupsRes.reason?.message || 'Failed to fetch groups') : null,
        seasonsError: seasonsRes.status === 'rejected' ? (seasonsRes.reason?.message || 'Failed to fetch seasons') : null
      };
    })
  );

  return checks
    .filter((c) => c.status === 'fulfilled')
    .map((c) => c.value);
}

/**
 * Fetch selectable groups (teams) and seasons from Twizzit for dropdowns.
 */
export async function getRemoteSyncOptions(credentialId, options = {}) {
  const cached = getCachedSyncOptions(credentialId, options);
  if (cached) return cached;

  const apiClient = await createApiClient(credentialId);

  try {
    const organizations = await apiClient.getOrganizations();
    pickDefaultOrganizationIdForClient(apiClient, organizations);
    const orgOptions = organizations.map(mapTwizzitOrganizationToOption).filter((o) => o.id && o.name);

    const warnings = [];
    const [groupsSettled, seasonsSettled] = await Promise.allSettled([
      apiClient.getGroups(options.seasonId ? { seasonId: String(options.seasonId) } : {}),
      apiClient.getSeasons()
    ]);

    const groupsResult = groupsSettled.status === 'fulfilled' ? groupsSettled.value : null;
    const seasonsResult = seasonsSettled.status === 'fulfilled' ? seasonsSettled.value : null;

    if (groupsSettled.status === 'rejected') {
      warnings.push(groupsSettled.reason?.message || 'Failed to fetch groups from Twizzit');
    }
    if (seasonsSettled.status === 'rejected') {
      warnings.push(seasonsSettled.reason?.message || 'Failed to fetch seasons from Twizzit');
    }

    const seasonId = options.seasonId != null && String(options.seasonId).trim() !== ''
      ? String(options.seasonId)
      : null;

    const seasons = (seasonsResult?.seasons ?? [])
      .map(mapTwizzitSeasonToOption)
      .filter((s) => s.id && s.name);

    const seasonName = seasonId
      ? (seasons.find((s) => s.id === seasonId)?.name ?? null)
      : null;

    const groups = filterGroupsBySeason((groupsResult?.groups ?? []), { seasonId, seasonName })
      .map(mapTwizzitGroupToOption)
      .filter((g) => g.id && g.name);

    const defaultOrganizationId = apiClient.organizationId ? String(apiClient.organizationId) : undefined;
    const defaultOrganizationName = defaultOrganizationId
      ? orgOptions.find((o) => o.id === defaultOrganizationId)?.name
      : undefined;

    const includeAccess = Boolean(options.includeAccess);
    let organizationAccess = undefined;
    if (includeAccess) {
      // Access checks can get expensive quickly; only check the default/selected org.
      const defaultOrgId = apiClient.organizationId ? String(apiClient.organizationId) : null;
      const targets = defaultOrgId ? orgOptions.filter((o) => o.id === defaultOrgId) : orgOptions.slice(0, 1);
      organizationAccess = targets.length ? await getOrganizationAccess(apiClient, targets) : undefined;

      if (orgOptions.length > (targets.length || 1)) {
        warnings.push('Access checks are limited to the selected/default organization to reduce Twizzit API usage.');
      }
    }

    const result = {
      organizations: orgOptions,
      groups,
      seasons,
      ...(defaultOrganizationId ? { defaultOrganizationId } : {}),
      ...(defaultOrganizationName ? { defaultOrganizationName } : {}),
      ...(warnings.length ? { warnings } : {}),
      ...(organizationAccess ? { organizationAccess } : {})
    };

    setCachedSyncOptions(credentialId, options, result);
    return result;
  } catch (error) {
    // If Twizzit is rate-limiting/quota-limiting, cache the error briefly to avoid repeated hits.
    if (error?.status === 429) {
      setCachedSyncOptionsError(credentialId, options, error);
    }
    throw error;
  }
}

export async function getRemoteSyncOptionsForOrganization(credentialId, options = {}) {
  const cached = getCachedSyncOptions(credentialId, options);
  if (cached) return cached;

  const apiClient = await createApiClientWithOptions(credentialId, options);

  try {
    const organizations = await apiClient.getOrganizations();
    pickDefaultOrganizationIdForClient(apiClient, organizations);
    const orgOptions = organizations.map(mapTwizzitOrganizationToOption).filter((o) => o.id && o.name);

    const warnings = [];
    const [groupsSettled, seasonsSettled] = await Promise.allSettled([
      apiClient.getGroups(options.seasonId ? { seasonId: String(options.seasonId) } : {}),
      apiClient.getSeasons()
    ]);

    const groupsResult = groupsSettled.status === 'fulfilled' ? groupsSettled.value : null;
    const seasonsResult = seasonsSettled.status === 'fulfilled' ? seasonsSettled.value : null;

    if (groupsSettled.status === 'rejected') {
      warnings.push(groupsSettled.reason?.message || 'Failed to fetch groups from Twizzit');
    }
    if (seasonsSettled.status === 'rejected') {
      warnings.push(seasonsSettled.reason?.message || 'Failed to fetch seasons from Twizzit');
    }

    const seasonId = options.seasonId != null && String(options.seasonId).trim() !== ''
      ? String(options.seasonId)
      : null;

    const seasons = (seasonsResult?.seasons ?? [])
      .map(mapTwizzitSeasonToOption)
      .filter((s) => s.id && s.name);

    const seasonName = seasonId
      ? (seasons.find((s) => s.id === seasonId)?.name ?? null)
      : null;

    const groups = filterGroupsBySeason((groupsResult?.groups ?? []), { seasonId, seasonName })
      .map(mapTwizzitGroupToOption)
      .filter((g) => g.id && g.name);

    const defaultOrganizationId = apiClient.organizationId ? String(apiClient.organizationId) : undefined;
    const defaultOrganizationName = defaultOrganizationId
      ? orgOptions.find((o) => o.id === defaultOrganizationId)?.name
      : undefined;

    const includeAccess = Boolean(options.includeAccess);
    let organizationAccess = undefined;
    if (includeAccess) {
      // For the org-specific endpoint, only check access for that org.
      const targetOrgId = options.organizationId ? String(options.organizationId) : (apiClient.organizationId ? String(apiClient.organizationId) : null);
      const targets = targetOrgId ? orgOptions.filter((o) => o.id === targetOrgId) : orgOptions.slice(0, 1);
      organizationAccess = targets.length ? await getOrganizationAccess(apiClient, targets) : undefined;

      if (orgOptions.length > (targets.length || 1)) {
        warnings.push('Access checks are limited to the selected organization to reduce Twizzit API usage.');
      }
    }

    const result = {
      organizations: orgOptions,
      groups,
      seasons,
      ...(defaultOrganizationId ? { defaultOrganizationId } : {}),
      ...(defaultOrganizationName ? { defaultOrganizationName } : {}),
      ...(warnings.length ? { warnings } : {}),
      ...(organizationAccess ? { organizationAccess } : {})
    };

    setCachedSyncOptions(credentialId, options, result);
    return result;
  } catch (error) {
    if (error?.status === 429) {
      setCachedSyncOptionsError(credentialId, options, error);
    }
    throw error;
  }
}

/**
 * Preview which teams (Twizzit groups) would be synced.
 */
export async function previewTeamsFromTwizzit(credentialId, options = {}) {
  const apiClient = await createApiClientWithOptions(credentialId, options);
  const groupId = options.groupId ? String(options.groupId) : null;
  const seasonId = options.seasonId != null && String(options.seasonId).trim() !== ''
    ? String(options.seasonId)
    : null;

  if (groupId) {
    // When the UI selects a season, the group id can be a season-scoped relation id.
    // Twizzit does not reliably support fetching that id via `/groups?id=...` without
    // including season context, so resolve it via a season-filtered groups list first.
    if (seasonId) {
      try {
        const seasonGroups = await apiClient.getGroups({ seasonId });
        const rows = Array.isArray(seasonGroups?.groups) ? seasonGroups.groups : [];

        const match = rows.find((row) => {
          const option = mapTwizzitGroupToOption(row);
          return option.id && option.id === groupId;
        });

        if (match) {
          return { total: 1, teams: [mapTwizzitGroupToOption(match)] };
        }
      } catch {
        // Fall back to direct lookup.
      }
    }

    try {
      const group = await apiClient.getGroup(groupId);
      return { total: 1, teams: [mapTwizzitGroupToOption(group)] };
    } catch (e) {
      const err = new Error(`Group not found: ${groupId}`);
      err.status = e?.status || 404;
      err.details = e?.details;
      throw err;
    }
  }

  let seasonName = null;
  if (seasonId) {
    try {
      const seasonsResult = await apiClient.getSeasons();
      const seasons = (seasonsResult?.seasons ?? [])
        .map(mapTwizzitSeasonToOption)
        .filter((s) => s.id && s.name);
      seasonName = seasons.find((s) => s.id === seasonId)?.name ?? null;
    } catch {
      // Ignore seasons lookup failures; we'll fall back to id-based filtering or none.
    }
  }

  const result = await apiClient.getGroups(seasonId ? { seasonId } : {});
  const teams = filterGroupsBySeason((result?.groups ?? []), { seasonId, seasonName })
    .map(mapTwizzitGroupToOption)
    .filter((t) => t.id && t.name);

  return { total: teams.length, teams };
}

/**
 * Preview which players would be synced for the selected team and season.
 */
export async function previewPlayersFromTwizzit(credentialId, options = {}) {
  const apiClient = await createApiClientWithOptions(credentialId, options);
  const groupId = options.groupId ? String(options.groupId) : null;

  if (!groupId) {
    throw new Error('groupId is required');
  }

  const seasonId = options.seasonId != null && String(options.seasonId).trim() !== ''
    ? String(options.seasonId)
    : null;

  // Season filtering support varies across Twizzit accounts; we attempt it when provided.
  const result = await apiClient.getGroupContacts(groupId, seasonId ? { seasonId } : {});
  const contacts = Array.isArray(result?.contacts) ? result.contacts : [];

  const players = contacts.map((c) => {
    const firstName = c?.first_name ?? c?.firstName ?? c?.['first-name'] ?? '';
    const lastName = c?.last_name ?? c?.lastName ?? c?.['last-name'] ?? '';
    const fullName = c?.name ?? '';
    const fallbackFirstName = !firstName && typeof fullName === 'string' ? fullName.split(' ')[0] : '';
    const fallbackLastName = !lastName && typeof fullName === 'string'
      ? fullName.split(' ').slice(1).join(' ')
      : '';
    return {
      id: c.id != null ? String(c.id) : String(c.contact_id ?? ''),
      firstName: String(firstName || fallbackFirstName),
      lastName: String(lastName || fallbackLastName)
    };
  });

  return { total: players.length, players };
}

/**
 * Log sync operation to history
 * @param {Object} syncData - Sync operation data
 * @returns {Promise<number>} Sync history ID
 */
async function logSyncHistory(syncData) {
  const {
    credentialId,
    syncType,
    syncDirection,
    status,
    itemsProcessed = 0,
    itemsSucceeded = 0,
    itemsFailed = 0,
    errorMessage = null,
    startedAt,
    completedAt = null
  } = syncData;

  try {
    const result = await db.query(
      `INSERT INTO twizzit_sync_history 
       (credential_id, sync_type, sync_direction, status, 
        items_processed, items_succeeded, items_failed, error_message,
        started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        credentialId,
        syncType,
        syncDirection,
        status,
        itemsProcessed,
        itemsSucceeded,
        itemsFailed,
        errorMessage,
        startedAt,
        completedAt
      ]
    );

    return result.rows[0].id;
  } catch (error) {
    console.error('Failed to log sync history:', error);
    throw error;
  }
}

/**
 * Update sync history record
 * @param {number} syncId - Sync history ID
 * @param {Object} updates - Fields to update
 */
async function updateSyncHistory(syncId, updates) {
  const {
    status,
    itemsProcessed,
    itemsSucceeded,
    itemsFailed,
    errorMessage,
    completedAt
  } = updates;

  try {
    await db.query(
      `UPDATE twizzit_sync_history 
       SET status = COALESCE($2, status),
           items_processed = COALESCE($3, items_processed),
           items_succeeded = COALESCE($4, items_succeeded),
           items_failed = COALESCE($5, items_failed),
           error_message = COALESCE($6, error_message),
           completed_at = COALESCE($7, completed_at)
       WHERE id = $1`,
      [syncId, status, itemsProcessed, itemsSucceeded, itemsFailed, errorMessage, completedAt]
    );
  } catch (error) {
    console.error('Failed to update sync history:', error);
    throw error;
  }
}

/**
 * Sync clubs from Twizzit to ShotSpot
 * @param {number} credentialId - Credential ID
 * @param {Object} options - Sync options
 * @returns {Promise<Object>} Sync results
 */
export async function syncClubsFromTwizzit(credentialId, options = {}) {
  const startTime = new Date();
  const syncId = await logSyncHistory({
    credentialId,
    syncType: 'clubs',
    syncDirection: 'import',
    status: 'in_progress',
    startedAt: startTime
  });

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const errors = [];

  try {
    const apiClient = await createApiClientWithOptions(credentialId, options);
    
    // Verify connection
    const isConnected = await apiClient.verifyConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to Twizzit API');
    }

    await updateVerificationTimestamp(credentialId);

    // Twizzit "organization" maps to a local ShotSpot club.
    const localClubIdForTeams = await resolveLocalClubIdForSync(apiClient, options);

    const selectedGroupId = options.groupId ? String(options.groupId) : null;
    const seasonId = options.seasonId != null && String(options.seasonId).trim() !== ''
      ? String(options.seasonId)
      : null;
    const createMissing = options.createMissing !== false;

    // Fetch teams (groups in Twizzit terminology)
    let allTeams = [];
    if (selectedGroupId) {
      // When a season is selected, the UI can provide a season-scoped relation id.
      // Resolve it via a season-filtered list first (same approach as preview).
      if (seasonId) {
        try {
          const seasonGroups = await apiClient.getGroups({ seasonId });
          const rows = Array.isArray(seasonGroups?.groups) ? seasonGroups.groups : [];
          const match = rows.find((row) => {
            const option = mapTwizzitGroupToOption(row);
            return option.id && option.id === selectedGroupId;
          });

          if (match) {
            allTeams = [match];
          }
        } catch {
          // Fall back to direct lookup.
        }
      }

      if (allTeams.length === 0) {
        const team = await apiClient.getTeam(selectedGroupId);
        allTeams = [team];
      }
    } else {
      // If seasonId is provided, fetch season-scoped groups in one call.
      if (seasonId) {
        const result = await apiClient.getTeams({ seasonId });
        allTeams.push(...(result.teams ?? []));
      } else {
        let hasMore = true;
        let page = 1;

        while (hasMore) {
          const result = await apiClient.getTeams({ page, limit: 100 });
          allTeams.push(...(result.teams ?? []));
          hasMore = result.hasMore;
          page++;
        }
      }
    }

    // Process each team (Twizzit group) and create/update a local ShotSpot team.
    for (const twizzitTeam of allTeams) {
      processed++;

      try {
        // Mapping table name is legacy: `local_club_id` actually points to `teams.id`.
        const existingMapping = await db.query(
          'SELECT * FROM twizzit_team_mappings WHERE twizzit_team_id = $1',
          [twizzitTeam.id]
        );

        let localTeamId;

        if (existingMapping.rows.length > 0) {
          // Update existing local team
          localTeamId = existingMapping.rows[0].local_club_id;

          await db.query(
            `UPDATE teams
             SET name = $1,
                 club_id = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [twizzitTeam.name, localClubIdForTeams, localTeamId]
          );

          // Update mapping
          await db.query(
            `UPDATE twizzit_team_mappings 
             SET twizzit_team_name = $1, 
                 last_synced_at = CURRENT_TIMESTAMP,
                 sync_status = 'success',
                 sync_error = NULL
             WHERE id = $2`,
            [twizzitTeam.name, existingMapping.rows[0].id]
          );
        } else if (createMissing) {
          // Create or reuse local team under the resolved club.
          const existingTeam = await db.query(
            'SELECT id FROM teams WHERE club_id = $1 AND name = $2 AND season_id IS NULL',
            [localClubIdForTeams, twizzitTeam.name]
          );

          if (existingTeam.rows.length > 0) {
            localTeamId = existingTeam.rows[0].id;
          } else {
            const teamResult = await db.query(
              'INSERT INTO teams (club_id, name, is_active) VALUES ($1, $2, true) RETURNING id',
              [localClubIdForTeams, twizzitTeam.name]
            );
            localTeamId = teamResult.rows[0].id;
          }

          // Create mapping
          await db.query(
            `INSERT INTO twizzit_team_mappings 
             (local_club_id, twizzit_team_id, twizzit_team_name, 
              last_synced_at, sync_status)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'success')`,
            [localTeamId, twizzitTeam.id, twizzitTeam.name]
          );
        } else {
          // Skip teams that aren't mapped when createMissing is disabled
          processed--;
          continue;
        }

        succeeded++;

        // Optionally sync players for this team
        if (options.includePlayers) {
          await syncTeamPlayers(credentialId, twizzitTeam.id, localTeamId, {
            seasonId: options.seasonId,
            organizationId: options.organizationId
          });
        }
      } catch (error) {
        failed++;
        errors.push({
          teamId: twizzitTeam.id,
          teamName: twizzitTeam.name,
          error: error.message
        });

        // Update mapping with error
        try {
          await db.query(
            `UPDATE twizzit_team_mappings 
             SET sync_status = 'error', 
                 sync_error = $1,
                 last_synced_at = CURRENT_TIMESTAMP
             WHERE twizzit_team_id = $2`,
            [error.message, twizzitTeam.id]
          );
        } catch (_err) {
          // Ignore mapping update errors
        }
      }
    }

    // Update sync history with success
    await updateSyncHistory(syncId, {
      status: failed > 0 ? 'partial_success' : 'success',
      itemsProcessed: processed,
      itemsSucceeded: succeeded,
      itemsFailed: failed,
      errorMessage: errors.length > 0 ? JSON.stringify(errors) : null,
      completedAt: new Date()
    });

    return {
      success: true,
      syncId,
      message: 'Teams synced successfully',
      processed,
      succeeded,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      duration: Date.now() - startTime.getTime()
    };
  } catch (error) {
    // Update sync history with failure
    await updateSyncHistory(syncId, {
      status: 'failed',
      itemsProcessed: processed,
      itemsSucceeded: succeeded,
      itemsFailed: failed,
      errorMessage: error.message,
      completedAt: new Date()
    });

    throw new Error(`Club sync failed: ${error.message}`);
  }
}

/**
 * Sync players for a specific team
 * @param {number} credentialId - Credential ID
 * @param {string} twizzitTeamId - Twizzit group/team id
 * @param {number} localTeamId - Local team ID
 * @returns {Promise<Object>} Sync results
 */
async function syncTeamPlayers(credentialId, twizzitTeamId, localTeamId, options = {}) {
  const apiClient = await createApiClientWithOptions(credentialId, options);

  const teamRow = await db.query('SELECT club_id FROM teams WHERE id = $1', [localTeamId]);
  if (teamRow.rows.length === 0) {
    throw new Error('Local team not found for player sync');
  }

  const localClubId = teamRow.rows[0].club_id;
  
  // Get club mapping (team_mappings stores club mappings after migration)
  const mappingResult = await db.query(
    'SELECT id FROM twizzit_team_mappings WHERE twizzit_team_id = $1',
    [twizzitTeamId]
  );

  if (mappingResult.rows.length === 0) {
    throw new Error('Club mapping not found');
  }

  const teamMappingId = mappingResult.rows[0].id;

  // Fetch all players (handle pagination)
  let hasMore = true;
  let page = 1;
  const allPlayers = [];

  const filters = {};
  if (options.seasonId) {
    filters.season_id = String(options.seasonId);
  }

  while (hasMore) {
    const result = await apiClient.getTeamPlayers(twizzitTeamId, { page, limit: 100, filters });
    allPlayers.push(...result.players);
    hasMore = result.hasMore;
    page++;
  }

  let succeeded = 0;
  let failed = 0;

  const normalizeNameValue = (value) => {
    if (value == null) return null;
    const str = String(value).trim();
    return str.length ? str : null;
  };

  const extractPlayerName = (twizzitPlayer) => {
    let firstName = normalizeNameValue(
      twizzitPlayer?.first_name ??
      twizzitPlayer?.firstName ??
      twizzitPlayer?.firstname ??
      twizzitPlayer?.given_name ??
      twizzitPlayer?.givenName
    );

    let lastName = normalizeNameValue(
      twizzitPlayer?.last_name ??
      twizzitPlayer?.lastName ??
      twizzitPlayer?.lastname ??
      twizzitPlayer?.family_name ??
      twizzitPlayer?.familyName ??
      twizzitPlayer?.surname
    );

    if (!firstName || !lastName) {
      const fullName = normalizeNameValue(
        twizzitPlayer?.full_name ??
        twizzitPlayer?.fullName ??
        twizzitPlayer?.displayName ??
        twizzitPlayer?.name
      );

      if (fullName) {
        const parts = fullName.split(/\s+/).filter(Boolean);
        if (!firstName && parts.length >= 1) firstName = parts[0];
        if (!lastName && parts.length >= 2) lastName = parts.slice(1).join(' ');
      }
    }

    return { firstName, lastName };
  };

  const normalizeGenderValue = (value) => {
    if (value == null) return null;

    if (typeof value === 'number') {
      // Common encodings: 1/2 or 0/1/2.
      if (value === 1) return 'male';
      if (value === 2) return 'female';
      return null;
    }

    const raw = String(value).trim();
    if (!raw) return null;
    const v = raw.toLowerCase();

    if (v === 'm' || v === 'male' || v === 'man' || v === 'masculine') return 'male';
    if (v === 'f' || v === 'female' || v === 'vrouw' || v === 'woman' || v === 'feminine') return 'female';

    // Sometimes encoded as strings "1"/"2".
    if (v === '1') return 'male';
    if (v === '2') return 'female';

    return null;
  };

  const extractGender = (twizzitPlayer) => {
    return normalizeGenderValue(
      twizzitPlayer?.gender ??
      twizzitPlayer?.sex ??
      twizzitPlayer?.gender_code ??
      twizzitPlayer?.genderCode ??
      twizzitPlayer?.sex_code ??
      twizzitPlayer?.sexCode
    );
  };

  // Process each player
  for (const twizzitPlayer of allPlayers) {
    try {
      const { firstName, lastName } = extractPlayerName(twizzitPlayer);
      const gender = extractGender(twizzitPlayer);
      if (!firstName || !lastName) {
        failed++;
        console.warn('[twizzit] Skipping player with missing name fields', {
          twizzitPlayerId: String(twizzitPlayer?.id ?? twizzitPlayer?.contact_id ?? twizzitPlayer?.contactId ?? ''),
          hasFirstName: Boolean(firstName),
          hasLastName: Boolean(lastName)
        });
        continue;
      }

      // Check if player already exists in mapping
      const existingMapping = await db.query(
        'SELECT * FROM twizzit_player_mappings WHERE twizzit_player_id = $1',
        [twizzitPlayer.id]
      );

      let localPlayerId;

      if (existingMapping.rows.length > 0) {
        // Update existing player
        localPlayerId = existingMapping.rows[0].local_player_id;
        
        await db.query(
          `UPDATE players 
           SET club_id = $1,
               team_id = $2,
               first_name = $3, 
               last_name = $4, 
               jersey_number = $5,
               gender = COALESCE($6, gender),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $7`,
          [
            localClubId,
            localTeamId,
            firstName,
            lastName,
            twizzitPlayer.jersey_number || twizzitPlayer.jerseyNumber,
            gender,
            localPlayerId
          ]
        );

        // Update mapping
        await db.query(
          `UPDATE twizzit_player_mappings 
           SET twizzit_player_name = $1, 
               last_synced_at = CURRENT_TIMESTAMP,
               sync_status = 'success',
               sync_error = NULL
           WHERE id = $2`,
          [
            `${twizzitPlayer.first_name || twizzitPlayer.firstName} ${twizzitPlayer.last_name || twizzitPlayer.lastName}`,
            existingMapping.rows[0].id
          ]
        );
      } else {
        // Create new player, linking it to both club and team
        const playerResult = await db.query(
          `INSERT INTO players 
           (club_id, team_id, first_name, last_name, jersey_number, gender, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)
           RETURNING id`,
          [
            localClubId,
            localTeamId,
            firstName,
            lastName,
            twizzitPlayer.jersey_number || twizzitPlayer.jerseyNumber,
            gender
          ]
        );
        localPlayerId = playerResult.rows[0].id;

        // Create mapping
        await db.query(
          `INSERT INTO twizzit_player_mappings 
           (local_player_id, twizzit_player_id, twizzit_player_name, 
            team_mapping_id, last_synced_at, sync_status)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 'success')`,
          [
            localPlayerId,
            twizzitPlayer.id,
            `${twizzitPlayer.first_name || twizzitPlayer.firstName} ${twizzitPlayer.last_name || twizzitPlayer.lastName}`,
            teamMappingId
          ]
        );
      }

      succeeded++;
    } catch (error) {
      failed++;
      console.error(`Failed to sync player ${twizzitPlayer.id}:`, error);
    }
  }

  return { succeeded, failed, total: allPlayers.length };
}

/**
 * Sync players from Twizzit to ShotSpot
 * @param {number} credentialId - Credential ID
 * @param {Object} _options - Sync options (reserved for future use)
 * @returns {Promise<Object>} Sync results
 */
export async function syncPlayersFromTwizzit(credentialId, _options = {}) {
  const startTime = new Date();
  const syncId = await logSyncHistory({
    credentialId,
    syncType: 'players',
    syncDirection: 'import',
    status: 'in_progress',
    startedAt: startTime
  });

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  try {
    const options = _options || {};
    const selectedGroupId = options.groupId ? String(options.groupId) : null;
    const createMissing = options.createMissing !== false;
    const seasonId = options.seasonId != null && String(options.seasonId).trim() !== ''
      ? String(options.seasonId)
      : null;
    const organizationId = options.organizationId ? String(options.organizationId) : undefined;

    const mappingsToSync = [];

    if (selectedGroupId) {
      // Ensure mapping exists (optionally create via team sync)
      let mappingResult = await db.query(
        'SELECT twizzit_team_id, local_club_id FROM twizzit_team_mappings WHERE twizzit_team_id = $1',
        [selectedGroupId]
      );

      if (mappingResult.rows.length === 0 && createMissing) {
        await syncClubsFromTwizzit(credentialId, {
          groupId: selectedGroupId,
          seasonId,
          organizationId,
          createMissing: true
        });
        mappingResult = await db.query(
          'SELECT twizzit_team_id, local_club_id FROM twizzit_team_mappings WHERE twizzit_team_id = $1',
          [selectedGroupId]
        );
      }

      if (mappingResult.rows.length === 0) {
        throw new Error('Selected team is not mapped locally. Enable createMissing or sync teams first.');
      }

      mappingsToSync.push(mappingResult.rows[0]);
    } else {
      // Get all club mappings (team_mappings table stores club mappings after migration)
      const clubMappingsResult = await db.query(
        'SELECT twizzit_team_id, local_club_id FROM twizzit_team_mappings'
      );
      mappingsToSync.push(...clubMappingsResult.rows);
    }

    // Sync players for each mapped club
    for (const mapping of mappingsToSync) {
      try {
        const result = await syncTeamPlayers(
          credentialId,
          mapping.twizzit_team_id,
          mapping.local_club_id,
          { seasonId, organizationId }
        );
        
        processed += result.total;
        succeeded += result.succeeded;
        failed += result.failed;
      } catch (error) {
        console.error(`Failed to sync players for team ${mapping.twizzit_team_id}:`, error);
      }
    }

    // Update sync history
    await updateSyncHistory(syncId, {
      status: failed > 0 ? 'partial_success' : 'success',
      itemsProcessed: processed,
      itemsSucceeded: succeeded,
      itemsFailed: failed,
      completedAt: new Date()
    });

    return {
      success: true,
      syncId,
      message: 'Players synced successfully',
      processed,
      succeeded,
      failed,
      duration: Date.now() - startTime.getTime()
    };
  } catch (error) {
    await updateSyncHistory(syncId, {
      status: 'failed',
      itemsProcessed: processed,
      itemsSucceeded: succeeded,
      itemsFailed: failed,
      errorMessage: error.message,
      completedAt: new Date()
    });

    throw new Error(`Player sync failed: ${error.message}`);
  }
}

/**
 * Get sync configuration
 * @param {number} credentialId - Credential ID
 * @returns {Promise<Object>} Sync configuration
 */
export async function getSyncConfig(credentialId) {
  try {
    const result = await db.query(
      'SELECT * FROM twizzit_sync_config WHERE credential_id = $1',
      [credentialId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const config = result.rows[0];
    return {
      id: config.id,
      credentialId: config.credential_id,
      syncTeams: config.sync_teams,
      syncPlayers: config.sync_players,
      syncCompetitions: config.sync_competitions,
      syncIntervalMinutes: config.sync_interval_minutes,
      autoSyncEnabled: config.auto_sync_enabled,
      lastSyncAt: config.last_sync_at,
      nextSyncAt: config.next_sync_at
    };
  } catch (error) {
    throw new Error(`Failed to get sync config: ${error.message}`);
  }
}

/**
 * Ensure sync configuration exists (creates default row if missing)
 * @param {number} credentialId - Credential ID
 * @returns {Promise<Object|null>} Sync configuration or null if credential doesn't exist
 */
export async function ensureSyncConfig(credentialId) {
  try {
    const credentialExists = await db.query(
      'SELECT 1 FROM twizzit_credentials WHERE id = $1',
      [credentialId]
    );

    if (credentialExists.rows.length === 0) {
      return null;
    }

    await db.query(
      `INSERT INTO twizzit_sync_config (credential_id)
       VALUES ($1)
       ON CONFLICT (credential_id) DO NOTHING`,
      [credentialId]
    );

    return await getSyncConfig(credentialId);
  } catch (error) {
    throw new Error(`Failed to ensure sync config: ${error.message}`);
  }
}

/**
 * Update sync configuration
 * @param {number} credentialId - Credential ID
 * @param {Object} config - Configuration updates
 * @returns {Promise<Object>} Updated configuration
 */
export async function updateSyncConfig(credentialId, config) {
  try {
    const result = await db.query(
      `INSERT INTO twizzit_sync_config 
       (credential_id, sync_teams, sync_players, sync_competitions, 
        sync_interval_minutes, auto_sync_enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (credential_id)
       DO UPDATE SET
         sync_teams = COALESCE($2, twizzit_sync_config.sync_teams),
         sync_players = COALESCE($3, twizzit_sync_config.sync_players),
         sync_competitions = COALESCE($4, twizzit_sync_config.sync_competitions),
         sync_interval_minutes = COALESCE($5, twizzit_sync_config.sync_interval_minutes),
         auto_sync_enabled = COALESCE($6, twizzit_sync_config.auto_sync_enabled),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        credentialId,
        config.syncTeams,
        config.syncPlayers,
        config.syncCompetitions,
        config.syncIntervalMinutes,
        config.autoSyncEnabled
      ]
    );

    return result.rows[0];
  } catch (error) {
    throw new Error(`Failed to update sync config: ${error.message}`);
  }
}

/**
 * Get sync history
 * @param {number} credentialId - Credential ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Sync history records
 */
export async function getSyncHistory(credentialId, options = {}) {
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  try {
    const result = await db.query(
      `SELECT * FROM twizzit_sync_history 
       WHERE credential_id = $1
       ORDER BY started_at DESC
       LIMIT $2 OFFSET $3`,
      [credentialId, limit, offset]
    );

    return result.rows;
  } catch (error) {
    throw new Error(`Failed to get sync history: ${error.message}`);
  }
}

export default {
  getRemoteSyncOptions,
  getRemoteSyncOptionsForOrganization,
  previewTeamsFromTwizzit,
  previewPlayersFromTwizzit,
  syncClubsFromTwizzit,
  syncPlayersFromTwizzit,
  ensureSyncConfig,
  getSyncConfig,
  updateSyncConfig,
  getSyncHistory
};
