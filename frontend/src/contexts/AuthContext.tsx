import { createContext, useContext, useState, useEffect } from 'react';
import { AxiosError } from 'axios';
import { User, AuthContextType, AuthProviderProps } from '../types/auth';
import api, { getCsrfToken } from '../utils/api';
import {
  clearStoredAuthSession,
  getStoredAuthSession,
  getStoredAuthToken,
  getStoredAuthUser,
  setStoredAuthToken,
  setStoredAuthUser,
} from '../utils/authSessionStorage';
import { registerServiceWorker } from '../utils/serviceWorker';
import {
  biometricErrorMessage,
  biometricUnlock,
  disableBiometric as disableBiometricService,
  enrollBiometric,
  hasAppBiometricEnrollment,
  isBiometricAvailable,
} from '../utils/biometricService';

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);

  useEffect(() => {
    const bootstrapAuth = async () => {
      const { token, userJson } = await getStoredAuthSession();
      if (token && userJson && userJson !== 'undefined' && userJson !== 'null') {
        try {
          setUser(JSON.parse(userJson));
          if (import.meta.env.PROD) {
            registerServiceWorker();
          }
        } catch (error) {
          console.error('Failed to parse stored user data:', error);
          localStorage.removeItem('user');
          localStorage.removeItem('token');
        }
      }

      // Async biometric enrollment check – does not block auth init
      hasAppBiometricEnrollment().then(enrolled => setBiometricEnrolled(enrolled));
      setLoading(false);
    };

    void bootstrapAuth();
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Ensure we have a CSRF token before attempting login
      await getCsrfToken();
      
      const response = await api.post<{ token: string; user: User }>('/auth/login', {
        username,
        password,
      });
      
      const { token, user } = response.data;
      if (!token || !user) {
        return {
          success: false,
          error: 'Invalid username or password'
        };
      }

      setStoredAuthToken(token);
      setStoredAuthUser(JSON.stringify(user));
      setUser(user);
      
      // Register service worker after successful login (production only)
      if (import.meta.env.PROD) {
        registerServiceWorker();
      }
      
      return { success: true };
    } catch (error) {
      const axiosError = error as AxiosError<{ error: string }>;
      return {
        success: false,
        error: axiosError.response?.data?.error || 'Login failed'
      };
    }
  };

  const register = async (username: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Ensure we have a CSRF token before attempting registration
      await getCsrfToken();
      
      await api.post('/auth/register', {
        username,
        email,
        password,
      });
      return { success: true };
    } catch (error) {
      const axiosError = error as AxiosError<{ error: string }>;
      return {
        success: false,
        error: axiosError.response?.data?.error || 'Registration failed'
      };
    }
  };

  const logout = () => {
    clearStoredAuthSession();
    setUser(null);
    // Clear biometric enrollment so the next user must re-enroll after login
    void disableBiometricService();
    setBiometricEnrolled(false);
  };

  const canUseBiometric = async (): Promise<{ available: boolean; biometryType?: string }> => {
    const result = await isBiometricAvailable();
    return { available: result.available, biometryType: result.biometryType?.toString() };
  };

  const enrollBiometricAfterLogin = async (): Promise<{ success: boolean; error?: string }> => {
    const token   = getStoredAuthToken();
    const userJson = getStoredAuthUser();
    if (!token || !userJson) {
      return { success: false, error: 'No active session to enrol.' };
    }
    const result = await enrollBiometric(token, userJson);
    if (result.success) {
      setBiometricEnrolled(true);
      return { success: true };
    }
    return { success: false, error: biometricErrorMessage(result.errorCode) };
  };

  const biometricLogin = async (): Promise<{ success: boolean; error?: string }> => {
    const result = await biometricUnlock();
    if (result.success && result.token && result.userJson) {
      try {
        const parsedUser = JSON.parse(result.userJson) as User;
        setStoredAuthToken(result.token);
        setStoredAuthUser(result.userJson);
        setUser(parsedUser);
        setBiometricEnrolled(true);
        if (import.meta.env.PROD) {
          registerServiceWorker();
        }
        return { success: true };
      } catch {
        return { success: false, error: 'Session data corrupted. Please log in with your password.' };
      }
    }
    return { success: false, error: biometricErrorMessage(result.errorCode) };
  };

  const disableBiometric = async (): Promise<void> => {
    await disableBiometricService();
    setBiometricEnrolled(false);
  };

  const updateUser = (token: string, updatedUser: User) => {
    setStoredAuthToken(token);
    setStoredAuthUser(JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{
      user,
      login,
      register,
      logout,
      updateUser,
      biometricEnrolled,
      canUseBiometric,
      enrollBiometricAfterLogin,
      biometricLogin,
      disableBiometric,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};