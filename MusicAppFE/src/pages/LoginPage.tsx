import { Disc, ChevronRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { axiosClient } from '../api/axiosClient';
import { useGlobalAudio } from '../context/AudioContext';

const BACKEND_URL = `http://${window.location.hostname}:8080`;

export function LoginPage() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setJwtToken } = useGlobalAudio();
  const navigate = useNavigate();

  const handleGoogleLogin = (provider: string = 'google') => {
    window.location.href = `${BACKEND_URL}/oauth2/authorization/${provider}`;
  };

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId || !password) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response: any = await axiosClient.post('/api/auth/login', {
        loginId,
        password
      });
      if (response && response.accessToken) {
        setJwtToken(response.accessToken);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full min-h-[75vh] flex items-center justify-center relative overflow-hidden rounded-3xl group">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[#050914]"></div>
      
      {/* Animated glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00E5FF]/20 rounded-full blur-[100px] mix-blend-screen animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] mix-blend-screen animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,transparent_20%,#050914_70%)] pointer-events-none"></div>

      {/* Main Container */}
      <div className="z-10 w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-3xl shadow-2xl overflow-hidden">
        
        {/* Left Side: Branding / Visual */}
        <div className="hidden md:flex flex-col items-start justify-between p-12 relative overflow-hidden border-r border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent">
          <div className="absolute -left-20 -top-20 w-64 h-64 border-[1px] border-[#00E5FF]/20 rounded-full"></div>
          <div className="absolute -left-40 -top-40 w-96 h-96 border-[1px] border-[#00E5FF]/10 rounded-full"></div>

          <div>
            <div className="w-12 h-12 rounded-2xl bg-[#00E5FF]/10 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,229,255,0.2)]">
              <Disc size={26} className="text-[#00E5FF] animate-spin-slow" />
            </div>
            <h1 className="text-4xl font-bold font-sans text-white tracking-tight leading-tight">
              Master your <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E5FF] to-blue-500">Audio Space</span>
            </h1>
            <p className="text-sm font-mono text-white/50 mt-4 max-w-xs leading-relaxed">
              Connect to your Rhythm workspace. Adjust frequencies, dial in the perfect tone, and sync it all locally.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-white/30 uppercase tracking-widest mt-12">
            <span>v1.0.0</span>
            <span className="w-1 h-1 rounded-full bg-white/20"></span>
            <span>Web Audio API</span>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="flex flex-col justify-center p-8 sm:p-12 relative">
          <h2 className="text-2xl font-semibold text-white mb-2">Welcome back</h2>
          <p className="text-sm text-white/50 mb-10">Sign in to sync your presets and audio graphs.</p>

          <form onSubmit={handleLocalLogin} className="w-full space-y-4">
            
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Input Groups - Clean & Minimal */}
            <div className="group/input relative">
              <input 
                type="text" 
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="Email address or username"
                required
                className="w-full bg-black/20 border-b border-white/10 hover:border-white/30 focus:border-[#00E5FF] text-white text-sm py-4 px-2 outline-none transition-all placeholder:text-white/30"
              />
            </div>

            <div className="group/input relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="w-full bg-black/20 border-b border-white/10 hover:border-white/30 focus:border-[#00E5FF] text-white text-sm py-4 px-2 pr-10 outline-none transition-all placeholder:text-white/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="pt-2 pb-2 flex justify-end">
              <button 
                type="button" 
                onClick={() => navigate('/forgot-password')}
                className="text-xs text-white/50 hover:text-[#00E5FF] transition-colors"
              >
                Forgot Password?
              </button>
            </div>

            {/* Login Button */}
            <button 
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-black font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(0,229,255,0.3)] hover:shadow-[0_0_30px_rgba(0,229,255,0.5)] transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <span>Sign In</span>}
              {!loading && <ChevronRight size={18} strokeWidth={3} />}
            </button>
          </form>

          <div className="relative flex items-center justify-center w-full my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative px-4 bg-transparent text-xs font-mono text-white/30 uppercase">Or continue with</div>
          </div>

          {/* Social / Alternative Logins */}
          <div className="flex justify-center mt-6">
            <button 
              onClick={() => handleGoogleLogin('google')}
              className="flex items-center justify-center gap-3 w-full bg-white/5 hover:bg-white/10 text-white py-3 px-6 rounded-xl border border-white/5 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span className="font-medium text-sm text-white/80">Continue with Google</span>
            </button>
          </div>

          <p className="mt-8 text-[11px] text-center text-white/30 leading-relaxed">
            Don't have an account? <NavLink to="/register" className="text-[#00E5FF] hover:underline transition-colors">Create one now</NavLink> to access advanced EQ features.
          </p>

        </div>
      </div>
    </div>
  );
}
