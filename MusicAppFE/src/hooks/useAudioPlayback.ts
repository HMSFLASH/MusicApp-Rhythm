import { useState, useRef, useEffect, useCallback } from 'react';
import type { Track } from './audioTypes';
import { LOCAL_STORAGE_KEY } from './audioStorage';
import { axiosClient } from '../api/axiosClient';
import { configureLoudnessNormalization, configureMasterLimiter, createSoftClipCurve } from './useAudioContext';

const BACKEND_URL = `http://${window.location.hostname}:8080`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const msToAudioSeconds = (value: number) => clamp(value / 1000, 0, 1);
const percentToPan = (value: number) => clamp(value / 100, -1, 1);
const percentToStereoWidth = (value: number) => clamp(value / 100, 0, 2);
const percentToStereoBaseWidth = (value: number) => {
  const width = percentToStereoWidth(value);
  return width <= 1 ? width : clamp(1 + (width - 1) * 0.5, 1, 1.5);
};
const percentToPseudoStereoAmount = (value: number) => clamp((value - 100) / 100, 0, 1);
const REVERB_WET_GAIN = 0.75;

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
  queueState: any,
  effectsState: any,
  contextState: any,
  metadataState: any,
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
    compMakeupGain,
    reverbMix,
    reverbTime,
    stereoWidth,
    panValue,
    loudnessNormalization,
  } = effectsState || {};
  const { audioContextRef, audioRef, bufferSourceRef, bufferVolumeNodeRef, initializeAudioContext, limiterNodeRef, softClipNodeRef } = contextState;
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
  const decodeSessionRef = useRef<symbol | null>(null);
  const playNextRef = useRef<(() => void) | null>(null);
  const playPreviousRef = useRef<(() => void) | null>(null);

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
      (audioRef as any).current._visibilityHandler = handleVisibilityChange;
      audioRef.current.addEventListener('loadedmetadata', () => setDuration(audioRef.current?.duration || 0));
      audioRef.current.addEventListener('ended', () => {
        if (playNextRef.current) playNextRef.current();
      });
      audioRef.current.addEventListener('play', () => setIsPlaying(true));
      audioRef.current.addEventListener('pause', () => setIsPlaying(false));
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
    };
  }, []);
  const preloadingIdsRef = useRef<Set<string>>(new Set());
  const allowedIdsRef = useRef<Set<string>>(new Set());
  const irBufferRef = useRef<AudioBuffer | null>(null);
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

  const connectBufferOutputChain = useCallback(() => {
    if (!audioContextRef.current || !bufferVolumeNodeRef.current) return;

    bufferVolumeNodeRef.current.disconnect();
    if (limiterNodeRef.current) limiterNodeRef.current.disconnect();
    if (softClipNodeRef.current) softClipNodeRef.current.disconnect();

    let finalNode: AudioNode = bufferVolumeNodeRef.current;
    if (fxEnabledRef.current?.limiter) {
      if (!limiterNodeRef.current) {
        limiterNodeRef.current = audioContextRef.current.createDynamicsCompressor();
      }
      configureMasterLimiter(limiterNodeRef.current);

      if (!softClipNodeRef.current) {
        softClipNodeRef.current = audioContextRef.current.createWaveShaper();
        softClipNodeRef.current.curve = createSoftClipCurve(44100);
      }
      softClipNodeRef.current.oversample = audioParamsRef.current.useOversample ? '4x' : 'none';

      finalNode.connect(limiterNodeRef.current);
      limiterNodeRef.current.connect(softClipNodeRef.current);
      finalNode = softClipNodeRef.current;
    }

    finalNode.connect(audioContextRef.current.destination);
  }, [audioContextRef, bufferVolumeNodeRef, limiterNodeRef, softClipNodeRef]);

  const updatePlaybackRate = useCallback((val: number) => setPlaybackRate(val), []);
  const togglePreservesPitch = useCallback(() => setPreservesPitch((prev: any) => !prev), []);

  useEffect(() => {
    if (precalculateOnIdle && bufferVolumeNodeRef.current) {
      connectBufferOutputChain();
    }
  }, [connectBufferOutputChain, fxEnabled.limiter, precalculateOnIdle, useOversample]);

  // Define functions in correct dependency order

  const performOfflineRender = async (audioBuffer: AudioBuffer, rate: number = 1.0) => {
console.log("[Audio] performOfflineRender called with EQ bands:", audioParamsRef.current.eqBands.length);
    if (!audioBuffer) return audioBuffer;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const offlineCtx = new OfflineAudioContext(2, length, sampleRate);

    const offlineSource = offlineCtx.createBufferSource();
    offlineSource.buffer = audioBuffer;
    offlineSource.playbackRate.value = rate;

    let currentNode: AudioNode = offlineSource;
    const enabled = fxEnabledRef.current;
    const { preampGain, eqBands, bassGain, trebleGain, compThreshold, compRatio, compKnee, compAttack, compRelease, compMakeupGain, reverbMix, stereoWidth, panValue, loudnessNormalization } = audioParamsRef.current;

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

      const stereoFilters = filters.filter((_: any, i: number) => eqBands[i].channel === 'L+R');
      const leftFilters = filters.filter((_: any, i: number) => eqBands[i].channel === 'L');
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
      comp.attack.value = msToAudioSeconds(compAttack);
      comp.release.value = msToAudioSeconds(compRelease);

      const makeup = offlineCtx.createGain();
      makeup.gain.value = Math.pow(10, compMakeupGain / 20);

      currentNode.connect(comp);
      comp.connect(makeup);
      currentNode = makeup;
    }

    // 5. Reverb
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
      // Removed from offline render to allow Volume to be applied before Limiter in real-time playback.

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

      console.log(`[preloadTrack] Fetching blob for ${track.fileName}...`);
      const streamUrl = `${BACKEND_URL}/api/music/stream/${track.id}`;
      const fetchUrl = `${streamUrl}?_t=${Date.now()}`;
      const res = await axiosClient.get(fetchUrl, { responseType: 'blob' });
      const rawBlob = res as unknown as Blob;
      console.log(`[preloadTrack] Blob downloaded for ${track.fileName}`);

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
    if (!precalculateOnIdle || isPrecalculatingNextRef.current) return;

    // Find next track
    let nextTrack = null;
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

      const audioUrl = nextTrack.localFile ? URL.createObjectURL(nextTrack.localFile) : `${BACKEND_URL}/api/music/${nextTrack.id}/stream`;
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);

      // Perform offline rendering using the exact same graph settings
      // --- OFFLINE RENDERING START ---
      const offlineCtx = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );
      const offlineSource = offlineCtx.createBufferSource();
      offlineSource.buffer = audioBuffer;
      offlineSource.playbackRate.value = playbackRate;

      let currentNode: AudioNode = offlineSource;
      const enabled = fxEnabledRef.current; // use fxEnabledRef since it's a ref to the latest state
      const { preampGain, eqBands, bassGain, trebleGain, compThreshold, compRatio, compKnee, compAttack, compRelease, compMakeupGain, reverbMix, stereoWidth, panValue, loudnessNormalization } = audioParamsRef.current;
      // Wait, fxEnabled is state, not ref. Let's use fxEnabled directly.
      // BUT playTrack might have a stale closure of fxEnabled if it's not wrapped in useCallback.
      // Since playTrack is defined inside useAudioPlayer, it uses the latest closure.

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

        const stereoFilters = filters.filter((_: any, i: number) => eqBands[i].channel === 'L+R');
        const leftFilters = filters.filter((_: any, i: number) => eqBands[i].channel === 'L');
        const rightFilters = filters.filter((_: any, i: number) => eqBands[i].channel === 'R');

        let prevNode = null;
        for (const filter of stereoFilters) {
          if (prevNode) prevNode.connect(filter);
          else currentNode.connect(filter);
          prevNode = filter;
        }
        if (prevNode) prevNode.connect(splitter);
        else currentNode.connect(splitter);

        let leftNode = splitter;
        let prevLeft = null;
        for (const filter of leftFilters) {
          if (prevLeft) prevLeft.connect(filter);
          else splitter.connect(filter, 0, 0);
          prevLeft = filter;
        }
        if (prevLeft) leftNode = prevLeft;

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
        comp.attack.value = msToAudioSeconds(compAttack);
        comp.release.value = msToAudioSeconds(compRelease);

        const makeup = offlineCtx.createGain();
        makeup.gain.value = Math.pow(10, compMakeupGain / 20);

        currentNode.connect(comp);
        comp.connect(makeup);
        currentNode = makeup;
      }

      // 5. Reverb
      let dryGain: GainNode | undefined, wetGain: GainNode | undefined;
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
      // Removed from offline render to allow Volume to be applied before Limiter in real-time playback.

      connectToNext(offlineCtx.destination);

      offlineSource.start(0);
      console.log("[Offline Render] Starting...");
      const finalRenderedBuffer = await offlineCtx.startRendering();
      console.log("[Offline Render] Completed.");
      // --- OFFLINE RENDERING END ---

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
    if (bufferSourceRef.current) {
      try { bufferSourceRef.current.onended = null; bufferSourceRef.current.stop(); } catch (e) { }
      bufferSourceRef.current.disconnect();
    }
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


  const playTrack = async (startingTrack: Track | null, currentQueue?: Track[], autoPlay = true, ..._args: any[]) => {
    initializeAudioContext();
    if (!startingTrack) return;
    if (!currentQueue) currentQueue = [startingTrack];
    setCurrentTrack(startingTrack);
    setQueue(currentQueue);

    let audioUrl = '';
    if (blobCacheRef.current.has(String(startingTrack.id))) {
      audioUrl = blobCacheRef.current.get(String(startingTrack.id))!;
    } else if (startingTrack.sourceType === 'LOCAL' && startingTrack.localFile instanceof Blob) {
      audioUrl = URL.createObjectURL(startingTrack.localFile);
      blobCacheRef.current.set(String(startingTrack.id), audioUrl);
    } else if (startingTrack.sourceType !== 'LOCAL') {
      audioUrl = `${BACKEND_URL}/api/music/stream/${startingTrack.id}?access_token=${jwtToken}`;
    } else {
      return;
    }

    preloadAdjacentTracks(startingTrack.id, currentQueue);

    if (rafRef.current) {
      window.clearInterval(rafRef.current);
      rafRef.current = null;
    }
    if (bufferSourceRef.current) {
      try { bufferSourceRef.current.onended = null; bufferSourceRef.current.stop(); } catch (e) { }
      bufferSourceRef.current.disconnect();
      bufferSourceRef.current = null;
    }

    if (precalculateOnIdle) {
      audioRef.current!.pause();
      audioRef.current!.src = "";
      setIsPlaying(true);

      const playSessionId = Symbol();
      decodeSessionRef.current = playSessionId;

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

            const renderedBuffer = await performOfflineRender(audioBuffer, playbackRate);
            finalRenderedBuffer = renderedBuffer;
          }

          // Check if session changed while decoding
          if (decodeSessionRef.current !== playSessionId) return;

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
          if (precalculateOnIdle) {
            setTimeout(() => preloadNextTrack(startingTrack, queue), 500);
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
          console.error("Decode failed, falling back to stream", e);
          audioRef.current!.src = audioUrl;
          if (autoPlay) audioRef.current!.play();
        } finally {
          isDecodingRef.current = false;
        }
      })();
    } else {
      if ((window as any).dummyAudio) (window as any).dummyAudio.pause();
      audioRef.current!.loop = false;
      if (audioUrl.startsWith('blob:')) {
        audioRef.current!.removeAttribute('crossorigin');
      } else {
        audioRef.current!.crossOrigin = "anonymous";
      }
      audioRef.current!.src = audioUrl;
      if (autoPlay) {
        audioRef.current!.play().catch((e: any) => console.error("Playback failed", e));
      } else {
        audioRef.current!.pause();
        setIsPlaying(false);
      }
    }

    // Preload adjacent tracks and extract metadata for ALL tracks
    if (startingTrack.sourceType !== 'LOCAL') {
      preloadTrack(startingTrack).then(() => {
        preloadAdjacentTracks(startingTrack.id, queue || []);
      });
    }
    
    
  };


  const playNext = useCallback(() => {
    if (!currentTrack || queue.length === 0) return;

    if (songEndMode === 'repeat_one') {
      if (precalculateOnIdle && audioBufferRef.current) {
        playCurrentBuffer(0);
      } else if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((e: any) => console.error(e));
      }
      return;
    }

    if (songEndMode === 'stop') {
      if (precalculateOnIdle) {
        if (bufferSourceRef.current) {
          try { bufferSourceRef.current.onended = null; bufferSourceRef.current.stop(); } catch (e) { }
        }
        if (rafRef.current) window.clearInterval(rafRef.current);
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

    const idx = queue.findIndex((t: any) => String(t.id) === String(currentTrack.id));
    if (idx !== -1 && idx < queue.length - 1) {
      playTrack(queue[idx + 1], queue, !isPreload);
    } else if (queueEndMode === 'repeat' && idx === queue.length - 1) {
      if (isShuffleState) {
        let newQueue = [...queue];
        for (let i = newQueue.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [newQueue[i], newQueue[j]] = [newQueue[j], newQueue[i]];
        }
        playTrack(newQueue[0], newQueue, !isPreload);
      } else {
        playTrack(queue[0], queue, !isPreload);
      }
    } else if (queueEndMode === 'next' && idx === queue.length - 1) {
      if (upcomingQueues.length > 0) {
        const nextQ = upcomingQueues[0];
        setUpcomingQueues((prev: any) => {
          const rest = prev.slice(1);
          if (cycleQueues) return [...rest, queue];
          return rest;
        });
        playTrack(nextQ[0], nextQ, !isPreload);
      } else if (cycleQueues) {
        playTrack(queue[0], queue, !isPreload);
      } else {
        setIsPlaying(false);
      }
    } else {
      setIsPlaying(false);
    }
  }, [currentTrack, queue, songEndMode, queueEndMode, isShuffleState, upcomingQueues, cycleQueues]);


  const playPrevious = useCallback(() => {
    if (!currentTrack || queue.length === 0) return;
    const idx = queue.findIndex((t: any) => t.id === currentTrack.id);
    if (idx > 0) {
      playTrack(queue[idx - 1], queue);
    }
  }, [currentTrack, queue]);


  const togglePlay = () => {
    if (!audioRef.current) return;
    initializeAudioContext();
    if (isPlaying) {
      if (precalculateOnIdle && bufferSourceRef.current) {
        try { bufferSourceRef.current.onended = null; bufferSourceRef.current.stop(); } catch (e) { }
        if (rafRef.current) window.clearInterval(rafRef.current);
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
  };

  useEffect(() => {
    playNextRef.current = playNext;
    playPreviousRef.current = playPrevious;
  }, [playNext, playPrevious]);

  useEffect(() => {
    playPreviousRef.current = playPrevious;
  }, [playPrevious]);

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
    preloadTrack
  };
}
