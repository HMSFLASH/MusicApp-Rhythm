import { useState, useEffect } from 'react';
import { useGlobalAudio } from '../context/AudioContext';
import { Play, Pause, Trash2, GripVertical, MoreHorizontal, ArrowUp, ArrowDown, ListPlus } from 'lucide-react';
import type { Track } from '../hooks/useAudioPlayer';

export function QueuePage() {
  const { playerState } = useGlobalAudio();
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

  const moveTrack = (e: React.MouseEvent, index: number, direction: 'up' | 'down') => {
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
    }
  };

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-8 border-b border-white/10 pb-6">
        <h1 className="text-3xl font-bold font-sans text-white tracking-tight">Play Queue</h1>
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
                    {track.imageUrl ? (
                      <img src={track.imageUrl} alt="" className="w-full h-full object-cover" />
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
                      {track.title || track.fileName}
                    </h4>
                    <p className="text-sm text-white/50 truncate">
                      {track.artist || 'Unknown Artist'} {track.album ? `• ${track.album}` : ''}
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
                          {track.imageUrl ? (
                            <img src={track.imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">🎵</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-white truncate">{track.title || track.fileName}</h4>
                          <p className="text-xs text-white/50 truncate">{track.artist || 'Unknown Artist'}</p>
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
    </div>
  );
}
