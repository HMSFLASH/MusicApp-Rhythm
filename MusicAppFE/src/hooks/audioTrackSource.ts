import { axiosClient } from '../api/axiosClient';
import { getTrackMimeType } from './audioMime';
import type { Track } from './audioTypes';
import { DRIVE_MEDIA_URL } from './audioPlaybackHelpers';

type LoadTrackAudioUrlOptions = {
  track: Track;
  blobCache: Map<string, string>;
  blobLoadingPromises: Map<string, Promise<string>>;
  driveToken?: string;
  fetchDriveToken?: () => Promise<string>;
};

export const loadTrackAudioUrl = async ({
  track,
  blobCache,
  blobLoadingPromises,
  driveToken,
  fetchDriveToken,
}: LoadTrackAudioUrlOptions) => {
  const trackId = String(track.id);
  const cachedUrl = blobCache.get(trackId);
  if (cachedUrl) return cachedUrl;

  if (track.sourceType === 'LOCAL' && track.localFile instanceof Blob) {
    const objectUrl = URL.createObjectURL(track.localFile);
    blobCache.set(trackId, objectUrl);
    return objectUrl;
  }

  if (track.sourceType !== 'LOCAL') {
    let driveFileId = track.driveFileId;
    if (!driveFileId) {
      try {
        const library = await axiosClient.get('/api/music/list') as Track[];
        const latestTrack = Array.isArray(library)
          ? library.find((item) => String(item.id) === trackId)
          : null;
        driveFileId = latestTrack?.driveFileId;
        if (driveFileId) {
          track.driveFileId = driveFileId;
        }
      } catch (e) {
        console.error("[Audio] Failed to refresh track Drive metadata", e);
      }
    }

    if (!driveFileId) {
      console.error("[Audio] Cannot load remote track because driveFileId is missing", track);
      return '';
    }

    const pendingBlobUrl = blobLoadingPromises.get(trackId);
    if (pendingBlobUrl) return pendingBlobUrl;

    const loadPromise = (async () => {
      const token = driveToken || await fetchDriveToken?.();
      if (!token) {
        console.error("[Audio] Cannot load remote track because Drive access token is missing");
        return '';
      }

      const url = `${DRIVE_MEDIA_URL}/${encodeURIComponent(driveFileId)}?alt=media`;
      console.log("[Audio] Downloading track into RAM", track.title || track.fileName || track.id);
      const response = await fetch(url, {
        mode: 'cors',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error(`Drive audio fetch failed: HTTP ${response.status}`);
      }

      const rawBlob = await response.blob();
      const mimeType = getTrackMimeType(track, rawBlob.type);
      const audioBlob = rawBlob.type === mimeType ? rawBlob : new Blob([rawBlob], { type: mimeType });
      const objectUrl = URL.createObjectURL(audioBlob);

      blobCache.set(trackId, objectUrl);
      console.log("[Audio] Track loaded into RAM", track.title || track.fileName || track.id, `${(audioBlob.size / 1024 / 1024).toFixed(2)} MB`);
      return objectUrl;
    })();

    blobLoadingPromises.set(trackId, loadPromise);
    try {
      return await loadPromise;
    } finally {
      blobLoadingPromises.delete(trackId);
    }
  }

  return '';
};
