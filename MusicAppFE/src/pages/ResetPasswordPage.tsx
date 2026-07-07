import { Disc, ChevronRight, Loader2, Lock, Eye, EyeOff } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { axiosClient } from '../api/axiosClient';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!token) {
      setError('Invalid or missing token');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await axiosClient.post('/api/auth/reset-password', { token, newPassword });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to reset password. The link might be expired.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="w-full h-full min-h-[75vh] flex items-center justify-center">
        <div className="text-center p-8 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-3xl shadow-2xl">
          <h2 className="text-xl text-white mb-2">Invalid Link</h2>
          <p className="text-white/50 text-sm">The password reset link is invalid or missing the token.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[75vh] flex items-center justify-center relative overflow-hidden rounded-3xl group">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[#050914]"></div>
      
      {/* Animated glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00E5FF]/20 rounded-full blur-[100px] mix-blend-screen animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] mix-blend-screen animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,transparent_20%,#050914_70%)] pointer-events-none"></div>

      {/* Main Container */}
      <div className="z-10 w-full max-w-md bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-3xl shadow-2xl overflow-hidden p-8 sm:p-12 relative">
        
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#00E5FF]/10 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,229,255,0.2)]">
            <Disc size={26} className="text-[#00E5FF] animate-spin-slow" />
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">Create New Password</h2>
          
          {success ? (
            <div className="mt-4">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm mb-6">
                Password successfully reset!
              </div>
              <p className="text-sm text-white/50 mb-8">
                Redirecting to login page...
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-white/50 mb-8">
                Your new password must be different from previous used passwords.
              </p>

              <form onSubmit={handleSubmit} className="w-full space-y-4">
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-left">
                    {error}
                  </div>
                )}

                <div className="group/input relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock size={16} className="text-white/50 group-focus-within/input:text-[#00E5FF] transition-colors" />
                  </div>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={16} className="text-white/40 hover:text-white transition-colors" /> : <Eye size={16} className="text-white/40 hover:text-white transition-colors" />}
                  </div>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New Password"
                    required
                    className="w-full bg-black/20 border-b border-white/10 hover:border-white/30 focus:border-[#00E5FF] text-white text-sm py-4 pl-10 pr-10 outline-none transition-all placeholder:text-white/30"
                  />
                </div>

                <div className="group/input relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock size={16} className="text-white/50 group-focus-within/input:text-[#00E5FF] transition-colors" />
                  </div>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                    {showConfirmPassword ? <EyeOff size={16} className="text-white/40 hover:text-white transition-colors" /> : <Eye size={16} className="text-white/40 hover:text-white transition-colors" />}
                  </div>
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm New Password"
                    required
                    className="w-full bg-black/20 border-b border-white/10 hover:border-white/30 focus:border-[#00E5FF] text-white text-sm py-4 pl-10 pr-10 outline-none transition-all placeholder:text-white/30"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-black font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(0,229,255,0.3)] hover:shadow-[0_0_30px_rgba(0,229,255,0.5)] transition-all mt-6 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <span>Reset Password</span>}
                  {!loading && <ChevronRight size={18} strokeWidth={3} />}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
