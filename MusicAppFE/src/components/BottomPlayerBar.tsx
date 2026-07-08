import { useRef, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGlobalAudio } from '../context/AudioContext'
import { useAuth } from '../context/AuthContext';;
import { Play, Pause, SkipForward, SkipBack, Cloud, Disc, Heart, Shuffle, Repeat, Repeat1, Square, PauseCircle, ListX, ListPlus, Maximize2, Info, ListMusic, Volume2, VolumeX, X, ArrowRight, Loader2 } from 'lucide-react';
import { HorizontalSlider } from './HorizontalSlider';
import { axiosClient } from '../api/axiosClient';
import { useTranslation } from 'react-i18next';

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
  const [isFavorite, setIsFavorite] = useState(false);
  const queueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentTrack?.id && isAuthenticated && currentTrack.sourceType !== 'LOCAL') {
      axiosClient.get(`/api/favorites/check/${currentTrack.id}`)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((res: any) => setIsFavorite(res === true || res.data === true))
        .catch(() => setIsFavorite(false));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsFavorite(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id, isAuthenticated]);

  const toggleFavorite = () => {
    if (!currentTrack?.id || !isAuthenticated || currentTrack.sourceType === 'LOCAL') return;
    
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

  return (
    <div className="h-16 md:h-20 bg-surface border-t border-white/5 px-3 md:px-6 flex items-center justify-between select-none shadow-[0_-10px_40px_rgba(0,0,0,0.3)] z-50">
      
      {/* Left: Track Info */}
      <div className="flex items-center flex-1 w-auto md:w-full max-w-[60%] sm:max-w-[70%] md:max-w-xs gap-2 md:gap-3 cursor-pointer md:cursor-auto" onClick={() => { if (window.innerWidth < 768) navigate('/'); }}>
        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-md bg-background border border-white/10 flex items-center justify-center overflow-hidden shrink-0`}>
          {currentArtwork ? (
            <img src={currentArtwork} alt="Album Art" className="w-full h-full object-cover" />
          ) : (
            <div ref={discRef} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <Disc size={20} className="text-white/50" />
            </div>
          )}
        </div>
        <div className="flex flex-col overflow-hidden pr-2">
          <span className="text-sm font-medium text-white truncate">{currentTrack.title || playerState.getTrackMetadata(currentTrack.id)?.title || (currentTrack.fileName ? (currentTrack.fileName.includes(' - ') ? currentTrack.fileName.split(' - ')[1].replace(/\.[^/.]+$/, "") : currentTrack.fileName.replace(/\.[^/.]+$/, "")) : 'Unknown Title')}</span>
          <span className="text-xs text-secondary/60 font-mono flex items-center gap-1 mt-0.5 truncate">
            {currentTrack.sourceType === 'DRIVE' && <Cloud size={10} className="text-primary shrink-0" />}
            <span className="truncate">{currentTrack.artist || playerState.getTrackMetadata(currentTrack.id)?.artist || (currentTrack.fileName?.includes(' - ') ? currentTrack.fileName.split(' - ')[0] : 'Unknown Artist')}</span>
          </span>
        </div>
        {currentTrack.sourceType !== 'LOCAL' ? (
          <button 
            onClick={(e) => { e.stopPropagation(); toggleFavorite(); }}
            className={`
              ${isFavorite ? 'text-primary drop-shadow-[0_0_8px_var(--tw-colors-primary)] scale-110' : 'text-white/40 hover:text-white'} 
              transition-all duration-300 ml-1 md:ml-2 p-1.5 md:p-1 rounded-full
              active:scale-95
            `}
            aria-label={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
          >
            <Heart size={18} fill={isFavorite ? "currentColor" : "none"} className={`transition-all duration-300`} />
          </button>
        ) : (
          <div className="w-[30px] ml-1 md:ml-2"></div>
        )}
      </div>

      {/* Center: Controls & Seek Bar */}
      <div className="flex flex-col items-end md:items-center gap-1 shrink-0 md:w-2/4 md:max-w-2xl pr-2 md:pr-0">
        <div className="flex items-center gap-4 md:gap-6">
          <button 
            onClick={(e) => { e.stopPropagation(); setIsShuffle(prev => !prev); }}
            aria-label={isShuffle ? "Turn off shuffle" : "Turn on shuffle"}
            className={`${isShuffle ? 'text-primary' : 'text-white/40 hover:text-white'} transition-colors hidden md:block`}
            title={isShuffle ? "Shuffle On" : "Shuffle Off"}
          >
            <Shuffle size={16} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); playPrevious(); }}
            aria-label="Previous track"
            disabled={!hasPrevious}
            className={`transition-colors ${hasPrevious ? 'text-white/60 hover:text-white' : 'text-white/20 cursor-not-allowed'}`}
          >
            <SkipBack size={18} fill="currentColor" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            aria-label="Play or pause"
            className="w-8 h-8 md:w-8 md:h-8 shrink-0 rounded-full bg-white flex items-center justify-center text-black hover:scale-105 transition-transform"
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
            className={`transition-colors ${hasNext ? 'text-white/60 hover:text-white' : 'text-white/20 cursor-not-allowed'}`}
          >
            <SkipForward size={18} fill="currentColor" />
          </button>
          <div className="hidden md:flex items-center gap-2 border-l border-white/10 pl-4 ml-2">
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
                className={`${(queueEndMode === 'repeat' || songEndMode === 'repeat_one') ? 'text-primary' : 'text-white/40 hover:text-white'} transition-colors relative flex items-center justify-center`}
                title={songEndMode === 'repeat_one' ? t('bottomPlayer.repeatSong', 'Repeat Song') : queueEndMode === 'repeat' ? t('bottomPlayer.repeatQueue', 'Repeat Queue') : t('bottomPlayer.repeatOff', 'Repeat: Off')}
              >
                {songEndMode === 'repeat_one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
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
                  className={`${songEndMode !== 'next' ? 'text-primary' : 'text-white/40 hover:text-white'} transition-colors relative flex items-center justify-center`}
                  title={songEndMode === 'next' ? t('bottomPlayer.songNext', 'Song: Next') : songEndMode === 'repeat_one' ? t('bottomPlayer.songRepeat', 'Song: Repeat') : songEndMode === 'preload' ? t('bottomPlayer.songPreload', 'Song: Preload & Stop') : t('bottomPlayer.songStop', 'Song: Stop')}
                >
                  {songEndMode === 'repeat_one' ? <Repeat1 size={16} /> : songEndMode === 'stop' ? <Square size={14} /> : songEndMode === 'preload' ? <PauseCircle size={16} /> : <ArrowRight size={16} />}
                </button>
                <button
                  onClick={() => {
                    if (queueEndMode === 'repeat') setQueueEndMode('next');
                    else if (queueEndMode === 'next') setQueueEndMode('stop');
                    else setQueueEndMode('repeat');
                  }}
                  aria-label="Change queue repeat mode"
                  className={`${queueEndMode !== 'stop' ? 'text-primary' : 'text-white/40 hover:text-white'} transition-colors relative flex items-center justify-center`}
                  title={queueEndMode === 'repeat' ? t('bottomPlayer.queueRepeat', 'Queue: Repeat') : queueEndMode === 'next' ? t('bottomPlayer.queueNext', 'Queue: Next') : t('bottomPlayer.queueStop', 'Queue: Stop')}
                >
                  {queueEndMode === 'repeat' ? <Repeat size={16} /> : queueEndMode === 'next' ? <ListPlus size={16} /> : <ListX size={16} />}
                </button>
              </>
            )}
          </div>
        </div>
        
        <div className="hidden md:flex w-full items-center gap-2 font-mono text-[10px] text-white/50">
          <span className="min-w-[30px] text-right">{formatTime(currentTime)}</span>
          <div className="flex-1 relative flex items-center group h-3 cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            if (duration) seek(percent * duration);
          }}>
            <div className="absolute inset-x-0 h-1 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary group-hover:bg-[#00E5FF] transition-colors"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <div 
              className="absolute h-3 w-3 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow flex items-center justify-center"
              style={{ left: `calc(${duration ? (currentTime / duration) * 100 : 0}% - 6px)` }}
            />
          </div>
          <span className="min-w-[30px] text-left">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: Extra Controls */}
      <div className="hidden md:flex items-center justify-end w-1/4 min-w-[200px] gap-4 text-white/50">
        <button onClick={() => navigate('/')} className="hover:text-white transition-colors" aria-label="Now Playing">
          <Maximize2 size={16} />
        </button>
        <button onClick={() => setShowMetadata(true)} className="hover:text-white transition-colors" aria-label="Track Information"><Info size={16} /></button>
        <div className="relative" ref={queueRef}>
          <button 
            onClick={() => setShowQueue(v => !v)} 
            aria-label="Toggle Queue"
            className={`transition-colors flex items-center justify-center p-2 rounded-full ${showQueue ? 'text-white bg-white/10' : 'hover:text-white'}`}
          >
            <ListMusic size={16} />
          </button>
          
          {showQueue && (
            <div className="absolute bottom-full right-0 mb-4 w-[320px] bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col max-h-[60vh]">
              <div className="p-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#1e1e1e]/90 backdrop-blur-md z-10">
                <h2 className="font-bold text-white flex items-center gap-2">
                  <ListPlus size={18} className="text-primary" /> 
                  {t('bottomPlayer.queueTitle', 'Queue')}
                </h2>
                <span className="text-xs text-white/50">{queue.length} {t('bottomPlayer.songs', 'songs')}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
                {queue.map((track, idx) => {
                  const isActive = currentTrack?.id === track.id;
                  return (
                    <div 
                      key={`${track.id}-${idx}`}
                      onClick={() => playTrack(track, queue)}
                      className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors ${
                        isActive ? 'bg-primary/20 border border-primary/30' : 'hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/20 bg-cover bg-center flex-shrink-0" style={{ backgroundImage: track.imageUrl ? `url(${track.imageUrl})` : undefined }}>
                        {!track.imageUrl && <Disc size={16} className="text-white/30 m-auto mt-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isActive ? 'text-primary' : 'text-white'}`}>
                          {track.title || track.fileName?.replace(/\.[^/.]+$/, "")}
                        </p>
                        <p className="text-xs text-white/50 truncate">
                          {track.artist || track.fileName?.split(' - ')[0] || 'Unknown Artist'}
                        </p>
                      </div>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary mr-2 shadow-[0_0_8px_var(--tw-colors-primary)]" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 ml-2 w-48">
          <button 
            onClick={() => setVolume(volume === 0 ? 1 : 0)}
            aria-label="Mute or Unmute"
            className="hover:text-white transition-colors flex items-center gap-1.5"
          >
            {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            <span className="text-xs font-mono w-9 text-left">{Math.round(volume * 100)}%</span>
          </button>
          <div className="flex-1 mt-1">
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
                <h3 className="font-semibold text-lg">{t('bottomPlayer.trackMetadata', 'Track Metadata')}</h3>
              </div>
              <button 
                onClick={() => setShowMetadata(false)}
                className="text-white/40 hover:text-white transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[70vh] no-scrollbar">
              <div className="bg-white/5 rounded-xl p-4 flex flex-col gap-3">
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
                  <div key={idx} className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">{item.label}</span>
                    <span className="text-sm text-white/90 font-medium break-all">{item.value || t('bottomPlayer.unknown', 'unknown')}</span>
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
