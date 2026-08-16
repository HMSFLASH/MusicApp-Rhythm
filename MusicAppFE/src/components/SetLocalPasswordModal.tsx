import { useState } from 'react';
import { X, Key, User, Lock, Loader2 } from 'lucide-react';
import { axiosClient } from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';

interface SetLocalPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
}

export function SetLocalPasswordModal({ isOpen, onClose, defaultEmail = '' }: SetLocalPasswordModalProps) {
  const [loginId, setLoginId] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { refreshUser } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 12) {
      setError('Password must be at least 12 characters');
      return;
    }

    setLoading(true);
    try {
      await axiosClient.post('/api/auth/set-password', {
        loginId,
        password,
      });
      await refreshUser();
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setPassword('');
        setConfirmPassword('');
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#0c1626]/95 border border-white/[0.1] rounded-3xl w-full max-w-md shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden relative backdrop-blur-2xl">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-white/[0.08] rounded-xl"
        >
          <X size={18} />
        </button>

        <div className="p-6 sm:p-7">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mb-4 text-primary border border-primary/25">
            <Key size={22} />
          </div>
          <h2 className="text-lg sm:text-xl font-bold font-display text-white mb-1.5">Set Local Password</h2>
          <p className="text-xs text-slate-400 font-mono mb-6">
            Create a password to log in with username/email directly without Google.
          </p>

          {success ? (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs text-center font-medium">
              Password set successfully!
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
                  {error}
                </div>
              )}

              <div className="group/input relative">
                <div className="absolute -top-2.5 left-3 bg-[#0c1626] px-1 text-[10px] uppercase font-mono font-semibold text-slate-400">
                  Email or Username
                </div>
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User size={15} className="text-slate-500 group-focus-within/input:text-primary transition-colors" />
                </div>
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="w-full bg-[#060b14] border border-white/[0.1] hover:border-white/[0.2] focus:border-primary text-white text-xs py-3 pl-10 pr-3 rounded-xl outline-none transition-all font-sans"
                  placeholder="Your username or email"
                  required
                />
              </div>

              <div className="group/input relative">
                <div className="absolute -top-2.5 left-3 bg-[#0c1626] px-1 text-[10px] uppercase font-mono font-semibold text-slate-400">
                  New Password
                </div>
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock size={15} className="text-slate-500 group-focus-within/input:text-primary transition-colors" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#060b14] border border-white/[0.1] hover:border-white/[0.2] focus:border-primary text-white text-xs py-3 pl-10 pr-3 rounded-xl outline-none transition-all font-sans"
                  required
                />
              </div>

              <div className="group/input relative">
                <div className="absolute -top-2.5 left-3 bg-[#0c1626] px-1 text-[10px] uppercase font-mono font-semibold text-slate-400">
                  Confirm Password
                </div>
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock size={15} className="text-slate-500 group-focus-within/input:text-primary transition-colors" />
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#060b14] border border-white/[0.1] hover:border-white/[0.2] focus:border-primary text-white text-xs py-3 pl-10 pr-3 rounded-xl outline-none transition-all font-sans"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:brightness-110 text-slate-950 font-bold py-3 rounded-xl shadow-[0_0_15px_rgba(0,245,255,0.3)] transition-all mt-4 disabled:opacity-50 text-xs active:scale-95"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Save Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
