import { Heart, ListMusic, Album, Mic2, Music, Disc, CloudUpload, RefreshCw, Play, TrendingUp, Cloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { useGlobalAudio } from '../context/AudioContext';
import { useUploadQueue } from '../context/UploadContext';

import { useLibrary } from '../context/LibraryContext';

export function LibraryPage() {
  const navigate = useNavigate();
  const { playerState } = useGlobalAudio();
  const { queueFiles, queueDirectFiles, uploadTasks } = useUploadQueue();
  const { tracks, favorites, syncLibrary, isLoading } = useLibrary();

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

    queueFiles(pendingFiles, skippedFiles);
    e.target.value = ''; // clear input
  };

  const handleDirectUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    const { pendingFiles, skippedFiles } = getUploadSelection(files);

    queueDirectFiles(pendingFiles, skippedFiles);
    e.target.value = '';
  };

  useEffect(() => {
    const handleUploadSuccess = () => {
      syncLibrary();
    };
    window.addEventListener('music-uploaded', handleUploadSuccess);
    return () => window.removeEventListener('music-uploaded', handleUploadSuccess);
  }, [syncLibrary]);

  const albumsCount = useMemo(() => new Set(tracks.map(t => t.album).filter(Boolean)).size, [tracks]);
  const genresCount = useMemo(() => new Set(tracks.map(t => t.genre).filter(Boolean)).size, [tracks]);
  const artistsCount = useMemo(() => {
    return new Set(tracks.map(t => t.artist || playerState.getTrackMetadata(t.id)?.artist || (t.fileName?.includes(' - ') ? t.fileName.split(' - ')[0] : null)).filter(Boolean)).size;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks]);

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-8 max-w-6xl mx-auto pb-32 overflow-y-auto">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-0">
        <div>
          <h1 className="text-3xl font-bold font-sans text-white tracking-tight">Your Library</h1>
          <p className="text-white/80 text-sm mt-1">{tracks.length} songs across all your collections.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => syncLibrary()}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50 text-white/80 hover:text-white"
            title="Reload library"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin text-primary' : ''} />
            <span className="text-sm font-medium hidden md:inline">Reload</span>
          </button>
          <input
            type="file"
            accept="audio/*"
            id="drive-upload"
            className="hidden"
            multiple
            onChange={handleUpload}
          />
          <input
            type="file"
            accept="audio/*"
            id="drive-direct-upload"
            className="hidden"
            multiple
            onChange={handleDirectUpload}
          />
          <label
            htmlFor="drive-upload"
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
            title="Upload through backend metadata scan"
          >
            <CloudUpload size={16} className="text-blue-400" />
            <span className="text-sm font-medium">Upload to Drive</span>
          </label>
          <label
            htmlFor="drive-direct-upload"
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-400/20 hover:border-emerald-400/40 bg-emerald-400/10 hover:bg-emerald-400/15 cursor-pointer transition-colors"
            title="Upload directly to Drive and skip backend metadata/lyrics parsing"
          >
            <Cloud size={16} className="text-emerald-300" />
            <span className="text-sm font-medium text-emerald-50">Direct to Drive</span>
          </label>

        </div>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-4">
        <div
          className="bg-gradient-to-br from-[#00E5FF]/20 to-[#00E5FF]/5 border border-[#00E5FF]/20 rounded-2xl p-6 hover:border-[#00E5FF]/50 hover:shadow-[0_0_30px_-10px_rgba(0,229,255,0.3)] transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between min-h-[160px]"
          onClick={() => navigate('/tracks?tab=all')}
        >
          <div className="absolute -right-4 -bottom-4 p-0 opacity-10 group-hover:opacity-20 transition-opacity text-[#00E5FF]">
            <Disc size={120} />
          </div>
          <div className="w-14 h-14 rounded-full bg-[#00E5FF]/10 flex items-center justify-center text-[#00E5FF] group-hover:scale-110 transition-transform relative z-10 mb-4">
            <Disc size={28} />
          </div>
          <div className="relative z-10">
            <h2 className="text-xl font-bold text-white mb-1">All Songs</h2>
            <p className="text-white/70 text-sm font-medium">{tracks.length} songs</p>
          </div>
        </div>

        <div
          className="bg-gradient-to-br from-[#4f46e5]/30 to-[#7c3aed]/20 border border-[#7c3aed]/20 rounded-2xl p-6 hover:border-[#7c3aed]/50 hover:shadow-[0_0_30px_-10px_rgba(124,58,237,0.3)] transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between min-h-[160px]"
          onClick={() => navigate('/tracks?tab=favorites')}
        >
          <div className="absolute -right-4 -bottom-4 p-0 opacity-10 group-hover:opacity-20 transition-opacity text-[#7c3aed]">
            <Heart size={120} />
          </div>
          <div className="w-14 h-14 rounded-full bg-[#7c3aed]/20 flex items-center justify-center text-[#a78bfa] group-hover:scale-110 transition-transform relative z-10 mb-4">
            <Heart size={28} fill="currentColor" />
          </div>
          <div className="relative z-10">
            <h2 className="text-xl font-bold text-white mb-1">Favorites</h2>
            <p className="text-white/70 text-sm font-medium">{favorites.length} songs</p>
          </div>
        </div>

        <div
          className="bg-gradient-to-br from-[#10b981]/20 to-[#10b981]/5 border border-[#10b981]/20 rounded-2xl p-6 hover:border-[#10b981]/50 hover:shadow-[0_0_30px_-10px_rgba(16,185,129,0.3)] transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between min-h-[160px]"
          onClick={() => navigate('/playlist')}
        >
          <div className="absolute -right-4 -bottom-4 p-0 opacity-10 group-hover:opacity-20 transition-opacity text-[#10b981]">
            <ListMusic size={120} />
          </div>
          <div className="w-14 h-14 rounded-full bg-[#10b981]/10 flex items-center justify-center text-[#10b981] group-hover:scale-110 transition-transform relative z-10 mb-4">
            <ListMusic size={28} />
          </div>
          <div className="relative z-10">
            <h2 className="text-xl font-bold text-white mb-1">Playlists</h2>
            <p className="text-white/70 text-sm font-medium">Manage queues</p>
          </div>
        </div>

        <div
          className="bg-gradient-to-br from-[#f59e0b]/15 to-[#d97706]/10 border border-[#f59e0b]/20 rounded-2xl p-6 hover:border-[#f59e0b]/50 hover:shadow-[0_0_30px_-10px_rgba(245,158,11,0.3)] transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between min-h-[160px]"
          onClick={() => navigate('/albums')}
        >
          <div className="absolute -right-4 -bottom-4 p-0 opacity-10 group-hover:opacity-20 transition-opacity text-[#f59e0b]">
            <Album size={120} />
          </div>
          <div className="w-14 h-14 rounded-full bg-[#f59e0b]/10 flex items-center justify-center text-[#f59e0b] group-hover:scale-110 transition-transform relative z-10 mb-4">
            <Album size={28} />
          </div>
          <div className="relative z-10">
            <h2 className="text-xl font-bold text-white mb-1">Albums</h2>
            <p className="text-white/70 text-sm font-medium">{albumsCount} albums</p>
          </div>
        </div>

        <div
          className="bg-gradient-to-br from-[#10b981]/15 to-[#059669]/10 border border-[#10b981]/20 rounded-2xl p-6 hover:border-[#10b981]/50 hover:shadow-[0_0_30px_-10px_rgba(16,185,129,0.3)] transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between min-h-[160px]"
          onClick={() => navigate('/artists')}
        >
          <div className="absolute -right-4 -bottom-4 p-0 opacity-10 group-hover:opacity-20 transition-opacity text-[#10b981]">
            <Mic2 size={120} />
          </div>
          <div className="w-14 h-14 rounded-full bg-[#10b981]/10 flex items-center justify-center text-[#10b981] group-hover:scale-110 transition-transform relative z-10 mb-4">
            <Mic2 size={28} />
          </div>
          <div className="relative z-10">
            <h2 className="text-xl font-bold text-white mb-1">Artists</h2>
            <p className="text-white/70 text-sm font-medium">{artistsCount} artists</p>
          </div>
        </div>

        <div
          className="bg-gradient-to-br from-[#ec4899]/15 to-[#db2777]/10 border border-[#ec4899]/20 rounded-2xl p-6 hover:border-[#ec4899]/50 hover:shadow-[0_0_30px_-10px_rgba(236,72,153,0.3)] transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between min-h-[160px]"
          onClick={() => navigate('/genres')}
        >
          <div className="absolute -right-4 -bottom-4 p-0 opacity-10 group-hover:opacity-20 transition-opacity text-[#ec4899]">
            <Music size={120} />
          </div>
          <div className="w-14 h-14 rounded-full bg-[#ec4899]/10 flex items-center justify-center text-[#ec4899] group-hover:scale-110 transition-transform relative z-10 mb-4">
            <Music size={28} />
          </div>
          <div className="relative z-10">
            <h2 className="text-xl font-bold text-white mb-1">Genres</h2>
            <p className="text-white/70 text-sm font-medium">{genresCount} genres</p>
          </div>
        </div>
      </div>

      {/* Most Played Section */}
      {tracks.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-bold font-sans text-white mb-6 flex items-center gap-3">
            <TrendingUp size={24} className="text-primary" />
            Most Played
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...tracks].sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0)).slice(0, 12).map((track) => (
              <div
                key={track.id}
                onClick={() => playerState.playTrack(track, tracks)}
                className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10 transition-colors group cursor-pointer"
              >
                <div className="relative w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center shrink-0 overflow-hidden border border-white/10 group-hover:shadow-lg transition-all">
                  {track.imageUrl || playerState.getTrackImage(track.id) ? (
                    <img src={track.imageUrl || playerState.getTrackImage(track.id)} alt="Cover" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <ListMusic size={20} className="text-white/40" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play size={20} fill="currentColor" className="text-white ml-1" />
                  </div>
                </div>
                <div className="flex flex-col truncate flex-1">
                  <span className="text-sm font-semibold text-white truncate group-hover:text-primary transition-colors">
                    {track.title || playerState.getTrackMetadata(track.id)?.title || (track.fileName ? track.fileName.replace(/\.[^/.]+$/, "") : 'Unknown')}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <Cloud size={12} className="text-blue-400" />
                    <span className="text-xs text-white/40 truncate max-w-[120px]">
                      {track.artist || playerState.getTrackMetadata(track.id)?.artist || 'Unknown Artist'}
                    </span>
                    <span className="text-xs text-white/20">|</span>
                    <span className="text-xs text-white/30 shrink-0">{track.playCount ?? 0} listens</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
