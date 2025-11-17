export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  passwordMustChange?: boolean;
}

export interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateUser: (token: string, user: User) => void;
}

export interface AuthProviderProps {
  children: React.ReactNode;
}