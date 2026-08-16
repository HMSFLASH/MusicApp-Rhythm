import { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGlobalAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useLibrary } from '../context/LibraryContext';
import { Play, Pause, SkipForward, SkipBack, Cloud, Disc, Heart, Shuffle, Repeat, Repeat1, Square, PauseCircle, ListX, ListPlus, Maximize2, Info, ListMusic, Volume2, VolumeX, X, ArrowRight, Loader2, RefreshCw, Download } from 'lucide-react';
import { HorizontalSlider } from './HorizontalSlider';
import { useTranslation } from 'react-i18next';
import { ActionMenu } from './ActionMenu';
import { useVirtualList } from '../hooks/useVirtualList';
import { downloadTrackFile } from '../utils/downloadUtils';

const QUEUE_POPOVER_ITEM_HEIGHT = 58;

const formatTime = (time: number) => {
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export function BottomPlayerBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { playerState } = useGlobalAudio();
  const { favorites, toggleFavorite: libraryToggleFavorite } = useLibrary();
  const { 
    currentTrack, isPlaying, isLoadingTrack, currentTime, duration, 
    togglePlay, seek, playNext, playPrevious,
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
    hasPrevious
  } = playerState;
  const currentArtwork = currentTrack ? (currentTrack.imageUrl || playerState.getTrackImage(currentTrack.id)) : '';

  const openNowPlaying = () => {
    globalThis.dispatchEvent(new Event('rhythm:show-now-playing-disc'));
    navigate('/');
  };

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
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      (isPlaying && currentTime > 0) ? animationRef.current.play() : animationRef.current.pause();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentTime > 0]);

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

  const handleProgressMove = useCallback((e: PointerEvent) => {
    if (!isDraggingProgress || !progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    let newX = e.clientX - rect.left;
    newX = Math.max(0, Math.min(newX, rect.width));
    setDragProgressPercent(newX / rect.width);
  }, [isDraggingProgress]);

  const handleProgressUp = useCallback((e: PointerEvent) => {
    if (isDraggingProgress && progressBarRef.current && duration) {
       const rect = progressBarRef.current.getBoundingClientRect();
       let newX = e.clientX - rect.left;
       newX = Math.max(0, Math.min(newX, rect.width));
       seek((newX / rect.width) * duration);
    }
    setIsDraggingProgress(false);
  }, [isDraggingProgress, duration, seek]);

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

  const displayTime = isDraggingProgress && duration ? dragProgressPercent * duration : currentTime;
  const displayPercent = duration ? (displayTime / duration) * 100 : 0;

  const isFavorite = currentTrack && isAuthenticated && currentTrack.sourceType !== 'LOCAL'
    ? favorites.some(f => f.id === currentTrack.id)
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


  if (!currentTrack || location.pathname === '/') {
    return null; // Don't show if no track is selected or if on the Now Playing page
  }

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

  const cycleSongEndMode = () => {
    if (songEndMode === 'next') setSongEndMode('repeat_one');
    else if (songEndMode === 'repeat_one') setSongEndMode('preload');
    else if (songEndMode === 'preload') setSongEndMode('stop');
    else setSongEndMode('next');
  };

  const cycleQueueEndMode = () => {
    if (queueEndMode === 'repeat') setQueueEndMode('next');
    else if (queueEndMode === 'next') setQueueEndMode('stop');
    else setQueueEndMode('repeat');
  };

  const mobileRepeatLabel = songEndMode === 'repeat_one'
    ? t('bottomPlayer.repeatSong', 'Repeat Song')
    : queueEndMode === 'repeat'
      ? t('bottomPlayer.repeatQueue', 'Repeat Queue')
      : t('bottomPlayer.repeatOff', 'Repeat: Off');

  const mobileSongEndLabel = songEndMode === 'next'
    ? t('bottomPlayer.songNext', 'Song: Next')
    : songEndMode === 'repeat_one'
      ? t('bottomPlayer.songRepeat', 'Song: Repeat')
      : songEndMode === 'preload'
        ? t('bottomPlayer.songPreload', 'Song: Preload & Stop')
        : t('bottomPlayer.songStop', 'Song: Stop');

  const mobileQueueEndLabel = queueEndMode === 'repeat'
    ? t('bottomPlayer.queueRepeat', 'Queue: Repeat')
    : queueEndMode === 'next'
      ? t('bottomPlayer.queueNext', 'Queue: Next')
      : t('bottomPlayer.queueStop', 'Queue: Stop');

  const mobileSongEndIcon = songEndMode === 'repeat_one'
    ? <Repeat1 size={14} />
    : songEndMode === 'stop'
      ? <Square size={14} />
      : songEndMode === 'preload'
        ? <PauseCircle size={14} />
        : <ArrowRight size={14} />;

  const mobileQueueEndIcon = queueEndMode === 'repeat'
    ? <Repeat size={14} />
    : queueEndMode === 'next'
      ? <ListPlus size={14} />
      : <ListX size={14} />;

  return (
    <div className="h-16 md:h-20 bg-[#08111e]/90 backdrop-blur-2xl border-t border-white/[0.08] px-3 sm:px-4 md:px-6 grid grid-cols-[minmax(0,1fr)_auto_auto] md:flex items-center gap-2 md:gap-4 md:justify-between select-none shadow-[0_-12px_40px_rgba(0,0,0,0.65)] z-50">
      
      {/* Left: Track Info */}
      <div className="flex items-center min-w-0 md:flex-1 w-full md:max-w-xs gap-2.5 md:gap-3 cursor-pointer md:cursor-auto" onClick={() => { if (globalThis.innerWidth < 768) openNowPlaying(); }}>
        <div className="relative group w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
          {currentArtwork ? (
            <img src={currentArtwork} alt="Album Art" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
          ) : (
            <div ref={discRef} className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center">
              <Disc size={22} className="text-primary/60" />
            </div>
          )}
          {isPlaying && (
            <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
              <div className="flex items-end gap-0.5 h-3">
                <span className="w-0.5 bg-primary rounded-full animate-eq-1" />
                <span className="w-0.5 bg-primary rounded-full animate-eq-2" />
                <span className="w-0.5 bg-primary rounded-full animate-eq-3" />
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col min-w-0 overflow-hidden pr-1 sm:pr-2">
          <span className="text-xs md:text-sm font-semibold text-white truncate hover:text-primary transition-colors cursor-pointer" onClick={openNowPlaying}>
            {currentTrack.title || playerState.getTrackMetadata(currentTrack.id)?.title || (currentTrack.fileName ? (currentTrack.fileName.includes(' - ') ? currentTrack.fileName.split(' - ')[1].replace(/\.[^/.]+$/, "") : currentTrack.fileName.replace(/\.[^/.]+$/, "")) : 'Unknown Title')}
          </span>
          <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5 truncate">
            {currentTrack.sourceType === 'DRIVE' ? (
              <span className="inline-flex items-center gap-0.5 text-primary text-[10px] bg-primary/10 px-1.5 py-0.2 rounded-full border border-primary/20 shrink-0">
                <Cloud size={9} /> Drive
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-medium shrink-0">Local</span>
            )}
            <span className="truncate">{currentTrack.artist || playerState.getTrackMetadata(currentTrack.id)?.artist || (currentTrack.fileName?.includes(' - ') ? currentTrack.fileName.split(' - ')[0] : 'Unknown Artist')}</span>
          </span>
        </div>
        {currentTrack.sourceType !== 'LOCAL' ? (
          <button 
            onClick={(e) => { e.stopPropagation(); toggleFavorite(); }}
            className={`
              ${isFavorite ? 'text-primary drop-shadow-[0_0_8px_rgba(0,245,255,0.6)] scale-110' : 'text-slate-400 hover:text-slate-200'} 
              transition-all duration-300 ml-0 md:ml-2 p-1.5 rounded-full shrink-0
              active:scale-90 hover:bg-white/[0.05]
            `}
            aria-label={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
          >
            <Heart size={17} fill={isFavorite ? "currentColor" : "none"} className="transition-all duration-300" />
          </button>
        ) : (
          <div className="w-[30px] ml-1 md:ml-2"></div>
        )}
      </div>

      {/* Center: Controls & Seek Bar */}
      <div className="flex flex-col items-end md:items-center gap-1 shrink-0 md:w-2/4 md:max-w-2xl md:pr-0">
        <div className="flex items-center gap-2 sm:gap-3 md:gap-5">
          <button 
            onClick={(e) => { e.stopPropagation(); setIsShuffle(prev => !prev); }}
            aria-label={isShuffle ? "Turn off shuffle" : "Turn on shuffle"}
            className={`${isShuffle ? 'text-primary drop-shadow-[0_0_6px_rgba(0,245,255,0.4)]' : 'text-slate-400 hover:text-white'} transition-colors hidden md:flex p-1.5 rounded-lg hover:bg-white/[0.05]`}
            title={isShuffle ? "Shuffle On" : "Shuffle Off"}
          >
            <Shuffle size={15} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); playPrevious(); }}
            aria-label="Previous track"
            disabled={!hasPrevious}
            className={`transition-colors p-1.5 rounded-lg hover:bg-white/[0.05] ${hasPrevious ? 'text-slate-300 hover:text-white' : 'text-white/20 cursor-not-allowed'}`}
          >
            <SkipBack size={16} fill="currentColor" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            aria-label="Play or pause"
            disabled={isLoadingTrack}
            className={`w-9 h-9 md:w-9 md:h-9 shrink-0 rounded-full flex items-center justify-center transition-all ${
              isLoadingTrack 
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                : 'bg-primary text-slate-950 shadow-[0_0_18px_rgba(0,245,255,0.4)] hover:shadow-[0_0_24px_rgba(0,245,255,0.6)] hover:scale-105 active:scale-95'
            }`}
          >
            {isLoadingTrack ? (
              <Loader2 size={16} className="animate-spin" />
            ) : isPlaying ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" className="ml-0.5" />
            )}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); playNext(); }}
            aria-label="Next track"
            disabled={!hasNext}
            className={`transition-colors p-1.5 rounded-lg hover:bg-white/[0.05] ${hasNext ? 'text-slate-300 hover:text-white' : 'text-white/20 cursor-not-allowed'}`}
          >
            <SkipForward size={16} fill="currentColor" />
          </button>
          <div className="hidden md:flex items-center gap-1.5 border-l border-white/10 pl-3 ml-1">
            {repeatMode === 'simple' ? (
              <button
                onClick={() => {
                  if (songEndMode === 'next' && queueEndMode === 'stop') {
                    setQueueEndMode('repeat');
                  } else if (songEndMode === 'next' && queueEndMode === 'repeat') {
                    setSongEndMode('repeat_one');
                  } else {
                    setSongEndMode('next');
                    setQueueEndMode('stop');
                  }
                }}
                aria-label="Change repeat mode"
                className={`p-1.5 rounded-lg hover:bg-white/[0.05] ${(queueEndMode === 'repeat' || songEndMode === 'repeat_one') ? 'text-primary drop-shadow-[0_0_6px_rgba(0,245,255,0.4)]' : 'text-slate-400 hover:text-white'} transition-colors relative flex items-center justify-center`}
                title={songEndMode === 'repeat_one' ? t('bottomPlayer.repeatSong', 'Repeat Song') : queueEndMode === 'repeat' ? t('bottomPlayer.repeatQueue', 'Repeat Queue') : t('bottomPlayer.repeatOff', 'Repeat: Off')}
              >
                {songEndMode === 'repeat_one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    if (songEndMode === 'next') setSongEndMode('repeat_one');
                    else if (songEndMode === 'repeat_one') setSongEndMode('preload');
                    else if (songEndMode === 'preload') setSongEndMode('stop');
                    else setSongEndMode('next');
                  }}
                  aria-label="Change song repeat mode"
                  className={`p-1.5 rounded-lg hover:bg-white/[0.05] ${songEndMode !== 'next' ? 'text-primary drop-shadow-[0_0_6px_rgba(0,245,255,0.4)]' : 'text-slate-400 hover:text-white'} transition-colors relative flex items-center justify-center`}
                  title={songEndMode === 'next' ? t('bottomPlayer.songNext', 'Song: Next') : songEndMode === 'repeat_one' ? t('bottomPlayer.songRepeat', 'Song: Repeat') : songEndMode === 'preload' ? t('bottomPlayer.songPreload', 'Song: Preload & Stop') : t('bottomPlayer.songStop', 'Song: Stop')}
                >
                  {songEndMode === 'repeat_one' ? <Repeat1 size={15} /> : songEndMode === 'stop' ? <Square size={13} /> : songEndMode === 'preload' ? <PauseCircle size={15} /> : <ArrowRight size={15} />}
                </button>
                <button
                  onClick={() => {
                    if (queueEndMode === 'repeat') setQueueEndMode('next');
                    else if (queueEndMode === 'next') setQueueEndMode('stop');
                    else setQueueEndMode('repeat');
                  }}
                  aria-label="Change queue repeat mode"
                  className={`p-1.5 rounded-lg hover:bg-white/[0.05] ${queueEndMode !== 'stop' ? 'text-primary drop-shadow-[0_0_6px_rgba(0,245,255,0.4)]' : 'text-slate-400 hover:text-white'} transition-colors relative flex items-center justify-center`}
                  title={queueEndMode === 'repeat' ? t('bottomPlayer.queueRepeat', 'Queue: Repeat') : queueEndMode === 'next' ? t('bottomPlayer.queueNext', 'Queue: Next') : t('bottomPlayer.queueStop', 'Queue: Stop')}
                >
                  {queueEndMode === 'repeat' ? <Repeat size={15} /> : queueEndMode === 'next' ? <ListPlus size={15} /> : <ListX size={15} />}
                </button>
              </>
            )}
          </div>
        </div>
        
        <div className="hidden md:flex w-full items-center gap-2.5 font-mono text-[11px] text-slate-400 select-none">
          <span className="min-w-[34px] text-right font-medium text-slate-400">{formatTime(displayTime)}</span>
          <div 
            ref={progressBarRef}
            className="flex-1 relative flex items-center group h-3 cursor-pointer touch-none" 
            onPointerDown={handleProgressPointerDown}
          >
            <div className="absolute inset-x-0 h-1 group-hover:h-1.5 bg-white/10 group-hover:bg-white/15 rounded-full overflow-hidden transition-all duration-200">
              <div 
                className="h-full bg-gradient-to-r from-cyan-400 to-primary group-hover:from-primary group-hover:to-cyan-300 transition-colors shadow-[0_0_10px_rgba(0,245,255,0.4)]"
                style={{ width: `${displayPercent}%` }}
              />
            </div>
            <div 
              className={`absolute h-3.5 w-3.5 bg-white rounded-full shadow-[0_0_10px_rgba(0,245,255,0.8)] border border-primary flex items-center justify-center transition-all ${isDraggingProgress ? 'opacity-100 scale-110' : 'opacity-0 group-hover:opacity-100'}`}
              style={{ left: `calc(${displayPercent}% - 7px)` }}
            />
          </div>
          <span className="min-w-[34px] text-left font-medium text-slate-400">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="md:hidden shrink-0">
        <ActionMenu
          ariaLabel="More player controls"
          direction="up"
          buttonClassName="h-9 w-9 rounded-full bg-white/[0.06] text-slate-300 hover:bg-white/[0.12] hover:text-white flex items-center justify-center transition-colors border border-white/[0.06]"
          menuClassName="w-56"
          actions={[
            { label: t('nav.nowPlaying', 'Now Playing'), icon: <Maximize2 size={14} />, onSelect: openNowPlaying },
            ...(currentTrack && currentTrack.sourceType !== 'LOCAL'
              ? [{ label: 'Download File', icon: <Download size={14} />, onSelect: () => downloadTrackFile(currentTrack) }]
              : []),
            ...(currentTrack && currentTrack.sourceType === 'DRIVE'
              ? [{
                  label: t('bottomPlayer.reloadFromDrive', 'Reload from Drive'),
                  icon: <RefreshCw size={14} className={isLoadingTrack ? 'animate-spin' : ''} />,
                  disabled: isLoadingTrack,
                  onSelect: () => void playerState.reloadCurrentTrackFromDrive(),
                }]
              : []),
            { label: t('bottomPlayer.trackMetadata', 'Track Metadata'), icon: <Info size={14} />, onSelect: () => setShowMetadata(true) },
            { label: t('bottomPlayer.queueTitle', 'Queue'), icon: <ListMusic size={14} />, onSelect: () => navigate('/queue') },
            {
              label: isShuffle ? t('bottomPlayer.shuffleOn', 'Shuffle On') : t('bottomPlayer.shuffleOff', 'Shuffle Off'),
              icon: <Shuffle size={14} />,
              onSelect: () => setIsShuffle(prev => !prev),
            },
            ...(repeatMode === 'simple'
              ? [{
                  label: mobileRepeatLabel,
                  icon: songEndMode === 'repeat_one' ? <Repeat1 size={14} /> : <Repeat size={14} />,
                  onSelect: cycleSimpleRepeatMode,
                }]
              : [
                  {
                    label: mobileSongEndLabel,
                    icon: mobileSongEndIcon,
                    onSelect: cycleSongEndMode,
                  },
                  {
                    label: mobileQueueEndLabel,
                    icon: mobileQueueEndIcon,
                    onSelect: cycleQueueEndMode,
                  },
                ]),
            {
              label: volume === 0 ? t('bottomPlayer.unmute', 'Unmute') : t('bottomPlayer.mute', 'Mute'),
              icon: volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />,
              onSelect: () => setVolume(volume === 0 ? 1 : 0),
            },
          ]}
        />
      </div>

      {/* Right: Extra Controls */}
      <div className="hidden md:flex items-center justify-end w-1/4 min-w-[200px] gap-3 text-slate-400">
        <button onClick={openNowPlaying} className="p-2 rounded-lg hover:bg-white/[0.05] hover:text-white transition-colors" aria-label="Now Playing" title="Expand Player">
          <Maximize2 size={16} />
        </button>
        {currentTrack.sourceType === 'DRIVE' && (
          <button
            onClick={() => void playerState.reloadCurrentTrackFromDrive()}
            disabled={isLoadingTrack}
            className={`p-2 rounded-lg hover:bg-white/[0.05] transition-colors ${isLoadingTrack ? 'text-white/20 cursor-not-allowed' : 'hover:text-white'}`}
            aria-label={t('bottomPlayer.reloadFromDrive', 'Reload from Drive')}
            title={t('bottomPlayer.reloadFromDrive', 'Reload from Drive')}
          >
            <RefreshCw size={15} className={isLoadingTrack ? 'animate-spin text-primary' : ''} />
          </button>
        )}
        <button onClick={() => setShowMetadata(true)} className="p-2 rounded-lg hover:bg-white/[0.05] hover:text-white transition-colors" aria-label="Track Information" title="Track Info">
          <Info size={16} />
        </button>
        <div className="relative" ref={queueRef}>
          <button 
            onClick={() => setShowQueue(v => !v)} 
            aria-label="Toggle Queue"
            className={`transition-all flex items-center justify-center p-2 rounded-lg ${showQueue ? 'text-primary bg-primary/10 border border-primary/25' : 'hover:text-white hover:bg-white/[0.05]'}`}
            title="Queue"
          >
            <ListMusic size={16} />
          </button>
          
          {showQueue && (
            <div className="absolute bottom-full right-0 mb-3 w-80 max-w-[calc(100vw_-_2rem)] bg-[#0c1626]/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden z-50 flex flex-col max-h-[60vh]">
              <div className="p-3.5 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#0c1626]/90 backdrop-blur-md z-10">
                <h2 className="font-bold text-sm text-white flex items-center gap-2">
                  <ListPlus size={16} className="text-primary" /> 
                  {t('bottomPlayer.queueTitle', 'Queue')}
                </h2>
                <span className="text-xs font-mono text-slate-400">{queue.length} {t('bottomPlayer.songs', 'songs')}</span>
              </div>
              <div
                ref={queueListRef}
                className="flex-1 overflow-y-auto p-2 no-scrollbar"
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
                  const artwork = track.imageUrl || playerState.getTrackImage?.(track.id);
                  return (
                    <div
                      key={`${track.id}-${idx}`}
                      className="relative"
                      style={{ height: QUEUE_POPOVER_ITEM_HEIGHT }}
                    >
                      <div
                        onClick={() => playTrack(track, queue)}
                        className={`flex h-[50px] items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-all ${
                          isActive ? 'bg-primary/15 border border-primary/30 text-primary shadow-[inset_0_0_10px_rgba(0,245,255,0.1)]' : 'hover:bg-white/[0.05] border border-transparent'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-lg bg-slate-800 bg-cover bg-center flex-shrink-0 overflow-hidden relative" style={{ backgroundImage: artwork ? `url(${artwork})` : undefined }}>
                          {!artwork && <Disc size={15} className="text-slate-500 m-auto mt-2.5" />}
                          {isActive && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <div className="flex items-end gap-0.5 h-2.5">
                                <span className="w-0.5 bg-primary rounded-full animate-eq-1" />
                                <span className="w-0.5 bg-primary rounded-full animate-eq-2" />
                                <span className="w-0.5 bg-primary rounded-full animate-eq-3" />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold truncate ${isActive ? 'text-primary' : 'text-slate-200'}`}>
                            {track.title || track.fileName?.replace(/\.[^/.]+$/, "")}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5 font-mono">
                            {track.artist || track.fileName?.split(' - ')[0] || 'Unknown Artist'}
                          </p>
                        </div>
                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5 shadow-[0_0_8px_rgba(0,245,255,0.8)]" />}
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
        <div className="flex items-center gap-2.5 ml-1 w-44">
          <button 
            onClick={() => setVolume(volume === 0 ? 1 : 0)}
            aria-label="Mute or Unmute"
            className="hover:text-white transition-colors flex items-center gap-1"
          >
            {volume === 0 ? <VolumeX size={15} className="text-red-400" /> : <Volume2 size={15} className="text-slate-300" />}
            <span className="text-[11px] font-mono w-8 text-left text-slate-400">{Math.round(volume * 100)}%</span>
          </button>
          <div className="flex-1 mt-0.5">
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
        </div>
      </div>
      
      {/* Metadata Modal */}
      {showMetadata && currentTrack && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
          onClick={() => setShowMetadata(false)}
        >
          <div 
            className="bg-[#0c1626] border border-white/10 rounded-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5 text-white">
                <Info size={20} className="text-primary" />
                <h3 className="font-semibold text-base">{t('bottomPlayer.trackMetadata', 'Track Metadata')}</h3>
              </div>
              <button 
                onClick={() => setShowMetadata(false)}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/[0.05]"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-4 flex flex-col gap-3 overflow-y-auto max-h-[70vh] no-scrollbar">
              <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3.5 flex flex-col gap-2.5">
                {[
                  { label: t('bottomPlayer.title', 'Title'), value: currentTrack.title || playerState.getTrackMetadata(currentTrack.id)?.title },
                  { label: t('bottomPlayer.artist', 'Artist'), value: currentTrack.artist || playerState.getTrackMetadata(currentTrack.id)?.artist },
                  { label: t('bottomPlayer.album', 'Album'), value: currentTrack.album || playerState.getTrackMetadata(currentTrack.id)?.album },
                  { label: t('bottomPlayer.genre', 'Genre'), value: currentTrack.genre || playerState.getTrackMetadata(currentTrack.id)?.genre },
                  { label: t('bottomPlayer.duration', 'Duration'), value: currentTrack.durationSeconds ? `${currentTrack.durationSeconds}s` : null },
                  { label: t('bottomPlayer.fileName', 'File Name'), value: currentTrack.fileName },
                  { label: t('bottomPlayer.source', 'Source'), value: currentTrack.sourceType },
                  { label: t('bottomPlayer.trackId', 'Track ID'), value: String(currentTrack.id) }
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-semibold">{item.label}</span>
                    <span className="text-xs text-slate-200 font-medium break-all">{item.value || t('bottomPlayer.unknown', 'unknown')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
