import type { Track } from '../hooks/audioTypes';

export interface MultiQueue {
  id: string;
  name: string;
  tracks: Track[];
  currentTrackId?: string | null;
  createdAt: number;
}

export const MAX_QUEUES = 20;
const STORAGE_KEY = 'SONIC_MUSICOLET_MULTI_QUEUES_V1';
const ACTIVE_QUEUE_ID_KEY = 'SONIC_ACTIVE_QUEUE_ID_V1';

export const loadMultiQueues = (currentDefaultQueue: Track[] = []): { queues: MultiQueue[]; activeQueueId: string } => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let queues: MultiQueue[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(queues) || queues.length === 0) {
      queues = [
        {
          id: 'queue-1',
          name: 'Hàng Đợi 1 (Chính)',
          tracks: currentDefaultQueue,
          currentTrackId: null,
          createdAt: Date.now(),
        },
      ];
    }
    const savedActiveId = localStorage.getItem(ACTIVE_QUEUE_ID_KEY) || queues[0].id;
    const activeExists = queues.some((q) => q.id === savedActiveId);
    const activeQueueId = activeExists ? savedActiveId : queues[0].id;
    return { queues, activeQueueId };
  } catch {
    const defaultQueues: MultiQueue[] = [
      {
        id: 'queue-1',
        name: 'Hàng Đợi 1 (Chính)',
        tracks: currentDefaultQueue,
        currentTrackId: null,
        createdAt: Date.now(),
      },
    ];
    return { queues: defaultQueues, activeQueueId: 'queue-1' };
  }
};

export const saveMultiQueues = (queues: MultiQueue[], activeQueueId: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queues));
    localStorage.setItem(ACTIVE_QUEUE_ID_KEY, activeQueueId);
  } catch (err) {
    console.error('Failed to save multi-queues', err);
  }
};

export const addTracksToTargetQueue = (
  targetQueueId: string,
  tracksToAdd: Track[],
  mode: 'end' | 'next' | 'replace' = 'end',
  currentPlayingTrackId?: string | null
): { queues: MultiQueue[]; activeQueueId: string } => {
  const { queues, activeQueueId } = loadMultiQueues();
  const queueIndex = queues.findIndex((q) => q.id === targetQueueId);
  if (queueIndex === -1) return { queues, activeQueueId };

  const targetQueue = { ...queues[queueIndex] };
  let newTracks = [...targetQueue.tracks];

  if (mode === 'replace') {
    newTracks = [...tracksToAdd];
  } else if (mode === 'next') {
    const currentIdx = newTracks.findIndex((t) => String(t.id) === String(currentPlayingTrackId));
    if (currentIdx !== -1) {
      newTracks.splice(currentIdx + 1, 0, ...tracksToAdd);
    } else {
      newTracks.unshift(...tracksToAdd);
    }
  } else {
    // mode === 'end'
    const existingIds = new Set(newTracks.map((t) => String(t.id)));
    const filtered = tracksToAdd.filter((t) => !existingIds.has(String(t.id)));
    newTracks.push(...filtered);
  }

  targetQueue.tracks = newTracks;
  const updatedQueues = [...queues];
  updatedQueues[queueIndex] = targetQueue;

  saveMultiQueues(updatedQueues, activeQueueId);
  return { queues: updatedQueues, activeQueueId };
};
