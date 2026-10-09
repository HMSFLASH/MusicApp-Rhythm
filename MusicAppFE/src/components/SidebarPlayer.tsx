import { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useLibrary } from '../context/LibraryContext';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Cloud,
  Disc,
  Heart,
  Shuffle,
  Repeat,
  Repeat1,
  Square,
  PauseCircle,
  ListPlus,
  Maximize2,
  Info,
  ListMusic,
  Volume2,
  VolumeX,
  ArrowRight,
  Loader2,
  RefreshCw,
  Download,
  PanelLeftClose,
  X as CloseIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { HorizontalSlider } from './HorizontalSlider';
import { useVirtualList } from '../hooks/useVirtualList';
import { downloadTrackFile } from '../utils/downloadUtils';
import { TrackInfoModal } from './TrackInfoModal';
import { LocalFilePicker } from './LocalFilePicker';

const QUEUE_POPOVER_ITEM_HEIGHT = 54;

const formatTime = (time: number) => {
  const h = Math.floor(time / 3600);
  const m = Math.floor((time % 3600) / 60);
  const s = Math.floor(time % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
};

interface SidebarPlayerProps {
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function SidebarPlayer({
  isMobileOpen,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
}: SidebarPlayerProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { playerState } = useGlobalAudio();
  const { favorites, toggleFavorite: libraryToggleFavorite } = useLibrary();

  const {
    currentTrack,
    isPlaying,
    isLoadingTrack,
    currentTime,
    duration,
    togglePlay,
    seek,
    playNext,
    playPrevious,
    isShuffle,
    setIsShuffle,
    songEndMode,
    setSongEndMode,
    queueEndMode,
    setQueueEndMode,
    repeatMode,
    volume,
    setVolume,
    queue,
    playTrack,
    hasNext,
    hasPrevious,
  } = playerState;

  const currentArtwork = currentTrack
    ? currentTrack.imageUrl || playerState.getTrackImage(currentTrack.id)
    : '';

  const openNowPlaying = () => {
    globalThis.dispatchEvent(new Event('rhythm:show-now-playing-disc'));
    navigate('/');
    if (isMobileOpen) onCloseMobile();
  };

  // Vinyl disc rotation animation
  const discRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const animationKeyRef = useRef('');
  const animationKey = `${currentTrack?.id ?? ''}:${currentArtwork}`;

  useEffect(() => {
    if (animationKeyRef.current !== animationKey) {
      animationRef.current?.cancel();
      animationRef.current = null;
      animationKeyRef.current = animationKey;

      if (discRef.current) {
        animationRef.current = discRef.current.animate(
          [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
          { duration: 10000, iterations: Infinity }
        );
      }
    }

    if (animationRef.current) {
      if (isPlaying && currentTime > 0) animationRef.current.play();
      else animationRef.current.pause();
    }
  }, [animationKey, isPlaying, currentTime]);

  useEffect(() => {
    if (animationRef.current) {
      if (isPlaying && currentTime > 0) animationRef.current.play();
      else animationRef.current.pause();
    }
  }, [isPlaying, currentTime]);

  useEffect(() => {
    if (animationRef.current) {
      const expectedTime = (currentTime * 1000) % 10000;
      const currentAnimTime = (animationRef.current.currentTime as number) || 0;
      if (Math.abs(currentAnimTime - expectedTime) > 500) {
        animationRef.current.currentTime = expectedTime;
      }
    }
  }, [currentTime]);

  const [showMetadata, setShowMetadata] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const queueRef = useRef<HTMLDivElement>(null);

  const {
    containerRef: queueListRef,
    handleScroll: handleQueueListScroll,
    offsetY: queueListOffsetY,
    totalHeight: queueListTotalHeight,
    visibleIndexes: queueListVisibleIndexes,
  } = useVirtualList({
    itemCount: showQueue ? queue.length : 0,
    itemHeight: QUEUE_POPOVER_ITEM_HEIGHT,
    overscan: 6,
  });

  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [dragProgressPercent, setDragProgressPercent] = useState(0);

  const handleProgressMove = useCallback(
    (e: PointerEvent) => {
      if (!isDraggingProgress || !progressBarRef.current) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      let newX = e.clientX - rect.left;
      newX = Math.max(0, Math.min(newX, rect.width));
      setDragProgressPercent(newX / rect.width);
    },
    [isDraggingProgress]
  );

  const handleProgressUp = useCallback(
    (e: PointerEvent) => {
      if (isDraggingProgress && progressBarRef.current && duration) {
        const rect = progressBarRef.current.getBoundingClientRect();
        let newX = e.clientX - rect.left;
        newX = Math.max(0, Math.min(newX, rect.width));
        seek((newX / rect.width) * duration);
      }
      setIsDraggingProgress(false);
    },
    [isDraggingProgress, duration, seek]
  );

  useEffect(() => {
    if (isDraggingProgress) {
      globalThis.addEventListener('pointermove', handleProgressMove);
      globalThis.addEventListener('pointerup', handleProgressUp);
    } else {
      globalThis.removeEventListener('pointermove', handleProgressMove);
      globalThis.removeEventListener('pointerup', handleProgressUp);
    }
    return () => {
      globalThis.removeEventListener('pointermove', handleProgressMove);
      globalThis.removeEventListener('pointerup', handleProgressUp);
    };
  }, [isDraggingProgress, handleProgressMove, handleProgressUp]);

  const handleProgressPointerDown = (e: React.PointerEvent) => {
    if (!duration) return;
    e.preventDefault();
    setIsDraggingProgress(true);
    if (progressBarRef.current) {
      const rect = progressBarRef.current.getBoundingClientRect();
      let newX = e.clientX - rect.left;
      newX = Math.max(0, Math.min(newX, rect.width));
      setDragProgressPercent(newX / rect.width);
    }
  };

  const displayTime =
    isDraggingProgress && duration ? dragProgressPercent * duration : currentTime;
  const displayPercent = duration ? (displayTime / duration) * 100 : 0;

  const isFavorite =
    currentTrack && isAuthenticated && currentTrack.sourceType !== 'LOCAL'
      ? favorites.some((f) => f.id === currentTrack.id)
      : false;

  const toggleFavorite = () => {
    if (!currentTrack?.id || !isAuthenticated || currentTrack.sourceType === 'LOCAL') return;
    void libraryToggleFavorite(currentTrack);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (queueRef.current && !queueRef.current.contains(e.target as Node)) {
        setShowQueue(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const cycleSimpleRepeatMode = () => {
    if (songEndMode === 'next' && queueEndMode === 'stop') {
      setQueueEndMode('repeat');
    } else if (songEndMode === 'next' && queueEndMode === 'repeat') {
      setSongEndMode('repeat_one');
    } else {
      setSongEndMode('next');
      setQueueEndMode('stop');
    }
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 md:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Main Sidebar Container */}
      <aside
        className={`bg-[#08111e]/95 backdrop-blur-2xl border-r border-white/[0.06] flex flex-col flex-shrink-0 transition-all duration-300 z-50 fixed inset-y-0 left-0 md:relative md:translate-x-0 ${
          isMobileOpen ? 'translate-x-0 w-[min(20rem,85vw)]' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'md:w-16' : 'md:w-72 lg:w-80'}`}
      >
        {/* Collapsed State on Desktop */}
        {isCollapsed ? (
          <div className="hidden md:flex flex-col items-center justify-between h-full py-4 px-2">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all"
              title="Expand Player Panel"
            >
              <PanelLeftClose className="rotate-180" size={18} />
            </button>

            {currentTrack ? (
              <div className="flex flex-col items-center gap-4 my-auto">
                <button
                  type="button"
                  onClick={openNowPlaying}
                  className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 relative group"
                  title={currentTrack.title || 'Now Playing'}
                >
                  {currentArtwork ? (
                    <img src={currentArtwork} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                      <Disc size={18} className="text-primary" />
                    </div>
                  )}
                  {isPlaying && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-full bg-primary text-slate-950 flex items-center justify-center shadow-[0_0_12px_rgba(0,245,255,0.4)] hover:scale-105 active:scale-95 transition-all"
                >
                  {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                </button>

                <button
                  type="button"
                  onClick={playNext}
                  disabled={!hasNext}
                  className={`p-2 rounded-lg text-slate-400 hover:text-white ${!hasNext ? 'opacity-30 cursor-not-allowed' : ''}`}
                >
                  <SkipForward size={16} />
                </button>
              </div>
            ) : (
              <div className="my-auto text-slate-500">
                <Disc size={20} className="animate-spin-slow" />
              </div>
            )}

            <button
              type="button"
              onClick={openNowPlaying}
              className="p-2 rounded-xl text-slate-400 hover:text-primary transition-all"
              title="Open Now Playing"
            >
              <Maximize2 size={16} />
            </button>
          </div>
        ) : (
          /* Expanded Player Panel */
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header / Panel Controls */}
            <div className="p-3.5 sm:p-4 border-b border-white/[0.06] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(0,245,255,0.8)]" />
                <span className="text-xs font-bold font-mono tracking-wider text-slate-300 uppercase">
                  Hi-Res Player
                </span>
              </div>

              <div className="flex items-center gap-1">
                {currentTrack && (
                  <>
                    <button
                      type="button"
                      onClick={openNowPlaying}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
                      title={t('nav.nowPlaying', 'Now Playing')}
                    >
                      <Maximize2 size={15} />
                    </button>
                    {currentTrack.sourceType === 'DRIVE' && (
                      <button
                        type="button"
                        onClick={() => void playerState.reloadCurrentTrackFromDrive()}
                        disabled={isLoadingTrack}
                        className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors ${
                          isLoadingTrack ? 'animate-spin text-primary' : ''
                        }`}
                        title={t('bottomPlayer.reloadFromDrive', 'Reload from Drive')}
                      >
                        <RefreshCw size={14} />
                      </button>
                    )}
                    {currentTrack.sourceType !== 'LOCAL' && (
                      <button
                        type="button"
                        onClick={() => downloadTrackFile(currentTrack)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
                        title={t('tracks.downloadFile', 'Download File')}
                      >
                        <Download size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowMetadata(true)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
                      title={t('bottomPlayer.trackMetadata', 'Track Info')}
                    >
                      <Info size={14} />
                    </button>
                  </>
                )}

                {/* Desktop Collapse Toggle */}
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="hidden md:inline-flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
                  title="Collapse Player Panel"
                >
                  <PanelLeftClose size={15} />
                </button>

                {/* Mobile Close Button */}
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
                  aria-label="Close Player"
                >
                  <CloseIcon size={18} />
                </button>
              </div>
            </div>

            {/* Scrollable Center Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-3.5 sm:p-4 space-y-4">
              {currentTrack ? (
                <>
                  {/* Artwork & Turntable Record */}
                  <div className="relative group mx-auto w-full max-w-[240px] aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-white/10 shadow-2xl flex items-center justify-center">
                    {currentArtwork ? (
                      <img
                        src={currentArtwork}
                        alt="Album Cover"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div
                        ref={discRef}
                        className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-900 to-black flex items-center justify-center"
                      >
                        <Disc size={64} className="text-primary/40" />
                      </div>
                    )}

                    {/* Equalizer Wave Overlay When Playing */}
                    {isPlaying && (
                      <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                        <div className="flex items-end gap-1 h-6">
                          <span className="w-1 bg-primary rounded-full animate-eq-1 shadow-[0_0_6px_rgba(0,245,255,0.8)]" />
                          <span className="w-1 bg-primary rounded-full animate-eq-2 shadow-[0_0_6px_rgba(0,245,255,0.8)]" />
                          <span className="w-1 bg-primary rounded-full animate-eq-3 shadow-[0_0_6px_rgba(0,245,255,0.8)]" />
                          <span className="w-1 bg-primary rounded-full animate-eq-2 shadow-[0_0_6px_rgba(0,245,255,0.8)]" />
                          <span className="w-1 bg-primary rounded-full animate-eq-1 shadow-[0_0_6px_rgba(0,245,255,0.8)]" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Track Title, Artist, & Favorite Heart */}
                  <div className="flex items-start justify-between gap-2 pt-1">
                    <div className="flex-1 min-w-0">
                      <h3
                        onClick={openNowPlaying}
                        className="text-sm font-bold text-white truncate hover:text-primary transition-colors cursor-pointer"
                        title={currentTrack.title || currentTrack.fileName}
                      >
                        {currentTrack.title ||
                          playerState.getTrackMetadata(currentTrack.id)?.title ||
                          (currentTrack.fileName
                            ? currentTrack.fileName.includes(' - ')
                              ? currentTrack.fileName.split(' - ')[1].replace(/\.[^/.]+$/, '')
                              : currentTrack.fileName.replace(/\.[^/.]+$/, '')
                            : 'Unknown Title')}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {currentTrack.sourceType === 'DRIVE' ? (
                          <span className="inline-flex items-center gap-0.5 text-primary text-[10px] bg-primary/10 px-1.5 py-0.2 rounded-full border border-primary/20 shrink-0 font-mono">
                            <Cloud size={9} /> Drive
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono bg-white/[0.04] px-1.5 py-0.2 rounded-full border border-white/[0.06] shrink-0">
                            Local
                          </span>
                        )}
                        <span className="text-xs text-slate-400 font-mono truncate">
                          {currentTrack.artist ||
                            playerState.getTrackMetadata(currentTrack.id)?.artist ||
                            (currentTrack.fileName?.includes(' - ')
                              ? currentTrack.fileName.split(' - ')[0]
                              : 'Unknown Artist')}
                        </span>
                      </div>
                    </div>

                    {currentTrack.sourceType !== 'LOCAL' && (
                      <button
                        type="button"
                        onClick={toggleFavorite}
                        className={`p-1.5 rounded-full transition-all shrink-0 hover:bg-white/[0.05] ${
                          isFavorite
                            ? 'text-primary drop-shadow-[0_0_8px_rgba(0,245,255,0.6)] scale-110'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                        aria-label="Toggle Favorite"
                      >
                        <Heart
                          size={18}
                          fill={isFavorite ? 'currentColor' : 'none'}
                          className="transition-all duration-300"
                        />
                      </button>
                    )}
                  </div>

                  {/* Scrub Bar & Timeline */}
                  <div className="space-y-1.5 pt-1">
                    <div
                      ref={progressBarRef}
                      className="relative flex items-center group h-4 cursor-pointer touch-none"
                      onPointerDown={handleProgressPointerDown}
                    >
                      <div className="absolute inset-x-0 h-1.5 group-hover:h-2 bg-white/10 group-hover:bg-white/15 rounded-full overflow-hidden transition-all duration-200">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 to-primary group-hover:from-primary group-hover:to-cyan-300 transition-colors shadow-[0_0_10px_rgba(0,245,255,0.4)]"
                          style={{ width: `${displayPercent}%` }}
                        />
                      </div>
                      <div
                        className={`absolute h-3.5 w-3.5 bg-white rounded-full shadow-[0_0_10px_rgba(0,245,255,0.8)] border border-primary flex items-center justify-center transition-all ${
                          isDraggingProgress
                            ? 'opacity-100 scale-110'
                            : 'opacity-0 group-hover:opacity-100'
                        }`}
                        style={{ left: `calc(${displayPercent}% - 7px)` }}
                      />
                    </div>
                    <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 select-none">
                      <span>{formatTime(displayTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Playback Control Buttons */}
                  <div className="flex items-center justify-between px-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsShuffle((prev) => !prev)}
                      className={`p-2 rounded-xl transition-colors hover:bg-white/[0.05] ${
                        isShuffle
                          ? 'text-primary drop-shadow-[0_0_6px_rgba(0,245,255,0.4)]'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title={isShuffle ? 'Shuffle On' : 'Shuffle Off'}
                    >
                      <Shuffle size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={playPrevious}
                      disabled={!hasPrevious}
                      className={`p-2 rounded-xl transition-colors hover:bg-white/[0.05] ${
                        hasPrevious
                          ? 'text-slate-300 hover:text-white'
                          : 'text-white/20 cursor-not-allowed'
                      }`}
                      title="Previous"
                    >
                      <SkipBack size={18} fill="currentColor" />
                    </button>

                    <button
                      type="button"
                      onClick={togglePlay}
                      disabled={isLoadingTrack}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0 ${
                        isLoadingTrack
                          ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                          : 'bg-primary text-slate-950 shadow-[0_0_20px_rgba(0,245,255,0.45)] hover:shadow-[0_0_26px_rgba(0,245,255,0.65)] hover:scale-105 active:scale-95'
                      }`}
                      title={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isLoadingTrack ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : isPlaying ? (
                        <Pause size={20} fill="currentColor" />
                      ) : (
                        <Play size={20} fill="currentColor" className="ml-0.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={playNext}
                      disabled={!hasNext}
                      className={`p-2 rounded-xl transition-colors hover:bg-white/[0.05] ${
                        hasNext
                          ? 'text-slate-300 hover:text-white'
                          : 'text-white/20 cursor-not-allowed'
                      }`}
                      title="Next"
                    >
                      <SkipForward size={18} fill="currentColor" />
                    </button>

                    {repeatMode === 'simple' ? (
                      <button
                        type="button"
                        onClick={cycleSimpleRepeatMode}
                        className={`p-2 rounded-xl transition-colors hover:bg-white/[0.05] ${
                          queueEndMode === 'repeat' || songEndMode === 'repeat_one'
                            ? 'text-primary drop-shadow-[0_0_6px_rgba(0,245,255,0.4)]'
                            : 'text-slate-400 hover:text-white'
                        }`}
                        title={
                          songEndMode === 'repeat_one'
                            ? t('bottomPlayer.repeatSong', 'Repeat Song')
                            : queueEndMode === 'repeat'
                            ? t('bottomPlayer.repeatQueue', 'Repeat Queue')
                            : t('bottomPlayer.repeatOff', 'Repeat: Off')
                        }
                      >
                        {songEndMode === 'repeat_one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (songEndMode === 'next') setSongEndMode('repeat_one');
                          else if (songEndMode === 'repeat_one') setSongEndMode('preload');
                          else if (songEndMode === 'preload') setSongEndMode('stop');
                          else setSongEndMode('next');
                        }}
                        className={`p-2 rounded-xl transition-colors hover:bg-white/[0.05] ${
                          songEndMode !== 'next'
                            ? 'text-primary drop-shadow-[0_0_6px_rgba(0,245,255,0.4)]'
                            : 'text-slate-400 hover:text-white'
                        }`}
                        title="Change Repeat Mode"
                      >
                        {songEndMode === 'repeat_one' ? (
                          <Repeat1 size={16} />
                        ) : songEndMode === 'stop' ? (
                          <Square size={14} />
                        ) : songEndMode === 'preload' ? (
                          <PauseCircle size={16} />
                        ) : (
                          <ArrowRight size={16} />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Volume Control */}
                  <div className="flex items-center gap-2.5 px-1 py-1.5 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                    <button
                      type="button"
                      onClick={() => setVolume(volume === 0 ? 1 : 0)}
                      className="p-1 text-slate-400 hover:text-white transition-colors"
                      title={volume === 0 ? 'Unmute' : 'Mute'}
                    >
                      {volume === 0 ? (
                        <VolumeX size={16} className="text-red-400" />
                      ) : (
                        <Volume2 size={16} className="text-slate-300" />
                      )}
                    </button>
                    <div className="flex-1">
                      <HorizontalSlider
                        value={volume}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={setVolume}
                        label=""
                        color="#00f5ff"
                        hideLabels={true}
                      />
                    </div>
                    <span className="text-[10px] font-mono w-7 text-right text-slate-400">
                      {Math.round(volume * 100)}%
                    </span>
                  </div>

                  {/* Queue Toggle Popover */}
                  <div className="relative pt-1" ref={queueRef}>
                    <button
                      type="button"
                      onClick={() => setShowQueue((v) => !v)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                        showQueue
                          ? 'bg-primary/15 text-primary border-primary/30 shadow-[inset_0_0_12px_rgba(0,245,255,0.1)]'
                          : 'bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] border-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <ListMusic size={15} className="text-primary" />
                        <span>{t('bottomPlayer.queueTitle', 'Queue')}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 bg-white/[0.06] px-1.5 py-0.5 rounded-md">
                        {queue.length} {t('bottomPlayer.songs', 'songs')}
                      </span>
                    </button>

                    {showQueue && (
                      <div className="absolute bottom-full inset-x-0 mb-2 bg-[#0c1626]/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden z-50 flex flex-col max-h-[45vh]">
                        <div className="p-3 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#0c1626]/90 backdrop-blur-md z-10">
                          <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
                            <ListPlus size={14} className="text-primary" />
                            {t('bottomPlayer.queueTitle', 'Queue')}
                          </h4>
                          <span className="text-[11px] font-mono text-slate-400">
                            {queue.length}
                          </span>
                        </div>
                        <div
                          ref={queueListRef}
                          className="flex-1 overflow-y-auto p-1.5 no-scrollbar"
                          onScroll={handleQueueListScroll}
                        >
                          <div className="relative" style={{ height: queueListTotalHeight }}>
                            <div
                              className="absolute inset-x-0 top-0"
                              style={{ transform: `translateY(${queueListOffsetY}px)` }}
                            >
                              {queueListVisibleIndexes.map((idx) => {
                                const track = queue[idx];
                                if (!track) return null;
                                const isActive = currentTrack?.id === track.id;
                                const artwork =
                                  track.imageUrl || playerState.getTrackImage?.(track.id);
                                return (
                                  <div
                                    key={`${track.id}-${idx}`}
                                    className="relative"
                                    style={{ height: QUEUE_POPOVER_ITEM_HEIGHT }}
                                  >
                                    <div
                                      onClick={() => playTrack(track, queue)}
                                      className={`flex h-[46px] items-center gap-2 p-1.5 rounded-xl cursor-pointer transition-all ${
                                        isActive
                                          ? 'bg-primary/15 border border-primary/30 text-primary'
                                          : 'hover:bg-white/[0.05] border border-transparent'
                                      }`}
                                    >
                                      <div
                                        className="w-8 h-8 rounded-lg bg-slate-800 bg-cover bg-center flex-shrink-0 overflow-hidden relative"
                                        style={{
                                          backgroundImage: artwork ? `url(${artwork})` : undefined,
                                        }}
                                      >
                                        {!artwork && (
                                          <Disc size={14} className="text-slate-500 m-auto mt-2" />
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p
                                          className={`text-xs font-medium truncate ${
                                            isActive ? 'text-primary font-semibold' : 'text-slate-200'
                                          }`}
                                        >
                                          {track.title || track.fileName?.replace(/\.[^/.]+$/, '')}
                                        </p>
                                        <p className="text-[10px] text-slate-400 truncate font-mono">
                                          {track.artist ||
                                            track.fileName?.split(' - ')[0] ||
                                            'Unknown'}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Empty Player Idle State */
                <div className="flex flex-col items-center justify-center text-center py-6 px-2 space-y-4">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/10 via-white/[0.03] to-indigo-600/10 border border-primary/20 flex items-center justify-center shadow-[0_0_20px_rgba(0,245,255,0.15)]">
                    <Disc size={44} className="text-primary/60 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Chưa chọn bài hát</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-[200px] leading-relaxed">
                      Chọn bài hát từ thư viện hoặc tải tệp cục bộ để bắt đầu phát nhạc.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/library');
                      if (isMobileOpen) onCloseMobile();
                    }}
                    className="px-4 py-2 rounded-xl bg-primary/15 text-primary border border-primary/30 text-xs font-semibold hover:bg-primary/25 transition-all shadow-[0_0_12px_rgba(0,245,255,0.2)]"
                  >
                    Khám phá Thư Viện
                  </button>
                </div>
              )}

              {/* Local File Picker Section in Player Sidebar */}
              <div className="pt-2 border-t border-white/[0.06]">
                <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider block mb-2 px-1">
                  {t('layout.localFiles', 'Local Files')}
                </span>
                <LocalFilePicker />
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Track Metadata Modal */}
      {showMetadata && currentTrack && (
        <TrackInfoModal
          track={currentTrack}
          trackMetadata={playerState.getTrackMetadata(currentTrack.id)}
          onClose={() => setShowMetadata(false)}
        />
      )}
    </>
  );
}
