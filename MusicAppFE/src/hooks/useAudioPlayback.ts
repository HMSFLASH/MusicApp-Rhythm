import { useState, useRef, useEffect, useCallback } from 'react';
import type { Track } from './audioTypes';
import { LOCAL_STORAGE_KEY } from './audioStorage';
import { clamp } from './audioMath';
import { getBufferProgressIntervalMs, getFullCoreCount, isLikelyConstrainedDevice } from './audioDevice';
import { createSilentWavUrl } from './audioGraph';
import { createRenderSignature as createAudioRenderSignature } from './audioRenderSignature';
import { renderOfflineAudio } from './offlineAudioRenderer';
import {
  getAdjacentTrackWindow,
  MAX_PRECALCULATED_BUFFER_CACHE_SIZE,
  MAX_RENDER_SIGNATURE_CACHE_ENTRIES,
  type LoadingTrackPhase,
  type QueuePrecalculateStatus,
} from './audioPlaybackHelpers';
import { loadTrackAudioUrl } from './audioTrackSource';

export function useAudioPlayback(
  isAuthenticated: boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queueState: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  effectsState: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contextState: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadataState: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  savedState: any,
  driveToken?: string,
  fetchDriveToken?: () => Promise<string>
) {
  void isAuthenticated;

  const { currentTrack, setCurrentTrack, queue, setQueue, isShuffleState, songEndMode, queueEndMode, upcomingQueues, cycleQueues, setUpcomingQueues } = queueState || {};
  const {
    useOversample,
    precalculateOnIdle,
    fxEnabled,
    preampGain,
    eqBands,
    bassGain,
    trebleGain,
    compThreshold,
    compRatio,
    compKnee,
    compAttack,
    compRelease,
    compRmsSize,
    compMakeupGain,
    reverbMix,
    reverbTime,
    stereoWidth,
    panValue,
    loudnessNormalization,
    renderSignatureCacheEnabled,
  } = effectsState || {};
  const { audioContextRef, audioRef, bufferSourceRef, bufferVolumeNodeRef, initializeAudioContext, irBufferRef } = contextState;
  const { blobCacheRef } = metadataState;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);
  const [loadingTrackPhase, setLoadingTrackPhase] = useState<LoadingTrackPhase | null>(null);
  const [queuePrecalculateStatus, setQueuePrecalculateStatus] = useState<QueuePrecalculateStatus>({
    isRunning: false,
    total: 0,
    completed: 0,
    failed: 0,
    cores: getFullCoreCount(),
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [volume, setVolumeState] = useState<number>(savedState.volume ?? 1);
  const [playbackRate, setPlaybackRate] = useState<number>(savedState.playbackRate ?? 1);
  const [preservesPitch, setPreservesPitch] = useState<boolean>(savedState.preservesPitch ?? true);

  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const bufferStartTimeRef = useRef<number>(0);
  const bufferPausedTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const isDecodingRef = useRef<boolean>(false);
  const precalculatedNextBufferRef = useRef<{ trackId: string, buffer: AudioBuffer } | null>(null);
  const precalculatedQueueBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const renderSignatureBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const fullQueuePrecalculateCacheRef = useRef<boolean>(false);
  const renderSignatureCacheEnabledRef = useRef<boolean>(renderSignatureCacheEnabled);
  const isPrecalculatingNextRef = useRef<boolean>(false);
  const queuePrecalculateSessionRef = useRef<symbol | null>(null);
  const precalculateOnIdleRef = useRef<boolean>(precalculateOnIdle);
  const previousPrecalculateOnIdleRef = useRef<boolean>(precalculateOnIdle);
  const renderSettingsVersionRef = useRef<number>(0);
  const decodeSessionRef = useRef<symbol | null>(null);
  const playNextRef = useRef<(() => void) | null>(null);
  const playPreviousRef = useRef<(() => void) | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playTrackRef = useRef<((...args: any[]) => void) | null>(null);
  const currentTimeSnapshotRef = useRef<number>(0);
  const isPlayingSnapshotRef = useRef<boolean>(false);
  const currentTrackSnapshotRef = useRef<Track | null>(currentTrack ?? null);
  const usingBufferPlaybackRef = useRef<boolean>(false);
  const mediaSessionAnchorRef = useRef<HTMLAudioElement | null>(null);
  const mediaSessionAnchorUrlRef = useRef<string | null>(null);

  const clearTrackLoading = useCallback(() => {
    setIsLoadingTrack(false);
    setLoadingTrackId(null);
    setLoadingTrackPhase(null);
  }, []);

  const stopQueuePrecalculateStatusSoon = useCallback(() => {
    window.setTimeout(() => {
      setQueuePrecalculateStatus((previous) => (
        previous.isRunning ? { ...previous, isRunning: false } : previous
      ));
    }, 0);
  }, []);

  const getMediaSessionAnchor = useCallback(() => {
    if (!mediaSessionAnchorRef.current) {
      const anchor = new Audio();
      anchor.loop = true;
      anchor.preload = 'auto';
      anchor.src = mediaSessionAnchorUrlRef.current || createSilentWavUrl();
      mediaSessionAnchorUrlRef.current = anchor.src;
      mediaSessionAnchorRef.current = anchor;
    }

    return mediaSessionAnchorRef.current;
  }, []);

  const startMediaSessionAnchor = useCallback(() => {
    if (isLikelyConstrainedDevice()) return;

    const anchor = getMediaSessionAnchor();
    if (!anchor.paused) return;
    anchor.play().catch((e) => console.warn('[MediaSession] Silent anchor playback failed', e));
  }, [getMediaSessionAnchor]);

  const pauseMediaSessionAnchor = useCallback(() => {
    const anchor = mediaSessionAnchorRef.current;
    if (!anchor) return;

    anchor.pause();
    try {
      anchor.currentTime = 0;
    } catch {
      // Some browsers reject seeks while the silent anchor is still loading.
    }
  }, []);

  const updateMediaSessionMetadata = useCallback((track: Track | null) => {
    if (!('mediaSession' in navigator) || !track) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || (track.fileName ? track.fileName.replace(/\.[^/.]+$/, "") : 'Unknown Title'),
      artist: track.artist || (track.fileName?.includes(' - ') ? track.fileName.split(' - ')[0] : 'Unknown Artist'),
      album: track.album || 'Unknown Album',
      artwork: track.imageUrl ? [{ src: track.imageUrl, sizes: '512x512', type: 'image/jpeg' }] : []
    });
  }, []);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = "use-credentials";
      audioRef.current.volume = savedState.volume ?? 1;

      audioRef.current.addEventListener('timeupdate', () => {
        if (document.hidden) return;
        if (rafRef.current) return; // Ignore native timeupdate if raf is active
        setCurrentTime(audioRef.current!.currentTime);
      });

      const handleVisibilityChange = () => {
        if (!document.hidden && audioRef.current) {
          if (rafRef.current) return; // Ignore if using manual timer (precalculate mode)
          setCurrentTime(audioRef.current.currentTime);
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      // Store the handler on the ref for cleanup
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (audioRef as any).current._visibilityHandler = handleVisibilityChange;
      audioRef.current.addEventListener('loadedmetadata', () => {
        const dur = audioRef.current?.duration || 0;
        setDuration(dur);
        if (dur > 0 && currentTrackSnapshotRef.current && Number.isFinite(dur)) {
          const currentSavedDur = currentTrackSnapshotRef.current.durationSeconds || 0;
          if (Math.abs(dur - currentSavedDur) > 1) {
            const updatedTrack = { ...currentTrackSnapshotRef.current, durationSeconds: dur };
            if (setCurrentTrack) setCurrentTrack(updatedTrack);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (setQueue) setQueue((prevQueue: any[]) => prevQueue.map((t: any) => t.id === updatedTrack.id ? { ...t, durationSeconds: dur } : t));
          }
        }
      });
      audioRef.current.addEventListener('ended', () => {
        if (!usingBufferPlaybackRef.current) clearTrackLoading();
        if (playNextRef.current) playNextRef.current();
      });
      audioRef.current.addEventListener('play', () => {
        if (!usingBufferPlaybackRef.current) {
          clearTrackLoading();
          setIsPlaying(true);
        }
      });
      audioRef.current.addEventListener('playing', () => {
        if (!usingBufferPlaybackRef.current) clearTrackLoading();
      });
      audioRef.current.addEventListener('canplay', () => {
        if (!usingBufferPlaybackRef.current) clearTrackLoading();
      });
      audioRef.current.addEventListener('pause', () => {
        if (!usingBufferPlaybackRef.current) {
          clearTrackLoading();
          setIsPlaying(false);
        }
      });
      audioRef.current.addEventListener('error', () => {
        if (!usingBufferPlaybackRef.current) clearTrackLoading();
      });
    }

    return () => {
      // Cleanup on unmount (critical for React Hot Reload / Fast Refresh)
      if (audioRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((audioRef as any).current._visibilityHandler) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          document.removeEventListener('visibilitychange', (audioRef as any).current._visibilityHandler);
        }
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }
      pauseMediaSessionAnchor();
      if (mediaSessionAnchorRef.current) {
        mediaSessionAnchorRef.current.src = "";
        mediaSessionAnchorRef.current = null;
      }
      if (mediaSessionAnchorUrlRef.current) {
        URL.revokeObjectURL(mediaSessionAnchorUrlRef.current);
        mediaSessionAnchorUrlRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const allowedIdsRef = useRef<Set<string>>(new Set());
  const blobLoadingPromisesRef = useRef<Map<string, Promise<string>>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audioParamsRef = useRef<any>({
    preampGain,
    eqBands,
    bassGain,
    trebleGain,
    compThreshold,
    compRatio,
    compKnee,
    compAttack,
    compRelease,
    compRmsSize,
    compMakeupGain,
    reverbMix,
    reverbTime,
    stereoWidth,
    panValue,
    useOversample,
    loudnessNormalization,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fxEnabledRef = useRef<any>(fxEnabled);

  useEffect(() => {
    fxEnabledRef.current = fxEnabled;
  }, [fxEnabled]);

  useEffect(() => {
    renderSignatureCacheEnabledRef.current = renderSignatureCacheEnabled;
    if (!renderSignatureCacheEnabled) {
      renderSignatureBuffersRef.current.clear();
    }
  }, [renderSignatureCacheEnabled]);

  useEffect(() => {
    audioParamsRef.current = {
      preampGain,
      eqBands,
      bassGain,
      trebleGain,
      compThreshold,
      compRatio,
      compKnee,
      compAttack,
      compRelease,
      compRmsSize,
      compMakeupGain,
      reverbMix,
      reverbTime,
      stereoWidth,
      panValue,
      useOversample,
      loudnessNormalization,
    };
  }, [
    bassGain,
    compAttack,
    compKnee,
    compMakeupGain,
    compRatio,
    compRelease,
    compRmsSize,
    compThreshold,
    eqBands,
    panValue,
    preampGain,
    reverbMix,
    reverbTime,
    stereoWidth,
    trebleGain,
    useOversample,
    loudnessNormalization,
  ]);

  useEffect(() => {
    renderSettingsVersionRef.current += 1;
    precalculatedNextBufferRef.current = null;
    precalculatedQueueBuffersRef.current.clear();
    fullQueuePrecalculateCacheRef.current = false;
    queuePrecalculateSessionRef.current = null;
    stopQueuePrecalculateStatusSoon();
  }, [
    bassGain,
    compAttack,
    compKnee,
    compMakeupGain,
    compRatio,
    compRelease,
    compRmsSize,
    compThreshold,
    eqBands,
    fxEnabled,
    loudnessNormalization,
    panValue,
    preampGain,
    reverbMix,
    reverbTime,
    stopQueuePrecalculateStatusSoon,
    stereoWidth,
    trebleGain,
    useOversample,
  ]);

  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume);
    if (bufferVolumeNodeRef.current) {
      bufferVolumeNodeRef.current.gain.value = newVolume;
    }
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    try {
      const existing = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...existing, volume: newVolume }));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-empty
    } catch (e) { }
  }, [audioRef, bufferVolumeNodeRef]);

  const getTrackAudioUrl = useCallback(async (track: Track) => {
    return loadTrackAudioUrl({
      track,
      blobCache: blobCacheRef.current,
      blobLoadingPromises: blobLoadingPromisesRef.current,
      driveToken,
      fetchDriveToken,
    });
  }, [blobCacheRef, driveToken, fetchDriveToken]);

  const connectBufferOutputChain = useCallback(() => {
    if (!audioContextRef.current || !bufferVolumeNodeRef.current) return;

    bufferVolumeNodeRef.current.disconnect();
    bufferVolumeNodeRef.current.connect(audioContextRef.current.destination);
  }, [audioContextRef, bufferVolumeNodeRef]);

  const startBufferProgressTimer = useCallback(() => {
    if (rafRef.current) window.clearInterval(rafRef.current);

    const updateTime = () => {
      if (document.hidden) return;
      if (!audioContextRef.current) return;

      const elapsed = (audioContextRef.current.currentTime - bufferStartTimeRef.current) * playbackRate;
      const boundedElapsed = audioBufferRef.current
        ? clamp(elapsed, 0, audioBufferRef.current.duration)
        : Math.max(0, elapsed);

      setCurrentTime((previous) => (
        Math.abs(previous - boundedElapsed) < 0.05 ? previous : boundedElapsed
      ));
    };

    updateTime();
    rafRef.current = window.setInterval(updateTime, getBufferProgressIntervalMs());
  }, [audioContextRef, playbackRate]);

  const stopBufferPlayback = useCallback(() => {
    if (bufferSourceRef.current) {
      try {
        bufferSourceRef.current.onended = null;
        bufferSourceRef.current.stop();
      } catch {
        // Source may have already ended.
      }
      try {
        bufferSourceRef.current.disconnect();
      } catch {
        // Source may have already been disconnected.
      }
      bufferSourceRef.current = null;
    }

    if (rafRef.current) {
      window.clearInterval(rafRef.current);
      rafRef.current = null;
    }

    pauseMediaSessionAnchor();
  }, [bufferSourceRef, pauseMediaSessionAnchor]);

  const configureAudioElementSource = useCallback((audioUrl: string) => {
    if (!audioRef.current) return;

    audioRef.current.loop = false;
    if (audioUrl.startsWith('blob:')) {
      audioRef.current.removeAttribute('crossorigin');
    } else {
      audioRef.current.crossOrigin = "use-credentials";
    }
    audioRef.current.src = audioUrl;
  }, [audioRef]);

  const releaseAudioElementSource = useCallback(() => {
    if (!audioRef.current) return;

    audioRef.current.pause();
    audioRef.current.preload = 'none';
    audioRef.current.removeAttribute('src');
    try {
      audioRef.current.load();
    } catch {
      // Some browsers can throw while aborting an in-flight media load.
    }
  }, [audioRef]);

  const updatePlaybackRate = useCallback((val: number) => setPlaybackRate(val), []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const togglePreservesPitch = useCallback(() => setPreservesPitch((prev: any) => !prev), []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.preservesPitch = preservesPitch;
    }
    if (bufferSourceRef.current) {
      bufferSourceRef.current.playbackRate.value = playbackRate;
    }
    try {
      const existing = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...existing, playbackRate, preservesPitch }));
    } catch {
      // Ignore localStorage write failures.
    }
  }, [playbackRate, preservesPitch, audioRef, bufferSourceRef]);

  useEffect(() => {
    currentTimeSnapshotRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    isPlayingSnapshotRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    currentTrackSnapshotRef.current = currentTrack ?? null;
  }, [currentTrack]);

  useEffect(() => {
    precalculateOnIdleRef.current = precalculateOnIdle;
    const wasPrecalculating = previousPrecalculateOnIdleRef.current;
    previousPrecalculateOnIdleRef.current = precalculateOnIdle;

    if (!wasPrecalculating || precalculateOnIdle) return;

    const transitionSessionId = Symbol();
    decodeSessionRef.current = transitionSessionId;
    isDecodingRef.current = false;
    precalculatedNextBufferRef.current = null;
    precalculatedQueueBuffersRef.current.clear();
    fullQueuePrecalculateCacheRef.current = false;
    queuePrecalculateSessionRef.current = null;
    stopQueuePrecalculateStatusSoon();

    const trackToResume = currentTrackSnapshotRef.current;
    const resumeAt = currentTimeSnapshotRef.current;
    const shouldResume = isPlayingSnapshotRef.current;

    stopBufferPlayback();
    audioBufferRef.current = null;
    bufferPausedTimeRef.current = 0;
    usingBufferPlaybackRef.current = false;
    initializeAudioContext();

    if (!audioRef.current || !trackToResume) {
      setIsPlaying(false);
      clearTrackLoading();
      return;
    }

    (async () => {
      try {
        const audioUrl = await getTrackAudioUrl(trackToResume);
        if (decodeSessionRef.current !== transitionSessionId || precalculateOnIdleRef.current) return;
        if (!audioUrl) {
          setIsPlaying(false);
          clearTrackLoading();
          return;
        }

        configureAudioElementSource(audioUrl);

        const resumeHtmlAudio = () => {
          if (!audioRef.current) return;
          if (decodeSessionRef.current !== transitionSessionId || precalculateOnIdleRef.current) return;

          const safeResumeAt = Number.isFinite(audioRef.current.duration)
            ? clamp(resumeAt, 0, Math.max(0, audioRef.current.duration - 0.05))
            : Math.max(0, resumeAt);

          try {
            audioRef.current.currentTime = safeResumeAt;
          } catch {
            // Some blob-backed media reject seeking until metadata is ready.
          }

          if (shouldResume) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            audioRef.current.play().catch((e: any) => {
              console.error("Playback failed", e);
              clearTrackLoading();
            });
          } else {
            setIsPlaying(false);
            clearTrackLoading();
          }
        };

        if (audioRef.current.readyState >= 1) {
          resumeHtmlAudio();
        } else {
          audioRef.current.addEventListener('loadedmetadata', resumeHtmlAudio, { once: true });
        }
      } catch (e) {
        if (decodeSessionRef.current === transitionSessionId) {
          console.error("Failed to restore blob playback", e);
          setIsPlaying(false);
          clearTrackLoading();
        }
      }
    })();
  }, [
    audioRef,
    clearTrackLoading,
    configureAudioElementSource,
    getTrackAudioUrl,
    initializeAudioContext,
    precalculateOnIdle,
    stopQueuePrecalculateStatusSoon,
    stopBufferPlayback,
  ]);

  useEffect(() => {
    if (precalculateOnIdle && bufferVolumeNodeRef.current) {
      connectBufferOutputChain();
    }
  }, [bufferVolumeNodeRef, connectBufferOutputChain, precalculateOnIdle]);

  // Define functions in correct dependency order

  const createRenderSignature = () => {
    return createAudioRenderSignature(audioParamsRef.current, fxEnabledRef.current || {});
  };

  const getRenderSignatureCacheKey = (trackId: string, signature = createRenderSignature()) => (
    `${trackId}::${signature}`
  );

  const pruneRenderSignatureCache = () => {
    const cache = renderSignatureBuffersRef.current;
    while (cache.size > MAX_RENDER_SIGNATURE_CACHE_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey === undefined) break;
      cache.delete(oldestKey);
    }
  };

  const getCachedRenderSignatureBuffer = (trackId: string, signature = createRenderSignature()) => {
    if (!renderSignatureCacheEnabledRef.current) return null;

    const cache = renderSignatureBuffersRef.current;
    const key = getRenderSignatureCacheKey(trackId, signature);
    const cachedBuffer = cache.get(key);
    if (!cachedBuffer) return null;

    cache.delete(key);
    cache.set(key, cachedBuffer);
    return cachedBuffer;
  };

  const cacheRenderSignatureBuffer = (trackId: string, signature: string, buffer: AudioBuffer) => {
    if (!renderSignatureCacheEnabledRef.current) return;

    const cache = renderSignatureBuffersRef.current;
    const key = getRenderSignatureCacheKey(trackId, signature);
    cache.delete(key);
    cache.set(key, buffer);
    pruneRenderSignatureCache();
  };

  const prunePrecalculatedQueueBuffers = (preferredAllowedIds = allowedIdsRef.current) => {
    if (fullQueuePrecalculateCacheRef.current) return;

    const cache = precalculatedQueueBuffersRef.current;

    if (preferredAllowedIds.size > 0) {
      for (const key of cache.keys()) {
        if (!preferredAllowedIds.has(String(key))) {
          cache.delete(key);
        }
      }

      if (
        precalculatedNextBufferRef.current &&
        !preferredAllowedIds.has(precalculatedNextBufferRef.current.trackId)
      ) {
        precalculatedNextBufferRef.current = null;
      }
    }

    while (cache.size > MAX_PRECALCULATED_BUFFER_CACHE_SIZE) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey === undefined) break;
      cache.delete(oldestKey);
    }
  };

  const getCachedPrecalculatedQueueBuffer = (trackId: string) => {
    const cache = precalculatedQueueBuffersRef.current;
    const cachedBuffer = cache.get(trackId);
    if (!cachedBuffer) return null;

    cache.delete(trackId);
    cache.set(trackId, cachedBuffer);
    return cachedBuffer;
  };

  const cachePrecalculatedQueueBuffer = (
    trackId: string,
    buffer: AudioBuffer,
    preferredAllowedIds = allowedIdsRef.current
  ) => {
    const cache = precalculatedQueueBuffersRef.current;
    cache.delete(trackId);
    cache.set(trackId, buffer);
    prunePrecalculatedQueueBuffers(preferredAllowedIds);
  };

  const performOfflineRender = async (audioBuffer: AudioBuffer) =>
    renderOfflineAudio({
      audioBuffer,
      params: audioParamsRef.current,
      fxEnabled: fxEnabledRef.current || {},
      irBuffer: irBufferRef.current,
    });

  const precalculateTrackBuffer = async (track: Track, keepInQueueCache = false) => {
    const trackId = String(track.id);
    const cachedBuffer = getCachedPrecalculatedQueueBuffer(trackId);
    if (cachedBuffer) return cachedBuffer;

    const renderSignature = createRenderSignature();
    const signatureCachedBuffer = getCachedRenderSignatureBuffer(trackId, renderSignature);
    if (signatureCachedBuffer) {
      if (keepInQueueCache) {
        cachePrecalculatedQueueBuffer(trackId, signatureCachedBuffer);
      }
      return signatureCachedBuffer;
    }

    const renderVersion = renderSettingsVersionRef.current;
    const audioUrl = await getTrackAudioUrl(track);
    if (!audioUrl) {
      throw new Error(`No audio URL for track ${trackId}`);
    }

    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);
    const finalRenderedBuffer = await performOfflineRender(audioBuffer);

    if (renderSettingsVersionRef.current !== renderVersion) {
      throw new Error('Audio settings changed while pre-calculating');
    }

    if (keepInQueueCache) {
      cachePrecalculatedQueueBuffer(trackId, finalRenderedBuffer);
    }
    cacheRenderSignatureBuffer(trackId, renderSignature, finalRenderedBuffer);

    return finalRenderedBuffer;
  };

  const precalculateEntireQueue = async () => {
    if (!precalculateOnIdleRef.current || !Array.isArray(queue) || queue.length === 0) return;
    if (queuePrecalculateSessionRef.current) return;

    initializeAudioContext();

    const tracks = [...queue];
    const total = tracks.length;
    const cores = getFullCoreCount();
    const workerCount = Math.min(cores, total);
    const sessionId = Symbol();
    let cursor = 0;
    let completed = 0;
    let failed = 0;

    queuePrecalculateSessionRef.current = sessionId;
    fullQueuePrecalculateCacheRef.current = true;
    setQueuePrecalculateStatus({ isRunning: true, total, completed, failed, cores });

    const runWorker = async () => {
      while (queuePrecalculateSessionRef.current === sessionId) {
        const index = cursor;
        cursor += 1;
        if (index >= total) return;

        const track = tracks[index];
        try {
          await precalculateTrackBuffer(track, true);
          completed += 1;
        } catch (e) {
          failed += 1;
          console.error('[Queue Precalculate] Failed for track', track.title || track.fileName || track.id, e);
        }

        if (queuePrecalculateSessionRef.current !== sessionId) return;
        setQueuePrecalculateStatus({ isRunning: true, total, completed, failed, cores });
      }
    };

    await Promise.all(Array.from({ length: workerCount }, runWorker));

    if (queuePrecalculateSessionRef.current === sessionId) {
      queuePrecalculateSessionRef.current = null;
      setQueuePrecalculateStatus({ isRunning: false, total, completed, failed, cores });
    }
  };

  // Download tracks into RAM-backed blob URLs. The backend only provides the
  // Drive access token; playback happens from the browser's blob cache.
  const preloadTrack = async (track: Track) => {
    if (!track) return;
    try {
      await getTrackAudioUrl(track);
    } catch (e) {
      console.error("Preload failed for track", track.id, e);
    }
  };



  const preloadNextTrack = async (currentTrack: Track, currentQueue: Track[]) => {
    if (!precalculateOnIdleRef.current || isPrecalculatingNextRef.current) return;
    if (isLikelyConstrainedDevice()) {
      console.log("[Lookahead] Skipping next-track precalculate on constrained device");
      return;
    }

    // Find next track
    let nextTrack: Track | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const idx = currentQueue.findIndex((t: any) => String(t.id) === String(currentTrack.id));
    if (idx !== -1 && idx < currentQueue.length - 1) {
      nextTrack = currentQueue[idx + 1];
    } else if (queueEndMode === 'repeat' && idx === currentQueue.length - 1) {
      if (!isShuffleState) nextTrack = currentQueue[0];
    } else if (queueEndMode === 'next' && idx === currentQueue.length - 1 && upcomingQueues.length > 0) {
      nextTrack = upcomingQueues[0][0];
    }

    if (!nextTrack) return;

    // Check if we already have it
    if (precalculatedNextBufferRef.current?.trackId === String(nextTrack.id)) return;

    try {
      isPrecalculatingNextRef.current = true;
      console.log("[Lookahead] Precalculating next track:", nextTrack.title || nextTrack.fileName);

      const finalRenderedBuffer = await precalculateTrackBuffer(nextTrack);

      if (!precalculateOnIdleRef.current) return;
      const nextTrackId = String(nextTrack.id);
      cachePrecalculatedQueueBuffer(nextTrackId, finalRenderedBuffer);
      precalculatedNextBufferRef.current = { trackId: nextTrackId, buffer: finalRenderedBuffer };
      console.log("[Lookahead] Finished precalculating next track:", nextTrack.title || nextTrack.fileName);
    } catch (e) {
      console.error("[Lookahead] Failed to precalculate:", e);
    } finally {
      isPrecalculatingNextRef.current = false;
    }
  };


  const preloadAdjacentTracks = async (currentId: string | number, currentQueue: Track[], shouldPreload = true) => {
    const { allowedIds, prev1, next1 } = getAdjacentTrackWindow(currentId, currentQueue);
    allowedIdsRef.current = allowedIds;
    prunePrecalculatedQueueBuffers(allowedIds);

    // 1. Memory Cleanup: only keep current, prev1, and next1 in RAM.
    for (const [key, objectUrl] of blobCacheRef.current.entries()) {
      if (!allowedIds.has(String(key))) {
        URL.revokeObjectURL(objectUrl);
        blobCacheRef.current.delete(key);
        console.log(`[Cache Cleanup] Removed blob ${key} from RAM`);
      }
    }

    if (!shouldPreload) return;

    // 2. Preload the next and prev tracks
    if (next1) {
      await preloadTrack(next1);
    }
    if (prev1 && (!next1 || String(prev1.id) !== String(next1.id))) {
      await preloadTrack(prev1);
    }
  };


  const playCurrentBuffer = (offset = 0) => {
    if (!audioBufferRef.current || !audioContextRef.current) return;
    usingBufferPlaybackRef.current = true;
    stopBufferPlayback();
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.playbackRate.value = playbackRate;
    if (!bufferVolumeNodeRef.current) {
      bufferVolumeNodeRef.current = audioContextRef.current.createGain();
    }
    bufferVolumeNodeRef.current.gain.value = volume;
    connectBufferOutputChain();
    source.connect(bufferVolumeNodeRef.current);

    source.onended = () => {
      if (playNextRef.current) playNextRef.current();
    };

    bufferSourceRef.current = source;
    bufferStartTimeRef.current = audioContextRef.current.currentTime - (offset / playbackRate);
    source.start(0, offset);
    startMediaSessionAnchor();
    startBufferProgressTimer();
    setIsPlaying(true);
  };


  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  const playTrack = async (startingTrack: Track | null, currentQueue?: Track[], autoPlay = true, ..._args: any[]) => {
    initializeAudioContext();
    if (!startingTrack) return;
    if (!currentQueue) currentQueue = [startingTrack];
    setCurrentTrack(startingTrack);
    setQueue(currentQueue);
    const trackWindow = getAdjacentTrackWindow(startingTrack.id, currentQueue);
    allowedIdsRef.current = trackWindow.allowedIds;
    prunePrecalculatedQueueBuffers(trackWindow.allowedIds);
    setLoadingTrackId(String(startingTrack.id));
    setIsLoadingTrack(autoPlay);
    setLoadingTrackPhase(autoPlay ? 'downloading' : null);

    const playSessionId = Symbol();
    decodeSessionRef.current = playSessionId;
    isDecodingRef.current = false;
    stopBufferPlayback();

    let audioUrl = '';
    try {
      audioUrl = await getTrackAudioUrl(startingTrack);
      if (!audioUrl) {
        setIsPlaying(false);
        clearTrackLoading();
        return;
      }
    } catch (e) {
      console.error("[Audio] Failed to prepare track for playback", e);
      setIsPlaying(false);
      clearTrackLoading();
      return;
    }

    if (precalculateOnIdle) {
      usingBufferPlaybackRef.current = true;
      releaseAudioElementSource();
      updateMediaSessionMetadata(startingTrack);
      setIsPlaying(false);
      pauseMediaSessionAnchor();
      setLoadingTrackPhase(autoPlay ? 'processing' : null);

      (async () => {
        try {
          isDecodingRef.current = true;

          let finalRenderedBuffer: AudioBuffer | null = null;
          const startingTrackId = String(startingTrack.id);
          const cachedRenderedBuffer = getCachedPrecalculatedQueueBuffer(startingTrackId);
          if (cachedRenderedBuffer) {
            finalRenderedBuffer = cachedRenderedBuffer;
          } else if (precalculatedNextBufferRef.current?.trackId === startingTrackId) {
            finalRenderedBuffer = precalculatedNextBufferRef.current.buffer;
          } else {
            finalRenderedBuffer = await precalculateTrackBuffer(startingTrack);
          }

          // Check if session changed while decoding
          if (decodeSessionRef.current !== playSessionId || !precalculateOnIdleRef.current) return;

          audioBufferRef.current = finalRenderedBuffer;
          cachePrecalculatedQueueBuffer(startingTrackId, finalRenderedBuffer, trackWindow.allowedIds);
          if (precalculatedNextBufferRef.current?.trackId === startingTrackId) {
            precalculatedNextBufferRef.current = null;
          }
          setDuration(finalRenderedBuffer.duration);

          bufferSourceRef.current = audioContextRef.current!.createBufferSource();
          bufferSourceRef.current.buffer = finalRenderedBuffer;
          // (AudioBufferSourceNode doesn't support preservesPitch, only HTMLMediaElement does)
          bufferSourceRef.current.playbackRate.value = playbackRate;

          if (!bufferVolumeNodeRef.current) {
            bufferVolumeNodeRef.current = audioContextRef.current!.createGain();
          }
          bufferVolumeNodeRef.current.gain.value = volume;
          connectBufferOutputChain();
          bufferSourceRef.current.connect(bufferVolumeNodeRef.current);
          bufferSourceRef.current.onended = () => {
            if (playNextRef.current) playNextRef.current();
          };


          // Trigger background preload for the next track
          if (precalculateOnIdleRef.current) {
            setTimeout(() => preloadNextTrack(startingTrack, currentQueue), 500);
          }

          if (autoPlay) {
            bufferStartTimeRef.current = audioContextRef.current!.currentTime;
            bufferPausedTimeRef.current = 0;
            bufferSourceRef.current.start(0);
            startMediaSessionAnchor();
            clearTrackLoading();
            setIsPlaying(true);
            startBufferProgressTimer();
          } else {
            bufferPausedTimeRef.current = 0;
            clearTrackLoading();
            setIsPlaying(false);
          }
        } catch (e) {
          if (decodeSessionRef.current !== playSessionId) return;
          console.error("Decode failed, falling back to stream", e);
          audioBufferRef.current = null;
          usingBufferPlaybackRef.current = false;
          pauseMediaSessionAnchor();
          configureAudioElementSource(audioUrl);
          if (autoPlay) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            audioRef.current!.play().catch((playError: any) => {
              clearTrackLoading();
              console.error("Playback failed", playError);
            });
          }
        } finally {
          if (decodeSessionRef.current === playSessionId) {
            isDecodingRef.current = false;
            if (!autoPlay) {
              clearTrackLoading();
            }
          }
        }
      })();
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).dummyAudio) (window as any).dummyAudio.pause();
      pauseMediaSessionAnchor();
      audioBufferRef.current = null;
      usingBufferPlaybackRef.current = false;
      bufferPausedTimeRef.current = 0;
      configureAudioElementSource(audioUrl);
      if (autoPlay) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        audioRef.current!.play().catch((e: any) => {
          clearTrackLoading();
          console.error("Playback failed", e);
        });
      } else {
        audioRef.current!.pause();
        clearTrackLoading();
        setIsPlaying(false);
      }
    }

    // Keep only the active neighborhood in RAM: current, previous, and next.
    preloadAdjacentTracks(
      startingTrack.id,
      currentQueue!,
      !(precalculateOnIdleRef.current && isLikelyConstrainedDevice())
    );
    
    
  };


  const playNext = useCallback(() => {
    if (!currentTrack || queue.length === 0) return;

    // Read current precalculate state from ref to avoid stale closure
    const isPrecalc = precalculateOnIdleRef.current;

    if (songEndMode === 'repeat_one') {
      if (isPrecalc && audioBufferRef.current) {
        playCurrentBuffer(0);
      } else if (audioRef.current) {
        audioRef.current.currentTime = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        audioRef.current.play().catch((e: any) => console.error(e));
      }
      return;
    }

    if (songEndMode === 'stop') {
      if (isPrecalc) {
        stopBufferPlayback();
        setCurrentTime(0);
        bufferPausedTimeRef.current = 0;
        setIsPlaying(false);
      } else if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
      }
      return;
    }

    const isPreload = songEndMode === 'preload';

    // Use playTrackRef to always call the latest playTrack (avoids stale closure)
    const latestPlayTrack = playTrackRef.current;
    if (!latestPlayTrack) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const idx = queue.findIndex((t: any) => String(t.id) === String(currentTrack.id));
    if (idx !== -1 && idx < queue.length - 1) {
      latestPlayTrack(queue[idx + 1], queue, !isPreload);
    } else if (queueEndMode === 'repeat' && idx === queue.length - 1) {
      if (isShuffleState) {
        // eslint-disable-next-line prefer-const
        let newQueue = [...queue];
        for (let i = newQueue.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [newQueue[i], newQueue[j]] = [newQueue[j], newQueue[i]];
        }
        latestPlayTrack(newQueue[0], newQueue, !isPreload);
      } else {
        latestPlayTrack(queue[0], queue, !isPreload);
      }
    } else if (queueEndMode === 'next' && idx === queue.length - 1) {
      if (upcomingQueues.length > 0) {
        const nextQ = upcomingQueues[0];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setUpcomingQueues((prev: any) => {
          const rest = prev.slice(1);
          if (cycleQueues) return [...rest, queue];
          return rest;
        });
        latestPlayTrack(nextQ[0], nextQ, !isPreload);
      } else if (cycleQueues) {
        latestPlayTrack(queue[0], queue, !isPreload);
      } else {
        setIsPlaying(false);
      }
    } else {
      setIsPlaying(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack, queue, songEndMode, queueEndMode, isShuffleState, upcomingQueues, cycleQueues]);


  const playPrevious = useCallback(() => {
    if (!currentTrack || queue.length === 0) return;
    // Use playTrackRef to always call the latest playTrack (avoids stale closure)
    const latestPlayTrack = playTrackRef.current;
    if (!latestPlayTrack) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const idx = queue.findIndex((t: any) => String(t.id) === String(currentTrack.id));
    if (idx > 0) {
      latestPlayTrack(queue[idx - 1], queue);
    } else if (idx === 0 && queueEndMode === 'repeat' && queue.length > 1) {
      latestPlayTrack(queue[queue.length - 1], queue);
    }
  }, [currentTrack, queue, queueEndMode]);


  const togglePlay = () => {
    if (!audioRef.current) return;
    initializeAudioContext();
    if (isPlaying) {
      if (precalculateOnIdle && bufferSourceRef.current) {
        stopBufferPlayback();
        bufferPausedTimeRef.current = currentTime;
        setIsPlaying(false);
      } else {
        audioRef.current.pause();
      }
    } else {
      if (precalculateOnIdle && audioBufferRef.current) {
        playCurrentBuffer(bufferPausedTimeRef.current);
      } else if (!precalculateOnIdle && (!audioRef.current.src || audioRef.current.src === window.location.href || audioRef.current.src.endsWith('/'))) {
        if (currentTrack) {
          playTrack(currentTrack, queue, true);
        }
      } else if (!precalculateOnIdle) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        audioRef.current.play().catch((e: any) => console.error(e));
      } else if (currentTrack && isDecodingRef.current === false) {
        playTrack(currentTrack, queue, true);
      }
    }
  };


  const seek = (time: number) => {
    if (precalculateOnIdle && audioBufferRef.current) {
      bufferPausedTimeRef.current = time;
      setCurrentTime(time);
      if (isPlaying) {
        playCurrentBuffer(time);
      }
    } else if (audioRef.current) {
      audioRef.current.currentTime = time;
    }

    if ('mediaSession' in navigator && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: playbackRate,
          position: time
        });
      } catch {
        // Some browsers reject position updates while metadata is incomplete.
      }
    }
  };

  const seekRef = useRef(seek);
  const togglePlayRef = useRef(togglePlay);

  useEffect(() => {
    playNextRef.current = playNext;
    playPreviousRef.current = playPrevious;
    playTrackRef.current = playTrack;
    seekRef.current = seek;
    togglePlayRef.current = togglePlay;
  });

  // Update Media Session State
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      if (duration > 0 && !Number.isNaN(duration)) {
        try {
          navigator.mediaSession.setPositionState({
            duration: duration,
            playbackRate: playbackRate,
            position: currentTime
          });
        } catch {
          // Some browsers reject position updates while metadata is incomplete.
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, playbackRate, duration]);

  // Update Media Session Metadata and Handlers
  useEffect(() => {
    if ('mediaSession' in navigator) {
      updateMediaSessionMetadata(currentTrack ?? null);

      navigator.mediaSession.setActionHandler('play', () => togglePlayRef.current());
      navigator.mediaSession.setActionHandler('pause', () => togglePlayRef.current());
      navigator.mediaSession.setActionHandler('previoustrack', () => playPreviousRef.current?.());
      navigator.mediaSession.setActionHandler('nexttrack', () => playNextRef.current?.());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          seekRef.current(details.seekTime);
        }
      });
    }
  }, [currentTrack, updateMediaSessionMetadata]);

  useEffect(() => {
    const handleMusicDeleted = (e: Event) => {
      const deletedId = (e as CustomEvent).detail;
      if (!deletedId) return;
      
      let wasCurrent = false;
      if (currentTrackSnapshotRef.current && String(currentTrackSnapshotRef.current.id) === String(deletedId)) {
        wasCurrent = true;
      }
      
      if (wasCurrent) {
        setTimeout(() => {
          if (playNextRef.current) {
            playNextRef.current();
          } else if (setCurrentTrack) {
            setCurrentTrack(null);
            // Also stop the player
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.src = "";
            }
          }
        }, 50);
      }
    };

    window.addEventListener('music-deleted', handleMusicDeleted);
    return () => window.removeEventListener('music-deleted', handleMusicDeleted);
  }, [audioRef, setCurrentTrack]);

  // Compute hasNext and hasPrevious
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentIdx = currentTrack ? queue.findIndex((t: any) => String(t.id) === String(currentTrack.id)) : -1;
  const hasPrevious = currentIdx > 0 || (currentIdx === 0 && queueEndMode === 'repeat' && queue.length > 1);
  const hasNext = currentIdx !== -1 && (
    currentIdx < queue.length - 1 ||
    (queueEndMode === 'repeat' && queue.length > 1) ||
    (queueEndMode === 'next' && upcomingQueues && upcomingQueues.length > 0) ||
    (queueEndMode === 'next' && cycleQueues && queue.length > 0)
  );

  return {
    isPlaying,
    isLoadingTrack,
    loadingTrackId,
    loadingTrackPhase,
    currentTime,
    duration,
    volume,
    setVolume,
    playbackRate,
    updatePlaybackRate,
    preservesPitch,
    togglePreservesPitch,
    queuePrecalculateStatus,
    precalculateEntireQueue,
    playTrack,
    playNext,
    playPrevious,
    togglePlay,
    seek,
    preloadTrack,
    hasNext,
    hasPrevious
  };
}
