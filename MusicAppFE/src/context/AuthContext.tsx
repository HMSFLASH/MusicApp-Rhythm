import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { axiosClient } from '../api/axiosClient';

interface AuthContextType {
  jwtToken: string;
  setJwtToken: (token: string) => void;
  driveToken: string;
  fetchDriveToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [jwtToken, setJwtTokenState] = useState(() => {
    return localStorage.getItem('music_app_token') || '';
  });
  const [driveToken, setDriveTokenState] = useState<string>('');

  const setJwtToken = (token: string) => {
    if (token) {
      localStorage.setItem('music_app_token', token);
    } else {
      localStorage.removeItem('music_app_token');
    }
    setJwtTokenState(token);
  };

  const fetchDriveToken = async () => {
    try {
      const response = await axiosClient.get('/api/music/drive-token');
      const token = response.result?.accessToken || '';
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
    if (jwtToken && !driveToken) {
      fetchDriveToken();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jwtToken]);

  return (
    <AuthContext.Provider value={{ jwtToken, setJwtToken, driveToken, fetchDriveToken }}>
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
