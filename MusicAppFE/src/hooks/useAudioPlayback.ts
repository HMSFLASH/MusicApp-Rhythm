import { useState, useRef, useEffect, useCallback } from 'react';
import type { Track } from './audioTypes';
import { axiosClient } from '../api/axiosClient';
import { getAudioConfigStorageKey } from './audioStorage';
import { clamp } from './audioMath';
import {
  calculateAutoPostFxTrimDb,
  calculateNormalizedTrackGain,
  dbToGain,
  INPUT_HEADROOM_DB,
} from './audioLoudness';
import { getAudioFxActivity } from './audioFxActivity';
import { getBufferProgressIntervalMs, getFullCoreCount, getPrecalculateDelayMs, getQueuePrecalculateWorkerSettings, isLikelyConstrainedDevice, isMobileDevice } from './audioDevice';
import { audioBufferToWavBlob } from './audioBufferWav';
import {
  type AudioRenderParams,
  type FxEnabledFlags,
} from './audioRenderSignature';
import { renderOfflineAudio } from './offlineAudioRenderer';
import { useMediaSessionPlayback } from './useMediaSessionPlayback';
import {
  cachePrecalculatedQueueBuffer as cachePrecalculatedQueueBufferEntry,
  getCachedPrecalculatedQueueBuffer as getCachedPrecalculatedQueueBufferEntry,
  prunePrecalculatedQueueBuffers as prunePrecalculatedQueueBufferEntries,
  acquireInflight,
  registerInflight,
  releaseInflight,
  type InFlightTracker,
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
import { getAudioExtension } from './audioMime';
import { decodeFlacToAudioBuffer } from './flacDecoder';

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
  const configStorageKey = getAudioConfigStorageKey(isAuthenticated);
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
    fullQueueCacheEnabled,
    flacWasmOverrides,
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
    failedTrackIds: [],
  });
  const failedTrackIdsRef = useRef<string[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [volume, setVolumeState] = useState<number>(savedState.volume ?? 1);
  const [playbackRate, setPlaybackRate] = useState<number>(savedState.playbackRate ?? 1);
  const [preservesPitch, setPreservesPitch] = useState<boolean>(savedState.preservesPitch ?? true);

  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const renderedAudioRef = useRef<HTMLAudioElement | null>(null);
  const renderedAudioUrlRef = useRef<string | null>(null);
  const bufferStartTimeRef = useRef<number>(0);
  const bufferPausedTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const isDecodingRef = useRef<boolean>(false);
  const precalculatedNextBufferRef = useRef<PrecalculatedNextBuffer | null>(null);
  const precalculatedQueueBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const loudnessGainCacheRef = useRef<Map<string, number>>(new Map());
  const inFlightRef = useRef<InFlightTracker>(new Map());
  const fullQueuePrecalculateCacheRef = useRef<boolean>(false);
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
  const playTrackSpamGuardRef = useRef<{ trackId: string; timestamp: number } | null>(null);
  const visibilityHandlerRef = useRef<(() => void) | null>(null);
  const playCountSessionRef = useRef<symbol | null>(null);
  const playCountedSessionRef = useRef<symbol | null>(null);
  const listenedSecondsRef = useRef<number>(0);
  const lastListenTickRef = useRef<number | null>(null);

  const clearTrackLoading = useCallback(() => {
    setIsLoadingTrack(false);
    setLoadingTrackId(null);
    setLoadingTrackPhase(null);
  }, []);

  const resolveTrustedNativeDuration = useCallback((nativeDuration: number, track: Track | null) => {
    if (!Number.isFinite(nativeDuration) || nativeDuration <= 0) return 0;

    const savedDuration = track?.durationSeconds;
    if (
      getAudioExtension(track?.fileName) === 'flac' &&
      Number.isFinite(savedDuration) &&
      savedDuration &&
      nativeDuration < savedDuration - 1
    ) {
      return savedDuration;
    }

    return nativeDuration;
  }, []);

  const applyLoadedMetadataDuration = useCallback((nativeDuration: number) => {
    const activeTrack = currentTrackSnapshotRef.current;
    const trustedDuration = resolveTrustedNativeDuration(nativeDuration, activeTrack);
    setDuration(trustedDuration);

    if (trustedDuration > 0 && activeTrack && Number.isFinite(trustedDuration)) {
      const currentSavedDur = activeTrack.durationSeconds || 0;
      if (Math.abs(trustedDuration - currentSavedDur) > 1) {
        const updatedTrack = { ...activeTrack, durationSeconds: trustedDuration };
        if (setCurrentTrack) setCurrentTrack(updatedTrack);
        if (setQueue) setQueue((prevQueue: Track[]) => prevQueue.map((t) => t.id === updatedTrack.id ? { ...t, durationSeconds: trustedDuration } : t));
      }
    }
  }, [resolveTrustedNativeDuration, setCurrentTrack, setQueue]);

  const stopQueuePrecalculateStatusSoon = useCallback(() => {
    window.setTimeout(() => {
      setQueuePrecalculateStatus((previous) => (
        previous.isRunning ? { ...previous, isRunning: false } : previous
      ));
    }, 0);
  }, []);

  const resetQueuePrecalculateStatusSoon = useCallback(() => {
    window.setTimeout(() => {
      failedTrackIdsRef.current = [];
      setQueuePrecalculateStatus({ isRunning: false, total: 0, completed: 0, failed: 0, cores: 0, failedTrackIds: [] });
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

  const createDecodeContext = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OfflineAudioContextCtor = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    return new OfflineAudioContextCtor(1, 1, 44100) as OfflineAudioContext;
  }, []);

  const decodeAudioDataForPreRender = useCallback((arrayBuffer: ArrayBuffer) => {
    const decodeContext = createDecodeContext();
    return decodeContext.decodeAudioData(arrayBuffer);
  }, [createDecodeContext]);

  const shouldUseFlacWasmPlayback = useCallback((track: Track | null | undefined) => (
    Boolean(
      track &&
      getAudioExtension(track.fileName) === 'flac' &&
      (
        (
          flacWasmOverrides &&
          Object.prototype.hasOwnProperty.call(flacWasmOverrides, String(track.id))
        )
          ? flacWasmOverrides[String(track.id)]
          : false
      )
    )
  ), [flacWasmOverrides]);

  const revokeRenderedAudioUrl = useCallback(() => {
    if (!renderedAudioUrlRef.current) return;
    URL.revokeObjectURL(renderedAudioUrlRef.current);
    renderedAudioUrlRef.current = null;
  }, []);

  const releaseRenderedAudioSource = useCallback(() => {
    if (renderedAudioRef.current) {
      renderedAudioRef.current.pause();
      renderedAudioRef.current.removeAttribute('src');
      try {
        renderedAudioRef.current.load();
      } catch {
        // Some browsers can throw while aborting a media load.
      }
    }
    revokeRenderedAudioUrl();
  }, [revokeRenderedAudioUrl]);

  const configureRenderedAudioBufferSource = useCallback((audioBuffer: AudioBuffer) => {
    if (!renderedAudioRef.current) return '';

    // Create the new URL FIRST, so the browser doesn't reuse the revoked UUID.
    // If the UUID is reused, the .src setter short-circuits and plays the old track!
    const objectUrl = URL.createObjectURL(audioBufferToWavBlob(audioBuffer));

    revokeRenderedAudioUrl();
    renderedAudioUrlRef.current = objectUrl;

    // Force clear the old source to ensure the browser drops the old pipeline.
    renderedAudioRef.current.removeAttribute('src');

    renderedAudioRef.current.loop = false;
    renderedAudioRef.current.preload = 'auto';
    renderedAudioRef.current.volume = volume;
    renderedAudioRef.current.playbackRate = playbackRate;
    renderedAudioRef.current.preservesPitch = preservesPitch;
    renderedAudioRef.current.src = objectUrl;

    // Explicitly load the new source to flush the old pipeline immediately.
    // This prevents a race condition where .play() resumes the old track
    // for a split second before the new blob URL finishes loading.
    try {
      renderedAudioRef.current.load();
    } catch {
      // Ignore media load aborts while replacing the source.
    }

    return objectUrl;
  }, [playbackRate, preservesPitch, revokeRenderedAudioUrl, volume]);

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
      visibilityHandlerRef.current = handleVisibilityChange;
      audioRef.current.addEventListener('loadedmetadata', () => {
        applyLoadedMetadataDuration(audioRef.current?.duration || 0);
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
          setIsPlaying(false);
        }
      });
      audioRef.current.addEventListener('error', () => {
        if (!usingBufferPlaybackRef.current) clearTrackLoading();
      });
    }

    if (!renderedAudioRef.current) {
      const renderedAudio = new Audio();
      renderedAudio.volume = savedState.volume ?? 1;
      renderedAudio.preload = 'auto';
      renderedAudioRef.current = renderedAudio;

      renderedAudio.addEventListener('timeupdate', () => {
        if (document.hidden) return;
        setCurrentTime(renderedAudio.currentTime);
        bufferPausedTimeRef.current = renderedAudio.currentTime;
      });

      renderedAudio.addEventListener('loadedmetadata', () => {
        applyLoadedMetadataDuration(renderedAudio.duration || 0);
      });

      renderedAudio.addEventListener('ended', () => {
        clearTrackLoading();
        if (playNextRef.current) playNextRef.current();
      });
      renderedAudio.addEventListener('play', () => {
        clearTrackLoading();
        setIsPlaying(true);
      });
      renderedAudio.addEventListener('playing', () => {
        clearTrackLoading();
      });
      renderedAudio.addEventListener('canplay', () => {
        clearTrackLoading();
      });
      renderedAudio.addEventListener('pause', () => {
        setIsPlaying(false);
      });
      renderedAudio.addEventListener('error', () => {
        clearTrackLoading();
      });
    }

    return () => {
      // Cleanup on unmount (critical for React Hot Reload / Fast Refresh)
      if (audioRef.current) {
        if (visibilityHandlerRef.current) {
          document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
          visibilityHandlerRef.current = null;
        }
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      if (renderedAudioRef.current) {
        renderedAudioRef.current.pause();
        renderedAudioRef.current.src = "";
        renderedAudioRef.current = null;
      }
      revokeRenderedAudioUrl();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }
      cleanupMediaSessionAnchor();
    };
  }, []);
  const allowedIdsRef = useRef<Set<string>>(new Set());
  const blobLoadingPromisesRef = useRef<Map<string, Promise<string>>>(new Map());
  const audioParamsRef = useRef<AudioRenderParams>({
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
  const fxEnabledRef = useRef<FxEnabledFlags>(fxEnabled || {});

  useEffect(() => {
    fxEnabledRef.current = fxEnabled || {};
  }, [fxEnabled]);

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
    queuePrecalculateSessionRef.current = null;
    loudnessGainCacheRef.current.clear();
    inFlightRef.current.clear();
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
    if (renderedAudioRef.current) {
      renderedAudioRef.current.volume = newVolume;
    }
    try {
      const existing = JSON.parse(localStorage.getItem(configStorageKey) || '{}');
      localStorage.setItem(configStorageKey, JSON.stringify({ ...existing, volume: newVolume }));
    } catch {
      // Ignore localStorage write failures.
    }
  }, [audioRef, bufferVolumeNodeRef, configStorageKey]);

  const getTrackAudioUrl = useCallback(async (track: Track) => {
    return loadTrackAudioUrl({
      track,
      blobCache: blobCacheRef.current,
      blobLoadingPromises: blobLoadingPromisesRef.current,
      driveToken,
      fetchDriveToken,
    });
  }, [blobCacheRef, driveToken, fetchDriveToken]);

  const resetPlayCountTracking = useCallback((sessionId: symbol | null) => {
    playCountSessionRef.current = sessionId;
    playCountedSessionRef.current = null;
    listenedSecondsRef.current = 0;
    lastListenTickRef.current = null;
  }, []);

  const recordCurrentTrackPlay = useCallback(async (track: Track) => {
    if (!isAuthenticated || track.sourceType === 'LOCAL') return;

    try {
      const updated = await axiosClient.post(`/api/music/${track.id}/play`) as { id?: string; playCount?: number };
      const playCount = typeof updated.playCount === 'number'
        ? updated.playCount
        : (track.playCount ?? 0) + 1;

      const updatedTrack = { ...track, playCount };
      if (setCurrentTrack) {
        setCurrentTrack((previous: Track | null) => (
          previous && String(previous.id) === String(track.id)
            ? { ...previous, playCount }
            : previous
        ));
      }
      if (setQueue) {
        setQueue((previous: Track[]) => previous.map((item) => (
          String(item.id) === String(track.id) ? { ...item, playCount } : item
        )));
      }
      window.dispatchEvent(new CustomEvent('music-play-counted', {
        detail: { trackId: String(track.id), playCount: updatedTrack.playCount }
      }));
    } catch (error) {
      console.warn('[Audio] Failed to record play count', error);
    }
  }, [isAuthenticated, setCurrentTrack, setQueue]);

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

    if (renderedAudioRef.current) {
      renderedAudioRef.current.pause();
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

    // Force clear the old source to ensure the browser drops the old pipeline.
    audioRef.current.removeAttribute('src');

    audioRef.current.src = audioUrl;

    // Explicitly load the new source to flush the old pipeline immediately.
    try {
      audioRef.current.load();
    } catch {
      // Ignore media load aborts while replacing the source.
    }
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
    if (renderedAudioRef.current) {
      renderedAudioRef.current.playbackRate = playbackRate;
      renderedAudioRef.current.preservesPitch = preservesPitch;
    }
    if (bufferSourceRef.current) {
      bufferSourceRef.current.playbackRate.value = playbackRate;
    }
    try {
      const existing = JSON.parse(localStorage.getItem(configStorageKey) || '{}');
      localStorage.setItem(configStorageKey, JSON.stringify({ ...existing, playbackRate, preservesPitch }));
    } catch {
      // Ignore localStorage write failures.
    }
  }, [playbackRate, preservesPitch, audioRef, bufferSourceRef, configStorageKey]);

  useEffect(() => {
    currentTimeSnapshotRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    const track = currentTrack ?? null;
    const sessionId = playCountSessionRef.current;
    if (!isAuthenticated || !track || track.sourceType === 'LOCAL' || !sessionId) {
      lastListenTickRef.current = null;
      return;
    }

    if (!isPlaying || playCountedSessionRef.current === sessionId) {
      lastListenTickRef.current = null;
      return;
    }

    const now = performance.now();
    const previousTick = lastListenTickRef.current;
    lastListenTickRef.current = now;
    if (previousTick == null) return;

    const elapsedSeconds = Math.max(0, Math.min(2, ((now - previousTick) / 1000) * playbackRate));
    listenedSecondsRef.current += elapsedSeconds;

    const effectiveDuration = duration > 0 ? duration : (track.durationSeconds ?? 0);
    const thresholdSeconds = effectiveDuration > 0
      ? Math.min(30, Math.max(5, effectiveDuration * 0.5))
      : 30;

    if (listenedSecondsRef.current >= thresholdSeconds) {
      playCountedSessionRef.current = sessionId;
      lastListenTickRef.current = null;
      void recordCurrentTrackPlay(track);
    }
  }, [
    currentTime,
    currentTrack,
    duration,
    isAuthenticated,
    isPlaying,
    playbackRate,
    recordCurrentTrackPlay,
  ]);

  useEffect(() => {
    isPlayingSnapshotRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    currentTrackSnapshotRef.current = currentTrack ?? null;
  }, [currentTrack]);

  useEffect(() => {
    const currentQueue = queue ?? [];
    queueSnapshotRef.current = currentQueue;

    if (!fullQueuePrecalculateCacheRef.current && !queuePrecalculateSessionRef.current) return;

    const queueIds = new Set(currentQueue.map((track: Track) => String(track.id)));
    for (const key of precalculatedQueueBuffersRef.current.keys()) {
      if (!queueIds.has(String(key))) {
        precalculatedQueueBuffersRef.current.delete(key);
      }
    }

    if (
      precalculatedNextBufferRef.current &&
      !queueIds.has(precalculatedNextBufferRef.current.trackId)
    ) {
      precalculatedNextBufferRef.current = null;
    }

    if (queuePrecalculateSessionRef.current) {
      queuePrecalculateSessionRef.current = null;
      stopQueuePrecalculateStatusSoon();
    }

    if (queueIds.size === 0) {
      inFlightRef.current.clear();
      resetQueuePrecalculateStatusSoon();
    }
  }, [queue, resetQueuePrecalculateStatusSoon, stopQueuePrecalculateStatusSoon]);

  useEffect(() => {
    upcomingQueuesSnapshotRef.current = upcomingQueues ?? [];
  }, [upcomingQueues]);

  useEffect(() => {
    fullQueuePrecalculateCacheRef.current = fullQueueCacheEnabled;
    if (fullQueueCacheEnabled) return;

    precalculatedNextBufferRef.current = prunePrecalculatedQueueBufferEntries({
      cache: precalculatedQueueBuffersRef.current,
      preferredAllowedIds: allowedIdsRef.current,
      nextBuffer: precalculatedNextBufferRef.current,
      fullQueuePrecalculateCache: false,
    });
    queuePrecalculateSessionRef.current = null;
    inFlightRef.current.clear();
    resetQueuePrecalculateStatusSoon();
  }, [fullQueueCacheEnabled, resetQueuePrecalculateStatusSoon]);

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
    queuePrecalculateSessionRef.current = null;
    stopQueuePrecalculateStatusSoon();
    releaseRenderedAudioSource();

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
    releaseRenderedAudioSource,
    stopQueuePrecalculateStatusSoon,
    stopBufferPlayback,
  ]);

  useEffect(() => {
    if (precalculateOnIdle && bufferVolumeNodeRef.current) {
      connectBufferOutputChain();
    }
  }, [bufferVolumeNodeRef, connectBufferOutputChain, precalculateOnIdle]);

  // Define functions in correct dependency order

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
      const enabled = fxEnabledRef.current || {};
      const fxActivity = getAudioFxActivity(audioParamsRef.current, enabled);
      const postFxTrimDb = calculateAutoPostFxTrimDb(audioParamsRef.current, enabled);
      const downstreamGainDb = INPUT_HEADROOM_DB + postFxTrimDb;
      const normalizedGain = calculateNormalizedTrackGain(audioBuffer, downstreamGainDb);
      const gain = fxActivity.any
        ? normalizedGain
        : normalizedGain * dbToGain(downstreamGainDb);
      loudnessGainCacheRef.current.set(trackId, gain);
      return gain;
    } catch (error) {
      console.warn('[Audio] Loudness measurement failed; using unity gain.', error);
      return 1;
    }
  };

  const withRenderTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`Timeout: ${label} exceeded ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
  };

  const PRECALCULATE_TIMEOUT_MS = 120_000; // 2 minutes per track
  const FETCH_TIMEOUT_MS = 30_000; // 30 seconds for network operations

  const precalculateTrackBuffer = async (
    track: Track,
    keepInQueueCache = false,
    checkAborted?: () => boolean
  ) => {
    const trackId = String(track.id);
    const cachedBuffer = getCachedPrecalculatedQueueBuffer(trackId);
    if (cachedBuffer) return cachedBuffer;



    // Check if another caller is already rendering this track.
    const existingInflight = acquireInflight(inFlightRef.current, trackId);
    if (existingInflight) {
      try {
        const buffer = await existingInflight;
        if (keepInQueueCache) {
          cachePrecalculatedQueueBuffer(trackId, buffer);
        }
        return buffer;
      } catch {
        // First render failed – fall through to retry independently.
        releaseInflight(inFlightRef.current, trackId);
      }
    }

    // No cache hit and no in-flight render – do the work ourselves.
    const renderPromise = (async () => {
      try {
        const renderVersion = renderSettingsVersionRef.current;
        const audioUrl = await withRenderTimeout(
          getTrackAudioUrl(track),
          FETCH_TIMEOUT_MS,
          `getTrackAudioUrl(${trackId})`
        );
        if (!audioUrl) {
          throw new Error(`No audio URL for track ${trackId}`);
        }

        const response = await withRenderTimeout(
          fetch(audioUrl),
          FETCH_TIMEOUT_MS,
          `fetch(${trackId})`
        );
        const arrayBuffer = await withRenderTimeout(
          response.arrayBuffer(),
          FETCH_TIMEOUT_MS,
          `arrayBuffer(${trackId})`
        );

        if (checkAborted?.()) {
          throw new Error('Precalculation aborted');
        }

        const audioBuffer = await withRenderTimeout(
          shouldUseFlacWasmPlayback(track)
            ? decodeFlacToAudioBuffer(
              audioContextRef.current || createDecodeContext(),
              new Uint8Array(arrayBuffer),
              track.durationSeconds,
            )
            : decodeAudioDataForPreRender(arrayBuffer),
          PRECALCULATE_TIMEOUT_MS,
          `decode(${trackId})`
        );

        if (checkAborted?.()) {
          throw new Error('Precalculation aborted before rendering');
        }

        const finalRenderedBuffer = await withRenderTimeout(
          performOfflineRender(audioBuffer),
          PRECALCULATE_TIMEOUT_MS,
          `render(${trackId})`
        );

        if (renderSettingsVersionRef.current !== renderVersion) {
          throw new Error('Audio settings changed while pre-calculating');
        }


        return finalRenderedBuffer;
      } finally {
        releaseInflight(inFlightRef.current, trackId);
      }
    })();

    registerInflight(inFlightRef.current, trackId, renderPromise);
    const finalRenderedBuffer = await renderPromise;

    if (keepInQueueCache) {
      cachePrecalculatedQueueBuffer(trackId, finalRenderedBuffer);
    }

    return finalRenderedBuffer;
  };

  const precalculateEntireQueue = async (requestedWorkerCount?: number, tracksToProcess?: Track[]) => {
    if (!precalculateOnIdleRef.current || !fullQueueCacheEnabled || !Array.isArray(queue) || queue.length === 0) return;
    if (queuePrecalculateSessionRef.current) return;

    const tracks = tracksToProcess ? [...tracksToProcess] : [...queue];
    const total = tracks.length;
    const { recommendedWorkers, maxWorkers } = getQueuePrecalculateWorkerSettings(total);
    if (maxWorkers === 0) return;
    const workerCount = requestedWorkerCount != null
      ? Math.max(1, Math.min(Math.floor(requestedWorkerCount), maxWorkers))
      : recommendedWorkers;
    const sessionId = Symbol();
    let cursor = 0;
    let completed = 0;
    let failed = 0;
    const localFailedIds: string[] = [];

    queuePrecalculateSessionRef.current = sessionId;
    fullQueuePrecalculateCacheRef.current = true;
    failedTrackIdsRef.current = [];
    setQueuePrecalculateStatus({ isRunning: true, total, completed, failed, cores: workerCount, failedTrackIds: [] });

    const runWorker = async () => {
      while (queuePrecalculateSessionRef.current === sessionId) {
        const index = cursor;
        cursor += 1;
        if (index >= total) return;

        const track = tracks[index];
        try {
          await precalculateTrackBuffer(track, true, () => queuePrecalculateSessionRef.current !== sessionId);
          completed += 1;
        } catch (e) {
          failed += 1;
          localFailedIds.push(String(track.id));
          console.error('[Queue Precalculate] Failed for track', track.title || track.fileName || track.id, e);
        }

        if (queuePrecalculateSessionRef.current !== sessionId) return;
        setQueuePrecalculateStatus({ isRunning: true, total, completed, failed, cores: workerCount, failedTrackIds: [...localFailedIds] });
      }
    };

    await Promise.all(Array.from({ length: workerCount }, runWorker));

    if (queuePrecalculateSessionRef.current === sessionId) {
      queuePrecalculateSessionRef.current = null;
      failedTrackIdsRef.current = [...localFailedIds];
      setQueuePrecalculateStatus({ isRunning: false, total, completed, failed, cores: workerCount, failedTrackIds: [...localFailedIds] });
    }
  };

  const cancelQueuePrecalculate = useCallback(() => {
    if (!queuePrecalculateSessionRef.current) return;
    queuePrecalculateSessionRef.current = null;
    inFlightRef.current.clear();
    setQueuePrecalculateStatus((prev) => ({
      ...prev,
      isRunning: false,
    }));
  }, []);

  const retryFailedQueuePrecalculate = useCallback((requestedWorkerCount?: number) => {
    const failedIds = failedTrackIdsRef.current;
    if (!failedIds.length || !Array.isArray(queue) || queue.length === 0) return;
    const failedTracks = queue.filter((t: Track) => failedIds.includes(String(t.id)));
    if (failedTracks.length === 0) return;
    // Clear failed cache entries so they get re-rendered
    for (const id of failedIds) {
      inFlightRef.current.delete(id);
    }
    failedTrackIdsRef.current = [];
    precalculateEntireQueue(requestedWorkerCount, failedTracks);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

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
    // Keep blocking mobile devices; allow constrained desktop devices with
    // adaptive delay (handled by getPrecalculateDelayMs at the call-site).
    if (isMobileDevice()) {
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

      const finalRenderedBuffer = await precalculateTrackBuffer(nextTrack);

      // Discard if session was invalidated while precalculating (user switched track)
      if (!precalculateOnIdleRef.current || precalculateNextSessionRef.current !== sessionId) {
        return;
      }
      const nextTrackId = String(nextTrack.id);
      cachePrecalculatedQueueBuffer(nextTrackId, finalRenderedBuffer);
      precalculatedNextBufferRef.current = { trackId: nextTrackId, buffer: finalRenderedBuffer };
    } catch (e) {
      console.error("[Lookahead] Failed to precalculate:", e);
    } finally {
      isPrecalculatingNextRef.current = false;
    }
  };


  const preloadAdjacentTracks = async (currentId: string, currentQueue: Track[], shouldPreload = true) => {
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
    if (renderedAudioRef.current && renderedAudioUrlRef.current) {
      usingBufferPlaybackRef.current = true;
      const safeOffset = audioBufferRef.current
        ? clamp(offset, 0, Math.max(0, audioBufferRef.current.duration - 0.05))
        : Math.max(0, offset);

      try {
        renderedAudioRef.current.currentTime = safeOffset;
      } catch {
        // Some browsers reject seeking until metadata is ready.
      }

      bufferPausedTimeRef.current = safeOffset;
      renderedAudioRef.current.play().catch((e) => console.error("Playback failed", e));
      setIsPlaying(true);
      return;
    }

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
    if (!precalculateOnIdleRef.current) {
      initializeAudioContext();
    }
    if (!startingTrack) return;

    console.log(`\n--- [Audio] playTrack STARTED ---`);
    console.log(`[Audio] Requested Track ID: ${startingTrack.id}, Title: ${startingTrack.title}`);
    console.log(`[Audio] AutoPlay: ${autoPlay}, precalculateOnIdle: ${precalculateOnIdleRef.current}`);

    // Spam guard: prevent rapid repeated calls for the SAME track
    const now = performance.now();
    const lastCall = playTrackSpamGuardRef.current;
    if (lastCall) {
      const elapsed = now - lastCall.timestamp;
      // Same track clicked again within 300ms → skip (prevents double-click spam)
      if (lastCall.trackId === String(startingTrack.id) && elapsed < 300) {
        console.log(`[Audio] Spam guard triggered, skipping redundant playTrack call.`);
        return;
      }
    }
    playTrackSpamGuardRef.current = { trackId: String(startingTrack.id), timestamp: now };
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
    setLoadingTrackPhase(null);

    const playSessionId = Symbol();
    decodeSessionRef.current = playSessionId;
    resetPlayCountTracking(playSessionId);
    // Invalidate any in-flight preloadNextTrack from a previous playTrack call
    precalculateNextSessionRef.current = null;
    isDecodingRef.current = false;
    stopBufferPlayback();
    if (audioRef.current) audioRef.current.pause();

    const useRenderedBufferPlayback = precalculateOnIdle || shouldUseFlacWasmPlayback(startingTrack);
    console.log(`[Audio] useRenderedBufferPlayback: ${useRenderedBufferPlayback}`);

    if (useRenderedBufferPlayback) {
      setTrackLoudnessGain?.(1);
      usingBufferPlaybackRef.current = true;
      releaseAudioElementSource();
      releaseRenderedAudioSource();
      updateMediaSessionMetadata(startingTrack);
      setIsPlaying(false);
      pauseMediaSessionAnchor();

      (async () => {
        try {
          isDecodingRef.current = true;

          let finalRenderedBuffer: AudioBuffer | null = null;
          const startingTrackId = String(startingTrack.id);

          // Fast path: check in-memory cache BEFORE fetching the audio URL.
          const cachedRenderedBuffer = getCachedPrecalculatedQueueBuffer(startingTrackId);
          if (cachedRenderedBuffer) {
            console.log(`[Audio] Fast Path: Cache HIT for Track ID ${startingTrackId} in precalculatedQueueBuffersRef.`);
            finalRenderedBuffer = cachedRenderedBuffer;
          } else if (
            precalculatedNextBufferRef.current?.trackId === startingTrackId &&
            precalculatedNextBufferRef.current?.buffer
          ) {
            console.log(`[Audio] Fast Path: Cache HIT for Track ID ${startingTrackId} in precalculatedNextBufferRef.`);
            finalRenderedBuffer = precalculatedNextBufferRef.current.buffer;
          } else {
            console.log(`[Audio] Slow Path: Cache MISS for Track ID ${startingTrackId}. Proceeding to download.`);
          }

          // Track the audio URL for the fallback path (stream on decode failure).
          let slowPathAudioUrl = '';

          // Slow path: no cached buffer – need to download, decode, and render.
          if (!finalRenderedBuffer) {
            setLoadingTrackPhase(autoPlay ? 'downloading' : null);

            try {
              console.log(`[Audio] Fetching audio URL...`);
              slowPathAudioUrl = await getTrackAudioUrl(startingTrack);
              if (!slowPathAudioUrl) {
                console.warn(`[Audio] Empty audio URL returned.`);
                setIsPlaying(false);
                clearTrackLoading();
                return;
              }
              console.log(`[Audio] URL fetched successfully: ${slowPathAudioUrl.substring(0, 50)}...`);
            } catch (e) {
              console.error("[Audio] Failed to prepare track for playback", e);
              setIsPlaying(false);
              clearTrackLoading();
              return;
            }

            console.log(`[Audio] Starting buffer precalculation...`);
            setLoadingTrackPhase(autoPlay ? 'processing' : null);
            finalRenderedBuffer = await precalculateTrackBuffer(
              startingTrack,
              false,
              () => decodeSessionRef.current !== playSessionId
            );
            console.log(`[Audio] Precalculation completed.`);
          }

          // Check if session changed while decoding
          if (
            decodeSessionRef.current !== playSessionId ||
            (!precalculateOnIdleRef.current && !shouldUseFlacWasmPlayback(startingTrack))
          ) {
            console.log(`[Audio] Session changed or precalculation cancelled, aborting.`);
            return;
          }

          audioBufferRef.current = finalRenderedBuffer;
          cachePrecalculatedQueueBuffer(startingTrackId, finalRenderedBuffer, trackWindow.allowedIds);
          if (precalculatedNextBufferRef.current?.trackId === startingTrackId) {
            precalculatedNextBufferRef.current = null;
          }
          setDuration(finalRenderedBuffer.duration);
          console.log(`[Audio] Configuring rendered audio buffer source...`);
          const renderedAudioUrl = configureRenderedAudioBufferSource(finalRenderedBuffer);
          console.log(`[Audio] Configured blob URL: ${renderedAudioUrl}`);
          if (!renderedAudioUrl) {
            throw new Error('Failed to create rendered audio source');
          }


          // Trigger background preload for the next track
          if (precalculateOnIdleRef.current) {
            const nextSession = Symbol();
            precalculateNextSessionRef.current = nextSession;
            setTimeout(() => preloadNextTrack(startingTrack, currentQueue, nextSession), getPrecalculateDelayMs());
          }

          if (autoPlay) {
            bufferPausedTimeRef.current = 0;
            clearTrackLoading();
            try {
              renderedAudioRef.current!.currentTime = 0;
            } catch {
              // Some browsers reject seeking until metadata is ready.
            }
            renderedAudioRef.current!.play().catch((e) => {
              clearTrackLoading();
              console.error("Playback failed", e);
            });
            setIsPlaying(true);
          } else {
            bufferPausedTimeRef.current = 0;
            renderedAudioRef.current!.pause();
            clearTrackLoading();
            setIsPlaying(false);
          }
        } catch (e) {
          if (decodeSessionRef.current !== playSessionId) return;
          console.warn("[Audio] Render failed, retrying once…", e);

          // Retry: attempt to render again from scratch.
          try {
            const retryBuffer = await precalculateTrackBuffer(
              startingTrack,
              false,
              () => decodeSessionRef.current !== playSessionId
            );
            if (decodeSessionRef.current !== playSessionId) return;

            audioBufferRef.current = retryBuffer;
            setDuration(retryBuffer.duration);
            const retryUrl = configureRenderedAudioBufferSource(retryBuffer);
            if (!retryUrl) throw new Error('Failed to create rendered audio source on retry', { cause: e });

            if (autoPlay) {
              bufferPausedTimeRef.current = 0;
              clearTrackLoading();
              try {
                renderedAudioRef.current!.currentTime = 0;
              } catch {
                // Some browsers reject seeking until metadata is ready.
              }
              renderedAudioRef.current!.play().catch((pe) => {
                clearTrackLoading();
                console.error("Playback failed on retry", pe);
              });
              setIsPlaying(true);
            } else {
              bufferPausedTimeRef.current = 0;
              renderedAudioRef.current!.pause();
              clearTrackLoading();
              setIsPlaying(false);
            }
          } catch (retryError) {
            if (decodeSessionRef.current !== playSessionId) return;
            console.error("[Audio] Retry also failed, giving up", retryError);
            audioBufferRef.current = null;
            usingBufferPlaybackRef.current = false;
            pauseMediaSessionAnchor();
            releaseRenderedAudioSource();
            clearTrackLoading();
            setIsPlaying(false);
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
      // Non-buffer playback path (streaming)
      console.log(`[Audio] Using non-buffer (streaming) path.`);
      setLoadingTrackPhase(autoPlay ? 'downloading' : null);

      let audioUrl: string;
      try {
        console.log(`[Audio] Fetching audio URL for streaming...`);
        audioUrl = await getTrackAudioUrl(startingTrack);
        if (!audioUrl) {
          console.warn(`[Audio] Empty audio URL returned in streaming path.`);
          setIsPlaying(false);
          clearTrackLoading();
          return;
        }
        console.log(`[Audio] Streaming URL fetched: ${audioUrl.substring(0, 50)}...`);
      } catch (e) {
        console.error("[Audio] Failed to prepare track for playback", e);
        setIsPlaying(false);
        clearTrackLoading();
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).dummyAudio) (window as any).dummyAudio.pause();
      pauseMediaSessionAnchor();
      audioBufferRef.current = null;
      usingBufferPlaybackRef.current = false;
      bufferPausedTimeRef.current = 0;
      if (loudnessNormalization) {
        setLoadingTrackPhase(autoPlay ? 'processing' : null);
      }
      console.log(`[Audio] Fetching realtime loudness gain...`);
      const realtimeLoudnessGain = await getRealtimeTrackLoudnessGain(startingTrack, audioUrl);
      if (decodeSessionRef.current !== playSessionId || precalculateOnIdleRef.current) {
        console.log(`[Audio] Session changed during streaming prep, aborting.`);
        return;
      }
      setTrackLoudnessGain?.(realtimeLoudnessGain);
      console.log(`[Audio] Configuring streaming audio element source...`);
      configureAudioElementSource(audioUrl);
      if (autoPlay) {
        try {
          audioRef.current!.currentTime = 0;
        } catch {
          // Some browsers reject seeking until metadata is ready.
        }
        console.log(`[Audio] Starting streaming playback...`);
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
    const isRenderedBufferPlayback = isPrecalc || (usingBufferPlaybackRef.current && Boolean(renderedAudioUrlRef.current));

    if (songEndMode === 'repeat_one') {
      resetPlayCountTracking(Symbol());
      if (isRenderedBufferPlayback && (renderedAudioUrlRef.current || audioBufferRef.current)) {
        playCurrentBuffer(0);
      } else if (audioRef.current) {
        audioRef.current.currentTime = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        audioRef.current.play().catch((e: any) => console.error(e));
      }
      return;
    }

    if (songEndMode === 'stop') {
      if (isRenderedBufferPlayback) {
        stopBufferPlayback();
        if (renderedAudioRef.current) {
          renderedAudioRef.current.currentTime = 0;
        }
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
  }, [currentTrack, queue, songEndMode, queueEndMode, isShuffleState, upcomingQueues, cycleQueues, resetPlayCountTracking]);


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
    if (isLoadingTrack) return;
    if (!audioRef.current && !renderedAudioRef.current) return;
    if (!precalculateOnIdle) {
      initializeAudioContext();
    }
    if (isPlaying) {
      if ((precalculateOnIdle || usingBufferPlaybackRef.current) && renderedAudioRef.current && renderedAudioUrlRef.current) {
        bufferPausedTimeRef.current = renderedAudioRef.current.currentTime || currentTime;
        renderedAudioRef.current.pause();
        setIsPlaying(false);
      } else if (precalculateOnIdle && bufferSourceRef.current) {
        stopBufferPlayback();
        bufferPausedTimeRef.current = currentTime;
        setIsPlaying(false);
      } else {
        audioRef.current.pause();
      }
    } else {
      if ((precalculateOnIdle || usingBufferPlaybackRef.current) && (renderedAudioUrlRef.current || audioBufferRef.current)) {
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
    if ((precalculateOnIdle || usingBufferPlaybackRef.current) && renderedAudioRef.current && renderedAudioUrlRef.current) {
      const safeTime = audioBufferRef.current
        ? clamp(time, 0, Math.max(0, audioBufferRef.current.duration - 0.05))
        : Math.max(0, time);
      bufferPausedTimeRef.current = safeTime;
      setCurrentTime(safeTime);
      try {
        renderedAudioRef.current.currentTime = safeTime;
      } catch {
        // Some browsers reject seeking until metadata is ready.
      }
      if (isPlaying && renderedAudioRef.current.paused) {
        renderedAudioRef.current.play().catch((e) => console.error(e));
      }
    } else if (precalculateOnIdle && audioBufferRef.current) {
      bufferPausedTimeRef.current = time;
      setCurrentTime(time);
      if (isPlaying) playCurrentBuffer(time);
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
      releaseRenderedAudioSource();
      if (setCurrentTrack) setCurrentTrack(null);
    };

    const isTrackAllowed = (track: Track, validIds?: Set<string>) => (
      track.sourceType === 'LOCAL' || !validIds || validIds.has(String(track.id))
    );

    const continueAfterDeletedCurrentTrack = (deletedId: string, validIds?: Set<string>) => {
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
      const trackIds = (e as CustomEvent<{ trackIds?: Array<string> }>).detail?.trackIds;
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
    releaseRenderedAudioSource,
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
    cancelQueuePrecalculate,
    retryFailedQueuePrecalculate,
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
