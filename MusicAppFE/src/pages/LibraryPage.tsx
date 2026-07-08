import { Heart, ListMusic, Album, Mic2, Music, Disc, CloudUpload, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { useGlobalAudio } from '../context/AudioContext'
import { useUploadQueue } from '../context/UploadContext';

import { useLibrary } from '../context/LibraryContext';

export function LibraryPage() {
  const navigate = useNavigate();
  const { playerState } = useGlobalAudio();
  const { queueFiles } = useUploadQueue();
  const { tracks, favorites, refreshLibrary, isLoading } = useLibrary();

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);

    const pendingFiles: File[] = [];
    const skippedFiles: File[] = [];

    for (const f of files) {
      if (tracks.some(t => t.fileName === f.name)) {
        skippedFiles.push(f);
      } else {
        pendingFiles.push(f);
      }
    }

    queueFiles(pendingFiles, skippedFiles);
    e.target.value = ''; // clear input
  };

  useEffect(() => {
    const handleUploadSuccess = () => {
      refreshLibrary();
    };
    window.addEventListener('music-uploaded', handleUploadSuccess);
    return () => window.removeEventListener('music-uploaded', handleUploadSuccess);
  }, [refreshLibrary]);

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
            onClick={() => refreshLibrary()}
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
          <label
            htmlFor="drive-upload"
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
          >
            <CloudUpload size={16} className="text-blue-400" />
            <span className="text-sm font-medium">Upload to Drive</span>
          </label>

        </div>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-2">
        <div
          className="bg-gradient-to-br from-[#00E5FF]/20 to-[#00E5FF]/5 border border-[#00E5FF]/20 rounded-2xl p-5 hover:border-[#00E5FF]/50 transition-all cursor-pointer group relative overflow-hidden"
          onClick={() => navigate('/tracks?tab=all')}
        >
          <div className="absolute top-0 right-0 p-5 opacity-10 group-hover:opacity-20 transition-opacity text-[#00E5FF]">
            <Disc size={64} />
          </div>
          <div className="w-10 h-10 rounded-full bg-[#00E5FF]/10 flex items-center justify-center mb-4 text-[#00E5FF] group-hover:scale-110 transition-transform">
            <Disc size={20} />
          </div>
          <h2 className="text-base font-bold text-white mb-1">All Songs</h2>
          <p className="text-white/80 text-xs font-medium">{tracks.length} songs</p>
        </div>

        <div
          className="bg-gradient-to-br from-[#4f46e5]/30 to-[#7c3aed]/20 border border-white/5 rounded-2xl p-5 hover:border-[#7c3aed]/50 transition-all cursor-pointer group relative overflow-hidden"
          onClick={() => navigate('/tracks?tab=favorites')}
        >
          <div className="absolute top-0 right-0 p-5 opacity-10 group-hover:opacity-20 transition-opacity">
            <Heart size={64} />
          </div>
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mb-4 text-white group-hover:scale-110 transition-transform">
            <Heart size={20} fill="currentColor" />
          </div>
          <h2 className="text-base font-bold text-white mb-1">Favorites</h2>
          <p className="text-white/80 text-xs font-medium">{favorites.length} songs</p>
        </div>

        <div
          className="bg-gradient-to-br from-[#10b981]/20 to-[#10b981]/5 border border-[#10b981]/20 rounded-2xl p-5 hover:border-[#10b981]/50 transition-all cursor-pointer group relative overflow-hidden"
          onClick={() => navigate('/playlist')}
        >
          <div className="absolute top-0 right-0 p-5 opacity-10 group-hover:opacity-20 transition-opacity text-[#10b981]">
            <ListMusic size={64} />
          </div>
          <div className="w-10 h-10 rounded-full bg-[#10b981]/10 flex items-center justify-center mb-4 text-[#10b981] group-hover:scale-110 transition-transform">
            <ListMusic size={20} />
          </div>
          <h2 className="text-base font-bold text-white mb-1">Playlists</h2>
          <p className="text-white/80 text-xs font-medium">Manage queues</p>
        </div>

        <div
          className="bg-gradient-to-br from-[#f59e0b]/15 to-[#d97706]/10 border border-[#f59e0b]/20 rounded-2xl p-5 hover:border-[#f59e0b]/50 transition-all cursor-pointer group relative overflow-hidden"
          onClick={() => navigate('/albums')}
        >
          <div className="absolute top-0 right-0 p-5 opacity-10 group-hover:opacity-20 transition-opacity text-[#f59e0b]">
            <Album size={64} />
          </div>
          <div className="w-10 h-10 rounded-full bg-[#f59e0b]/10 flex items-center justify-center mb-4 text-[#f59e0b] group-hover:scale-110 transition-transform">
            <Album size={20} />
          </div>
          <h2 className="text-base font-bold text-white mb-1">Albums</h2>
          <p className="text-white/80 text-xs font-medium">{albumsCount} albums</p>
        </div>

        <div
          className="bg-gradient-to-br from-[#10b981]/15 to-[#059669]/10 border border-[#10b981]/20 rounded-2xl p-5 hover:border-[#10b981]/50 transition-all cursor-pointer group relative overflow-hidden"
          onClick={() => navigate('/artists')}
        >
          <div className="absolute top-0 right-0 p-5 opacity-10 group-hover:opacity-20 transition-opacity text-[#10b981]">
            <Mic2 size={64} />
          </div>
          <div className="w-10 h-10 rounded-full bg-[#10b981]/10 flex items-center justify-center mb-4 text-[#10b981] group-hover:scale-110 transition-transform">
            <Mic2 size={20} />
          </div>
          <h2 className="text-base font-bold text-white mb-1">Artists</h2>
          <p className="text-white/80 text-xs font-medium">{artistsCount} artists</p>
        </div>

        <div
          className="bg-gradient-to-br from-[#ec4899]/15 to-[#db2777]/10 border border-[#ec4899]/20 rounded-2xl p-5 hover:border-[#ec4899]/50 transition-all cursor-pointer group relative overflow-hidden"
          onClick={() => navigate('/genres')}
        >
          <div className="absolute top-0 right-0 p-5 opacity-10 group-hover:opacity-20 transition-opacity text-[#ec4899]">
            <Music size={64} />
          </div>
          <div className="w-10 h-10 rounded-full bg-[#ec4899]/10 flex items-center justify-center mb-4 text-[#ec4899] group-hover:scale-110 transition-transform">
            <Music size={20} />
          </div>
          <h2 className="text-base font-bold text-white mb-1">Genres</h2>
          <p className="text-white/80 text-xs font-medium">{genresCount} genres</p>
        </div>
      </div>

    </div>
  );
}
