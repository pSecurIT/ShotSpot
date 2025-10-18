import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important: enables cookies/session
});

// Store CSRF token
let csrfToken: string | null = null;

// Function to get CSRF token
export const getCsrfToken = async (): Promise<string> => {
  if (!csrfToken) {
    const response = await axios.get('http://localhost:3001/api/auth/csrf', {
      withCredentials: true,
    });
    csrfToken = response.data.csrfToken;
  }
  return csrfToken as string;
};

// Add auth token and CSRF token to requests
api.interceptors.request.use(
  async (config) => {
    // Add Bearer token
    const token = localStorage.getItem('token');
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
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;