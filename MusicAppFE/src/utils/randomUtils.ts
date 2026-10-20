/**
 * Cryptographically secure random utilities using Web Crypto API.
 */

/**
 * Returns a pseudo-random floating point number between 0 (inclusive) and 1 (exclusive).
 * Drop-in replacement for Math.random() that satisfies SonarQube typescript:S2245.
 */
export const getSecureRandom = (): number => {
  const array = new Uint32Array(1);
  globalThis.crypto.getRandomValues(array);
  return array[0] / (0xffffffff + 1);
};

/**
 * Returns a cryptographically secure random string ID.
 */
export const getSecureRandomId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const array = new Uint8Array(16);
  globalThis.crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Unbiased Fisher-Yates (Knuth) copy shuffle using cryptographically secure random integers.
 */
export const fisherYatesShuffle = <T>(array: readonly T[]): T[] => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(getSecureRandom() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
};

export interface SmartShuffleOptions {
  startTrackId?: string | number;
  avoidRepeatLastId?: string | number;
}

/**
 * Smart Balanced Shuffle with Artist/Album De-clustering (Fair Shuffle).
 * - Avoids consecutive songs from the same artist/album when possible.
 * - If startTrackId is provided, that track is placed at index 0.
 * - If avoidRepeatLastId is provided, ensures the new cycle starts with a different song.
 */
export const smartShuffleTracks = <T extends { id: string | number; artist?: string; album?: string }>(
  tracks: readonly T[],
  options: SmartShuffleOptions = {}
): T[] => {
  if (!tracks || tracks.length <= 2) {
    if (!tracks || tracks.length <= 1) return tracks ? [...tracks] : [];
    const [t0, t1] = tracks;
    if (options.startTrackId !== undefined) {
      return String(t0.id) === String(options.startTrackId) ? [t0, t1] : [t1, t0];
    }
    return getSecureRandom() < 0.5 ? [t0, t1] : [t1, t0];
  }

  const pool = [...tracks];
  let startTrack: T | undefined;

  // 1. Separate starting track if specified
  if (options.startTrackId !== undefined) {
    const startIdx = pool.findIndex(t => String(t.id) === String(options.startTrackId));
    if (startIdx !== -1) {
      startTrack = pool[startIdx];
      pool.splice(startIdx, 1);
    }
  }

  // 2. Group remaining tracks by Artist (fallback to Album or Unknown)
  const groups = new Map<string, T[]>();
  for (const track of pool) {
    const key = (track.artist?.trim() || track.album?.trim() || '__unknown__').toLowerCase();
    const grp = groups.get(key) || [];
    grp.push(track);
    groups.set(key, grp);
  }

  // Shuffle tracks within each group
  const shuffledGroups: T[][] = [];
  for (const grp of groups.values()) {
    shuffledGroups.push(fisherYatesShuffle(grp));
  }

  // Shuffle order of groups so artist appearance order is varied
  const groupOrder = fisherYatesShuffle(shuffledGroups);

  // 3. Interleave / De-cluster groups using greedy dispersal
  const getClusterKey = (track: T) => (track.artist?.trim() || track.album?.trim() || '').toLowerCase();

  const result: T[] = [];
  if (startTrack) {
    result.push(startTrack);
  }

  type Bucket = { key: string; items: T[] };
  const buckets: Bucket[] = groupOrder
    .filter(b => b.length > 0)
    .map(items => ({
      key: getClusterKey(items[0]),
      items
    }));

  while (buckets.length > 0) {
    // Sort buckets descending by remaining length
    buckets.sort((a, b) => b.items.length - a.items.length);

    const prevTrack = result.length > 0 ? result[result.length - 1] : undefined;
    const prevKey = prevTrack ? getClusterKey(prevTrack) : null;

    let chosenIdx = -1;
    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i];
      if (result.length === 0 && options.avoidRepeatLastId !== undefined) {
        if (String(b.items[0].id) === String(options.avoidRepeatLastId) && buckets.length > 1) {
          continue;
        }
      }
      if (prevKey && b.key && b.key === prevKey && buckets.length > 1) {
        continue;
      }
      chosenIdx = i;
      break;
    }

    if (chosenIdx === -1) {
      chosenIdx = 0;
    }

    const chosenBucket = buckets[chosenIdx];
    const nextItem = chosenBucket.items.shift();
    if (nextItem) {
      result.push(nextItem);
    }

    if (chosenBucket.items.length === 0) {
      buckets.splice(chosenIdx, 1);
    }
  }

  return result;
};
