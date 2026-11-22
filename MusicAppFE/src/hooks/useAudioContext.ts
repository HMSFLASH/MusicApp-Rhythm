import React, { useRef, useEffect, useCallback, useState } from 'react';
import { expandResonantEqBands, type BalancerMode, type BalancerTelemetry, type EqBand } from './audioTypes';
import {
  applyMasterLimiterState,
  applyMultibandStereoImagerSettings,
  applyWebAudioBalancerSettings,
  createMultibandStereoImagerNode,
  createWebAudioBalancerNode,
  generateImpulseResponse,
  loadMultibandStereoImagerWorklet,
  loadWebAudioBalancerWorklet,
  REVERB_WET_HIGHPASS_HZ,
  REVERB_WET_LOWPASS_HZ,
  reverbPreDelaySeconds,
  reverbWetGain,
  type SpeakerMode,
} from './audioGraph';
import { clamp, percentToPan } from './audioMath';
import { calculateAutoPostFxTrimDb, dbToGain } from './audioLoudness';
import { getAudioFxActivity } from './audioFxActivity';
import type { FxEnabledFlags } from './audioRenderSignature';
import { processGraphicEqBands } from '../utils/eqFitting';
import { getAudioConfigStorageKey } from './audioStorage';

export {
  configureMasterLimiter,
  createSoftClipCurve,
} from './audioGraph';

export type AudioContextEffectsInput = {
  eqBands: EqBand[];
  isParametricPreset: boolean;
  preampGain: number;
  bassGain: number;
  trebleGain: number;
  balancerMode: BalancerMode;
  balancerOffset: number;
  balancerTargetDb: number;
  balancerDeadzoneDb: number;
  balancerUpwardStrength: number;
  balancerDownwardStrength: number;
  balancerMaxUpwardDb: number;
  balancerMaxDownwardDb: number;
  balancerSpeed: number;
  balancerNoiseFloorDb: number;
  balancerLookaheadMs: number;
  balancerCeilingDb: number;
  balancerUseKWeight: boolean;
  panValue: number;
  stereoWidth: number;
  stereoCrossoverLow?: number;
  stereoCrossoverHigh?: number;
  stereoCrossoverMode?: 'inside' | 'outside';
  surroundWet?: number;
  surroundDelay?: number;
  speakerMode?: SpeakerMode;
  monoThreshold?: number;
  monoSideLevel?: number;
  chorusAmount?: number;
  reverbMix: number;
  reverbTime: number;
  reverbEngine?: 'procedural' | 'file';
  loudnessNormalization: boolean;
  useOversample: boolean;
  masterFftSize?: number;
  audioLatencyHint?: AudioContextLatencyCategory;
  fxEnabled: FxEnabledFlags;
  isAuthenticated?: boolean;
};

const disconnectNode = (node: AudioNode | null) => {
  try {
    node?.disconnect();
  } catch {
    // Ignore stale Web Audio connections during rapid graph rebuilds.
  }
};

