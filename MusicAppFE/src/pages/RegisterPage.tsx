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
    window.location.href = `${BACKEND_URL}/oauth2/authorization/${provider}`;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Registration failed. Email or username might already exist.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-[calc(100dvh-8rem)] flex items-center justify-center relative overflow-hidden rounded-2xl md:rounded-3xl group p-3 sm:p-4">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[#050914]"></div>

      {/* Animated glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00E5FF]/20 rounded-full blur-[100px] mix-blend-screen animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] mix-blend-screen animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,transparent_20%,#050914_70%)] pointer-events-none"></div>

      {/* Main Container */}
      <div className="z-10 w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 bg-white/[0.02] border border-white/5 rounded-2xl md:rounded-3xl backdrop-blur-3xl shadow-2xl overflow-hidden">

        {/* Left Side: Branding / Visual */}
        <div className="hidden md:flex flex-col items-start justify-between p-12 relative overflow-hidden border-r border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent">
          <div className="absolute -left-20 -top-20 w-64 h-64 border-[1px] border-[#00E5FF]/20 rounded-full"></div>
          <div className="absolute -left-40 -top-40 w-96 h-96 border-[1px] border-[#00E5FF]/10 rounded-full"></div>

          <div>
            <div className="w-12 h-12 rounded-2xl bg-[#00E5FF]/10 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,229,255,0.2)]">
              <Disc size={26} className="text-[#00E5FF] animate-spin-slow" />
            </div>
            <h1 className="text-4xl font-bold font-sans text-white tracking-tight leading-tight">
              Master your <br />
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

        {/* Right Side: Register Form */}
        <div className="flex flex-col justify-center p-5 sm:p-8 md:p-12 relative">
          <h2 className="text-2xl font-semibold text-white mb-2">Create your account</h2>
          <p className="text-sm text-white/50 mb-8">Join Rhythm and sync your presets.</p>

          <form onSubmit={handleRegister} className="w-full space-y-4">

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Input Groups - Clean & Minimal */}
            <div className="group/input relative">
              <div className="absolute -top-2.5 left-3 bg-[#050914] px-1 text-xs text-white/70">
                Email Address
              </div>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail size={16} className="text-white/50 group-focus-within/input:text-[#00E5FF] transition-colors" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-black/20 border border-white/10 hover:border-white/30 focus:border-[#00E5FF] text-white text-sm py-3.5 pl-10 pr-2 rounded-lg outline-none transition-all"
              />
            </div>

            <div className="group/input relative">
              <div className="absolute -top-2.5 left-3 bg-[#050914] px-1 text-xs text-white/70">
                Display Name
              </div>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <IdCard size={16} className="text-white/50 group-focus-within/input:text-[#00E5FF] transition-colors" />
              </div>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full bg-black/20 border border-white/10 hover:border-white/30 focus:border-[#00E5FF] text-white text-sm py-3.5 pl-10 pr-2 rounded-lg outline-none transition-all"
              />
            </div>

            <div className="group/input relative">
              <div className="absolute -top-2.5 left-3 bg-[#050914] px-1 text-xs text-white/70">
                Password
              </div>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={16} className="text-white/40 hover:text-white transition-colors" /> : <Eye size={16} className="text-white/40 hover:text-white transition-colors" />}
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-black/20 border border-white/10 hover:border-white/30 focus:border-[#00E5FF] text-white text-sm py-3.5 pl-4 pr-10 rounded-lg outline-none transition-all"
              />
            </div>

            <div className="group/input relative">
              <div className="absolute -top-2.5 left-3 bg-[#050914] px-1 text-xs text-white/70">
                Confirm Password
              </div>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                {showConfirmPassword ? <EyeOff size={16} className="text-white/40 hover:text-white transition-colors" /> : <Eye size={16} className="text-white/40 hover:text-white transition-colors" />}
              </div>
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full bg-black/20 border border-white/10 hover:border-white/30 focus:border-[#00E5FF] text-white text-sm py-3.5 pl-4 pr-10 rounded-lg outline-none transition-all"
              />
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-black font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(0,229,255,0.3)] hover:shadow-[0_0_30px_rgba(0,229,255,0.5)] transition-all mt-6 disabled:opacity-50"
            >
              <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
              {!loading && <ChevronRight size={18} strokeWidth={3} />}
            </button>
          </form>

          <div className="relative flex items-center justify-center w-full my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative px-4 bg-transparent text-xs font-mono text-white/30 uppercase">Or continue with</div>
          </div>

          {/* Social / Alternative Logins */}
          <div className="flex justify-center mt-6">
            <button
              onClick={() => handleOAuthLogin('google')}
              className="flex items-center justify-center gap-3 w-full bg-white/5 hover:bg-white/10 text-white py-3 px-6 rounded-xl border border-white/5 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span className="font-medium text-sm text-white/80">Sign up with Google</span>
            </button>
          </div>

          <p className="mt-6 text-[11px] text-center text-white/30 leading-relaxed">
            Already have an account? <NavLink to="/login" className="text-[#00E5FF] hover:underline transition-colors">Sign in here</NavLink>.
          </p>

        </div>
      </div>
    </div>
  );
}
