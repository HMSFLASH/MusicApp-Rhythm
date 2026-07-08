import { useState, useRef, useEffect } from 'react';
import { useGlobalAudio } from '../context/AudioContext'
import { useAuth } from '../context/AuthContext';;
import { Disc, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart, Info, ListPlus, MoreHorizontal, Repeat1, User, Volume2, VolumeX, BarChart2, Gauge, Music, Check, X, ArrowRight, Square, PauseCircle, ListX, Loader2 } from 'lucide-react';
import { HorizontalSlider } from '../components/HorizontalSlider';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { axiosClient } from '../api/axiosClient';

const formatTime = (time: number) => {
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export function NowPlaying() {
  const { t } = useTranslation();
  const { jwtToken } = useAuth();
  const { playerState } = useGlobalAudio();
  const navigate = useNavigate();
  const {
    isPlaying, isLoadingTrack, currentTrack, currentTime, duration,
    togglePlay, seek, playNext, playPrevious,
    playbackRate, updatePlaybackRate, preservesPitch, togglePreservesPitch,
    isShuffle, setIsShuffle, songEndMode, setSongEndMode, queueEndMode, setQueueEndMode,
    repeatMode, setRepeatMode,
    volume, setVolume,
    cycleQueues, setCycleQueues,
    hasNext, hasPrevious
  } = playerState;
  const currentArtwork = currentTrack ? (currentTrack.imageUrl || playerState.getTrackImage(currentTrack.id)) : '';

  useEffect(() => {
    if (currentTrack) {
      const el = document.getElementById('nowplaying-current-track');
      const container = document.getElementById('nowplaying-queue-container');
      if (el && container) {
        container.scrollTo({
          top: el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2,
          behavior: 'smooth'
        });
      }
    }
  }, [currentTrack]);

  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    if (currentTrack?.id && jwtToken && currentTrack.sourceType !== 'LOCAL') {
      axiosClient.get(`/api/favorites/check/${currentTrack.id}`)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((res: any) => setIsFavorite(res === true || res.data === true))
        .catch(() => setIsFavorite(false));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsFavorite(false);
    }
  }, [currentTrack?.id, currentTrack?.sourceType, jwtToken]);

  const toggleFavorite = () => {
    if (!currentTrack?.id || !jwtToken || currentTrack.sourceType === 'LOCAL') return;
    
    if (isFavorite) {
      axiosClient.delete(`/api/favorites/${currentTrack.id}`)
        .then(() => setIsFavorite(false))
        .catch(console.error);
    } else {
      axiosClient.post(`/api/favorites/${currentTrack.id}`)
        .then(() => setIsFavorite(true))
        .catch(console.error);
    }
  };


  // F8 scroll effect state
  const [cdSize, setCdSize] = useState(288);
  const [cdOpacity, setCdOpacity] = useState(1);

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
  const menuRef = useRef<HTMLDivElement>(null);
  // Volume menu state
  const [showVolume, setShowVolume] = useState(false);
  const volumeRef = useRef<HTMLDivElement>(null);

  // Metadata Modal state
  const [showMetadata, setShowMetadata] = useState(false);

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

  if (!currentTrack) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-8 max-w-2xl mx-auto w-full">
        {/* Demo album art */}
        <div className="relative flex items-center justify-center w-56 h-56 rounded-full border-2 border-white/5 shadow-2xl">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#111] to-[#333]"></div>
          <div className="absolute inset-2 rounded-full border border-black/40"></div>
          <div className="absolute inset-6 rounded-full border border-black/30"></div>
          <div className="absolute inset-10 rounded-full border border-black/20"></div>
          <div className="relative z-10 w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center border-4 border-[#111]">
            <Disc size={20} className="text-primary" />
          </div>
          <div className="absolute z-20 w-3 h-3 bg-background rounded-full"></div>
        </div>
        <div className="text-center">
          <p className="text-white font-semibold text-lg">{t('nowPlaying.noTrack')}</p>
          <p className="text-white/30 text-xs mt-3">{t('nowPlaying.noTrackDesc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto w-full no-scrollbar" onScroll={handleScroll}>
      <div className="flex flex-col lg:flex-row items-start justify-center max-w-6xl mx-auto w-full gap-8 md:gap-12 py-6 md:py-10 px-4 md:px-8 pb-32">

        {/* Left Side: Player */}
        <div className="flex-1 flex flex-col items-center w-full max-w-lg mx-auto gap-8 pt-8">
          {/* Album Art / Big Vinyl Record Wrapper */}
          <div
            className="flex-shrink-0 flex items-center justify-center transition-opacity duration-0"
            style={{ width: cdSize, height: cdSize, opacity: cdOpacity }}
          >
            {currentArtwork ? (
              <div
                className={`relative flex items-center justify-center w-full h-full rounded-full shadow-[0_0_40px_rgba(0,0,0,0.5)] border-[8px] border-[#111] overflow-hidden mb-4 ${isPlaying ? 'scale-100 opacity-100' : 'scale-90 opacity-60'}`}
                style={{ transition: 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.7s ease' }}
              >
                <div ref={discRef1} className="w-full h-full">
                  <img src={currentArtwork} alt="Album Art" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/10"></div>
                  {/* Center hole */}
                  <div className="absolute z-20 w-[8%] h-[8%] bg-background rounded-full border-2 border-black/40 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
                </div>
              </div>
            ) : (
              <div
                className={`relative flex items-center justify-center w-full h-full rounded-full border-2 border-white/5 shadow-2xl ${isPlaying ? 'scale-100 opacity-100' : 'scale-90 opacity-60'}`}
                style={{ transition: 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.7s ease' }}
              >
                <div ref={discRef2} className="w-full h-full">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#111] to-[#333]"></div>
                  {/* Vinyl grooves */}
                  <div className="absolute inset-2 rounded-full border border-black/40"></div>
                  <div className="absolute inset-6 rounded-full border border-black/30"></div>
                  <div className="absolute inset-10 rounded-full border border-black/20"></div>
                  <div className="absolute inset-14 rounded-full border border-black/10"></div>

                  {/* Center Label */}
                  <div className="absolute z-10 w-1/3 h-1/3 bg-primary/20 rounded-full flex items-center justify-center border-4 border-[#111] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <Disc size={32} className="text-primary" />
                  </div>

                  {/* Inner hole */}
                  <div className="absolute z-20 w-4 h-4 bg-background rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
                </div>
              </div>
            )}
          </div>

          <div className="text-center px-4 w-full">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 truncate">{currentTrack.title || playerState.getTrackMetadata(currentTrack.id)?.title || (currentTrack.fileName ? (currentTrack.fileName.includes(' - ') ? currentTrack.fileName.split(' - ')[1].replace(/\.[^/.]+$/, "") : currentTrack.fileName.replace(/\.[^/.]+$/, "")) : 'Unknown Title')}</h2>
            <div className="flex items-center justify-center gap-2 text-base md:text-lg text-white/50 truncate w-full">
              <User size={16} className="flex-shrink-0" />
              <span className="truncate">{currentTrack.artist || playerState.getTrackMetadata(currentTrack.id)?.artist || (currentTrack.fileName?.includes(' - ') ? currentTrack.fileName.split(' - ')[0] : t('bottomPlayer.unknown'))}</span>
            </div>
          </div>

          {/* Playback Controls (Play/Pause, Skip, Progress) */}
          <div className="w-full max-w-md mt-2">

            {/* Top Action Bar */}
            <div className="flex items-center justify-between px-2 mb-8 text-white/60">
              <button 
                onClick={toggleFavorite}
                className={`
                  ${isFavorite ? 'text-primary drop-shadow-[0_0_12px_var(--tw-colors-primary)] scale-110' : 'text-white/40 hover:text-white'} 
                  transition-all duration-300 p-2 -ml-2 rounded-full
                  active:scale-95
                `}
                aria-label={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
              >
                <Heart size={24} fill={isFavorite ? "currentColor" : "none"} className={`transition-all duration-300`} />
              </button>
              <button onClick={() => setShowMetadata(true)} className="hover:text-white transition-colors"><Info size={22} /></button>
              {/* More Options (...) Button */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(v => !v)}
                  className={`hover:text-white transition-colors p-1 rounded-full ${showMenu ? 'text-white bg-white/10' : ''}`}
                >
                  <MoreHorizontal size={22} />
                </button>
                {showMenu && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="text-xs text-white/40 font-medium uppercase tracking-wider">{t('nowPlaying.options')}</p>
                    </div>
                    {/* Tempo Control */}
                    <div className="px-4 py-4 border-b border-white/5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-white">
                          <Gauge size={16} className="text-primary" />
                          <span className="text-sm font-semibold">{t('nowPlaying.playbackSpeed')}</span>
                        </div>
                        <button
                          onClick={togglePreservesPitch}
                          className={`text-[10px] font-mono px-2 py-1 rounded-full border transition-all ${preservesPitch
                            ? 'bg-primary/20 text-primary border-primary/50'
                            : 'bg-white/10 text-white/50 border-white/20'
                            }`}
                        >
                          {preservesPitch ? t('nowPlaying.preservePitch') : t('nowPlaying.vinyl')}
                        </button>
                      </div>
                      <HorizontalSlider
                        value={playbackRate}
                        min={0.5}
                        max={2.0}
                        step={0.05}
                        onChange={updatePlaybackRate}
                        label={t('nowPlaying.tempo')}
                        color="#00f5ff"
                        unit="x"
                      />
                    </div>
                    {/* Other menu items */}
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors">
                      <Music size={16} />
                      <span>{t('nowPlaying.viewLyrics')}</span>
                    </button>

                  </div>
                )}
              </div>

              <div className="relative flex items-center gap-2" ref={repeatRef}>
                {repeatMode === 'simple' ? (
                  <div className="flex items-center">
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
                      className={`hover:scale-105 transition-transform ${(queueEndMode === 'repeat' || songEndMode === 'repeat_one') ? 'text-primary' : 'text-white/40 hover:text-white'}`}
                      title={songEndMode === 'repeat_one' ? t('bottomPlayer.repeatSong') : queueEndMode === 'repeat' ? t('bottomPlayer.repeatQueue') : t('bottomPlayer.repeatOff')}
                    >
                      {songEndMode === 'repeat_one' ? <Repeat1 size={22} /> : <Repeat size={22} />}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center">
                      <button
                        onClick={() => {
                          if (songEndMode === 'next') setSongEndMode('repeat_one');
                          else if (songEndMode === 'repeat_one') setSongEndMode('preload');
                          else if (songEndMode === 'preload') setSongEndMode('stop');
                          else setSongEndMode('next');
                        }}
                        onContextMenu={(e) => { e.preventDefault(); openRepeatMenu(); }}
                        className={`hover:scale-105 transition-transform ${songEndMode !== 'next' ? 'text-primary' : 'text-white/40 hover:text-white'
                          }`}
                        title={songEndMode === 'next' ? t('bottomPlayer.songNext') : songEndMode === 'repeat_one' ? t('bottomPlayer.songRepeat') : songEndMode === 'preload' ? t('bottomPlayer.songPreload') : t('bottomPlayer.songStop')}
                      >
                        {songEndMode === 'repeat_one' ? <Repeat1 size={22} /> : songEndMode === 'stop' ? <Square size={18} /> : songEndMode === 'preload' ? <PauseCircle size={22} /> : <ArrowRight size={22} />}
                      </button>
                    </div>
                    <div className="flex items-center">
                      <button
                        onClick={() => {
                          if (queueEndMode === 'repeat') setQueueEndMode('next');
                          else if (queueEndMode === 'next') setQueueEndMode('stop');
                          else setQueueEndMode('repeat');
                        }}
                        onContextMenu={(e) => { e.preventDefault(); openRepeatMenu(); }}
                        className={`hover:scale-105 transition-transform ${queueEndMode !== 'stop' ? 'text-primary' : 'text-white/40 hover:text-white'
                          }`}
                        title={queueEndMode === 'repeat' ? t('bottomPlayer.queueRepeat') : queueEndMode === 'next' ? t('bottomPlayer.queueNext') : t('bottomPlayer.queueStop')}
                      >
                        {queueEndMode === 'repeat' ? <Repeat size={22} /> : queueEndMode === 'next' ? <ListPlus size={22} /> : <ListX size={22} />}
                      </button>
                    </div>
                  </>
                )}

                {showRepeatMenu && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-80 bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                    {/* Tabs */}
                    <div className="flex border-b border-white/10">
                      <button
                        onClick={() => setRepeatMode('simple')}
                        className={`flex-1 py-3 text-sm font-semibold transition-colors rounded-tl-2xl ${repeatMode === 'simple' ? 'text-white border-b-2 border-primary' : 'text-white/40 hover:text-white/70'
                          }`}
                      >{t('nowPlaying.simple')}</button>
                      <button
                        onClick={() => setRepeatMode('advanced')}
                        className={`flex-1 py-3 text-sm font-semibold transition-colors rounded-tr-2xl ${repeatMode === 'advanced' ? 'text-white border-b-2 border-primary' : 'text-white/40 hover:text-white/70'
                          }`}
                      >{t('nowPlaying.advanced')}</button>
                    </div>

                    {/* Simple Tab */}
                    {repeatMode === 'simple' && (
                      <div>
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
                              className={`w-full flex items-center gap-4 px-4 py-3.5 text-sm transition-colors hover:bg-white/5 ${isActive ? 'text-white font-semibold' : 'text-white/50'
                                }`}
                            >
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isActive ? 'border-primary' : 'border-white/30'
                                }`}>
                                {isActive && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                              </div>
                              <span>{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Advanced Tab */}
                    {repeatMode === 'advanced' && (
                      <div className="divide-y divide-white/5">
                        <div className="px-4 py-3">
                          <p className="text-xs font-bold text-primary uppercase tracking-wider mb-3">{t('nowPlaying.whenSongEnds')}</p>
                          {([
                            { val: 'stop' as SongEndMode, label: t('nowPlaying.stopPlayback') },
                            { val: 'preload' as SongEndMode, label: t('nowPlaying.preloadNext') },
                            { val: 'next' as SongEndMode, label: t('nowPlaying.playNext') },
                            { val: 'repeat_one' as SongEndMode, label: t('nowPlaying.repeatSong') },
                          ]).map(({ val, label }) => (
                            <button key={val} onClick={() => setSongEndModeTemp(val)}
                              className={`w-full flex items-center gap-3 py-2.5 text-sm transition-colors ${songEndModeTemp === val ? 'text-white font-semibold' : 'text-white/40 hover:text-white/70'
                                }`}>
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${songEndModeTemp === val ? 'border-primary' : 'border-white/30'
                                }`}>
                                {songEndModeTemp === val && <div className="w-2 h-2 rounded-full bg-primary" />}
                              </div>
                              <span>{label}</span>
                            </button>
                          ))}
                        </div>
                        <div className="px-4 py-3">
                          <p className="text-xs font-bold text-primary uppercase tracking-wider mb-3">{t('nowPlaying.whenQueueEnds')}</p>
                          {([
                            { val: 'stop' as QueueEndMode, label: t('nowPlaying.stopPlayback') },
                            { val: 'next' as QueueEndMode, label: t('nowPlaying.switchToNextQueue') },
                            { val: 'repeat' as QueueEndMode, label: t('nowPlaying.repeatQueue') },
                          ]).map(({ val, label }) => (
                            <div key={val}>
                              <button onClick={() => setQueueEndModeTemp(val)}
                                className={`w-full flex items-center gap-3 py-2 text-sm ${queueEndModeTemp === val ? 'text-white font-semibold' : 'text-white/40 hover:text-white/70'
                                  }`}>
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${queueEndModeTemp === val ? 'border-primary' : 'border-white/30'
                                  }`}>
                                  {queueEndModeTemp === val && <div className="w-2 h-2 rounded-full bg-primary" />}
                                </div>
                                <span>{label}</span>
                              </button>

                              {/* Sub-options when 'next' is selected */}
                              {val === 'next' && queueEndModeTemp === 'next' && (
                                <div className="ml-7 mt-1 mb-2 flex flex-col gap-2">

                                  <label className="flex items-start gap-2.5 cursor-pointer group">
                                    <input
                                      type="checkbox"
                                      checked={cycleQueues}
                                      onChange={e => setCycleQueues(e.target.checked)}
                                      className="mt-0.5 accent-primary w-3.5 h-3.5 cursor-pointer flex-shrink-0"
                                    />
                                    <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">
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
                    <div className="flex items-center justify-end border-t border-white/10 p-2 gap-2">
                      <button onClick={confirmRepeat} className="w-9 h-9 flex items-center justify-center rounded-xl bg-primary/80 hover:bg-primary text-white transition-colors">
                        <Check size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsShuffle(prev => !prev)}
                className={`${isShuffle ? 'text-primary' : 'text-white/40 hover:text-white'} transition-colors`}
                title={isShuffle ? "Shuffle On" : "Shuffle Off"}
              >
                <Shuffle size={22} />
              </button>
            </div>

            <div className="flex items-center gap-4 font-mono text-sm font-bold text-white/90 mb-8">
              <span className="min-w-[40px] text-right">{formatTime(currentTime)}</span>
              <div className="flex-1 relative flex items-center group h-6 cursor-pointer" onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                if (duration) seek(percent * duration);
              }}>
                <div className="absolute inset-x-0 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white transition-colors"
                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                  />
                </div>
                <div
                  className="absolute h-4 w-4 bg-white rounded-full shadow-lg flex items-center justify-center"
                  style={{ left: `calc(${duration ? (currentTime / duration) * 100 : 0}% - 8px)` }}
                />
              </div>
              <span className="min-w-[40px] text-left">{formatTime(duration)}</span>
            </div>

            <div className="flex items-center justify-between px-2 mb-4">
              <div className="relative" ref={volumeRef}>
                <button
                  aria-label="Volume"
                  onClick={() => setShowVolume(v => !v)}
                  className={`transition-colors ${showVolume ? 'text-white' : 'text-white/60 hover:text-white'}`}
                >
                  {volume === 0 ? <VolumeX size={24} className="text-white/40" /> : <Volume2 size={24} fill="currentColor" className={volume > 0.5 ? "text-white/20" : "text-white/40"} />}
                </button>

                {showVolume && (
                  <div className="absolute bottom-full left-0 mb-4 bg-[#1e1e1e] border border-white/10 p-4 rounded-2xl shadow-2xl z-50 w-40">
                    <HorizontalSlider
                      value={Math.round(volume * 100)}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(val) => setVolume(val / 100)}
                      label="Volume"
                      color="#00f5ff"
                      unit="%"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-6 md:gap-10">
                <button 
                  aria-label="Previous track" 
                  onClick={playPrevious} 
                  disabled={!hasPrevious}
                  className={`transition-colors ${hasPrevious ? 'text-white hover:text-white/80' : 'text-white/20 cursor-not-allowed'}`}
                >
                  <SkipBack size={28} className="md:w-8 md:h-8" fill="currentColor" />
                </button>
                <button
                  aria-label="Play or pause"
                  onClick={togglePlay}
                  className="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center text-white hover:scale-105 transition-transform"
                >
                  {isLoadingTrack ? (
                    <Loader2 size={40} className="md:w-12 md:h-12 animate-spin" />
                  ) : isPlaying ? (
                    <Pause size={40} className="md:w-12 md:h-12" fill="currentColor" />
                  ) : (
                    <Play size={40} className="md:w-12 md:h-12" fill="currentColor" />
                  )}
                </button>
                <button 
                  aria-label="Next track" 
                  onClick={playNext} 
                  disabled={!hasNext}
                  className={`transition-colors ${hasNext ? 'text-white hover:text-white/80' : 'text-white/20 cursor-not-allowed'}`}
                >
                  <SkipForward size={28} className="md:w-8 md:h-8" fill="currentColor" />
                </button>
              </div>

              <button
                aria-label="EQ and tone settings"
                onClick={() => navigate('/studio')}
                className="text-white/60 hover:text-white transition-colors"
                title="EQ & Tone"
              >
                <BarChart2 size={24} />
              </button>
            </div>
          </div>

        </div>

        {/* Right Side: Playlist */}
        <div className="w-full lg:w-[400px] flex-shrink-0">
          {/* F8 Up Next Playlist */}
          <div className="w-full bg-white/5 rounded-2xl p-6 border border-white/10">
            <h3 className="font-bold text-white mb-6 flex items-center gap-2">
              <ListPlus size={20} className="text-primary" />
              {t('player.upNext')}
            </h3>
            <div id="nowplaying-queue-container" className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2 relative">
              {playerState.queue.map((track) => {
                const isActive = String(currentTrack?.id) === String(track.id);
                return (
                  <div
                    key={track.id}
                    id={isActive ? 'nowplaying-current-track' : undefined}
                    onClick={() => playerState.playTrack(track, playerState.queue)}
                    className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-colors shadow-sm ${isActive ? 'bg-primary/20 border border-primary/30' : 'bg-white/5 hover:bg-white/10 border border-white/5'
                      }`}
                  >
                    <div
                      className="w-12 h-12 rounded-full bg-primary/20 bg-cover bg-center flex-shrink-0 shadow-md flex items-center justify-center overflow-hidden"
                      style={(track.imageUrl || playerState.getTrackImage(track.id)) ? { backgroundImage: `url(${track.imageUrl || playerState.getTrackImage(track.id)})` } : {}}
                    >
                      {!(track.imageUrl || playerState.getTrackImage(track.id)) && <Music size={20} className="text-white/40" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${isActive ? 'text-primary' : 'text-white'}`}>
                        {track.title || playerState.getTrackMetadata(track.id)?.title || (track.fileName ? (track.fileName.includes(' - ') ? track.fileName.split(' - ')[1].replace(/\.[^/.]+$/, "") : track.fileName.replace(/\.[^/.]+$/, "")) : 'Unknown Title')}
                      </p>
                      <p className="text-xs text-white/50 truncate mt-0.5">
                        {track.artist || playerState.getTrackMetadata(track.id)?.artist || (track.fileName?.includes(' - ') ? track.fileName.split(' - ')[0] : 'Unknown Artist')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* Metadata Modal */}
      {showMetadata && currentTrack && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowMetadata(false)}
        >
          <div
            className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div className="flex items-center gap-3 text-white">
                <Info size={24} className="text-primary" />
                <h3 className="font-semibold text-lg">{t('bottomPlayer.trackMetadata')}</h3>
              </div>
              <button
                onClick={() => setShowMetadata(false)}
                className="text-white/40 hover:text-white transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
              <div className="bg-white/5 rounded-xl p-4 flex flex-col gap-3">
                {[
                  { label: t('bottomPlayer.title'), value: currentTrack.title || playerState.getTrackMetadata(currentTrack.id)?.title },
                  { label: t('bottomPlayer.artist'), value: currentTrack.artist || playerState.getTrackMetadata(currentTrack.id)?.artist },
                  { label: t('bottomPlayer.album'), value: currentTrack.album || playerState.getTrackMetadata(currentTrack.id)?.album },
                  { label: t('bottomPlayer.genre'), value: currentTrack.genre || playerState.getTrackMetadata(currentTrack.id)?.genre },
                  { label: t('bottomPlayer.duration'), value: currentTrack.durationSeconds ? formatTime(currentTrack.durationSeconds) : (duration ? formatTime(duration) : null) },
                  { label: t('bottomPlayer.fileName'), value: currentTrack.fileName },
                  { label: t('bottomPlayer.source'), value: currentTrack.sourceType },
                  { label: t('bottomPlayer.trackId'), value: String(currentTrack.id) },
                  { label: 'File Type', value: currentTrack.fileFormat },
                  { label: 'Codec', value: currentTrack.codec },
                  { label: 'Size', value: currentTrack.fileSize ? `${(currentTrack.fileSize / 1024 / 1024).toFixed(2)} MB` : null },
                  { label: 'Bit Rate', value: currentTrack.bitrate ? `${Math.round(currentTrack.bitrate / 1000)} kbps` : null },
                  { label: 'Channels', value: currentTrack.numberOfChannels ? `${currentTrack.numberOfChannels} ${currentTrack.numberOfChannels === 2 ? '(stereo)' : ''}` : null },
                  { label: 'Audio Sample Rate', value: currentTrack.sampleRate ? `${(currentTrack.sampleRate / 1000).toFixed(3)} kHz` : null },
                  { label: 'Bit Depth', value: currentTrack.bitsPerSample ? `${currentTrack.bitsPerSample} bit` : null }
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">{item.label}</span>
                    <span className="text-sm text-white/90 font-medium break-all">{item.value || 'unknown'}</span>
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
