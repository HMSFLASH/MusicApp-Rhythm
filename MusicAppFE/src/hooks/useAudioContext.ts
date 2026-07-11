import { useRef, useEffect, useCallback } from 'react';
import {
  applyCustomDynamicsCompressorSettings,
  applyMasterLimiterCompressorState,
  applyMasterLimiterState,
  createCustomDynamicsCompressorNode,
  createOversampledSoftClipperNode,
  generateImpulseResponse,
  getStereoSimilarity,
  loadCustomDynamicsCompressorWorklet,
  loadOversampledSoftClipperWorklet,
  pseudoStereoWetGain,
  REVERB_WET_HIGHPASS_HZ,
  REVERB_WET_LOWPASS_HZ,
  reverbPreDelaySeconds,
  reverbWetGain,
} from './audioGraph';
import {
  clamp,
  compressorAttackSeconds,
  msToAudioSeconds,
  percentToPan,
  percentToPseudoStereoAmount,
  percentToStereoBaseWidth,
} from './audioMath';
import {
  BASE_POST_FX_TRIM_DB,
  calculateAutoPostFxTrimDb,
  dbToGain,
} from './audioLoudness';
import { getAudioFxActivity } from './audioFxActivity';

export {
  configureLoudnessNormalization,
  configureMasterLimiter,
  createSoftClipCurve,
} from './audioGraph';

