import { useState, useRef, useEffect, useCallback } from 'react';
import type { Track } from './audioTypes';
import { LOCAL_STORAGE_KEY } from './audioStorage';
import { axiosClient } from '../api/axiosClient';
import { configureLoudnessNormalization, configureMasterLimiter, createSoftClipCurve } from './useAudioContext';

const BACKEND_URL = `http://${window.location.hostname}:8080`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const msToAudioSeconds = (value: number) => clamp(value / 1000, 0, 1);
const compressorAttackSeconds = (attackMs: number, rmsSizeMs: number) => msToAudioSeconds(Math.max(attackMs, rmsSizeMs * 0.5));
const percentToPan = (value: number) => clamp(value / 100, -1, 1);
const percentToStereoWidth = (value: number) => clamp(value / 100, 0, 2);
const percentToStereoBaseWidth = (value: number) => {
  const width = percentToStereoWidth(value);
  return width <= 1 ? width : clamp(1 + (width - 1) * 0.5, 1, 1.5);
};
const percentToPseudoStereoAmount = (value: number) => clamp((value - 100) / 100, 0, 1);
const REVERB_WET_GAIN = 0.75;

type NavigatorWithDeviceMemory = Navigator & { deviceMemory?: number };

const isLikelyConstrainedDevice = () => {
  const nav = navigator as NavigatorWithDeviceMemory;
  const cores = nav.hardwareConcurrency ?? 8;
  const memory = nav.deviceMemory ?? 8;
  const isCoarseSmallScreen = window.matchMedia?.('(pointer: coarse)').matches && window.innerWidth <= 1024;
  const isMobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent);

  return isMobileUserAgent || isCoarseSmallScreen || cores <= 4 || memory <= 4;
};

const connectStereoWidthMatrix = (ctx: BaseAudioContext, input: AudioNode, widthPercent: number) => {
  const width = percentToStereoBaseWidth(widthPercent);
  const pseudoAmount = percentToPseudoStereoAmount(widthPercent);
  const out = ctx.createGain();
  const stereoInput = ctx.createGain();
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);

  stereoInput.channelCount = 2;
  stereoInput.channelCountMode = 'explicit';
  stereoInput.channelInterpretation = 'speakers';

  const lToL = ctx.createGain();
  const rToL = ctx.createGain();
  const lToR = ctx.createGain();
  const rToR = ctx.createGain();

  lToL.gain.value = (1 + width) / 2;
  rToL.gain.value = (1 - width) / 2;
  lToR.gain.value = (1 - width) / 2;
  rToR.gain.value = (1 + width) / 2;

  input.connect(stereoInput);
  stereoInput.connect(splitter);
  splitter.connect(lToL, 0);
  splitter.connect(lToR, 0);
  splitter.connect(rToL, 1);
  splitter.connect(rToR, 1);

  lToL.connect(merger, 0, 0);
  rToL.connect(merger, 0, 0);
  lToR.connect(merger, 0, 1);
  rToR.connect(merger, 0, 1);
  merger.connect(out);

  if (pseudoAmount > 0) {
    const pseudoMono = ctx.createGain();
    const pseudoDelay = ctx.createDelay(0.05);
    const pseudoHighpass = ctx.createBiquadFilter();
    const pseudoLeft = ctx.createGain();
    const pseudoRight = ctx.createGain();
    const pseudoMerger = ctx.createChannelMerger(2);
    const pseudoWet = ctx.createGain();

    pseudoMono.channelCount = 1;
    pseudoMono.channelCountMode = 'explicit';
    pseudoMono.channelInterpretation = 'speakers';
    pseudoDelay.delayTime.value = 0.012 + 0.008 * pseudoAmount;
    pseudoHighpass.type = 'highpass';
    pseudoHighpass.frequency.value = 180;
    pseudoWet.gain.value = 0.16 * pseudoAmount;

    input.connect(pseudoMono);
    pseudoMono.connect(pseudoLeft);
    pseudoMono.connect(pseudoDelay);
    pseudoDelay.connect(pseudoHighpass);
    pseudoHighpass.connect(pseudoRight);
    pseudoLeft.connect(pseudoMerger, 0, 0);
    pseudoRight.connect(pseudoMerger, 0, 1);
    pseudoMerger.connect(pseudoWet);
    pseudoWet.connect(out);
  }

  return out;
};

