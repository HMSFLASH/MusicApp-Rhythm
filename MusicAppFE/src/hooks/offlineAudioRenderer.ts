import type { EqBand } from './audioTypes';
import type { AudioRenderParams, FxEnabledFlags } from './audioRenderSignature';
import {
  clamp,
  compressorAttackSeconds,
  isNeutralDbGain,
  isNeutralPercentValue,
  msToAudioSeconds,
  percentToPan,
} from './audioMath';
import {
  configureLoudnessNormalization,
  configureMasterLimiter,
  connectStereoWidthMatrix,
  createSoftClipCurve,
  generateImpulseResponse,
  isAudioBufferNearMono,
  REVERB_WET_HIGHPASS_HZ,
  REVERB_WET_LOWPASS_HZ,
  reverbPreDelaySeconds,
  reverbWetGain,
} from './audioGraph';

const GAIN_BASED_EQ_TYPES = new Set<BiquadFilterType>(['peaking', 'lowshelf', 'highshelf']);

const isActiveEqBand = (band: EqBand) => {
  const type = (band.type || 'peaking') as BiquadFilterType;
  return !GAIN_BASED_EQ_TYPES.has(type) || !isNeutralDbGain(band.gain);
};

type RenderOfflineAudioOptions = {
  audioBuffer: AudioBuffer;
  params: AudioRenderParams;
  fxEnabled: FxEnabledFlags;
  irBuffer: AudioBuffer | null;
};

export const renderOfflineAudio = async ({
  audioBuffer,
  params,
  fxEnabled,
  irBuffer,
}: RenderOfflineAudioOptions) => {
  if (!audioBuffer) return audioBuffer;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const shouldUsePseudoStereo = isAudioBufferNearMono(audioBuffer);
  const offlineCtx = new OfflineAudioContext(2, length, sampleRate);

  const offlineSource = offlineCtx.createBufferSource();
  offlineSource.buffer = audioBuffer;
  offlineSource.playbackRate.value = 1.0;

  let currentNode: AudioNode = offlineSource;
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

  const headroomDrop = offlineCtx.createGain();
  headroomDrop.gain.value = 0.5;
  currentNode.connect(headroomDrop);
  currentNode = headroomDrop;

  if (enabled.preamp && !isNeutralDbGain(preampGain)) {
    const preamp = offlineCtx.createGain();
    preamp.gain.value = Math.pow(10, preampGain / 20);
    currentNode.connect(preamp);
    currentNode = preamp;
  }

  const activeEqBands = enabled.eq && eqBands ? eqBands.filter(isActiveEqBand) : [];
  if (activeEqBands.length > 0) {
    const filters = activeEqBands.map((band) => {
      const filter = offlineCtx.createBiquadFilter();
      filter.type = band.type || 'peaking';
      filter.frequency.value = band.frequency;
      filter.Q.value = band.q;
      filter.gain.value = band.gain;
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
      else splitter.connect(filter, 0, 0);
      prevLeft = filter;
    }
    if (prevLeft) leftNode = prevLeft;

    let rightNode: AudioNode = splitter;
    let prevRight: BiquadFilterNode | null = null;
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

  if (enabled.tone && (!isNeutralDbGain(bassGain) || !isNeutralDbGain(trebleGain))) {
    if (!isNeutralDbGain(bassGain)) {
      const bass = offlineCtx.createBiquadFilter();
      bass.type = 'lowshelf';
      bass.frequency.value = 150;
      bass.gain.value = bassGain;

      currentNode.connect(bass);
      currentNode = bass;
    }

    if (!isNeutralDbGain(trebleGain)) {
      const treble = offlineCtx.createBiquadFilter();
      treble.type = 'highshelf';
      treble.frequency.value = 4000;
      treble.gain.value = trebleGain;

      currentNode.connect(treble);
      currentNode = treble;
    }
  }

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

  let dryGain: GainNode | null = null;
  let wetGain: GainNode | null = null;
  let isReverbParallel = false;
  if (enabled.reverb && !isNeutralPercentValue(reverbMix, 0)) {
    const preDelay = offlineCtx.createDelay(1.0);
    preDelay.delayTime.value = reverbPreDelaySeconds(reverbMix);

    const convolver = offlineCtx.createConvolver();
    convolver.buffer = irBuffer ?? generateImpulseResponse(offlineCtx, clamp(reverbTime || 2, 0.1, 10), 2);

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

  if (enabled.stereo && !isNeutralPercentValue(stereoWidth, 100)) {
    const stereoInput = offlineCtx.createGain();
    connectToNext(stereoInput);
    currentNode = connectStereoWidthMatrix(offlineCtx, stereoInput, stereoWidth, shouldUsePseudoStereo);
  }

  if (enabled.master && !isNeutralPercentValue(panValue, 0)) {
    const panNode = offlineCtx.createStereoPanner();
    panNode.pan.value = percentToPan(panValue);
    connectToNext(panNode);
  }

  if (loudnessNormalization) {
    const agcPreGain = offlineCtx.createGain();
    const agcComp = offlineCtx.createDynamicsCompressor();
    const agcMakeup = offlineCtx.createGain();
    configureLoudnessNormalization(agcPreGain, agcComp, agcMakeup, true);
    connectToNext(agcPreGain);
    agcPreGain.connect(agcComp);
    agcComp.connect(agcMakeup);
    currentNode = agcMakeup;
  }

  const headroomRecover = offlineCtx.createGain();
  headroomRecover.gain.value = 1.414;
  connectToNext(headroomRecover);

  if (enabled.limiter) {
    const limiter = offlineCtx.createDynamicsCompressor();
    configureMasterLimiter(limiter);
    connectToNext(limiter);

    const softClip = offlineCtx.createWaveShaper();
    softClip.curve = createSoftClipCurve(44100);
    softClip.oversample = params.useOversample ? '4x' : 'none';
    connectToNext(softClip);
  }

  connectToNext(offlineCtx.destination);

  offlineSource.start(0);
  return offlineCtx.startRendering();
};