const disconnectNode = (node: AudioNode | null) => {
  try {
    node?.disconnect();
  } catch {
    // Ignore stale Web Audio connections during rapid graph rebuilds.
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useAudioContext(effectsState: any) {
  const { eqBands, preampGain, bassGain, trebleGain, compThreshold, compRatio, compKnee, compAttack, compRelease, compRmsSize, compMakeupGain, panValue, stereoWidth, reverbMix, reverbTime, useOversample, loudnessNormalization, fxEnabled, audioIsStereo = true, } = effectsState;

  // Audio Context and Core Nodes

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stereoSplitterRef = useRef<ChannelSplitterNode | null>(null);
  const stereoMergerRef = useRef<ChannelMergerNode | null>(null);
  const lToLRef = useRef<GainNode | null>(null);
  const rToLRef = useRef<GainNode | null>(null);
  const lToRRef = useRef<GainNode | null>(null);
  const rToRRef = useRef<GainNode | null>(null);
  const haasWetGainRef = useRef<GainNode | null>(null);
  const stereoOutRef = useRef<GainNode | null>(null);
  const pseudoMonoRef = useRef<GainNode | null>(null);
  const pseudoDelayRef = useRef<DelayNode | null>(null);
  const pseudoHighpassRef = useRef<BiquadFilterNode | null>(null);
  const pseudoLeftGainRef = useRef<GainNode | null>(null);
  const pseudoRightGainRef = useRef<GainNode | null>(null);
  const pseudoMergerRef = useRef<ChannelMergerNode | null>(null);
  const irBufferRef = useRef<AudioBuffer | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fxEnabledRef = useRef<any>(effectsState?.fxEnabled || {});
  useEffect(() => { fxEnabledRef.current = effectsState?.fxEnabled; }, [effectsState?.fxEnabled]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const bufferSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bufferVolumeNodeRef = useRef<GainNode | null>(null);

  // FX Nodes
  const eqNodesRef = useRef<BiquadFilterNode[]>([]);
  const limiterNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const softClipNodeRef = useRef<AudioNode | null>(null);
  const softClipWaveShaperRef = useRef<WaveShaperNode | null>(null);
  const oversampledSoftClipperReadyRef = useRef(false);
  const oversampledSoftClipperLoadingRef = useRef<Promise<boolean> | null>(null);
  const panNodeRef = useRef<StereoPannerNode | null>(null);
  const trackLoudnessGainRef = useRef<GainNode | null>(null);
  const trackLoudnessGainValueRef = useRef(1);
  const headroomDropRef = useRef<GainNode | null>(null);
  const headroomRecoverRef = useRef<GainNode | null>(null);
  const preampNodeRef = useRef<GainNode | null>(null);
  const bassNodeRef = useRef<BiquadFilterNode | null>(null);
  const trebleNodeRef = useRef<BiquadFilterNode | null>(null);
  const compressorNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const customCompressorNodeRef = useRef<AudioWorkletNode | null>(null);
  const compMakeupNodeRef = useRef<GainNode | null>(null);
  const customCompressorReadyRef = useRef(false);
  const customCompressorLoadingRef = useRef<Promise<boolean> | null>(null);
  
  const convolverNodeRef = useRef<ConvolverNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const reverbOutRef = useRef<GainNode | null>(null);
  const reverbPreDelayRef = useRef<DelayNode | null>(null);
  const reverbHighpassRef = useRef<BiquadFilterNode | null>(null);
  const reverbLowpassRef = useRef<BiquadFilterNode | null>(null);
  const stereoInputRef = useRef<GainNode | null>(null);
  const stereoAnalysisSplitterRef = useRef<ChannelSplitterNode | null>(null);
  const stereoLeftAnalyserRef = useRef<AnalyserNode | null>(null);
  const stereoRightAnalyserRef = useRef<AnalyserNode | null>(null);
  const stereoAnalysisIntervalRef = useRef<number | null>(null);
  const stereoPseudoBaseAmountRef = useRef(0);
  const initializeAudioContextRef = useRef<(() => void) | null>(null);

  const stopStereoNearMonoAnalysis = useCallback(() => {
    if (stereoAnalysisIntervalRef.current != null) {
      window.clearInterval(stereoAnalysisIntervalRef.current);
      stereoAnalysisIntervalRef.current = null;
    }

    if (stereoAnalysisSplitterRef.current) stereoAnalysisSplitterRef.current.disconnect();
    if (stereoLeftAnalyserRef.current) stereoLeftAnalyserRef.current.disconnect();
    if (stereoRightAnalyserRef.current) stereoRightAnalyserRef.current.disconnect();

    stereoAnalysisSplitterRef.current = null;
    stereoLeftAnalyserRef.current = null;
    stereoRightAnalyserRef.current = null;
  }, []);

  const ensureOversampledSoftClipperWorklet = useCallback((ctx: BaseAudioContext) => {
    if (oversampledSoftClipperReadyRef.current || oversampledSoftClipperLoadingRef.current) return;

    oversampledSoftClipperLoadingRef.current = loadOversampledSoftClipperWorklet(ctx).then((ready) => {
      oversampledSoftClipperReadyRef.current = ready;
      oversampledSoftClipperLoadingRef.current = null;

      if (ready && sourceNodeRef.current && fxEnabledRef.current?.limiter && useOversample) {
        window.setTimeout(() => initializeAudioContextRef.current?.(), 0);
      }

      return ready;
    });
  }, [useOversample]);

  const ensureCustomDynamicsCompressorWorklet = useCallback((ctx: BaseAudioContext) => {
    if (customCompressorReadyRef.current || customCompressorLoadingRef.current) return;

    customCompressorLoadingRef.current = loadCustomDynamicsCompressorWorklet(ctx).then((ready) => {
      customCompressorReadyRef.current = ready;
      customCompressorLoadingRef.current = null;

      if (ready && sourceNodeRef.current && fxEnabledRef.current?.comp && compRatio < 1) {
        window.setTimeout(() => initializeAudioContextRef.current?.(), 0);
      }

      return ready;
    });
  }, [compRatio]);

  const startStereoNearMonoAnalysis = useCallback((sourceNode: AudioNode, basePseudoAmount: number) => {
    if (!audioContextRef.current || !pseudoDelayRef.current || !haasWetGainRef.current || basePseudoAmount <= 0) return;

    stopStereoNearMonoAnalysis();

    const ctx = audioContextRef.current;
    const splitter = ctx.createChannelSplitter(2);
    const leftAnalyser = ctx.createAnalyser();
    const rightAnalyser = ctx.createAnalyser();
    leftAnalyser.fftSize = 2048;
    rightAnalyser.fftSize = 2048;

    const leftData = new Float32Array(leftAnalyser.fftSize);
    const rightData = new Float32Array(rightAnalyser.fftSize);

    sourceNode.connect(splitter);
    splitter.connect(leftAnalyser, 0);
    splitter.connect(rightAnalyser, 1);

    stereoAnalysisSplitterRef.current = splitter;
    stereoLeftAnalyserRef.current = leftAnalyser;
    stereoRightAnalyserRef.current = rightAnalyser;

    const updatePseudoStereo = () => {
      if (!audioContextRef.current || !pseudoDelayRef.current || !haasWetGainRef.current) return;
      leftAnalyser.getFloatTimeDomainData(leftData);
      rightAnalyser.getFloatTimeDomainData(rightData);

      const baseAmount = stereoPseudoBaseAmountRef.current;
      const pseudoAmount = getStereoSimilarity(leftData, rightData).nearMono ? baseAmount : 0;
      const now = audioContextRef.current.currentTime;
      pseudoDelayRef.current.delayTime.setTargetAtTime(0.006 + 0.007 * baseAmount, now, 0.05);
      haasWetGainRef.current.gain.setTargetAtTime(pseudoStereoWetGain(pseudoAmount), now, 0.05);
    };

    updatePseudoStereo();
    stereoAnalysisIntervalRef.current = window.setInterval(updatePseudoStereo, 500);
  }, [stopStereoNearMonoAnalysis]);

  const applyCompressorParams = useCallback((compressor: DynamicsCompressorNode, makeup: GainNode) => {
    if (fxEnabled.comp) {
      compressor.threshold.value = compThreshold;
      compressor.ratio.value = Math.max(1, compRatio);
      compressor.knee.value = compKnee;
      compressor.attack.value = compressorAttackSeconds(compAttack, compRmsSize);
      compressor.release.value = msToAudioSeconds(compRelease);
      makeup.gain.value = Math.pow(10, compMakeupGain / 20);
    } else {
      compressor.threshold.value = 0;
      compressor.ratio.value = 1;
      compressor.knee.value = 0;
      compressor.attack.value = 0;
      compressor.release.value = 0.25;
      makeup.gain.value = 1;
    }
  }, [compAttack, compKnee, compMakeupGain, compRatio, compRelease, compRmsSize, compThreshold, fxEnabled.comp]);

  const customCompressorSettings = useCallback(() => ({
    threshold: compThreshold,
    ratio: compRatio,
    knee: compKnee,
    attack: compressorAttackSeconds(compAttack, compRmsSize),
    release: msToAudioSeconds(compRelease),
    rmsSize: msToAudioSeconds(compRmsSize),
  }), [compAttack, compKnee, compRatio, compRelease, compRmsSize, compThreshold]);

  const setTrackLoudnessGain = useCallback((gain: number) => {
    const nextGain = Number.isFinite(gain) && gain > 0 ? gain : 1;
    trackLoudnessGainValueRef.current = nextGain;

    if (!audioContextRef.current || !trackLoudnessGainRef.current) return;

    const now = audioContextRef.current.currentTime;
    trackLoudnessGainRef.current.gain.cancelScheduledValues(now);
    trackLoudnessGainRef.current.gain.setTargetAtTime(nextGain, now, 0.03);
  }, []);

  const currentGraphActivity = getAudioFxActivity({
    preampGain,
    eqBands,
    bassGain,
    trebleGain,
    reverbMix,
    stereoWidth,
    panValue,
  }, effectsState?.fxEnabled || {});

  const graphStructureKey = JSON.stringify({
    loudnessNormalization: Boolean(loudnessNormalization),
    preamp: currentGraphActivity.preamp,
    eq: currentGraphActivity.eq,
    eqBandCount: currentGraphActivity.eq && Array.isArray(eqBands) ? eqBands.length : 0,
    tone: currentGraphActivity.tone,
    comp: currentGraphActivity.comp,
    reverb: currentGraphActivity.reverb,
    stereo: currentGraphActivity.stereo,
    audioIsStereo: currentGraphActivity.stereo ? Boolean(audioIsStereo) : null,
    master: currentGraphActivity.master,
    limiter: currentGraphActivity.limiter,
    useOversample: currentGraphActivity.limiter ? Boolean(useOversample) : null,
    compMode: currentGraphActivity.comp ? (compRatio < 1 ? 'custom' : 'native') : null,
  });

  useEffect(() => () => {
    stopStereoNearMonoAnalysis();
  }, [stopStereoNearMonoAnalysis]);

  useEffect(() => {
    if (!audioContextRef.current) return;

    try {
      const newIrBuffer = generateImpulseResponse(
        audioContextRef.current,
        clamp(reverbTime || 2, 0.1, 10),
        2
      );
      irBufferRef.current = newIrBuffer;
      
      if (convolverNodeRef.current && reverbHighpassRef.current && reverbPreDelayRef.current && wetGainRef.current) {
        const ctx = audioContextRef.current;
        const now = ctx.currentTime;
        
        // Save old nodes
        const oldConvolver = convolverNodeRef.current;
        const oldWetGain = ctx.createGain(); 
        
        // Re-route old convolver through temporary fade-out gain
        oldConvolver.disconnect();
        oldConvolver.connect(oldWetGain);
        oldWetGain.connect(reverbHighpassRef.current);
        oldWetGain.gain.setValueAtTime(1, now);
        oldWetGain.gain.setTargetAtTime(0, now, 0.015);
        
        // Setup new convolver
        const newConvolver = ctx.createConvolver();
        newConvolver.buffer = newIrBuffer;
        
        const newConvolverGain = ctx.createGain();
        newConvolverGain.gain.setValueAtTime(0, now);
        newConvolverGain.gain.setTargetAtTime(1, now, 0.015);
        
        reverbPreDelayRef.current.connect(newConvolver);
        newConvolver.connect(newConvolverGain);
        newConvolverGain.connect(reverbHighpassRef.current);
        
        // Update ref
        convolverNodeRef.current = newConvolver;
        
        // Cleanup old nodes
        setTimeout(() => {
          try {
            oldConvolver.disconnect();
            oldWetGain.disconnect();
            newConvolverGain.disconnect();
            // Connect new convolver directly to highpass once fade is done
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
  }, [reverbTime]);




  const initializeAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      try {
        audioContextRef.current = new AudioContextCtor({ latencyHint: 'playback' });
      } catch {
        audioContextRef.current = new AudioContextCtor();
      }
    }
    const ctx = audioContextRef.current;
    if (!irBufferRef.current) {
      irBufferRef.current = generateImpulseResponse(ctx, clamp(reverbTime || 2, 0.1, 10), 2);
    }

    // Only create media element source if it doesn't exist and we have an audio ref
    if (audioRef.current && !sourceNodeRef.current) {
      sourceNodeRef.current = ctx.createMediaElementSource(audioRef.current);
    }

    if (!sourceNodeRef.current) return;
    
    // Disconnect everything first to rebuild graph. Every call is wrapped
    // because browsers may throw if a node was already disconnected.
    stopStereoNearMonoAnalysis();
    disconnectNode(sourceNodeRef.current);
    disconnectNode(trackLoudnessGainRef.current);
    disconnectNode(headroomDropRef.current);
    disconnectNode(preampNodeRef.current);
    eqNodesRef.current.forEach(disconnectNode);
    disconnectNode(bassNodeRef.current);
    disconnectNode(trebleNodeRef.current);
    disconnectNode(compressorNodeRef.current);
    disconnectNode(customCompressorNodeRef.current);
    disconnectNode(compMakeupNodeRef.current);
    disconnectNode(dryGainRef.current);
    disconnectNode(wetGainRef.current);
    disconnectNode(reverbOutRef.current);
    disconnectNode(reverbPreDelayRef.current);
    disconnectNode(reverbHighpassRef.current);
    disconnectNode(reverbLowpassRef.current);
    disconnectNode(convolverNodeRef.current);
    disconnectNode(stereoInputRef.current);
    disconnectNode(stereoSplitterRef.current);
    disconnectNode(stereoMergerRef.current);
    disconnectNode(lToLRef.current);
    disconnectNode(rToLRef.current);
    disconnectNode(lToRRef.current);
    disconnectNode(rToRRef.current);
    disconnectNode(stereoOutRef.current);
    disconnectNode(pseudoMonoRef.current);
    disconnectNode(pseudoDelayRef.current);
    disconnectNode(pseudoHighpassRef.current);
    disconnectNode(pseudoLeftGainRef.current);
    disconnectNode(pseudoRightGainRef.current);
    disconnectNode(pseudoMergerRef.current);
    disconnectNode(haasWetGainRef.current);
    disconnectNode(headroomRecoverRef.current);
    disconnectNode(limiterNodeRef.current);
    disconnectNode(softClipNodeRef.current);
    if (softClipWaveShaperRef.current && softClipWaveShaperRef.current !== softClipNodeRef.current) {
      disconnectNode(softClipWaveShaperRef.current);
    }
    disconnectNode(panNodeRef.current);

    let currentNode: AudioNode = sourceNodeRef.current;
    const enabled = fxEnabledRef.current || {};
    const activity = getAudioFxActivity({
      preampGain,
      eqBands,
      bassGain,
      trebleGain,
      reverbMix,
      stereoWidth,
      panValue,
    }, enabled);

    const connectStage = <T extends AudioNode>(node: T) => {
      currentNode.connect(node);
      currentNode = node;
      return node;
    };

    // 0. Per-track loudness gain. Actual LUFS measurement is done by playback/pre-render code.
    if (loudnessNormalization) {
      if (!trackLoudnessGainRef.current) trackLoudnessGainRef.current = ctx.createGain();
      trackLoudnessGainRef.current.gain.value = trackLoudnessGainValueRef.current;
      connectStage(trackLoudnessGainRef.current);
    }

    // 1. Gain Staging (-6dB)
    if (activity.any) {
      if (!headroomDropRef.current) headroomDropRef.current = ctx.createGain();
      headroomDropRef.current.gain.value = 0.5;
      connectStage(headroomDropRef.current);
    }

    // 1.5 Preamp
    if (activity.preamp) {
      if (!preampNodeRef.current) preampNodeRef.current = ctx.createGain();
      preampNodeRef.current.gain.value = Math.pow(10, preampGain / 20);
      connectStage(preampNodeRef.current);
    }

    // 2. EQ
    if (activity.eq && eqBands && eqBands.length > 0) {
      if (eqNodesRef.current.length !== eqBands.length) {
        eqNodesRef.current = eqBands.map(() => ctx.createBiquadFilter());
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eqBands.forEach((band: any, i: number) => {
        const filter = eqNodesRef.current[i];
        filter.type = band.type || 'peaking';
        filter.frequency.value = band.frequency;
        filter.Q.value = band.q;
        filter.gain.value = band.gain;
      });

      let prevEq = currentNode;
      eqNodesRef.current.forEach(filter => {
        prevEq.connect(filter);
        prevEq = filter;
      });
      currentNode = prevEq;
    }

    // 3. Tone
    if (activity.tone) {
      if (!bassNodeRef.current) {
        bassNodeRef.current = ctx.createBiquadFilter();
        bassNodeRef.current.type = 'lowshelf';
        bassNodeRef.current.frequency.value = 150;
      }
      if (!trebleNodeRef.current) {
        trebleNodeRef.current = ctx.createBiquadFilter();
        trebleNodeRef.current.type = 'highshelf';
        trebleNodeRef.current.frequency.value = 4000;
      }
      bassNodeRef.current.gain.value = bassGain;
      trebleNodeRef.current.gain.value = trebleGain;

      currentNode.connect(bassNodeRef.current);
      bassNodeRef.current.connect(trebleNodeRef.current);
      currentNode = trebleNodeRef.current;
    }

    // 4. Compressor
    if (activity.comp) {
      if (!compMakeupNodeRef.current) compMakeupNodeRef.current = ctx.createGain();
      compMakeupNodeRef.current.gain.value = Math.pow(10, compMakeupGain / 20);

      if (compRatio < 1) {
        ensureCustomDynamicsCompressorWorklet(ctx);

        if (customCompressorReadyRef.current) {
          customCompressorNodeRef.current = createCustomDynamicsCompressorNode(ctx, customCompressorSettings());
          currentNode.connect(customCompressorNodeRef.current);
          customCompressorNodeRef.current.connect(compMakeupNodeRef.current);
        } else {
          currentNode.connect(compMakeupNodeRef.current);
        }
      } else {
        if (!compressorNodeRef.current) compressorNodeRef.current = ctx.createDynamicsCompressor();

        applyCompressorParams(compressorNodeRef.current, compMakeupNodeRef.current);
        currentNode.connect(compressorNodeRef.current);
        compressorNodeRef.current.connect(compMakeupNodeRef.current);
      }

      currentNode = compMakeupNodeRef.current;
    }

    const stereoDetectionNode = currentNode;
    
    // 5. Reverb
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

      if (irBufferRef.current && !convolverNodeRef.current.buffer) {
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

    // 5.5 Stereo Width Matrix
    if (activity.stereo) {
      if (!stereoInputRef.current) stereoInputRef.current = ctx.createGain();
      if (!stereoSplitterRef.current) stereoSplitterRef.current = ctx.createChannelSplitter(2);
      if (!stereoMergerRef.current) stereoMergerRef.current = ctx.createChannelMerger(2);

      if (!lToLRef.current) lToLRef.current = ctx.createGain();
      if (!rToLRef.current) rToLRef.current = ctx.createGain();
      if (!lToRRef.current) lToRRef.current = ctx.createGain();
      if (!rToRRef.current) rToRRef.current = ctx.createGain();
      if (!stereoOutRef.current) stereoOutRef.current = ctx.createGain();

      const width = percentToStereoBaseWidth(stereoWidth);
      const basePseudoAmount = percentToPseudoStereoAmount(stereoWidth);
      stereoPseudoBaseAmountRef.current = basePseudoAmount;
      const pseudoAmount = !audioIsStereo ? basePseudoAmount : 0;
      lToLRef.current.gain.value = (1 + width) / 2;
      rToLRef.current.gain.value = (1 - width) / 2;
      lToRRef.current.gain.value = (1 - width) / 2;
      rToRRef.current.gain.value = (1 + width) / 2;

      stereoInputRef.current.channelCount = 2;
      stereoInputRef.current.channelCountMode = 'explicit';
      stereoInputRef.current.channelInterpretation = 'speakers';
      currentNode.connect(stereoInputRef.current);
      stereoInputRef.current.connect(stereoSplitterRef.current);
      stereoSplitterRef.current.connect(lToLRef.current, 0);
      stereoSplitterRef.current.connect(lToRRef.current, 0);
      stereoSplitterRef.current.connect(rToLRef.current, 1);
      stereoSplitterRef.current.connect(rToRRef.current, 1);

      lToLRef.current.connect(stereoMergerRef.current, 0, 0);
      rToLRef.current.connect(stereoMergerRef.current, 0, 0);
      lToRRef.current.connect(stereoMergerRef.current, 0, 1);
      rToRRef.current.connect(stereoMergerRef.current, 0, 1);

      stereoMergerRef.current.connect(stereoOutRef.current);

      if (!pseudoMonoRef.current) pseudoMonoRef.current = ctx.createGain();
      if (!pseudoDelayRef.current) pseudoDelayRef.current = ctx.createDelay(0.05);
      if (!pseudoHighpassRef.current) {
        pseudoHighpassRef.current = ctx.createBiquadFilter();
        pseudoHighpassRef.current.type = 'highpass';
        pseudoHighpassRef.current.frequency.value = 180;
      }
      if (!pseudoLeftGainRef.current) pseudoLeftGainRef.current = ctx.createGain();
      if (!pseudoRightGainRef.current) pseudoRightGainRef.current = ctx.createGain();
      if (!pseudoMergerRef.current) pseudoMergerRef.current = ctx.createChannelMerger(2);
      if (!haasWetGainRef.current) haasWetGainRef.current = ctx.createGain();

      pseudoMonoRef.current.channelCount = 1;
      pseudoMonoRef.current.channelCountMode = 'explicit';
      pseudoMonoRef.current.channelInterpretation = 'speakers';
      pseudoDelayRef.current.delayTime.value = 0.006 + 0.007 * pseudoAmount;
      pseudoLeftGainRef.current.gain.value = 1;
      pseudoRightGainRef.current.gain.value = 1;
      haasWetGainRef.current.gain.value = pseudoStereoWetGain(pseudoAmount);

      currentNode.connect(pseudoMonoRef.current);
      pseudoMonoRef.current.connect(pseudoLeftGainRef.current);
      pseudoMonoRef.current.connect(pseudoDelayRef.current);
      pseudoDelayRef.current.connect(pseudoHighpassRef.current);
      pseudoHighpassRef.current.connect(pseudoRightGainRef.current);
      pseudoLeftGainRef.current.connect(pseudoMergerRef.current, 0, 0);
      pseudoRightGainRef.current.connect(pseudoMergerRef.current, 0, 1);
      pseudoMergerRef.current.connect(haasWetGainRef.current);
      haasWetGainRef.current.connect(stereoOutRef.current);

      if (audioIsStereo) {
        startStereoNearMonoAnalysis(stereoDetectionNode, basePseudoAmount);
      }

      currentNode = stereoOutRef.current;
    }


    // 6. Pan
    if (activity.master) {
      if (!panNodeRef.current) panNodeRef.current = ctx.createStereoPanner();
      panNodeRef.current.pan.value = percentToPan(panValue);
      connectStage(panNodeRef.current);
    }

    // Output
    // 7. Adaptive post-FX trim: keeps boosted EQ/reverb/preamp from leaning on the limiter.
    if (activity.any) {
      if (!headroomRecoverRef.current) {
        headroomRecoverRef.current = ctx.createGain();
      }
      headroomRecoverRef.current.gain.value = dbToGain(calculateAutoPostFxTrimDb({
        preampGain,
        eqBands,
        bassGain,
        trebleGain,
        reverbMix,
        stereoWidth,
      }, enabled) || BASE_POST_FX_TRIM_DB);
      connectStage(headroomRecoverRef.current);
    }

    if (activity.limiter) {
      if (!limiterNodeRef.current) {
        limiterNodeRef.current = ctx.createDynamicsCompressor();
      }
      if (useOversample) {
        ensureOversampledSoftClipperWorklet(ctx);
      }

      const useWorkletSoftClipper = useOversample && oversampledSoftClipperReadyRef.current;

      softClipWaveShaperRef.current = null;
      if (useWorkletSoftClipper) {
        softClipNodeRef.current = createOversampledSoftClipperNode(ctx);
        applyMasterLimiterCompressorState(
          ctx,
          limiterNodeRef.current,
          true
        );
      } else {
        const waveShaper = ctx.createWaveShaper();
        applyMasterLimiterState(
          ctx,
          limiterNodeRef.current,
          waveShaper,
          true,
          useOversample
        );
        softClipWaveShaperRef.current = waveShaper;
        softClipNodeRef.current = waveShaper;
      }

      currentNode.connect(softClipNodeRef.current);
      softClipNodeRef.current.connect(limiterNodeRef.current);
      currentNode = limiterNodeRef.current;
    } else {
      softClipWaveShaperRef.current = null;
    }
    
    currentNode.connect(ctx.destination);
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }


  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    applyCompressorParams,
    bassGain,
    compMakeupGain,
    compRatio,
    customCompressorSettings,
    eqBands,
    ensureCustomDynamicsCompressorWorklet,
    startStereoNearMonoAnalysis,
    stopStereoNearMonoAnalysis,
    fxEnabled.comp,
    fxEnabled.eq,
    fxEnabled.master,
    fxEnabled.limiter,
    fxEnabled.preamp,
    fxEnabled.reverb,
    fxEnabled.stereo,
    fxEnabled.tone,
    audioIsStereo,
    loudnessNormalization,
    panValue,
    preampGain,
    reverbMix,
    reverbTime,
    stereoWidth,
    trebleGain,
    useOversample,
  ]);
  useEffect(() => {
    initializeAudioContextRef.current = initializeAudioContext;
  }, [initializeAudioContext]);

  useEffect(() => {
    if (!sourceNodeRef.current) return;
    initializeAudioContext();
  // Rebuild only when graph shape changes. Parameter changes below update existing nodes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphStructureKey]);

  useEffect(() => {
    if (trackLoudnessGainRef.current) {
      trackLoudnessGainRef.current.gain.value = loudnessNormalization ? trackLoudnessGainValueRef.current : 1;
    }
  }, [loudnessNormalization]);

  useEffect(() => {
    if (!headroomRecoverRef.current) return;
    headroomRecoverRef.current.gain.value = dbToGain(calculateAutoPostFxTrimDb({
      preampGain,
      eqBands,
      bassGain,
      trebleGain,
      reverbMix,
      stereoWidth,
    }, fxEnabled) || BASE_POST_FX_TRIM_DB);
  }, [bassGain, eqBands, fxEnabled, preampGain, reverbMix, stereoWidth, trebleGain]);

  useEffect(() => {
    if (preampNodeRef.current) {
      preampNodeRef.current.gain.value = fxEnabled.preamp ? Math.pow(10, preampGain / 20) : 1;
    }
  }, [preampGain, fxEnabled.preamp]);

  useEffect(() => {
    if (bassNodeRef.current) bassNodeRef.current.gain.value = fxEnabled.tone ? bassGain : 0;
    if (trebleNodeRef.current) trebleNodeRef.current.gain.value = fxEnabled.tone ? trebleGain : 0;
  }, [bassGain, trebleGain, fxEnabled.tone]);

  useEffect(() => {
    if (eqNodesRef.current && eqBands) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eqBands.forEach((band: any, i: number) => {
        if (eqNodesRef.current[i]) {
          eqNodesRef.current[i].type = band.type || 'peaking';
          eqNodesRef.current[i].frequency.value = band.frequency;
          eqNodesRef.current[i].Q.value = band.q;
          eqNodesRef.current[i].gain.value = fxEnabled.eq ? band.gain : 0;
        }
      });
    }
  }, [eqBands, fxEnabled.eq]);

  useEffect(() => {
    if (compressorNodeRef.current && compMakeupNodeRef.current) {
      applyCompressorParams(compressorNodeRef.current, compMakeupNodeRef.current);
    }
    if (customCompressorNodeRef.current && compMakeupNodeRef.current) {
      applyCustomDynamicsCompressorSettings(customCompressorNodeRef.current, customCompressorSettings());
      compMakeupNodeRef.current.gain.value = fxEnabled.comp ? Math.pow(10, compMakeupGain / 20) : 1;
    }
  }, [applyCompressorParams, compMakeupGain, customCompressorSettings, fxEnabled.comp]);

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
    if (lToLRef.current && rToLRef.current && lToRRef.current && rToRRef.current) {
      const width = fxEnabled.stereo ? percentToStereoBaseWidth(stereoWidth) : 1;
      lToLRef.current.gain.value = (1 + width) / 2;
      rToLRef.current.gain.value = (1 - width) / 2;
      lToRRef.current.gain.value = (1 - width) / 2;
      rToRRef.current.gain.value = (1 + width) / 2;
    }
    if (haasWetGainRef.current && pseudoDelayRef.current) {
      const basePseudoAmount = fxEnabled.stereo ? percentToPseudoStereoAmount(stereoWidth) : 0;
      stereoPseudoBaseAmountRef.current = basePseudoAmount;
      const pseudoAmount = !audioIsStereo ? basePseudoAmount : 0;
      const targetDelay = 0.006 + 0.007 * basePseudoAmount;
      const targetGain = pseudoStereoWetGain(pseudoAmount);
      
      if (audioContextRef.current) {
        pseudoDelayRef.current.delayTime.setTargetAtTime(targetDelay, audioContextRef.current.currentTime, 0.02);
        haasWetGainRef.current.gain.setTargetAtTime(targetGain, audioContextRef.current.currentTime, 0.02);
      } else {
        pseudoDelayRef.current.delayTime.value = targetDelay;
        haasWetGainRef.current.gain.value = targetGain;
      }
    }
  }, [stereoWidth, fxEnabled.stereo, audioIsStereo]);

  useEffect(() => {
    if (panNodeRef.current) {
      panNodeRef.current.pan.value = fxEnabled.master ? percentToPan(panValue) : 0;
    }
  }, [panValue, fxEnabled.master]);

  const prevLimiterDepsRef = useRef({ limiter: fxEnabled.limiter, oversample: useOversample });
  useEffect(() => {
    const isChanged = prevLimiterDepsRef.current.limiter !== fxEnabled.limiter || 
                      prevLimiterDepsRef.current.oversample !== useOversample;
    if (!isChanged) return;
    prevLimiterDepsRef.current = { limiter: fxEnabled.limiter, oversample: useOversample };

    if (sourceNodeRef.current) {
      initializeAudioContext();
      return;
    }

    if (!audioContextRef.current || !limiterNodeRef.current) return;

    if (!softClipWaveShaperRef.current) return;

    applyMasterLimiterState(
      audioContextRef.current,
      limiterNodeRef.current,
      softClipWaveShaperRef.current,
      Boolean(fxEnabled.limiter),
      useOversample,
      true
    );
  }, [fxEnabled.limiter, initializeAudioContext, useOversample]);

  const eqBandsLength = eqBands ? eqBands.length : 0;
  const prevEqBandsLengthRef = useRef(eqBandsLength);
  useEffect(() => {
    if (prevEqBandsLengthRef.current === eqBandsLength) return;
    prevEqBandsLengthRef.current = eqBandsLength;
    if (sourceNodeRef.current) {
      initializeAudioContext();
    }
  }, [eqBandsLength, initializeAudioContext]);

  const prevAudioIsStereoRef = useRef(audioIsStereo);
  useEffect(() => {
    if (prevAudioIsStereoRef.current === audioIsStereo) return;
    prevAudioIsStereoRef.current = audioIsStereo;
    if (sourceNodeRef.current) {
      initializeAudioContext();
    }
  }, [audioIsStereo, initializeAudioContext]);

  return {
    audioRef,
    audioContextRef,
    stereoSplitterRef,
    stereoMergerRef,
    lToLRef,
    rToLRef,
    lToRRef,
    rToRRef,
    haasWetGainRef,
    irBufferRef,
    fxEnabledRef,
    sourceNodeRef,
    bufferSourceRef,
    bufferVolumeNodeRef,
    eqNodesRef,
    limiterNodeRef,
    softClipNodeRef,
    panNodeRef,
    trackLoudnessGainRef,
    setTrackLoudnessGain,
    headroomDropRef,
    headroomRecoverRef,
    preampNodeRef,
    bassNodeRef,
    trebleNodeRef,
    compressorNodeRef,
    customCompressorNodeRef,
    compMakeupNodeRef,
    convolverNodeRef,
    dryGainRef,
    wetGainRef,
    reverbPreDelayRef,
    initializeAudioContext
  };
}
