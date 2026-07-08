import type { QueueEndMode, Track } from './audioTypes';

export const getCurrentTrackIndex = (currentTrack: Track | null, queue: Track[]) => (
  currentTrack
    ? queue.findIndex((track) => String(track.id) === String(currentTrack.id))
    : -1
);

export const getAdjacentTrackWindow = (
  currentId: string | number,
  currentQueue: Track[]
) => {
  const allowedIds = new Set<string>();
  const currentTrackId = String(currentId);
  allowedIds.add(currentTrackId);

  let prev1: Track | undefined;
  let next1: Track | undefined;
  const idx = currentQueue.findIndex((track) => String(track.id) === currentTrackId);

  if (idx !== -1) {
    prev1 = currentQueue[idx - 1];
    next1 = currentQueue[idx + 1];

    if (!prev1 && currentQueue.length > 0) prev1 = currentQueue[currentQueue.length - 1];
    if (!next1 && currentQueue.length > 0) next1 = currentQueue[0];

    if (prev1) allowedIds.add(String(prev1.id));
    if (next1) allowedIds.add(String(next1.id));
  }

  return { allowedIds, prev1, next1 };
};

type PlaybackAvailabilityOptions = {
  currentTrack: Track | null;
  queue: Track[];
  queueEndMode: QueueEndMode;
  upcomingQueues?: Track[][];
  cycleQueues?: boolean;
};

export const getPlaybackAvailability = ({
  currentTrack,
  queue,
  queueEndMode,
  upcomingQueues,
  cycleQueues,
}: PlaybackAvailabilityOptions) => {
  const currentIdx = getCurrentTrackIndex(currentTrack, queue);
  const hasPrevious = currentIdx > 0 || (
    currentIdx === 0 &&
    queueEndMode === 'repeat' &&
    queue.length > 1
  );
  const hasNext = currentIdx !== -1 && (
    currentIdx < queue.length - 1 ||
    (queueEndMode === 'repeat' && queue.length > 1) ||
    (queueEndMode === 'next' && Boolean(upcomingQueues?.length)) ||
    (queueEndMode === 'next' && Boolean(cycleQueues) && queue.length > 0)
  );

  return { currentIdx, hasPrevious, hasNext };
};
