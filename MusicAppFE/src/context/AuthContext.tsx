import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface AuthContextType {
  jwtToken: string;
  setJwtToken: (token: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [jwtToken, setJwtTokenState] = useState(() => {
    return localStorage.getItem('music_app_token') || '';
  });

  const setJwtToken = (token: string) => {
    if (token) {
      localStorage.setItem('music_app_token', token);
    } else {
      localStorage.removeItem('music_app_token');
    }
    setJwtTokenState(token);
  };

  return (
    <AuthContext.Provider value={{ jwtToken, setJwtToken }}>
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
