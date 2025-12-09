/**
 * Twizzit API Client
 * Handles communication with the Belgian Korfball Federation API
 */

import axios from 'axios';

class TwizzitApiClient {
  constructor(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('TwizzitApiClient requires a configuration object');
    }

    this.apiEndpoint = config.apiEndpoint || 'https://app.twizzit.com';
    this.username = config.username;
    this.password = config.password;
    this.timeout = config.timeout || 30000;
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
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use(
      async (config) => {
        // Skip auth for authenticate endpoint
        if (config.url === '/v2/api/authenticate' || config.url?.includes('/authenticate')) {
          return config;
        }

        // Ensure we have a valid token
        await this.ensureAuthenticated();
        
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
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
        const originalRequest = error.config;

        // Don't retry authentication requests to avoid infinite loops
        if (originalRequest.url?.includes('/authenticate')) {
          return Promise.reject(error);
        }

        // Handle 401 errors (token expired)
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          // Clear expired token and retry
          this.accessToken = null;
          this.tokenExpiry = null;
          
          try {
            await this.authenticate();
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
        throw new Error('Authentication response missing token');
      }

      this.accessToken = response.data.token;
      
      // Twizzit tokens typically last 24 hours
      const expiresIn = response.data.expires_in || 86400; // 24 hours default
      this.tokenExpiry = Date.now() + (expiresIn * 1000) - 300000; // Refresh 5 min before expiry

      return this.accessToken;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Invalid Twizzit API credentials');
      }
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Ensure we have a valid authentication token
   */
  async ensureAuthenticated() {
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

    // Check if token exists and is not expired (with buffer)
    if (this.accessToken && this.tokenExpiry) {
      const timeRemaining = this.tokenExpiry - now;
      if (timeRemaining > bufferTime) {
        return; // Token is still valid
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
        console.error('Connection verification error:', error.response?.status, error.response?.data || error.message);
      }
      return false;
    }
  }

  /**
   * Fetch all groups (teams in Twizzit)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of groups
   */
  async getGroups(options = {}) {
    try {
      const params = {
        ...options
      };

      const response = await this.client.get('/v2/api/groups', { params });
      
      // Twizzit returns array directly
      const groups = Array.isArray(response.data) ? response.data : [];
      
      return {
        groups: groups,
        total: groups.length,
        hasMore: false // Twizzit returns all groups in one call
      };
    } catch (error) {
      throw new Error(`Failed to fetch groups: ${error.message}`);
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
      const response = await this.client.get('/v2/api/groups', {
        params: { id: groupId }
      });
      const groups = Array.isArray(response.data) ? response.data : [];
      if (groups.length === 0) {
        throw new Error(`Group not found: ${groupId}`);
      }
      return groups[0];
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error(`Group not found: ${groupId}`);
      }
      // Don't wrap error messages that already include context
      if (error.message && error.message.includes('Group not found')) {
        throw error;
      }
      throw new Error(`Failed to fetch group: ${error.message}`);
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
      const params = {
        group_id: groupId,
        ...options.filters
      };

      const response = await this.client.get('/v2/api/group-contacts', { params });
      
      const contacts = Array.isArray(response.data) ? response.data : [];
      
      return {
        contacts: contacts,
        total: contacts.length,
        hasMore: false
      };
    } catch (error) {
      throw new Error(`Failed to fetch group contacts: ${error.message}`);
    }
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

      const response = await this.client.get('/v2/api/contacts', { params });
      
      const contacts = Array.isArray(response.data) ? response.data : [];
      
      return {
        contacts: contacts,
        total: contacts.length,
        hasMore: false
      };
    } catch (error) {
      throw new Error(`Failed to fetch contacts: ${error.message}`);
    }
  }

  /**
   * Fetch all seasons
   * @returns {Promise<Array>} List of seasons
   */
  async getSeasons() {
    try {
      const response = await this.client.get('/v2/api/seasons');
      const seasons = Array.isArray(response.data) ? response.data : [];
      
      return {
        seasons: seasons,
        total: seasons.length
      };
    } catch (error) {
      throw new Error(`Failed to fetch seasons: ${error.message}`);
    }
  }
}

export default TwizzitApiClient;
