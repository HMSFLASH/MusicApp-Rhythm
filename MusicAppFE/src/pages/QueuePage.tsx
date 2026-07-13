import { useState, useEffect, useMemo } from 'react';
import { useGlobalAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import { Play, Pause, Trash2, GripVertical, MoreHorizontal, ArrowUp, ArrowDown, ListPlus, Heart, Info, X, ChevronsUp, ChevronsDown } from 'lucide-react';
import type { Track } from '../hooks/useAudioPlayer';
import { useVirtualList } from '../hooks/useVirtualList';

const QUEUE_ITEM_HEIGHT = 84;

export function QueuePage() {
  const { playerState } = useGlobalAudio();
  const { queue, setQueue, currentTrack, isPlaying, playTrack, togglePlay, upcomingQueues, removeUpcomingQueue } = playerState;
  const { favorites, toggleFavorite } = useLibrary();
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
      <div className="mb-6 md:mb-8 border-b border-white/10 pb-4 md:pb-6">
        <h1 className="text-2xl md:text-3xl font-bold font-sans text-white tracking-tight">Play Queue</h1>
        <p className="text-secondary/60 text-sm font-mono mt-1">
          {queue.length} track{queue.length !== 1 ? 's' : ''} in queue
        </p>
      </div>

      <div
        ref={containerRef}
        id="queue-page-container"
        className="flex-1 overflow-y-auto relative"
        onScroll={handleScroll}
      >
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-white/60">
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
                  className="relative"
                  style={{ height: QUEUE_ITEM_HEIGHT }}
                >
                  <div
                    id={isCurrent ? 'queue-current-track' : undefined}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnter={(e) => handleDragEnter(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onClick={() => {
                      setOpenMenuIndex(null);
                      handlePlayTrack(track);
                    }}
                    className={`group flex h-[76px] items-center gap-3 sm:gap-4 p-3 rounded-xl transition-all cursor-pointer ${isCurrent
                        ? 'bg-primary/20 border border-primary/30'
                        : 'hover:bg-white/5 border border-transparent'
                      } ${draggedIndex === index ? 'opacity-50' : 'opacity-100'}`}
                  >
                    <div className="text-white/20 hover:text-white/60 cursor-grab active:cursor-grabbing p-1 hidden sm:block">
                      <GripVertical size={16} />
                    </div>

                    <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 bg-white/5 rounded-lg overflow-hidden relative flex items-center justify-center">
                      {track.imageUrl || playerState.getTrackImage(track.id) ? (
                        <img src={track.imageUrl || playerState.getTrackImage(track.id)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-white/5 flex items-center justify-center text-white/40">
                          🎵
                        </div>
                      )}

                      <div className={`absolute inset-0 flex items-center justify-center bg-black/60 transition-opacity ${isCurrent && isPlaying ? 'opacity-100' : 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100'
                      }`}>
                        {isCurrent && isPlaying ? (
                          <Pause size={20} className="text-primary fill-primary" />
                        ) : (
                          <Play size={20} className="text-white fill-white ml-1" />
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className={`block text-sm sm:text-base font-medium truncate ${isCurrent ? 'text-primary' : 'text-white'}`}>
                        {track.title || playerState.getTrackMetadata(track.id)?.title || (track.fileName ? (track.fileName.includes(' - ') ? track.fileName.split(' - ')[1].replace(/\.[^/.]+$/, "") : track.fileName.replace(/\.[^/.]+$/, "")) : 'Unknown Title')}
                      </span>
                      <p className="text-xs sm:text-sm text-white/60 truncate">
                        {track.artist || playerState.getTrackMetadata(track.id)?.artist || (track.fileName?.includes(' - ') ? track.fileName.split(' - ')[0] : 'Unknown Artist')} {track.album ? `• ${track.album}` : ''}
                      </p>
                    </div>

                    <div className="relative flex items-center gap-2">
                      <button
                        aria-label="More options"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuIndex(openMenuIndex === index ? null : index);
                        }}
                        className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                      >
                        <MoreHorizontal size={18} />
                      </button>

                      {openMenuIndex === index && (
                        <div className="absolute right-0 top-full mt-1 w-44 max-w-[calc(100vw_-_2rem)] bg-[#1A1A1A] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50 py-1">
                          <button
                            disabled={index === 0}
                            onClick={(e) => moveTrack(e, index, 'top')}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left text-white/80 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronsUp size={14} /> Move to Top
                          </button>
                          <button
                            disabled={index === 0}
                            onClick={(e) => moveTrack(e, index, 'up')}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left text-white/80 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ArrowUp size={14} /> Move Up
                          </button>
                          <button
                            disabled={index === queue.length - 1}
                            onClick={(e) => moveTrack(e, index, 'down')}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left text-white/80 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ArrowDown size={14} /> Move Down
                          </button>
                          <button
                            disabled={index === queue.length - 1}
                            onClick={(e) => moveTrack(e, index, 'bottom')}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left text-white/80 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronsDown size={14} /> Move to Bottom
                          </button>
                          {track.sourceType !== 'LOCAL' && (
                            <button
                              onClick={(e) => handleToggleFavorite(track, e)}
                              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left text-white/80 hover:bg-white/10"
                            >
                              <Heart size={14} fill={isFavorite ? "currentColor" : "none"} className={isFavorite ? "text-primary" : ""} /> 
                              {isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setInfoTrack(track); setOpenMenuIndex(null); }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left text-white/80 hover:bg-white/10"
                          >
                            <Info size={14} /> Info
                          </button>
                          <div className="h-px bg-white/10 my-1"></div>
                          <button
                            onClick={(e) => {
                              setOpenMenuIndex(null);
                              handleRemoveTrack(e, track.id);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left text-red-400 hover:bg-white/10"
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        </div>
                      )}
                      
                      <button
                        aria-label="Remove from queue"
                        onClick={(e) => handleRemoveTrack(e, track.id)}
                        className="p-2 text-white/60 hover:text-red-400 hover:bg-white/10 rounded-full transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100 hidden sm:block"
                        title="Remove from queue"
                      >
                        <Trash2 size={18} />
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
            <h2 className="text-xl font-bold font-sans text-white tracking-tight mb-4 flex items-center gap-2">
              <ListPlus size={20} className="text-primary" />
              Upcoming Queues
            </h2>
            <div className="flex flex-col gap-6">
              {upcomingQueues.map((upQueue, qIndex) => (
                <div key={qIndex} className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="font-semibold text-white/80">Queue #{qIndex + 1}</h3>
                    <button 
                      aria-label="Remove this queue"
                      onClick={() => removeUpcomingQueue && removeUpcomingQueue(qIndex)}
                      className="text-white/60 hover:text-red-400 transition-colors"
                      title="Remove this queue"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {upQueue.map((track, tIndex) => (
                      <div key={`${qIndex}-${track.id}-${tIndex}`} className="flex items-center gap-3 sm:gap-4 p-2 rounded-lg bg-black/20">
                        <div className="w-10 h-10 flex-shrink-0 bg-white/5 rounded-md overflow-hidden">
                          {track.imageUrl || playerState.getTrackImage(track.id) ? (
                            <img src={track.imageUrl || playerState.getTrackImage(track.id)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">🎵</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-white truncate">{track.title || playerState.getTrackMetadata(track.id)?.title || track.fileName}</span>
                          <p className="text-xs text-white/60 truncate">{track.artist || playerState.getTrackMetadata(track.id)?.artist || 'Unknown Artist'}</p>
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
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setInfoTrack(null)}
        >
          <div
            className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div className="flex items-center gap-3 text-white">
                <Info size={24} className="text-primary" />
                <h2 className="font-semibold text-lg">Track Metadata</h2>
              </div>
              <button
                aria-label="Close info"
                onClick={() => setInfoTrack(null)}
                className="text-white/60 hover:text-white transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
              <div className="bg-white/5 rounded-xl p-4 flex flex-col gap-3">
                {[
                  { label: 'Title', value: infoTrack.title || playerState.getTrackMetadata(infoTrack.id)?.title },
                  { label: 'Artist', value: infoTrack.artist || playerState.getTrackMetadata(infoTrack.id)?.artist },
                  { label: 'Album', value: infoTrack.album || playerState.getTrackMetadata(infoTrack.id)?.album },
                  { label: 'Genre', value: infoTrack.genre || playerState.getTrackMetadata(infoTrack.id)?.genre },
                  { label: 'Duration', value: infoTrack.durationSeconds ? `${Math.floor(infoTrack.durationSeconds / 60)}:${Math.floor(infoTrack.durationSeconds % 60).toString().padStart(2, '0')}` : null },
                  { label: 'File Name', value: infoTrack.fileName },
                  { label: 'Source', value: infoTrack.sourceType },
                  { label: 'Track ID', value: String(infoTrack.id) },
                  { label: 'File Type', value: infoTrack.fileFormat || playerState.getTrackMetadata(infoTrack.id)?.fileFormat },
                  { label: 'Codec', value: infoTrack.codec || playerState.getTrackMetadata(infoTrack.id)?.codec },
                  // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
                  { label: 'Size', value: (infoTrack.fileSize || playerState.getTrackMetadata(infoTrack.id)?.fileSize) ? `${((infoTrack.fileSize || playerState.getTrackMetadata(infoTrack.id)?.fileSize!) / 1024 / 1024).toFixed(2)} MB` : null },
                  // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
                  { label: 'Bit Rate', value: (infoTrack.bitrate || playerState.getTrackMetadata(infoTrack.id)?.bitrate) ? `${Math.round((infoTrack.bitrate || playerState.getTrackMetadata(infoTrack.id)?.bitrate!) / 1000)} kbps` : null },
                  // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
                  { label: 'Channels', value: (infoTrack.numberOfChannels || playerState.getTrackMetadata(infoTrack.id)?.numberOfChannels) ? `${infoTrack.numberOfChannels || playerState.getTrackMetadata(infoTrack.id)?.numberOfChannels} ${[2].includes(infoTrack.numberOfChannels || playerState.getTrackMetadata(infoTrack.id)?.numberOfChannels!) ? '(stereo)' : ''}` : null },
                  // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
                  { label: 'Audio Sample Rate', value: (infoTrack.sampleRate || playerState.getTrackMetadata(infoTrack.id)?.sampleRate) ? `${((infoTrack.sampleRate || playerState.getTrackMetadata(infoTrack.id)?.sampleRate!) / 1000).toFixed(3)} kHz` : null },
                  { label: 'Bit Depth', value: (infoTrack.bitsPerSample || playerState.getTrackMetadata(infoTrack.id)?.bitsPerSample) ? `${infoTrack.bitsPerSample || playerState.getTrackMetadata(infoTrack.id)?.bitsPerSample} bit` : null }
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">{item.label}</span>
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
