import { BACKEND_URL } from '../api/axiosClient';
import type { Track } from '../hooks/audioTypes';

/**
 * Initiates the download of a track file from the server.
 */
export const downloadTrackFile = (track: Partial<Track> & { id: string | number; fileName?: string; title?: string }) => {
  if (!track || !track.id) return;
  const downloadUrl = `${BACKEND_URL}/api/music/stream/${track.id}?download=true`;
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = track.fileName || `${track.title || 'track'}.mp3`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};
