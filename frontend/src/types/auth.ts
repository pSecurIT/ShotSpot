export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

export interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

export interface AuthProviderProps {
  children: React.ReactNode;
}