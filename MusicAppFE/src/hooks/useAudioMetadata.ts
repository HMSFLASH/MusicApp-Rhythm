import { useRef, useEffect, useState } from 'react';
import type { Track } from './audioTypes';
import { getCover, removeCover, saveCover } from '../utils/idb';
import { db } from '../lib/db';
import { BACKEND_URL } from '../config/env';
import { parseLocalAudioMetadata } from '../utils/localAudioFiles';
import { getAudioMimeType, shouldUseLegacyMetadataParser } from './audioMime';
import { getCachedMetadataForTrack, getMetadataCacheKey, removeCachedMetadataForTrack, sanitizeMetadataForCache } from '../utils/metadataCache';

type ParsedPicture = {
    data: Uint8Array;
    format?: string;
};

type ParsedAudioMetadata = {
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

type AudioMetadataSettings = {
    legacyMetadataOverrides?: Record<string, boolean>;
};

type MetadataFileInfo = {
    size?: number;
    path?: string;
    mimeType?: string;
};

const refreshableMetadataFields: Array<keyof Track> = [
    'title',
    'artist',
    'album',
    'genre',
    'imageUrl',
    'durationSeconds',
    'bitrate',
    'numberOfChannels',
    'sampleRate',
    'bitsPerSample',
    'fileFormat',
    'codec',
    'fileSize',
    'lyrics',
];

const clearRefreshableMetadata = (track: Track): Track => {
    const next = { ...track };
    for (const field of refreshableMetadataFields) {
        delete next[field];
    }
    return next;
};

async function parseMetadataBuffer(
    buffer: Uint8Array,
    fileInfo: MetadataFileInfo,
    mimeType: string,
    useLegacyMetadataParser: boolean,
) {
    if (useLegacyMetadataParser) {
        const mmBrowser = await import('music-metadata-browser');
        const browserModule = mmBrowser as typeof import('music-metadata-browser') & {
            default?: { parseBuffer?: typeof mmBrowser.parseBuffer };
        };
        const parseBufferFn = mmBrowser.parseBuffer || browserModule.default?.parseBuffer;
        if (!parseBufferFn) throw new Error('parseBuffer not found in music-metadata-browser');
        return parseBufferFn(buffer, mimeType, { duration: false }) as Promise<ParsedAudioMetadata>;
    }

    const mm = await import('music-metadata');
    const metadataModule = mm as typeof import('music-metadata') & {
        default?: { parseBuffer?: typeof mm.parseBuffer };
    };
    const parseBufferFn = mm.parseBuffer || metadataModule.default?.parseBuffer;
    if (!parseBufferFn) throw new Error('parseBuffer not found');
    return parseBufferFn(buffer, fileInfo, { duration: false }) as Promise<ParsedAudioMetadata>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useAudioMetadata(isAuthenticated: boolean, queueState: any, settings: AudioMetadataSettings = {}) {
    const setCurrentTrack = queueState?.setCurrentTrack;
    const setQueue = queueState?.setQueue;
    const currentTrack = queueState?.currentTrack;
    const legacyMetadataOverrides = settings.legacyMetadataOverrides || {};


    const [metadataVersion, setMetadataVersion] = useState(0);

    const metadataCacheRef = useRef<Map<string, Partial<Track> & { pending?: boolean }>>(new Map());
    const imageCacheRef = useRef<Map<string, string>>(new Map());
    const blobCacheRef = useRef<Map<string, string>>(new Map());
    const metadataParserModeRef = useRef<Map<string, boolean>>(new Map());

    async function clearTrackCachedMetadata(track: Track) {
        const trackId = String(track.id);
        metadataCacheRef.current.delete(trackId);

        const imageUrl = imageCacheRef.current.get(trackId);
        if (imageUrl?.startsWith('blob:')) URL.revokeObjectURL(imageUrl);
        imageCacheRef.current.delete(trackId);

        try {
            await Promise.all([
                removeCachedMetadataForTrack(trackId),
                removeCover(trackId),
            ]);
        } catch (e) {
            console.warn('[Metadata] Failed to clear cached metadata', e);
        }

        setCurrentTrack((prev: Track | null) => (
            prev && String(prev.id) === trackId ? clearRefreshableMetadata(prev) : prev
        ));
        setQueue((prevQ: Track[] | undefined) => Array.isArray(prevQ)
            ? prevQ.map((t: Track) => String(t.id) === trackId ? clearRefreshableMetadata(t) : t)
            : prevQ);
        setMetadataVersion(v => v + 1);
        window.dispatchEvent(new CustomEvent('sonic_metadata_updated', { detail: trackId }));
    }

    async function extractMetadata(track: Track) {
        const trackId = String(track.id);
        if (metadataCacheRef.current.has(trackId)) return;
        if (track.sourceType !== 'LOCAL' && !isAuthenticated) return;
        const useLegacyMetadataParser = shouldUseLegacyMetadataParser(track, legacyMetadataOverrides);

        // --- CACHE READ LAYER ---
        const lsKey = getMetadataCacheKey(trackId);
        if (track.sourceType !== 'LOCAL') {
            const lsData = await getCachedMetadataForTrack(track);
            const idbCover = await getCover(trackId);
            const cachedCoverUpdate: Partial<Track> = {};

            if (idbCover) {
                const imgUrl = URL.createObjectURL(new Blob([new Uint8Array(idbCover.data)], { type: idbCover.mimeType }));
                cachedCoverUpdate.imageUrl = imgUrl;
                imageCacheRef.current.set(trackId, imgUrl);
            }

            if (idbCover && !lsData) {
                setMetadataVersion(v => v + 1);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setCurrentTrack((prev: any) => prev && String(prev.id) === trackId ? { ...prev, ...cachedCoverUpdate } : prev);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setQueue((prevQ: any) => prevQ?.map ? prevQ.map((t: any) => String(t.id) === trackId ? { ...t, ...cachedCoverUpdate } : t) : prevQ);
                window.dispatchEvent(new CustomEvent('sonic_metadata_updated', { detail: trackId }));
            }

            if (lsData) {
                try {
                    const cacheData = sanitizeMetadataForCache(lsData);
                    const parsed = { ...cacheData, ...cachedCoverUpdate };
                    if (Object.keys(parsed).length > 0) {
                        metadataCacheRef.current.set(trackId, parsed);
                        await db.set(lsKey, cacheData);
                        setMetadataVersion(v => v + 1);
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        setCurrentTrack((prev: any) => prev && String(prev.id) === trackId ? { ...prev, ...parsed } : prev);
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        setQueue((prevQ: any) => prevQ?.map ? prevQ.map((t: any) => String(t.id) === trackId ? { ...t, ...parsed } : t) : prevQ);
                        window.dispatchEvent(new CustomEvent('sonic_metadata_updated', { detail: trackId }));
                        return; // SKIP EXTRACTION!
                    }
                } catch (e) {
                    console.warn('[Metadata] Failed to load cache from storage', e);
                }
            }
        }
        // --- END CACHE READ LAYER ---

        // Mark as pending to prevent concurrent extractions
        metadataCacheRef.current.set(trackId, { pending: true });

        const cachePayload: Partial<Track> = {};
        const up: Partial<Track> = {};

        try {
            let metadata: ParsedAudioMetadata;

            let parsedBufferLength = 0;
            let trueFileSize = 0;

            if (track.sourceType === 'LOCAL' && track.localFile) {
                const localMetadata = await parseLocalAudioMetadata(track.localFile, track.fileName, {
                    useLegacyMetadataParser,
                });
                metadata = localMetadata.metadata as ParsedAudioMetadata;

                if (track.localFile.size > 0) {
                    up.fileSize = track.localFile.size;
                    cachePayload.fileSize = track.localFile.size;
                    trueFileSize = track.localFile.size;
                }
                parsedBufferLength = localMetadata.parsedBufferLength;
            } else {
                const ext = track.fileName?.split('.').pop()?.toLowerCase();

                // eslint-disable-next-line prefer-const
                let blobUrl = blobCacheRef.current.get(trackId);
                if (blobUrl) {
                    const fetched = await fetch(blobUrl);
                    const arrayBuffer = await fetched.arrayBuffer();
                    const buffer = new Uint8Array(arrayBuffer);
                    const fetchedMimeType = fetched.headers.get('Content-Type');

                    const contentLengthHeader = fetched.headers.get('Content-Length');
                    const fileSize = contentLengthHeader ? parseInt(contentLengthHeader, 10) : (track.fileSize || 0);
                    if (fileSize > 0) {
                        up.fileSize = fileSize;
                        cachePayload.fileSize = fileSize;
                        trueFileSize = fileSize;
                    }

                    parsedBufferLength = buffer.byteLength;

                    const fileInfo: MetadataFileInfo = { size: fileSize };
                    if (track.fileName) fileInfo.path = track.fileName;
                    if (!ext) {
                        fileInfo.mimeType = (fetchedMimeType && fetchedMimeType !== 'application/octet-stream') ? fetchedMimeType : 'audio/mpeg';
                    }

                    metadata = await parseMetadataBuffer(
                        buffer,
                        fileInfo,
                        getAudioMimeType(track.fileName, fetchedMimeType),
                        useLegacyMetadataParser,
                    );
                } else {
                    const fetchUrl = `${BACKEND_URL}/api/music/stream/${track.id}`;
                    const controller = new AbortController();
                    const response = await fetch(fetchUrl, { signal: controller.signal, credentials: 'include' });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);

                    const fetchedMimeType = response.headers.get('Content-Type');

                    const contentLengthHeader = response.headers.get('Content-Length');
                    const fileSize = contentLengthHeader ? parseInt(contentLengthHeader, 10) : (track.fileSize || 0);
                    if (fileSize > 0) {
                        up.fileSize = fileSize;
                        cachePayload.fileSize = fileSize;
                        trueFileSize = fileSize;
                    }
                    const maxMetadataSize = fileSize > 15 * 1024 * 1024 ? 5 * 1024 * 1024 : 3 * 1024 * 1024;

                    const reader = response.body!.getReader();
                    const chunks: Uint8Array[] = [];
                    let totalLength = 0;

                    while (totalLength < maxMetadataSize) {
                        const { done, value } = await reader.read();
                        if (done || !value) break;
                        chunks.push(value);
                        totalLength += value.length;
                    }
                    controller.abort();

                    const buffer = new Uint8Array(totalLength);
                    parsedBufferLength = buffer.byteLength;
                    let offset = 0;
                    for (const c of chunks) {
                        buffer.set(c, offset);
                        offset += c.length;
                    }

                    const fileInfo: MetadataFileInfo = { size: fileSize };
                    if (track.fileName) fileInfo.path = track.fileName;
                    if (!ext) {
                        fileInfo.mimeType = (fetchedMimeType && fetchedMimeType !== 'application/octet-stream') ? fetchedMimeType : 'audio/mpeg';
                    }

                    metadata = await parseMetadataBuffer(
                        buffer,
                        fileInfo,
                        getAudioMimeType(track.fileName, fetchedMimeType),
                        useLegacyMetadataParser,
                    );
                }
            }

            if (metadata.common.title) { up.title = metadata.common.title; cachePayload.title = metadata.common.title; }
            if (metadata.common.artist) { up.artist = metadata.common.artist; cachePayload.artist = metadata.common.artist; }
            if (metadata.common.album) { up.album = metadata.common.album; cachePayload.album = metadata.common.album; }
            if (metadata.common.genre && metadata.common.genre.length > 0) {
                up.genre = metadata.common.genre.join(', ');
                cachePayload.genre = metadata.common.genre.join(', ');
            }
            let extractedLyrics = '';
            if (metadata.common.lyrics && metadata.common.lyrics.length > 0) {
                extractedLyrics = metadata.common.lyrics.map((lyric: { text?: string } | string) => typeof lyric === 'string' ? lyric : (lyric.text || JSON.stringify(lyric))).join('\n\n');
            }
            if (!extractedLyrics && metadata.native) {
                for (const tagType in metadata.native) {
                    const tags = metadata.native[tagType];
                    if (Array.isArray(tags)) {
                        const lyricTag = tags.find((tag: { id?: string; value?: unknown }) => tag.id === 'USLT' || tag.id === 'SYLT' || tag.id === 'LYRICS' || tag.id === 'WM/Lyrics');
                        if (lyricTag && lyricTag.value) {
                            extractedLyrics = typeof lyricTag.value === 'string'
                                ? lyricTag.value
                                : ((lyricTag.value as { text?: string }).text || JSON.stringify(lyricTag.value));
                            break;
                        }
                    }
                }
            }
            if (extractedLyrics) {
                up.lyrics = extractedLyrics;
                cachePayload.lyrics = extractedLyrics;
            }

            if (metadata.format) {
                const isPartialBuffer = trueFileSize > 0 && parsedBufferLength < trueFileSize;
                const isOggOrWebM = ['Ogg', 'EBML/WebM', 'WebM', 'Matroska'].includes(metadata.format.container || '');
                if (isPartialBuffer && isOggOrWebM) {
                    delete metadata.format.duration;
                }

                if (metadata.format.container) { up.fileFormat = metadata.format.container; cachePayload.fileFormat = metadata.format.container; }
                if (metadata.format.codec) { up.codec = metadata.format.codec; cachePayload.codec = metadata.format.codec; }
                if (metadata.format.bitrate) { up.bitrate = metadata.format.bitrate; cachePayload.bitrate = metadata.format.bitrate; }
                if (metadata.format.sampleRate) { up.sampleRate = metadata.format.sampleRate; cachePayload.sampleRate = metadata.format.sampleRate; }
                if (metadata.format.numberOfChannels) { up.numberOfChannels = metadata.format.numberOfChannels; cachePayload.numberOfChannels = metadata.format.numberOfChannels; }
                if (metadata.format.bitsPerSample) { up.bitsPerSample = metadata.format.bitsPerSample; cachePayload.bitsPerSample = metadata.format.bitsPerSample; }
                if (metadata.format.duration) { up.durationSeconds = metadata.format.duration; cachePayload.durationSeconds = metadata.format.duration; }
            }

            if (metadata.common.picture?.length) {
                console.log(`[useAudioMetadata] Found ${metadata.common.picture.length} pictures`);
                const pic = metadata.common.picture.reduce((prev, current) => (prev.data.length > current.data.length) ? prev : current);
                const pictureData = pic.data as Uint8Array;
                const header = Array.from(pictureData.slice(0, 4), (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
                console.log(`[useAudioMetadata] Found picture for ${track.id}: size=${pictureData.length} bytes, format=${pic.format}, magic=${header}`);
                const fmt = pic.format || 'jpeg';
                const mime = fmt.startsWith('image/') ? fmt : `image/${fmt}`;
                const imgUrl = URL.createObjectURL(new Blob([new Uint8Array(pictureData)], { type: mime }));
                up.imageUrl = imgUrl;
                imageCacheRef.current.set(trackId, imgUrl);

                if (track.sourceType !== 'LOCAL') {
                    await saveCover(trackId, new Uint8Array(pictureData), mime);
                }
            }

            // Always mark as cached so we don't infinitely retry
            metadataCacheRef.current.set(trackId, cachePayload);
            if (track.sourceType !== 'LOCAL') {
                await db.set(lsKey, cachePayload);
            }
            setMetadataVersion(v => v + 1);

            if (Object.keys(up).length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setCurrentTrack((prev: any) => prev && String(prev.id) === trackId ? { ...prev, ...up } : prev);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setQueue((prevQ: any) => prevQ.map((t: any) => String(t.id) === trackId ? { ...t, ...up } : t));
                window.dispatchEvent(new CustomEvent('sonic_metadata_updated', { detail: trackId }));
            }
        } catch (e) {
            console.warn('[Metadata] Failed to extract for', track.fileName, e);
            // Mark as failed in cache to prevent infinite retries
            metadataCacheRef.current.set(trackId, {});
            setMetadataVersion(v => v + 1);
        }
    }

    async function refreshTrackMetadataFromDrive(track: Track) {
        if (track.sourceType === 'LOCAL') return;
        await clearTrackCachedMetadata(track);
        await extractMetadata(clearRefreshableMetadata(track));
    }

    useEffect(() => {
        if (currentTrack) {
            const trackId = String(currentTrack.id);
            const useLegacyMetadataParser = shouldUseLegacyMetadataParser(currentTrack, legacyMetadataOverrides);
            const previousParserMode = metadataParserModeRef.current.get(trackId);
            metadataParserModeRef.current.set(trackId, useLegacyMetadataParser);

            if (previousParserMode !== undefined && previousParserMode !== useLegacyMetadataParser) {
                metadataCacheRef.current.delete(trackId);
                const imageUrl = imageCacheRef.current.get(trackId);
                if (imageUrl?.startsWith('blob:')) URL.revokeObjectURL(imageUrl);
                imageCacheRef.current.delete(trackId);
            }
        }

        if (currentTrack && !metadataCacheRef.current.has(String(currentTrack.id))) {
            void extractMetadata(currentTrack);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTrack, legacyMetadataOverrides]);

    return {
        extractMetadata,
        clearTrackCachedMetadata,
        refreshTrackMetadataFromDrive,
        metadataCacheRef,
        imageCacheRef,
        blobCacheRef,
        metadataVersion
    };
}
