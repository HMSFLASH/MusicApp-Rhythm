import { useState, useEffect } from 'react';
import { X, Loader2, ListPlus } from 'lucide-react';
import type { Track } from '../hooks/useAudioPlayer';
import { axiosClient } from '../api/axiosClient';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  jwtToken: string;
  track: Track | null;
}

import { useGlobalAudio } from '../context/AudioContext';

export function AddToPlaylistModal({ isOpen, onClose, track }: AddToPlaylistModalProps) {
  const { jwtToken, playerState } = useGlobalAudio();
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen && jwtToken) {
      setLoading(true);
      setError('');
      setSuccessMsg('');
      axiosClient.get('/api/playlists')
      .then((data: any) => setPlaylists(data))
      .catch(() => setError('Failed to load playlists'))
      .finally(() => setLoading(false));
    }
  }, [isOpen, jwtToken]);

  if (!isOpen || !track) return null;

  const handleAddToPlaylist = async (playlistId: number) => {
    setAddingId(playlistId);
    setError('');
    setSuccessMsg('');

    try {
      const nameParam = track ? `?name=${encodeURIComponent(track.fileName || '')}` : '';
      await axiosClient.post(`/api/playlists/${playlistId}/tracks/${track.id}${nameParam}`);

      setSuccessMsg('Added to playlist successfully!');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="bg-surface border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">Add to Playlist</h2>
            <p className="text-sm text-white/50 truncate max-w-[200px] mt-1">{track.title || playerState.getTrackMetadata(track.id)?.title || (track.fileName?.includes(' - ') ? track.fileName.split(' - ')[1].replace(/\.[^/.]+$/, "") : track.fileName.replace(/\.[^/.]+$/, ""))}</p>
          </div>
          <button 
            onClick={onClose}
            className="text-white/40 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors self-start"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 no-scrollbar flex flex-col gap-2">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-2">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm mb-2">
              {successMsg}
            </div>
          )}
          
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="text-primary animate-spin" />
            </div>
          ) : playlists.length === 0 ? (
            <div className="text-center py-8 text-white/50 text-sm">
              You don't have any playlists yet.
            </div>
          ) : (
            playlists.map(p => (
              <button
                key={p.id}
                onClick={() => handleAddToPlaylist(p.id)}
                disabled={addingId !== null}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex flex-col truncate pr-4">
                  <span className="text-sm font-bold text-white truncate">{p.name}</span>
                  <span className="text-xs text-white/40 mt-0.5">{p.trackCount} tracks</span>
                </div>
                {addingId === p.id ? (
                  <Loader2 size={16} className="text-primary animate-spin shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary group-hover:text-black text-white/40 transition-colors shrink-0">
                    <ListPlus size={14} />
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
