import { useRef, useEffect, useState } from 'react';
import type { Track } from './audioTypes';

const BACKEND_URL = `http://${window.location.hostname}:8080`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useAudioMetadata(jwtToken: string, queueState: any) {
    const setCurrentTrack = queueState?.setCurrentTrack;
    const setQueue = queueState?.setQueue;
    const currentTrack = queueState?.currentTrack;
    const queue = queueState?.queue;

    const [metadataVersion, setMetadataVersion] = useState(0);

    const metadataCacheRef = useRef<Map<string, Partial<Track>>>(new Map());
    const imageCacheRef = useRef<Map<string, string>>(new Map());
    const blobCacheRef = useRef<Map<string, string>>(new Map());

    useEffect(() => {
        let tracksToPreload: any[] = [];

        if (queue && queue.length > 0) {
            if (currentTrack) {
                const currentIndex = queue.findIndex((t: any) => String(t.id) === String(currentTrack.id));
                if (currentIndex !== -1) {
                    const nextTracks = queue.slice(currentIndex);
                    const prevTracks = queue.slice(0, currentIndex);
                    tracksToPreload = [...nextTracks, ...prevTracks];
                } else {
                    if (!metadataCacheRef.current.has(String(currentTrack.id))) {
                        extractMetadata(currentTrack);
                    }
                    tracksToPreload = [...queue];
                }
            } else {
                tracksToPreload = [...queue];
            }
        } else if (currentTrack) {
            if (!metadataCacheRef.current.has(String(currentTrack.id))) {
                extractMetadata(currentTrack);
            }
        }

        const preload = async () => {
            for (let i = 0; i < tracksToPreload.length; i++) {
                const t = tracksToPreload[i];
                if (!metadataCacheRef.current.has(String(t.id))) {
                    await extractMetadata(t);
                    if (i < tracksToPreload.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 440));
                    }
                }
            }

            try {
                const cachedLib = localStorage.getItem('sonic_library_tracks');
                if (cachedLib) {
                    const allTracks = JSON.parse(cachedLib);
                    for (let i = 0; i < allTracks.length; i++) {
                        const t = allTracks[i];
                        if (!metadataCacheRef.current.has(String(t.id))) {
                            await new Promise(resolve => setTimeout(resolve, 440));
                            await extractMetadata(t);
                        }
                    }
                }
            } catch (e) {
                console.warn('[Metadata] Failed to preload all songs', e);
            }
        };
        preload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTrack, queue]);

    const extractMetadata = async (track: Track) => {
        const trackId = String(track.id);
        if (metadataCacheRef.current.has(trackId)) return;

        // Mark as pending to prevent concurrent extractions
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadataCacheRef.current.set(trackId, { pending: true } as any);

        const cachePayload: Partial<Track> = {};
        const up: Partial<Track> = {};

        try {
            const mm = await import('music-metadata-browser');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let metadata: any;
            let timeoutId: ReturnType<typeof setTimeout>;

            if (track.sourceType === 'LOCAL' && track.localFile) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const parseBufferFn = mm.parseBuffer || (mm as any).default?.parseBuffer;
                if (!parseBufferFn) throw new Error('parseBuffer not found');

                const arrayBuffer = await track.localFile.arrayBuffer();
                const buffer = new Uint8Array(arrayBuffer);
                
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const fileInfo: any = { size: track.localFile.size };
                if (track.fileName) fileInfo.path = track.fileName;
                const ext = track.fileName?.split('.').pop()?.toLowerCase();
                if (!ext || ext === track.fileName?.toLowerCase()) {
                    fileInfo.mimeType = track.localFile.type || 'audio/mpeg';
                }

                const parsePromise = parseBufferFn(buffer, fileInfo, { duration: true });
                const timeoutPromise = new Promise<never>((_, reject) => {
                    timeoutId = setTimeout(() => reject(new Error('Local metadata parse timeout')), 10000);
                });
                metadata = await Promise.race([parsePromise, timeoutPromise]).finally(() => clearTimeout(timeoutId!));
                
                if (track.localFile.size > 0) {
                    up.fileSize = track.localFile.size;
                    cachePayload.fileSize = track.localFile.size;
                }
            } else {
                const ext = track.fileName?.split('.').pop()?.toLowerCase();
                const mimeMap: Record<string, string> = { mp3: 'audio/mpeg', m4a: 'audio/mp4', flac: 'audio/flac', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg', aac: 'audio/aac', wma: 'audio/x-ms-wma' };
                const mappedMimeType = mimeMap[ext || ''];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const parseBufferFn = mm.parseBuffer || (mm as any).default?.parseBuffer;
                if (!parseBufferFn) throw new Error('parseBuffer not found');

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
                    }
                    
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const fileInfo: any = { size: fileSize };
                    if (track.fileName) fileInfo.path = track.fileName;
                    if (!ext) {
                        fileInfo.mimeType = (fetchedMimeType && fetchedMimeType !== 'application/octet-stream') ? fetchedMimeType : 'audio/mpeg';
                    }
                    
                    metadata = await parseBufferFn(buffer, fileInfo, { duration: false });
                } else {
                    const fetchUrl = `${BACKEND_URL}/api/music/stream/${track.id}?access_token=${jwtToken}`;
                    const controller = new AbortController();
                    const response = await fetch(fetchUrl, { signal: controller.signal });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);

                    const fetchedMimeType = response.headers.get('Content-Type');

                    const contentLengthHeader = response.headers.get('Content-Length');
                    const fileSize = contentLengthHeader ? parseInt(contentLengthHeader, 10) : (track.fileSize || 0);
                    if (fileSize > 0) {
                        up.fileSize = fileSize;
                        cachePayload.fileSize = fileSize;
                    }
                    const maxMetadataSize = fileSize > 15 * 1024 * 1024 ? 1.2 * 1024 * 1024 : 512 * 1024;

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

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const fileInfo: any = { size: fileSize };
                    if (track.fileName) fileInfo.path = track.fileName;
                    if (!ext) {
                        fileInfo.mimeType = (fetchedMimeType && fetchedMimeType !== 'application/octet-stream') ? fetchedMimeType : 'audio/mpeg';
                    }

                    metadata = await parseBufferFn(buffer, fileInfo, { duration: false });
                }
            }

            if (metadata.common.title) { up.title = metadata.common.title; cachePayload.title = metadata.common.title; }
            if (metadata.common.artist) { up.artist = metadata.common.artist; cachePayload.artist = metadata.common.artist; }
            if (metadata.common.album) { up.album = metadata.common.album; cachePayload.album = metadata.common.album; }
            
            if (metadata.format) {
                if (metadata.format.container) { up.fileFormat = metadata.format.container; cachePayload.fileFormat = metadata.format.container; }
                if (metadata.format.codec) { up.codec = metadata.format.codec; cachePayload.codec = metadata.format.codec; }
                if (metadata.format.bitrate) { up.bitrate = metadata.format.bitrate; cachePayload.bitrate = metadata.format.bitrate; }
                if (metadata.format.sampleRate) { up.sampleRate = metadata.format.sampleRate; cachePayload.sampleRate = metadata.format.sampleRate; }
                if (metadata.format.numberOfChannels) { up.numberOfChannels = metadata.format.numberOfChannels; cachePayload.numberOfChannels = metadata.format.numberOfChannels; }
                if (metadata.format.bitsPerSample) { up.bitsPerSample = metadata.format.bitsPerSample; cachePayload.bitsPerSample = metadata.format.bitsPerSample; }
                if (metadata.format.duration) { up.durationSeconds = metadata.format.duration; cachePayload.durationSeconds = metadata.format.duration; }
            }

            if (metadata.common.picture?.length) {
                const pic = metadata.common.picture[0];
                const fmt = pic.format || 'jpeg';
                const mime = fmt.startsWith('image/') ? fmt : `image/${fmt}`;
                const imgUrl = URL.createObjectURL(new Blob([new Uint8Array(pic.data)], { type: mime }));
                up.imageUrl = imgUrl;
                imageCacheRef.current.set(trackId, imgUrl);
            }

            // Always mark as cached so we don't infinitely retry
            metadataCacheRef.current.set(trackId, cachePayload);
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
    };

    return {
        extractMetadata,
        metadataCacheRef,
        imageCacheRef,
        blobCacheRef,
        metadataVersion
    };
}