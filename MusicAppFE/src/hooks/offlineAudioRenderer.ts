import type { AudioRenderParams, FxEnabledFlags } from './audioRenderSignature';
import { generateGraphicEqImpulseResponse } from './firFilterGenerator';
import {
  clamp,
  compressorAttackSeconds,
  msToAudioSeconds,
  percentToPan,
} from './audioMath';
import {
  configureMasterLimiter,
  createCustomDynamicsCompressorNode,
  connectStereoWidthMatrix,
  createOversampledSoftClipperNode,
  createSoftClipCurve,
  generateImpulseResponse,
  isAudioBufferNearMono,
  loadCustomDynamicsCompressorWorklet,
  loadOversampledSoftClipperWorklet,
  REVERB_WET_HIGHPASS_HZ,
  REVERB_WET_LOWPASS_HZ,
  reverbPreDelaySeconds,
  reverbWetGain,
} from './audioGraph';
import { processGraphicEqBands } from '../utils/eqFitting';
import {
  calculateAutoPostFxTrimDb,
  calculateNormalizedTrackGain,
  dbToGain,
  INPUT_HEADROOM_DB,
} from './audioLoudness';
import { getAudioFxActivity, isActiveEqBand } from './audioFxActivity';
import { expandResonantEqBands } from './audioTypes';

type RenderOfflineAudioOptions = {
  audioBuffer: AudioBuffer;
  params: AudioRenderParams;
  fxEnabled: FxEnabledFlags;
  irBuffer: AudioBuffer | null;
  pitchRate?: number;
  isParametricPreset?: boolean;
};

