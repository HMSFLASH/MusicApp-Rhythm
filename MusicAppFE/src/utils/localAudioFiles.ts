import type { Track } from '../hooks/audioTypes';
import { getAudioMimeType, isAudioFile } from '../hooks/audioMime';

export const filterAudioFiles = (files: FileList | File[]) =>
  Array.from(files).filter(isAudioFile);

export function buildLocalTrackStub(file: File): Track {
  const id = `local_${file.name}_${file.size}`;
  return {
    id,
    fileName: file.name,
    sourceType: 'LOCAL',
    localFile: file,
    title: file.name.replace(/\.[^/.]+$/, ''),
  };
}

export async function readLocalTrackMetadata(track: Track): Promise<Partial<Track>> {
  if (!track.localFile) return {};

  const mm = await import('music-metadata-browser');
  const parseBufferFn = mm.parseBuffer || mm.default?.parseBuffer;
  if (!parseBufferFn) return {};

  const arrayBuffer = await track.localFile.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);
  const mimeType = getAudioMimeType(track.fileName, track.localFile.type);

  let timeoutId: ReturnType<typeof setTimeout>;
  const parsePromise = parseBufferFn(buffer, mimeType, { duration: false });
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('timeout')), 10000);
  });
  const metadata = await Promise.race([parsePromise, timeoutPromise]).finally(() => clearTimeout(timeoutId!));

  const update: Partial<Track> = {};
  if (metadata.common.title) update.title = metadata.common.title;
  if (metadata.common.artist) update.artist = metadata.common.artist;
  if (metadata.common.album) update.album = metadata.common.album;
  if (metadata.common.genre?.length) update.genre = metadata.common.genre[0];
  if (metadata.format.duration) update.durationSeconds = metadata.format.duration;

  if (metadata.common.picture?.length) {
    const pic = metadata.common.picture[0];
    const fmt = pic.format || 'jpeg';
    const imgMime = fmt.startsWith('image/') ? fmt : `image/${fmt}`;
    update.imageUrl = URL.createObjectURL(new Blob([new Uint8Array(pic.data)], { type: imgMime }));
  }

  return update;
}
