import axios from 'axios';
import { queueAction } from './offlineSync';

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string) || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important: enables cookies/session
});

// Store CSRF token
let csrfToken: string | null = null;

// Function to reset CSRF token (for testing)
export const resetCsrfToken = (): void => {
  csrfToken = null;
};

// Function to get CSRF token
export const getCsrfToken = async (): Promise<string> => {
  if (!csrfToken) {
    const response = await api.get('/auth/csrf');
    csrfToken = response.data.csrfToken;
  }
  return csrfToken as string;
};

// Add auth token and CSRF token to requests
api.interceptors.request.use(
  async (config) => {
    // Add Bearer token
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add CSRF token for state-changing requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method?.toUpperCase() || '')) {
      try {
        const csrf = await getCsrfToken();
        config.headers['X-CSRF-Token'] = csrf;
      } catch (error) {
        console.error('Failed to get CSRF token:', error);
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Check if request failed due to network/backend issues
    const isNetworkError = !error.response; // No response means network failure
    const isServerError = error.response?.status >= 500; // 5xx errors
    const isCorsError = error.message?.toLowerCase().includes('cors');
    const isOffline = !navigator.onLine;
    
    // Queue write operations when offline or backend unavailable
    const shouldQueue = (isOffline || isNetworkError || isServerError || isCorsError) &&
                       ['POST', 'PUT', 'DELETE'].includes(originalRequest.method?.toUpperCase() || '');

    if (shouldQueue) {
      const endpoint = originalRequest.url || '';
      const fullUrl = endpoint.startsWith('http') ? endpoint : `${api.defaults.baseURL}${endpoint}`;
      
      try {
        await queueAction(
          originalRequest.method.toUpperCase() as 'POST' | 'PUT' | 'DELETE',
          fullUrl,
          originalRequest.data
        );
        
        console.log('[API] Action queued for later sync:', originalRequest.method, fullUrl);
        
        // Return a special response indicating the action was queued
        return Promise.resolve({
          data: {
            queued: true,
            message: 'Action queued for sync when online'
          },
          status: 202,
          statusText: 'Queued',
          headers: {},
          config: originalRequest
        });
      } catch (queueError) {
        console.error('Failed to queue offline action:', queueError);
        return Promise.reject({
          ...error,
          offline: true,
          message: 'Backend unavailable and failed to queue action'
        });
      }
    }

    // If CSRF token is invalid, try to get a new one and retry
    if (error.response?.status === 403 && 
        error.response?.data?.error === 'Invalid CSRF token' &&
        !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Clear the old token and get a new one
        csrfToken = null;
        const newCsrfToken = await getCsrfToken();
        originalRequest.headers['X-CSRF-Token'] = newCsrfToken;
        return api(originalRequest);
      } catch (retryError) {
        return Promise.reject(retryError);
      }
    }

    // Handle authentication errors
    if (error.response?.status === 401) {
      // Don't redirect if this is a login/register attempt (let the component handle the error)
      const isAuthEndpoint = originalRequest.url?.includes('/auth/login') || 
                            originalRequest.url?.includes('/auth/register');
      
      if (!isAuthEndpoint && typeof window !== 'undefined') {
        // Token expired or invalid - redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// ============================================
// TWIZZIT INTEGRATION API
// ============================================

import type {
  TwizzitCredential,
  TwizzitSyncConfig,
  TwizzitSyncHistory,
  TeamMapping,
  PlayerMapping,
  SyncResult,
  VerifyConnectionResult,
} from '../types/twizzit';

/**
 * Get all Twizzit credentials for the authenticated user
 */
export const getTwizzitCredentials = async (): Promise<TwizzitCredential[]> => {
  const response = await api.get('/twizzit/credentials');
  return response.data.credentials;
};

/**
 * Store new Twizzit credentials
 */
export const storeTwizzitCredentials = async (data: {
  username: string;
  password: string;
  organizationName: string;
}): Promise<TwizzitCredential> => {
  const response = await api.post('/twizzit/credentials', data);
  return response.data.credential;
};

/**
 * Delete Twizzit credentials
 */
export const deleteTwizzitCredentials = async (credentialId: number): Promise<void> => {
  await api.delete(`/twizzit/credentials/${credentialId}`);
};

/**
 * Verify Twizzit connection
 */
export const verifyTwizzitConnection = async (
  credentialId: number
): Promise<VerifyConnectionResult> => {
  const response = await api.post(`/twizzit/verify/${credentialId}`);
  return response.data;
};

/**
 * Sync teams from Twizzit
 */
export const syncTwizzitTeams = async (
  credentialId: number,
  options?: {
    groupId?: string;
    createMissing?: boolean;
  }
): Promise<SyncResult> => {
  const response = await api.post(`/twizzit/sync/teams/${credentialId}`, options);
  return response.data;
};

/**
 * Sync players from Twizzit
 */
export const syncTwizzitPlayers = async (
  credentialId: number,
  options?: {
    groupId?: string;
    seasonId?: string;
    createMissing?: boolean;
  }
): Promise<SyncResult> => {
  const response = await api.post(`/twizzit/sync/players/${credentialId}`, options);
  return response.data;
};

/**
 * Get sync configuration for a credential
 */
export const getTwizzitSyncConfig = async (
  credentialId: number
): Promise<TwizzitSyncConfig> => {
  const response = await api.get(`/twizzit/sync/config/${credentialId}`);
  return response.data.config;
};

/**
 * Update sync configuration
 */
export const updateTwizzitSyncConfig = async (
  credentialId: number,
  config: {
    autoSyncEnabled: boolean;
    syncIntervalHours: number;
  }
): Promise<TwizzitSyncConfig> => {
  const response = await api.put(`/twizzit/sync/config/${credentialId}`, config);
  return response.data.config;
};

/**
 * Get sync history for a credential
 */
export const getTwizzitSyncHistory = async (
  credentialId: number,
  limit: number = 50
): Promise<TwizzitSyncHistory[]> => {
  const response = await api.get(`/twizzit/sync/history/${credentialId}?limit=${limit}`);
  return response.data.history;
};

/**
 * Get team mappings
 */
export const getTwizzitTeamMappings = async (
  credentialId?: number
): Promise<TeamMapping[]> => {
  const url = credentialId 
    ? `/twizzit/mappings/teams?credentialId=${credentialId}`
    : '/twizzit/mappings/teams';
  const response = await api.get(url);
  return response.data.mappings;
};

/**
 * Get player mappings
 */
export const getTwizzitPlayerMappings = async (
  credentialId?: number
): Promise<PlayerMapping[]> => {
  const url = credentialId
    ? `/twizzit/mappings/players?credentialId=${credentialId}`
    : '/twizzit/mappings/players';
  const response = await api.get(url);
  return response.data.mappings;
};

export default api;