export const renderOfflineAudio = async ({
  audioBuffer,
  params,
  fxEnabled,
  irBuffer,
  pitchRate: rawPitchRate,
  isParametricPreset: paramPresetOpt,
}: RenderOfflineAudioOptions) => {
  const pitchRate = (rawPitchRate && Number.isFinite(rawPitchRate) && rawPitchRate > 0) ? rawPitchRate : 1;
  if (!audioBuffer) return audioBuffer;
  const sampleRate = audioBuffer.sampleRate;
  const length = pitchRate !== 1
    ? Math.ceil(audioBuffer.length / pitchRate)
    : audioBuffer.length;
  const enabled = fxEnabled || {};
  const {
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
  } = params;

  let autoPreamp = 0;
  let processedEqBands = eqBands;
  const isParametricPreset = paramPresetOpt ?? eqBands.some((band: any) => (band.type && band.type !== 'peaking') || band.channel !== 'L+R');
  if (!isParametricPreset) {
    const result = processGraphicEqBands(eqBands, sampleRate, true);
    processedEqBands = result.fittedBands;
    autoPreamp = result.autoPreamp;
  }

  const totalPreampGain = (enabled.preamp ? (preampGain || 0) : 0) + autoPreamp;
  const enabledWithAutoPreamp = {
    ...enabled,
    preamp: Boolean(enabled.preamp) || Math.abs(autoPreamp) > 0.001,
  };

  const activity = getAudioFxActivity({
    preampGain: totalPreampGain,
    eqBands: processedEqBands,
    bassGain,
    trebleGain,
    reverbMix,
    stereoWidth,
    panValue,
  }, enabledWithAutoPreamp);

  if (!activity.any && !loudnessNormalization && pitchRate === 1) {
    return audioBuffer;
  }

  const postFxTrimDb = activity.any
    ? calculateAutoPostFxTrimDb({
      preampGain: totalPreampGain,
      eqBands: processedEqBands,
      bassGain,
      trebleGain,
      reverbMix,
      stereoWidth,
    }, enabledWithAutoPreamp)
    : 0;

  const offlineCtx = new OfflineAudioContext(2, length, sampleRate);
  const offlineSource = offlineCtx.createBufferSource();
  offlineSource.buffer = audioBuffer;
  offlineSource.playbackRate.value = pitchRate;

  let currentNode: AudioNode = offlineSource;

  if (!activity.any && loudnessNormalization) {
    const trackGain = offlineCtx.createGain();
    const downstreamGainDb = INPUT_HEADROOM_DB + calculateAutoPostFxTrimDb({
      preampGain: totalPreampGain,
      eqBands: processedEqBands,
      bassGain,
      trebleGain,
      reverbMix,
      stereoWidth,
    }, enabledWithAutoPreamp);
    trackGain.gain.value =
      calculateNormalizedTrackGain(audioBuffer, downstreamGainDb) *
      dbToGain(downstreamGainDb);
    offlineSource.connect(trackGain);
    trackGain.connect(offlineCtx.destination);
    offlineSource.start(0);
    return offlineCtx.startRendering();
  }

  if (loudnessNormalization) {
    const trackGain = offlineCtx.createGain();
    trackGain.gain.value = calculateNormalizedTrackGain(audioBuffer, INPUT_HEADROOM_DB + postFxTrimDb);
    currentNode.connect(trackGain);
    currentNode = trackGain;
  }

  const headroomDrop = offlineCtx.createGain();
  headroomDrop.gain.value = 0.5;
  currentNode.connect(headroomDrop);
  currentNode = headroomDrop;

  if (activity.preamp) {
    const preamp = offlineCtx.createGain();
    preamp.gain.value = dbToGain(totalPreampGain);
    currentNode.connect(preamp);
    currentNode = preamp;
  }

  if (activity.eq) {
    if (!isParametricPreset && eqBands && eqBands.length > 0) {
      const convolver = offlineCtx.createConvolver();
      convolver.normalize = false;
      const ir = generateGraphicEqImpulseResponse(eqBands, offlineCtx.sampleRate, 4096);
      const buffer = offlineCtx.createBuffer(2, ir.length, offlineCtx.sampleRate);
      buffer.copyToChannel(ir as any, 0);
      buffer.copyToChannel(ir as any, 1);
      convolver.buffer = buffer;
      
      currentNode.connect(convolver);
      currentNode = convolver;
    } else {
      const expandedEqBands = expandResonantEqBands(processedEqBands || []);
      const activeEqBands = expandedEqBands.filter(isActiveEqBand);
      if (activeEqBands.length > 0) {
        const filters = activeEqBands.map((band) => {
          const filter = offlineCtx.createBiquadFilter();
          filter.type = band.type || 'peaking';
          filter.frequency.value = Number.isFinite(band.frequency) ? band.frequency : 1000;
          filter.Q.value = Number.isFinite(band.q) ? band.q : 1;
          filter.gain.value = Number.isFinite(band.gain) ? band.gain : 0;
          return filter;
        });

        const splitter = offlineCtx.createChannelSplitter(2);
        const merger = offlineCtx.createChannelMerger(2);

        const stereoFilters = filters.filter((_, i) => activeEqBands[i].channel === 'L+R');
        const leftFilters = filters.filter((_, i) => activeEqBands[i].channel === 'L');
        const rightFilters = filters.filter((_, i) => activeEqBands[i].channel === 'R');

        let prevNode: BiquadFilterNode | null = null;
        for (const filter of stereoFilters) {
          if (prevNode) prevNode.connect(filter);
          else currentNode.connect(filter);
          prevNode = filter;
        }
        if (prevNode) prevNode.connect(splitter);
        else currentNode.connect(splitter);

        let leftNode: AudioNode = splitter;
        let prevLeft: BiquadFilterNode | null = null;
        for (const filter of leftFilters) {
          if (prevLeft) prevLeft.connect(filter);
          else leftNode.connect(filter, 0, 0);
          leftNode = filter;
          prevLeft = filter;
        }
        if (prevLeft) prevLeft.connect(merger, 0, 0);
        else splitter.connect(merger, 0, 0);

        let rightNode: AudioNode = splitter;
        let prevRight: BiquadFilterNode | null = null;
        for (const filter of rightFilters) {
          if (prevRight) prevRight.connect(filter);
          else rightNode.connect(filter, 1, 0);
          rightNode = filter;
          prevRight = filter;
        }
        if (prevRight) rightNode.connect(merger, 0, 1);
        else splitter.connect(merger, 1, 1);

        currentNode = merger;
      }
    }
  }

  if (activity.tone) {
    const toneBands = [];
    if (Math.abs(bassGain) > 0.001) toneBands.push({ id: 'bass', type: 'lowshelf', frequency: 150, q: 1, gain: bassGain } as any);
    if (Math.abs(trebleGain) > 0.001) toneBands.push({ id: 'treble', type: 'highshelf', frequency: 4000, q: 1, gain: trebleGain } as any);

    const expandedToneBands = expandResonantEqBands(toneBands);

    let prevTone = currentNode;
    expandedToneBands.forEach((band) => {
      const filter = offlineCtx.createBiquadFilter();
      filter.type = band.type || 'peaking';
      filter.frequency.value = band.frequency;
      filter.Q.value = band.q || 1;
      filter.gain.value = band.gain;

      prevTone.connect(filter);
      prevTone = filter;
    });
    currentNode = prevTone;
  }

  if (activity.comp) {
    const makeup = offlineCtx.createGain();
    makeup.gain.value = Math.pow(10, compMakeupGain / 20);

    if (compRatio < 1 && await loadCustomDynamicsCompressorWorklet(offlineCtx)) {
      const comp = createCustomDynamicsCompressorNode(offlineCtx, {
        threshold: compThreshold,
        ratio: compRatio,
        knee: compKnee,
        attack: compressorAttackSeconds(compAttack, compRmsSize),
        release: msToAudioSeconds(compRelease),
        rmsSize: msToAudioSeconds(compRmsSize),
      });

      currentNode.connect(comp);
      comp.connect(makeup);
    } else if (compRatio >= 1) {
      const comp = offlineCtx.createDynamicsCompressor();
      comp.threshold.value = compThreshold;
      comp.ratio.value = compRatio;
      comp.knee.value = compKnee;
      comp.attack.value = compressorAttackSeconds(compAttack, compRmsSize);
      comp.release.value = msToAudioSeconds(compRelease);

      currentNode.connect(comp);
      comp.connect(makeup);
    } else {
      currentNode.connect(makeup);
    }

    currentNode = makeup;
  }

  let dryGain: GainNode | null = null;
  let wetGain: GainNode | null = null;
  let isReverbParallel = false;
  if (activity.reverb) {
    const preDelay = offlineCtx.createDelay(1.0);
    preDelay.delayTime.value = reverbPreDelaySeconds(reverbMix);

    const convolver = offlineCtx.createConvolver();
    const effectiveIrBuffer = irBuffer && irBuffer.sampleRate === offlineCtx.sampleRate ? irBuffer : null;
    convolver.buffer = effectiveIrBuffer ?? generateImpulseResponse(offlineCtx, clamp(reverbTime || 2, 0.1, 10), 2);

    const highpass = offlineCtx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = REVERB_WET_HIGHPASS_HZ;
    highpass.Q.value = 0.7;

    const lowpass = offlineCtx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = REVERB_WET_LOWPASS_HZ;
    lowpass.Q.value = 0.7;

    dryGain = offlineCtx.createGain();
    dryGain.gain.value = 1.0;

    wetGain = offlineCtx.createGain();
    wetGain.gain.value = reverbWetGain(reverbMix);

    currentNode.connect(dryGain);
    currentNode.connect(preDelay);
    preDelay.connect(convolver);
    convolver.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(wetGain);

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

  if (activity.stereo) {
    const stereoInput = offlineCtx.createGain();
    connectToNext(stereoInput);
    const shouldUsePseudoStereo = isAudioBufferNearMono(audioBuffer);
    currentNode = connectStereoWidthMatrix(offlineCtx, stereoInput, stereoWidth, shouldUsePseudoStereo);
  }

  if (activity.master) {
    const panNode = offlineCtx.createStereoPanner();
    panNode.pan.value = percentToPan(panValue);
    connectToNext(panNode);
  }

  const headroomRecover = offlineCtx.createGain();
  headroomRecover.gain.value = dbToGain(postFxTrimDb);
  connectToNext(headroomRecover);

  if (activity.limiter) {
    let softClip: AudioNode;
    const canUseWorklet =
      params.useOversample &&
      await loadOversampledSoftClipperWorklet(offlineCtx);

    if (canUseWorklet) {
      softClip = createOversampledSoftClipperNode(offlineCtx);
    } else {
      const waveShaper = offlineCtx.createWaveShaper();
      waveShaper.curve = createSoftClipCurve();
      waveShaper.oversample = params.useOversample ? '4x' : 'none';
      softClip = waveShaper;
    }

    connectToNext(softClip);

    const limiter = offlineCtx.createDynamicsCompressor();
    configureMasterLimiter(limiter);
    connectToNext(limiter);
  }

  connectToNext(offlineCtx.destination);

  offlineSource.start(0);
  return offlineCtx.startRendering();
};
