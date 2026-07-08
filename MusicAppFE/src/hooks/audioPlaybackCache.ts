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

export type PrecalculatedNextBuffer = {
  trackId: string;
  buffer: AudioBuffer;
};

const touchCachedAudioBuffer = (cache: Map<string, AudioBuffer>, key: string) => {
  const cachedBuffer = cache.get(key);
  if (!cachedBuffer) return null;

  cache.delete(key);
  cache.set(key, cachedBuffer);
  return cachedBuffer;
};

const pruneAudioBufferCache = (cache: Map<string, AudioBuffer>, maxEntries: number) => {
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
};

export const getRenderSignatureCacheKey = (trackId: string, signature: string) => (
  `${trackId}::${signature}`
);

type GetRenderSignatureBufferOptions = {
  cache: Map<string, AudioBuffer>;
  enabled: boolean;
  trackId: string;
  signature: string;
};

export const getCachedRenderSignatureBuffer = ({
  cache,
  enabled,
  trackId,
  signature,
}: GetRenderSignatureBufferOptions) => {
  if (!enabled) return null;
  return touchCachedAudioBuffer(cache, getRenderSignatureCacheKey(trackId, signature));
};

type CacheRenderSignatureBufferOptions = GetRenderSignatureBufferOptions & {
  buffer: AudioBuffer;
};

export const cacheRenderSignatureBuffer = ({
  cache,
  enabled,
  trackId,
  signature,
  buffer,
}: CacheRenderSignatureBufferOptions) => {
  if (!enabled) return;

  const key = getRenderSignatureCacheKey(trackId, signature);
  cache.delete(key);
  cache.set(key, buffer);
  pruneAudioBufferCache(cache, MAX_RENDER_SIGNATURE_CACHE_ENTRIES);
};

export const getCachedPrecalculatedQueueBuffer = (
  cache: Map<string, AudioBuffer>,
  trackId: string
) => touchCachedAudioBuffer(cache, trackId);

type PrunePrecalculatedQueueBuffersOptions = {
  cache: Map<string, AudioBuffer>;
  preferredAllowedIds: Set<string>;
  nextBuffer: PrecalculatedNextBuffer | null;
  fullQueuePrecalculateCache: boolean;
};

export const prunePrecalculatedQueueBuffers = ({
  cache,
  preferredAllowedIds,
  nextBuffer,
  fullQueuePrecalculateCache,
}: PrunePrecalculatedQueueBuffersOptions) => {
  if (fullQueuePrecalculateCache) return nextBuffer;

  let nextPrecalculatedBuffer = nextBuffer;

  if (preferredAllowedIds.size > 0) {
    for (const key of cache.keys()) {
      if (!preferredAllowedIds.has(String(key))) {
        cache.delete(key);
      }
    }

    if (
      nextPrecalculatedBuffer &&
      !preferredAllowedIds.has(nextPrecalculatedBuffer.trackId)
    ) {
      nextPrecalculatedBuffer = null;
    }
  }

  pruneAudioBufferCache(cache, MAX_PRECALCULATED_BUFFER_CACHE_SIZE);
  return nextPrecalculatedBuffer;
};

type CachePrecalculatedQueueBufferOptions = {
  cache: Map<string, AudioBuffer>;
  trackId: string;
  buffer: AudioBuffer;
  preferredAllowedIds: Set<string>;
  nextBuffer: PrecalculatedNextBuffer | null;
  fullQueuePrecalculateCache: boolean;
};

export const cachePrecalculatedQueueBuffer = ({
  cache,
  trackId,
  buffer,
  preferredAllowedIds,
  nextBuffer,
  fullQueuePrecalculateCache,
}: CachePrecalculatedQueueBufferOptions) => {
  cache.delete(trackId);
  cache.set(trackId, buffer);

  return prunePrecalculatedQueueBuffers({
    cache,
    preferredAllowedIds,
    nextBuffer,
    fullQueuePrecalculateCache,
  });
};
