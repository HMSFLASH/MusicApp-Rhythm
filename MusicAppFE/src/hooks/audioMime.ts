import type { Track } from './audioTypes';

export const AUDIO_EXTENSIONS = [
  '.mp3', '.m4a', '.flac', '.wav', '.ogg', '.opus', '.aac', '.wma',
];

export const AUDIO_MIME_BY_EXTENSION: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  aac: 'audio/aac',
  wma: 'audio/x-ms-wma',
};

export const getAudioExtension = (fileName?: string) => fileName?.split('.').pop()?.toLowerCase();

export const getAudioMimeType = (fileName?: string, fallback?: string | null) => {
  const ext = getAudioExtension(fileName);
  const mimeType = ext ? AUDIO_MIME_BY_EXTENSION[ext] : undefined;
  return mimeType || (fallback && fallback !== 'application/octet-stream' ? fallback : 'audio/mpeg');
};

export const getTrackMimeType = (track: Track, fallback?: string | null) =>
  getAudioMimeType(track.fileName, fallback);

export const isAudioFile = (file: File) =>
  AUDIO_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
