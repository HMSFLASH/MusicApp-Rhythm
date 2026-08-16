import { Disc, ChevronRight, Mail, Eye, EyeOff, IdCard } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { axiosClient } from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { BACKEND_URL } from '../api/axiosClient';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { setIsAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleOAuthLogin = (provider: string) => {
    globalThis.location.href = `${BACKEND_URL}/oauth2/authorization/${provider}`;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !displayName || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await axiosClient.post('/api/auth/register', {
        username: displayName,
        email,
        password
      });
      setIsAuthenticated(true);
      navigate('/');

    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Registration failed. Email or username might already exist.');
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
              Join the <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-300">Rhythm Experience</span>
            </h1>
            <p className="text-xs lg:text-sm font-mono text-slate-400 mt-4 max-w-xs leading-relaxed">
              Create an account to unlock cloud music storage, synced audio profiles, and studio-grade DSP features.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-slate-500 uppercase tracking-widest mt-12">
            <span>Rhythm Pro</span>
            <span className="w-1 h-1 rounded-full bg-slate-600"></span>
            <span>DSP & Equalizer</span>
          </div>
        </div>

        {/* Right Side: Register Form */}
        <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-12 relative">
          <h2 className="text-2xl font-bold font-display text-white mb-1">Create Account</h2>
          <p className="text-xs font-mono text-slate-400 mb-6">Join Rhythm to sync and manage your music.</p>

          <form onSubmit={handleRegister} className="w-full space-y-3.5">

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium">
                {error}
              </div>
            )}

            {/* Input Groups */}
            <div className="space-y-1">
              <label className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full bg-white/[0.03] border border-white/[0.08] hover:border-white/20 focus:border-primary text-white text-sm rounded-xl py-2.5 pl-9 pr-3.5 outline-none transition-all placeholder:text-slate-500 font-sans focus:shadow-[0_0_15px_rgba(0,245,255,0.15)]"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={15} className="text-slate-400" />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                Display Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your username"
                  required
                  className="w-full bg-white/[0.03] border border-white/[0.08] hover:border-white/20 focus:border-primary text-white text-sm rounded-xl py-2.5 pl-9 pr-3.5 outline-none transition-all placeholder:text-slate-500 font-sans focus:shadow-[0_0_15px_rgba(0,245,255,0.15)]"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <IdCard size={15} className="text-slate-400" />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  required
                  className="w-full bg-white/[0.03] border border-white/[0.08] hover:border-white/20 focus:border-primary text-white text-sm rounded-xl py-2.5 px-3.5 pr-10 outline-none transition-all placeholder:text-slate-500 font-sans focus:shadow-[0_0_15px_rgba(0,245,255,0.15)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  required
                  className="w-full bg-white/[0.03] border border-white/[0.08] hover:border-white/20 focus:border-primary text-white text-sm rounded-xl py-2.5 px-3.5 pr-10 outline-none transition-all placeholder:text-slate-500 font-sans focus:shadow-[0_0_15px_rgba(0,245,255,0.15)]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Create Account Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:brightness-110 text-slate-950 font-bold py-3.5 rounded-xl shadow-[0_0_20px_rgba(0,245,255,0.35)] hover:shadow-[0_0_25px_rgba(0,245,255,0.5)] transition-all mt-4 disabled:opacity-50 text-sm hover:scale-[1.01] active:scale-[0.99]"
            >
              <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
              {!loading && <ChevronRight size={16} strokeWidth={3} />}
            </button>
          </form>

          <div className="relative flex items-center justify-center w-full my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.06]"></div>
            </div>
            <div className="relative px-3 bg-[#0c1626] text-[10px] font-mono text-slate-500 uppercase tracking-widest">Or continue with</div>
          </div>

          {/* Social / Alternative Logins */}
          <div className="flex justify-center">
            <button
              onClick={() => handleOAuthLogin('google')}
              className="flex items-center justify-center gap-3 w-full bg-white/[0.03] hover:bg-white/[0.07] text-white py-3 px-4 rounded-xl border border-white/[0.08] hover:border-white/20 transition-all text-xs font-semibold"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span className="text-slate-200">Sign up with Google</span>
            </button>
          </div>

          <p className="mt-5 text-xs text-center text-slate-400 font-mono">
            Already have an account? <NavLink to="/login" className="text-primary hover:underline font-semibold ml-1">Sign in here</NavLink>
          </p>

        </div>
      </div>
    </div>
  );
}
