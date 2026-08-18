import type { LoudnessMeasurement } from '../hooks/audioLoudness';
import { db } from '../lib/db';

export const LOUDNESS_CACHE_PREFIX = 'sonic_loudness_v1_';

export const getLoudnessCacheKey = (trackId: string) => `${LOUDNESS_CACHE_PREFIX}${trackId}`;

export async function getTrackLoudness(trackId: string): Promise<LoudnessMeasurement | null> {
  if (!trackId) return null;
  try {
    const data = await db.get<LoudnessMeasurement>(getLoudnessCacheKey(trackId));
    if (data && typeof data.integratedLufs === 'number' && typeof data.samplePeakDb === 'number') {
      return data;
    }
    return null;
  } catch (e) {
    console.warn(`[LoudnessCache] Failed to get loudness for track ${trackId}:`, e);
    return null;
  }
}

export async function saveTrackLoudness(trackId: string, measurement: LoudnessMeasurement): Promise<void> {
  if (!trackId || !measurement || !Number.isFinite(measurement.integratedLufs)) return;
  try {
    await db.set(getLoudnessCacheKey(trackId), {
      integratedLufs: measurement.integratedLufs,
      samplePeakDb: measurement.samplePeakDb,
    });
  } catch (e) {
    console.warn(`[LoudnessCache] Failed to save loudness for track ${trackId}:`, e);
  }
}

export async function removeTrackLoudness(trackId: string): Promise<void> {
  if (!trackId) return;
  try {
    await db.remove(getLoudnessCacheKey(trackId));
  } catch (e) {
    console.warn(`[LoudnessCache] Failed to remove loudness for track ${trackId}:`, e);
  }
}

export async function removeTracksLoudness(trackIds: string[]): Promise<void> {
  if (!trackIds || trackIds.length === 0) return;
  try {
    await Promise.all(trackIds.map((id) => db.remove(getLoudnessCacheKey(id))));
  } catch (e) {
    console.warn(`[LoudnessCache] Failed to remove tracks loudness:`, e);
  }
}