export function useAudioContext(inputEffectsState: AudioContextEffectsInput) {
  const [debouncedContinuous, setDebouncedContinuous] = useState({
    preampGain: inputEffectsState.preampGain,
    bassGain: inputEffectsState.bassGain,
    trebleGain: inputEffectsState.trebleGain,
    eqBands: inputEffectsState.eqBands,
    reverbMix: inputEffectsState.reverbMix,
    reverbTime: inputEffectsState.reverbTime,
    panValue: inputEffectsState.panValue,
  });

  useEffect(() => {
    // Debounce continuous EQ/reverb/tone sliders to avoid Biquad/IR rebuild stuttering.
    // Stereo Imager and Web Audio Balancer worklet params update directly without rebuilding.
    const handler = setTimeout(() => {
      setDebouncedContinuous({
        preampGain: inputEffectsState.preampGain,
        bassGain: inputEffectsState.bassGain,
        trebleGain: inputEffectsState.trebleGain,
        eqBands: inputEffectsState.eqBands,
        reverbMix: inputEffectsState.reverbMix,
        reverbTime: inputEffectsState.reverbTime,
        panValue: inputEffectsState.panValue,
      });
    }, 700);
    return () => clearTimeout(handler);
  }, [
    inputEffectsState.preampGain,
    inputEffectsState.bassGain,
    inputEffectsState.trebleGain,
    inputEffectsState.eqBands,
    inputEffectsState.reverbMix,
    inputEffectsState.reverbTime,
    inputEffectsState.panValue,
  ]);

  const rawEqBands = debouncedContinuous.eqBands;
  const isParametricPreset = inputEffectsState.isParametricPreset;
  const preampGain = debouncedContinuous.preampGain;
  const bassGain = debouncedContinuous.bassGain;
  const trebleGain = debouncedContinuous.trebleGain;
  const panValue = debouncedContinuous.panValue;
  const reverbMix = debouncedContinuous.reverbMix;
  const reverbTime = debouncedContinuous.reverbTime;

  const {
    balancerMode,
    balancerOffset,
    balancerTargetDb,
    balancerDeadzoneDb,
    balancerUpwardStrength,
    balancerDownwardStrength,
    balancerMaxUpwardDb,
    balancerMaxDownwardDb,
    balancerSpeed,
    balancerNoiseFloorDb,
    balancerLookaheadMs,
    balancerCeilingDb,
    balancerUseKWeight,
    stereoWidth,
    stereoCrossoverLow = 150,
    stereoCrossoverHigh = 20000,
    stereoCrossoverMode = 'inside',
    surroundWet = 14,
    surroundDelay = 12,
    speakerMode = 'stereo',
    monoThreshold = 0.985,
    monoSideLevel = 100,
    chorusAmount = 0,
    reverbEngine = 'procedural',
    loudnessNormalization,
    useOversample,
    masterFftSize = 2048,
    audioLatencyHint = 'playback',
    fxEnabled,
    isAuthenticated,
  } = inputEffectsState;

  const [audioSampleRate, setAudioSampleRate] = useState(44100);

  // Audio Context and Core Nodes
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const irBufferRef = useRef<AudioBuffer | null>(null);

  const fxEnabledRef = useRef<FxEnabledFlags>(fxEnabled || {});
  useEffect(() => { fxEnabledRef.current = fxEnabled; }, [fxEnabled]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const bufferSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bufferVolumeNodeRef = useRef<GainNode | null>(null);

  const { eqBands, autoPreamp, eqResponseData } = React.useMemo(() => {
    if (!isParametricPreset) {
      const result = processGraphicEqBands(rawEqBands, audioSampleRate, true);
      return { eqBands: result.fittedBands, autoPreamp: result.autoPreamp, eqResponseData: result };
    }
    return { eqBands: rawEqBands, autoPreamp: 0, eqResponseData: null };
  }, [rawEqBands, audioSampleRate, isParametricPreset]);

  const effectivePreampGain = (fxEnabled?.preamp ? (preampGain || 0) : 0) + autoPreamp;
  const effectiveFxEnabled = React.useMemo(() => ({
    ...(fxEnabled || {}),
    preamp: Boolean(fxEnabled?.preamp) || Math.abs(autoPreamp) > 0.001,
  }), [autoPreamp, fxEnabled]);

  // FX Nodes
  const eqNodesRef = useRef<BiquadFilterNode[]>([]);
  const eqSplitterRef = useRef<ChannelSplitterNode | null>(null);
  const eqMergerRef = useRef<ChannelMergerNode | null>(null);
  const limiterNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const softClipWaveShaperRef = useRef<WaveShaperNode | null>(null);
  const panNodeRef = useRef<StereoPannerNode | null>(null);
  const trackLoudnessGainRef = useRef<GainNode | null>(null);
  const trackLoudnessGainValueRef = useRef(1);
  const headroomDropRef = useRef<GainNode | null>(null);
  const headroomRecoverRef = useRef<GainNode | null>(null);
  const preampNodeRef = useRef<GainNode | null>(null);
  const toneNodesRef = useRef<BiquadFilterNode[]>([]);

  const convolverNodeRef = useRef<ConvolverNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const reverbOutRef = useRef<GainNode | null>(null);
  const reverbPreDelayRef = useRef<DelayNode | null>(null);
  const reverbHighpassRef = useRef<BiquadFilterNode | null>(null);
  const reverbLowpassRef = useRef<BiquadFilterNode | null>(null);

  const stereoImagerNodeRef = useRef<AudioWorkletNode | null>(null);
  const balancerNodeRef = useRef<AudioWorkletNode | null>(null);
  const stereoWorkletReadyRef = useRef(false);
  const balancerWorkletReadyRef = useRef(false);
  const stereoWorkletLoadingRef = useRef<Promise<boolean> | null>(null);
  const balancerWorkletLoadingRef = useRef<Promise<boolean> | null>(null);
  const balancerTelemetryListenersRef = useRef<Set<(data: BalancerTelemetry) => void>>(new Set());

  const masterAnalyserRef = useRef<AnalyserNode | null>(null);
  const initializeAudioContextRef = useRef<(() => void) | null>(null);

  const subscribeBalancerTelemetry = useCallback((listener: (data: BalancerTelemetry) => void) => {
    balancerTelemetryListenersRef.current.add(listener);
    if (balancerNodeRef.current) {
      balancerNodeRef.current.port.postMessage({ type: 'telemetry', enabled: true });
    }
    return () => {
      balancerTelemetryListenersRef.current.delete(listener);
      if (balancerNodeRef.current && balancerTelemetryListenersRef.current.size === 0) {
        balancerNodeRef.current.port.postMessage({ type: 'telemetry', enabled: false });
      }
    };
  }, []);

  useEffect(() => () => {
    balancerTelemetryListenersRef.current.clear();
    if (balancerNodeRef.current) {
      try {
        balancerNodeRef.current.port.postMessage({ type: 'telemetry', enabled: false });
      } catch {
        // Ignore closed port during unmount.
      }
    }
  }, []);

  const ensureStereoImagerWorklet = useCallback((ctx: BaseAudioContext) => {
    if (stereoWorkletReadyRef.current || stereoWorkletLoadingRef.current) return;

    stereoWorkletLoadingRef.current = loadMultibandStereoImagerWorklet(ctx).then((ready) => {
      stereoWorkletReadyRef.current = ready;
      stereoWorkletLoadingRef.current = null;
      if (ready && sourceNodeRef.current && fxEnabledRef.current?.stereo) {
        globalThis.setTimeout(() => initializeAudioContextRef.current?.(), 0);
      }
      return ready;
    });
  }, []);

  const ensureWebAudioBalancerWorklet = useCallback((ctx: BaseAudioContext) => {
    if (balancerWorkletReadyRef.current || balancerWorkletLoadingRef.current) return;

    balancerWorkletLoadingRef.current = loadWebAudioBalancerWorklet(ctx).then((ready) => {
      balancerWorkletReadyRef.current = ready;
      balancerWorkletLoadingRef.current = null;
      if (ready && sourceNodeRef.current && fxEnabledRef.current?.comp) {
        globalThis.setTimeout(() => initializeAudioContextRef.current?.(), 0);
      }
      return ready;
    });
  }, []);

  const setTrackLoudnessGain = useCallback((gain: number) => {
    const nextGain = Number.isFinite(gain) && gain > 0 ? gain : 1;
    trackLoudnessGainValueRef.current = nextGain;

    if (!audioContextRef.current || !trackLoudnessGainRef.current) return;

    const now = audioContextRef.current.currentTime;
    trackLoudnessGainRef.current.gain.cancelScheduledValues(now);
    trackLoudnessGainRef.current.gain.setTargetAtTime(nextGain, now, 0.03);
  }, []);

  const currentGraphActivity = getAudioFxActivity({
    preampGain: effectivePreampGain,
    eqBands,
    bassGain,
    trebleGain,
    reverbMix,
    stereoWidth,
    stereoCrossoverLow,
    stereoCrossoverHigh,
    stereoCrossoverMode,
    surroundWet,
    surroundDelay,
    speakerMode,
    chorusAmount,
    panValue,
  }, effectiveFxEnabled);

  const graphStructureKey = JSON.stringify({
    loudnessNormalization: Boolean(loudnessNormalization),
    needsHeadroom: currentGraphActivity.needsHeadroom,
    preamp: currentGraphActivity.preamp,
    eq: currentGraphActivity.eq,
    eqBandCount: currentGraphActivity.eq && Array.isArray(eqBands) ? eqBands.length : 0,
    eqRouting: currentGraphActivity.eq && Array.isArray(eqBands)
      ? eqBands.map((band: { channel?: string }) => band.channel || 'L+R').join('|')
      : null,
    tone: currentGraphActivity.tone,
    comp: currentGraphActivity.comp,
    reverb: currentGraphActivity.reverb,
    stereo: currentGraphActivity.stereo,
    master: currentGraphActivity.master,
    limiter: currentGraphActivity.limiter,
  });

  useEffect(() => {
    if (!audioContextRef.current) return;

    let isCancelled = false;

    const updateConvolver = async () => {
      try {
        let newIrBuffer: AudioBuffer | null = null;

        if (reverbEngine === 'file') {
          try {
            const timeStr = clamp(reverbTime || 2, 0.1, 10).toFixed(1);
            const response = await fetch(`/reverbs/reverb_${timeStr}.opus`);
            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              newIrBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);
            }
          } catch (e) {
            console.warn('Failed to load file-based IR, falling back to procedural', e);
          }
        }

        if (!newIrBuffer) {
          newIrBuffer = generateImpulseResponse(
            audioContextRef.current!,
            clamp(reverbTime || 2, 0.1, 10),
            2
          );
        }

        if (isCancelled) return;
        irBufferRef.current = newIrBuffer;

        if (convolverNodeRef.current && reverbHighpassRef.current && reverbPreDelayRef.current && wetGainRef.current) {
          const ctx = audioContextRef.current!;
          const now = ctx.currentTime;

          const oldConvolver = convolverNodeRef.current;
          const oldWetGain = ctx.createGain();

          oldConvolver.disconnect();
          oldConvolver.connect(oldWetGain);
          oldWetGain.connect(reverbHighpassRef.current);
          oldWetGain.gain.setValueAtTime(1, now);
          oldWetGain.gain.setTargetAtTime(0, now, 0.015);

          const newConvolver = ctx.createConvolver();
          newConvolver.buffer = newIrBuffer;

          const newConvolverGain = ctx.createGain();
          newConvolverGain.gain.setValueAtTime(0, now);
          newConvolverGain.gain.setTargetAtTime(1, now, 0.015);

          reverbPreDelayRef.current.connect(newConvolver);
          newConvolver.connect(newConvolverGain);
          newConvolverGain.connect(reverbHighpassRef.current);

          convolverNodeRef.current = newConvolver;

          setTimeout(() => {
            try {
              oldConvolver.disconnect();
              oldWetGain.disconnect();
              newConvolverGain.disconnect();
              if (convolverNodeRef.current === newConvolver && reverbHighpassRef.current) {
                newConvolver.disconnect();
                newConvolver.connect(reverbHighpassRef.current);
              }
            } catch (err) {
              console.error('Failed to cleanup reverb crossfade', err);
            }
          }, 100);
        } else if (convolverNodeRef.current) {
          convolverNodeRef.current.buffer = newIrBuffer;
        }
      } catch (e) {
        console.error('Failed to generate IR', e);
      }
    };

    updateConvolver().catch(e => console.error('Failed to update IR', e));

    return () => {
      isCancelled = true;
    };
  }, [reverbTime, reverbEngine]);

  const initializeAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContextCtor = globalThis.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      try {
        audioContextRef.current = new AudioContextCtor({ latencyHint: audioLatencyHint, sampleRate: 96000 });
      } catch {
        try {
          audioContextRef.current = new AudioContextCtor({ latencyHint: audioLatencyHint });
        } catch {
          audioContextRef.current = new AudioContextCtor();
        }
      }
      try {
        if (isAuthenticated !== undefined) {
          const configStorageKey = getAudioConfigStorageKey(isAuthenticated);
          const existing = JSON.parse(localStorage.getItem(configStorageKey) || '{}');
          const ctxElem = audioContextRef.current as unknown as { setSinkId?: (s: string) => Promise<void> } | null;
          if (existing.sinkId && typeof ctxElem?.setSinkId === 'function') {
            ctxElem.setSinkId(existing.sinkId).catch((err: unknown) => console.warn('Failed to restore AudioContext sinkId', err));
          }
        }
      } catch (err) {
        console.warn('Failed to read saved audio output sinkId', err);
      }
    }
    const ctx = audioContextRef.current;
    if (audioSampleRate !== ctx.sampleRate) {
      setAudioSampleRate(ctx.sampleRate);
    }
    if (!irBufferRef.current && reverbEngine === 'procedural') {
      irBufferRef.current = generateImpulseResponse(ctx, clamp(reverbTime || 2, 0.1, 10), 2);
    }

    ensureStereoImagerWorklet(ctx);
    ensureWebAudioBalancerWorklet(ctx);

    if (audioRef.current && !sourceNodeRef.current) {
      sourceNodeRef.current = ctx.createMediaElementSource(audioRef.current);
    }

    if (!sourceNodeRef.current) return;

    stopNodes();

    function stopNodes() {
      disconnectNode(sourceNodeRef.current);
      disconnectNode(trackLoudnessGainRef.current);
      disconnectNode(headroomDropRef.current);
      disconnectNode(preampNodeRef.current);
      eqNodesRef.current.forEach(disconnectNode);
      disconnectNode(eqSplitterRef.current);
      disconnectNode(eqMergerRef.current);

      toneNodesRef.current.forEach(disconnectNode);
      disconnectNode(dryGainRef.current);
      disconnectNode(wetGainRef.current);
      disconnectNode(reverbOutRef.current);
      disconnectNode(reverbPreDelayRef.current);
      disconnectNode(reverbHighpassRef.current);
      disconnectNode(reverbLowpassRef.current);
      disconnectNode(convolverNodeRef.current);
      disconnectNode(stereoImagerNodeRef.current);
      disconnectNode(panNodeRef.current);
      disconnectNode(headroomRecoverRef.current);
      disconnectNode(balancerNodeRef.current);
      disconnectNode(limiterNodeRef.current);
      disconnectNode(softClipWaveShaperRef.current);
      disconnectNode(masterAnalyserRef.current);
    }

    let currentNode: AudioNode = sourceNodeRef.current;
    const enabled = fxEnabledRef.current || {};
    const enabledWithAutoPreamp = {
      ...enabled,
      preamp: Boolean(enabled.preamp) || Math.abs(autoPreamp) > 0.001,
    };
    const activity = getAudioFxActivity({
      preampGain: effectivePreampGain,
      eqBands,
      bassGain,
      trebleGain,
      reverbMix,
      stereoWidth,
      stereoCrossoverLow,
      stereoCrossoverHigh,
      stereoCrossoverMode,
      surroundWet,
      surroundDelay,
      speakerMode,
      chorusAmount,
      panValue,
    }, enabledWithAutoPreamp);

    const connectStage = <T extends AudioNode>(node: T) => {
      currentNode.connect(node);
      currentNode = node;
      return node;
    };

    // 0. Per-track loudness gain
    if (loudnessNormalization) {
      if (!trackLoudnessGainRef.current) trackLoudnessGainRef.current = ctx.createGain();
      trackLoudnessGainRef.current.gain.value = trackLoudnessGainValueRef.current;
      connectStage(trackLoudnessGainRef.current);
    }

    // 1. Gain Staging (-6dB) for pre-balancer FX
    if (activity.needsHeadroom) {
      if (!headroomDropRef.current) headroomDropRef.current = ctx.createGain();
      headroomDropRef.current.gain.value = 0.5;
      connectStage(headroomDropRef.current);
    }

    // 1.5 Preamp
    if (activity.preamp) {
      if (!preampNodeRef.current) preampNodeRef.current = ctx.createGain();
      const now = ctx.currentTime;
      preampNodeRef.current.gain.cancelScheduledValues(now);
      preampNodeRef.current.gain.setTargetAtTime(dbToGain(effectivePreampGain), now, 0.015);
      connectStage(preampNodeRef.current);
    }

    // 2. EQ
    if (activity.eq && eqBands && eqBands.length > 0) {
      const expandedEqBands = expandResonantEqBands(eqBands || []);
      if (eqNodesRef.current.length !== expandedEqBands.length) {
        eqNodesRef.current.forEach(node => node.disconnect());
        eqNodesRef.current = expandedEqBands.map(() => ctx.createBiquadFilter());
      }
      expandedEqBands.forEach((band: EqBand, i: number) => {
        const filter = eqNodesRef.current[i];
        filter.type = band.type || 'peaking';
        const now = ctx.currentTime;
        const freq = Number.isFinite(band.frequency) ? band.frequency : 1000;
        const qVal = Number.isFinite(band.q) ? band.q : 1;
        const gainVal = Number.isFinite(band.gain) ? band.gain : 0;
        filter.frequency.cancelScheduledValues(now);
        filter.frequency.setTargetAtTime(freq, now, 0.015);
        filter.Q.cancelScheduledValues(now);
        filter.Q.setTargetAtTime(qVal, now, 0.015);
        filter.gain.cancelScheduledValues(now);
        filter.gain.setTargetAtTime(gainVal, now, 0.015);
      });

      const hasChannelSpecificBands = expandedEqBands.some((band: { channel?: string }) =>
        band.channel === 'L' || band.channel === 'R'
      );

      if (hasChannelSpecificBands) {
        if (!eqSplitterRef.current) eqSplitterRef.current = ctx.createChannelSplitter(2);
        if (!eqMergerRef.current) eqMergerRef.current = ctx.createChannelMerger(2);

        const stereoFilters = eqNodesRef.current.filter((_, i) => (expandedEqBands[i].channel || 'L+R') === 'L+R');
        const leftFilters = eqNodesRef.current.filter((_, i) => expandedEqBands[i].channel === 'L');
        const rightFilters = eqNodesRef.current.filter((_, i) => expandedEqBands[i].channel === 'R');

        let prevEq = currentNode;
        stereoFilters.forEach(filter => {
          prevEq.connect(filter);
          prevEq = filter;
        });
        prevEq.connect(eqSplitterRef.current);

        let leftNode: AudioNode = eqSplitterRef.current;
        leftFilters.forEach((filter, index) => {
          if (index === 0) eqSplitterRef.current!.connect(filter, 0, 0);
          else leftFilters[index - 1].connect(filter);
          leftNode = filter;
        });

        let rightNode: AudioNode = eqSplitterRef.current;
        rightFilters.forEach((filter, index) => {
          if (index === 0) eqSplitterRef.current!.connect(filter, 1, 0);
          else rightFilters[index - 1].connect(filter);
          rightNode = filter;
        });

        leftNode.connect(eqMergerRef.current, 0, 0);
        rightNode.connect(eqMergerRef.current, rightNode === eqSplitterRef.current ? 1 : 0, 1);
        currentNode = eqMergerRef.current;
      } else {
        let prevEq = currentNode;
        eqNodesRef.current.forEach(filter => {
          prevEq.connect(filter);
          prevEq = filter;
        });
        currentNode = prevEq;
      }
    }

    // 3. Tone
    if (activity.tone) {
      const toneBands: EqBand[] = [];
      if (Math.abs(bassGain) > 0.001) toneBands.push({ id: 'bass', type: 'lowshelf', frequency: 150, q: 1, gain: bassGain, channel: 'L+R' });
      if (Math.abs(trebleGain) > 0.001) toneBands.push({ id: 'treble', type: 'highshelf', frequency: 4000, q: 1, gain: trebleGain, channel: 'L+R' });

      const expandedToneBands = expandResonantEqBands(toneBands);

      if (toneNodesRef.current.length !== expandedToneBands.length) {
        toneNodesRef.current.forEach(node => node.disconnect());
        toneNodesRef.current = expandedToneBands.map(() => ctx.createBiquadFilter());
      }

      let prevTone = currentNode;
      expandedToneBands.forEach((band, i) => {
        const filter = toneNodesRef.current[i];
        filter.type = band.type || 'peaking';

        const now = ctx.currentTime;
        filter.frequency.cancelScheduledValues(now);
        filter.frequency.setTargetAtTime(band.frequency, now, 0.015);
        filter.Q.cancelScheduledValues(now);
        filter.Q.setTargetAtTime(band.q || 1, now, 0.015);
        filter.gain.cancelScheduledValues(now);
        filter.gain.setTargetAtTime(band.gain, now, 0.015);

        prevTone.connect(filter);
        prevTone = filter;
      });
      currentNode = prevTone;
    }

    // 4. Reverb
    if (activity.reverb) {
      if (!convolverNodeRef.current) convolverNodeRef.current = ctx.createConvolver();
      if (!reverbPreDelayRef.current) reverbPreDelayRef.current = ctx.createDelay(1.0);
      if (!reverbHighpassRef.current) reverbHighpassRef.current = ctx.createBiquadFilter();
      if (!reverbLowpassRef.current) reverbLowpassRef.current = ctx.createBiquadFilter();
      if (!dryGainRef.current) dryGainRef.current = ctx.createGain();
      if (!wetGainRef.current) wetGainRef.current = ctx.createGain();
      if (!reverbOutRef.current) reverbOutRef.current = ctx.createGain();

      reverbPreDelayRef.current.delayTime.value = reverbPreDelaySeconds(reverbMix);

      reverbHighpassRef.current.type = 'highpass';
      reverbHighpassRef.current.frequency.value = REVERB_WET_HIGHPASS_HZ;
      reverbHighpassRef.current.Q.value = 0.7;

      reverbLowpassRef.current.type = 'lowpass';
      reverbLowpassRef.current.frequency.value = REVERB_WET_LOWPASS_HZ;
      reverbLowpassRef.current.Q.value = 0.7;

      if (!irBufferRef.current && reverbEngine === 'procedural') {
        irBufferRef.current = generateImpulseResponse(ctx, clamp(reverbTime || 2, 0.1, 10), 2);
      }

      if (irBufferRef.current && convolverNodeRef.current.buffer !== irBufferRef.current) {
        convolverNodeRef.current.buffer = irBufferRef.current;
      }

      dryGainRef.current.gain.value = 1.0;
      wetGainRef.current.gain.value = reverbWetGain(reverbMix);

      currentNode.connect(dryGainRef.current);
      currentNode.connect(reverbPreDelayRef.current);
      reverbPreDelayRef.current.connect(convolverNodeRef.current);
      convolverNodeRef.current.connect(reverbHighpassRef.current);
      reverbHighpassRef.current.connect(reverbLowpassRef.current);
      reverbLowpassRef.current.connect(wetGainRef.current);

      dryGainRef.current.connect(reverbOutRef.current);
      wetGainRef.current.connect(reverbOutRef.current);
      currentNode = reverbOutRef.current;
    }

    // 5. Multiband Stereo Imager & 3D Surround (AudioWorklet)
    if (activity.stereo && stereoWorkletReadyRef.current) {
      const stereoSettings = {
        widthPercent: stereoWidth,
        speakerMode,
        crossoverLow: stereoCrossoverLow,
        crossoverHigh: stereoCrossoverHigh,
        crossoverMode: stereoCrossoverMode,
        surroundDelayMs: surroundDelay,
        surroundWetPercent: surroundWet,
        monoThreshold,
        monoSideLevel,
        chorusAmount,
      };
      if (!stereoImagerNodeRef.current || stereoImagerNodeRef.current.context !== ctx) {
        stereoImagerNodeRef.current = createMultibandStereoImagerNode(ctx, stereoSettings);
      } else {
        applyMultibandStereoImagerSettings(stereoImagerNodeRef.current, stereoSettings);
      }
      connectStage(stereoImagerNodeRef.current);
    }

    // 6. Pan
    if (activity.master) {
      if (!panNodeRef.current) panNodeRef.current = ctx.createStereoPanner();
      panNodeRef.current.pan.value = percentToPan(panValue);
      connectStage(panNodeRef.current);
    }

    // 7. Adaptive post-FX headroom recovery
    if (activity.needsHeadroom) {
      if (!headroomRecoverRef.current) {
        headroomRecoverRef.current = ctx.createGain();
      }
      headroomRecoverRef.current.gain.value = dbToGain(calculateAutoPostFxTrimDb({
        preampGain: effectivePreampGain,
        eqBands,
        bassGain,
        trebleGain,
        reverbMix,
        stereoWidth,
        stereoCrossoverLow,
        stereoCrossoverHigh,
        stereoCrossoverMode,
      }, enabledWithAutoPreamp));
      connectStage(headroomRecoverRef.current);
    }

    // 8. Web Audio Balancer v2.1 (3-Stage Dynamics @ true dBFS)
    if (activity.comp && balancerWorkletReadyRef.current) {
      const balancerSettings = {
        enabled: Boolean(enabled.comp),
        mode: balancerMode,
        offset: balancerOffset,
        targetDb: balancerTargetDb,
        deadzoneDb: balancerDeadzoneDb,
        upwardStrength: balancerUpwardStrength,
        downwardStrength: balancerDownwardStrength,
        maxUpwardDb: balancerMaxUpwardDb,
        maxDownwardDb: balancerMaxDownwardDb,
        speed: balancerSpeed,
        noiseFloorDb: balancerNoiseFloorDb,
        lookaheadMs: balancerLookaheadMs,
        ceilingDb: balancerCeilingDb,
        useKWeight: Boolean(balancerUseKWeight),
      };
      if (!balancerNodeRef.current || balancerNodeRef.current.context !== ctx) {
        const node = createWebAudioBalancerNode(ctx, balancerSettings);
        node.port.onmessage = (event) => {
          const telemetry = event.data as BalancerTelemetry | undefined;
          if (!telemetry) return;
          balancerTelemetryListenersRef.current.forEach((listener) => listener(telemetry));
        };
        if (balancerTelemetryListenersRef.current.size > 0) {
          node.port.postMessage({ type: 'telemetry', enabled: true });
        }
        balancerNodeRef.current = node;
      } else {
        applyWebAudioBalancerSettings(balancerNodeRef.current, balancerSettings);
      }
      connectStage(balancerNodeRef.current);
    }

    // 9. Master Limiter
    if (activity.limiter) {
      if (!limiterNodeRef.current) {
        limiterNodeRef.current = ctx.createDynamicsCompressor();
      }

      const waveShaper = ctx.createWaveShaper();
      applyMasterLimiterState(
        ctx,
        limiterNodeRef.current,
        waveShaper,
        true,
        useOversample
      );
      softClipWaveShaperRef.current = waveShaper;

      currentNode.connect(softClipWaveShaperRef.current);
      softClipWaveShaperRef.current.connect(limiterNodeRef.current);
      currentNode = limiterNodeRef.current;
    } else {
      softClipWaveShaperRef.current = null;
    }

    if (!masterAnalyserRef.current) {
      masterAnalyserRef.current = ctx.createAnalyser();
      masterAnalyserRef.current.smoothingTimeConstant = 0.3;
    }
    masterAnalyserRef.current.fftSize = masterFftSize || 2048;
    masterAnalyserRef.current.minDecibels = -90;
    masterAnalyserRef.current.maxDecibels = -10;

    currentNode.connect(masterAnalyserRef.current);
    currentNode.connect(ctx.destination);

    if (audioContextRef.current && audioContextRef.current.state !== 'running' && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.resume().catch((e) => console.warn('Failed to resume AudioContext', e));
    }
  }, [
    audioLatencyHint,
    audioSampleRate,
    autoPreamp,
    balancerCeilingDb,
    balancerDeadzoneDb,
    balancerDownwardStrength,
    balancerLookaheadMs,
    balancerMaxDownwardDb,
    balancerMaxUpwardDb,
    balancerMode,
    balancerNoiseFloorDb,
    balancerOffset,
    balancerSpeed,
    balancerTargetDb,
    balancerUpwardStrength,
    balancerUseKWeight,
    bassGain,
    chorusAmount,
    effectivePreampGain,
    ensureStereoImagerWorklet,
    ensureWebAudioBalancerWorklet,
    eqBands,
    isAuthenticated,
    loudnessNormalization,
    masterFftSize,
    monoSideLevel,
    monoThreshold,
    panValue,
    reverbEngine,
    reverbMix,
    reverbTime,
    speakerMode,
    stereoCrossoverHigh,
    stereoCrossoverLow,
    stereoCrossoverMode,
    stereoWidth,
    surroundDelay,
    surroundWet,
    trebleGain,
    useOversample,
  ]);

  useEffect(() => {
    initializeAudioContextRef.current = initializeAudioContext;
  }, [initializeAudioContext]);

  useEffect(() => {
    if (!sourceNodeRef.current) return;
    initializeAudioContextRef.current?.();
  }, [graphStructureKey]);

  useEffect(() => {
    if (trackLoudnessGainRef.current) {
      trackLoudnessGainRef.current.gain.value = loudnessNormalization ? trackLoudnessGainValueRef.current : 1;
    }
  }, [loudnessNormalization]);

  useEffect(() => {
    if (!headroomRecoverRef.current) return;
    headroomRecoverRef.current.gain.value = dbToGain(calculateAutoPostFxTrimDb({
      preampGain: effectivePreampGain,
      eqBands,
      bassGain,
      trebleGain,
      reverbMix,
      stereoWidth,
      stereoCrossoverLow,
      stereoCrossoverHigh,
      stereoCrossoverMode,
    }, effectiveFxEnabled));
  }, [
    bassGain,
    effectiveFxEnabled,
    effectivePreampGain,
    eqBands,
    reverbMix,
    stereoCrossoverHigh,
    stereoCrossoverLow,
    stereoCrossoverMode,
    stereoWidth,
    trebleGain,
  ]);

  useEffect(() => {
    if (preampNodeRef.current) {
      preampNodeRef.current.gain.value = Math.abs(effectivePreampGain) > 0.001 ? dbToGain(effectivePreampGain) : 1;
    }
  }, [effectivePreampGain]);

  useEffect(() => {
    if (!fxEnabled.tone || toneNodesRef.current.length === 0) {
      toneNodesRef.current.forEach(node => {
        const now = audioContextRef.current?.currentTime || 0;
        node.gain.cancelScheduledValues(now);
        node.gain.setTargetAtTime(0, now, 0.015);
      });
      return;
    }

    const toneBands: EqBand[] = [];
    if (Math.abs(bassGain) > 0.001) toneBands.push({ id: 'bass', type: 'lowshelf', frequency: 150, q: 1, gain: bassGain, channel: 'L+R' });
    if (Math.abs(trebleGain) > 0.001) toneBands.push({ id: 'treble', type: 'highshelf', frequency: 4000, q: 1, gain: trebleGain, channel: 'L+R' });

    const expandedToneBands = expandResonantEqBands(toneBands);

    if (toneNodesRef.current.length === expandedToneBands.length) {
      expandedToneBands.forEach((band, i) => {
        const filter = toneNodesRef.current[i];
        const now = audioContextRef.current?.currentTime || 0;
        filter.gain.cancelScheduledValues(now);
        filter.gain.setTargetAtTime(band.gain, now, 0.015);
        filter.frequency.cancelScheduledValues(now);
        filter.frequency.setTargetAtTime(band.frequency, now, 0.015);
      });
    }
  }, [bassGain, trebleGain, fxEnabled.tone]);

  useEffect(() => {
    if (eqNodesRef.current && eqBands) {
      eqBands.forEach((band: EqBand, i: number) => {
        if (eqNodesRef.current[i]) {
          const freq = Number.isFinite(band.frequency) ? band.frequency : 1000;
          const qVal = Number.isFinite(band.q) ? band.q : 1;
          const gainVal = Number.isFinite(band.gain) ? (fxEnabled.eq ? band.gain : 0) : 0;
          const now = audioContextRef.current?.currentTime || 0;

          eqNodesRef.current[i].type = band.type || 'peaking';

          eqNodesRef.current[i].frequency.cancelScheduledValues(now);
          eqNodesRef.current[i].frequency.setTargetAtTime(freq, now, 0.015);

          eqNodesRef.current[i].Q.cancelScheduledValues(now);
          eqNodesRef.current[i].Q.setTargetAtTime(qVal, now, 0.015);

          eqNodesRef.current[i].gain.cancelScheduledValues(now);
          eqNodesRef.current[i].gain.setTargetAtTime(gainVal, now, 0.015);
        }
      });
    }
  }, [eqBands, fxEnabled.eq]);

  // Direct live AudioWorklet parameter updates (zero graph rebuild)
  useEffect(() => {
    if (!stereoImagerNodeRef.current) return;
    applyMultibandStereoImagerSettings(stereoImagerNodeRef.current, {
      widthPercent: stereoWidth,
      speakerMode,
      crossoverLow: stereoCrossoverLow,
      crossoverHigh: stereoCrossoverHigh,
      crossoverMode: stereoCrossoverMode,
      surroundDelayMs: surroundDelay,
      surroundWetPercent: surroundWet,
      monoThreshold,
      monoSideLevel,
      chorusAmount,
    });
  }, [
    chorusAmount,
    monoSideLevel,
    monoThreshold,
    speakerMode,
    stereoCrossoverHigh,
    stereoCrossoverLow,
    stereoCrossoverMode,
    stereoWidth,
    surroundDelay,
    surroundWet,
  ]);

  useEffect(() => {
    if (!balancerNodeRef.current) return;
    applyWebAudioBalancerSettings(balancerNodeRef.current, {
      enabled: Boolean(fxEnabled?.comp),
      mode: balancerMode,
      offset: balancerOffset,
      targetDb: balancerTargetDb,
      deadzoneDb: balancerDeadzoneDb,
      upwardStrength: balancerUpwardStrength,
      downwardStrength: balancerDownwardStrength,
      maxUpwardDb: balancerMaxUpwardDb,
      maxDownwardDb: balancerMaxDownwardDb,
      speed: balancerSpeed,
      noiseFloorDb: balancerNoiseFloorDb,
      lookaheadMs: balancerLookaheadMs,
      ceilingDb: balancerCeilingDb,
      useKWeight: Boolean(balancerUseKWeight),
    });
  }, [
    balancerCeilingDb,
    balancerDeadzoneDb,
    balancerDownwardStrength,
    balancerLookaheadMs,
    balancerMaxDownwardDb,
    balancerMaxUpwardDb,
    balancerMode,
    balancerNoiseFloorDb,
    balancerOffset,
    balancerSpeed,
    balancerTargetDb,
    balancerUpwardStrength,
    balancerUseKWeight,
    fxEnabled?.comp,
  ]);

  useEffect(() => {
    if (dryGainRef.current && wetGainRef.current && reverbPreDelayRef.current) {
      if (fxEnabled?.reverb) {
        dryGainRef.current.gain.value = 1.0;
        wetGainRef.current.gain.value = reverbWetGain(reverbMix);
        reverbPreDelayRef.current.delayTime.value = reverbPreDelaySeconds(reverbMix);
      } else {
        dryGainRef.current.gain.value = 1;
        wetGainRef.current.gain.value = 0;
      }
    }
  }, [reverbMix, fxEnabled?.reverb]);

  useEffect(() => {
    if (panNodeRef.current) {
      panNodeRef.current.pan.value = fxEnabled.master ? percentToPan(panValue) : 0;
    }
  }, [panValue, fxEnabled.master]);

  useEffect(() => {
    if (masterAnalyserRef.current) {
      try {
        masterAnalyserRef.current.fftSize = masterFftSize || 2048;
      } catch (err) {
        console.warn('Invalid master analyser FFT size', err);
      }
    }
  }, [masterFftSize]);

  const prevLimiterEnabledRef = useRef({ limiter: fxEnabled.limiter, useOversample });
  useEffect(() => {
    if (prevLimiterEnabledRef.current.limiter === fxEnabled.limiter && prevLimiterEnabledRef.current.useOversample === useOversample) return;
    prevLimiterEnabledRef.current = { limiter: fxEnabled.limiter, useOversample };

    if (sourceNodeRef.current) {
      initializeAudioContext();
      return;
    }

    if (!audioContextRef.current || !limiterNodeRef.current || !softClipWaveShaperRef.current) return;

    applyMasterLimiterState(
      audioContextRef.current,
      limiterNodeRef.current,
      softClipWaveShaperRef.current,
      Boolean(fxEnabled.limiter),
      useOversample,
      true
    );
  }, [fxEnabled.limiter, useOversample, initializeAudioContext]);

  const eqBandsLength = eqBands ? eqBands.length : 0;
  const prevEqBandsLengthRef = useRef(eqBandsLength);
  useEffect(() => {
    if (prevEqBandsLengthRef.current === eqBandsLength) return;
    prevEqBandsLengthRef.current = eqBandsLength;
    if (sourceNodeRef.current) {
      initializeAudioContext();
    }
  }, [eqBandsLength, initializeAudioContext]);

  return {
    audioRef,
    audioContextRef,
    irBufferRef,
    fxEnabledRef,
    sourceNodeRef,
    bufferSourceRef,
    bufferVolumeNodeRef,
    eqNodesRef,
    limiterNodeRef,
    softClipWaveShaperRef,
    panNodeRef,
    trackLoudnessGainRef,
    setTrackLoudnessGain,
    headroomDropRef,
    headroomRecoverRef,
    preampNodeRef,
    convolverNodeRef,
    dryGainRef,
    wetGainRef,
    reverbPreDelayRef,
    initializeAudioContext,
    eqResponseData,
    masterAnalyserRef,
    subscribeBalancerTelemetry,
  };
}
