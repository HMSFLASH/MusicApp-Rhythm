import { useRef, useEffect, useCallback } from 'react';
import {
  applyMasterLimiterState,
  configureLoudnessNormalization,
  generateImpulseResponse,
  REVERB_WET_GAIN,
} from './audioGraph';
import {
  clamp,
  compressorAttackSeconds,
  msToAudioSeconds,
  percentToPan,
  percentToPseudoStereoAmount,
  percentToStereoBaseWidth,
} from './audioMath';

export {
  configureLoudnessNormalization,
  configureMasterLimiter,
  createSoftClipCurve,
} from './audioGraph';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useAudioContext(effectsState: any) {
  const { eqBands, preampGain, bassGain, trebleGain, compThreshold, compRatio, compKnee, compAttack, compRelease, compRmsSize, compMakeupGain, panValue, stereoWidth, reverbMix, reverbTime, useOversample, loudnessNormalization, fxEnabled, } = effectsState;

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
  const softClipNodeRef = useRef<WaveShaperNode | null>(null);
  const panNodeRef = useRef<StereoPannerNode | null>(null);
  const headroomDropRef = useRef<GainNode | null>(null);
  const headroomRecoverRef = useRef<GainNode | null>(null);
  const preampNodeRef = useRef<GainNode | null>(null);
  const agcPreGainRef = useRef<GainNode | null>(null);
  const agcCompressorRef = useRef<DynamicsCompressorNode | null>(null);
  const agcMakeupRef = useRef<GainNode | null>(null);
  const bassNodeRef = useRef<BiquadFilterNode | null>(null);
  const trebleNodeRef = useRef<BiquadFilterNode | null>(null);
  const compressorNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const compMakeupNodeRef = useRef<GainNode | null>(null);
  
  const convolverNodeRef = useRef<ConvolverNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const reverbPreDelayRef = useRef<DelayNode | null>(null);
  const reverbHighpassRef = useRef<BiquadFilterNode | null>(null);
  const reverbLowpassRef = useRef<BiquadFilterNode | null>(null);
  const applyCompressorParams = useCallback((compressor: DynamicsCompressorNode, makeup: GainNode) => {
    if (fxEnabled.comp) {
      compressor.threshold.value = compThreshold;
      compressor.ratio.value = compRatio;
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

  const applyLoudnessParams = useCallback(() => {
    if (!agcPreGainRef.current || !agcCompressorRef.current || !agcMakeupRef.current) return;

    configureLoudnessNormalization(
      agcPreGainRef.current,
      agcCompressorRef.current,
      agcMakeupRef.current,
      loudnessNormalization
    );
  }, [loudnessNormalization]);

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
console.log("[Audio] initializeAudioContext called");
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
    
        // Disconnect everything first to rebuild graph
    if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
    if (headroomDropRef.current) headroomDropRef.current.disconnect();
    if (preampNodeRef.current) preampNodeRef.current.disconnect();
    if (eqNodesRef.current) {
      eqNodesRef.current.forEach(filter => {
        if (filter) filter.disconnect();
      });
    }
    if (bassNodeRef.current) bassNodeRef.current.disconnect();
    if (trebleNodeRef.current) trebleNodeRef.current.disconnect();
    if (compressorNodeRef.current) compressorNodeRef.current.disconnect();
    if (compMakeupNodeRef.current) compMakeupNodeRef.current.disconnect();
    if (dryGainRef.current) dryGainRef.current.disconnect();
    if (wetGainRef.current) wetGainRef.current.disconnect();
    if (reverbPreDelayRef.current) reverbPreDelayRef.current.disconnect();
    if (reverbHighpassRef.current) reverbHighpassRef.current.disconnect();
    if (reverbLowpassRef.current) reverbLowpassRef.current.disconnect();
    if (convolverNodeRef.current) convolverNodeRef.current.disconnect();
    if (stereoSplitterRef.current) stereoSplitterRef.current.disconnect();
    if (stereoMergerRef.current) stereoMergerRef.current.disconnect();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (lToLRef.current) (lToLRef.current as any).disconnect();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (rToLRef.current) (rToLRef.current as any).disconnect();
    if (lToRRef.current) lToRRef.current.disconnect();
    if (rToRRef.current) rToRRef.current.disconnect();
    if (stereoOutRef.current) stereoOutRef.current.disconnect();
    if (pseudoMonoRef.current) pseudoMonoRef.current.disconnect();
    if (pseudoDelayRef.current) pseudoDelayRef.current.disconnect();
    if (pseudoHighpassRef.current) pseudoHighpassRef.current.disconnect();
    if (pseudoLeftGainRef.current) pseudoLeftGainRef.current.disconnect();
    if (pseudoRightGainRef.current) pseudoRightGainRef.current.disconnect();
    if (pseudoMergerRef.current) pseudoMergerRef.current.disconnect();
    if (haasWetGainRef.current) haasWetGainRef.current.disconnect();
    if (headroomRecoverRef.current) headroomRecoverRef.current.disconnect();
    if (agcPreGainRef.current) agcPreGainRef.current.disconnect();
    if (agcCompressorRef.current) agcCompressorRef.current.disconnect();
    if (agcMakeupRef.current) agcMakeupRef.current.disconnect();
    if (limiterNodeRef.current) limiterNodeRef.current.disconnect();
    if (softClipNodeRef.current) softClipNodeRef.current.disconnect();
    if (panNodeRef.current) panNodeRef.current.disconnect();

    let currentNode: AudioNode = sourceNodeRef.current;
    const enabled = fxEnabledRef.current;

    // 1. Gain Staging (-6dB)
    if (!headroomDropRef.current) headroomDropRef.current = ctx.createGain();
    headroomDropRef.current.gain.value = 0.5;
    currentNode.connect(headroomDropRef.current);
    currentNode = headroomDropRef.current;

    // 1.5 Preamp
    if (!preampNodeRef.current) preampNodeRef.current = ctx.createGain();
    preampNodeRef.current.gain.value = enabled.preamp ? Math.pow(10, preampGain / 20) : 1;
    currentNode.connect(preampNodeRef.current);
    currentNode = preampNodeRef.current;

    // 2. EQ
    if (eqBands && eqBands.length > 0) {
      if (eqNodesRef.current.length !== eqBands.length) {
        eqNodesRef.current = eqBands.map(() => ctx.createBiquadFilter());
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eqBands.forEach((band: any, i: number) => {
        const filter = eqNodesRef.current[i];
        filter.type = band.type || 'peaking';
        filter.frequency.value = band.frequency;
        filter.Q.value = band.q;
        filter.gain.value = enabled.eq ? band.gain : 0;
      });

      let prevEq = currentNode;
      eqNodesRef.current.forEach(filter => {
        prevEq.connect(filter);
        prevEq = filter;
      });
      currentNode = prevEq;
    }

    // 3. Tone
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
    bassNodeRef.current.gain.value = enabled.tone ? bassGain : 0;
    trebleNodeRef.current.gain.value = enabled.tone ? trebleGain : 0;
    
    currentNode.connect(bassNodeRef.current);
    bassNodeRef.current.connect(trebleNodeRef.current);
    currentNode = trebleNodeRef.current;

    // 4. Compressor
    if (!compressorNodeRef.current) compressorNodeRef.current = ctx.createDynamicsCompressor();
    if (!compMakeupNodeRef.current) compMakeupNodeRef.current = ctx.createGain();
    
    if (enabled.comp) {
        applyCompressorParams(compressorNodeRef.current, compMakeupNodeRef.current);
    } else {
        applyCompressorParams(compressorNodeRef.current, compMakeupNodeRef.current);
    }
    currentNode.connect(compressorNodeRef.current);
    compressorNodeRef.current.connect(compMakeupNodeRef.current);
    currentNode = compMakeupNodeRef.current;

    
    // 5. Reverb
    if (!convolverNodeRef.current) convolverNodeRef.current = ctx.createConvolver();
    if (!reverbPreDelayRef.current) reverbPreDelayRef.current = ctx.createDelay(1.0);
    if (!reverbHighpassRef.current) reverbHighpassRef.current = ctx.createBiquadFilter();
    if (!reverbLowpassRef.current) reverbLowpassRef.current = ctx.createBiquadFilter();
    if (!dryGainRef.current) dryGainRef.current = ctx.createGain();
    if (!wetGainRef.current) wetGainRef.current = ctx.createGain();

    const preDelayAmount = Math.min(0.04, Math.max(0.008, 0.008 + 0.032 * (reverbMix / 100)));
    reverbPreDelayRef.current.delayTime.value = preDelayAmount;
    
    reverbHighpassRef.current.type = 'highpass';
    reverbHighpassRef.current.frequency.value = 150;
    reverbHighpassRef.current.Q.value = 0.7;
    
    reverbLowpassRef.current.type = 'lowpass';
    reverbLowpassRef.current.frequency.value = 7500;
    reverbLowpassRef.current.Q.value = 0.7;

    if (irBufferRef.current && !convolverNodeRef.current.buffer) {
      convolverNodeRef.current.buffer = irBufferRef.current;
    }

    const validReverbMix = Number(reverbMix) || 0;
    const x = enabled.reverb ? clamp(validReverbMix / 100, 0, 1) : 0;
    const wetAmount = (1 - Math.exp(-x * 3)) / (1 - Math.exp(-3));
    
    dryGainRef.current.gain.value = 1.0;
    wetGainRef.current.gain.value = wetAmount * REVERB_WET_GAIN;

    currentNode.connect(dryGainRef.current);
    currentNode.connect(reverbPreDelayRef.current);
    reverbPreDelayRef.current.connect(convolverNodeRef.current);
    convolverNodeRef.current.connect(reverbHighpassRef.current);
    reverbHighpassRef.current.connect(reverbLowpassRef.current);
    reverbLowpassRef.current.connect(wetGainRef.current);

    const reverbOut = ctx.createGain();
    dryGainRef.current.connect(reverbOut);
    wetGainRef.current.connect(reverbOut);
    currentNode = reverbOut;

    // 5.5 Stereo Width Matrix
    if (!stereoSplitterRef.current) stereoSplitterRef.current = ctx.createChannelSplitter(2);
    if (!stereoMergerRef.current) stereoMergerRef.current = ctx.createChannelMerger(2);
    
    if (!lToLRef.current) lToLRef.current = ctx.createGain();
    if (!rToLRef.current) rToLRef.current = ctx.createGain();
    if (!lToRRef.current) lToRRef.current = ctx.createGain();
    if (!rToRRef.current) rToRRef.current = ctx.createGain();
    if (!stereoOutRef.current) stereoOutRef.current = ctx.createGain();

    const width = enabled.stereo ? percentToStereoBaseWidth(stereoWidth) : 1;
    const pseudoAmount = enabled.stereo ? percentToPseudoStereoAmount(stereoWidth) : 0;
    lToLRef.current.gain.value = (1 + width) / 2;
    rToLRef.current.gain.value = (1 - width) / 2;
    lToRRef.current.gain.value = (1 - width) / 2;
    rToRRef.current.gain.value = (1 + width) / 2;

    const stereoInput = ctx.createGain();
    stereoInput.channelCount = 2;
    stereoInput.channelCountMode = 'explicit';
    stereoInput.channelInterpretation = 'speakers';
    currentNode.connect(stereoInput);
    stereoInput.connect(stereoSplitterRef.current);
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
    haasWetGainRef.current.gain.value = pseudoAmount > 0 ? 0.07 + 0.07 * pseudoAmount : 0;

    currentNode.connect(pseudoMonoRef.current);
    pseudoMonoRef.current.connect(pseudoLeftGainRef.current);
    pseudoMonoRef.current.connect(pseudoDelayRef.current);
    pseudoDelayRef.current.connect(pseudoHighpassRef.current);
    pseudoHighpassRef.current.connect(pseudoRightGainRef.current);
    pseudoLeftGainRef.current.connect(pseudoMergerRef.current, 0, 0);
    pseudoRightGainRef.current.connect(pseudoMergerRef.current, 0, 1);
    pseudoMergerRef.current.connect(haasWetGainRef.current);
    haasWetGainRef.current.connect(stereoOutRef.current);

    currentNode = stereoOutRef.current;


    // 6. Pan
    if (!panNodeRef.current) panNodeRef.current = ctx.createStereoPanner();
    panNodeRef.current.pan.value = enabled.master ? percentToPan(panValue) : 0;
    currentNode.connect(panNodeRef.current);
    currentNode = panNodeRef.current;

    // 6.5 Loudness Normalization (AGC at the end)
    if (!agcPreGainRef.current) agcPreGainRef.current = ctx.createGain();
    if (!agcCompressorRef.current) agcCompressorRef.current = ctx.createDynamicsCompressor();
    if (!agcMakeupRef.current) agcMakeupRef.current = ctx.createGain();
    applyLoudnessParams();

    currentNode.connect(agcPreGainRef.current);
    agcPreGainRef.current.connect(agcCompressorRef.current);
    agcCompressorRef.current.connect(agcMakeupRef.current);
    currentNode = agcMakeupRef.current;

    // Output
    // 7. Headroom Recover
    if (!headroomRecoverRef.current) {
        headroomRecoverRef.current = ctx.createGain();
        headroomRecoverRef.current.gain.value = 1.414;
    }
    currentNode.connect(headroomRecoverRef.current);
    currentNode = headroomRecoverRef.current;

    if (!limiterNodeRef.current) {
      limiterNodeRef.current = ctx.createDynamicsCompressor();
    }
    if (!softClipNodeRef.current) {
      softClipNodeRef.current = ctx.createWaveShaper();
    }
    applyMasterLimiterState(
      ctx,
      limiterNodeRef.current,
      softClipNodeRef.current,
      Boolean(enabled.limiter),
      useOversample
    );

    currentNode.connect(limiterNodeRef.current);
    limiterNodeRef.current.connect(softClipNodeRef.current);
    currentNode = softClipNodeRef.current;
    
    currentNode.connect(ctx.destination);
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }


  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    applyCompressorParams,
    applyLoudnessParams,
    bassGain,
    compMakeupGain,
    eqBands,
    fxEnabled.master,
    fxEnabled.reverb,
    fxEnabled.stereo,
    panValue,
    preampGain,
    reverbMix,
    reverbTime,
    stereoWidth,
    trebleGain,
    useOversample,
  ]);

  useEffect(() => {
    console.log("[Audio] Preamp useEffect triggered: ", preampGain);
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
  }, [applyCompressorParams]);

  useEffect(() => {
    if (dryGainRef.current && wetGainRef.current && reverbPreDelayRef.current) {
      if (fxEnabled?.reverb) {
        const validReverbMix = Number(reverbMix) || 0;
        const x = clamp(validReverbMix / 100, 0, 1);
        const wetAmount = (1 - Math.exp(-x * 3)) / (1 - Math.exp(-3));
        dryGainRef.current.gain.value = 1.0;
        wetGainRef.current.gain.value = wetAmount * REVERB_WET_GAIN;
        reverbPreDelayRef.current.delayTime.value = 0.008 + 0.032 * x;
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
      const pseudoAmount = fxEnabled.stereo ? percentToPseudoStereoAmount(stereoWidth) : 0;
      const targetDelay = 0.006 + 0.007 * pseudoAmount;
      const targetGain = pseudoAmount > 0 ? 0.07 + 0.07 * pseudoAmount : 0;
      
      if (audioContextRef.current) {
        pseudoDelayRef.current.delayTime.setTargetAtTime(targetDelay, audioContextRef.current.currentTime, 0.02);
        haasWetGainRef.current.gain.setTargetAtTime(targetGain, audioContextRef.current.currentTime, 0.02);
      } else {
        pseudoDelayRef.current.delayTime.value = targetDelay;
        haasWetGainRef.current.gain.value = targetGain;
      }
    }
  }, [stereoWidth, fxEnabled.stereo]);

  useEffect(() => {
    if (panNodeRef.current) {
      panNodeRef.current.pan.value = fxEnabled.master ? percentToPan(panValue) : 0;
    }
  }, [panValue, fxEnabled.master]);

  useEffect(() => {
    if (!audioContextRef.current || !limiterNodeRef.current || !softClipNodeRef.current) return;

    applyMasterLimiterState(
      audioContextRef.current,
      limiterNodeRef.current,
      softClipNodeRef.current,
      Boolean(fxEnabled.limiter),
      useOversample,
      true
    );
  }, [fxEnabled.limiter, useOversample]);

  useEffect(() => {
    applyLoudnessParams();
  }, [applyLoudnessParams]);

  const eqBandsLength = eqBands ? eqBands.length : 0;

  useEffect(() => {
    if (sourceNodeRef.current) {
      initializeAudioContext();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eqBandsLength]);

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
    headroomDropRef,
    headroomRecoverRef,
    preampNodeRef,
    agcPreGainRef,
    agcCompressorRef,
    agcMakeupRef,
    bassNodeRef,
    trebleNodeRef,
    compressorNodeRef,
    compMakeupNodeRef,
    convolverNodeRef,
    dryGainRef,
    wetGainRef,
    reverbPreDelayRef,
    initializeAudioContext
  };
}
