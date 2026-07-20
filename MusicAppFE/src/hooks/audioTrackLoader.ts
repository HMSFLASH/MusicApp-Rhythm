import { axiosClient } from '../api/axiosClient';
import { cacheAudio, getCachedAudio, removeCachedAudio } from '../utils/mediaCache';
import { getTrackMimeType } from './audioMime';
import type { Track } from './audioTypes';

type LoadTrackAudioUrlOptions = {
  track: Track;
  blobCache: Map<string, string>;
  blobLoadingPromises: Map<string, Promise<string>>;
  driveToken?: string;
  fetchDriveToken?: () => Promise<string>;
  forceReloadFromDrive?: boolean;
};

export const loadTrackAudioUrl = async ({
  track,
  blobCache,
  blobLoadingPromises,
  driveToken,
  fetchDriveToken,
  forceReloadFromDrive = false,
}: LoadTrackAudioUrlOptions) => {
  const trackId = String(track.id);
  const cachedUrl = blobCache.get(trackId);
  if (cachedUrl && !forceReloadFromDrive) return cachedUrl;
  if (cachedUrl && forceReloadFromDrive) {
    URL.revokeObjectURL(cachedUrl);
    blobCache.delete(trackId);
  }

  if (track.sourceType === 'LOCAL' && track.localFile instanceof Blob) {
    const objectUrl = URL.createObjectURL(track.localFile);
    blobCache.set(trackId, objectUrl);
    return objectUrl;
  }

  if (track.sourceType !== 'LOCAL') {
    let driveFileId = track.driveFileId;
    if (!driveFileId) {
      const library = await axiosClient.get('/api/music/list') as Track[];
      driveFileId = library.find((item) => String(item.id) === trackId)?.driveFileId;
    }
    if (!driveFileId) return '';
    const mediaCacheId = `drive:${driveFileId}`;

    const pendingBlobUrl = blobLoadingPromises.get(trackId);
    if (pendingBlobUrl && !forceReloadFromDrive) return pendingBlobUrl;
    if (pendingBlobUrl && forceReloadFromDrive) {
      blobLoadingPromises.delete(trackId);
    }

    const loadPromise = (async () => {
      const isOfflineMode = !navigator.onLine;
      if (forceReloadFromDrive && !isOfflineMode) {
        await removeCachedAudio(mediaCacheId);
      } else {
        const cachedBlob = await getCachedAudio(mediaCacheId);
        if (cachedBlob) {
          const cachedUrl = URL.createObjectURL(cachedBlob);
          blobCache.set(trackId, cachedUrl);
          return cachedUrl;
        }
      }
      
      if (isOfflineMode) {
        return ''; // Block remote fetching when offline mode is ON
      }

      const token = driveToken || await fetchDriveToken?.();
      if (!token) return '';
      const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?alt=media`;
      let response = await fetch(url, {
        mode: 'cors',
        cache: forceReloadFromDrive ? 'reload' : 'default',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.status === 401) {
        // Token might be expired in memory. Fetch a fresh one from backend and retry once.
        const freshToken = await fetchDriveToken?.();
        if (freshToken) {
          response = await fetch(url, {
            mode: 'cors',
            cache: forceReloadFromDrive ? 'reload' : 'default',
            headers: { Authorization: `Bearer ${freshToken}` },
          });
        }
      }

      if (!response.ok) {
        throw new Error(`Drive audio fetch failed: HTTP ${response.status}`);
      }

      const rawBlob = await response.blob();
      const mimeType = getTrackMimeType(track, rawBlob.type);
      const audioBlob = rawBlob.type === mimeType ? rawBlob : new Blob([rawBlob], { type: mimeType });
      const objectUrl = URL.createObjectURL(audioBlob);

      blobCache.set(trackId, objectUrl);
      await cacheAudio(mediaCacheId, audioBlob);
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
