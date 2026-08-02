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
    let mounted = true;

    const initAuth = async () => {
      try {
        // 1. Check Supabase First
        const { supabase } = await import('../lib/supabase');
        
        // Listen for login/logout events from Google OAuth
        supabase.auth.onAuthStateChange((event, session) => {
          if (mounted && session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
            setUser({
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.full_name || session.user.email,
              avatarUrl: session.user.user_metadata?.avatar_url,
            });
            setIsAuthenticatedState(true);
            setIsAuthResolved(true);
            
            if (session.provider_refresh_token) {
              const authHeader = `Bearer ${session.access_token}`;
              axiosClient.post('/api/auth/link-drive', {
                providerRefreshToken: session.provider_refresh_token
              }, {
                headers: { 'Authorization': authHeader }
              }).catch(err => console.error("Failed to link Google Drive token to backend", err));
            }
          } else if (mounted && event === 'SIGNED_OUT') {
            setIsAuthenticatedState(false);
            setUser(null);
          }
        });

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          if (mounted) {
            setUser({
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.full_name || session.user.email,
              avatarUrl: session.user.user_metadata?.avatar_url,
            });
            setIsAuthenticatedState(true);
            setIsAuthResolved(true);
          }
          
          if (session.provider_refresh_token) {
            try {
              // Ensure authorization header is set before making the request
              const authHeader = `Bearer ${session.access_token}`;
              await axiosClient.post('/api/auth/link-drive', {
                providerRefreshToken: session.provider_refresh_token
              }, {
                headers: { 'Authorization': authHeader }
              });
            } catch (err) {
              console.error("Failed to link Google Drive token to backend", err);
            }
          }
          
          return; // Skip backend check if logged in via Supabase
        }
      } catch (e) {
        console.error("Supabase auth error:", e);
      }

      // 2. Fallback to Local Backend Check
      axiosClient.get('/api/auth/csrf')
        .then(() => axiosClient.get('/api/auth/me'))
        .then((res) => {
          if (mounted) {
            setUser(res as AuthUser);
            setIsAuthenticatedState(true);
          }
        })
        .catch(() => {
          if (mounted) setIsAuthenticatedState(false);
        })
        .finally(() => {
          if (mounted) setIsAuthResolved(true);
        });
    };

    void initAuth();

    return () => {
      mounted = false;
    };
  }, []); // Run once on mount

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
