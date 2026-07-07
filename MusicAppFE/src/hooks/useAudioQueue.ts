import { useState, useCallback, useEffect } from 'react';
import type { Track, SongEndMode, QueueEndMode } from './audioTypes';
import { PLAYBACK_STORAGE_KEY } from './audioStorage';

export function useAudioQueue(initialPlayback: { currentTrack: Track | null; queue: Track[] }, savedState: any) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(initialPlayback.currentTrack);
  const [queue, setQueue] = useState<Track[]>(initialPlayback.queue);

  useEffect(() => {
    localStorage.setItem(PLAYBACK_STORAGE_KEY, JSON.stringify({ currentTrack, queue }));
  }, [currentTrack, queue]);

  const [isShuffleState, setIsShuffleState] = useState<boolean>(savedState.isShuffleState ?? false);
  const [originalQueue, setOriginalQueue] = useState<Track[]>([]);
  
  const [songEndMode, setSongEndMode] = useState<SongEndMode>(savedState.songEndMode ?? 'next');
  const [queueEndMode, setQueueEndMode] = useState<QueueEndMode>(savedState.queueEndMode ?? 'stop');
  const [repeatMode, setRepeatMode] = useState<'simple' | 'advanced'>(savedState.repeatMode ?? 'simple');
  const [upcomingQueues, setUpcomingQueues] = useState<Track[][]>(savedState.upcomingQueues || []);
  const [continueFromLast, setContinueFromLast] = useState<boolean>(savedState.continueFromLast || false);
  const [cycleQueues, setCycleQueues] = useState<boolean>(savedState.cycleQueues || false);

  const setIsShuffle = useCallback((newShuffle: boolean | ((prev: boolean) => boolean)) => {
    setIsShuffleState(prev => {
      const next = typeof newShuffle === 'function' ? newShuffle(prev) : newShuffle;
      if (next && !prev) {
        setQueue(currentQueue => {
          setOriginalQueue([...currentQueue]);
          let newQueue = [...currentQueue];
          const currentIdx = currentTrack ? newQueue.findIndex(t => String(t.id) === String(currentTrack.id)) : -1;

          if (currentIdx !== -1) {
            const current = newQueue[currentIdx];
            const rest = [...newQueue.slice(0, currentIdx), ...newQueue.slice(currentIdx + 1)];

            for (let i = rest.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [rest[i], rest[j]] = [rest[j], rest[i]];
            }

            newQueue = [current, ...rest];
          } else {
            for (let i = newQueue.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [newQueue[i], newQueue[j]] = [newQueue[j], newQueue[i]];
            }
          }
          return newQueue;
        });
      } else if (!next && prev) {
        setQueue(currentQueue => {
          if (originalQueue.length > 0) return [...originalQueue];
          return currentQueue;
        });
      }
      return next;
    });
  }, [currentTrack, originalQueue]);

  const addToCurrentQueue = useCallback((tracks: Track[]) => {
    setQueue(prev => {
      const existingIds = new Set(prev.map(t => t.id));
      const newTracks = tracks.filter(t => !existingIds.has(t.id));
      return [...prev, ...newTracks];
    });
  }, []);

  const addToNextQueue = useCallback((tracks: Track[]) => {
    setUpcomingQueues(prev => {
      const isDuplicate = prev.some(q => q.length === tracks.length && q.every((t, i) => t.id === tracks[i].id));
      if (isDuplicate) return prev;
      return [...prev, tracks];
    });
  }, []);

  const removeUpcomingQueue = useCallback((index: number) => {
    setUpcomingQueues(prev => {
      const copy = [...prev];
      copy.splice(index, 1);
      return copy;
    });
  }, []);

  return {
    currentTrack, setCurrentTrack,
    queue, setQueue,
    isShuffleState, setIsShuffle,
    originalQueue, setOriginalQueue,
    songEndMode, setSongEndMode,
    queueEndMode, setQueueEndMode,
    repeatMode, setRepeatMode,
    upcomingQueues, setUpcomingQueues,
    continueFromLast, setContinueFromLast,
    cycleQueues, setCycleQueues,
    addToCurrentQueue,
    addToNextQueue,
    removeUpcomingQueue
  };
}
