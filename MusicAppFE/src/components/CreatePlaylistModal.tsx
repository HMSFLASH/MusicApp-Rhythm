import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { axiosClient } from '../api/axiosClient';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreatePlaylistModal({ isOpen, onClose, onSuccess }: CreatePlaylistModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Playlist name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await axiosClient.post('/api/playlists', {
        name: name.trim()
      });

      setName('');
      onSuccess();
      onClose();

    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        className="bg-[#0c1626]/95 border border-white/[0.1] rounded-3xl w-full max-w-md max-h-[calc(100dvh-2rem)] shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden animate-in zoom-in-95 duration-200 backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-5 sm:p-6 border-b border-white/[0.06] bg-white/[0.02]">
          <h2 className="text-lg sm:text-xl font-bold font-display text-white">Create New Playlist</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-white/[0.08] p-1.5 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 flex flex-col gap-5 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">
              Playlist Name <span className="text-rose-400">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cyberpunk Vibes, Acoustic Hits"
              className="w-full bg-[#060b14] border border-white/[0.1] rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-sans"
              autoFocus
              maxLength={100}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors text-xs font-semibold"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-6 py-2.5 rounded-xl bg-primary text-slate-950 font-bold hover:brightness-110 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 text-xs shadow-[0_0_15px_rgba(0,245,255,0.3)]"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              Create Playlist
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
