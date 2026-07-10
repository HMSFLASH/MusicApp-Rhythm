import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { axiosClient } from '../api/axiosClient';

type AuthUser = {
  id?: string;
  email?: string;
  loginId?: string;
  username?: string;
  name?: string;
  fullName?: string;
  avatarUrl?: string;
  isGoogleLinked?: boolean;
  hasPassword?: boolean;
};

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthResolved: boolean;
  setIsAuthenticated: (auth: boolean) => void;
  driveToken: string;
  fetchDriveToken: () => Promise<string>;
  user: AuthUser | null;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticatedState] = useState(false);
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [driveToken, setDriveToken] = useState('');

  const setIsAuthenticated = (auth: boolean) => {
    if (!auth) {
      setUser(null);
      setDriveToken('');
    }
    setIsAuthenticatedState(auth);
  };

  const fetchDriveToken = useCallback(async () => {
    try {
      const response = await axiosClient.get('/api/music/drive-token') as { accessToken?: string };
      const token = response.accessToken || '';
      setDriveToken(token);
      return token;
    } catch {
      setDriveToken('');
      return '';
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await axiosClient.get('/api/auth/me');
      setUser(res as AuthUser);
    } catch (error) {
      console.error('Failed to refresh user', error);
    }
  }, []);

  useEffect(() => {
    void axiosClient.get('/api/auth/csrf')
      .then(() => axiosClient.get('/api/auth/me'))
      .then((res) => {
        setUser(res as AuthUser);
        setIsAuthenticatedState(true);
      })
      .catch(() => setIsAuthenticatedState(false))
      .finally(() => setIsAuthResolved(true));
  }, [isAuthenticated]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isAuthenticated) void fetchDriveToken();
  }, [isAuthenticated, fetchDriveToken]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isAuthResolved, setIsAuthenticated, driveToken, fetchDriveToken, user, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
