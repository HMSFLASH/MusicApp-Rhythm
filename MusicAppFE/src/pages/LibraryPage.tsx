import { Heart, ListMusic, Album, Mic2, Music, Disc, CloudUpload, RefreshCw, Play, TrendingUp, ListPlus, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useGlobalAudio } from '../context/AudioContext';
import { useUploadQueue } from '../context/UploadContext';

import { useLibrary } from '../context/LibraryContext';
import { ActionMenu } from '../components/ActionMenu';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import type { Track } from '../hooks/useAudioPlayer';
import { downloadTrackFile } from '../utils/downloadUtils';

export function LibraryPage() {
  const navigate = useNavigate();
  const { playerState } = useGlobalAudio();
  const { queueDirectFiles, uploadTasks } = useUploadQueue();
  const { tracks, favorites, toggleFavorite, syncLibrary, isLoading } = useLibrary();
  const [trackToPlaylist, setTrackToPlaylist] = useState<Track | null>(null);

  const getUploadSelection = (files: File[]) => {
    const pendingFiles: File[] = [];
    const skippedFiles: File[] = [];

    for (const f of files) {
      const isDuplicate =
        tracks.some(t => t.fileName === f.name) ||
        uploadTasks.some(t => t.file.name === f.name && t.status !== 'error') ||
        pendingFiles.some(p => p.name === f.name);

      if (isDuplicate) {
        skippedFiles.push(f);
      } else {
        pendingFiles.push(f);
      }
    }

    return { pendingFiles, skippedFiles };
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    const { pendingFiles, skippedFiles } = getUploadSelection(files);

    queueDirectFiles(pendingFiles, skippedFiles);
    e.target.value = ''; // clear input
  };

  useEffect(() => {
    const handleUploadSuccess = () => {
      syncLibrary();
    };
    globalThis.addEventListener('music-uploaded', handleUploadSuccess);
    return () => globalThis.removeEventListener('music-uploaded', handleUploadSuccess);
  }, [syncLibrary]);

  const albumsCount = useMemo(() => new Set(tracks.map(t => t.album).filter(Boolean)).size, [tracks]);
  const genresCount = useMemo(() => new Set(tracks.map(t => t.genre).filter(Boolean)).size, [tracks]);
  const artistsCount = useMemo(() => {
    return new Set(tracks.map(t => t.artist || playerState.getTrackMetadata(t.id)?.artist || (t.fileName?.includes(' - ') ? t.fileName.split(' - ')[0] : null)).filter(Boolean)).size;

  }, [tracks]);

  return (
    <div className="w-full h-full flex flex-col max-w-6xl 2xl:max-w-none mx-auto pb-28 md:pb-32 overflow-y-auto no-scrollbar">
      {/* Header & Quick Actions */}
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/[0.06] pb-6">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold font-display text-white tracking-tight flex items-center gap-2.5">
            Your Library
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1 font-mono">
            {tracks.length} songs • {albumsCount} albums • {artistsCount} artists
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
          <input
            type="file"
            accept="audio/*"
            id="drive-upload"
            className="hidden"
            multiple
            onChange={handleUpload}
          />
          <label
            htmlFor="drive-upload"
            className="flex min-w-0 flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary cursor-pointer transition-all shadow-[0_0_15px_rgba(0,245,255,0.15)] hover:shadow-[0_0_20px_rgba(0,245,255,0.3)] hover:scale-[1.02] active:scale-95"
            title="Upload through backend metadata scan"
          >
            <CloudUpload size={16} />
            <span className="truncate text-xs font-bold">Upload to Drive</span>
          </label>
          <ActionMenu
            ariaLabel="More library actions"
            buttonClassName="h-10 w-10 rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white flex items-center justify-center transition-all"
            actions={[
              {
                label: isLoading ? 'Reloading' : 'Reload Library',
                icon: <RefreshCw size={14} className={isLoading ? 'animate-spin text-primary' : ''} />,
                disabled: isLoading,
                onSelect: () => syncLibrary(),
              }
            ]}
          />
        </div>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3.5 md:gap-4.5 mt-1">
        <div
          className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20 hover:border-primary/50 rounded-2xl p-5 hover:shadow-[0_8px_30px_rgba(0,245,255,0.15)] transition-all duration-300 cursor-pointer group relative overflow-hidden flex flex-col justify-between min-h-[140px] backdrop-blur-md hover:-translate-y-1"
          onClick={() => navigate('/tracks?tab=all')}
        >
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity text-primary">
            <Disc size={110} />
          </div>
          <div className="w-11 h-11 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary group-hover:scale-110 transition-transform relative z-10 mb-3 shadow-[0_0_15px_rgba(0,245,255,0.2)]">
            <Disc size={22} />
          </div>
          <div className="relative z-10">
            <h2 className="text-base font-bold text-white mb-0.5 group-hover:text-primary transition-colors">All Songs</h2>
            <p className="text-slate-400 text-xs font-mono">{tracks.length} tracks</p>
          </div>
        </div>

        <div
          className="bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-transparent border border-rose-500/20 hover:border-rose-500/50 rounded-2xl p-5 hover:shadow-[0_8px_30px_rgba(244,63,94,0.15)] transition-all duration-300 cursor-pointer group relative overflow-hidden flex flex-col justify-between min-h-[140px] backdrop-blur-md hover:-translate-y-1"
          onClick={() => navigate('/tracks?tab=favorites')}
        >
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity text-rose-400">
            <Heart size={110} />
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform relative z-10 mb-3 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
            <Heart size={22} fill="currentColor" />
          </div>
          <div className="relative z-10">
            <h2 className="text-base font-bold text-white mb-0.5 group-hover:text-rose-400 transition-colors">Favorites</h2>
            <p className="text-slate-400 text-xs font-mono">{favorites.length} tracks</p>
          </div>
        </div>

        <div
          className="bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-500/20 hover:border-emerald-500/50 rounded-2xl p-5 hover:shadow-[0_8px_30px_rgba(16,185,129,0.15)] transition-all duration-300 cursor-pointer group relative overflow-hidden flex flex-col justify-between min-h-[140px] backdrop-blur-md hover:-translate-y-1"
          onClick={() => navigate('/playlist')}
        >
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity text-emerald-400">
            <ListMusic size={110} />
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform relative z-10 mb-3 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <ListMusic size={22} />
          </div>
          <div className="relative z-10">
            <h2 className="text-base font-bold text-white mb-0.5 group-hover:text-emerald-400 transition-colors">Playlists</h2>
            <p className="text-slate-400 text-xs font-mono">Custom collections</p>
          </div>
        </div>

        <div
          className="bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/20 hover:border-amber-500/50 rounded-2xl p-5 hover:shadow-[0_8px_30px_rgba(245,158,11,0.15)] transition-all duration-300 cursor-pointer group relative overflow-hidden flex flex-col justify-between min-h-[140px] backdrop-blur-md hover:-translate-y-1"
          onClick={() => navigate('/albums')}
        >
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity text-amber-400">
            <Album size={110} />
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform relative z-10 mb-3 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <Album size={22} />
          </div>
          <div className="relative z-10">
            <h2 className="text-base font-bold text-white mb-0.5 group-hover:text-amber-400 transition-colors">Albums</h2>
            <p className="text-slate-400 text-xs font-mono">{albumsCount} albums</p>
          </div>
        </div>

        <div
          className="bg-gradient-to-br from-indigo-500/15 via-indigo-500/5 to-transparent border border-indigo-500/20 hover:border-indigo-500/50 rounded-2xl p-5 hover:shadow-[0_8px_30px_rgba(99,102,241,0.15)] transition-all duration-300 cursor-pointer group relative overflow-hidden flex flex-col justify-between min-h-[140px] backdrop-blur-md hover:-translate-y-1"
          onClick={() => navigate('/artists')}
        >
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity text-indigo-400">
            <Mic2 size={110} />
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform relative z-10 mb-3 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <Mic2 size={22} />
          </div>
          <div className="relative z-10">
            <h2 className="text-base font-bold text-white mb-0.5 group-hover:text-indigo-400 transition-colors">Artists</h2>
            <p className="text-slate-400 text-xs font-mono">{artistsCount} artists</p>
          </div>
        </div>

        <div
          className="bg-gradient-to-br from-purple-500/15 via-purple-500/5 to-transparent border border-purple-500/20 hover:border-purple-500/50 rounded-2xl p-5 hover:shadow-[0_8px_30px_rgba(168,85,247,0.15)] transition-all duration-300 cursor-pointer group relative overflow-hidden flex flex-col justify-between min-h-[140px] backdrop-blur-md hover:-translate-y-1"
          onClick={() => navigate('/genres')}
        >
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity text-purple-400">
            <Music size={110} />
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform relative z-10 mb-3 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
            <Music size={22} />
          </div>
          <div className="relative z-10">
            <h2 className="text-base font-bold text-white mb-0.5 group-hover:text-purple-400 transition-colors">Genres</h2>
            <p className="text-slate-400 text-xs font-mono">{genresCount} genres</p>
          </div>
        </div>
      </div>

      {/* Most Played Section */}
      {tracks.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg md:text-xl font-bold font-display text-white flex items-center gap-2.5">
              <TrendingUp size={20} className="text-primary" />
              Most Played Tracks
            </h2>
            <button
              onClick={() => navigate('/tracks')}
              className="text-xs text-primary hover:underline font-mono"
            >
              View all →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 4k:grid-cols-6 gap-3">
            {[...tracks].sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0)).slice(0, 12).map((track) => (
              <div
                key={track.id}
                onClick={() => playerState.playTrack(track, tracks)}
                className="flex items-center gap-3.5 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] hover:border-primary/30 transition-all group cursor-pointer backdrop-blur-md"
              >
                <div className="relative w-11 h-11 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden border border-white/10 group-hover:shadow-[0_0_15px_rgba(0,245,255,0.2)] transition-all">
                  {track.imageUrl || playerState.getTrackImage(track.id) ? (
                    <img src={track.imageUrl || playerState.getTrackImage(track.id)} alt="Cover" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                  ) : (
                    <ListMusic size={18} className="text-slate-500" />
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play size={16} fill="currentColor" className="text-primary ml-0.5 drop-shadow" />
                  </div>
                </div>
                <div className="flex flex-col truncate flex-1 pr-1">
                  <span className="text-xs font-semibold text-slate-100 truncate group-hover:text-primary transition-colors">
                    {track.title || playerState.getTrackMetadata(track.id)?.title || (track.fileName ? track.fileName.replace(/\.[^/.]+$/, "") : 'Unknown')}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[10px] text-slate-400">
                    <span className="truncate max-w-[100px]">
                      {track.artist || playerState.getTrackMetadata(track.id)?.artist || 'Unknown Artist'}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-primary/90 shrink-0 font-medium">{track.playCount ?? 0} plays</span>
                  </div>
                </div>
                <ActionMenu
                  ariaLabel={`Song actions for ${track.title || track.fileName}`}
                  buttonClassName="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0"
                  actions={[
                    { label: 'Play Next', icon: <ListMusic size={14} />, onSelect: () => playerState.addToNextQueue([track]) },
                    { label: 'Add to Queue', icon: <ListPlus size={14} />, onSelect: () => playerState.addToCurrentQueue([track]) },
                    { label: 'Add to Playlist', icon: <ListPlus size={14} />, onSelect: () => setTrackToPlaylist(track) },
                    ...(track.sourceType !== 'LOCAL'
                      ? [{
                        label: 'Download File',
                        icon: <Download size={14} />,
                        onSelect: () => downloadTrackFile(track)
                      }, {
                        label: favorites.some(f => f.id === track.id) ? 'Remove Favorite' : 'Add to Favorite',
                        icon: <Heart size={14} fill={favorites.some(f => f.id === track.id) ? "currentColor" : "none"} className={favorites.some(f => f.id === track.id) ? "text-primary" : ""} />,
                        onSelect: () => void toggleFavorite(track)
                      }]
                      : [])
                  ]}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <AddToPlaylistModal
        isOpen={!!trackToPlaylist}
        onClose={() => setTrackToPlaylist(null)}
        track={trackToPlaylist}
      />
    </div>
  );
}
