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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="bg-surface border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col h-[min(70vh,calc(100dvh-2rem))] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-4 sm:p-6 border-b border-white/5 shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-white">Add Tracks to Playlist</h2>
          <button 
            onClick={onClose}
            className="text-white/40 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-white/5 shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your library..."
            className="w-full bg-background border border-white/10 rounded-lg p-3 text-white placeholder-white/30 focus:outline-none focus:border-primary transition-all text-sm"
          />
        </div>

        <div className="p-2 overflow-y-auto flex-1 no-scrollbar flex flex-col gap-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="text-primary animate-spin" />
            </div>
          ) : filteredTracks.length === 0 ? (
            <div className="text-center py-8 text-white/50 text-sm">
              No tracks found.
            </div>
          ) : (
            filteredTracks.map(t => {
              const inPlaylist = isTrackInPlaylist(t.id);
              const isAdding = addingIds.has(t.id);
              return (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/5 transition-all group">
                  <div className="flex flex-col truncate pr-4 w-full">
                    <span className="text-sm font-medium text-white truncate">{t.title || playerState.getTrackMetadata(t.id)?.title || (t.fileName ? (t.fileName.includes(' - ') ? t.fileName.split(' - ')[1].replace(/\.[^/.]+$/, "") : t.fileName.replace(/\.[^/.]+$/, "")) : 'Unknown Title')}</span>
                    <span className="text-xs text-white/40 truncate mt-0.5">{t.artist || playerState.getTrackMetadata(t.id)?.artist || (t.fileName?.includes(' - ') ? t.fileName.split(' - ')[0] : 'Unknown Artist')}</span>
                  </div>
                  <button
                    onClick={() => !inPlaylist && !isAdding && handleAddTrack(t.id)}
                    disabled={inPlaylist || isAdding}
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      inPlaylist 
                        ? 'bg-green-500/20 text-green-400 cursor-default' 
                        : isAdding 
                          ? 'bg-white/5 text-white/50 cursor-not-allowed'
                          : 'bg-white/5 text-white/60 hover:bg-primary hover:text-black'
                    }`}
                    title={inPlaylist ? "Already in playlist" : "Add track"}
                  >
                    {isAdding ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : inPlaylist ? (
                      <Check size={14} />
                    ) : (
                      <Plus size={14} />
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