export function useAudioPlayback(
  jwtToken: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queueState: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  effectsState: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contextState: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadataState: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  savedState: any
) {
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
  } = effectsState || {};
  const { audioContextRef, audioRef, bufferSourceRef, bufferVolumeNodeRef, initializeAudioContext, irBufferRef } = contextState;
  const { blobCacheRef } = metadataState;

  const [isPlaying, setIsPlaying] = useState(false);
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
  const isPrecalculatingNextRef = useRef<boolean>(false);
  const precalculateOnIdleRef = useRef<boolean>(precalculateOnIdle);
  const previousPrecalculateOnIdleRef = useRef<boolean>(precalculateOnIdle);
  const decodeSessionRef = useRef<symbol | null>(null);
  const playNextRef = useRef<(() => void) | null>(null);
  const playPreviousRef = useRef<(() => void) | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playTrackRef = useRef<((...args: any[]) => void) | null>(null);
  const currentTimeSnapshotRef = useRef<number>(0);
  const isPlayingSnapshotRef = useRef<boolean>(false);
  const currentTrackSnapshotRef = useRef<Track | null>(currentTrack ?? null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = "anonymous";
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
        if (playNextRef.current) playNextRef.current();
      });
      audioRef.current.addEventListener('play', () => setIsPlaying(true));
      audioRef.current.addEventListener('pause', () => setIsPlaying(false));
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
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const preloadingIdsRef = useRef<Set<string>>(new Set());
  const allowedIdsRef = useRef<Set<string>>(new Set());
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
    precalculatedNextBufferRef.current = null;
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
    playbackRate,
    preampGain,
    reverbMix,
    reverbTime,
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

  const getTrackAudioUrl = useCallback((track: Track) => {
    const trackId = String(track.id);
    const cachedUrl = blobCacheRef.current.get(trackId);
    if (cachedUrl) return cachedUrl;

    if (track.sourceType === 'LOCAL' && track.localFile instanceof Blob) {
      const objectUrl = URL.createObjectURL(track.localFile);
      blobCacheRef.current.set(trackId, objectUrl);
      return objectUrl;
    }

    if (track.sourceType !== 'LOCAL') {
      return `${BACKEND_URL}/api/music/stream/${track.id}?access_token=${jwtToken}`;
    }

    return '';
  }, [blobCacheRef, jwtToken]);

  const connectBufferOutputChain = useCallback(() => {
    if (!audioContextRef.current || !bufferVolumeNodeRef.current) return;

    bufferVolumeNodeRef.current.disconnect();
    bufferVolumeNodeRef.current.connect(audioContextRef.current.destination);
  }, [audioContextRef, bufferVolumeNodeRef]);

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
  }, [bufferSourceRef]);

  const configureAudioElementSource = useCallback((audioUrl: string) => {
    if (!audioRef.current) return;

    audioRef.current.loop = false;
    if (audioUrl.startsWith('blob:')) {
      audioRef.current.removeAttribute('crossorigin');
    } else {
      audioRef.current.crossOrigin = "anonymous";
    }
    audioRef.current.src = audioUrl;
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
    } catch (e) {}
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

    const trackToResume = currentTrackSnapshotRef.current;
    const resumeAt = currentTimeSnapshotRef.current;
    const shouldResume = isPlayingSnapshotRef.current;

    stopBufferPlayback();
    audioBufferRef.current = null;
    bufferPausedTimeRef.current = 0;
    initializeAudioContext();

    if (!audioRef.current || !trackToResume) {
      setIsPlaying(false);
      return;
    }

    const audioUrl = getTrackAudioUrl(trackToResume);
    if (!audioUrl) {
      setIsPlaying(false);
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
        // Some streams reject seeking until enough data is loaded.
      }

      if (shouldResume) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        audioRef.current.play().catch((e: any) => console.error("Playback failed", e));
      } else {
        setIsPlaying(false);
      }
    };

    if (audioRef.current.readyState >= 1) {
      resumeHtmlAudio();
    } else {
      audioRef.current.addEventListener('loadedmetadata', resumeHtmlAudio, { once: true });
    }
  }, [
    audioRef,
    configureAudioElementSource,
    getTrackAudioUrl,
    initializeAudioContext,
    precalculateOnIdle,
    stopBufferPlayback,
  ]);

  useEffect(() => {
    if (precalculateOnIdle && bufferVolumeNodeRef.current) {
      connectBufferOutputChain();
    }
  }, [bufferVolumeNodeRef, connectBufferOutputChain, precalculateOnIdle]);

  // Define functions in correct dependency order

  const performOfflineRender = async (audioBuffer: AudioBuffer, rate: number = 1.0) => {
console.log("[Audio] performOfflineRender called with EQ bands:", audioParamsRef.current.eqBands.length);
    if (!audioBuffer) return audioBuffer;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const offlineCtx = new OfflineAudioContext(2, length, sampleRate);

    const offlineSource = offlineCtx.createBufferSource();
    offlineSource.buffer = audioBuffer;
    offlineSource.playbackRate.value = 1.0;

    let currentNode: AudioNode = offlineSource;
    const enabled = fxEnabledRef.current;
    const { preampGain, eqBands, bassGain, trebleGain, compThreshold, compRatio, compKnee, compAttack, compRelease, compRmsSize, compMakeupGain, reverbMix, stereoWidth, panValue, loudnessNormalization } = audioParamsRef.current;

    // 1. Gain Staging (-6dB)
    const headroomDrop = offlineCtx.createGain();
    headroomDrop.gain.value = 0.5;
    currentNode.connect(headroomDrop);
    currentNode = headroomDrop;

    // 1.5 Preamp
    if (enabled.preamp) {
      const preamp = offlineCtx.createGain();
      preamp.gain.value = Math.pow(10, preampGain / 20);
      currentNode.connect(preamp);
      currentNode = preamp;
    }

    // 2. EQ
    if (enabled.eq && eqBands && eqBands.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filters = eqBands.map((band: any) => {
        const filter = offlineCtx.createBiquadFilter();
        filter.type = band.type || 'peaking';
        filter.frequency.value = band.frequency;
        filter.Q.value = band.q;
        filter.gain.value = band.gain;
        return filter;
      });

      const splitter = offlineCtx.createChannelSplitter(2);
      const merger = offlineCtx.createChannelMerger(2);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stereoFilters = filters.filter((_: any, i: number) => eqBands[i].channel === 'L+R');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const leftFilters = filters.filter((_: any, i: number) => eqBands[i].channel === 'L');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rightFilters = filters.filter((_: any, i: number) => eqBands[i].channel === 'R');

      // Stereo Chain
      let prevNode = null;
      for (const filter of stereoFilters) {
        if (prevNode) prevNode.connect(filter);
        else currentNode.connect(filter);
        prevNode = filter;
      }
      if (prevNode) prevNode.connect(splitter);
      else currentNode.connect(splitter);

      // Left Chain
      let leftNode = splitter;
      let prevLeft = null;
      for (const filter of leftFilters) {
        if (prevLeft) prevLeft.connect(filter);
        else splitter.connect(filter, 0, 0);
        prevLeft = filter;
      }
      if (prevLeft) leftNode = prevLeft;

      // Right Chain
      let rightNode = splitter;
      let prevRight = null;
      for (const filter of rightFilters) {
        if (prevRight) prevRight.connect(filter);
        else splitter.connect(filter, 1, 0);
        prevRight = filter;
      }
      if (prevRight) rightNode = prevRight;

      leftNode.connect(merger, leftNode === splitter ? 0 : 0, 0);
      rightNode.connect(merger, rightNode === splitter ? 1 : 0, 1);

      currentNode = merger;
    }

    // 3. Tone
    if (enabled.tone) {
      const bass = offlineCtx.createBiquadFilter();
      bass.type = 'lowshelf';
      bass.frequency.value = 150;
      bass.gain.value = bassGain;

      const treble = offlineCtx.createBiquadFilter();
      treble.type = 'highshelf';
      treble.frequency.value = 4000;
      treble.gain.value = trebleGain;

      currentNode.connect(bass);
      bass.connect(treble);
      currentNode = treble;
    }

    // 4. Compressor
    if (enabled.comp) {
      const comp = offlineCtx.createDynamicsCompressor();
      comp.threshold.value = compThreshold;
      comp.ratio.value = compRatio;
      comp.knee.value = compKnee;
      comp.attack.value = compressorAttackSeconds(compAttack, compRmsSize);
      comp.release.value = msToAudioSeconds(compRelease);

      const makeup = offlineCtx.createGain();
      makeup.gain.value = Math.pow(10, compMakeupGain / 20);

      currentNode.connect(comp);
      comp.connect(makeup);
      currentNode = makeup;
    }

    // 5. Reverb
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dryGain: any, wetGain: any;
    let isReverbParallel = false;
    if (enabled.reverb) {
      const preDelay = offlineCtx.createDelay(1.0);
      preDelay.delayTime.value = 0.02;

      const convolver = offlineCtx.createConvolver();
      if (irBufferRef.current) {
        convolver.buffer = irBufferRef.current;
      }
      
      dryGain = offlineCtx.createGain();
      const x = reverbMix / 100;
      dryGain.gain.value = Math.cos(x * Math.PI / 2);

      wetGain = offlineCtx.createGain();
      wetGain.gain.value = Math.sin(x * Math.PI / 2) * REVERB_WET_GAIN;

      currentNode.connect(dryGain);
      currentNode.connect(preDelay);
      preDelay.connect(convolver);
      convolver.connect(wetGain);

      isReverbParallel = true;
    }

    const connectToNext = (nextNode: AudioNode) => {
      if (isReverbParallel && dryGain && wetGain) {
        dryGain.connect(nextNode);
        wetGain.connect(nextNode);
        isReverbParallel = false;
      } else {
        currentNode.connect(nextNode);
      }
      currentNode = nextNode;
    };

    // 5.5 Stereo Width Matrix
      if (enabled.stereo) {
        const stereoInput = offlineCtx.createGain();
        connectToNext(stereoInput);
        currentNode = connectStereoWidthMatrix(offlineCtx, stereoInput, stereoWidth);
      }

    // 6. Pan
    if (enabled.master) {
      const panNode = offlineCtx.createStereoPanner();
      panNode.pan.value = percentToPan(panValue);
      connectToNext(panNode);
    }

    // 6.5 Loudness Normalization
    const agcPreGain = offlineCtx.createGain();
    const agcComp = offlineCtx.createDynamicsCompressor();
    const agcMakeup = offlineCtx.createGain();
    configureLoudnessNormalization(agcPreGain, agcComp, agcMakeup, Boolean(loudnessNormalization));
    connectToNext(agcPreGain);
    agcPreGain.connect(agcComp);
    agcComp.connect(agcMakeup);
    currentNode = agcMakeup;

    // 7. Headroom Recover
    const headroomRecover = offlineCtx.createGain();
    headroomRecover.gain.value = 1.414;
    connectToNext(headroomRecover);

    // 8. Limiter & Soft Clip
    if (enabled.limiter) {
      const limiter = offlineCtx.createDynamicsCompressor();
      configureMasterLimiter(limiter);
      connectToNext(limiter);

      const softClip = offlineCtx.createWaveShaper();
      softClip.curve = createSoftClipCurve(44100);
      softClip.oversample = audioParamsRef.current.useOversample ? '4x' : 'none';
      connectToNext(softClip);
    }

    connectToNext(offlineCtx.destination);

    offlineSource.start(0);
    const renderedBuffer = await offlineCtx.startRendering();
    return renderedBuffer;
  };

  // Preload tracks into RAM
  const preloadTrack = async (track: Track) => {
    if (!track) return;
    if (blobCacheRef.current.has(String(track.id)) || preloadingIdsRef.current.has(String(track.id))) {
      return;
    }

    preloadingIdsRef.current.add(String(track.id));

    try {
      if (track.sourceType === 'LOCAL' && track.localFile instanceof Blob) {
        blobCacheRef.current.set(String(track.id), URL.createObjectURL(track.localFile));
        return;
      }
      
      if (track.sourceType === 'LOCAL') return;
      if (!jwtToken) return;

      console.log(`[preloadTrack] Fetching blob for ${track.title || track.fileName || 'Unknown Track'}...`);
      const streamUrl = `${BACKEND_URL}/api/music/stream/${track.id}`;
      const fetchUrl = `${streamUrl}?_t=${Date.now()}`;
      const res = await axiosClient.get(fetchUrl, { responseType: 'blob' });
      const rawBlob = res as unknown as Blob;
      console.log(`[preloadTrack] Blob downloaded for ${track.title || track.fileName || 'Unknown Track'}`);

      const ext = track.fileName?.split('.').pop()?.toLowerCase();
      let mimeType = rawBlob.type;
      if (ext === 'm4a') mimeType = 'audio/mp4';
      else if (ext === 'opus') mimeType = 'audio/ogg';
      else if (ext === 'flac') mimeType = 'audio/flac';
      else if (ext === 'wav') mimeType = 'audio/wav';
      else if (ext === 'ogg') mimeType = 'audio/ogg';
      else if (!mimeType || mimeType === 'application/octet-stream') mimeType = 'audio/mpeg';

      const blob = new Blob([rawBlob], { type: mimeType });
      const objectUrl = URL.createObjectURL(blob);

      // Prevent memory leak if user skipped tracks before download finished
      if (allowedIdsRef.current.size > 0 && !allowedIdsRef.current.has(String(track.id))) {
        URL.revokeObjectURL(objectUrl);
        console.log(`[Cache Cleanup] Skipped adding ${track.id} to RAM due to race condition`);
        return;
      }

      blobCacheRef.current.set(String(track.id), objectUrl);

    } catch (e) {
      console.error("Preload failed for track", track.id, e);
    } finally {
      preloadingIdsRef.current.delete(String(track.id));
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

      const audioUrl = getTrackAudioUrl(nextTrack);
      if (!audioUrl) return;

      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);
      const finalRenderedBuffer = await performOfflineRender(audioBuffer, 1.0);

      if (!precalculateOnIdleRef.current) return;
      precalculatedNextBufferRef.current = { trackId: String(nextTrack.id), buffer: finalRenderedBuffer };
      console.log("[Lookahead] Finished precalculating next track:", nextTrack.title || nextTrack.fileName);
    } catch (e) {
      console.error("[Lookahead] Failed to precalculate:", e);
    } finally {
      isPrecalculatingNextRef.current = false;
    }
  };


  const preloadAdjacentTracks = async (currentId: string | number, currentQueue: Track[]) => {
    const allowedIds = new Set<string>();
    allowedIds.add(String(currentId));

    let prev1: Track | undefined;
    let next1: Track | undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const idx = currentQueue.findIndex((t: any) => String(t.id) === String(currentId));
    if (idx !== -1) {
      prev1 = currentQueue[idx - 1];
      next1 = currentQueue[idx + 1];

      // Assuming queueEndMode logic exists or defaulting to not looping if missing
      // If we don't have queueEndMode accessible here, we just ignore it for now.
      // But let's just do a simple next1/prev1 fallback if undefined and queue length > 1
      if (!prev1 && currentQueue.length > 0) prev1 = currentQueue[currentQueue.length - 1];
      if (!next1 && currentQueue.length > 0) next1 = currentQueue[0];

      if (prev1) allowedIds.add(String(prev1.id));
      if (next1) allowedIds.add(String(next1.id));
    }
    allowedIdsRef.current = allowedIds;

    // 1. Memory Cleanup: Only keep current, prev1, and next1 in RAM
    for (const [key, objectUrl] of blobCacheRef.current.entries()) {
      if (!allowedIds.has(String(key))) {
        URL.revokeObjectURL(objectUrl);
        blobCacheRef.current.delete(key);
        console.log(`[Cache Cleanup] Removed ${key} from RAM`);
      }
    }

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

    if (rafRef.current) window.clearInterval(rafRef.current);
    const updateTime = () => {
      if (document.hidden) return;
      if (audioContextRef.current) {
        const elapsed = (audioContextRef.current.currentTime - bufferStartTimeRef.current) * playbackRate;
        setCurrentTime(elapsed);
      }
    };
    rafRef.current = window.setInterval(updateTime, 25);
    setIsPlaying(true);
  };


  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  const playTrack = async (startingTrack: Track | null, currentQueue?: Track[], autoPlay = true, ..._args: any[]) => {
    initializeAudioContext();
    if (!startingTrack) return;
    if (!currentQueue) currentQueue = [startingTrack];
    setCurrentTrack(startingTrack);
    setQueue(currentQueue);

    const playSessionId = Symbol();
    decodeSessionRef.current = playSessionId;
    isDecodingRef.current = false;
    stopBufferPlayback();

    const audioUrl = getTrackAudioUrl(startingTrack);
    if (!audioUrl) {
      setIsPlaying(false);
      return;
    }

    if (precalculateOnIdle) {
      audioRef.current!.pause();
      audioRef.current!.src = "";
      setIsPlaying(true);

      (async () => {
        try {
          isDecodingRef.current = true;

          let finalRenderedBuffer = null;
          if (precalculatedNextBufferRef.current?.trackId === String(startingTrack.id)) {
            finalRenderedBuffer = precalculatedNextBufferRef.current.buffer;
          } else {
            const response = await fetch(audioUrl);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);

            const renderedBuffer = await performOfflineRender(audioBuffer, 1.0);
            finalRenderedBuffer = renderedBuffer;
          }

          // Check if session changed while decoding
          if (decodeSessionRef.current !== playSessionId || !precalculateOnIdleRef.current) return;

          audioBufferRef.current = finalRenderedBuffer;
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
            setIsPlaying(true);

            const updateTime = () => {
              if (document.hidden) return;
              if (audioContextRef.current) {
                const elapsed = (audioContextRef.current.currentTime - bufferStartTimeRef.current) * playbackRate;
                setCurrentTime(elapsed);
              }
            };
            rafRef.current = window.setInterval(updateTime, 25);
          } else {
            bufferPausedTimeRef.current = 0;
            setIsPlaying(false);
          }
        } catch (e) {
          if (decodeSessionRef.current !== playSessionId) return;
          console.error("Decode failed, falling back to stream", e);
          audioBufferRef.current = null;
          configureAudioElementSource(audioUrl);
          if (autoPlay) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            audioRef.current!.play().catch((playError: any) => console.error("Playback failed", playError));
          }
        } finally {
          if (decodeSessionRef.current === playSessionId) {
            isDecodingRef.current = false;
          }
        }
      })();
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).dummyAudio) (window as any).dummyAudio.pause();
      audioBufferRef.current = null;
      bufferPausedTimeRef.current = 0;
      configureAudioElementSource(audioUrl);
      if (autoPlay) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        audioRef.current!.play().catch((e: any) => console.error("Playback failed", e));
      } else {
        audioRef.current!.pause();
        setIsPlaying(false);
      }
    }

    // Preload adjacent tracks and extract metadata for ALL tracks
    if (startingTrack.sourceType !== 'LOCAL') {
      preloadTrack(startingTrack).then(() => {
        preloadAdjacentTracks(startingTrack.id, currentQueue!);
      });
    }
    
    
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      } catch (e) {}
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
  }, [playNext, playPrevious, seek, togglePlay]);

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
        } catch (e) {}
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, playbackRate, duration]);

  // Update Media Session Metadata and Handlers
  useEffect(() => {
    if ('mediaSession' in navigator) {
      if (currentTrack) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title || (currentTrack.fileName ? currentTrack.fileName.replace(/\.[^/.]+$/, "") : 'Unknown Title'),
          artist: currentTrack.artist || (currentTrack.fileName?.includes(' - ') ? currentTrack.fileName.split(' - ')[0] : 'Unknown Artist'),
          album: currentTrack.album || 'Unknown Album',
          artwork: currentTrack.imageUrl ? [{ src: currentTrack.imageUrl, sizes: '512x512', type: 'image/jpeg' }] : []
        });
      }

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack]);


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
    currentTime,
    duration,
    volume,
    setVolume,
    playbackRate,
    updatePlaybackRate,
    preservesPitch,
    togglePreservesPitch,
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
