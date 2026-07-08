import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';;
import { Disc } from 'lucide-react';

export function OAuthCallback() {
  const navigate = useNavigate();
  const { setIsAuthenticated } = useAuth();

  useEffect(() => {
    // With HttpOnly cookies, the backend sets the cookie and redirects here.
    // We just need to mark as authenticated and redirect home.
    setIsAuthenticated(true);
    navigate('/', { replace: true });
  }, [navigate, setIsAuthenticated]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background">
      <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-6">
        <Disc size={32} className="text-primary animate-spin" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Authenticating...</h2>
      <p className="text-sm font-mono text-white/50">Securing your dual-storage connection</p>
    </div>
  );
}
