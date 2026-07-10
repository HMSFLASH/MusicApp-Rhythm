import { useState, useCallback, useEffect } from 'react';
import type { Track, SongEndMode, QueueEndMode } from './audioTypes';
import { PLAYBACK_STORAGE_KEY } from './audioStorage';
import { db } from '../lib/db';

type SavedAudioQueueState = Partial<{
  isShuffleState: boolean;
  songEndMode: SongEndMode;
  queueEndMode: QueueEndMode;
  repeatMode: 'simple' | 'advanced';
  upcomingQueues: Track[][];
  cycleQueues: boolean;
}>;

const isTrackAllowedByLibrary = (track: Track, validIds: Set<string>) => (
  track.sourceType === 'LOCAL' || validIds.has(String(track.id))
);

const filterUpcomingQueues = (
  queues: Track[][],
  predicate: (track: Track) => boolean
) => queues
  .map((candidateQueue) => candidateQueue.filter(predicate))
  .filter((candidateQueue) => candidateQueue.length > 0);

export function useAudioQueue(savedState: SavedAudioQueueState, isAuthenticated: boolean) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isShuffleState, setIsShuffleState] = useState<boolean>(savedState.isShuffleState ?? false);
  const [originalQueue, setOriginalQueue] = useState<Track[]>([]);
  const [songEndMode, setSongEndMode] = useState<SongEndMode>(savedState.songEndMode ?? 'next');
  const [queueEndMode, setQueueEndMode] = useState<QueueEndMode>(savedState.queueEndMode ?? 'stop');
  const [repeatMode, setRepeatMode] = useState<'simple' | 'advanced'>(savedState.repeatMode ?? 'simple');
  const [upcomingQueues, setUpcomingQueues] = useState<Track[][]>(savedState.upcomingQueues || []);
  const [cycleQueues, setCycleQueues] = useState<boolean>(savedState.cycleQueues || false);

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      void db.remove(PLAYBACK_STORAGE_KEY).finally(() => {
        if (cancelled) return;
        setCurrentTrack(null);
        setQueue([]);
        setOriginalQueue([]);
        setUpcomingQueues([]);
        setLoaded(true);
      });

      return () => {
        cancelled = true;
      };
    }

    void Promise.resolve()
      .then(() => {
        if (!cancelled) setLoaded(false);
        return db.get<{currentTrack: Track | null, queue: Track[]}>(PLAYBACK_STORAGE_KEY);
      })
      .then(saved => {
        if (cancelled) return;
        if (saved) {
          let parsedQueue = saved.queue || [];
          let parsedTrack = saved.currentTrack || null;
        
          parsedQueue = parsedQueue.filter((track) => track.sourceType !== 'LOCAL');
          parsedQueue.forEach((track) => {
            if (track.imageUrl?.startsWith('blob:')) track.imageUrl = '';
          });

          if (parsedTrack) {
            if (parsedTrack.sourceType === 'LOCAL') {
              parsedTrack = parsedQueue.length > 0 ? parsedQueue[0] : null;
            } else if (parsedTrack.imageUrl?.startsWith('blob:')) {
              parsedTrack.imageUrl = '';
            }
          }
        
          setQueue(parsedQueue);
          setCurrentTrack(parsedTrack);
        }
        setLoaded(true);
      })
      .catch((error) => {
        console.error('Failed to load playback state from IndexedDB', error);
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (loaded && isAuthenticated) {
      db.set(PLAYBACK_STORAGE_KEY, { currentTrack, queue });
    }
  }, [currentTrack, queue, loaded, isAuthenticated]);

  useEffect(() => {
    const handleMusicDeleted = (e: Event) => {
      const deletedId = (e as CustomEvent).detail;
      if (!deletedId) return;

      setQueue(prev => prev.filter(t => String(t.id) !== String(deletedId)));
      setOriginalQueue(prev => prev.filter(t => String(t.id) !== String(deletedId)));
      setUpcomingQueues(prev => filterUpcomingQueues(
        prev,
        (track) => String(track.id) !== String(deletedId)
      ));
    };

    const handleLibraryRefreshed = (e: Event) => {
      const trackIds = (e as CustomEvent<{ trackIds?: Array<string> }>).detail?.trackIds;
      if (!Array.isArray(trackIds)) return;

      const validIds = new Set(trackIds.map(String));
      const isAllowed = (track: Track) => isTrackAllowedByLibrary(track, validIds);

      setQueue(prev => prev.filter(isAllowed));
      setOriginalQueue(prev => prev.filter(isAllowed));
      setUpcomingQueues(prev => filterUpcomingQueues(prev, isAllowed));
    };

    window.addEventListener('music-deleted', handleMusicDeleted);
    window.addEventListener('music-library-refreshed', handleLibraryRefreshed);
    return () => {
      window.removeEventListener('music-deleted', handleMusicDeleted);
      window.removeEventListener('music-library-refreshed', handleLibraryRefreshed);
    };
  }, [setOriginalQueue, setUpcomingQueues]);

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
  }, [currentTrack, originalQueue, setOriginalQueue]);

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
  }, [setUpcomingQueues]);

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
    cycleQueues, setCycleQueues,
    addToCurrentQueue,
    addToNextQueue,
    removeUpcomingQueue
  };
}
