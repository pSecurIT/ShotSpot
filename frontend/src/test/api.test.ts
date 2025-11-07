import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import api, { getCsrfToken, resetCsrfToken } from '../utils/api';
import { queueAction } from '../utils/offlineSync';

// Mock the offlineSync module
vi.mock('../utils/offlineSync', () => ({
  queueAction: vi.fn()
}));

const mockQueueAction = vi.mocked(queueAction);

describe('API Utility', () => {
  let mockAxios: MockAdapter;
  let mockAxiosBase: MockAdapter;
  let originalOnLine: boolean;
  let mockLocation: Partial<Location>;

  beforeEach(() => {
    // Create axios mock adapters
    mockAxios = new MockAdapter(api);
    mockAxiosBase = new MockAdapter(axios);
    
    // Store original navigator.onLine value
    originalOnLine = navigator.onLine;
    
    // Mock window.location
    mockLocation = { href: '' };
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
      configurable: true
    });
    
    // Clear localStorage
    localStorage.clear();
    
    // Clear mocks
    vi.clearAllMocks();
    
    // Reset CSRF token cache
    resetCsrfToken();
  });

  afterEach(() => {
    mockAxios.restore();
    mockAxiosBase.restore();
    
    // Restore navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      writable: true
    });
    
    // Reset mock location
    mockLocation.href = '';
    
    // Clear localStorage
    localStorage.clear();
  });

  describe('Basic Configuration', () => {
    it('should have correct base URL', () => {
      expect(api.defaults.baseURL).toBe('http://localhost:3001/api');
    });

    it('should have correct default headers', () => {
      expect(api.defaults.headers['Content-Type']).toBe('application/json');
    });

    it('should have withCredentials enabled', () => {
      expect(api.defaults.withCredentials).toBe(true);
    });
  });

  describe('CSRF Token Management', () => {
    it('should fetch CSRF token when not cached', async () => {
      const mockCsrfResponse = { data: { csrfToken: 'test-csrf-token' } };
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(200, mockCsrfResponse.data);

      const token = await getCsrfToken();

      expect(token).toBe('test-csrf-token');
    });

    it('should return cached CSRF token on subsequent calls', async () => {
      const mockCsrfResponse = { data: { csrfToken: 'cached-token' } };
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(200, mockCsrfResponse.data);

      // First call
      const token1 = await getCsrfToken();
      // Second call
      const token2 = await getCsrfToken();

      expect(token1).toBe('cached-token');
      expect(token2).toBe('cached-token');
      // Should only make one request
      expect(mockAxiosBase.history.get.length).toBe(1);
    });

    it('should handle CSRF token fetch error', async () => {
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(500, { error: 'Server error' });

      await expect(getCsrfToken()).rejects.toThrow();
    });
  });

  describe('Request Interceptor', () => {
    it('should add Bearer token to requests when token exists', async () => {
      localStorage.setItem('token', 'test-auth-token');
      mockAxios.onGet('/test').reply(200, { data: 'success' });

      await api.get('/test');

      const request = mockAxios.history.get[0];
      expect(request.headers?.Authorization).toBe('Bearer test-auth-token');
    });

    it('should not add Bearer token when token does not exist', async () => {
      mockAxios.onGet('/test').reply(200, { data: 'success' });

      await api.get('/test');

      const request = mockAxios.history.get[0];
      expect(request.headers?.Authorization).toBeUndefined();
    });

    it('should add CSRF token for POST requests', async () => {
      const mockCsrfResponse = { data: { csrfToken: 'csrf-token' } };
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(200, mockCsrfResponse.data);
      mockAxios.onPost('/test').reply(200, { data: 'success' });

      await api.post('/test', { data: 'test' });

      const request = mockAxios.history.post[0];
      expect(request.headers?.['X-CSRF-Token']).toBe('csrf-token');
    });

    it('should add CSRF token for PUT requests', async () => {
      const mockCsrfResponse = { data: { csrfToken: 'csrf-token' } };
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(200, mockCsrfResponse.data);
      mockAxios.onPut('/test').reply(200, { data: 'success' });

      await api.put('/test', { data: 'test' });

      const request = mockAxios.history.put[0];
      expect(request.headers?.['X-CSRF-Token']).toBe('csrf-token');
    });

    it('should add CSRF token for DELETE requests', async () => {
      const mockCsrfResponse = { data: { csrfToken: 'csrf-token' } };
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(200, mockCsrfResponse.data);
      mockAxios.onDelete('/test').reply(200, { data: 'success' });

      await api.delete('/test');

      const request = mockAxios.history.delete[0];
      expect(request.headers?.['X-CSRF-Token']).toBe('csrf-token');
    });

    it('should not add CSRF token for GET requests', async () => {
      mockAxios.onGet('/test').reply(200, { data: 'success' });

      await api.get('/test');

      const request = mockAxios.history.get[0];
      expect(request.headers?.['X-CSRF-Token']).toBeUndefined();
    });

    it('should handle CSRF token fetch error gracefully', async () => {
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(500);
      mockAxios.onPost('/test').reply(200, { data: 'success' });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await api.post('/test', { data: 'test' });

      expect(response.status).toBe(200);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get CSRF token:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('Response Interceptor - Authentication', () => {
    it('should redirect to login on 401 error', async () => {
      localStorage.setItem('token', 'invalid-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, username: 'test' }));
      mockAxios.onGet('/test').reply(401, { error: 'Unauthorized' });

      try {
        await api.get('/test');
      } catch {
        // Expected to throw
      }

      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      expect(mockLocation.href).toBe('/login');
    });

    it('should pass through successful responses', async () => {
      mockAxios.onGet('/test').reply(200, { data: 'success' });

      const response = await api.get('/test');

      expect(response.status).toBe(200);
      expect(response.data.data).toBe('success');
    });

    it('should pass through non-auth errors', async () => {
      mockAxios.onGet('/test').reply(404, { error: 'Not found' });

      try {
        await api.get('/test');
      } catch (error: unknown) {
        expect((error as { response: { status: number } }).response.status).toBe(404);
      }
    });
  });

  describe('Response Interceptor - CSRF Token Refresh', () => {
    it('should retry request with new CSRF token on 403 CSRF error', async () => {
      // First CSRF token fetch
      const mockCsrfResponse1 = { data: { csrfToken: 'old-token' } };
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').replyOnce(200, mockCsrfResponse1.data);

      // Second CSRF token fetch for refresh
      const mockCsrfResponse2 = { data: { csrfToken: 'new-token' } };
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').replyOnce(200, mockCsrfResponse2.data);

      // First POST request fails with CSRF error
      mockAxios.onPost('/test').replyOnce(403, { error: 'Invalid CSRF token' });
      // Retry POST request succeeds
      mockAxios.onPost('/test').replyOnce(200, { data: 'success' });

      const response = await api.post('/test', { data: 'test' });

      expect(response.status).toBe(200);
      expect(response.data.data).toBe('success');
      
      // Should have made 2 CSRF requests and 2 POST requests
      expect(mockAxiosBase.history.get.length).toBe(2);
      expect(mockAxios.history.post.length).toBe(2);
      
      // Second POST should have new CSRF token
      expect(mockAxios.history.post[1].headers?.['X-CSRF-Token']).toBe('new-token');
    });

    it('should not retry CSRF refresh more than once', async () => {
      // CSRF token fetch
      const mockCsrfResponse = { data: { csrfToken: 'token' } };
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(200, mockCsrfResponse.data);

      // Both POST requests fail with CSRF error
      mockAxios.onPost('/test').reply(403, { error: 'Invalid CSRF token' });

      try {
        await api.post('/test', { data: 'test' });
      } catch (error: unknown) {
        expect((error as { response: { status: number } }).response.status).toBe(403);
      }

      // Should only make 2 POST requests (original + 1 retry)
      expect(mockAxios.history.post.length).toBe(2);
    });

    it('should handle CSRF refresh failure', async () => {
      // First CSRF token fetch
      const mockCsrfResponse = { data: { csrfToken: 'token' } };
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').replyOnce(200, mockCsrfResponse.data);

      // CSRF refresh fails
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').replyOnce(500, { error: 'Server error' });

      // POST request fails with CSRF error
      mockAxios.onPost('/test').replyOnce(403, { error: 'Invalid CSRF token' });

      try {
        await api.post('/test', { data: 'test' });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Offline Functionality', () => {
    beforeEach(() => {
      // Mock navigator.onLine as false
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true
      });
    });

    it('should queue POST requests when offline', async () => {
      mockQueueAction.mockResolvedValue();
      
      const response = await api.post('/test', { data: 'test' });

      expect(mockQueueAction).toHaveBeenCalledWith(
        'POST',
        'http://localhost:3001/api/test',
        '{"data":"test"}'
      );
      
      expect(response.data).toEqual({
        queued: true,
        message: 'Action queued for sync when online'
      });
      expect(response.status).toBe(202);
    });

    it('should queue PUT requests when offline', async () => {
      mockQueueAction.mockResolvedValue();
      
      const response = await api.put('/test/1', { data: 'updated' });

      expect(mockQueueAction).toHaveBeenCalledWith(
        'PUT',
        'http://localhost:3001/api/test/1',
        '{"data":"updated"}'
      );
      
      expect(response.data.queued).toBe(true);
    });

    it('should queue DELETE requests when offline', async () => {
      mockQueueAction.mockResolvedValue();
      
      const response = await api.delete('/test/1');

      expect(mockQueueAction).toHaveBeenCalledWith(
        'DELETE',
        'http://localhost:3001/api/test/1',
        undefined
      );
      
      expect(response.data.queued).toBe(true);
    });

    it('should not queue GET requests when offline', async () => {
      mockAxios.onGet('/test').reply(500);

      try {
        await api.get('/test');
      } catch {
        expect(mockQueueAction).not.toHaveBeenCalled();
      }
    });

    it('should handle queue action failure when offline', async () => {
      mockQueueAction.mockRejectedValue(new Error('Queue failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        await api.post('/test', { data: 'test' });
      } catch (error: unknown) {
        const err = error as { offline: boolean; message: string };
        expect(err.offline).toBe(true);
        expect(err.message).toBe('Offline and failed to queue action');
      }

      expect(consoleSpy).toHaveBeenCalledWith('Failed to queue offline action:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should handle full URLs when queueing offline actions', async () => {
      mockQueueAction.mockResolvedValue();
      
      await api.post('http://localhost:3001/api/external', { data: 'test' });

      expect(mockQueueAction).toHaveBeenCalledWith(
        'POST',
        'http://localhost:3001/api/external',
        '{"data":"test"}'
      );
    });
  });

  describe('HTTP Methods', () => {
    beforeEach(() => {
      // Ensure we're online for these tests
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true
      });
    });

    it('should perform GET requests correctly', async () => {
      mockAxios.onGet('/test').reply(200, { data: 'get-success' });

      const response = await api.get('/test');

      expect(response.status).toBe(200);
      expect(response.data.data).toBe('get-success');
    });

    it('should perform POST requests correctly', async () => {
      const mockCsrfResponse = { data: { csrfToken: 'token' } };
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(200, mockCsrfResponse.data);
      mockAxios.onPost('/test').reply(201, { data: 'post-success' });

      const response = await api.post('/test', { name: 'test' });

      expect(response.status).toBe(201);
      expect(response.data.data).toBe('post-success');
      
      const request = mockAxios.history.post[0];
      expect(JSON.parse(request.data)).toEqual({ name: 'test' });
    });

    it('should perform PUT requests correctly', async () => {
      const mockCsrfResponse = { data: { csrfToken: 'token' } };
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(200, mockCsrfResponse.data);
      mockAxios.onPut('/test/1').reply(200, { data: 'put-success' });

      const response = await api.put('/test/1', { name: 'updated' });

      expect(response.status).toBe(200);
      expect(response.data.data).toBe('put-success');
      
      const request = mockAxios.history.put[0];
      expect(JSON.parse(request.data)).toEqual({ name: 'updated' });
    });

    it('should perform DELETE requests correctly', async () => {
      const mockCsrfResponse = { data: { csrfToken: 'token' } };
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(200, mockCsrfResponse.data);
      mockAxios.onDelete('/test/1').reply(204);

      const response = await api.delete('/test/1');

      expect(response.status).toBe(204);
    });

    it('should perform PATCH requests correctly', async () => {
      const mockCsrfResponse = { data: { csrfToken: 'token' } };
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(200, mockCsrfResponse.data);
      mockAxios.onPatch('/test/1').reply(200, { data: 'patch-success' });

      const response = await api.patch('/test/1', { status: 'active' });

      expect(response.status).toBe(200);
      expect(response.data.data).toBe('patch-success');
      
      const request = mockAxios.history.patch[0];
      expect(JSON.parse(request.data)).toEqual({ status: 'active' });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockAxios.onGet('/test').networkError();

      try {
        await api.get('/test');
      } catch (error: unknown) {
        expect((error as { message: string }).message).toBe('Network Error');
      }
    });

    it('should handle timeout errors', async () => {
      mockAxios.onGet('/test').timeout();

      try {
        await api.get('/test');
      } catch (error: unknown) {
        expect((error as { code: string }).code).toBe('ECONNABORTED');
      }
    });

    it('should handle server errors', async () => {
      mockAxios.onGet('/test').reply(500, { error: 'Internal Server Error' });

      try {
        await api.get('/test');
      } catch (error: unknown) {
        const err = error as { response: { status: number; data: { error: string } } };
        expect(err.response.status).toBe(500);
        expect(err.response.data.error).toBe('Internal Server Error');
      }
    });

    it('should handle client errors', async () => {
      mockAxios.onGet('/test').reply(400, { error: 'Bad Request' });

      try {
        await api.get('/test');
      } catch (error: unknown) {
        const err = error as { response: { status: number; data: { error: string } } };
        expect(err.response.status).toBe(400);
        expect(err.response.data.error).toBe('Bad Request');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle requests without method specified', async () => {
      mockAxios.onGet('/test').reply(200, { data: 'success' });

      const response = await api('/test');

      expect(response.status).toBe(200);
    });

    it('should handle undefined request data', async () => {
      const mockCsrfResponse = { data: { csrfToken: 'token' } };
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(200, mockCsrfResponse.data);
      mockAxios.onPost('/test').reply(201, { data: 'success' });

      const response = await api.post('/test');

      expect(response.status).toBe(201);
    });

    it('should handle empty response data', async () => {
      mockAxios.onGet('/test').reply(204);

      const response = await api.get('/test');

      expect(response.status).toBe(204);
      expect(response.data).toBeUndefined();
    });

    it('should handle requests with custom headers', async () => {
      mockAxios.onGet('/test').reply(200, { data: 'success' });

      const response = await api.get('/test', {
        headers: {
          'Custom-Header': 'custom-value'
        }
      });

      expect(response.status).toBe(200);
      
      const request = mockAxios.history.get[0];
      expect(request.headers?.['Custom-Header']).toBe('custom-value');
    });
  });
});