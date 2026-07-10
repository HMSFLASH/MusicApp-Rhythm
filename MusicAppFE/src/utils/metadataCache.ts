import type { Track } from '../hooks/audioTypes';
import { shouldUseLegacyMetadataParser } from '../hooks/audioMime';
import { db } from '../lib/db';

export const METADATA_CACHE_VERSION = 'v7';
export const LEGACY_METADATA_TRACKS_STORAGE_KEY = 'SONIC_LEGACY_METADATA_TRACKS_V1';

export const getMetadataCacheKey = (trackId: string, useLegacyMetadataParser: boolean) =>
  `sonic_meta_${METADATA_CACHE_VERSION}_${useLegacyMetadataParser ? 'legacy' : 'modern'}_${trackId}`;

const getOldMetadataCacheKey = (trackId: string) => `sonic_meta_v5_${trackId}`;

export async function getLegacyMetadataOverrides() {
  return (await db.get<Record<string, boolean>>(LEGACY_METADATA_TRACKS_STORAGE_KEY)) || {};
}

export async function getCachedMetadataForTrack(track: Track): Promise<Partial<Track> | null> {
  const trackId = String(track.id);
  const overrides = await getLegacyMetadataOverrides();
  const useLegacyMetadataParser = shouldUseLegacyMetadataParser(track, overrides);
  const preferredKey = getMetadataCacheKey(trackId, useLegacyMetadataParser);
  const fallbackKey = getMetadataCacheKey(trackId, !useLegacyMetadataParser);

  return (
    await db.get<Partial<Track>>(preferredKey) ||
    await db.get<Partial<Track>>(fallbackKey) ||
    await db.get<Partial<Track>>(getOldMetadataCacheKey(trackId))
  );
}
