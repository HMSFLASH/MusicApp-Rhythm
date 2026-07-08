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

const TOKEN_COOKIE_NAME = 'music_app_token';

function getCookie(name: string) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return null;
}

function setCookie(name: string, value: string, days: number = 7) {
  const d = new Date();
  d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `expires=${d.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/;Secure;SameSite=Strict`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;Secure;SameSite=Strict`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [jwtToken, setJwtTokenState] = useState(() => {
    return getCookie(TOKEN_COOKIE_NAME) || '';
  });
  const [driveToken, setDriveTokenState] = useState<string>('');

  const setJwtToken = (token: string) => {
    if (token) {
      setCookie(TOKEN_COOKIE_NAME, token);
    } else {
      deleteCookie(TOKEN_COOKIE_NAME);
    }
    setJwtTokenState(token);
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
