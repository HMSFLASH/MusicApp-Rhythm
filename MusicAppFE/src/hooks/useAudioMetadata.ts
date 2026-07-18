import { useRef, useEffect, useState } from 'react';
import type { Track } from './audioTypes';
import { getCover, removeCover, saveCover } from '../utils/idb';
import { db } from '../lib/db';
import { axiosClient } from '../api/axiosClient';
import { BACKEND_URL } from '../api/axiosClient';
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

type ExtractMetadataOptions = {
    ignoreCache?: boolean;
    useLegacyMetadataParser?: boolean;
    maxMetadataBytes?: number;
};

const LEGACY_COVER_FALLBACK_BYTES = 1024 * 1024;
const MAX_BACKEND_COVER_BYTES = 2 * 1024 * 1024;

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
];

const clearRefreshableMetadata = (track: Track): Track => {
    const next = { ...track };
    for (const field of refreshableMetadataFields) {
        delete next[field];
    }
    return next;
};

const isBackendMusicImageUrl = (imageUrl?: string) => {
    if (!imageUrl) return false;

    try {
        const url = new URL(imageUrl, window.location.origin);
        return /^\/api\/music\/[^/]+\/image$/.test(url.pathname);
    } catch {
        return /\/api\/music\/[^/]+\/image(?:$|[?#])/.test(imageUrl);
    }
};

const withoutBackendImageUrl = (track: Track): Track => {
    if (!isBackendMusicImageUrl(track.imageUrl)) return track;
    const { imageUrl: _imageUrl, ...rest } = track;
    return rest;
};

const toBase64 = (data: Uint8Array) => {
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.subarray(i, Math.min(i + chunkSize, data.length));
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
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

    async function extractMetadata(track: Track, options: ExtractMetadataOptions = {}) {
        const trackId = String(track.id);
        const existing = metadataCacheRef.current.get(trackId);
        if (existing?.pending) return;
        if (track.sourceType !== 'LOCAL' && !isAuthenticated) return;
        const useLegacyMetadataParser = options.useLegacyMetadataParser ?? shouldUseLegacyMetadataParser(track, legacyMetadataOverrides);

        // --- CACHE READ LAYER ---
        const lsKey = getMetadataCacheKey(trackId);
        if (track.sourceType !== 'LOCAL' && !options.ignoreCache) {
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

                        const hasCover = !!parsed.imageUrl || !!track.imageUrl;
                        const coverStored = (lsData as any).coverStored;
                        const isCoverChecked = (lsData as any).coverChecked || (lsData as any).coverMissing;
                        if (hasCover || (coverStored && idbCover) || isCoverChecked) {
                            return; // SKIP EXTRACTION!
                        }
                    }
                } catch (e) {
                    console.warn('[Metadata] Failed to load cache from storage', e);
                }
            }
        }
        // --- END CACHE READ LAYER ---

        // Mark as pending to prevent concurrent extractions
        const currentCached = metadataCacheRef.current.get(trackId) || {};
        metadataCacheRef.current.set(trackId, { ...currentCached, pending: true });

        const cachePayload: Partial<Track> = {};
        const up: Partial<Track> = {};
        let extractedPicture = false;
        let extractedCoverStored = false;
        let backendImageUrl: string | undefined;

        try {
            let metadata: ParsedAudioMetadata;

            let parsedBufferLength = 0;
            let trueFileSize = 0;

            if (track.sourceType === 'LOCAL' && track.localFile) {
                if (options.maxMetadataBytes && track.localFile.size > options.maxMetadataBytes) {
                    const buffer = new Uint8Array(await track.localFile.slice(0, options.maxMetadataBytes).arrayBuffer());
                    metadata = await parseMetadataBuffer(
                        buffer,
                        {
                            size: track.localFile.size,
                            path: track.fileName,
                            mimeType: getAudioMimeType(track.fileName, track.localFile.type),
                        },
                        getAudioMimeType(track.fileName, track.localFile.type),
                        useLegacyMetadataParser,
                    );
                    parsedBufferLength = buffer.byteLength;
                } else {
                    const localMetadata = await parseLocalAudioMetadata(track.localFile, track.fileName, {
                        useLegacyMetadataParser,
                    });
                    metadata = localMetadata.metadata as ParsedAudioMetadata;
                    parsedBufferLength = localMetadata.parsedBufferLength;
                }

                if (track.localFile.size > 0) {
                    up.fileSize = track.localFile.size;
                    cachePayload.fileSize = track.localFile.size;
                    trueFileSize = track.localFile.size;
                }
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

                    const parseBuffer = options.maxMetadataBytes && buffer.byteLength > options.maxMetadataBytes
                        ? buffer.slice(0, options.maxMetadataBytes)
                        : buffer;
                    parsedBufferLength = parseBuffer.byteLength;

                    const fileInfo: MetadataFileInfo = { size: fileSize };
                    if (track.fileName) fileInfo.path = track.fileName;
                    if (!ext) {
                        fileInfo.mimeType = (fetchedMimeType && fetchedMimeType !== 'application/octet-stream') ? fetchedMimeType : 'audio/mpeg';
                    }

                    metadata = await parseMetadataBuffer(
                        parseBuffer,
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
                    const maxMetadataSize = options.maxMetadataBytes ?? (fileSize > 15 * 1024 * 1024 ? 5 * 1024 * 1024 : 3 * 1024 * 1024);

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
                    let offset = 0;
                    for (const c of chunks) {
                        buffer.set(c, offset);
                        offset += c.length;
                    }
                    const parseBuffer = options.maxMetadataBytes && buffer.byteLength > options.maxMetadataBytes
                        ? buffer.slice(0, options.maxMetadataBytes)
                        : buffer;
                    parsedBufferLength = parseBuffer.byteLength;

                    const fileInfo: MetadataFileInfo = { size: fileSize };
                    if (track.fileName) fileInfo.path = track.fileName;
                    if (!ext) {
                        fileInfo.mimeType = (fetchedMimeType && fetchedMimeType !== 'application/octet-stream') ? fetchedMimeType : 'audio/mpeg';
                    }

                    metadata = await parseMetadataBuffer(
                        parseBuffer,
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
                        const lyricTag = tags.find((tag: { id?: string; value?: unknown }) => tag.id?.toLowerCase().includes('lyric') || tag.id === 'USLT' || tag.id === 'SYLT');
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
                extractedPicture = true;
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
                if (pictureData.byteLength <= MAX_BACKEND_COVER_BYTES) {
                    backendImageUrl = `data:${mime};base64,${toBase64(new Uint8Array(pictureData))}`;
                } else {
                    console.warn(`[Metadata] Cover for ${trackId} is too large to save to backend (${pictureData.byteLength} bytes)`);
                }

                if (track.sourceType !== 'LOCAL') {
                    extractedCoverStored = await saveCover(trackId, new Uint8Array(pictureData), mime);
                    if (extractedCoverStored) {
                        (cachePayload as any).coverStored = true;
                        console.log(`[Metadata] Saved parsed cover image for ${trackId} to IndexedDB.`);
                    } else {
                        console.warn(`[Metadata] Cover for ${trackId} was parsed but could not be saved to IndexedDB`);
                    }
                }
            }

            const shouldMarkCoverChecked = extractedPicture && (track.sourceType === 'LOCAL' || extractedCoverStored);
            const updatedCachePayload = {
                ...cachePayload,
                ...(shouldMarkCoverChecked ? { coverChecked: true } : (!extractedPicture ? { coverMissing: true } : {})),
            };
            metadataCacheRef.current.set(trackId, updatedCachePayload);
            if (track.sourceType !== 'LOCAL') {
                await db.set(lsKey, updatedCachePayload);
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
            const currentCached = metadataCacheRef.current.get(trackId) || {};
            const updatedCache = { ...currentCached };
            delete (updatedCache as any).pending;
            metadataCacheRef.current.set(trackId, updatedCache);
            if (track.sourceType !== 'LOCAL') {
                try {
                    const lsData = await getCachedMetadataForTrack(track) || {};
                    await db.set(lsKey, lsData);
                } catch (err) {
                    console.warn('[Metadata] Failed to save error status to cache', err);
                }
            }
            setMetadataVersion(v => v + 1);
        }
    }

    async function reloadMetadataFromBackend(track: Track) {
        if (track.sourceType === 'LOCAL') return null;
        const trackId = String(track.id);

        try {
            const response = await axiosClient.post(`/api/music/${trackId}/reload-metadata`) as { result?: any } | any;
            const updatedTrack = response?.result || response;
            if (updatedTrack) {
                const cachePayload: Partial<Track> = {
                    title: updatedTrack.title,
                    artist: updatedTrack.artist,
                    album: updatedTrack.album,
                    genre: updatedTrack.genre,
                    imageUrl: updatedTrack.imageUrl,
                    lyrics: updatedTrack.lyrics,
                    durationSeconds: updatedTrack.durationSeconds,
                    coverChecked: true
                };

                metadataCacheRef.current.set(trackId, cachePayload);
                const lsKey = getMetadataCacheKey(trackId);
                await db.set(lsKey, cachePayload);

                setCurrentTrack((prev: any) => prev && String(prev.id) === trackId ? { ...prev, ...cachePayload } : prev);
                setQueue((prevQ: any) => prevQ?.map ? prevQ.map((t: any) => String(t.id) === trackId ? { ...t, ...cachePayload } : t) : prevQ);
                setMetadataVersion(v => v + 1);

                window.dispatchEvent(new CustomEvent('sonic_metadata_updated', { detail: trackId }));
                window.dispatchEvent(new CustomEvent('music-uploaded'));
                return updatedTrack;
            }
        } catch (err) {
            console.error('[Metadata] Failed to reload metadata from backend:', err);
        }
        return null;
    }

    async function refreshTrackMetadataFromDrive(track: Track) {
        if (track.sourceType === 'LOCAL') return;
        await clearTrackCachedMetadata(track);
        await extractMetadata(clearRefreshableMetadata(track));
    }

    async function refreshMissingTrackCover(track: Track) {
        const trackId = String(track.id);

        setCurrentTrack((prev: Track | null) => (
            prev && String(prev.id) === trackId ? withoutBackendImageUrl(prev) : prev
        ));
        setQueue((prevQ: Track[] | undefined) => Array.isArray(prevQ)
            ? prevQ.map((t: Track) => String(t.id) === trackId ? withoutBackendImageUrl(t) : t)
            : prevQ);

        if (track.sourceType === 'LOCAL') {
            await extractMetadata(withoutBackendImageUrl(track), { ignoreCache: true });
            return;
        }

        const currentCached = metadataCacheRef.current.get(trackId) || {};
        const retryPayload = { ...currentCached };
        delete (retryPayload as any).pending;
        delete (retryPayload as any).coverChecked;
        delete (retryPayload as any).coverStored;
        delete (retryPayload as any).coverMissing;
        metadataCacheRef.current.set(trackId, retryPayload);

        const lsKey = getMetadataCacheKey(trackId);
        try {
            const lsData = await getCachedMetadataForTrack(track);
            if (lsData) {
                const nextLsData = { ...lsData };
                delete (nextLsData as any).coverChecked;
                delete (nextLsData as any).coverStored;
                delete (nextLsData as any).coverMissing;
                await db.set(lsKey, nextLsData);
            }
        } catch (err) {
            console.warn('[Metadata] Failed to reset cover retry cache', err);
        }

        console.log(`[Metadata] Trying legacy cover fallback for ${trackId} from cached audio blob.`);
        await extractMetadata(withoutBackendImageUrl(track), {
            ignoreCache: true,
            useLegacyMetadataParser: true,
            maxMetadataBytes: LEGACY_COVER_FALLBACK_BYTES,
        });

        if (imageCacheRef.current.has(trackId)) return;

        await reloadMetadataFromBackend(withoutBackendImageUrl(track));
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

        if (currentTrack) {
            const trackId = String(currentTrack.id);
            const cached = metadataCacheRef.current.get(trackId) as any;
            const hasCover = !!cached?.imageUrl || !!currentTrack.imageUrl || imageCacheRef.current.has(trackId);
            const isCoverChecked = cached?.coverChecked || cached?.coverMissing;
            if (!cached || (!hasCover && !isCoverChecked)) {
                void extractMetadata(currentTrack);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTrack, legacyMetadataOverrides]);

    return {
        extractMetadata,
        clearTrackCachedMetadata,
        refreshTrackMetadataFromDrive,
        refreshMissingTrackCover,
        reloadMetadataFromBackend,
        metadataCacheRef,
        imageCacheRef,
        blobCacheRef,
        metadataVersion
    };
}
