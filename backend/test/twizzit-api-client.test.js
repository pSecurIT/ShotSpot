/**
 * Tests for Twizzit API Client
 */

import TwizzitApiClient from '../src/services/twizzit-api-client.js';
import axios from 'axios';

// Mock axios
jest.mock('axios');

describe('Twizzit API Client', () => {
  let client;
  let mockAxiosInstance;

  beforeEach(() => {
    // Create mock axios instance
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    };

    axios.create.mockReturnValue(mockAxiosInstance);

    client = new TwizzitApiClient({
      apiEndpoint: 'https://app.twizzit.com',
      username: 'test_user',
      password: 'test_password'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create client with valid configuration', () => {
      expect(client.apiEndpoint).toBe('https://app.twizzit.com');
      expect(client.username).toBe('test_user');
      expect(client.password).toBe('test_password');
      expect(client.timeout).toBe(30000);
    });

    // Note: Constructor validation is hard to test with axios mocking
    // The axios.create() happens before validation can run
    // Validation is tested implicitly in integration tests

    it('should throw error if username is missing', () => {
      expect(() => {
        new TwizzitApiClient({
          apiEndpoint: 'https://app.twizzit.com',
          password: 'test'
        });
      }).toThrow('Twizzit API username is required');
    });

    it('should throw error if password is missing', () => {
      expect(() => {
        new TwizzitApiClient({
          apiEndpoint: 'https://app.twizzit.com',
          username: 'test'
        });
      }).toThrow('Twizzit API password is required');
    });

    it('should accept custom timeout', () => {
      const customClient = new TwizzitApiClient({
        apiEndpoint: 'https://app.twizzit.com',
        username: 'test',
        password: 'test',
        timeout: 60000
      });
      expect(customClient.timeout).toBe(60000);
    });
  });

  describe('Authentication', () => {
    it('should authenticate successfully', async () => {
      const mockToken = 'eyJ0eXAiOiJKV1QiLCJh...';
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          token: mockToken,
          expires_in: 3600
        }
      });

      const token = await client.authenticate();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/v2/api/authenticate',
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        })
      );
      expect(token).toBe(mockToken);
      expect(client.accessToken).toBe(mockToken);
    });

    it('should throw error if authentication response missing token', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { expires_in: 3600 }
      });

      await expect(client.authenticate()).rejects.toThrow('Authentication response missing token');
    });

    it('should handle authentication failure', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Invalid credentials'));

      await expect(client.authenticate()).rejects.toThrow('Authentication failed: Invalid credentials');
    });

    it('should use form-urlencoded for authentication', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { token: 'test-token', expires_in: 3600 }
      });

      await client.authenticate();

      const callArgs = mockAxiosInstance.post.mock.calls[0];
      expect(callArgs[1]).toBeInstanceOf(URLSearchParams);
      expect(callArgs[1].get('username')).toBe('test_user');
      expect(callArgs[1].get('password')).toBe('test_password');
    });
  });

  describe('Connection Verification', () => {
    it('should verify connection successfully', async () => {
      // Mock successful authentication
      client.authenticate = jest.fn().mockResolvedValue('test_token');
      
      mockAxiosInstance.get.mockResolvedValue({
        data: [{ id: 1, name: 'Test Org' }]
      });

      const result = await client.verifyConnection();

      expect(result).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v2/api/organizations');
    });

    it('should return false on connection failure', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      const result = await client.verifyConnection();

      expect(result).toBe(false);
    });
  });

  describe('getGroups', () => {
    it('should fetch groups successfully', async () => {
      const mockGroups = [
        { id: 1, name: 'Team A', group_id: 1 },
        { id: 2, name: 'Team B', group_id: 2 }
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: mockGroups
      });

      const result = await client.getGroups({ 'organization-ids[]': 123 });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v2/api/groups', {
        params: { 'organization-ids[]': 123 }
      });
      expect(result.groups).toEqual(mockGroups);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it('should handle empty groups response', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: [] });

      const result = await client.getGroups();

      expect(result.groups).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle non-array response', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: null });

      const result = await client.getGroups();

      expect(result.groups).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getGroup', () => {
    it('should fetch single group by ID', async () => {
      const mockGroup = { id: 1, name: 'Team A' };
      // API returns array, getGroup extracts first element
      mockAxiosInstance.get.mockResolvedValue({ data: [mockGroup] });

      const result = await client.getGroup(1);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v2/api/groups', {
        params: { id: 1 }
      });
      expect(result).toEqual(mockGroup);
    });

    it('should throw error if group ID is missing', async () => {
      await expect(client.getGroup()).rejects.toThrow('Group ID is required');
    });

    it('should handle 404 error for non-existent group', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 404 }
      });

      await expect(client.getGroup(999)).rejects.toThrow('Group not found: 999');
    });
  });

  describe('getGroupContacts', () => {
    it('should fetch contacts for a group', async () => {
      const mockContacts = [
        { id: 1, contact_id: 1, firstName: 'John', lastName: 'Doe' },
        { id: 2, contact_id: 2, firstName: 'Jane', lastName: 'Smith' }
      ];

      mockAxiosInstance.get.mockResolvedValue({ data: mockContacts });

      const result = await client.getGroupContacts(123);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v2/api/group-contacts', {
        params: { 'group-ids[]': '123' }
      });
      expect(result.contacts).toEqual(mockContacts);
      expect(result.total).toBe(2);
    });

    it('should resolve membership rows and batch contact lookups beyond 10 ids', async () => {
      client.organizationId = 'org-test';

      const contactIds = Array.from({ length: 14 }, (_, i) => `contact-${i + 1}`);
      const membershipRows = contactIds.map((id) => ({ groupId: 'group-test', contactId: id }));

      mockAxiosInstance.get.mockImplementation((url, config) => {
        if (url === '/v2/api/group-contacts') {
          return Promise.resolve({ data: membershipRows });
        }

        if (url === '/v2/api/contacts') {
          // The client may first attempt a season-scoped contacts query using
          // group+season params. Simulate Twizzit rejecting that with 400 so
          // we exercise the membership-row fallback.
          if (!config?.params?.['contact-ids[]']) {
            return Promise.reject({ response: { status: 400 } });
          }
          const idsParam = config?.params?.['contact-ids[]'];
          const ids = Array.isArray(idsParam) ? idsParam.map(String) : [String(idsParam)];
          return Promise.resolve({
            data: ids.map((id) => ({ id, 'first-name': `First${id}`, 'last-name': `Last${id}` }))
          });
        }

        return Promise.reject(new Error(`Unexpected request: ${url}`));
      });

      const result = await client.getGroupContacts('group-test');

      const calls = mockAxiosInstance.get.mock.calls
        .filter(([url]) => url === '/v2/api/contacts')
        .map(([, cfg]) => cfg?.params?.['contact-ids[]']);

      expect(calls).toHaveLength(2);
      expect(Array.isArray(calls[0]) ? calls[0] : [calls[0]]).toHaveLength(10);
      expect(Array.isArray(calls[1]) ? calls[1] : [calls[1]]).toHaveLength(4);
      expect(result.total).toBe(14);
      expect(result.contacts).toHaveLength(14);
    });

    it('should filter membership rows by seasonId when rows include season identifiers', async () => {
      client.organizationId = 'org-test';

      const membershipRows = [
        { groupId: 'group-test', contactId: 'contact-1', seasonId: 'season-test' },
        { groupId: 'group-test', contactId: 'contact-2', season_id: 'season-test' },
        { groupId: 'group-test', contactId: 'contact-3', 'season-id': 'season-other' }
      ];

      mockAxiosInstance.get.mockImplementation((url, config) => {
        if (url === '/v2/api/group-contacts') {
          return Promise.resolve({ data: membershipRows });
        }

        if (url === '/v2/api/contacts') {
          // The client may first attempt a season-scoped contacts query using
          // group+season params. Simulate Twizzit rejecting that with 400 so
          // we exercise the membership-row fallback.
          if (!config?.params?.['contact-ids[]']) {
            return Promise.reject({ response: { status: 400 } });
          }
          const idsParam = config?.params?.['contact-ids[]'];
          const ids = Array.isArray(idsParam) ? idsParam.map(String) : [String(idsParam)];
          return Promise.resolve({
            data: ids.map((id) => ({ id, 'first-name': `First${id}`, 'last-name': `Last${id}` }))
          });
        }

        return Promise.reject(new Error(`Unexpected request: ${url}`));
      });

      const result = await client.getGroupContacts('group-test', { seasonId: 'season-test' });

      expect(result.total).toBe(2);
      expect(result.contacts.map((c) => String(c.id))).toEqual(['contact-1', 'contact-2']);
    });

    it('should throw error if group ID is missing', async () => {
      await expect(client.getGroupContacts()).rejects.toThrow('Group ID is required');
    });

    it('should include organization filter when organizationId is set', async () => {
      const mockContacts = [{ id: 1, first_name: 'John', last_name: 'Doe' }];
      mockAxiosInstance.get.mockResolvedValue({ data: mockContacts });

      client.organizationId = 'org-test';
      await client.getGroupContacts('group-test');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v2/api/group-contacts', {
        params: { 'group-ids[]': 'group-test', 'organization-ids[]': 'org-test' }
      });
    });
  });

  describe('getContacts', () => {
    it('should fetch all contacts', async () => {
      const mockContacts = [
        { id: 1, firstName: 'John', lastName: 'Doe' }
      ];

      mockAxiosInstance.get.mockResolvedValue({ data: mockContacts });

      const result = await client.getContacts();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v2/api/contacts', {
        params: {}
      });
      expect(result.contacts).toEqual(mockContacts);
    });

    it('should pass organization filter', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: [] });

      await client.getContacts({ filters: { 'organization-ids[]': 123 } });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v2/api/contacts', {
        params: { 'organization-ids[]': 123 }
      });
    });
  });

  describe('getSeasons', () => {
    it('should fetch seasons successfully', async () => {
      const mockSeasons = [
        { id: 1, name: '2024-2025' },
        { id: 2, name: '2023-2024' }
      ];

      mockAxiosInstance.get.mockResolvedValue({ data: mockSeasons });

      const result = await client.getSeasons();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v2/api/seasons', {
        params: {}
      });
      expect(result.seasons).toEqual(mockSeasons);
      expect(result.total).toBe(2);
    });
  });

  describe('Backward Compatibility Aliases', () => {
    it('getTeams should call getGroups', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: [] });
      
      const result = await client.getTeams({ 'organization-ids[]': 123 });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v2/api/groups', {
        params: { 'organization-ids[]': 123 }
      });
      expect(result).toHaveProperty('teams');
      expect(result).toHaveProperty('groups');
    });

    it('getTeam should call getGroup', async () => {
      // API returns array, getGroup extracts first element
      mockAxiosInstance.get.mockResolvedValue({ data: [{ id: 1 }] });
      
      await client.getTeam(1);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v2/api/groups', {
        params: { id: 1 }
      });
    });

    it('getTeamPlayers should call getGroupContacts', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: [] });
      
      const result = await client.getTeamPlayers(123);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v2/api/group-contacts', {
        params: { 'group-ids[]': '123' }
      });
      expect(result).toHaveProperty('players');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network timeout'));

      await expect(client.getGroups()).rejects.toThrow('Failed to fetch groups');
    });

    it('should handle 403 forbidden errors', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: {
          status: 403,
          data: { error: 'no access for specified organizations' }
        }
      });

      await expect(client.getGroups({ organization_id: 123 })).rejects.toThrow();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v2/api/groups', {
        params: { 'organization-ids[]': 123 }
      });
    });

    it('should handle 401 unauthorized errors', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 401 }
      });

      await expect(client.getGroups()).rejects.toThrow();
    });
  });

  describe('ensureAuthenticated', () => {
    it('should authenticate if no token exists', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { token: 'new-token', expires_in: 3600 }
      });

      await client.ensureAuthenticated();

      expect(mockAxiosInstance.post).toHaveBeenCalled();
      expect(client.accessToken).toBe('new-token');
    });

    it('should not re-authenticate if token is valid', async () => {
      client.accessToken = 'existing-token';
      client.tokenExpiry = Date.now() + 1800000; // 30 mins from now

      await client.ensureAuthenticated();

      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
    });

    it('should re-authenticate if token is expired', async () => {
      client.accessToken = 'expired-token';
      client.tokenExpiry = Date.now() - 1000; // 1 second ago

      mockAxiosInstance.post.mockResolvedValue({
        data: { token: 'new-token', expires_in: 3600 }
      });

      await client.ensureAuthenticated();

      expect(mockAxiosInstance.post).toHaveBeenCalled();
      expect(client.accessToken).toBe('new-token');
    });

    it('should re-authenticate if token expiring soon', async () => {
      client.accessToken = 'expiring-token';
      client.tokenExpiry = Date.now() + 60000; // 1 minute from now (< 5 min buffer)

      mockAxiosInstance.post.mockResolvedValue({
        data: { token: 'new-token', expires_in: 3600 }
      });

      await client.ensureAuthenticated();

      expect(mockAxiosInstance.post).toHaveBeenCalled();
    });
  });
});


