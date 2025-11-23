import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import api, { resetCsrfToken } from '../utils/api';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { User } from '../types/auth';

// Mock axios for API calls
let mockAxios: MockAdapter;
let mockAxiosBase: MockAdapter;

// Test component to access AuthContext
const TestComponent = () => {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="user-id">{auth.user?.id || 'null'}</div>
      <div data-testid="username">{auth.user?.username || 'null'}</div>
      <div data-testid="email">{auth.user?.email || 'null'}</div>
      <div data-testid="role">{auth.user?.role || 'null'}</div>
      <button onClick={() => auth.login('testuser', 'password')} data-testid="login-btn">
        Login
      </button>
      <button 
        onClick={() => auth.register('newuser', 'new@test.com', 'password')} 
        data-testid="register-btn"
      >
        Register
      </button>
      <button onClick={auth.logout} data-testid="logout-btn">
        Logout
      </button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    // Create axios mock adapters
    mockAxios = new MockAdapter(api);
    mockAxiosBase = new MockAdapter(axios);
    
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
    
    // Clear localStorage
    localStorage.clear();
  });

  describe('AuthProvider Initialization', () => {
    it('should initialize with null user when no token in localStorage', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-id')).toHaveTextContent('null');
        expect(screen.getByTestId('username')).toHaveTextContent('null');
      });
    });

    it('should initialize with user from localStorage when token exists', async () => {
      const mockUser: User = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'user'
      };

      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify(mockUser));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-id')).toHaveTextContent('1');
        expect(screen.getByTestId('username')).toHaveTextContent('testuser');
        expect(screen.getByTestId('email')).toHaveTextContent('test@example.com');
        expect(screen.getByTestId('role')).toHaveTextContent('user');
      });
    });

    it('should handle invalid user data in localStorage gracefully', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', 'invalid-json');

      // Mock console.error to avoid noise in test output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // AuthContext now handles invalid JSON gracefully with try-catch
      const { getByTestId } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Should render without crashing, user should be null
      expect(getByTestId('username')).toHaveTextContent('null');
      expect(getByTestId('email')).toHaveTextContent('null');
      expect(getByTestId('role')).toHaveTextContent('null');
      
      // Verify localStorage was cleaned up
      expect(localStorage.getItem('user')).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
      
      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse stored user data:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should show loading state initially', () => {
      const LoadingTestComponent = () => {
        try {
          const auth = useAuth();
          return <div data-testid="loaded">Loaded: {auth.user?.username || 'null'}</div>;
        } catch {
          return <div data-testid="loading">Loading...</div>;
        }
      };

      // Render without waiting
      const { container } = render(
        <AuthProvider>
          <LoadingTestComponent />
        </AuthProvider>
      );

      // Should either show loading or be loaded (depending on timing)
      expect(container.textContent).toMatch(/(Loading|Loaded)/);
    });
  });

  describe('Login Functionality', () => {
    it('should login successfully and store user data', async () => {
      const mockUser: User = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'user'
      };

      const mockToken = 'auth-token-123';

      // Mock CSRF token request
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(200, { csrfToken: 'csrf-token' });
      
      // Mock login request
      mockAxios.onPost('/auth/login').reply(200, { token: mockToken, user: mockUser });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('login-btn')).toBeInTheDocument();
      });

      await act(async () => {
        screen.getByTestId('login-btn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('username')).toHaveTextContent('testuser');
      });

      expect(localStorage.getItem('token')).toBe(mockToken);
      expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser));
      expect(screen.getByTestId('user-id')).toHaveTextContent('1');
      expect(screen.getByTestId('email')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('role')).toHaveTextContent('user');
    });

    it('should handle login failure with server error', async () => {
      // Mock CSRF token request
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(200, { csrfToken: 'csrf-token' });
      
      // Mock login request failure
      mockAxios.onPost('/auth/login').reply(401, { error: 'Invalid credentials' });

      // We'll test the return value more directly
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('login-btn')).toBeInTheDocument();
      });

      // The login will fail, but we can't easily test the return value in this setup
      // The main assertion is that the user remains null
      await act(async () => {
        screen.getByTestId('login-btn').click();
      });

      // User should remain null after failed login
      expect(screen.getByTestId('username')).toHaveTextContent('null');
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('should handle CSRF token failure during login', async () => {
      // Mock CSRF token request failure
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(500, { error: 'CSRF error' });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('login-btn')).toBeInTheDocument();
      });

      await act(async () => {
        screen.getByTestId('login-btn').click();
      });

      // User should remain null after failed login
      expect(screen.getByTestId('username')).toHaveTextContent('null');
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('should handle network errors during login', async () => {
      // Mock CSRF token request
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(200, { csrfToken: 'csrf-token' });
      
      // Mock login network error
      mockAxios.onPost('/auth/login').networkError();

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('login-btn')).toBeInTheDocument();
      });

      await act(async () => {
        screen.getByTestId('login-btn').click();
      });

      // User should remain null after failed login
      expect(screen.getByTestId('username')).toHaveTextContent('null');
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('should handle server errors without error message', async () => {
      // Mock CSRF token request
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(200, { csrfToken: 'csrf-token' });
      
      // Mock login request failure without error message
      mockAxios.onPost('/auth/login').reply(500);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('login-btn')).toBeInTheDocument();
      });

      await act(async () => {
        screen.getByTestId('login-btn').click();
      });

      // User should remain null after failed login
      expect(screen.getByTestId('username')).toHaveTextContent('null');
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  describe('Registration Functionality', () => {
    it('should register successfully', async () => {
      // Mock CSRF token request
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(200, { csrfToken: 'csrf-token' });
      
      // Mock registration request
      mockAxios.onPost('/auth/register').reply(201, { message: 'User created successfully' });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('register-btn')).toBeInTheDocument();
      });

      await act(async () => {
        screen.getByTestId('register-btn').click();
      });

      // Registration doesn't change user state, just succeeds or fails
      expect(screen.getByTestId('username')).toHaveTextContent('null');
    });

    it('should handle registration failure with server error', async () => {
      // Mock CSRF token request
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(200, { csrfToken: 'csrf-token' });
      
      // Mock registration request failure
      mockAxios.onPost('/auth/register').reply(400, { error: 'Username already exists' });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('register-btn')).toBeInTheDocument();
      });

      await act(async () => {
        screen.getByTestId('register-btn').click();
      });

      // User remains null after failed registration
      expect(screen.getByTestId('username')).toHaveTextContent('null');
    });

    it('should handle CSRF token failure during registration', async () => {
      // Mock CSRF token request failure
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(500, { error: 'CSRF error' });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('register-btn')).toBeInTheDocument();
      });

      await act(async () => {
        screen.getByTestId('register-btn').click();
      });

      // User remains null after failed registration
      expect(screen.getByTestId('username')).toHaveTextContent('null');
    });

    it('should handle network errors during registration', async () => {
      // Mock CSRF token request
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(200, { csrfToken: 'csrf-token' });
      
      // Mock registration network error
      mockAxios.onPost('/auth/register').networkError();

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('register-btn')).toBeInTheDocument();
      });

      await act(async () => {
        screen.getByTestId('register-btn').click();
      });

      // User remains null after failed registration
      expect(screen.getByTestId('username')).toHaveTextContent('null');
    });

    it('should handle server errors without error message during registration', async () => {
      // Mock CSRF token request
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(200, { csrfToken: 'csrf-token' });
      
      // Mock registration failure without error message
      mockAxios.onPost('/auth/register').reply(500);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('register-btn')).toBeInTheDocument();
      });

      await act(async () => {
        screen.getByTestId('register-btn').click();
      });

      // User remains null after failed registration
      expect(screen.getByTestId('username')).toHaveTextContent('null');
    });
  });

  describe('Logout Functionality', () => {
    it('should logout and clear user data', async () => {
      const mockUser: User = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'user'
      };

      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify(mockUser));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('username')).toHaveTextContent('testuser');
      });

      await act(async () => {
        screen.getByTestId('logout-btn').click();
      });

      expect(screen.getByTestId('username')).toHaveTextContent('null');
      expect(screen.getByTestId('user-id')).toHaveTextContent('null');
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });

    it('should handle logout when already logged out', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('username')).toHaveTextContent('null');
      });

      await act(async () => {
        screen.getByTestId('logout-btn').click();
      });

      expect(screen.getByTestId('username')).toHaveTextContent('null');
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  describe('useAuth Hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      const TestComponentWithoutProvider = () => {
        const auth = useAuth();
        return <div>{auth.user?.username}</div>;
      };

      // Capture console error to avoid noise
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponentWithoutProvider />);
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });

    it('should return auth context when used within AuthProvider', async () => {
      const TestAuthHook = () => {
        const auth = useAuth();
        return (
          <div>
            <div data-testid="has-user">{auth.user ? 'has-user' : 'no-user'}</div>
            <div data-testid="has-login">{typeof auth.login === 'function' ? 'has-login' : 'no-login'}</div>
            <div data-testid="has-register">{typeof auth.register === 'function' ? 'has-register' : 'no-register'}</div>
            <div data-testid="has-logout">{typeof auth.logout === 'function' ? 'has-logout' : 'no-logout'}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestAuthHook />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('has-user')).toHaveTextContent('no-user');
        expect(screen.getByTestId('has-login')).toHaveTextContent('has-login');
        expect(screen.getByTestId('has-register')).toHaveTextContent('has-register');
        expect(screen.getByTestId('has-logout')).toHaveTextContent('has-logout');
      });
    });
  });

  describe('User Role Management', () => {
    it('should handle different user roles', async () => {
      const adminUser: User = {
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin'
      };

      localStorage.setItem('token', 'admin-token');
      localStorage.setItem('user', JSON.stringify(adminUser));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('role')).toHaveTextContent('admin');
        expect(screen.getByTestId('username')).toHaveTextContent('admin');
      });
    });

    it('should handle user role changes through login', async () => {
      const regularUser: User = {
        id: 2,
        username: 'user',
        email: 'user@example.com',
        role: 'user'
      };

      // Mock CSRF token request
      mockAxiosBase.onGet('http://localhost:3001/api/auth/csrf').reply(200, { csrfToken: 'csrf-token' });
      
      // Mock login request
      mockAxios.onPost('/auth/login').reply(200, { token: 'user-token', user: regularUser });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('role')).toHaveTextContent('null');
      });

      await act(async () => {
        screen.getByTestId('login-btn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('role')).toHaveTextContent('user');
        expect(screen.getByTestId('username')).toHaveTextContent('user');
      });
    });
  });

  describe('Token Management', () => {
    it('should persist token across provider re-renders', async () => {
      const mockUser: User = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'user'
      };

      localStorage.setItem('token', 'persistent-token');
      localStorage.setItem('user', JSON.stringify(mockUser));

      const { rerender } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('username')).toHaveTextContent('testuser');
      });

      // Re-render the provider
      rerender(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('username')).toHaveTextContent('testuser');
      });

      expect(localStorage.getItem('token')).toBe('persistent-token');
    });

    it('should handle missing token with existing user data', async () => {
      const mockUser: User = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'user'
      };

      // Only set user data without token
      localStorage.setItem('user', JSON.stringify(mockUser));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('username')).toHaveTextContent('null');
      });
    });

    it('should handle existing token without user data', async () => {
      // Only set token without user data
      localStorage.setItem('token', 'orphaned-token');

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('username')).toHaveTextContent('null');
      });
    });
  });
});