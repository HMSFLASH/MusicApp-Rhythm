import { useState, useEffect } from 'react';
import { useGlobalAudio } from '../context/AudioContext';
import { Play, Pause, Trash2, GripVertical, MoreHorizontal, ArrowUp, ArrowDown, ListPlus, Heart, Info, X, ChevronsUp, ChevronsDown } from 'lucide-react';
import type { Track } from '../hooks/useAudioPlayer';
import { axiosClient } from '../api/axiosClient';

export function QueuePage() {
  const { playerState, jwtToken } = useGlobalAudio();
  const { queue, setQueue, currentTrack, isPlaying, playTrack, togglePlay, upcomingQueues, removeUpcomingQueue } = playerState;

  useEffect(() => {
    if (currentTrack) {
      // Delay geometric querying to prevent forced synchronous layout
      requestAnimationFrame(() => {
        const el = document.getElementById('queue-current-track');
        const container = document.getElementById('queue-page-container');
        if (el && container) {
          container.scrollTo({
            top: el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2,
            behavior: 'smooth'
          });
        }
      });
    }
  }, [currentTrack]);

  const handleRemoveTrack = (e: React.MouseEvent, trackId: string | number) => {
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
  const [favorites, setFavorites] = useState<Track[]>([]);
  const [infoTrack, setInfoTrack] = useState<Track | null>(null);

  useEffect(() => {
    if (!jwtToken) return;
    
    const cachedFavs = localStorage.getItem('sonic_favorites');
    if (cachedFavs) {
      // eslint-disable-next-line react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, no-empty
      try { setFavorites(JSON.parse(cachedFavs)); } catch (e) { }
    }

    axiosClient.get('/api/favorites')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((data: any) => {
        const parsed = data.length > 0
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? data.map((d: any) => ({ id: d.id, fileName: d.name, sourceType: d.sourceType, imageUrl: d.imageUrl, artist: d.artist, title: d.title, album: d.album, genre: d.genre, durationSeconds: d.durationSeconds }))
          : [];
        setFavorites(parsed);
        localStorage.setItem('sonic_favorites', JSON.stringify(parsed));
      })
      .catch(() => setFavorites([]));
  }, [jwtToken]);

  const toggleFavorite = async (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    const isFav = favorites.some(f => f.id === track.id);
    try {
      if (isFav) {
        await axiosClient.delete(`/api/favorites/${track.id}`);
        setFavorites(prev => {
          const newFavs = prev.filter(f => f.id !== track.id);
          localStorage.setItem('sonic_favorites', JSON.stringify(newFavs));
          return newFavs;
        });
      } else {
        await axiosClient.post(`/api/favorites/${track.id}`);
        setFavorites(prev => {
          const newFavs = [...prev, track];
          localStorage.setItem('sonic_favorites', JSON.stringify(newFavs));
          return newFavs;
        });
      }
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
    <div className="flex flex-col h-full max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-6 md:mb-8 border-b border-white/10 pb-4 md:pb-6">
        <h1 className="text-2xl md:text-3xl font-bold font-sans text-white tracking-tight">Play Queue</h1>
        <p className="text-secondary/60 text-sm font-mono mt-1">
          {queue.length} track{queue.length !== 1 ? 's' : ''} in queue
        </p>
      </div>

      <div id="queue-page-container" className="flex-1 overflow-y-auto relative">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-white/40">
            <p>Queue is empty</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {queue.map((track, index) => {
              const isCurrent = currentTrack?.id === track.id;

              return (
                <div
                  key={`${track.id}-${index}`}
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
                  className={`group flex items-center gap-4 p-3 rounded-xl transition-all cursor-pointer ${isCurrent
                      ? 'bg-primary/20 border border-primary/30'
                      : 'hover:bg-white/5 border border-transparent'
                    } ${draggedIndex === index ? 'opacity-50' : 'opacity-100'}`}
                >
                  <div className="text-white/20 hover:text-white/60 cursor-grab active:cursor-grabbing p-1 hidden sm:block">
                    <GripVertical size={16} />
                  </div>

                  <div className="w-12 h-12 flex-shrink-0 bg-white/5 rounded-lg overflow-hidden relative flex items-center justify-center">
                    {track.imageUrl || playerState.getTrackImage(track.id) ? (
                      <img src={track.imageUrl || playerState.getTrackImage(track.id)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-white/5 flex items-center justify-center text-white/20">
                        🎵
                      </div>
                    )}

                    <div className={`absolute inset-0 flex items-center justify-center bg-black/60 transition-opacity ${isCurrent && isPlaying ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'
                      }`}>
                      {isCurrent && isPlaying ? (
                        <Pause size={20} className="text-primary fill-primary" />
                      ) : (
                        <Play size={20} className="text-white fill-white ml-1" />
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className={`text-base font-medium truncate ${isCurrent ? 'text-primary' : 'text-white'}`}>
                      {track.title || playerState.getTrackMetadata(track.id)?.title || (track.fileName ? (track.fileName.includes(' - ') ? track.fileName.split(' - ')[1].replace(/\.[^/.]+$/, "") : track.fileName.replace(/\.[^/.]+$/, "")) : 'Unknown Title')}
                    </h4>
                    <p className="text-sm text-white/50 truncate">
                      {track.artist || playerState.getTrackMetadata(track.id)?.artist || (track.fileName?.includes(' - ') ? track.fileName.split(' - ')[0] : 'Unknown Artist')} {track.album ? `• ${track.album}` : ''}
                    </p>
                  </div>

                  <div className="relative flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuIndex(openMenuIndex === index ? null : index);
                      }}
                      className="p-2 text-white/30 hover:text-white hover:bg-white/10 rounded-full transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                    >
                      <MoreHorizontal size={18} />
                    </button>

                    {openMenuIndex === index && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-[#1A1A1A] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50 py-1">
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
                        <button
                          onClick={(e) => toggleFavorite(track, e)}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left text-white/80 hover:bg-white/10"
                        >
                          <Heart size={14} fill={favorites.some(f => f.id === track.id) ? "currentColor" : "none"} className={favorites.some(f => f.id === track.id) ? "text-primary" : ""} /> 
                          {favorites.some(f => f.id === track.id) ? "Remove from Favorites" : "Add to Favorites"}
                        </button>
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
                      onClick={(e) => handleRemoveTrack(e, track.id)}
                      className="p-2 text-white/30 hover:text-red-400 hover:bg-white/10 rounded-full transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 hidden sm:block"
                      title="Remove from queue"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
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
                <div key={qIndex} className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white/80">Queue #{qIndex + 1}</h3>
                    <button 
                      onClick={() => removeUpcomingQueue && removeUpcomingQueue(qIndex)}
                      className="text-white/40 hover:text-red-400 transition-colors"
                      title="Remove this queue"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {upQueue.map((track, tIndex) => (
                      <div key={`${qIndex}-${track.id}-${tIndex}`} className="flex items-center gap-4 p-2 rounded-lg bg-black/20">
                        <div className="w-10 h-10 flex-shrink-0 bg-white/5 rounded-md overflow-hidden">
                          {track.imageUrl || playerState.getTrackImage(track.id) ? (
                            <img src={track.imageUrl || playerState.getTrackImage(track.id)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">🎵</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-white truncate">{track.title || playerState.getTrackMetadata(track.id)?.title || track.fileName}</h4>
                          <p className="text-xs text-white/50 truncate">{track.artist || playerState.getTrackMetadata(track.id)?.artist || 'Unknown Artist'}</p>
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
            className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div className="flex items-center gap-3 text-white">
                <Info size={24} className="text-primary" />
                <h3 className="font-semibold text-lg">Track Metadata</h3>
              </div>
              <button
                onClick={() => setInfoTrack(null)}
                className="text-white/40 hover:text-white transition-colors p-1"
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
