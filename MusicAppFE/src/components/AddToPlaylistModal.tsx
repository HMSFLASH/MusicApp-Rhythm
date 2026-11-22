import { useState, useEffect } from 'react';
import { X, Loader2, ListPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Track } from '../hooks/useAudioPlayer';
import { axiosClient } from '../api/axiosClient';
import { useGlobalAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errorMessage';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated?: boolean;
  track: Track | null;
  tracks?: Track[];
}

type PlaylistSummary = {
  id: string;
  name: string;
  trackCount?: number;
};

export function AddToPlaylistModal({ isOpen, onClose, track, tracks }: AddToPlaylistModalProps) {
  const items = tracks && tracks.length > 0 ? tracks : (track ? [track] : []);
  if (!isOpen || items.length === 0) return null;

  return <AddToPlaylistModalContent items={items} onClose={onClose} />;
}

function AddToPlaylistModalContent({
  items,
  onClose,
}: {
  items: Track[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { playerState } = useGlobalAudio();

  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [loading, setLoading] = useState(Boolean(isAuthenticated));
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    axiosClient.get('/api/playlists')
      .then((data: unknown) => {
        if (!cancelled) {
          setPlaylists(Array.isArray(data) ? (data as PlaylistSummary[]) : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('modals.addToPlaylist.loadFail', 'Failed to load playlists'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, t]);

  const handleAddToPlaylist = async (playlistId: string) => {
    setAddingId(playlistId);
    setError('');
    setSuccessMsg('');

    try {
      if (items.length === 1) {
        const item = items[0];
        const nameParam = item ? `?name=${encodeURIComponent(item.fileName || '')}` : '';
        await axiosClient.post(`/api/playlists/${playlistId}/tracks/${item.id}${nameParam}`);
      } else {
        await Promise.all(items.map(item => {
          const nameParam = item ? `?name=${encodeURIComponent(item.fileName || '')}` : '';
          return axiosClient.post(`/api/playlists/${playlistId}/tracks/${item.id}${nameParam}`);
        }));
      }

      setSuccessMsg(t('modals.addToPlaylist.success', 'Added to playlist successfully!'));
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err: unknown) {
      setError(getErrorMessage(err, t('common.systemError', 'An error occurred')));
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        className="bg-[#0c1626]/95 border border-white/[0.1] rounded-3xl w-full max-w-sm shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[calc(100dvh-2rem)] backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-white/[0.06] shrink-0 bg-white/[0.02]">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold font-display text-white">{t('modals.addToPlaylist.title', 'Add to Playlist')}</h2>
            <p className="text-xs text-slate-400 font-mono truncate mt-0.5">
              {items.length === 1
                ? (items[0].title || playerState.getTrackMetadata(items[0].id)?.title || (items[0].fileName ? (items[0].fileName.includes(' - ') ? items[0].fileName.split(' - ')[1].replace(/\.[^/.]+$/, "") : items[0].fileName.replace(/\.[^/.]+$/, "")) : t('common.unknownTitle', 'Unknown Title')))
                : t('modals.addToPlaylist.selectedTracks', '{{count}} tracks selected', { count: items.length })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-white/[0.08] p-1.5 rounded-xl transition-colors self-start"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 no-scrollbar flex flex-col gap-2">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs mb-1">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs mb-1">
              {successMsg}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="text-primary animate-spin" />
            </div>
          ) : playlists.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-mono">
              {t('modals.addToPlaylist.noPlaylists', "You don't have any playlists yet.")}
            </div>
          ) : (
            playlists.map(p => (
              <button
                key={p.id}
                onClick={() => handleAddToPlaylist(p.id)}
                disabled={addingId !== null}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] hover:border-primary/30 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <div className="flex min-w-0 flex-col truncate pr-4">
                  <span className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-primary transition-colors truncate">{p.name}</span>
                  <span className="text-[11px] text-slate-400 font-mono mt-0.5">{t('playlist.trackCount', '{{count}} tracks', { count: p.trackCount })}</span>
                </div>
                {addingId === p.id ? (
                  <Loader2 size={16} className="text-primary animate-spin shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center group-hover:bg-primary group-hover:text-slate-950 text-slate-400 transition-all shrink-0">
                    <ListPlus size={15} />
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
