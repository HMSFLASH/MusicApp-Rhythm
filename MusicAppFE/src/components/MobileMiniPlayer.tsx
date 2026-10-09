import { useLocation, useNavigate } from 'react-router-dom';
import { useGlobalAudio } from '../context/AudioContext';
import { Play, Pause, SkipForward, Disc, PanelLeft } from 'lucide-react';

interface MobileMiniPlayerProps {
  onOpenSidebar: () => void;
}

export function MobileMiniPlayer({ onOpenSidebar }: MobileMiniPlayerProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { playerState } = useGlobalAudio();
  const { currentTrack, isPlaying, togglePlay, playNext, hasNext, currentTime, duration } =
    playerState;

  // Don't show if no track or already on full NowPlaying screen or on desktop
  if (!currentTrack || location.pathname === '/') {
    return null;
  }

  const currentArtwork = currentTrack.imageUrl || playerState.getTrackImage(currentTrack.id);
  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleOpenNowPlaying = () => {
    globalThis.dispatchEvent(new Event('rhythm:show-now-playing-disc'));
    navigate('/');
  };

  return (
    <div className="fixed bottom-14 inset-x-2 sm:inset-x-4 max-w-lg mx-auto z-30 md:hidden bg-[#0a1424]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.75)] overflow-hidden select-none">
      {/* Top Progress Line */}
      <div className="h-0.5 bg-white/10 w-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 to-primary transition-all duration-150"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="px-3 py-2 flex items-center justify-between gap-3">
        {/* Track Thumbnail & Title - Click to open Now Playing */}
        <div
          onClick={handleOpenNowPlaying}
          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-slate-900 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
            {currentArtwork ? (
              <img src={currentArtwork} alt="" className="w-full h-full object-cover" />
            ) : (
              <Disc size={16} className="text-primary" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-white truncate">
              {currentTrack.title || currentTrack.fileName?.replace(/\.[^/.]+$/, '')}
            </span>
            <span className="text-[10px] text-slate-400 font-mono truncate">
              {currentTrack.artist || 'Unknown Artist'}
            </span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSidebar();
            }}
            className="p-1.5 text-slate-400 hover:text-white"
            title="Open Player Panel"
            aria-label="Open Player Panel"
          >
            <PanelLeft size={16} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="w-8 h-8 rounded-full bg-primary text-slate-950 flex items-center justify-center shadow-[0_0_10px_rgba(0,245,255,0.4)]"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause size={14} fill="currentColor" />
            ) : (
              <Play size={14} fill="currentColor" className="ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              playNext();
            }}
            disabled={!hasNext}
            className={`p-1.5 text-slate-300 hover:text-white ${!hasNext ? 'opacity-30' : ''}`}
            aria-label="Next track"
          >
            <SkipForward size={16} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}
