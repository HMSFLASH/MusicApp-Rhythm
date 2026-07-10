import type { Track } from '../hooks/audioTypes';
import { db } from '../lib/db';

export const METADATA_CACHE_VERSION = 'v8';
export const LEGACY_METADATA_TRACKS_STORAGE_KEY = 'SONIC_LEGACY_METADATA_TRACKS_V1';

export const getMetadataCacheKey = (trackId: string) =>
  `sonic_meta_${METADATA_CACHE_VERSION}_${trackId}`;

const getOldMetadataCacheKey = (trackId: string) => `sonic_meta_v5_${trackId}`;
const getParserMetadataCacheKey = (trackId: string, useLegacyMetadataParser: boolean) =>
  `sonic_meta_v7_${useLegacyMetadataParser ? 'legacy' : 'modern'}_${trackId}`;

export async function getLegacyMetadataOverrides() {
  return (await db.get<Record<string, boolean>>(LEGACY_METADATA_TRACKS_STORAGE_KEY)) || {};
}

export function sanitizeMetadataForCache(metadata: Partial<Track>): Partial<Track> {
  const rest = { ...metadata };
  delete rest.imageUrl;
  return rest;
}

export async function getCachedMetadataForTrack(track: Track): Promise<Partial<Track> | null> {
  const trackId = String(track.id);

  return (
    await db.get<Partial<Track>>(getMetadataCacheKey(trackId)) ||
    await db.get<Partial<Track>>(getParserMetadataCacheKey(trackId, false)) ||
    await db.get<Partial<Track>>(getParserMetadataCacheKey(trackId, true)) ||
    await db.get<Partial<Track>>(getOldMetadataCacheKey(trackId))
  );
}

export async function removeCachedMetadataForTrack(trackId: string): Promise<void> {
  await Promise.all([
    db.remove(getMetadataCacheKey(trackId)),
    db.remove(getParserMetadataCacheKey(trackId, false)),
    db.remove(getParserMetadataCacheKey(trackId, true)),
    db.remove(getOldMetadataCacheKey(trackId)),
  ]);
}
