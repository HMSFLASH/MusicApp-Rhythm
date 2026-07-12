import { Disc, ChevronRight, Mail, Loader2, ArrowLeft } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import { axiosClient } from '../api/axiosClient';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError('');
    
    try {
      await axiosClient.post('/api/auth/forgot-password', { email });
      setSuccess(true);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError('An error occurred. Please try again later.');
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
      <div className="z-10 w-full max-w-md bg-white/[0.02] border border-white/5 rounded-2xl md:rounded-3xl backdrop-blur-3xl shadow-2xl overflow-hidden p-5 sm:p-8 md:p-12 relative">
        <NavLink to="/login" className="absolute top-5 left-5 sm:top-8 sm:left-8 text-white/50 hover:text-white transition-colors flex items-center gap-2 text-sm">
          <ArrowLeft size={16} />
          Back
        </NavLink>

        <div className="flex flex-col items-center text-center mt-8">
          <div className="w-12 h-12 rounded-2xl bg-[#00E5FF]/10 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,229,255,0.2)]">
            <Disc size={26} className="text-[#00E5FF] animate-spin-slow" />
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">Reset Password</h2>
          
          {success ? (
            <div className="mt-4">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm mb-6">
                If your email is registered, you will receive a password reset link shortly.
              </div>
              <p className="text-sm text-white/50 mb-8">
                Please check your email inbox and spam folder.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-white/50 mb-8">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit} className="w-full space-y-4">
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-left">
                    {error}
                  </div>
                )}

                <div className="group/input relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail size={16} className="text-white/50 group-focus-within/input:text-[#00E5FF] transition-colors" />
                  </div>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email Address"
                    required
                    className="w-full bg-black/20 border-b border-white/10 hover:border-white/30 focus:border-[#00E5FF] text-white text-sm py-4 pl-10 pr-2 outline-none transition-all placeholder:text-white/30"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-black font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(0,229,255,0.3)] hover:shadow-[0_0_30px_rgba(0,229,255,0.5)] transition-all mt-6 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <span>Send Reset Link</span>}
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
