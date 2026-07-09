import { useState, useRef, useEffect, useCallback } from 'react';
import type { Track } from './audioTypes';
import { LOCAL_STORAGE_KEY } from './audioStorage';
import { clamp } from './audioMath';
import {
  calculateAutoPostFxTrimDb,
  calculateNormalizedTrackGain,
  INPUT_HEADROOM_DB,
} from './audioLoudness';
import { getBufferProgressIntervalMs, getFullCoreCount, isLikelyConstrainedDevice } from './audioDevice';
import { createRenderSignature as createAudioRenderSignature } from './audioRenderSignature';
import { renderOfflineAudio } from './offlineAudioRenderer';
import { useMediaSessionPlayback } from './useMediaSessionPlayback';
import {
  cachePrecalculatedQueueBuffer as cachePrecalculatedQueueBufferEntry,
  cacheRenderSignatureBuffer as cacheRenderSignatureBufferEntry,
  getCachedPrecalculatedQueueBuffer as getCachedPrecalculatedQueueBufferEntry,
  getCachedRenderSignatureBuffer as getCachedRenderSignatureBufferEntry,
  prunePrecalculatedQueueBuffers as prunePrecalculatedQueueBufferEntries,
  type LoadingTrackPhase,
  type PrecalculatedNextBuffer,
  type QueuePrecalculateStatus,
} from './audioPlaybackCache';
import {
  getAdjacentTrackWindow,
  getCurrentTrackIndex,
  getPlaybackAvailability,
} from './audioPlaybackQueue';
import { loadTrackAudioUrl } from './audioTrackLoader';

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
  const { audioContextRef, audioRef, bufferSourceRef, bufferVolumeNodeRef, initializeAudioContext, irBufferRef, setTrackLoudnessGain } = contextState;
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
  const precalculatedNextBufferRef = useRef<PrecalculatedNextBuffer | null>(null);
  const precalculatedQueueBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const renderSignatureBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const loudnessGainCacheRef = useRef<Map<string, number>>(new Map());
  const fullQueuePrecalculateCacheRef = useRef<boolean>(false);
  const renderSignatureCacheEnabledRef = useRef<boolean>(renderSignatureCacheEnabled);
  const isPrecalculatingNextRef = useRef<boolean>(false);
  const queuePrecalculateSessionRef = useRef<symbol | null>(null);
  const precalculateNextSessionRef = useRef<symbol | null>(null);
  const precalculateOnIdleRef = useRef<boolean>(precalculateOnIdle);
  const previousPrecalculateOnIdleRef = useRef<boolean>(precalculateOnIdle);
  const renderSettingsVersionRef = useRef<number>(0);
  const decodeSessionRef = useRef<symbol | null>(null);
  const playNextRef = useRef<(() => void) | null>(null);
  const playPreviousRef = useRef<(() => void) | null>(null);
  const seekRef = useRef<((time: number) => void) | null>(null);
  const togglePlayRef = useRef<(() => void) | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playTrackRef = useRef<((...args: any[]) => void) | null>(null);
  const currentTimeSnapshotRef = useRef<number>(0);
  const isPlayingSnapshotRef = useRef<boolean>(false);
  const currentTrackSnapshotRef = useRef<Track | null>(currentTrack ?? null);
  const queueSnapshotRef = useRef<Track[]>(queue ?? []);
  const upcomingQueuesSnapshotRef = useRef<Track[][]>(upcomingQueues ?? []);
  const usingBufferPlaybackRef = useRef<boolean>(false);

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

  const {
    startMediaSessionAnchor,
    pauseMediaSessionAnchor,
    cleanupMediaSessionAnchor,
    updateMediaSessionMetadata,
  } = useMediaSessionPlayback({
    currentTrack: currentTrack ?? null,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    onPlay: () => togglePlayRef.current?.(),
    onPause: () => togglePlayRef.current?.(),
    onPreviousTrack: () => playPreviousRef.current?.(),
    onNextTrack: () => playNextRef.current?.(),
    onSeekTo: (time) => seekRef.current?.(time),
  });

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
        if ((audioRef as any).current._visibilityHandler) {
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
      cleanupMediaSessionAnchor();
    };
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
    loudnessGainCacheRef.current.clear();
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
    queueSnapshotRef.current = queue ?? [];
  }, [queue]);

  useEffect(() => {
    upcomingQueuesSnapshotRef.current = upcomingQueues ?? [];
  }, [upcomingQueues]);

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

  const getCachedRenderSignatureBuffer = (trackId: string, signature = createRenderSignature()) => {
    return getCachedRenderSignatureBufferEntry({
      cache: renderSignatureBuffersRef.current,
      enabled: renderSignatureCacheEnabledRef.current,
      trackId,
      signature,
    });
  };

  const cacheRenderSignatureBuffer = (trackId: string, signature: string, buffer: AudioBuffer) => {
    cacheRenderSignatureBufferEntry({
      cache: renderSignatureBuffersRef.current,
      enabled: renderSignatureCacheEnabledRef.current,
      trackId,
      signature,
      buffer,
    });
  };

  const prunePrecalculatedQueueBuffers = (preferredAllowedIds = allowedIdsRef.current) => {
    precalculatedNextBufferRef.current = prunePrecalculatedQueueBufferEntries({
      cache: precalculatedQueueBuffersRef.current,
      preferredAllowedIds,
      nextBuffer: precalculatedNextBufferRef.current,
      fullQueuePrecalculateCache: fullQueuePrecalculateCacheRef.current,
    });
  };

  const getCachedPrecalculatedQueueBuffer = (trackId: string) => {
    return getCachedPrecalculatedQueueBufferEntry(precalculatedQueueBuffersRef.current, trackId);
  };

  const cachePrecalculatedQueueBuffer = (
    trackId: string,
    buffer: AudioBuffer,
    preferredAllowedIds = allowedIdsRef.current
  ) => {
    precalculatedNextBufferRef.current = cachePrecalculatedQueueBufferEntry({
      cache: precalculatedQueueBuffersRef.current,
      trackId,
      buffer,
      preferredAllowedIds,
      nextBuffer: precalculatedNextBufferRef.current,
      fullQueuePrecalculateCache: fullQueuePrecalculateCacheRef.current,
    });
  };

  const performOfflineRender = async (audioBuffer: AudioBuffer) =>
    renderOfflineAudio({
      audioBuffer,
      params: audioParamsRef.current,
      fxEnabled: fxEnabledRef.current || {},
      irBuffer: irBufferRef.current,
    });

  const getRealtimeTrackLoudnessGain = async (track: Track, audioUrl: string) => {
    if (!audioParamsRef.current.loudnessNormalization) return 1;

    const trackId = String(track.id);
    const cachedGain = loudnessGainCacheRef.current.get(trackId);
    if (cachedGain != null) return cachedGain;

    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);
      const postFxTrimDb = calculateAutoPostFxTrimDb(audioParamsRef.current, fxEnabledRef.current || {});
      const gain = calculateNormalizedTrackGain(audioBuffer, INPUT_HEADROOM_DB + postFxTrimDb);
      loudnessGainCacheRef.current.set(trackId, gain);
      return gain;
    } catch (error) {
      console.warn('[Audio] Loudness measurement failed; using unity gain.', error);
      return 1;
    }
  };

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



  const preloadNextTrack = async (currentTrack: Track, currentQueue: Track[], sessionId: symbol) => {
    if (!precalculateOnIdleRef.current || isPrecalculatingNextRef.current) return;
    if (isLikelyConstrainedDevice() || getFullCoreCount() <= 8) {
      console.log("[Lookahead] Skipping next-track precalculate on constrained device (or cores <= 8)");
      return;
    }

    // Find next track
    let nextTrack: Track | null = null;
    const idx = getCurrentTrackIndex(currentTrack, currentQueue);
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

    // Bail if the session was invalidated (user changed track before we started)
    if (precalculateNextSessionRef.current !== sessionId) return;

    try {
      isPrecalculatingNextRef.current = true;
      console.log("[Lookahead] Precalculating next track:", nextTrack.title || nextTrack.fileName);

      const finalRenderedBuffer = await precalculateTrackBuffer(nextTrack);

      // Discard if session was invalidated while precalculating (user switched track)
      if (!precalculateOnIdleRef.current || precalculateNextSessionRef.current !== sessionId) {
        console.log("[Lookahead] Discarding stale precalculated buffer (session changed)");
        return;
      }
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
    const { allowedIds, prev1, next1 } = getAdjacentTrackWindow(currentId, currentQueue, {
      wrap: queueEndMode === 'repeat',
    });
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
    const trackWindow = getAdjacentTrackWindow(startingTrack.id, currentQueue, {
      wrap: queueEndMode === 'repeat',
    });
    allowedIdsRef.current = trackWindow.allowedIds;
    prunePrecalculatedQueueBuffers(trackWindow.allowedIds);
    setLoadingTrackId(String(startingTrack.id));
    setIsLoadingTrack(autoPlay);
    setLoadingTrackPhase(autoPlay ? 'downloading' : null);

    const playSessionId = Symbol();
    decodeSessionRef.current = playSessionId;
    // Invalidate any in-flight preloadNextTrack from a previous playTrack call
    precalculateNextSessionRef.current = null;
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
      setTrackLoudnessGain?.(1);
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
          } else if (
            precalculatedNextBufferRef.current?.trackId === startingTrackId &&
            precalculatedNextBufferRef.current?.buffer
          ) {
            finalRenderedBuffer = precalculatedNextBufferRef.current.buffer;
          } else {
            finalRenderedBuffer = await precalculateTrackBuffer(startingTrack);
          }

          // Check if session changed while decoding
          if (decodeSessionRef.current !== playSessionId || !precalculateOnIdleRef.current) return;

          // SAFETY: Verify the current track is still the one we decoded for.
          // This guards against a rapid track-switch race where setCurrentTrack
          // ran for a newer track while we were still awaiting the buffer.
          if (String(currentTrackSnapshotRef.current?.id) !== startingTrackId) {
            console.warn('[Audio] Discarding stale buffer – currentTrack changed during decode',
              { expected: startingTrackId, actual: String(currentTrackSnapshotRef.current?.id) });
            return;
          }

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
            const nextSession = Symbol();
            precalculateNextSessionRef.current = nextSession;
            setTimeout(() => preloadNextTrack(startingTrack, currentQueue, nextSession), 500);
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
      if (loudnessNormalization) {
        setLoadingTrackPhase(autoPlay ? 'processing' : null);
      }
      const realtimeLoudnessGain = await getRealtimeTrackLoudnessGain(startingTrack, audioUrl);
      if (decodeSessionRef.current !== playSessionId || precalculateOnIdleRef.current) return;
      setTrackLoudnessGain?.(realtimeLoudnessGain);
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
      !(precalculateOnIdleRef.current && (isLikelyConstrainedDevice() || getFullCoreCount() <= 8))
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

    const idx = getCurrentTrackIndex(currentTrack, queue);
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
  }, [currentTrack, queue, songEndMode, queueEndMode, isShuffleState, upcomingQueues, cycleQueues]);


  const playPrevious = useCallback(() => {
    if (!currentTrack || queue.length === 0) return;
    // Use playTrackRef to always call the latest playTrack (avoids stale closure)
    const latestPlayTrack = playTrackRef.current;
    if (!latestPlayTrack) return;
    const idx = getCurrentTrackIndex(currentTrack, queue);
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

  useEffect(() => {
    playNextRef.current = playNext;
    playPreviousRef.current = playPrevious;
    playTrackRef.current = playTrack;
    seekRef.current = seek;
    togglePlayRef.current = togglePlay;
  });

  useEffect(() => {
    const stopDeletedCurrentTrack = () => {
      decodeSessionRef.current = Symbol();
      isDecodingRef.current = false;
      stopBufferPlayback();
      audioBufferRef.current = null;
      bufferPausedTimeRef.current = 0;
      usingBufferPlaybackRef.current = false;
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
      clearTrackLoading();
      releaseAudioElementSource();
      if (setCurrentTrack) setCurrentTrack(null);
    };

    const isTrackAllowed = (track: Track, validIds?: Set<string>) => (
      track.sourceType === 'LOCAL' || !validIds || validIds.has(String(track.id))
    );

    const continueAfterDeletedCurrentTrack = (deletedId: string | number, validIds?: Set<string>) => {
      const activeTrack = currentTrackSnapshotRef.current;
      if (!activeTrack || String(activeTrack.id) !== String(deletedId)) return;

      const deletedTrackId = String(deletedId);
      const deletedBlobUrl = blobCacheRef.current.get(deletedTrackId);
      if (deletedBlobUrl) {
        URL.revokeObjectURL(deletedBlobUrl);
        blobCacheRef.current.delete(deletedTrackId);
      }
      blobLoadingPromisesRef.current.delete(deletedTrackId);
      precalculatedQueueBuffersRef.current.delete(deletedTrackId);
      if (precalculatedNextBufferRef.current?.trackId === deletedTrackId) {
        precalculatedNextBufferRef.current = null;
      }
      for (const key of renderSignatureBuffersRef.current.keys()) {
        if (key.startsWith(`${deletedTrackId}::`)) {
          renderSignatureBuffersRef.current.delete(key);
        }
      }

      const currentQueue = queueSnapshotRef.current ?? [];
      const sanitizedQueue = currentQueue.filter((track) => (
        String(track.id) !== deletedTrackId && isTrackAllowed(track, validIds)
      ));
      const currentIndex = currentQueue.findIndex((track) => String(track.id) === deletedTrackId);
      const replacementTrack = currentIndex === -1
        ? sanitizedQueue[0]
        : currentQueue
          .slice(currentIndex + 1)
          .find((track) => String(track.id) !== deletedTrackId && isTrackAllowed(track, validIds))
        ?? (queueEndMode === 'repeat' ? sanitizedQueue[0] : undefined);

      if (replacementTrack && playTrackRef.current) {
        playTrackRef.current(replacementTrack, sanitizedQueue, isPlayingSnapshotRef.current);
        return;
      }

      if (queueEndMode === 'next') {
        const upcomingQueuesToKeep = (upcomingQueuesSnapshotRef.current ?? [])
          .map((nextQueue) => nextQueue.filter((track) => (
            String(track.id) !== deletedTrackId && isTrackAllowed(track, validIds)
          )))
          .filter((nextQueue) => nextQueue.length > 0);
        const nextQueue = upcomingQueuesToKeep[0];

        if (nextQueue?.[0] && playTrackRef.current) {
          setUpcomingQueues?.((previous: Track[][]) => {
            const rest = previous
              .map((candidateQueue) => candidateQueue.filter((track) => (
                String(track.id) !== deletedTrackId && isTrackAllowed(track, validIds)
              )))
              .filter((candidateQueue) => candidateQueue.length > 0)
              .slice(1);
            if (cycleQueues && sanitizedQueue.length > 0) return [...rest, sanitizedQueue];
            return rest;
          });
          playTrackRef.current(nextQueue[0], nextQueue, isPlayingSnapshotRef.current);
          return;
        }
      }

      stopDeletedCurrentTrack();
    };

    const handleMusicDeleted = (e: Event) => {
      const deletedId = (e as CustomEvent).detail;
      if (!deletedId) return;
      continueAfterDeletedCurrentTrack(deletedId);
    };

    const handleLibraryRefreshed = (e: Event) => {
      const trackIds = (e as CustomEvent<{ trackIds?: Array<string | number> }>).detail?.trackIds;
      if (!Array.isArray(trackIds)) return;

      const validIds = new Set(trackIds.map(String));
      const activeTrack = currentTrackSnapshotRef.current;
      if (activeTrack?.sourceType !== 'LOCAL' && activeTrack && !validIds.has(String(activeTrack.id))) {
        continueAfterDeletedCurrentTrack(activeTrack.id, validIds);
      }
    };

    window.addEventListener('music-deleted', handleMusicDeleted);
    window.addEventListener('music-library-refreshed', handleLibraryRefreshed);
    return () => {
      window.removeEventListener('music-deleted', handleMusicDeleted);
      window.removeEventListener('music-library-refreshed', handleLibraryRefreshed);
    };
  }, [
    blobCacheRef,
    clearTrackLoading,
    cycleQueues,
    queueEndMode,
    releaseAudioElementSource,
    setCurrentTrack,
    setUpcomingQueues,
    stopBufferPlayback,
  ]);

  const { hasPrevious, hasNext } = getPlaybackAvailability({
    currentTrack: currentTrack ?? null,
    queue,
    queueEndMode,
    upcomingQueues,
    cycleQueues,
  });

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
