import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import { Play, Trash2, GripVertical, MoreHorizontal, ArrowUp, ArrowDown, ListPlus, Heart, Info, X, ChevronsUp, ChevronsDown, CheckSquare, Square, Download } from 'lucide-react';
import type { Track } from '../hooks/useAudioPlayer';
import { useVirtualList } from '../hooks/useVirtualList';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import { ActionMenu } from '../components/ActionMenu';
import { useAuth } from '../context/AuthContext';
import { downloadTrackFile } from '../utils/downloadUtils';
import { TrackInfoModal } from '../components/TrackInfoModal';

const QUEUE_ITEM_HEIGHT = 84;

const getDisplayTitle = (track: Track, metadata?: Partial<Track>) => {
  if (track.title) return track.title;
  if (metadata?.title) return metadata.title;
  if (!track.fileName) return 'Unknown Title';
  const cleanName = track.fileName.replace(/\.[^/.]+$/, '');
  if (cleanName.includes(' - ')) return cleanName.split(' - ')[1];
  return cleanName;
};

const getDisplayArtist = (track: Track, metadata?: Partial<Track>) => {
  if (track.artist) return track.artist;
  if (metadata?.artist) return metadata.artist;
  if (track.fileName?.includes(' - ')) return track.fileName.split(' - ')[0];
  return 'Unknown Artist';
};

