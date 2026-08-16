import { useState } from 'react';
import { X, Loader2, Plus, Check } from 'lucide-react';
import type { Track } from '../hooks/useAudioPlayer';
import { axiosClient } from '../api/axiosClient';

interface AddTracksModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  playlistId: string;
  playlistTracks: Track[]; // to check which are already added
  onSuccess: () => void;
}

import { useGlobalAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';

export function AddTracksModal({ isOpen, onClose, playlistId, playlistTracks, onSuccess }: AddTracksModalProps) {
  const { playerState } = useGlobalAudio();
  const { tracks: allTracks, isLoading: loading } = useLibrary();
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const handleAddTrack = async (trackId: string) => {
    setAddingIds(prev => new Set(prev).add(trackId));
    try {
      const track = allTracks.find(t => t.id === trackId);
      const nameParam = track ? `?name=${encodeURIComponent(track.fileName || '')}` : '';
      await axiosClient.post(`/api/playlists/${playlistId}/tracks/${trackId}${nameParam}`);
      onSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setAddingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(trackId);
        return newSet;
      });
    }
  };

  const filteredTracks = allTracks.filter(t => 
    (t.title || t.fileName).toLowerCase().includes(searchQuery.toLowerCase()) || 
    (t.artist || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isTrackInPlaylist = (trackId: string) => {
    return playlistTracks.some(pt => pt.id === trackId);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        className="bg-[#0c1626]/95 border border-white/[0.1] rounded-3xl w-full max-w-lg shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col h-[min(70vh,calc(100dvh-2rem))] animate-in zoom-in-95 duration-200 backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-5 sm:p-6 border-b border-white/[0.06] shrink-0 bg-white/[0.02]">
          <h2 className="text-base sm:text-lg font-bold font-display text-white">Add Tracks to Playlist</h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-white/[0.08] p-1.5 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 border-b border-white/[0.06] shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your library..."
            className="w-full bg-[#060b14] border border-white/[0.1] rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-all font-sans"
          />
        </div>

        <div className="p-3 overflow-y-auto flex-1 no-scrollbar flex flex-col gap-1.5">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="text-primary animate-spin" />
            </div>
          ) : filteredTracks.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-mono">
              No tracks found.
            </div>
          ) : (
            filteredTracks.map(t => {
              const inPlaylist = isTrackInPlaylist(t.id);
              const isAdding = addingIds.has(t.id);
              return (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] hover:border-primary/25 transition-all group">
                  <div className="flex flex-col truncate pr-4 w-full">
                    <span className="text-xs sm:text-sm font-semibold text-slate-200 truncate group-hover:text-primary transition-colors">{t.title || playerState.getTrackMetadata(t.id)?.title || (t.fileName ? (t.fileName.includes(' - ') ? t.fileName.split(' - ')[1].replace(/\.[^/.]+$/, "") : t.fileName.replace(/\.[^/.]+$/, "")) : 'Unknown Title')}</span>
                    <span className="text-[11px] text-slate-400 font-mono truncate mt-0.5">{t.artist || playerState.getTrackMetadata(t.id)?.artist || (t.fileName?.includes(' - ') ? t.fileName.split(' - ')[0] : 'Unknown Artist')}</span>
                  </div>
                  <button
                    onClick={() => !inPlaylist && !isAdding && handleAddTrack(t.id)}
                    disabled={inPlaylist || isAdding}
                    className={`p-2 rounded-xl transition-all shrink-0 ${
                      inPlaylist 
                        ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                        : 'bg-white/[0.05] text-slate-400 hover:bg-primary hover:text-slate-950 active:scale-95'
                    }`}
                  >
                    {isAdding ? (
                      <Loader2 size={15} className="animate-spin text-primary" />
                    ) : inPlaylist ? (
                      <Check size={15} />
                    ) : (
                      <Plus size={15} />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
