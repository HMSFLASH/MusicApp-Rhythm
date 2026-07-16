import type { Track } from '../hooks/audioTypes';
import { getAudioMimeType, isAudioFile } from '../hooks/audioMime';

type ParsedPicture = {
  data: Uint8Array;
  format?: string;
};

export type ParsedAudioMetadata = {
  common: {
    title?: string;
    artist?: string;
    album?: string;
    genre?: string[];
    lyrics?: Array<{ text?: string } | string>;
    picture?: ParsedPicture[];
  };
  format: {
    container?: string;
    codec?: string;
    bitrate?: number;
    sampleRate?: number;
    numberOfChannels?: number;
    bitsPerSample?: number;
    duration?: number;
  };
  native?: Record<string, Array<{ id?: string; value?: unknown }>>;
};

type ReadLocalTrackMetadataOptions = {
  useLegacyMetadataParser?: boolean;
};

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

export async function parseLocalAudioMetadata(
  file: File,
  fileName?: string,
  options: ReadLocalTrackMetadataOptions = {},
) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);
  const mimeType = getAudioMimeType(fileName, file.type) || 'audio/mpeg';

  let timeoutId: ReturnType<typeof setTimeout>;
  let parsePromise: Promise<ParsedAudioMetadata>;

  if (options.useLegacyMetadataParser) {
    const mm = await import('music-metadata-browser');
    const browserModule = mm as typeof import('music-metadata-browser') & {
      default?: { parseBuffer?: typeof mm.parseBuffer };
    };
    const parseBufferFn = mm.parseBuffer || browserModule.default?.parseBuffer;
    if (!parseBufferFn) {
      console.error('music-metadata-browser import failed. Exported keys:', Object.keys(mm));
      throw new Error('parseBuffer not found in music-metadata-browser');
    }
    parsePromise = parseBufferFn(buffer, mimeType, { duration: false })
      .then((metadata) => metadata as ParsedAudioMetadata);
  } else {
    const mm = await import('music-metadata');
    const metadataModule = mm as typeof import('music-metadata') & {
      default?: { parseBuffer?: typeof mm.parseBuffer };
    };
    const parseBufferFn = mm.parseBuffer || metadataModule.default?.parseBuffer;
    if (!parseBufferFn) {
      console.error('music-metadata import failed. Exported keys:', Object.keys(mm));
      throw new Error('parseBuffer not found in music-metadata');
    }

    const fileInfo = {
      mimeType,
      path: fileName,
      size: file.size,
    };
    parsePromise = parseBufferFn(buffer, fileInfo, { duration: false })
      .then((metadata) => metadata as ParsedAudioMetadata);
  }

  const guardedParsePromise = parsePromise
    .then((metadata) => metadata as ParsedAudioMetadata)
    .catch((err: unknown) => {
      console.error('parseBuffer threw error:', err);
      throw err;
    });
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('timeout')), 10000);
  });
  return {
    metadata: await Promise.race([guardedParsePromise, timeoutPromise]).finally(() => clearTimeout(timeoutId!)),
    parsedBufferLength: buffer.byteLength,
  };
}

export async function readLocalTrackMetadata(
  track: Track,
  options: ReadLocalTrackMetadataOptions = {},
): Promise<Partial<Track>> {
  if (!track.localFile) return {};

  const { metadata } = await parseLocalAudioMetadata(track.localFile, track.fileName, options);

  const update: Partial<Track> = {};
  if (metadata.common.title) update.title = metadata.common.title;
  if (metadata.common.artist) update.artist = metadata.common.artist;
  if (metadata.common.album) update.album = metadata.common.album;
  if (metadata.common.genre?.length) update.genre = metadata.common.genre[0];
  if (metadata.format.duration) update.durationSeconds = metadata.format.duration;

  // Lấy lyrics (ưu tiên common.lyrics, sau đó quét native tags như Vorbis comments của FLAC)
  if (metadata.common.lyrics && metadata.common.lyrics.length > 0) {
    const firstLyric = metadata.common.lyrics[0];
    if (typeof firstLyric === 'string') {
      update.lyrics = firstLyric;
    } else if (firstLyric?.text) {
      update.lyrics = firstLyric.text;
    }
  }

  if (!update.lyrics && metadata.native) {
    for (const format of Object.keys(metadata.native)) {
      const nativeTags = metadata.native[format];
      const lyricTag = nativeTags.find(t => t.id?.toLowerCase().includes('lyric'));
      if (lyricTag && typeof lyricTag.value === 'string') {
        update.lyrics = lyricTag.value;
        break;
      }
    }
  }

  if (metadata.common.picture?.length) {
    const pic = metadata.common.picture.reduce((prev, current) => (prev.data.length > current.data.length) ? prev : current);
    console.log('[Metadata] Found picture:', pic.format, 'Size:', pic.data.length, 'bytes');
    const fmt = pic.format || 'jpeg';
    const imgMime = fmt.startsWith('image/') ? fmt : `image/${fmt}`;
    const pictureData = new Uint8Array(pic.data);
    update.imageUrl = URL.createObjectURL(new Blob([pictureData], { type: imgMime }));
  }

  return update;
}
