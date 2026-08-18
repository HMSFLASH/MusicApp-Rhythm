import { useState, useRef, useEffect, useCallback } from 'react';
import { useGlobalAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { Disc, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart, Info, ListPlus, MoreHorizontal, Repeat1, Volume2, VolumeX, BarChart2, Gauge, Music, Check, ArrowRight, Square, PauseCircle, ListX, Loader2, Trash2, Cpu, RefreshCw, MonitorSpeaker, Download, Activity, Moon, DownloadCloud, CheckCircle2 } from 'lucide-react';
import { HorizontalSlider } from '../components/HorizontalSlider';
import { SpeedPitchPanel } from '../components/SpeedPitchPanel';
import { useLibrary } from '../context/LibraryContext';
import { useSleepTimer } from '../context/SleepTimerContext';
import { useOffline } from '../context/OfflineContext';
import { LyricsView } from '../components/LyricsView';
import { AudioVisualizer } from '../components/AudioVisualizer';
import { MeshAmbientGlow } from '../components/MeshAmbientGlow';
import { useArtworkPalette } from '../hooks/useArtworkPalette';

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../context/ConfirmContext';
import { getAudioExtension } from '../hooks/audioMime';
import { downloadTrackFile } from '../utils/downloadUtils';
import { TrackInfoModal } from '../components/TrackInfoModal';

const formatTime = (time: number) => {
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export function NowPlaying() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { isAuthenticated } = useAuth();
  const { playerState } = useGlobalAudio();
  const { deleteTrack, favorites, toggleFavorite: libraryToggleFavorite } = useLibrary();
  const { state: sleepTimerState, openModal: openSleepTimerModal } = useSleepTimer();
  const { isOfflineMode, isCached, downloadTrack, downloadingTrackIds } = useOffline();
  const navigate = useNavigate();
  const {
    isPlaying, isLoadingTrack, currentTrack, currentTime, duration,
    togglePlay, seek, playNext, playPrevious,
    playbackRate, updatePlaybackRate, preservesPitch, togglePreservesPitch,
    pitchRate, updatePitchRate, speedPitchMode, setSpeedPitchMode,
    speedPitchScope, setSpeedPitchScope,
    isShuffle, setIsShuffle, songEndMode, setSongEndMode, queueEndMode, setQueueEndMode,
    repeatMode, setRepeatMode,
    volume, setVolume,
    cycleQueues, setCycleQueues,
    hasNext, hasPrevious
  } = playerState;
  const currentArtwork = currentTrack ? (currentTrack.imageUrl || playerState.getTrackImage(currentTrack.id)) : '';
  const { palette } = useArtworkPalette(currentArtwork);
  const pageScrollRef = useRef<HTMLDivElement>(null);
  const queueContainerRef = useRef<HTMLDivElement>(null);
  const activeQueueTrackRef = useRef<HTMLDivElement>(null);

  const isFavorite = currentTrack && isAuthenticated && currentTrack.sourceType !== 'LOCAL'
    ? favorites.some(f => f.id === currentTrack.id)
    : false;

  const toggleFavorite = () => {
    if (!currentTrack?.id || !isAuthenticated || currentTrack.sourceType === 'LOCAL') return;
    void libraryToggleFavorite(currentTrack);
  };


  // F8 scroll effect state
  const [cdSize, setCdSize] = useState(288);
  const [cdOpacity, setCdOpacity] = useState(1);

  const scrollDiscIntoView = useCallback(() => {
    const page = pageScrollRef.current;
    page?.scrollTo({ top: 0, behavior: 'auto' });
    page?.closest('main')?.scrollTo({ top: 0, behavior: 'auto' });
    setCdSize(288);
    setCdOpacity(1);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollDiscIntoView();
    }, 0);
    globalThis.addEventListener('rhythm:show-now-playing-disc', scrollDiscIntoView);
    return () => {
      clearTimeout(timer);
      globalThis.removeEventListener('rhythm:show-now-playing-disc', scrollDiscIntoView);
    };
  }, [scrollDiscIntoView]);

  useEffect(() => {
    if (!currentTrack) return;

    const frame = requestAnimationFrame(() => {
      const el = activeQueueTrackRef.current;
      const container = queueContainerRef.current;
      if (!el || !container) return;

      const page = pageScrollRef.current;
      const isDesktopLayout = globalThis.matchMedia('(min-width: 1024px)').matches;

      if (!isDesktopLayout && page) {
        const queueRect = container.getBoundingClientRect();
        const isQueueVisible = queueRect.top < globalThis.innerHeight && queueRect.bottom > 0;
        if (!isQueueVisible) return;
      }

      container.scrollTo({
        top: el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2,
        behavior: 'smooth'
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [currentTrack?.id, playerState.queue.length]);

  // Smooth GPU-accelerated JS animation
  const discRef1 = useRef<HTMLDivElement>(null);
  const discRef2 = useRef<HTMLDivElement>(null);
  const animationRef1 = useRef<Animation | null>(null);
  const animationRef2 = useRef<Animation | null>(null);
  const animationKeyRef = useRef('');
  const animationKey = `${currentTrack?.id ?? ''}:${currentArtwork}`;

  useEffect(() => {
    const keyframes = [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }];
    const options: KeyframeAnimationOptions = { duration: 10000, iterations: Infinity };

    if (animationKeyRef.current !== animationKey) {
      animationRef1.current?.cancel();
      animationRef2.current?.cancel();
      animationRef1.current = null;
      animationRef2.current = null;
      animationKeyRef.current = animationKey;

      if (discRef1.current) {
        animationRef1.current = discRef1.current.animate(keyframes, options);
      }
      if (discRef2.current) {
        animationRef2.current = discRef2.current.animate(keyframes, options);
      }
    }

    [animationRef1.current, animationRef2.current].forEach((animation) => {
      if (!animation) return;
      if (isPlaying) animation.play();
      else animation.pause();
    });
  }, [animationKey, isPlaying]);

  useEffect(() => {
    if (animationRef1.current) {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      isPlaying ? animationRef1.current.play() : animationRef1.current.pause();
    }
    if (animationRef2.current) {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      isPlaying ? animationRef2.current.play() : animationRef2.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (animationRef1.current) {
      animationRef1.current.playbackRate = playbackRate;
    }
    if (animationRef2.current) {
      animationRef2.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    const expectedTime = (currentTime * 1000) % 10000;
    [animationRef1.current, animationRef2.current].forEach(anim => {
      if (anim) {
        const currentAnimTime = (anim.currentTime as number) || 0;
        if (Math.abs(currentAnimTime - expectedTime) > 500) {
          anim.currentTime = expectedTime;
        }
      }
    });
  }, [currentTime]);

  // More menu state
  const [showMenu, setShowMenu] = useState(false);
  const [showSpeedPitch, setShowSpeedPitch] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // Volume menu state
  const [showVolume, setShowVolume] = useState(false);
  const volumeRef = useRef<HTMLDivElement>(null);

  // Metadata Modal state
  const [showMetadata, setShowMetadata] = useState(false);
  // Lyrics Modal state
  const [showLyrics, setShowLyrics] = useState(false);
  // Visualizer Mode state (default to 'off')
  const [visualizerMode, setVisualizerMode] = useState<'mirror' | 'bars' | 'wave' | 'off'>(() => {
    const saved = localStorage.getItem('RHYTHM_VISUALIZER_MODE');
    if (saved && ['mirror', 'bars', 'wave', 'off'].includes(saved)) {
      return saved as 'mirror' | 'bars' | 'wave' | 'off';
    }
    return 'off';
  });

  useEffect(() => {
    localStorage.setItem('RHYTHM_VISUALIZER_MODE', visualizerMode);
  }, [visualizerMode]);

  // Audio Device state
  const [showDeviceMenu, setShowDeviceMenu] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('default');
  const [hasDeviceLabels, setHasDeviceLabels] = useState(true);

  const fetchAudioDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputDevices = devices.filter(d => d.kind === 'audiooutput');
      setAudioDevices(outputDevices);
      setHasDeviceLabels(outputDevices.some(d => d.label !== ''));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const requestAudioPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      await fetchAudioDevices();
    } catch (e) {
      console.error('Failed to get audio permissions', e);
    }
  };

  useEffect(() => {
    if (showDeviceMenu) {
      const timer = setTimeout(() => {
        void fetchAudioDevices();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [showDeviceMenu, fetchAudioDevices]);


  const trackLyrics = currentTrack?.lyrics || (currentTrack ? playerState.getTrackMetadata(currentTrack.id)?.lyrics : undefined);
  const hasLyrics = !!trackLyrics;

  type SongEndMode = 'stop' | 'preload' | 'next' | 'repeat_one';
  type QueueEndMode = 'stop' | 'next' | 'repeat';
  const [showRepeatMenu, setShowRepeatMenu] = useState(false);
  const [songEndModeTemp, setSongEndModeTemp] = useState<SongEndMode>('next');
  const [queueEndModeTemp, setQueueEndModeTemp] = useState<QueueEndMode>('repeat');

  const repeatRef = useRef<HTMLDivElement>(null);

  const openRepeatMenu = () => {
    setSongEndModeTemp(songEndMode);
    setQueueEndModeTemp(queueEndMode);
    setShowRepeatMenu(v => !v);
  };
  const confirmRepeat = () => {
    setSongEndMode(songEndModeTemp);
    setQueueEndMode(queueEndModeTemp);
    setShowRepeatMenu(false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowSpeedPitch(false);
        setShowDeviceMenu(false);
      }
      if (repeatRef.current && !repeatRef.current.contains(e.target as Node)) {
        setShowRepeatMenu(false);
      }
      if (volumeRef.current && !volumeRef.current.contains(e.target as Node)) {
        setShowVolume(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    const newSize = Math.max(0, 288 - scrollTop);
    setCdSize(newSize);
    setCdOpacity(newSize / 288);
  };

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

  if (!currentTrack) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6 max-w-md mx-auto w-full text-center px-4 py-12">
        {/* Sleek Vinyl Graphic */}
        <div className="relative flex items-center justify-center w-48 h-48 rounded-full border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] bg-gradient-to-b from-slate-900 to-[#040810]">
          <div className="absolute inset-3 rounded-full border border-white/5" />
          <div className="absolute inset-7 rounded-full border border-white/5" />
          <div className="absolute inset-11 rounded-full border border-white/5" />
          <div className="relative z-10 w-14 h-14 bg-primary/15 rounded-full flex items-center justify-center border-2 border-primary/30 shadow-[0_0_20px_rgba(0,245,255,0.2)]">
            <Disc size={22} className="text-primary animate-spin-slow" />
          </div>
          <div className="absolute z-20 w-3 h-3 bg-background rounded-full border border-slate-700" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-display text-white tracking-tight">{t('nowPlaying.noTrack')}</h2>
          <p className="text-slate-400 text-xs mt-2 max-w-xs leading-relaxed">{t('nowPlaying.noTrackDesc')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/library')}
            className="px-5 py-2.5 rounded-xl bg-primary text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(0,245,255,0.35)] hover:shadow-[0_0_30px_rgba(0,245,255,0.5)] transition-all hover:scale-105 active:scale-95"
          >
            Open Library
          </button>
          <button
            onClick={openSleepTimerModal}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 ${
              sleepTimerState.isActive
                ? 'bg-primary/20 text-primary border-primary/40 shadow-sm'
                : 'bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white border-white/[0.08]'
            }`}
          >
            <Moon size={14} className={sleepTimerState.isActive ? 'text-primary animate-pulse' : ''} />
            <span>{sleepTimerState.isActive ? `${t('sleepTimer.title', 'Hẹn giờ')}: ${formatTime(sleepTimerState.remainingSeconds)}` : t('sleepTimer.title', 'Hẹn Giờ Tắt')}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={pageScrollRef} className="h-full overflow-y-auto w-full no-scrollbar relative" onScroll={handleScroll}>
      {/* Apple Music / Spotify Style Mesh Ambient Glow */}
      <MeshAmbientGlow palette={palette} isPlaying={isPlaying} />

      <div className="flex flex-col lg:flex-row items-start justify-center max-w-6xl 2xl:max-w-[1400px] 3xl:max-w-[1600px] 4k:max-w-[2000px] mx-auto w-full gap-8 md:gap-12 py-3 md:py-6 pb-28 md:pb-32 relative z-10">

        {/* Left Side: Player */}
        <div className="flex-1 flex flex-col items-center w-full max-w-lg mx-auto gap-5 md:gap-7 pt-1 md:pt-4">
          {/* Album Art / Lyrics Wrapper with Ambient Glow */}
          <div
            className={`flex items-center justify-center transition-[width,opacity] duration-500 relative w-full ${showLyrics && hasLyrics ? 'flex-shrink-0' : 'flex-shrink-0'}`}
            style={{
              height: cdSize,
              width: (showLyrics && hasLyrics) ? '100%' : cdSize,
              opacity: (showLyrics && hasLyrics) ? 1 : cdOpacity
            }}
          >
            <div className={`w-full h-full flex flex-col min-h-0 relative overflow-hidden animate-fade-in ${showLyrics && hasLyrics ? 'block' : 'hidden'}`}>
              {showLyrics && hasLyrics && (
                <div className="w-full h-full rounded-2xl bg-[#0c1626]/70 border border-white/[0.08] backdrop-blur-xl p-4 shadow-xl">
                  <LyricsView lyrics={trackLyrics!} currentTime={currentTime} duration={duration} onSeek={playerState.seek} />
                </div>
              )}
            </div>

            <div className={`w-full h-full relative ${showLyrics && hasLyrics ? 'hidden' : 'block'}`}>
              {/* Dynamic Vinyl Ambient Aura with extracted palette */}
              <div
                className={`absolute inset-0 rounded-full blur-3xl transition-all duration-700 pointer-events-none ${
                  isPlaying ? 'scale-110 opacity-100' : 'opacity-0 scale-90'
                }`}
                style={{
                  background: `radial-gradient(circle, rgba(${palette.rgbPrimary}, 0.35) 0%, rgba(${palette.rgbSecondary}, 0.18) 55%, transparent 75%)`,
                  filter: 'blur(36px)',
                }}
              />

              {currentArtwork ? (
                <div
                  className={`absolute inset-0 flex items-center justify-center w-full h-full rounded-full shadow-[0_15px_50px_rgba(0,0,0,0.8)] border-[6px] border-slate-900/90 overflow-hidden ${isPlaying ? 'scale-100 opacity-100' : 'scale-95 opacity-70'}`}
                  style={{ transition: 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.7s ease' }}
                >
                  <div ref={discRef1} className="w-full h-full relative">
                    <img src={currentArtwork} alt="Album Art" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-tr from-black/30 via-transparent to-white/10 pointer-events-none" />
                    {/* Concentric subtle vinyl grooves */}
                    <div className="absolute inset-4 rounded-full border border-white/[0.06] pointer-events-none" />
                    <div className="absolute inset-10 rounded-full border border-white/[0.04] pointer-events-none" />
                    {/* Center hole */}
                    <div className="absolute z-20 w-[10%] h-[10%] bg-slate-950 rounded-full border-2 border-slate-700 shadow-inner top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400 m-auto mt-1" />
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={`absolute inset-0 flex items-center justify-center w-full h-full rounded-full border border-white/10 shadow-[0_15px_50px_rgba(0,0,0,0.8)] bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-800 ${isPlaying ? 'scale-100 opacity-100' : 'scale-95 opacity-70'}`}
                  style={{ transition: 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.7s ease' }}
                >
                  <div ref={discRef2} className="w-full h-full relative">
                    {/* Vinyl grooves */}
                    <div className="absolute inset-3 rounded-full border border-white/[0.06]" />
                    <div className="absolute inset-7 rounded-full border border-white/[0.04]" />
                    <div className="absolute inset-11 rounded-full border border-white/[0.05]" />
                    <div className="absolute inset-16 rounded-full border border-white/[0.03]" />

                    {/* Center Label */}
                    <div
                      className="absolute z-10 w-1/3 h-1/3 backdrop-blur-md rounded-full flex items-center justify-center border-2 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-lg"
                      style={{
                        background: `linear-gradient(135deg, rgba(${palette.rgbPrimary}, 0.3), rgba(${palette.rgbSecondary}, 0.3))`,
                        borderColor: `rgba(${palette.rgbPrimary}, 0.5)`,
                      }}
                    >
                      <Disc
                        size={28}
                        style={{ color: palette.primary, filter: `drop-shadow(0 0 8px ${palette.primary})` }}
                      />
                    </div>

                    {/* Inner hole */}
                    <div className="absolute z-20 w-3.5 h-3.5 bg-slate-950 rounded-full border border-slate-700 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between w-full px-3 gap-3">
            <div className="flex-1 min-w-0 text-left sm:text-center">
              <h2 className="text-xl sm:text-2xl font-bold font-display text-white mb-1 tracking-tight truncate">
                {currentTrack.title || playerState.getTrackMetadata(currentTrack.id)?.title || (currentTrack.fileName ? (currentTrack.fileName.includes(' - ') ? currentTrack.fileName.split(' - ')[1].replace(/\.[^/.]+$/, "") : currentTrack.fileName.replace(/\.[^/.]+$/, "")) : 'Unknown Title')}
              </h2>
              <div className="flex items-center sm:justify-center gap-2 text-sm text-slate-400 font-medium truncate">
                <span className="truncate">{currentTrack.artist || playerState.getTrackMetadata(currentTrack.id)?.artist || (currentTrack.fileName?.includes(' - ') ? currentTrack.fileName.split(' - ')[0] : t('bottomPlayer.unknown'))}</span>
                {currentTrack.album && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400 truncate text-xs">{currentTrack.album}</span>
                  </>
                )}
              </div>
            </div>

            {currentTrack.sourceType !== 'LOCAL' && (
              <button
                onClick={toggleFavorite}
                className={`p-2.5 rounded-2xl transition-all duration-300 shrink-0 ${
                  isFavorite
                    ? 'text-primary bg-primary/10 border border-primary/30 shadow-[0_0_15px_rgba(0,245,255,0.3)] scale-105'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.06] border border-transparent'
                }`}
                aria-label={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
              >
                <Heart size={22} fill={isFavorite ? "currentColor" : "none"} className="transition-transform active:scale-90" />
              </button>
            )}
          </div>

          {/* Real-time Spectrum Audio Visualizer with Adaptive Colors */}
          {visualizerMode !== 'off' && (
            <div className="w-full max-w-md px-2 my-1 animate-in fade-in duration-300">
              <div
                className="group relative p-2.5 rounded-2xl bg-white/[0.025] hover:bg-white/[0.045] border border-white/[0.06] hover:border-white/[0.1] backdrop-blur-md shadow-inner flex flex-col items-center cursor-pointer transition-all duration-300"
                onClick={() => setVisualizerMode(m => m === 'mirror' ? 'bars' : m === 'bars' ? 'wave' : m === 'wave' ? 'off' : 'mirror')}
                title={`Visualizer: ${visualizerMode.toUpperCase()} (Click to switch)`}
              >
                <AudioVisualizer
                  analyserRef={playerState.masterAnalyserRef}
                  isPlaying={isPlaying}
                  mode={visualizerMode}
                  className="w-full h-14"
                  barColor={palette.primary}
                  secondaryColor={palette.secondary}
                  glowColor={palette.glow}
                />
                <span className="absolute top-1.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded-full border border-white/10 text-[9px] font-mono uppercase tracking-wider text-slate-300 pointer-events-none select-none">
                  {visualizerMode}
                </span>
              </div>
            </div>
          )}

          {/* Playback Controls (Progress, Main Transport, Secondary Dock) */}
          <div className="w-full max-w-md mt-2 flex flex-col gap-4">

            {/* Seek Bar with Dynamic Palette */}
            <div className="flex items-center gap-3 font-mono text-xs font-semibold text-slate-400 select-none relative px-2">
              <span className="min-w-[36px] text-right">{formatTime(displayTime)}</span>
              <div
                ref={progressBarRef}
                className="flex-1 relative flex items-center group h-5 cursor-pointer touch-none"
                onPointerDown={handleProgressPointerDown}
              >
                <div className="absolute inset-x-0 h-1.5 group-hover:h-2 bg-white/10 rounded-full overflow-hidden transition-all">
                  <div
                    className="h-full transition-all duration-150"
                    style={{
                      width: `${displayPercent}%`,
                      background: `linear-gradient(to right, ${palette.primary}, ${palette.secondary})`,
                      boxShadow: `0 0 12px ${palette.glow}`,
                    }}
                  />
                </div>
                <div
                  className={`absolute h-4 w-4 bg-white rounded-full transition-all ${isDraggingProgress ? 'opacity-100 scale-110' : 'opacity-0 group-hover:opacity-100'}`}
                  style={{
                    left: `calc(${displayPercent}% - 8px)`,
                    border: `2px solid ${palette.primary}`,
                    boxShadow: `0 0 12px ${palette.primary}`,
                  }}
                />
              </div>
              <span className="min-w-[36px] text-left">{formatTime(duration)}</span>
            </div>

            {/* Primary Transport Controls (Shuffle - Prev - Play/Pause - Next - Repeat) */}
            <div className="flex items-center justify-between px-2">
              {/* Shuffle */}
              <button
                onClick={() => setIsShuffle(prev => !prev)}
                className={`p-2.5 rounded-2xl transition-all duration-200 ${
                  isShuffle
                    ? 'text-primary bg-primary/10 border border-primary/25 shadow-[0_0_15px_rgba(0,245,255,0.25)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05] border border-transparent'
                }`}
                title={isShuffle ? "Shuffle On" : "Shuffle Off"}
              >
                <Shuffle size={20} />
              </button>

              {/* Skip Back */}
              <button
                aria-label="Previous track"
                onClick={playPrevious}
                disabled={!hasPrevious}
                className={`transition-all p-3 rounded-2xl hover:bg-white/[0.06] ${
                  hasPrevious ? 'text-slate-200 hover:text-white active:scale-95' : 'text-white/20 cursor-not-allowed'
                }`}
              >
                <SkipBack size={26} fill="currentColor" />
              </button>

              {/* Hero Play/Pause Button */}
              <button
                aria-label="Play or pause"
                onClick={togglePlay}
                disabled={isLoadingTrack}
                className={`w-16 h-16 rounded-full flex items-center justify-center text-slate-950 transition-all ${
                  isLoadingTrack 
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                    : 'hover:scale-105 active:scale-95 shadow-xl'
                }`}
                style={!isLoadingTrack ? {
                  backgroundColor: palette.primary,
                  boxShadow: `0 0 25px rgba(${palette.rgbPrimary}, 0.55), 0 0 50px rgba(${palette.rgbSecondary}, 0.3)`,
                } : undefined}
              >
                {isLoadingTrack ? (
                  <Loader2 size={28} className="animate-spin text-slate-400" />
                ) : isPlaying ? (
                  <Pause size={28} fill="currentColor" />
                ) : (
                  <Play size={28} fill="currentColor" className="ml-1" />
                )}
              </button>

              {/* Skip Forward */}
              <button
                aria-label="Next track"
                onClick={playNext}
                disabled={!hasNext}
                className={`transition-all p-3 rounded-2xl hover:bg-white/[0.06] ${
                  hasNext ? 'text-slate-200 hover:text-white active:scale-95' : 'text-white/20 cursor-not-allowed'
                }`}
              >
                <SkipForward size={26} fill="currentColor" />
              </button>

              {/* Repeat Button & Context Dropdown */}
              <div className="relative flex items-center" ref={repeatRef}>
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
                    onContextMenu={(e) => { e.preventDefault(); openRepeatMenu(); }}
                    className={`p-2.5 rounded-2xl transition-all duration-200 ${
                      (queueEndMode === 'repeat' || songEndMode === 'repeat_one')
                        ? 'text-primary bg-primary/10 border border-primary/25 shadow-[0_0_15px_rgba(0,245,255,0.25)]'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.05] border border-transparent'
                    }`}
                    title={songEndMode === 'repeat_one' ? t('bottomPlayer.repeatSong') : (queueEndMode === 'repeat' ? t('bottomPlayer.repeatQueue') : t('bottomPlayer.repeatOff'))}
                  >
                    {songEndMode === 'repeat_one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        if (songEndMode === 'next') setSongEndMode('repeat_one');
                        else if (songEndMode === 'repeat_one') setSongEndMode('preload');
                        else if (songEndMode === 'preload') setSongEndMode('stop');
                        else setSongEndMode('next');
                      }}
                      onContextMenu={(e) => { e.preventDefault(); openRepeatMenu(); }}
                      className={`p-2 rounded-xl transition-all ${
                        songEndMode !== 'next'
                          ? 'text-primary bg-primary/10 border border-primary/25 shadow-[0_0_15px_rgba(0,245,255,0.25)]'
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.05] border border-transparent'
                      }`}
                      title={
                        songEndMode === 'next' ? t('bottomPlayer.songNext') :
                        songEndMode === 'repeat_one' ? t('bottomPlayer.songRepeat') :
                        songEndMode === 'preload' ? t('bottomPlayer.songPreload') : t('bottomPlayer.songStop')
                      }
                    >
                      {(() => {
                        if (songEndMode === 'repeat_one') return <Repeat1 size={18} />;
                        if (songEndMode === 'stop') return <Square size={15} />;
                        if (songEndMode === 'preload') return <PauseCircle size={18} />;
                        return <ArrowRight size={18} />;
                      })()}
                    </button>
                    <button
                      onClick={() => {
                        if (queueEndMode === 'repeat') setQueueEndMode('next');
                        else if (queueEndMode === 'next') setQueueEndMode('stop');
                        else setQueueEndMode('repeat');
                      }}
                      onContextMenu={(e) => { e.preventDefault(); openRepeatMenu(); }}
                      className={`p-2 rounded-xl transition-all ${
                        queueEndMode !== 'stop'
                          ? 'text-primary bg-primary/10 border border-primary/25 shadow-[0_0_15px_rgba(0,245,255,0.25)]'
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.05] border border-transparent'
                      }`}
                      title={
                        queueEndMode === 'repeat' ? t('bottomPlayer.queueRepeat') :
                        queueEndMode === 'next' ? t('bottomPlayer.queueNext') : queueEndMode === 'stop' ? t('bottomPlayer.queueStop') : ''
                      }
                    >
                      {(() => {
                        if (queueEndMode === 'repeat') return <Repeat size={18} />;
                        if (queueEndMode === 'next') return <ListPlus size={18} />;
                        return <ListX size={18} />;
                      })()}
                    </button>
                  </div>
                )}

                {showRepeatMenu && (
                  <div className="fixed left-1/2 top-1/2 z-[120] flex max-h-[calc(100dvh_-_2rem)] w-80 max-w-[calc(100vw_-_2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c1626] shadow-2xl backdrop-blur-2xl">
                    {/* Tabs */}
                    <div className="flex shrink-0 border-b border-white/10">
                      <button
                        onClick={() => setRepeatMode('simple')}
                        className={`flex-1 py-3 text-xs font-bold transition-colors ${repeatMode === 'simple' ? 'text-primary border-b-2 border-primary bg-primary/10' : 'text-slate-400 hover:text-white'}`}
                      >{t('nowPlaying.simple')}</button>
                      <button
                        onClick={() => setRepeatMode('advanced')}
                        className={`flex-1 py-3 text-xs font-bold transition-colors ${repeatMode === 'advanced' ? 'text-primary border-b-2 border-primary bg-primary/10' : 'text-slate-400 hover:text-white'}`}
                      >{t('nowPlaying.advanced')}</button>
                    </div>

                    {/* Simple Tab */}
                    {repeatMode === 'simple' && (
                      <div className="overflow-y-auto p-1.5">
                        {([
                          { sMode: 'next' as SongEndMode, qMode: 'stop' as QueueEndMode, label: t('nowPlaying.playNext') },
                          { sMode: 'next' as SongEndMode, qMode: 'repeat' as QueueEndMode, label: t('nowPlaying.repeatQueue') },
                          { sMode: 'repeat_one' as SongEndMode, qMode: 'repeat' as QueueEndMode, label: t('nowPlaying.repeatSong') },
                        ] as { sMode: SongEndMode; qMode: QueueEndMode; label: string }[]).map(({ sMode, qMode, label }) => {
                          const isActive = songEndModeTemp === sMode && queueEndModeTemp === qMode;
                          return (
                            <button
                              key={label}
                              onClick={() => {
                                setSongEndModeTemp(sMode);
                                setQueueEndModeTemp(qMode);
                              }}
                              className={`w-full flex items-center gap-3.5 px-3.5 py-3 text-xs rounded-xl transition-all ${isActive ? 'bg-primary/15 text-primary font-semibold border border-primary/25' : 'text-slate-300 hover:bg-white/[0.04]'}`}
                            >
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isActive ? 'border-primary' : 'border-slate-500'}`}>
                                {isActive && <div className="w-2 h-2 rounded-full bg-primary" />}
                              </div>
                              <span>{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Advanced Tab */}
                    {repeatMode === 'advanced' && (
                      <div className="divide-y divide-white/5 overflow-y-auto p-2">
                        <div className="px-2 py-2">
                          <p className="text-[10px] font-mono font-bold text-primary uppercase tracking-wider mb-2">{t('nowPlaying.whenSongEnds')}</p>
                          {([
                            { val: 'stop' as SongEndMode, label: t('nowPlaying.stopPlayback') },
                            { val: 'preload' as SongEndMode, label: t('nowPlaying.preloadNext') },
                            { val: 'next' as SongEndMode, label: t('nowPlaying.playNext') },
                            { val: 'repeat_one' as SongEndMode, label: t('nowPlaying.repeatSong') },
                          ]).map(({ val, label }) => (
                            <button key={val} onClick={() => setSongEndModeTemp(val)}
                              className={`w-full flex items-center gap-3 py-2 text-xs rounded-lg px-2 transition-colors ${songEndModeTemp === val ? 'text-primary font-semibold bg-primary/10' : 'text-slate-400 hover:text-white'}`}>
                              <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${songEndModeTemp === val ? 'border-primary' : 'border-slate-500'}`}>
                                {songEndModeTemp === val && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                              </div>
                              <span>{label}</span>
                            </button>
                          ))}
                        </div>
                        <div className="px-2 py-2">
                          <p className="text-[10px] font-mono font-bold text-primary uppercase tracking-wider mb-2">{t('nowPlaying.whenQueueEnds')}</p>
                          {([
                            { val: 'stop' as QueueEndMode, label: t('nowPlaying.stopPlayback') },
                            { val: 'next' as QueueEndMode, label: t('nowPlaying.switchToNextQueue') },
                            { val: 'repeat' as QueueEndMode, label: t('nowPlaying.repeatQueue') },
                          ]).map(({ val, label }) => (
                            <div key={val}>
                              <button onClick={() => setQueueEndModeTemp(val)}
                                className={`w-full flex items-center gap-3 py-2 text-xs rounded-lg px-2 ${queueEndModeTemp === val ? 'text-primary font-semibold bg-primary/10' : 'text-slate-400 hover:text-white'}`}>
                                <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${queueEndModeTemp === val ? 'border-primary' : 'border-slate-500'}`}>
                                  {queueEndModeTemp === val && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                                </div>
                                <span>{label}</span>
                              </button>

                              {/* Sub-options when 'next' is selected */}
                              {val === 'next' && queueEndModeTemp === 'next' && (
                                <div className="ml-6 mt-1 mb-2 flex flex-col gap-2">
                                  <label className="flex items-start gap-2.5 cursor-pointer group">
                                    <input
                                      type="checkbox"
                                      checked={cycleQueues}
                                      onChange={e => setCycleQueues(e.target.checked)}
                                      className="mt-0.5 accent-primary w-3.5 h-3.5 cursor-pointer flex-shrink-0"
                                    />
                                    <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">
                                      {t('nowPlaying.cycleQueues')}
                                    </span>
                                  </label>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bottom Action Buttons */}
                    <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/10 p-2.5 bg-[#09101d]">
                      <button onClick={confirmRepeat} className="px-4 py-1.5 flex items-center justify-center rounded-xl bg-primary text-slate-950 font-bold text-xs shadow-md transition-colors hover:brightness-110">
                        <Check size={15} className="mr-1" /> Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Secondary Feature Dock */}
            <div className="flex items-center justify-between p-2 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl shadow-lg">
              {/* Volume */}
              <div className="relative" ref={volumeRef}>
                <button
                  aria-label="Volume"
                  onClick={() => setShowVolume(v => !v)}
                  className={`transition-all p-2.5 rounded-xl ${
                    showVolume
                      ? 'text-primary bg-primary/15 border border-primary/25 shadow-[0_0_12px_rgba(0,245,255,0.2)]'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                  }`}
                  title="Volume"
                >
                  {volume === 0 ? <VolumeX size={18} className="text-red-400" /> : <Volume2 size={18} />}
                </button>

                {showVolume && (
                  <div className="absolute bottom-full left-0 mb-3 bg-[#0c1626] border border-white/10 p-4 rounded-2xl shadow-2xl z-50 w-44 backdrop-blur-2xl">
                    <HorizontalSlider
                      value={Math.round(volume * 100)}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(val) => setVolume(val / 100)}
                      label="Volume"
                      color={palette.primary}
                      unit="%"
                    />
                  </div>
                )}
              </div>

              {/* Lyrics Button */}
              {hasLyrics && (
                <button
                  onClick={() => setShowLyrics(!showLyrics)}
                  className={`transition-all p-2.5 rounded-xl flex items-center gap-1.5 ${
                    showLyrics
                      ? 'text-primary bg-primary/15 border border-primary/25 shadow-[0_0_12px_rgba(0,245,255,0.2)]'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                  }`}
                  title={showLyrics ? 'Show Disc' : t('nowPlaying.viewLyrics')}
                >
                  <Music size={18} />
                  <span className="text-xs font-semibold hidden sm:inline">Lyrics</span>
                </button>
              )}

              {/* Visualizer Mode Toggle */}
              <button
                onClick={() => setVisualizerMode(m => m === 'off' ? 'mirror' : m === 'mirror' ? 'bars' : m === 'bars' ? 'wave' : 'off')}
                className={`transition-all p-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer ${
                  visualizerMode !== 'off'
                    ? 'text-primary bg-primary/15 border border-primary/25 shadow-[0_0_12px_rgba(0,245,255,0.2)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                }`}
                title={`Visualizer: ${visualizerMode === 'off' ? 'Off (Bấm để bật)' : visualizerMode.toUpperCase()}`}
                aria-label={`Visualizer: ${visualizerMode.toUpperCase()}`}
              >
                <Activity size={18} />
                <span className="hidden sm:inline uppercase text-[10px] font-mono">{visualizerMode}</span>
              </button>

              {/* Studio & EQ DSP */}
              <button
                aria-label="EQ and tone settings"
                onClick={() => navigate('/studio')}
                className="text-slate-400 hover:text-primary transition-all p-2.5 rounded-xl hover:bg-white/[0.05]"
                title="EQ & Studio DSP"
              >
                <BarChart2 size={18} />
              </button>

              {/* Sleep Timer */}
              <button
                onClick={openSleepTimerModal}
                className={`transition-all p-2.5 rounded-xl flex items-center gap-1.5 ${
                  sleepTimerState.isActive
                    ? 'text-primary bg-primary/15 border border-primary/25 shadow-[0_0_12px_rgba(0,245,255,0.25)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                }`}
                title={t('sleepTimer.title', 'Sleep Timer')}
                aria-label={t('sleepTimer.title', 'Sleep Timer')}
              >
                <Moon size={18} className={sleepTimerState.isActive ? 'text-primary animate-pulse' : ''} />
                {sleepTimerState.isActive && (
                  <span className="text-[10px] font-mono font-bold text-primary">
                    {sleepTimerState.mode === 'time'
                      ? formatTime(sleepTimerState.remainingSeconds)
                      : 'Track'}
                  </span>
                )}
              </button>

              {/* More Options (...) Button */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(v => !v)}
                  className={`transition-all p-2.5 rounded-xl ${
                    showMenu
                      ? 'text-primary bg-primary/15 border border-primary/25 shadow-[0_0_12px_rgba(0,245,255,0.2)]'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                  }`}
                  title="More Options"
                >
                  <MoreHorizontal size={18} />
                </button>
                {showMenu && (
                  <div className="absolute bottom-full right-0 mb-3 w-72 max-w-[calc(100vw_-_2rem)] bg-[#0c1626] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 backdrop-blur-2xl">
                    {showSpeedPitch ? (
                      <SpeedPitchPanel
                        playbackRate={playbackRate}
                        updatePlaybackRate={updatePlaybackRate}
                        preservesPitch={preservesPitch}
                        togglePreservesPitch={togglePreservesPitch}
                        pitchRate={pitchRate}
                        updatePitchRate={updatePitchRate}
                        speedPitchMode={speedPitchMode}
                        setSpeedPitchMode={setSpeedPitchMode}
                        speedPitchScope={speedPitchScope}
                        setSpeedPitchScope={setSpeedPitchScope}
                        precalculateOnIdle={playerState.precalculateOnIdle}
                        currentTrackId={currentTrack?.id ? String(currentTrack.id) : undefined}
                        t={t}
                        onBack={() => setShowSpeedPitch(false)}
                      />
                    ) : showDeviceMenu ? (
                      <div className="flex flex-col max-h-[65vh] overflow-y-auto">
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 sticky top-0 bg-[#0c1626] z-10">
                          <button onClick={() => setShowDeviceMenu(false)} className="hover:bg-white/10 p-1.5 -ml-1.5 rounded-lg transition-colors">
                            <ArrowRight size={16} className="rotate-180 text-white/80" />
                          </button>
                          <span className="text-sm font-bold text-white/90">{t('nowPlaying.outputDevice') || 'Output Device'}</span>
                        </div>
                        
                        {!hasDeviceLabels && (
                          <div className="p-4 border-b border-white/5">
                            <p className="text-xs text-slate-400 mb-3 leading-tight">
                              {t('nowPlaying.devicePermissionReason') || 'Trình duyệt ẩn tên thiết bị cho đến khi bạn cấp quyền Audio.'}
                            </p>
                            <button
                              onClick={requestAudioPermission}
                              className="w-full text-xs font-semibold bg-primary/20 text-primary py-2 rounded-lg hover:bg-primary/30 transition-colors"
                            >
                              {t('nowPlaying.grantPermission') || 'Hiện tên thiết bị'}
                            </button>
                          </div>
                        )}

                        {audioDevices.length > 0 ? audioDevices.map(device => (
                          <button
                            key={device.deviceId || 'default'}
                            onClick={() => {
                              const id = device.deviceId || '';
                              setSelectedDeviceId(id);
                              if (playerState.setAudioOutputDevice) {
                                playerState.setAudioOutputDevice(id);
                              }
                            }}
                            className={`w-full text-left px-4 py-3 text-xs font-medium transition-colors flex items-center justify-between border-b border-white/[0.04] ${selectedDeviceId === (device.deviceId || '') ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-300 hover:bg-white/[0.05]'}`}
                          >
                            <span className="truncate pr-2">{device.label || `Device (${device.deviceId ? device.deviceId.slice(0, 5) : 'default'}...)`}</span>
                            {selectedDeviceId === (device.deviceId || '') && <Check size={14} className="flex-shrink-0 text-primary" />}
                          </button>
                        )) : (
                          <p className="text-xs text-slate-500 px-4 py-4 text-center">No devices found</p>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Track Info */}
                        <button
                          onClick={() => {
                            setShowMetadata(true);
                            setShowMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-xs font-medium text-slate-300 hover:bg-white/[0.05] transition-colors border-b border-white/[0.04]"
                        >
                          <Info size={16} className="text-primary" />
                          <span>{t('bottomPlayer.trackMetadata', 'Thông tin bài hát')}</span>
                        </button>

                        {/* Speed & Pitch Button */}
                        <button
                          onClick={() => setShowSpeedPitch(true)}
                          className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-slate-300 hover:bg-white/[0.05] transition-colors border-b border-white/[0.04]"
                        >
                          <div className="flex items-center gap-3">
                            <Gauge size={16} className={playbackRate !== 1 || (speedPitchMode === 'advanced' && pitchRate !== 1) ? 'text-primary' : 'text-slate-400'} />
                            <span>{t('nowPlaying.speedAndPitch')}</span>
                          </div>
                          <span className="text-[10px] font-mono text-primary">
                            {speedPitchMode === 'advanced' && pitchRate !== 1
                              ? `${playbackRate}x / ${pitchRate}x`
                              : `${playbackRate}x`
                            }
                          </span>
                        </button>

                        {/* Output Device Button */}
                        <button
                          onClick={() => setShowDeviceMenu(true)}
                          className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-slate-300 hover:bg-white/[0.05] transition-colors border-b border-white/[0.04]"
                        >
                          <div className="flex items-center gap-3">
                            <MonitorSpeaker size={16} className="text-slate-400" />
                            <span>{t('nowPlaying.outputDevice') || 'Output Device'}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 truncate max-w-[80px]">
                            {audioDevices.find(d => d.deviceId === selectedDeviceId)?.label || 'Default'}
                          </span>
                        </button>

                        {currentTrack && currentTrack.sourceType !== 'LOCAL' && (
                          <button
                            onClick={() => {
                              downloadTrackFile(currentTrack);
                              setShowMenu(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-xs font-medium text-slate-300 hover:bg-white/[0.05] transition-colors border-b border-white/[0.04]"
                            title="Tải file âm thanh về thiết bị"
                          >
                            <Download size={16} className="text-slate-400" />
                            <span>{t('tracks.downloadFile', 'Download File')}</span>
                          </button>
                        )}

                        {!isOfflineMode && currentTrack && currentTrack.sourceType !== 'LOCAL' && (
                          <button
                            onClick={async () => {
                              if (!isCached(currentTrack) && !downloadingTrackIds.has(String(currentTrack.id))) {
                                await downloadTrack(currentTrack);
                              }
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-xs font-medium text-slate-300 hover:bg-white/[0.05] transition-colors border-b border-white/[0.04]"
                            title="Lưu vào bộ nhớ đệm trình duyệt để nghe khi offline"
                          >
                            {(() => {
                              if (isCached(currentTrack)) return <CheckCircle2 size={16} className="text-green-400" />;
                              if (downloadingTrackIds.has(String(currentTrack.id))) return <Loader2 size={16} className="animate-spin text-primary" />;
                              return <DownloadCloud size={16} className="text-blue-400" />;
                            })()}
                            <span>
                              {isCached(currentTrack) ? t('offline.downloaded', 'Saved (Offline)') : (downloadingTrackIds.has(String(currentTrack.id)) ? t('offline.downloading', 'Saving Offline...') : t('offline.downloadTrack', 'Save for Offline'))}
                            </span>
                          </button>
                        )}

                        {getAudioExtension(currentTrack.fileName) === 'flac' && (
                          <button
                            onClick={() => {
                              playerState.toggleFlacWasmForTrack(currentTrack);
                              setShowMenu(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-xs font-medium text-slate-300 hover:bg-white/[0.05] transition-colors border-b border-white/[0.04]"
                          >
                            <Cpu size={16} className={playerState.isFlacWasmEnabled(currentTrack) ? 'text-primary' : 'text-slate-400'} />
                            <span>{playerState.isFlacWasmEnabled(currentTrack) ? 'Use Normal FLAC' : 'Use FLAC WASM'}</span>
                          </button>
                        )}

                        {(getAudioExtension(currentTrack.fileName) === 'm4a' || getAudioExtension(currentTrack.fileName) === 'aac') && (
                          <button
                            onClick={async () => {
                              playerState.toggleM4aWasmForTrack(currentTrack);
                              setShowMenu(false);
                              if (currentTrack.sourceType !== 'LOCAL') {
                                await playerState.reloadCurrentTrackFromDrive();
                              }
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-xs font-medium text-slate-300 hover:bg-white/[0.05] transition-colors border-b border-white/[0.04]"
                          >
                            <Cpu size={16} className={playerState.isM4aWasmEnabled(currentTrack) ? 'text-primary' : 'text-slate-400'} />
                            <span>{playerState.isM4aWasmEnabled(currentTrack) ? 'Use Normal M4A' : 'Use M4A WASM'}</span>
                          </button>
                        )}



                        {currentTrack.sourceType !== 'LOCAL' && (
                          <button
                            onClick={async () => {
                              setShowMenu(false);
                              await playerState.reloadCurrentTrackFromDrive();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-xs font-medium text-slate-300 hover:bg-white/[0.05] transition-colors border-b border-white/[0.04]"
                          >
                            <RefreshCw size={16} className="text-slate-400" />
                            <span>{t('nowPlaying.reloadFromDrive')}</span>
                          </button>
                        )}

                        {currentTrack.sourceType !== 'LOCAL' && (
                          <button
                            onClick={async () => {
                              const isConfirmed = await confirm({
                                title: 'Xóa bài hát',
                                description: `Bạn có chắc chắn muốn xóa bài hát "${currentTrack.title || currentTrack.fileName}" khỏi thư viện?`,
                                confirmText: 'Xóa',
                                confirmColor: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30'
                              });
                              if (isConfirmed) {
                                const isConfirmed2 = await confirm({
                                  title: 'Xác nhận xóa vĩnh viễn',
                                  description: `Hành động này sẽ xóa vĩnh viễn bài hát "${currentTrack.title || currentTrack.fileName}" từ Google Drive của bạn và không thể hoàn tác. Bạn vẫn muốn tiếp tục?`,
                                  confirmText: 'Xóa vĩnh viễn',
                                  confirmColor: 'bg-red-600 text-white hover:bg-red-700 border-red-600'
                                });
                                if (isConfirmed2) {
                                  setShowMenu(false);
                                  await deleteTrack(currentTrack);
                                }
                              }
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors border-t border-white/[0.04]"
                          >
                            <Trash2 size={16} />
                            <span>Delete from Library</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* Right Side: Playlist / Up Next */}
        <div className="hidden lg:block lg:w-[380px] xl:w-[420px] flex-shrink-0">
          <div className="w-full bg-[#0c1626]/70 rounded-2xl p-4 md:p-5 border border-white/[0.08] backdrop-blur-xl h-full max-h-[65vh] lg:max-h-[80vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.06]">
              <div className="font-bold text-sm text-white flex items-center gap-2">
                <ListPlus size={16} className="text-primary" />
                <span>{t('player.upNext')}</span>
              </div>
              <span className="text-xs font-mono text-slate-400">{playerState.queue.length} songs</span>
            </div>

            <div ref={queueContainerRef} id="nowplaying-queue-container" className="flex flex-col gap-2 overflow-y-auto pr-1 relative flex-1 no-scrollbar">
              {playerState.queue.map((track) => {
                const isActive = String(currentTrack?.id) === String(track.id);
                return (
                  <div
                    key={track.id}
                    ref={isActive ? activeQueueTrackRef : undefined}
                    id={isActive ? 'nowplaying-current-track' : undefined}
                    onClick={() => playerState.playTrack(track, playerState.queue)}
                    className={`group flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                      isActive
                        ? 'bg-primary/15 border border-primary/30 text-primary shadow-[inset_0_0_12px_rgba(0,245,255,0.1)]'
                        : 'bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04]'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-lg bg-slate-800 bg-cover bg-center flex-shrink-0 shadow flex items-center justify-center overflow-hidden relative"
                      style={(track.imageUrl || playerState.getTrackImage(track.id)) ? { backgroundImage: `url(${track.imageUrl || playerState.getTrackImage(track.id)})` } : {}}
                    >
                      {!(track.imageUrl || playerState.getTrackImage(track.id)) && <Music size={16} className="text-slate-500" />}
                      {isActive && (
                        <div className="absolute inset-0 bg-primary/25 flex items-center justify-center">
                          <div className="flex items-end gap-0.5 h-3">
                            <span className="w-0.5 bg-primary rounded-full animate-eq-1" />
                            <span className="w-0.5 bg-primary rounded-full animate-eq-2" />
                            <span className="w-0.5 bg-primary rounded-full animate-eq-3" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${isActive ? 'text-primary' : 'text-slate-200'}`}>
                        {track.title || playerState.getTrackMetadata(track.id)?.title || (track.fileName ? (track.fileName.includes(' - ') ? track.fileName.split(' - ')[1].replace(/\.[^/.]+$/, "") : track.fileName.replace(/\.[^/.]+$/, "")) : 'Unknown Title')}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5 font-mono">
                        {track.artist || playerState.getTrackMetadata(track.id)?.artist || (track.fileName?.includes(' - ') ? track.fileName.split(' - ')[0] : 'Unknown Artist')}
                      </p>
                    </div>
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mr-1 shadow-[0_0_8px_rgba(0,245,255,0.8)]" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* Metadata Modal */}
      {showMetadata && currentTrack && (
        <TrackInfoModal
          track={currentTrack}
          trackMetadata={playerState.getTrackMetadata(currentTrack.id)}
          onClose={() => setShowMetadata(false)}
        />
      )}
    </div>
  );
}
