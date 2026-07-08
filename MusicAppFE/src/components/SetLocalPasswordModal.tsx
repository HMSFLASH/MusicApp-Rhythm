import { useState } from 'react';
import { X, Key, User, Lock, Loader2 } from 'lucide-react';
import { axiosClient } from '../api/axiosClient';
import { useGlobalAudio } from '../context/AudioContext'
import { useAuth } from '../context/AuthContext';;

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
  
  const { setJwtToken } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response: any = await axiosClient.post('/api/auth/set-password', {
        password
      });
      // Update global token if the backend returned a new one
      if (response && response.accessToken) {
        setJwtToken(response.accessToken);
      }
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setPassword('');
        setConfirmPassword('');
      }, 2000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#050914] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="p-6">
          <div className="w-12 h-12 rounded-xl bg-[#00E5FF]/10 flex items-center justify-center mb-4 text-[#00E5FF]">
            <Key size={24} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Set Local Password</h2>
          <p className="text-sm text-white/50 mb-6">
            Create a password to log in without Google next time.
          </p>

          {success ? (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm text-center font-medium">
              Password set successfully!
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="group/input relative">
                <div className="absolute -top-2.5 left-3 bg-[#050914] px-1 text-xs text-white/70">
                  Email or Username
                </div>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={16} className="text-white/50 group-focus-within/input:text-[#00E5FF] transition-colors" />
                </div>
                <input 
                  type="text" 
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 hover:border-white/30 focus:border-[#00E5FF] text-white text-sm py-3.5 pl-10 pr-2 rounded-lg outline-none transition-all"
                  placeholder="Your username or email"
                  required
                />
              </div>

              <div className="group/input relative">
                <div className="absolute -top-2.5 left-3 bg-[#050914] px-1 text-xs text-white/70">
                  New Password
                </div>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={16} className="text-white/50 group-focus-within/input:text-[#00E5FF] transition-colors" />
                </div>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 hover:border-white/30 focus:border-[#00E5FF] text-white text-sm py-3.5 pl-10 pr-2 rounded-lg outline-none transition-all"
                  required
                />
              </div>

              <div className="group/input relative">
                <div className="absolute -top-2.5 left-3 bg-[#050914] px-1 text-xs text-white/70">
                  Confirm Password
                </div>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={16} className="text-white/50 group-focus-within/input:text-[#00E5FF] transition-colors" />
                </div>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 hover:border-white/30 focus:border-[#00E5FF] text-white text-sm py-3.5 pl-10 pr-2 rounded-lg outline-none transition-all"
                  required
                />
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-black font-bold py-3.5 rounded-xl shadow-[0_0_20px_rgba(0,229,255,0.3)] transition-all mt-4 disabled:opacity-50"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : 'Save Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
