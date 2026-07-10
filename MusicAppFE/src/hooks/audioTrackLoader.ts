import { axiosClient } from '../api/axiosClient';
import { cacheAudio, getCachedAudio } from '../utils/mediaCache';
import { getTrackMimeType } from './audioMime';
import type { Track } from './audioTypes';

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
      const library = await axiosClient.get('/api/music/list') as Track[];
      driveFileId = library.find((item) => String(item.id) === trackId)?.driveFileId;
    }
    if (!driveFileId) return '';
    const mediaCacheId = `drive:${driveFileId}`;

    const pendingBlobUrl = blobLoadingPromises.get(trackId);
    if (pendingBlobUrl) return pendingBlobUrl;

    const loadPromise = (async () => {
      const cachedBlob = await getCachedAudio(mediaCacheId);
      if (cachedBlob) {
        const cachedUrl = URL.createObjectURL(cachedBlob);
        blobCache.set(trackId, cachedUrl);
        return cachedUrl;
      }

      const token = driveToken || await fetchDriveToken?.();
      if (!token) return '';
      const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?alt=media`;
      const response = await fetch(url, {
        mode: 'cors',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`Drive audio fetch failed: HTTP ${response.status}`);
      }

      const rawBlob = await response.blob();
      const mimeType = getTrackMimeType(track, rawBlob.type);
      const audioBlob = rawBlob.type === mimeType ? rawBlob : new Blob([rawBlob], { type: mimeType });
      const objectUrl = URL.createObjectURL(audioBlob);

      blobCache.set(trackId, objectUrl);
      void cacheAudio(mediaCacheId, audioBlob);
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
