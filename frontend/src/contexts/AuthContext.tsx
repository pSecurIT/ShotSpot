import { createContext, useContext, useState, useEffect } from 'react';
import axios, { AxiosError } from 'axios';
import { User, AuthContextType, AuthProviderProps } from '../types/auth';

const API_URL = import.meta.env.VITE_API_URL;

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Get CSRF token first
      const csrfResponse = await axios.get(`${API_URL}/auth/csrf`);
      const csrfToken = csrfResponse.data.csrfToken;
      
      const response = await axios.post<{ token: string; user: User }>(`${API_URL}/auth/login`, {
        username,
        password,
      }, {
        headers: {
          'X-CSRF-Token': csrfToken
        }
      });
      
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      axios.defaults.headers.common['X-CSRF-Token'] = csrfToken;
      setUser(user);
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
      await axios.post('http://localhost:3001/api/auth/register', {
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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
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