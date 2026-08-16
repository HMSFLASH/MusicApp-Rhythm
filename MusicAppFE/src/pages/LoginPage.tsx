import { Disc, ChevronRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { axiosClient } from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { BACKEND_URL } from '../api/axiosClient';

export function LoginPage() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setIsAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const errorParam = searchParams.get('error');
    const messageParam = searchParams.get('message');
    if (errorParam === 'oauth2_failure') {
      setError(messageParam || 'Google login failed');
    }
  }, [searchParams]);

  const handleGoogleLogin = (provider: string = 'google') => {
    globalThis.location.href = `${BACKEND_URL}/oauth2/authorization/${provider}`;
  };

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId || !password) return;

    setLoading(true);
    setError('');

    try {
      await axiosClient.post('/api/auth/login', {
        loginId,
        password
      });
      setIsAuthenticated(true);
      navigate('/');

    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-[calc(100dvh-8rem)] flex items-center justify-center relative overflow-hidden rounded-2xl md:rounded-3xl p-3 sm:p-4">
      {/* Dynamic Ambient Background */}
      <div className="absolute inset-0 bg-[#060b14]"></div>

      {/* Ambient glowing lighting orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-[120px] mix-blend-screen animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-[120px] mix-blend-screen animate-pulse pointer-events-none" style={{ animationDelay: '1s' }}></div>

      {/* Main Container */}
      <div className="z-10 w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 bg-[#0c1626]/80 border border-white/[0.08] rounded-3xl backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden">

        {/* Left Side: Branding / Visual */}
        <div className="hidden md:flex flex-col items-start justify-between p-10 lg:p-12 relative overflow-hidden border-r border-white/[0.06] bg-gradient-to-br from-primary/10 via-transparent to-transparent">
          <div className="absolute -left-20 -top-20 w-64 h-64 border border-primary/15 rounded-full pointer-events-none"></div>
          <div className="absolute -left-40 -top-40 w-96 h-96 border border-primary/10 rounded-full pointer-events-none"></div>

          <div>
            <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-6 shadow-[0_0_25px_rgba(0,245,255,0.25)]">
              <Disc size={26} className="text-primary animate-spin-slow" />
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold font-display text-white tracking-tight leading-tight">
              Master your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-300">Audio Space</span>
            </h1>
            <p className="text-xs lg:text-sm font-mono text-slate-400 mt-4 max-w-xs leading-relaxed">
              Connect to your Rhythm workspace. Adjust frequencies, dial in the perfect tone, and sync your music library.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-slate-500 uppercase tracking-widest mt-12">
            <span>Rhythm Pro</span>
            <span className="w-1 h-1 rounded-full bg-slate-600"></span>
            <span>Web Audio Engine</span>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-12 relative">
          <h2 className="text-2xl font-bold font-display text-white mb-1">Welcome back</h2>
          <p className="text-xs font-mono text-slate-400 mb-8">Sign in to sync your presets and audio library.</p>

          <form onSubmit={handleLocalLogin} className="w-full space-y-4">

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium">
                {error}
              </div>
            )}

            {/* Input Groups */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                Email or Username
              </label>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="Enter email or username"
                required
                className="w-full bg-white/[0.03] border border-white/[0.08] hover:border-white/20 focus:border-primary text-white text-sm rounded-xl py-3 px-3.5 outline-none transition-all placeholder:text-slate-500 font-sans focus:shadow-[0_0_15px_rgba(0,245,255,0.15)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="w-full bg-white/[0.03] border border-white/[0.08] hover:border-white/20 focus:border-primary text-white text-sm rounded-xl py-3 px-3.5 pr-10 outline-none transition-all placeholder:text-slate-500 font-sans focus:shadow-[0_0_15px_rgba(0,245,255,0.15)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="pt-1 pb-1 flex justify-end">
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-xs font-mono text-slate-400 hover:text-primary transition-colors"
              >
                Forgot Password?
              </button>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:brightness-110 text-slate-950 font-bold py-3.5 rounded-xl shadow-[0_0_20px_rgba(0,245,255,0.35)] hover:shadow-[0_0_25px_rgba(0,245,255,0.5)] transition-all disabled:opacity-50 text-sm hover:scale-[1.01] active:scale-[0.99]"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <span>Sign In</span>}
              {!loading && <ChevronRight size={16} strokeWidth={3} />}
            </button>
          </form>

          <div className="relative flex items-center justify-center w-full my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.06]"></div>
            </div>
            <div className="relative px-3 bg-[#0c1626] text-[10px] font-mono text-slate-500 uppercase tracking-widest">Or continue with</div>
          </div>

          {/* Social / Alternative Logins */}
          <div className="flex justify-center">
            <button
              onClick={() => handleGoogleLogin('google')}
              className="flex items-center justify-center gap-3 w-full bg-white/[0.03] hover:bg-white/[0.07] text-white py-3 px-4 rounded-xl border border-white/[0.08] hover:border-white/20 transition-all text-xs font-semibold"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span className="text-slate-200">Continue with Google</span>
            </button>
          </div>

          <p className="mt-6 text-xs text-center text-slate-400 font-mono">
            Don't have an account? <NavLink to="/register" className="text-primary hover:underline font-semibold ml-1">Create one now</NavLink>
          </p>

        </div>
      </div>
    </div>
  );
}
