import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { axiosClient } from '../api/axiosClient';

interface AuthContextType {
  isAuthenticated: boolean;
  setIsAuthenticated: (auth: boolean) => void;
  driveToken: string;
  fetchDriveToken: () => Promise<string>;
  user: any | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticatedState] = useState<boolean>(() => {
    return localStorage.getItem('music_app_logged_in') === 'true';
  });
  const [driveToken, setDriveTokenState] = useState<string>('');
  const [user, setUser] = useState<any | null>(null);

  const setIsAuthenticated = (auth: boolean) => {
    if (auth) {
      localStorage.setItem('music_app_logged_in', 'true');
    } else {
      localStorage.removeItem('music_app_logged_in');
      setUser(null);
    }
    setIsAuthenticatedState(auth);
  };

  const fetchDriveToken = async () => {
    try {
      const response = await axiosClient.get('/api/music/drive-token');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const token = (response as any).accessToken || (response as any).result?.accessToken || '';
      if (token) {
        setDriveTokenState(token);
      }
      return token;
    } catch (e) {
      console.error("Failed to fetch drive token", e);
      return '';
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      axiosClient.get('/api/auth/me')
        .then((res: any) => setUser(res))
        .catch(() => setIsAuthenticated(false));
      
      if (!driveToken) {
        fetchDriveToken();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, setIsAuthenticated, driveToken, fetchDriveToken, user }}>
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
