import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';;
import { Disc } from 'lucide-react';

export function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setJwtToken } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (token) {
      // Save token and go to home
      setJwtToken(token);
      navigate('/', { replace: true });
    } else {
      // Auth failed or missing token
      console.error("OAuth Callback failed: Missing token in URL");
      navigate('/', { replace: true }); // Will bounce back to login if token is empty
    }
  }, [searchParams, navigate, setJwtToken]);

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