export function QueuePage() {
  const { t } = useTranslation();
  const { playerState } = useGlobalAudio();
  const { queue, setQueue, currentTrack, isPlaying, playTrack, togglePlay, upcomingQueues, removeUpcomingQueue } = playerState;
  const { favorites, toggleFavorite } = useLibrary();
  const { isAuthenticated } = useAuth();
  const currentTrackIndex = useMemo(() => (
    currentTrack ? queue.findIndex(track => String(track.id) === String(currentTrack.id)) : -1
  ), [currentTrack, queue]);
  const favoriteIds = useMemo(() => new Set(favorites.map(track => String(track.id))), [favorites]);
  const {
    containerRef,
    handleScroll,
    offsetY,
    scrollToIndex,
    totalHeight,
    visibleIndexes,
  } = useVirtualList({
    itemCount: queue.length,
    itemHeight: QUEUE_ITEM_HEIGHT,
  });

  useEffect(() => {
    if (currentTrackIndex >= 0) {
      requestAnimationFrame(() => scrollToIndex(currentTrackIndex, 'smooth'));
    }
  }, [currentTrackIndex, scrollToIndex]);

  const handleRemoveTrack = (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation();
    setQueue(prev => prev.filter(t => t.id !== trackId));
  };

  const handlePlayTrack = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playTrack(track, queue, true);
    }
  };

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  // Favorites are now handled by LibraryContext

  const [infoTrack, setInfoTrack] = useState<Track | null>(null);

  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [tracksToPlaylist, setTracksToPlaylist] = useState<Track[] | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggered = useRef(false);

  const toggleSelection = (index: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIndexes(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handlePointerDown = (index: number, e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    
    isLongPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      setSelectedIndexes(prev => {
        const next = new Set(prev);
        next.add(index);
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

  const handleTrackClick = (track: Track, index: number, e: React.MouseEvent) => {
    if (isLongPressTriggered.current) {
      isLongPressTriggered.current = false;
      return;
    }
    
    if (selectedIndexes.size > 0) {
      toggleSelection(index, e);
      return;
    }

    setOpenMenuIndex(null);
    handlePlayTrack(track);
  };

  const handleBatchRemove = () => {
    setQueue(prev => prev.filter((_, idx) => !selectedIndexes.has(idx)));
    setSelectedIndexes(new Set());
  };

  const handleBatchAddToFavorites = async () => {
    const selectedTracks = Array.from(selectedIndexes).map(idx => queue[idx]).filter(Boolean);
    try {
      await Promise.all(selectedTracks.map(t => {
        const isFav = favoriteIds.has(String(t.id));
        if (!isFav) {
          return toggleFavorite(t);
        }
        return Promise.resolve();
      }));
      setSelectedIndexes(new Set());
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleFavorite = async (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleFavorite(track);
      setOpenMenuIndex(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    setQueue(prev => {
      const newQueue = [...prev];
      const draggedItem = newQueue[draggedIndex];
      newQueue.splice(draggedIndex, 1);
      newQueue.splice(index, 0, draggedItem);
      setDraggedIndex(index);
      return newQueue;
    });
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const moveTrack = (e: React.MouseEvent, index: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    e.stopPropagation();
    setOpenMenuIndex(null);
    if (direction === 'up' && index > 0) {
      setQueue(prev => {
        const newQueue = [...prev];
        [newQueue[index - 1], newQueue[index]] = [newQueue[index], newQueue[index - 1]];
        return newQueue;
      });
    } else if (direction === 'down' && index < queue.length - 1) {
      setQueue(prev => {
        const newQueue = [...prev];
        [newQueue[index], newQueue[index + 1]] = [newQueue[index + 1], newQueue[index]];
        return newQueue;
      });
    } else if (direction === 'top' && index > 0) {
      setQueue(prev => {
        const newQueue = [...prev];
        const item = newQueue.splice(index, 1)[0];
        newQueue.unshift(item);
        return newQueue;
      });
    } else if (direction === 'bottom' && index < queue.length - 1) {
      setQueue(prev => {
        const newQueue = [...prev];
        const item = newQueue.splice(index, 1)[0];
        newQueue.push(item);
        return newQueue;
      });
    }
  };

  return (
    <div className="flex flex-col h-full max-w-7xl 2xl:max-w-none mx-auto pb-28 md:pb-32">
      <div className="mb-6 md:mb-8 border-b border-white/[0.06] pb-4 md:pb-6">
        <h1 className="text-2xl md:text-3xl font-bold font-display text-white tracking-tight">Play Queue</h1>
        <p className="text-slate-400 text-xs md:text-sm font-mono mt-0.5">
          {queue.length} track{queue.length !== 1 ? 's' : ''} in queue
        </p>
      </div>

      <AddToPlaylistModal
        isOpen={!!tracksToPlaylist}
        onClose={() => setTracksToPlaylist(null)}
        isAuthenticated={isAuthenticated}
        track={null}
        tracks={tracksToPlaylist || undefined}
      />

      {selectedIndexes.size > 0 && (
        <div className="sticky top-0 z-20 mb-4 flex flex-wrap items-center justify-between gap-y-2 gap-x-3 bg-[#0c1626]/95 backdrop-blur-xl border border-primary/30 rounded-xl p-3 shadow-2xl mx-2 sm:mx-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="text-primary text-xs font-bold whitespace-nowrap">{selectedIndexes.size} selected</span>
            <button onClick={() => setSelectedIndexes(new Set())} className="text-slate-400 hover:text-white transition-colors shrink-0 p-1" title="Clear selection">
              <X size={16} />
            </button>
            <button
              onClick={() => {
                if (selectedIndexes.size === queue.length && queue.length > 0) {
                  setSelectedIndexes(new Set());
                } else {
                  setSelectedIndexes(new Set(Array.from({ length: queue.length }, (_, i) => i)));
                }
              }}
              className="p-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 px-2.5 text-xs ml-1 shrink-0 whitespace-nowrap"
            >
              {selectedIndexes.size === queue.length && queue.length > 0 ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} />}
              <span className="hidden md:inline">Select All</span>
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ActionMenu
              ariaLabel="Batch actions"
              buttonClassName="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors"
              actions={[
                { label: 'Add to Playlist', icon: <ListPlus size={16} />, onSelect: () => setTracksToPlaylist(Array.from(selectedIndexes).map(idx => queue[idx]).filter(Boolean)) },
                { label: 'Add to Favorites', icon: <Heart size={16} />, onSelect: handleBatchAddToFavorites },
                { label: 'Remove from Queue', icon: <Trash2 size={16} />, onSelect: handleBatchRemove, tone: 'danger' },
              ]}
            />
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        id="queue-page-container"
        className="flex-1 overflow-y-auto relative no-scrollbar"
        onScroll={handleScroll}
      >
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 font-mono text-sm">
            <p>Queue is empty</p>
          </div>
        ) : (
          <div className="relative" style={{ height: totalHeight }}>
            <div
              className="absolute inset-x-0 top-0"
              style={{ transform: `translateY(${offsetY}px)` }}
            >
            {visibleIndexes.map((index) => {
              const track = queue[index];
              if (!track) return null;
              const isCurrent = currentTrack?.id === track.id;
              const isFavorite = favoriteIds.has(String(track.id));

              return (
                <div
                  key={`${track.id}-${index}`}
                  className={`relative ${openMenuIndex === index ? 'z-40' : 'z-0'}`}
                  style={{ height: QUEUE_ITEM_HEIGHT }}
                >
                  <div
                    id={isCurrent ? 'queue-current-track' : undefined}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnter={(e) => handleDragEnter(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onPointerDown={(e) => handlePointerDown(index, e)}
                    onPointerUp={handlePointerUpOrLeave}
                    onPointerCancel={handlePointerUpOrLeave}
                    onMouseLeave={() => {
                      setOpenMenuIndex(null);
                      handlePointerUpOrLeave();
                    }}
                    onContextMenu={(e) => {
                      if (isLongPressTriggered.current || ('ontouchstart' in window && selectedIndexes.size > 0)) {
                        e.preventDefault();
                      }
                    }}
                    onClick={(e) => handleTrackClick(track, index, e)}
                    className={`group flex h-[76px] items-center gap-3 sm:gap-3.5 p-2.5 sm:p-3 rounded-xl transition-all cursor-pointer select-none relative ${openMenuIndex === index ? 'z-40 ring-1 ring-primary/40' : 'z-0'} ${isCurrent
                        ? 'bg-primary/15 border border-primary/30 text-primary shadow-[inset_0_0_15px_rgba(0,245,255,0.1)]'
                        : 'bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-primary/25 backdrop-blur-md'
                      } ${draggedIndex === index ? 'opacity-50' : 'opacity-100'}`}
                  >
                    {selectedIndexes.size > 0 ? (
                      <button
                        onClick={(e) => toggleSelection(index, e)}
                        className="w-5 flex items-center justify-center transition-colors shrink-0"
                      >
                        {selectedIndexes.has(index) ? <CheckSquare size={17} className="text-primary" /> : <Square size={17} className="text-slate-500" />}
                      </button>
                    ) : (
                      <div className="text-slate-600 hover:text-slate-300 cursor-grab active:cursor-grabbing p-1 hidden sm:block shrink-0">
                        <GripVertical size={16} />
                      </div>
                    )}

                    <div className="w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0 bg-slate-800 rounded-lg overflow-hidden relative flex items-center justify-center border border-white/10 shadow-sm">
                      {track.imageUrl || playerState.getTrackImage(track.id) ? (
                        <img src={track.imageUrl || playerState.getTrackImage(track.id)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-500 text-xs font-mono">
                          🎵
                        </div>
                      )}

                      <div className={`absolute inset-0 flex items-center justify-center bg-black/60 transition-opacity ${isCurrent && isPlaying ? 'opacity-100' : 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100'
                      }`}>
                        {isCurrent && isPlaying ? (
                          <div className="flex items-end justify-center gap-0.5 h-3">
                            <span className="w-0.5 bg-primary rounded-full animate-eq-1" />
                            <span className="w-0.5 bg-primary rounded-full animate-eq-2" />
                            <span className="w-0.5 bg-primary rounded-full animate-eq-3" />
                          </div>
                        ) : (
                          <Play size={16} fill="currentColor" className="text-primary ml-0.5" />
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className={`block text-xs sm:text-sm font-semibold truncate ${isCurrent ? 'text-primary' : 'text-slate-100'}`}>
                        {getDisplayTitle(track, playerState.getTrackMetadata(track.id))}
                      </span>
                      <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                        {getDisplayArtist(track, playerState.getTrackMetadata(track.id))} {track.album ? `• ${track.album}` : ''}
                      </p>
                    </div>

                    <div className="relative flex items-center gap-1.5">
                      <button
                        aria-label="More options"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuIndex(openMenuIndex === index ? null : index);
                        }}
                        className={`p-1.5 rounded-lg transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100 ${openMenuIndex === index ? 'text-primary bg-primary/10 opacity-100' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                      >
                        <MoreHorizontal size={17} />
                      </button>

                      {openMenuIndex === index && (
                        <div className="absolute right-0 top-full mt-1.5 w-52 max-w-[calc(100vw_-_2rem)] bg-[#0c1626]/98 border border-white/[0.12] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] overflow-hidden z-50 py-1.5 backdrop-blur-2xl animate-in zoom-in-95 duration-150">
                          <button
                            disabled={index === 0}
                            onClick={(e) => moveTrack(e, index, 'top')}
                            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.08] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronsUp size={14} className="text-primary" /> Move to Top
                          </button>
                          <button
                            disabled={index === 0}
                            onClick={(e) => moveTrack(e, index, 'up')}
                            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.08] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ArrowUp size={14} /> Move Up
                          </button>
                          <button
                            disabled={index === queue.length - 1}
                            onClick={(e) => moveTrack(e, index, 'down')}
                            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.08] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ArrowDown size={14} /> Move Down
                          </button>
                          <button
                            disabled={index === queue.length - 1}
                            onClick={(e) => moveTrack(e, index, 'bottom')}
                            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.08] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronsDown size={14} /> Move to Bottom
                          </button>
                          {track.sourceType !== 'LOCAL' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); downloadTrackFile(track); setOpenMenuIndex(null); }}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.08] hover:text-white transition-colors border-t border-white/[0.04] mt-0.5 pt-2"
                              title="Tải file âm thanh về thiết bị"
                            >
                              <Download size={14} className="text-slate-400" /> {t('tracks.downloadFile', 'Download File')}
                            </button>
                          )}
                          {track.sourceType !== 'LOCAL' && (
                            <button
                              onClick={(e) => handleToggleFavorite(track, e)}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.08] hover:text-white transition-colors"
                            >
                              <Heart size={14} fill={isFavorite ? "currentColor" : "none"} className={isFavorite ? "text-primary" : "text-slate-400"} /> 
                              {isFavorite ? t('tracks.removeFavorite', 'Remove from Favorites') : t('tracks.addFavorite', 'Add to Favorites')}
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setInfoTrack(track); setOpenMenuIndex(null); }}
                            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.08] hover:text-white transition-colors"
                          >
                            <Info size={14} className="text-slate-400" /> {t('tracks.info', 'Info')}
                          </button>
                          <div className="h-px bg-white/[0.06] my-1"></div>
                          <button
                            onClick={(e) => {
                              setOpenMenuIndex(null);
                              handleRemoveTrack(e, track.id);
                            }}
                            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-left text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        </div>
                      )}
                      
                      <button
                        aria-label="Remove from queue"
                        onClick={(e) => handleRemoveTrack(e, track.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-white/10 rounded-lg transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100 hidden sm:block"
                        title="Remove from queue"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}
        {upcomingQueues && upcomingQueues.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold font-display text-white tracking-tight mb-3 flex items-center gap-2">
              <ListPlus size={18} className="text-primary" />
              Upcoming Queues
            </h2>
            <div className="flex flex-col gap-4">
              {upcomingQueues.map((upQueue, qIndex) => (
                <div key={qIndex} className="bg-white/[0.02] rounded-xl p-3 sm:p-4 border border-white/[0.06] backdrop-blur-md">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="font-semibold text-xs font-mono text-slate-300">Queue #{qIndex + 1}</h3>
                    <button 
                      aria-label="Remove this queue"
                      onClick={() => removeUpcomingQueue && removeUpcomingQueue(qIndex)}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                      title="Remove this queue"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {upQueue.map((track, tIndex) => (
                      <div key={`${qIndex}-${track.id}-${tIndex}`} className="flex items-center gap-3 p-2 rounded-lg bg-black/30 border border-white/[0.04]">
                        <div className="w-9 h-9 flex-shrink-0 bg-slate-800 rounded-md overflow-hidden flex items-center justify-center">
                          {track.imageUrl || playerState.getTrackImage(track.id) ? (
                            <img src={track.imageUrl || playerState.getTrackImage(track.id)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">🎵</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="block text-xs font-semibold text-slate-200 truncate">{track.title || playerState.getTrackMetadata(track.id)?.title || track.fileName}</span>
                          <p className="text-[11px] font-mono text-slate-400 truncate">{track.artist || playerState.getTrackMetadata(track.id)?.artist || 'Unknown Artist'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Info Modal */}
      {infoTrack && (
        <TrackInfoModal
          track={infoTrack}
          trackMetadata={playerState.getTrackMetadata(infoTrack.id)}
          onClose={() => setInfoTrack(null)}
        />
      )}
    </div>
  );
}
