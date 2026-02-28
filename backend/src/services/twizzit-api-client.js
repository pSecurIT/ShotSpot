/**
 * Twizzit API Client
 * Handles communication with the Belgian Korfball Federation API
 */

import axios from 'axios';

class TwizzitApiClient {
  static _tokenCache = new Map();
  static _authInFlight = new Map();

  static _getTokenCacheKey(apiEndpoint, username) {
    return `${String(apiEndpoint ?? '')}|${String(username ?? '')}`;
  }

  constructor(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('TwizzitApiClient requires a configuration object');
    }

    this.apiEndpoint = config.apiEndpoint || 'https://app.twizzit.com';
    this.username = config.username;
    this.password = config.password;
    this.timeout = config.timeout || 30000;
    this.organizationName = config.organizationName || null;
    this.organizationId = config.organizationId || null;
    this.accessToken = null;
    this.tokenExpiry = null;

    // Validate required configuration
    if (!this.apiEndpoint) {
      throw new Error('Twizzit API endpoint is required');
    }
    if (!this.username) {
      throw new Error('Twizzit API username is required');
    }
    if (!this.password) {
      throw new Error('Twizzit API password is required');
    }

    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.apiEndpoint,
      timeout: this.timeout,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ShotSpot-TwizzitSync/1.0'
      },
      paramsSerializer: {
        serialize: (params) => {
          // Manually serialize params to handle arrays properly
          const parts = [];
          for (const [key, value] of Object.entries(params)) {
            if (Array.isArray(value)) {
              // Serialize arrays as key[]=value1&key[]=value2
              // IMPORTANT: Encode the brackets as %5B%5D for Twizzit compatibility
              value.forEach(v => {
                parts.push(`${encodeURIComponent(key + '[]')}=${encodeURIComponent(v)}`);
              });
            } else if (value != null) {
              parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
            }
          }
          return parts.join('&');
        }
      }
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use(
      async (config) => {
        if (!config) {
          return config;
        }
        // Skip auth for authenticate endpoint
        if (config.url === '/v2/api/authenticate' || config.url?.includes('/authenticate')) {
          return config;
        }

        // Ensure we have a valid token
        await this.ensureAuthenticated();
        
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
          
          if (process.env.NODE_ENV !== 'test' && process.env.TWIZZIT_DEBUG === '1') {
            console.log(`[Twizzit Auth] Token attached:`, {
              hasToken: !!this.accessToken,
              expiresIn: this.tokenExpiry ? Math.round((this.tokenExpiry - Date.now()) / 1000 / 60) + ' minutes' : 'unknown'
            });
          }
        } else if (process.env.NODE_ENV !== 'test') {
          console.warn('[Twizzit Auth] WARNING: No access token available for request!');
        }

        // Debug log the actual request URL with params
        if (process.env.NODE_ENV !== 'test' && process.env.TWIZZIT_DEBUG === '1') {
          const url = config.url;
          const params = config.params;
          // Manually build the URL to see what's actually being sent
          let fullUrl = `${config.baseURL}${url}`;
          if (params && Object.keys(params).length > 0) {
            const queryString = config.paramsSerializer.serialize(params);
            fullUrl += `?${queryString}`;
          }
          console.log(`[Twizzit API Request]`, {
            method: config.method?.toUpperCase(),
            fullUrl,
            params,
            hasAuth: !!config.headers.Authorization
          });
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (process.env.NODE_ENV !== 'test' && process.env.TWIZZIT_DEBUG === '1') {
          console.error('[Twizzit API Error]', {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            statusText: error.response?.statusText,
            hasData: !!error.response?.data,
            dataType: typeof error.response?.data,
            dataPreview: typeof error.response?.data === 'string' 
              ? error.response.data.substring(0, 200) 
              : error.response?.data
          });
        }

        const originalRequest = error?.config;

        // If we don't have the original request config (e.g. a failure inside an interceptor),
        // don't attempt any retries.
        if (!originalRequest || typeof originalRequest !== 'object') {
          return Promise.reject(error);
        }

        // Don't retry authentication requests to avoid infinite loops
        if (originalRequest.url?.includes('/authenticate')) {
          return Promise.reject(error);
        }

        // Handle 401 errors (token expired)
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (process.env.NODE_ENV !== 'test' && process.env.TWIZZIT_DEBUG === '1') {
            console.log('[Twizzit Auth] Got 401, clearing token and retrying...');
          }
          
          originalRequest._retry = true;
          
          // Clear expired token and retry
          this.accessToken = null;
          this.tokenExpiry = null;
          
          try {
            await this.authenticate();
            if (!originalRequest.headers) originalRequest.headers = {};
            originalRequest.headers.Authorization = `Bearer ${this.accessToken}`;
            return this.client(originalRequest);
          } catch (authError) {
            return Promise.reject(authError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Authenticate with Twizzit API
   * @returns {Promise<string>} Access token
   */
  async authenticate() {
    try {
      if (process.env.NODE_ENV !== 'test' && process.env.TWIZZIT_DEBUG === '1') {
        console.log('[Twizzit Auth] Starting authentication...', {
          hasEndpoint: !!this.apiEndpoint,
          hasUsername: !!this.username,
          hasPassword: !!this.password
        });
      }

      // Twizzit API requires application/x-www-form-urlencoded
      const params = new URLSearchParams();
      params.append('username', this.username);
      params.append('password', this.password);

      const response = await this.client.post('/v2/api/authenticate', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!response.data?.token) {
        console.error('[Twizzit Auth] Authentication response missing token:', response.data);
        throw new Error('Authentication response missing token');
      }

      this.accessToken = response.data.token;
      
      // Twizzit tokens typically last 24 hours
      const expiresIn = response.data.expires_in || 86400; // 24 hours default
      this.tokenExpiry = Date.now() + (expiresIn * 1000) - 300000; // Refresh 5 min before expiry

      if (process.env.NODE_ENV !== 'test' && process.env.TWIZZIT_DEBUG === '1') {
        console.log('[Twizzit Auth] Authentication successful!', {
          hasToken: !!this.accessToken,
          expiresIn: expiresIn + ' seconds'
        });
      }

      // Cache tokens across per-request client instances to avoid re-auth rate limiting.
      if (process.env.NODE_ENV !== 'test') {
        const cacheKey = TwizzitApiClient._getTokenCacheKey(this.apiEndpoint, this.username);
        TwizzitApiClient._tokenCache.set(cacheKey, {
          token: this.accessToken,
          tokenExpiry: this.tokenExpiry
        });
      }

      return this.accessToken;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Invalid Twizzit API credentials');
      }
      throw TwizzitApiClient._createApiError(error, 'Authentication failed');
    }
  }

  /**
   * Ensure we have a valid authentication token
   */
  async ensureAuthenticated() {
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

    if (process.env.NODE_ENV !== 'test' && process.env.TWIZZIT_DEBUG === '1') {
      console.log('[Twizzit Auth] Ensuring authentication...', {
        hasToken: !!this.accessToken,
        hasExpiry: !!this.tokenExpiry,
        isExpired: this.tokenExpiry ? (this.tokenExpiry - now) <= bufferTime : 'N/A'
      });
    }

    // Check if token exists and is not expired (with buffer)
    if (this.accessToken && this.tokenExpiry) {
      const timeRemaining = this.tokenExpiry - now;
      if (timeRemaining > bufferTime) {
        if (process.env.NODE_ENV !== 'test' && process.env.TWIZZIT_DEBUG === '1') {
          console.log('[Twizzit Auth] Using existing valid token');
        }
        return; // Token is still valid
      }
    }

    // In non-test environments, reuse tokens across per-request client instances and
    // de-duplicate concurrent authentication calls.
    if (process.env.NODE_ENV !== 'test') {
      const cacheKey = TwizzitApiClient._getTokenCacheKey(this.apiEndpoint, this.username);
      const cached = TwizzitApiClient._tokenCache.get(cacheKey);

      if (cached?.token && cached?.tokenExpiry && cached.tokenExpiry - now > bufferTime) {
        if (process.env.TWIZZIT_DEBUG === '1') {
          console.log('[Twizzit Auth] Using cached token from other instance');
        }
        this.accessToken = cached.token;
        this.tokenExpiry = cached.tokenExpiry;
        return;
      }

      const inFlight = TwizzitApiClient._authInFlight.get(cacheKey);
      if (inFlight) {
        if (process.env.TWIZZIT_DEBUG === '1') {
          console.log('[Twizzit Auth] Waiting for in-flight authentication...');
        }
        const result = await inFlight;
        this.accessToken = result.token;
        this.tokenExpiry = result.tokenExpiry;
        return;
      }

      if (process.env.TWIZZIT_DEBUG === '1') {
        console.log('[Twizzit Auth] Need to authenticate (no valid token found)');
      }

      const authPromise = (async () => {
        await this.authenticate();
        return { token: this.accessToken, tokenExpiry: this.tokenExpiry };
      })();

      TwizzitApiClient._authInFlight.set(cacheKey, authPromise);

      try {
        const result = await authPromise;
        return result;
      } finally {
        TwizzitApiClient._authInFlight.delete(cacheKey);
      }
    }

    // Token doesn't exist or is expired/expiring soon, authenticate
    await this.authenticate();
  }

  /**
   * Verify API connection and credentials
   * @returns {Promise<boolean>}
   */
  async verifyConnection() {
    try {
      // Ensure we have a valid token first
      await this.ensureAuthenticated();
      // Try to fetch organizations as a connection test
      await this.client.get('/v2/api/organizations');
      return true;
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error(
          'Connection verification error:',
          error?.response?.status ?? error?.status,
          error?.response?.data ?? error?.details ?? error?.message
        );
      }
      return false;
    }
  }

  /**
   * Verify API connection and credentials, returning error details suitable for the UI.
   * Does not include secrets.
   * @returns {Promise<{ success: boolean, organizationName?: string, organizationId?: string, usableForSync?: boolean, capabilities?: { organizations: boolean, groups: boolean, seasons: boolean }, status?: number, message?: string, details?: unknown }>}
   */
  async verifyConnectionDetailed() {
    try {
      await this.ensureAuthenticated();
      const organizations = await this.getOrganizations();
      const desiredName = TwizzitApiClient._normalizeName(this.organizationName);
      const matchedOrg = desiredName
        ? organizations.find((o) => {
          const name = TwizzitApiClient._normalizeName(o?.organization_name ?? o?.name);
          return name === desiredName;
        })
        : null;

      const organizationName =
        matchedOrg?.organization_name ||
        matchedOrg?.name ||
        organizations[0]?.organization_name ||
        organizations[0]?.name;

      let chosenOrgId = null;
      try {
        // Start from the default org selection (name match or first org), but don't assume it has groups access.
        chosenOrgId = await this.getDefaultOrganizationId();
      } catch {
        chosenOrgId = TwizzitApiClient._extractOrganizationId(matchedOrg || organizations[0]);
        if (chosenOrgId) this.organizationId = String(chosenOrgId);
      }

      let effectiveOrgId = chosenOrgId;
      let groupsOk = false;
      let seasonsOk = false;

      // Best-effort capability checks.
      // Important: groups access can vary per organization. Use org discovery to find a working org if any.
      try {
        await this.getGroups({ limit: 1 });
        groupsOk = true;
        if (this.organizationId != null && String(this.organizationId).trim() !== '') {
          effectiveOrgId = String(this.organizationId);
        }
      } catch {
        groupsOk = false;
      }

      // If we found/selected an org id, check seasons against that org to avoid extra probing.
      if (effectiveOrgId) {
        try {
          await this.getSeasons({ limit: 1 });
          seasonsOk = true;
        } catch {
          seasonsOk = false;
        }
      }

      const usableForSync = Boolean(effectiveOrgId && groupsOk);
      const message = usableForSync
        ? 'Connection verified successfully'
        : groupsOk
          ? 'Authenticated successfully, but this Twizzit account has no access to seasons for the selected organization'
          : 'Authenticated successfully, but this Twizzit account has no access to groups/seasons for the selected organization';

      return {
        success: true,
        message,
        organizationName,
        ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
        usableForSync,
        capabilities: { organizations: true, groups: groupsOk, seasons: seasonsOk }
      };
    } catch (error) {
      const status = error?.response?.status ?? error?.status;
      const details = error?.response?.data ?? error?.details;
      const message = details?.message || details?.error || error?.message || 'Connection verification failed';

      if (process.env.NODE_ENV !== 'test') {
        console.error('Connection verification error:', status, details || message);
      }

      return { success: false, status, message, details };
    }
  }

  static _createApiError(error, prefix) {
    const status = error?.response?.status ?? error?.status;
    const details = error?.response?.data ?? error?.details;
    
    let upstreamMessage =
      details?.message ||
      details?.error ||
      (typeof details === 'string' ? details : null) ||
      error?.message ||
      'Request failed';

    // If Twizzit returned HTML (error page), provide a cleaner message
    if (typeof upstreamMessage === 'string' && upstreamMessage.includes('<!DOCTYPE html>')) {
      upstreamMessage = 'Twizzit returned an error page. The API request may be malformed or unauthorized.';
    }

    const message = status
      ? `${prefix}: Twizzit responded ${status}: ${upstreamMessage}`
      : `${prefix}: ${upstreamMessage}`;

    const wrapped = new Error(message);
    wrapped.status = status;
    wrapped.details = details;
    return wrapped;
  }

  static _extractOrganizationId(org) {
    // Twizzit may return multiple shapes (id, organization_id, organization-ids, etc).
    const id = org?.organization_id ?? org?.id ?? org?.organizationId;
    return id != null && String(id).trim() !== '' ? String(id) : null;
  }

  static _normalizeOrganizationFilter(params) {
    if (!params || typeof params !== 'object') return { params, hasFilter: false };

    const next = { ...params };
    const pick = (value) => {
      if (value == null) return null;
      const asString = String(value).trim();
      return asString !== '' ? value : null;
    };

    // Check for organization-ids as array (canonical axios format)
    const canonicalArray = next['organization-ids'];
    if (canonicalArray != null && (Array.isArray(canonicalArray) || pick(canonicalArray) != null)) {
      // Ensure it's an array
      if (!Array.isArray(canonicalArray)) {
        next['organization-ids'] = [canonicalArray];
      }
      delete next['organization-ids[]'];
      delete next.organization_id;
      delete next['organization_id[]'];
      delete next.organization_ids;
      delete next['organization_ids[]'];
      return { params: next, hasFilter: true };
    }

    // Legacy/alternate shapes we've seen in older code and docs.
    const legacy =
      pick(next['organization-ids[]']) ??
      pick(next.organization_id) ??
      pick(next['organization_id[]']) ??
      pick(next.organization_ids) ??
      pick(next['organization_ids[]']);

    if (legacy != null) {
      // Convert to array format for axios
      next['organization-ids'] = Array.isArray(legacy) ? legacy : [legacy];
      delete next['organization-ids[]'];
      delete next.organization_id;
      delete next['organization_id[]'];
      delete next.organization_ids;
      delete next['organization_ids[]'];
      return { params: next, hasFilter: true };
    }

    return { params: next, hasFilter: false };
  }

  static _hasOrganizationFilter(params) {
    return TwizzitApiClient._normalizeOrganizationFilter(params).hasFilter;
  }

  static _applyOrganizationIdToParams(params, organizationId) {
    const { params: normalized, hasFilter } = TwizzitApiClient._normalizeOrganizationFilter(params);
    if (!hasFilter) {
      // Pass as array so axios serializes it as organization-ids[]=value
      normalized['organization-ids'] = [organizationId];
    }
    return normalized;
  }

  static _normalizeName(value) {
    return String(value ?? '').trim().toLowerCase();
  }

  static _isNoAccessForSpecifiedOrganizations(error) {
    const status = error?.response?.status;
    const details = error?.response?.data;
    const msg = String(details?.error ?? details?.message ?? '').toLowerCase();
    return status === 403 && msg.includes('no access') && msg.includes('specified') && msg.includes('organization');
  }

  static _isBadRequest(error) {
    return error?.response?.status === 400;
  }

  static _isRateLimited(error) {
    const status = error?.response?.status ?? error?.status;
    return status === 429;
  }

  async _getOrganizationIdsOrdered() {
    const organizations = await this.getOrganizations();
    const ids = organizations
      .map(TwizzitApiClient._extractOrganizationId)
      .filter(Boolean);

    if (ids.length === 0) return [];

    const desired = TwizzitApiClient._normalizeName(this.organizationName);
    if (!desired) return ids;

    const matching = organizations.find((o) => {
      const name = TwizzitApiClient._normalizeName(o.organization_name ?? o.name);
      return name === desired;
    });

    const preferredId = matching ? TwizzitApiClient._extractOrganizationId(matching) : null;
    if (!preferredId) return ids;

    return [preferredId, ...ids.filter((id) => id !== preferredId)];
  }

  async _requestGetWithOrgDiscovery(path, params = {}) {
    const debug = process.env.NODE_ENV !== 'test' && process.env.TWIZZIT_DEBUG === '1';

    const { params: normalizedParams, hasFilter } = TwizzitApiClient._normalizeOrganizationFilter(params);

    // 1) If caller already provided an organization filter, respect it.
    if (hasFilter) {
      return this.client.get(path, { params: normalizedParams });
    }

    // 2) First try with no org filter (some Twizzit setups default this correctly).
    try {
      return await this.client.get(path, { params: normalizedParams });
    } catch (error) {
      // If Twizzit is rate limiting / quota limiting, don't retry/probe.
      if (TwizzitApiClient._isRateLimited(error)) {
        throw error;
      }

      // 404 means the resource itself doesn't exist; probing org ids won't help.
      if (error?.response?.status === 404) {
        throw error;
      }

      if (debug) {
        console.log(`[Twizzit] ${path} failed without organization filter`, {
          status: error?.response?.status,
          error: error?.response?.data?.error || error?.response?.data?.message
        });
      }
      // If Twizzit rejects because an org was specified (shouldn't happen here), just continue.
      // For 400s, we'll try with an org id.
      if (!TwizzitApiClient._isBadRequest(error) && !TwizzitApiClient._isNoAccessForSpecifiedOrganizations(error)) {
        // If it's a hard failure (401/403/etc), we still try org probing once below.
      }

      // 3) Try with cached/default org id (fast path)
      try {
        const orgId = await this.getDefaultOrganizationId();
        const paramsWithOrg = TwizzitApiClient._applyOrganizationIdToParams(normalizedParams, orgId);
        if (debug) console.log(`[Twizzit] ${path} retrying with default organization`, { orgId, params: paramsWithOrg });
        return await this.client.get(path, { params: paramsWithOrg });
      } catch (errorWithDefaultOrg) {
        if (TwizzitApiClient._isRateLimited(errorWithDefaultOrg)) {
          throw errorWithDefaultOrg;
        }

        if (debug) {
          console.log(`[Twizzit] ${path} failed with default organization`, {
            status: errorWithDefaultOrg?.response?.status,
            error: errorWithDefaultOrg?.response?.data?.error || errorWithDefaultOrg?.response?.data?.message
          });
        }
        // If default org is forbidden, probe all orgs.
        const shouldProbe =
          TwizzitApiClient._isBadRequest(error) ||
          TwizzitApiClient._isNoAccessForSpecifiedOrganizations(errorWithDefaultOrg) ||
          TwizzitApiClient._isNoAccessForSpecifiedOrganizations(error);

        if (!shouldProbe) {
          throw errorWithDefaultOrg;
        }

        const orgIds = await this._getOrganizationIdsOrdered();
        if (debug) console.log(`[Twizzit] ${path} probing organizations`, { count: orgIds.length });
        let lastError = errorWithDefaultOrg;

        for (const orgId of orgIds) {
          try {
            const response = await this.client.get(path, { params: TwizzitApiClient._applyOrganizationIdToParams(normalizedParams, orgId) });
            this.organizationId = orgId;
            if (debug) console.log(`[Twizzit] ${path} succeeded with organization`, { 'organization-ids[]': orgId });
            return response;
          } catch (e) {
            lastError = e;
            // Keep trying other orgs on the specific no-access error.
            if (!TwizzitApiClient._isNoAccessForSpecifiedOrganizations(e)) {
              // For other errors, don't brute force further.
              break;
            }
          }
        }

        // 4) As a last resort, if we only failed due to "no access for specified organizations",
        // retry without org filter again (some accounts only allow implicit org scope).
        if (TwizzitApiClient._isNoAccessForSpecifiedOrganizations(lastError)) {
          if (debug) console.log(`[Twizzit] ${path} retrying again without organization filter after org probe`);
          return this.client.get(path, { params: normalizedParams });
        }

        throw lastError;
      }
    }
  }

  async getOrganizations() {
    try {
      const response = await this.client.get('/v2/api/organizations');

      const payload = response.data;
      if (Array.isArray(payload)) return payload;
      if (payload && Array.isArray(payload.organizations)) return payload.organizations;
      if (payload && Array.isArray(payload.data)) return payload.data;
      return [];
    } catch (error) {
      throw TwizzitApiClient._createApiError(error, 'Failed to fetch organizations');
    }
  }

  async getDefaultOrganizationId() {
    if (this.organizationId != null && String(this.organizationId).trim() !== '') {
      return String(this.organizationId);
    }

    const organizations = await this.getOrganizations();
    if (organizations.length === 0) {
      throw new Error('No organizations returned by Twizzit for these credentials');
    }

    const desiredName = TwizzitApiClient._normalizeName(this.organizationName);

    const matchByName = desiredName
      ? organizations.find((o) => TwizzitApiClient._normalizeName(o.organization_name ?? o.name) === desiredName)
      : null;

    const chosen = matchByName || organizations[0];
    const id = TwizzitApiClient._extractOrganizationId(chosen);

    if (id == null || String(id).trim() === '') {
      throw new Error('Twizzit organizations response missing organization id');
    }

    this.organizationId = String(id);
    return this.organizationId;
  }

  async _withOrganizationId(params = {}) {
    const orgId = await this.getDefaultOrganizationId();
    return TwizzitApiClient._applyOrganizationIdToParams(params, orgId);
  }

  /**
   * Fetch all groups (teams in Twizzit)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of groups
   */
  async getGroups(options = {}) {
    try {
      const seasonId = options.seasonId != null && String(options.seasonId).trim() !== ''
        ? String(options.seasonId)
        : null;

      const groupType = options.groupType != null && String(options.groupType).trim() !== ''
        ? String(options.groupType)
        : null;

      const { seasonId: _seasonId, groupType: _groupType, ...rest } = options || {};

      // Ensure we're authenticated before making requests
      await this.ensureAuthenticated();

      // Build params in the exact format Twizzit expects: season-id and group-type (kebab-case)
      const params = { ...rest };
      
      if (seasonId) {
        params['season-id'] = seasonId;
      }
      
      if (groupType) {
        params['group-type'] = groupType;
      }

      if (process.env.NODE_ENV !== 'test' && process.env.TWIZZIT_DEBUG === '1') {
        console.log('[Twizzit] Fetching groups with params:', params);
      }

      // Use _requestGetWithOrgDiscovery which handles org ID discovery and fallbacks
      const response = await this._requestGetWithOrgDiscovery('/v2/api/groups', params);

      if (process.env.NODE_ENV !== 'test' && process.env.TWIZZIT_DEBUG === '1') {
        console.log('[Twizzit] Successfully fetched groups:', {
          count: Array.isArray(response.data) ? response.data.length : 0
        });
      }
      
      // Twizzit returns array directly
      const groups = Array.isArray(response.data) ? response.data : [];

      return {
        groups,
        total: groups.length,
        hasMore: false // Twizzit returns all groups in one call
      };
    } catch (error) {
      throw TwizzitApiClient._createApiError(error, 'Failed to fetch groups');
    }
  }

  // Alias for backward compatibility
  async getTeams(options = {}) {
    const result = await this.getGroups(options);
    // Map groups to teams for backward compatibility
    return {
      ...result,
      teams: result.groups
    };
  }

  /**
   * Fetch a specific group by ID
   * @param {string} groupId - Twizzit group ID
   * @returns {Promise<Object>} Group details
   */
  async getGroup(groupId) {
    if (!groupId) {
      throw new Error('Group ID is required');
    }

    try {
      const response = await this._requestGetWithOrgDiscovery('/v2/api/groups', { id: groupId });
      const groups = Array.isArray(response.data) ? response.data : [];

      // Twizzit does not reliably support filtering by `id` for all accounts.
      // If the upstream ignores `?id=...` and returns a full list, ensure we
      // pick the correct group instead of accidentally returning the first.
      const desired = String(groupId);
      const match = groups.find((g) => {
        const id =
          g?.groupRelationId ??
          g?.group_relation_id ??
          g?.group_relationId ??
          g?.groupRelation_id ??
          g?.id ??
          g?.group_id ??
          g?.groupId;
        return id != null && String(id) === desired;
      });

      if (match) return match;

      // If Twizzit returns a single item but uses a different id shape, fall back.
      if (groups.length === 1) return groups[0];

      // Fallback: if the id is a season-specific relation id, it may only be available
      // via /group-relations on some Twizzit setups.
      try {
        const relParamsList = [
          { id: desired },
          { groupRelationId: desired },
          { group_relation_id: desired },
          { relationId: desired },
          { relation_id: desired },
          { 'group-relation-ids[]': desired },
          { 'group_relation_ids[]': desired }
        ];

        for (const p of relParamsList) {
          try {
            const relResponse = await this._requestGetWithOrgDiscovery('/v2/api/group-relations', p);
            const relRows = Array.isArray(relResponse.data) ? relResponse.data : [];
            const found = relRows.find((r) => {
              const id = r?.id ?? r?.groupRelationId ?? r?.group_relation_id ?? r?.relationId ?? r?.relation_id;
              return id != null && String(id) === desired;
            });
            if (found) return found;
          } catch (e) {
            const status = e?.response?.status ?? e?.status;
            if (status === 400 || status === 404) continue;
            // Non-filterable failure; stop probing.
            break;
          }
        }
      } catch {
        // Ignore relation lookup failures and fall through.
      }

      throw new Error(`Group not found: ${groupId}`);
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error(`Group not found: ${groupId}`);
      }
      // Don't wrap error messages that already include context
      if (error.message && error.message.includes('Group not found')) {
        throw error;
      }
      throw TwizzitApiClient._createApiError(error, 'Failed to fetch group');
    }
  }

  // Alias for backward compatibility
  async getTeam(teamId) {
    return this.getGroup(teamId);
  }

  /**
   * Fetch contacts (players) for a specific group
   * @param {string} groupId - Twizzit group ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of contacts
   */
  async getGroupContacts(groupId, options = {}) {
    if (!groupId) {
      throw new Error('Group ID is required');
    }

    try {
      const groupIdValue = String(groupId);

      const seasonId = options.seasonId != null && String(options.seasonId).trim() !== ''
        ? String(options.seasonId)
        : null;

      const debugEnabled = String(process.env.TWIZZIT_DEBUG || '').toLowerCase() === '1' ||
        String(process.env.TWIZZIT_DEBUG || '').toLowerCase() === 'true';

      // Note: We intentionally do NOT attempt to fetch /v2/api/contacts with group+season filters.
      // Some Twizzit setups ignore these filters and return org-wide contacts, which breaks the
      // expectation that groupId always scopes the result.

      // Twizzit API usage (confirmed via Postman) uses kebab-case array params.
      // Example: /v2/api/group-contacts?organization-ids[]=<orgId>&group-ids[]=<groupId>
      const baseParams = {
        'group-ids[]': groupIdValue,
        ...(options.filters || {})
      };

      // Some Twizzit endpoints return 200 + [] when org scoping is missing.
      // If this client already has a selected/default org id, include it upfront.
      const params = this.organizationId
        ? TwizzitApiClient._applyOrganizationIdToParams(baseParams, String(this.organizationId))
        : baseParams;

      const seasonParamVariants = seasonId
        ? [
          { 'season-ids[]': seasonId },
          { 'season_ids[]': seasonId },
          { 'season-ids': seasonId },
          { 'season-id': seasonId },
          { season_id: seasonId },
          { seasonId: seasonId }
        ]
        : [null];

      let response;
      let payload = [];

      for (const seasonParams of seasonParamVariants) {
        const attemptParams = seasonParams ? { ...params, ...seasonParams } : params;
        try {
          response = await this._requestGetWithOrgDiscovery('/v2/api/group-contacts', attemptParams);
          payload = Array.isArray(response.data) ? response.data : [];

          if (debugEnabled && process.env.NODE_ENV !== 'test') {
            console.log('[twizzit] getGroupContacts via /group-contacts', {
              groupId: groupIdValue,
              seasonId,
              params: attemptParams,
              count: payload.length
            });
          }
          break;
        } catch (e) {
          // Try the next season param shape on 400s; bubble other failures.
          if (e?.response?.status !== 400 && e?.status !== 400) {
            throw e;
          }
        }
      }

      // Twizzit can return either:
      // - full contact objects, OR
      // - membership rows with contactId/groupId/contactFunctionId.
      const first = payload[0];
      const looksLikeMembershipRows =
        first &&
        (first.contactId != null || first.contact_id != null) &&
        first.firstName == null &&
        first.first_name == null;

      if (!looksLikeMembershipRows) {
        return {
          contacts: payload,
          total: payload.length,
          hasMore: false
        };
      }

      // If Twizzit includes season identifiers on membership rows, filter them.
      // Some accounts ignore season filters at the endpoint level but still
      // annotate rows, so this is a safe, best-effort improvement.
      if (seasonId) {
        const seasonKeys = ['seasonId', 'season_id', 'season-id', 'season'];
        const extractSeasonId = (row) => {
          for (const k of seasonKeys) {
            const val = row?.[k];
            if (val == null) continue;
            if (Array.isArray(val)) {
              const firstVal = val.find((v) => v != null && String(v).trim() !== '');
              return firstVal != null ? String(firstVal) : null;
            }
            if (String(val).trim() !== '') return String(val);
          }
          return null;
        };

        const anyHasSeason = payload.some((row) => extractSeasonId(row) != null);
        if (anyHasSeason) {
          const beforeCount = payload.length;
          payload = payload.filter((row) => extractSeasonId(row) === seasonId);

          if (debugEnabled && process.env.NODE_ENV !== 'test') {
            console.log('[twizzit] getGroupContacts season filter (membership rows)', {
              groupId: groupIdValue,
              seasonId,
              before: beforeCount,
              after: payload.length
            });
          }
        }
      }

      const contactIds = Array.from(
        new Set(
          payload
            .map((row) => row?.contactId ?? row?.contact_id ?? row?.id)
            .filter((id) => id != null && String(id).trim() !== '')
            .map((id) => String(id))
        )
      );

      if (contactIds.length === 0) {
        return { contacts: [], total: 0, hasMore: false };
      }

      const contacts = await this._fetchContactsByIds(contactIds);
      const byId = new Map();
      for (const c of contacts) {
        const keys = [c?.id, c?.contact_id, c?.contactId].filter((k) => k != null && String(k).trim() !== '');
        for (const k of keys) byId.set(String(k), c);
      }

      const ordered = contactIds.map((id) => byId.get(id)).filter(Boolean);
      return { contacts: ordered, total: ordered.length, hasMore: false };
    } catch (error) {
      throw TwizzitApiClient._createApiError(error, 'Failed to fetch group contacts');
    }
  }

  async _fetchContactsByIds(contactIds = []) {
    const ids = Array.isArray(contactIds) ? contactIds.map((id) => String(id)).filter(Boolean) : [];
    if (ids.length === 0) return [];

    // Twizzit appears to cap list filters (like contact-ids[]) at 10 items.
    // Batch requests to avoid silently missing results.
    const chunkSize = 10;
    const chunks = [];
    for (let i = 0; i < ids.length; i += chunkSize) {
      chunks.push(ids.slice(i, i + chunkSize));
    }

    const collected = [];
    for (const chunk of chunks) {
      const variants = [
        { label: 'contact-ids[]', params: { 'contact-ids[]': chunk } },
        { label: 'ids[]', params: { 'ids[]': chunk } },
        { label: 'contactIds[]', params: { 'contactIds[]': chunk } }
      ];

      let chunkContacts = null;
      for (const v of variants) {
        try {
          const baseParams = this.organizationId
            ? TwizzitApiClient._applyOrganizationIdToParams(v.params, String(this.organizationId))
            : v.params;

          const response = await this._requestGetWithOrgDiscovery('/v2/api/contacts', baseParams);
          const data = Array.isArray(response.data) ? response.data : [];
          chunkContacts = data;
          break;
        } catch (e) {
          if (e?.response?.status !== 400 && e?.status !== 400) {
            throw e;
          }
        }
      }

      if (Array.isArray(chunkContacts) && chunkContacts.length > 0) {
        collected.push(...chunkContacts);
      }
    }

    if (collected.length > 0) return collected;

    // Fallback: fetch all contacts (scoped by org if available) and filter client-side.
    // This is heavier, but contact lists are typically manageable and avoids per-id fanout.
    const all = await this.getContacts();
    const contacts = Array.isArray(all?.contacts) ? all.contacts : [];
    const wanted = new Set(ids);
    return contacts.filter((c) => {
      const keys = [c?.id, c?.contact_id, c?.contactId]
        .filter((k) => k != null && String(k).trim() !== '')
        .map((k) => String(k));
      return keys.some((k) => wanted.has(k));
    });
  }

  // Alias for backward compatibility
  async getTeamPlayers(teamId, options = {}) {
    const result = await this.getGroupContacts(teamId, options);
    return {
      players: result.contacts,
      total: result.total,
      hasMore: result.hasMore
    };
  }

  /**
   * Fetch all contacts (players in Twizzit)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of contacts
   */
  async getContacts(options = {}) {
    try {
      const params = {
        ...options.filters
      };
      const response = await this._requestGetWithOrgDiscovery('/v2/api/contacts', params);
      
      const contacts = Array.isArray(response.data) ? response.data : [];
      
      return {
        contacts: contacts,
        total: contacts.length,
        hasMore: false
      };
    } catch (error) {
      throw TwizzitApiClient._createApiError(error, 'Failed to fetch contacts');
    }
  }

  /**
   * Fetch all seasons
   * @returns {Promise<Array>} List of seasons
   */
  async getSeasons(options = {}) {
    try {
      const response = await this._requestGetWithOrgDiscovery('/v2/api/seasons', { ...options });
      const seasons = Array.isArray(response.data) ? response.data : [];
      
      return {
        seasons: seasons,
        total: seasons.length
      };
    } catch (error) {
      throw TwizzitApiClient._createApiError(error, 'Failed to fetch seasons');
    }
  }

  /**
   * Fetch group types (e.g. team/committee)
   */
  async getGroupTypes(options = {}) {
    try {
      const response = await this._requestGetWithOrgDiscovery('/v2/api/group-types', { ...options });
      const groupTypes = Array.isArray(response.data) ? response.data : [];
      return { groupTypes, total: groupTypes.length };
    } catch (error) {
      throw TwizzitApiClient._createApiError(error, 'Failed to fetch group types');
    }
  }

  /**
   * Fetch group categories for a group type (Twizzit UI uses `group-type=1` for teams)
   */
  async getGroupCategories(options = {}) {
    try {
      const response = await this._requestGetWithOrgDiscovery('/v2/api/group-categories', { ...options });
      const groupCategories = Array.isArray(response.data) ? response.data : [];
      return { groupCategories, total: groupCategories.length };
    } catch (error) {
      throw TwizzitApiClient._createApiError(error, 'Failed to fetch group categories');
    }
  }
}

export default TwizzitApiClient;
