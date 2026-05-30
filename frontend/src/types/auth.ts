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
  /** True when the user has biometric quick-login enabled for this app */
  biometricEnrolled: boolean;
  /** Whether the device supports biometrics (async, native-only) */
  canUseBiometric: () => Promise<{ available: boolean; biometryType?: string }>;
  /** Store current session token in secure storage for biometric unlock */
  enrollBiometricAfterLogin: () => Promise<{ success: boolean; error?: string }>;
  /** Unlock stored session via biometric prompt; sets auth state on success */
  biometricLogin: () => Promise<{ success: boolean; error?: string }>;
  /** Remove biometric enrollment from secure storage */
  disableBiometric: () => Promise<void>;
}

export interface AuthProviderProps {
  children: React.ReactNode;
}