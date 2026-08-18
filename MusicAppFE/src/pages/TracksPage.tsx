import { getSecureRandom } from '../utils/randomUtils';
import { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Heart, ListMusic, ListPlus, Play, ArrowLeft, Shuffle, MoreHorizontal, Info, X, ListEnd, ListStart, RefreshCw, Trash2, Cpu, Tags, ChevronDown, CheckSquare, Square, Download, DownloadCloud, Loader2, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import { useGlobalAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import type { Track } from '../hooks/useAudioPlayer';
import { useLibrary } from '../context/LibraryContext';
import { useConfirm } from '../context/ConfirmContext';
import { getAudioExtension } from '../hooks/audioMime';
import { ActionMenu } from '../components/ActionMenu';
import { useOffline } from '../context/OfflineContext';
import { downloadTrackFile } from '../utils/downloadUtils';

import { useVirtualList } from '../hooks/useVirtualList';

type SortMode = 'default' | 'leastPlayed' | 'mostPlayed';

const TRACK_ROW_HEIGHT = 72;

export function TracksPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { playerState } = useGlobalAudio();
  const { isOfflineMode, isCached, downloadTrack, downloadingTrackIds } = useOffline();
  const { tracks, favorites, toggleFavorite: ctxToggleFavorite, deleteTrack, syncLibrary, isLoading } = useLibrary();
  const activeTab = searchParams.get('tab') === 'favorites' ? 'favorites' : 'all';
  const [trackToPlaylist, setTrackToPlaylist] = useState<Track | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [infoTrack, setInfoTrack] = useState<Track | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [tracksToPlaylist, setTracksToPlaylist] = useState<Track[] | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggered = useRef(false);

  const [downloadProgress, setDownloadProgress] = useState<{ current: number, total: number } | null>(null);
  const isDownloadingAllRef = useRef(false);

  const toggleFavorite = async (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await ctxToggleFavorite(track);
      setOpenMenuId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePlayNext = (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentQueue = playerState.queue;
    if (currentQueue.length === 0 && !playerState.currentTrack) {
      playerState.playTrack(track, displayTracks);
    } else {
      const currentIndex = currentQueue.findIndex(t => t.id === playerState.currentTrack?.id);
      if (currentIndex !== -1) {
        const newQueue = [...currentQueue];
        newQueue.splice(currentIndex + 1, 0, track);
        playerState.setQueue(newQueue);
      } else {
        playerState.setQueue([...currentQueue, track]);
      }
    }
    setOpenMenuId(null);
  };

  const handleAddToQueue = (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playerState.queue.length === 0 && !playerState.currentTrack) {
      playerState.playTrack(track, displayTracks);
    } else {
      playerState.setQueue([...playerState.queue, track]);
    }
    setOpenMenuId(null);
  };

  const sourceTracks = activeTab === 'favorites' ? favorites : tracks;
  const titleOf = (track: Track) => (
    track.title || playerState.getTrackMetadata(track.id)?.title || track.fileName || ''
  ).toLowerCase();
  const displayTracks = sortMode === 'default'
    ? sourceTracks
    : [...sourceTracks].sort((a, b) => {
      const playDiff = (a.playCount ?? 0) - (b.playCount ?? 0);
      if (playDiff !== 0) {
        return sortMode === 'leastPlayed' ? playDiff : -playDiff;
      }
      return titleOf(a).localeCompare(titleOf(b));
    });

  const playAllTracks = () => {
    if (playerState.isShuffle) {
      const shuffled = [...displayTracks].sort(() => getSecureRandom() - 0.5);
      playerState.playTrack(shuffled[0], shuffled);
    } else {
      playerState.playTrack(displayTracks[0], displayTracks);
    }
  };

  const shuffleAllTracks = () => {
    playerState.setIsShuffle(true);
    const shuffled = [...displayTracks].sort(() => getSecureRandom() - 0.5);
    playerState.playTrack(shuffled[0], shuffled);
  };

  const playAllNext = () => {
    const currentQueue = playerState.queue;
    if (currentQueue.length === 0 && !playerState.currentTrack) {
      playerState.playTrack(displayTracks[0], displayTracks);
      return;
    }

    const currentIndex = currentQueue.findIndex(t => t.id === playerState.currentTrack?.id);
    if (currentIndex !== -1) {
      const newQueue = [...currentQueue];
      newQueue.splice(currentIndex + 1, 0, ...displayTracks);
      playerState.setQueue(newQueue);
    } else {
      playerState.setQueue([...currentQueue, ...displayTracks]);
    }
  };

  const addAllToQueue = () => {
    playerState.setQueue([...playerState.queue, ...displayTracks]);
  };

  const toggleSelection = (trackId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedTrackIds(prev => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  };

  const handlePointerDown = (trackId: string, e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    isLongPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      setSelectedTrackIds(prev => {
        const next = new Set(prev);
        next.add(trackId);
        return next;
      });
      if (navigator.vibrate) navigator.vibrate(50);
    }, 400);
  };

  const handlePointerUpOrLeave = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTrackClick = (track: Track, e: React.MouseEvent) => {
    if (isLongPressTriggered.current) {
      isLongPressTriggered.current = false;
      return;
    }

    if (selectedTrackIds.size > 0) {
      toggleSelection(String(track.id), e);
      return;
    }

    playerState.playTrack(track, displayTracks);
  };

  const handleBatchAddToQueue = () => {
    const selectedTracks = displayTracks.filter(t => selectedTrackIds.has(String(t.id)));
    playerState.setQueue([...playerState.queue, ...selectedTracks]);
    setSelectedTrackIds(new Set());
  };

  const handleBatchAddToFavorites = async () => {
    const selectedTracks = displayTracks.filter(t => selectedTrackIds.has(String(t.id)));
    try {
      await Promise.all(selectedTracks.map(t => {
        const isFav = favorites.some(f => f.id === t.id);
        if (!isFav) {
          return ctxToggleFavorite(t);
        }
        return Promise.resolve();
      }));
      setSelectedTrackIds(new Set());
    } catch (err) {
      console.error(err);
    }
  };

  const handleBatchDelete = async () => {
    const selectedTracks = displayTracks.filter(t => selectedTrackIds.has(String(t.id)));
    const localTracks = selectedTracks.filter(t => t.sourceType === 'LOCAL');
    const cloudTracks = selectedTracks.filter(t => t.sourceType !== 'LOCAL');

    if (cloudTracks.length === 0) {
      if (localTracks.length > 0) {
        alert("Cannot delete local files from library.");
      }
      return;
    }

    const isConfirmed = await confirm({
      title: 'Xóa nhiều bài hát',
      description: `Bạn có chắc chắn muốn xóa ${cloudTracks.length} bài hát khỏi thư viện? (Local files sẽ bị bỏ qua)`,
      confirmText: 'Xóa',
      confirmColor: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30'
    });

    if (isConfirmed) {
      const isConfirmed2 = await confirm({
        title: 'Xác nhận xóa vĩnh viễn',
        description: `Hành động này sẽ xóa vĩnh viễn ${cloudTracks.length} bài hát từ Google Drive của bạn và không thể hoàn tác. Bạn vẫn muốn tiếp tục?`,
        confirmText: 'Xóa vĩnh viễn',
        confirmColor: 'bg-red-600 text-white hover:bg-red-700 border-red-600'
      });
      if (isConfirmed2) {
        try {
          await Promise.all(cloudTracks.map(t => deleteTrack(t)));
          setSelectedTrackIds(new Set());
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  const infoTrackMetadata = infoTrack ? playerState.getTrackMetadata(infoTrack.id) : undefined;
  const infoTrackFileSize = infoTrack?.fileSize ?? infoTrackMetadata?.fileSize;
  const infoTrackBitrate = infoTrack?.bitrate ?? infoTrackMetadata?.bitrate;
  const infoTrackChannels = infoTrack?.numberOfChannels ?? infoTrackMetadata?.numberOfChannels;
  const infoTrackSampleRate = infoTrack?.sampleRate ?? infoTrackMetadata?.sampleRate;
  const infoTrackBitsPerSample = infoTrack?.bitsPerSample ?? infoTrackMetadata?.bitsPerSample;
  
  const uncachedCount = displayTracks.filter(t => !isCached(t) && t.sourceType !== 'LOCAL').length;

  const {
    containerRef,
    handleScroll,
    offsetY,
    totalHeight,
    visibleIndexes,
  } = useVirtualList({
    itemCount: displayTracks.length,
    itemHeight: TRACK_ROW_HEIGHT,
  });



  return (
    <div className="w-full h-full flex flex-col max-w-6xl 2xl:max-w-none mx-auto pb-28 md:pb-32 overflow-y-auto no-scrollbar">
      <div className="mb-6 md:mb-8 border-b border-white/[0.06] pb-4 md:pb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-3">
          <button onClick={() => navigate('/library')} aria-label="Back to library" className="p-2 -ml-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white shrink-0">
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-display text-white tracking-tight">
              {activeTab === 'all' ? 'All Songs' : 'Favorite Songs'}
            </h1>
            <p className="text-slate-400 text-xs md:text-sm font-mono mt-0.5">
              {displayTracks.length} {activeTab === 'all' ? 'songs in library' : 'favorites'}.
            </p>
          </div>
        </div>
        {!isOfflineMode && (uncachedCount > 0 || downloadProgress !== null) && (
          <div className="flex items-center gap-2">
            {downloadProgress ? (
              <button
                onClick={() => {
                  isDownloadingAllRef.current = false;
                  setDownloadProgress(null);
                }}
                className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-xl transition-colors shrink-0 whitespace-nowrap text-xs font-semibold"
                title="Stop downloading"
              >
                <X size={16} />
                <span>{Math.round((downloadProgress.current / downloadProgress.total) * 100)}% ({downloadProgress.current}/{downloadProgress.total})</span>
              </button>
            ) : (
              <button
                onClick={async () => {
                  const uncached = displayTracks.filter(t => !isCached(t) && t.sourceType !== 'LOCAL');
                  if (uncached.length === 0) return;
                  
                  isDownloadingAllRef.current = true;
                  setDownloadProgress({ current: 0, total: uncached.length });
                  
                  for (let i = 0; i < uncached.length; i++) {
                    if (!isDownloadingAllRef.current) break;
                    await downloadTrack(uncached[i]);
                    setDownloadProgress({ current: i + 1, total: uncached.length });
                  }
                  
                  isDownloadingAllRef.current = false;
                  setDownloadProgress(null);
                }}
                className="flex items-center gap-2 bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary px-3.5 py-2 rounded-xl transition-all shrink-0 whitespace-nowrap text-xs font-semibold shadow-[0_0_12px_rgba(0,245,255,0.15)]"
              >
                <DownloadCloud size={16} />
                <span className="hidden sm:inline">{t('offline.downloadAll', 'Download All')}</span>
              </button>
            )}
          </div>
        )}
      </div>

      <AddToPlaylistModal
        isOpen={!!trackToPlaylist || !!tracksToPlaylist}
        onClose={() => { setTrackToPlaylist(null); setTracksToPlaylist(null); }}
        isAuthenticated={isAuthenticated}
        track={trackToPlaylist}
        tracks={tracksToPlaylist || undefined}
      />

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            onClick={() => {
              if (selectedTrackIds.size === displayTracks.length && displayTracks.length > 0) {
                setSelectedTrackIds(new Set());
              } else {
                setSelectedTrackIds(new Set(displayTracks.map(t => String(t.id))));
              }
            }}
            className="p-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-slate-300 hover:text-white transition-all flex items-center gap-2 px-3 text-xs font-medium"
            title="Select All"
          >
            {selectedTrackIds.size === displayTracks.length && displayTracks.length > 0 ? <CheckSquare size={15} className="text-primary" /> : <Square size={15} />}
            <span className="hidden sm:inline">Select All</span>
          </button>
          <button
            onClick={() => syncLibrary()}
            disabled={isLoading}
            className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-slate-300 hover:text-white transition-all disabled:opacity-50"
            title="Reload"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin text-primary' : ''} />
          </button>
        </div>
        {displayTracks.length > 0 && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                className="h-9 w-full justify-between rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 text-xs text-slate-300 hover:bg-white/[0.08] hover:text-white focus:outline-none flex items-center gap-2 transition-all whitespace-nowrap sm:w-auto font-medium"
                title="Sort songs"
              >
                {sortMode === 'default' ? 'Default order' : (sortMode === 'leastPlayed' ? 'Least played' : 'Most played')}
                <ChevronDown size={14} className={`transition-transform duration-200 text-slate-400 ${isSortMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {isSortMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsSortMenuOpen(false)}></div>
                  <div className="absolute left-0 top-full mt-2 w-full min-w-48 sm:w-48 bg-[#0c1626] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 py-1.5 flex flex-col backdrop-blur-2xl">
                    {[
                      { value: 'default', label: 'Default order' },
                      { value: 'leastPlayed', label: 'Least played' },
                      { value: 'mostPlayed', label: 'Most played' }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSortMode(option.value as SortMode);
                          setIsSortMenuOpen(false);
                        }}
                        className={`px-3.5 py-2 text-xs text-left transition-colors flex items-center gap-2 ${sortMode === option.value ? 'bg-primary/15 text-primary font-semibold' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={playAllTracks}
              className="h-9 flex-1 justify-center rounded-xl bg-primary px-4 text-slate-950 hover:brightness-110 flex items-center gap-1.5 transition-all text-xs font-bold shadow-[0_0_15px_rgba(0,245,255,0.3)] whitespace-nowrap sm:flex-none hover:scale-105 active:scale-95"
              title="Play All"
            >
              <Play size={14} fill="currentColor" /> Play
            </button>
            <button
              onClick={shuffleAllTracks}
              className="h-9 flex-1 justify-center rounded-xl bg-white/[0.06] border border-white/[0.08] px-4 text-slate-200 hover:bg-white/[0.12] hover:text-white flex items-center gap-1.5 transition-all text-xs font-semibold whitespace-nowrap sm:flex-none"
              title="Shuffle & Play"
            >
              <Shuffle size={14} /> Shuffle
            </button>
            <ActionMenu
              ariaLabel="More song actions"
              buttonClassName="h-9 w-9 rounded-xl bg-white/[0.06] border border-white/[0.08] text-slate-300 hover:bg-white/[0.12] hover:text-white flex items-center justify-center transition-all"
              actions={[
                { label: 'Play Next', icon: <ListStart size={14} />, onSelect: playAllNext },
                { label: 'Add to Queue', icon: <ListEnd size={14} />, onSelect: addAllToQueue },
              ]}
            />
          </div>
        )}
      </div>

      {selectedTrackIds.size > 0 && (
        <div className="sticky top-0 z-20 mb-2 flex flex-wrap items-center justify-between gap-y-2 gap-x-3 bg-[#0c1626]/95 backdrop-blur-xl border border-primary/30 rounded-xl p-3 shadow-2xl">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="text-primary text-xs font-bold whitespace-nowrap">{selectedTrackIds.size} selected</span>
            <button onClick={() => setSelectedTrackIds(new Set())} className="text-slate-400 hover:text-white transition-colors shrink-0 p-1" title="Clear selection">
              <X size={16} />
            </button>
            <button
              onClick={() => {
                if (selectedTrackIds.size === displayTracks.length && displayTracks.length > 0) {
                  setSelectedTrackIds(new Set());
                } else {
                  setSelectedTrackIds(new Set(displayTracks.map(t => String(t.id))));
                }
              }}
              className="p-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 px-2.5 text-xs ml-1 shrink-0 whitespace-nowrap"
            >
              {selectedTrackIds.size === displayTracks.length && displayTracks.length > 0 ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} />}
              <span className="hidden md:inline">Select All</span>
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ActionMenu
              ariaLabel="Batch actions"
              buttonClassName="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors"
              actions={[
                { label: 'Add to Queue', icon: <ListEnd size={16} />, onSelect: handleBatchAddToQueue },
                { label: 'Add to Playlist', icon: <ListPlus size={16} />, onSelect: () => setTracksToPlaylist(displayTracks.filter(t => selectedTrackIds.has(String(t.id)))) },
                { label: 'Add to Favorites', icon: <Heart size={16} />, onSelect: handleBatchAddToFavorites },
                { label: 'Delete', icon: <Trash2 size={16} />, onSelect: handleBatchDelete, tone: 'danger' },
              ]}
            />
          </div>
        </div>
      )}

      {displayTracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500 font-mono text-sm">
          <p>{activeTab === 'all' ? 'No songs in your library' : 'No favorite songs yet'}</p>
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="relative w-full"
          style={{ height: totalHeight }}
        >
          <div
            className="absolute inset-x-0 top-0 will-change-transform"
            style={{ transform: `translateY(${offsetY}px)` }}
          >
            {visibleIndexes.map((index) => {
              const track = displayTracks[index];
              if (!track) return null;
              const isActive = playerState.currentTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  className={`relative ${openMenuId === track.id ? 'z-40' : 'z-0'}`}
                  style={{ height: TRACK_ROW_HEIGHT }}
                >
                  <div
                    onPointerDown={(e) => {
                      if (isOfflineMode && !isCached(track)) return;
                      handlePointerDown(String(track.id), e);
                    }}
                    onPointerUp={handlePointerUpOrLeave}
                    onPointerCancel={handlePointerUpOrLeave}
                    onMouseLeave={() => {
                      setOpenMenuId(null);
                      handlePointerUpOrLeave();
                    }}
                    onContextMenu={(e) => {
                      if (isLongPressTriggered.current || ('ontouchstart' in window && selectedTrackIds.size > 0)) {
                        e.preventDefault();
                      }
                    }}
                    onClick={(e) => {
                      if (isOfflineMode && !isCached(track)) return;
                      handleTrackClick(track, e);
                    }}
                    className={`flex h-[64px] items-center gap-3 sm:gap-3.5 p-2.5 sm:p-3 rounded-xl border transition-all duration-200 group cursor-pointer select-none relative ${openMenuId === track.id ? 'z-40 ring-1 ring-primary/40' : 'z-0'} ${isOfflineMode && !isCached(track) ? 'opacity-40 grayscale pointer-events-none' :
                        isActive
                          ? 'bg-primary/15 border-primary/30 text-primary shadow-[inset_0_0_15px_rgba(0,245,255,0.1)]'
                          : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.06] hover:border-primary/25 backdrop-blur-md'
                      }`}
                  >
                    {selectedTrackIds.size > 0 ? (
                      <button
                        onClick={(e) => toggleSelection(String(track.id), e)}
                        className="w-5 flex items-center justify-center transition-colors shrink-0"
                      >
                        {selectedTrackIds.has(String(track.id)) ? <CheckSquare size={17} className="text-primary" /> : <Square size={17} className="text-slate-500" />}
                      </button>
                    ) : (
                      <div className="w-5 text-center shrink-0">
                        {isActive && playerState.isPlaying ? (
                          <div className="flex items-end justify-center gap-0.5 h-3">
                            <span className="w-0.5 bg-primary rounded-full animate-eq-1" />
                            <span className="w-0.5 bg-primary rounded-full animate-eq-2" />
                            <span className="w-0.5 bg-primary rounded-full animate-eq-3" />
                          </div>
                        ) : (
                          <span className="hidden sm:block text-[11px] font-mono text-slate-500">{index + 1}</span>
                        )}
                      </div>
                    )}
                    <button
                      aria-label="Play track"
                      onClick={(e) => { e.stopPropagation(); playerState.playTrack(track, displayTracks); }}
                      className="hidden lg:group-hover:flex w-5 items-center justify-center rounded-full transition-colors text-primary"
                    >
                      <Play size={14} fill="currentColor" />
                    </button>
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden border border-white/10 shadow-sm">
                      {track.imageUrl || playerState.getTrackImage(track.id) ? (
                        <img src={track.imageUrl || playerState.getTrackImage(track.id)} alt="Cover" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <ListMusic size={16} className="text-slate-500" />
                      )}
                    </div>
                    <div className="flex flex-col truncate flex-1 pr-2">
                      <span className={`text-xs sm:text-sm font-semibold truncate ${isActive ? 'text-primary' : 'text-slate-100'}`}>
                        {track.title || playerState.getTrackMetadata(track.id)?.title || (track.fileName ? (track.fileName.includes(' - ') ? track.fileName.split(' - ')[1].replace(/\.[^/.]+$/, "") : track.fileName.replace(/\.[^/.]+$/, "")) : 'Unknown Title')}
                      </span>
                      <div className="flex min-w-0 items-center gap-2 mt-0.5 font-mono text-[11px] text-slate-400">
                        {track.sourceType === 'DRIVE' && (
                          <span className="inline-flex items-center gap-0.5 text-primary text-[10px] bg-primary/10 px-1 py-0.2 rounded border border-primary/20 shrink-0">
                            Drive
                          </span>
                        )}
                        <span className="truncate">{track.artist || playerState.getTrackMetadata(track.id)?.artist || (track.fileName?.includes(' - ') ? track.fileName.split(' - ')[0] : 'Unknown Artist')}</span>
                        {track.album && (
                          <>
                            <span className="hidden md:inline text-slate-600">•</span>
                            <span className="hidden md:inline truncate text-slate-500">{track.album}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className={`relative flex items-center gap-1.5 transition-opacity ${openMenuId === track.id ? 'opacity-100' : 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100'}`}>
                      <button
                        aria-label="More options"
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === track.id ? null : track.id); }}
                        className={`p-1.5 rounded-lg transition-colors pointer-events-auto ${openMenuId === track.id ? 'text-primary bg-primary/10' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                        title="More options"
                      >
                        <MoreHorizontal size={17} />
                      </button>

                      {openMenuId === track.id && (
                        <div className="absolute right-0 top-full mt-1.5 w-56 max-w-[calc(100vw_-_2rem)] bg-[#0c1626]/98 border border-white/[0.12] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] overflow-hidden z-50 py-1.5 backdrop-blur-2xl animate-in zoom-in-95 duration-150">
                          <button
                            onClick={(e) => handlePlayNext(track, e)}
                            className="w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.06] hover:text-white transition-colors"
                          >
                            <ListStart size={14} className="text-primary" /> Play Next
                          </button>
                          <button
                            onClick={(e) => handleAddToQueue(track, e)}
                            className="w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.06] hover:text-white transition-colors"
                          >
                            <ListEnd size={14} className="text-cyan-400" /> Add to Queue
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setTrackToPlaylist(track); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.06] hover:text-white transition-colors"
                          >
                            <ListPlus size={14} className="text-emerald-400" /> Add to Playlist
                          </button>
                          {track.sourceType !== 'LOCAL' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); downloadTrackFile(track); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.06] hover:text-white transition-colors"
                            >
                              <Download size={14} className="text-slate-400" /> Download File
                            </button>
                          )}
                          {!isOfflineMode && track.sourceType !== 'LOCAL' && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!isCached(track) && !downloadingTrackIds.has(String(track.id))) {
                                  await downloadTrack(track);
                                }
                              }}
                              className="w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.06] hover:text-white transition-colors"
                            >
                              {(() => {
                                if (isCached(track)) return <CheckCircle2 size={14} className="text-green-400" />;
                                if (downloadingTrackIds.has(String(track.id))) return <Loader2 size={14} className="animate-spin text-primary" />;
                                return <DownloadCloud size={14} className="text-blue-400" />;
                              })()}
                              <span>
                                {isCached(track) ? t('offline.downloaded', 'Downloaded (Offline)') : (downloadingTrackIds.has(String(track.id)) ? t('offline.downloading', 'Downloading...') : t('offline.downloadTrack', 'Save for Offline'))}
                              </span>
                            </button>
                          )}
                          {track.sourceType !== 'LOCAL' && (
                            <button
                              onClick={(e) => toggleFavorite(track, e)}
                              className="w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.06] hover:text-white transition-colors"
                            >
                              <Heart size={14} fill={favorites.some(f => f.id === track.id) ? "currentColor" : "none"} className={favorites.some(f => f.id === track.id) ? "text-primary" : "text-slate-400"} />
                              {favorites.some(f => f.id === track.id) ? "Remove Favorite" : "Add to Favorite"}
                            </button>
                          )}
                          {getAudioExtension(track.fileName) === 'flac' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                playerState.toggleFlacWasmForTrack(track);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.06] hover:text-white transition-colors"
                            >
                              <Cpu size={14} className={playerState.isFlacWasmEnabled(track) ? 'text-primary' : 'text-slate-400'} />
                              {playerState.isFlacWasmEnabled(track) ? 'Use Normal FLAC' : 'Use FLAC WASM'}
                            </button>
                          )}
                          {(getAudioExtension(track.fileName) === 'm4a' || getAudioExtension(track.fileName) === 'aac') && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                playerState.toggleM4aWasmForTrack(track);
                                setOpenMenuId(null);
                                if (playerState.currentTrack?.id === track.id && track.sourceType !== 'LOCAL') {
                                  await playerState.reloadCurrentTrackFromDrive();
                                }
                              }}
                              className="w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.06] hover:text-white transition-colors"
                            >
                              <Cpu size={14} className={playerState.isM4aWasmEnabled(track) ? 'text-primary' : 'text-slate-400'} />
                              {playerState.isM4aWasmEnabled(track) ? 'Use Normal M4A' : 'Use M4A WASM'}
                            </button>
                          )}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              playerState.toggleLegacyMetadataForTrack(track);
                              setOpenMenuId(null);
                              if (playerState.currentTrack?.id === track.id && track.sourceType !== 'LOCAL') {
                                await playerState.reloadCurrentTrackFromDrive();
                              }
                            }}
                            className="w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.06] hover:text-white transition-colors"
                          >
                            <Tags size={14} className={playerState.isLegacyMetadataEnabled(track) ? 'text-primary' : 'text-slate-400'} />
                            {playerState.isLegacyMetadataEnabled(track) ? 'Use New Metadata Parser' : 'Use Legacy Metadata Parser'}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setInfoTrack(track); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.06] hover:text-white transition-colors border-t border-white/[0.06]"
                          >
                            <Info size={14} className="text-slate-400" /> Info
                          </button>
                          {track.sourceType !== 'LOCAL' && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const isConfirmed = await confirm({
                                  title: 'Xóa bài hát',
                                  description: `Bạn có chắc chắn muốn xóa bài hát "${track.title || track.fileName}" khỏi thư viện?`,
                                  confirmText: 'Xóa',
                                  confirmColor: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30'
                                });
                                if (isConfirmed) {
                                  const isConfirmed2 = await confirm({
                                    title: 'Xác nhận xóa vĩnh viễn',
                                    description: `Hành động này sẽ xóa vĩnh viễn bài hát "${track.title || track.fileName}" từ Google Drive của bạn và không thể hoàn tác. Bạn vẫn muốn tiếp tục?`,
                                    confirmText: 'Xóa vĩnh viễn',
                                    confirmColor: 'bg-red-600 text-white hover:bg-red-700 border-red-600'
                                  });
                                  if (isConfirmed2) {
                                    await deleteTrack(track);
                                    setOpenMenuId(null);
                                  }
                                }
                              }}
                              className="w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium text-left text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info Modal */}
      {infoTrack && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
          onClick={() => setInfoTrack(null)}
        >
          <div
            className="bg-[#0c1626] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5 text-white">
                <Info size={20} className="text-primary" />
                <h3 className="font-semibold text-base">Track Metadata</h3>
              </div>
              <button
                aria-label="Close info"
                onClick={() => setInfoTrack(null)}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/[0.05]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3 overflow-y-auto max-h-[70vh] no-scrollbar">
              <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3.5 flex flex-col gap-2">
                {[
                  { label: 'Title', value: infoTrack.title || infoTrackMetadata?.title },
                  { label: 'Artist', value: infoTrack.artist || infoTrackMetadata?.artist },
                  { label: 'Album', value: infoTrack.album || infoTrackMetadata?.album },
                  { label: 'Genre', value: infoTrack.genre || infoTrackMetadata?.genre },
                  { label: 'Duration', value: infoTrack.durationSeconds ? `${Math.floor(infoTrack.durationSeconds / 60)}:${Math.floor(infoTrack.durationSeconds % 60).toString().padStart(2, '0')}` : null },
                  { label: 'Play Count', value: `${infoTrack.playCount ?? 0}` },
                  { label: 'File Name', value: infoTrack.fileName },
                  { label: 'Source', value: infoTrack.sourceType },
                  { label: 'Track ID', value: String(infoTrack.id) },
                  { label: 'File Type', value: infoTrack.fileFormat || infoTrackMetadata?.fileFormat },
                  { label: 'Codec', value: infoTrack.codec || infoTrackMetadata?.codec },
                  { label: 'Size', value: infoTrackFileSize ? `${(infoTrackFileSize / 1024 / 1024).toFixed(2)} MB` : null },
                  { label: 'Bit Rate', value: infoTrackBitrate ? `${Math.round(infoTrackBitrate / 1000)} kbps` : null },
                  { label: 'Channels', value: infoTrackChannels ? `${infoTrackChannels} ${infoTrackChannels === 2 ? '(stereo)' : ''}` : null },
                  { label: 'Audio Sample Rate', value: infoTrackSampleRate ? `${(infoTrackSampleRate / 1000).toFixed(3)} kHz` : null },
                  { label: 'Bit Depth', value: infoTrackBitsPerSample ? `${infoTrackBitsPerSample} bit` : null }
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-semibold">{item.label}</span>
                    <span className="text-xs text-slate-200 font-medium break-all">{item.value || 'unknown'}</span>
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
