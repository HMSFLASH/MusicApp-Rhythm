import type { Track } from './audioTypes';

export const DRIVE_MEDIA_URL = 'https://www.googleapis.com/drive/v3/files';
export const MAX_PRECALCULATED_BUFFER_CACHE_SIZE = 3;
export const MAX_RENDER_SIGNATURE_CACHE_ENTRIES = 24;

export type LoadingTrackPhase = 'downloading' | 'processing';

export type QueuePrecalculateStatus = {
  isRunning: boolean;
  total: number;
  completed: number;
  failed: number;
  cores: number;
};

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
