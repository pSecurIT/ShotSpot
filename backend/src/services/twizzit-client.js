/**
 * Twizzit API Client
 * Wrapper for all Twizzit API v2 operations with built-in retry logic and error handling
 * 
 * Features:
 * - All API endpoints from OpenAPI spec
 * - Automatic retry with exponential backoff (max 3 attempts)
 * - Rate limit handling (429 responses)
 * - Pagination helper for large datasets
 * - Comprehensive error handling
 */

const TWIZZIT_API_BASE_URL = process.env.TWIZZIT_API_BASE_URL || 'https://api.twizzit.com';
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Custom error for Twizzit API errors
 */
export class TwizzitAPIError extends Error {
  constructor(message, statusCode, response) {
    super(message);
    this.name = 'TwizzitAPIError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

/**
 * Custom error for rate limiting
 */
export class TwizzitRateLimitError extends Error {
  constructor(message, response) {
    super(message);
    this.name = 'TwizzitRateLimitError';
    this.response = response;
  }
}

/**
 * Twizzit API Client
 */
export class TwizzitClient {
  /**
   * @param {string} token - JWT bearer token for authentication
   */
  constructor(token) {
    if (!token) {
      throw new Error('JWT token is required for TwizzitClient');
    }
    this.token = token;
    this.baseURL = TWIZZIT_API_BASE_URL;
  }

  /**
   * Makes HTTP request with retry logic and error handling
   * @private
   * @param {string} method - HTTP method
   * @param {string} path - API endpoint path
   * @param {Object} params - Query parameters
   * @param {number} retryCount - Current retry attempt
   * @returns {Promise<Object>} Response data
   * @throws {TwizzitAPIError|TwizzitRateLimitError} On API errors
   */
  async request(method, path, params = {}, retryCount = 0) {
    const url = new URL(`${this.baseURL}${path}`);
    
    // Add query parameters
    Object.keys(params).forEach(key => {
      const value = params[key];
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          // Handle array parameters (e.g., organization-ids[])
          value.forEach(v => url.searchParams.append(key, v));
        } else {
          url.searchParams.append(key, value);
        }
      }
    });

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/json',
        },
      });

      // Handle 429 rate limit (do not retry)
      if (response.status === 429) {
        const data = await response.json().catch(() => ({}));
        throw new TwizzitRateLimitError(
          data.error || 'Monthly API call limit exceeded',
          data
        );
      }

      // Handle 401 unauthorized
      if (response.status === 401) {
        const data = await response.json().catch(() => ({}));
        throw new TwizzitAPIError(
          'Access token is missing or invalid',
          401,
          data
        );
      }

      // Handle 5xx server errors with retry
      if (response.status >= 500 && retryCount < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
        if (process.env.NODE_ENV !== 'test') {
          console.warn(`Twizzit API server error (${response.status}), retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request(method, path, params, retryCount + 1);
      }

      // Handle other errors
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new TwizzitAPIError(
          `Twizzit API error: ${response.statusText}`,
          response.status,
          data
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof TwizzitAPIError || error instanceof TwizzitRateLimitError) {
        throw error;
      }
      throw new Error(`Twizzit API request failed: ${error.message}`);
    }
  }

  /**
   * Fetches all pages of a paginated endpoint
   * @private
   * @param {string} method - HTTP method
   * @param {string} path - API endpoint path
   * @param {Object} params - Query parameters
   * @param {number} limit - Items per page
   * @returns {Promise<Array>} All items from all pages
   */
  async getAllPages(method, path, params = {}, limit = 100) {
    const allItems = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.request(method, path, { ...params, limit, offset });
      
      if (Array.isArray(response)) {
        allItems.push(...response);
        hasMore = response.length === limit;
        offset += limit;
      } else {
        // Response is not an array, return as is
        return response;
      }
    }

    return allItems;
  }

  // =====================================================
  // API Endpoints
  // =====================================================

  /**
   * Get list of organizations accessible to the authenticated user
   * @returns {Promise<Array>} Array of organization objects
   */
  async getOrganizations() {
    return this.request('GET', '/v2/api/organizations');
  }

  /**
   * Get seasons for organizations
   * @param {Array<number>} organizationIds - Organization IDs
   * @param {Object} options - Optional filters
   * @param {Array<number>} options.seasonIds - Filter by specific season IDs
   * @param {boolean} options.isCurrentSeason - Filter for current season only
   * @returns {Promise<Array>} Array of season objects
   */
  async getSeasons(organizationIds, options = {}) {
    return this.request('GET', '/v2/api/seasons', {
      'organization-ids[]': organizationIds,
      'season-ids[]': options.seasonIds,
      'is-current-season': options.isCurrentSeason,
    });
  }

  /**
   * Get groups (teams) for organizations
   * @param {Array<number>} organizationIds - Organization IDs
   * @param {Object} options - Optional filters and pagination
   * @param {Array<number>} options.groupIds - Filter by specific group IDs
   * @param {number} options.seasonId - Filter by season
   * @param {number} options.groupType - Filter by group type
   * @param {Array<number>} options.groupCategoryIds - Filter by group category
   * @param {Array<number>} options.seriesIds - Filter by series
   * @param {Array<number>} options.clubIds - Filter by club
   * @param {number} options.limit - Items per page (max 250)
   * @param {number} options.offset - Pagination offset
   * @returns {Promise<Array>} Array of group objects
   */
  async getGroups(organizationIds, options = {}) {
    return this.request('GET', '/v2/api/groups', {
      'organization-ids[]': organizationIds,
      'group-ids[]': options.groupIds,
      'season-id': options.seasonId,
      'group-type': options.groupType,
      'group-category-ids[]': options.groupCategoryIds,
      'series-ids[]': options.seriesIds,
      'club-ids[]': options.clubIds,
      'limit': options.limit,
      'offset': options.offset,
    });
  }

  /**
   * Get all groups with automatic pagination
   * @param {Array<number>} organizationIds - Organization IDs
   * @param {Object} options - Optional filters (no limit/offset)
   * @returns {Promise<Array>} All groups across all pages
   */
  async getAllGroups(organizationIds, options = {}) {
    return this.getAllPages('GET', '/v2/api/groups', {
      'organization-ids[]': organizationIds,
      'group-ids[]': options.groupIds,
      'season-id': options.seasonId,
      'group-type': options.groupType,
      'group-category-ids[]': options.groupCategoryIds,
      'series-ids[]': options.seriesIds,
      'club-ids[]': options.clubIds,
    }, 250); // Max limit for groups
  }

  /**
   * Get group types
   * @param {Array<number>} organizationIds - Organization IDs
   * @returns {Promise<Array>} Array of group type objects
   */
  async getGroupTypes(organizationIds) {
    return this.request('GET', '/v2/api/group-types', {
      'organization-ids[]': organizationIds,
    });
  }

  /**
   * Get group categories
   * @param {Array<number>} organizationIds - Organization IDs
   * @param {Object} options - Optional filters
   * @param {Array<number>} options.groupCategoryIds - Filter by specific category IDs
   * @param {number} options.groupType - Filter by group type
   * @returns {Promise<Array>} Array of group category objects
   */
  async getGroupCategories(organizationIds, options = {}) {
    return this.request('GET', '/v2/api/group-categories', {
      'organization-ids[]': organizationIds,
      'group-category-ids[]': options.groupCategoryIds,
      'group-type': options.groupType,
    });
  }

  /**
   * Get contacts (members/players)
   * @param {Array<number>} organizationIds - Organization IDs
   * @param {Object} options - Optional filters and pagination
   * @param {Array<number>} options.contactIds - Filter by specific contact IDs
   * @param {Array<number>} options.membershipTypeIds - Filter by membership type
   * @param {Array<number>} options.membershipSeasonIds - Filter by membership season
   * @param {boolean} options.currentMembership - Filter for current members only
   * @param {number} options.limit - Items per page (max 100)
   * @param {number} options.offset - Pagination offset
   * @returns {Promise<Array>} Array of contact objects
   */
  async getContacts(organizationIds, options = {}) {
    return this.request('GET', '/v2/api/contacts', {
      'organization-ids[]': organizationIds,
      'contact-ids[]': options.contactIds,
      'membership-type-ids[]': options.membershipTypeIds,
      'membership-season-ids[]': options.membershipSeasonIds,
      'current-membership': options.currentMembership,
      'limit': options.limit,
      'offset': options.offset,
    });
  }

  /**
   * Get all contacts with automatic pagination
   * @param {Array<number>} organizationIds - Organization IDs
   * @param {Object} options - Optional filters (no limit/offset)
   * @returns {Promise<Array>} All contacts across all pages
   */
  async getAllContacts(organizationIds, options = {}) {
    return this.getAllPages('GET', '/v2/api/contacts', {
      'organization-ids[]': organizationIds,
      'contact-ids[]': options.contactIds,
      'membership-type-ids[]': options.membershipTypeIds,
      'membership-season-ids[]': options.membershipSeasonIds,
      'current-membership': options.currentMembership,
    }, 100); // Max limit for contacts
  }

  /**
   * Get group-contact relationships (team rosters)
   * @param {Array<number>} organizationIds - Organization IDs
   * @param {Array<number>} groupIds - Group IDs
   * @returns {Promise<Array>} Array of group-contact relationship objects
   */
  async getGroupContacts(organizationIds, groupIds) {
    return this.request('GET', '/v2/api/group-contacts', {
      'organization-ids[]': organizationIds,
      'group-ids[]': groupIds,
    });
  }

  /**
   * Get contact functions (roles)
   * @param {Array<number>} organizationIds - Organization IDs
   * @param {Object} options - Optional filters
   * @param {Array<number>} options.contactFunctionIds - Filter by specific function IDs
   * @param {number} options.contactFunctionType - Filter by function type
   * @returns {Promise<Array>} Array of contact function objects
   */
  async getContactFunctions(organizationIds, options = {}) {
    return this.request('GET', '/v2/api/contact-functions', {
      'organization-ids[]': organizationIds,
      'contact-function-ids[]': options.contactFunctionIds,
      'contact-function-type': options.contactFunctionType,
    });
  }

  /**
   * Get event types
   * @param {Array<number>} organizationIds - Organization IDs
   * @returns {Promise<Array>} Array of event type objects
   */
  async getEventTypes(organizationIds) {
    return this.request('GET', '/v2/api/event-types', {
      'organization-ids[]': organizationIds,
    });
  }

  /**
   * Get event sub types
   * @param {Array<number>} organizationIds - Organization IDs
   * @param {Object} options - Optional filters
   * @param {Array<number>} options.eventSubTypeIds - Filter by specific sub-type IDs
   * @returns {Promise<Array>} Array of event sub type objects
   */
  async getEventSubTypes(organizationIds, options = {}) {
    return this.request('GET', '/v2/api/event-sub-types', {
      'organization-ids[]': organizationIds,
      'event-sub-type-ids[]': options.eventSubTypeIds,
    });
  }
}

export default TwizzitClient;
