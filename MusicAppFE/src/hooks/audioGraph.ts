import {
  clamp,
  percentToPseudoStereoAmount,
  percentToStereoBaseWidth,
} from './audioMath';
import { TRUE_PEAK_CEILING_DB } from './audioLoudness';

export const REVERB_WET_GAIN = 0.35;
export const REVERB_PRE_DELAY_MIN_SECONDS = 0.008;
export const REVERB_PRE_DELAY_RANGE_SECONDS = 0.032;
export const REVERB_WET_HIGHPASS_HZ = 150;
export const REVERB_WET_LOWPASS_HZ = 7500;
export const HAAS_WET_GAIN_MAX = 0.14;
export const NEAR_MONO_CORRELATION_THRESHOLD = 0.985;
export const NEAR_MONO_SIDE_RATIO_THRESHOLD = 0.12;
export const OVERSAMPLED_SOFT_CLIPPER_WORKLET_URL = '/audio/oversampled-soft-clipper-worklet.js';
export const CUSTOM_DYNAMICS_COMPRESSOR_WORKLET_URL = '/audio/custom-dynamics-compressor-worklet.js';
export const SOFT_CLIP_CURVE_POINTS = 65536;
export const SOFT_CLIP_THRESHOLD = 0.86;
export const SOFT_CLIP_SHAPE = 1.2;
export const SOFT_CLIP_CEILING = 0.985;

const loadedSoftClipperWorkletContexts = new WeakSet<BaseAudioContext>();
const loadedDynamicsCompressorWorkletContexts = new WeakSet<BaseAudioContext>();

export const normalizedReverbMix = (reverbMix: number) => clamp((Number(reverbMix) || 0) / 100, 0, 1);

export const reverbPreDelaySeconds = (reverbMix: number) =>
  REVERB_PRE_DELAY_MIN_SECONDS + REVERB_PRE_DELAY_RANGE_SECONDS * normalizedReverbMix(reverbMix);

export const reverbWetGain = (reverbMix: number) => {
  const x = normalizedReverbMix(reverbMix);
  const wetAmount = (1 - Math.exp(-x * 3)) / (1 - Math.exp(-3));
  return wetAmount * REVERB_WET_GAIN;
};

export const pseudoStereoWetGain = (pseudoAmount: number) =>
  HAAS_WET_GAIN_MAX * clamp(pseudoAmount, 0, 1);

export const getStereoSimilarity = (
  left: ArrayLike<number>,
  right: ArrayLike<number>,
  stride = 1
) => {
  const length = Math.min(left.length, right.length);
  let sumLeft = 0;
  let sumRight = 0;
  let sumCross = 0;
  let sumMid = 0;
  let sumSide = 0;

  for (let i = 0; i < length; i += stride) {
    const l = left[i] || 0;
    const r = right[i] || 0;
    sumLeft += l * l;
    sumRight += r * r;
    sumCross += l * r;

    const mid = l + r;
    const side = l - r;
    sumMid += mid * mid;
    sumSide += side * side;
  }

  const energy = sumLeft + sumRight;
  if (energy < 1e-8) {
    return { correlation: 0, sideRatio: 1, nearMono: false };
  }

  const correlation = sumCross / Math.sqrt(Math.max(sumLeft * sumRight, 1e-12));
  const sideRatio = Math.sqrt(sumSide / Math.max(sumMid, 1e-12));

  return {
    correlation,
    sideRatio,
    nearMono:
      correlation >= NEAR_MONO_CORRELATION_THRESHOLD &&
      sideRatio <= NEAR_MONO_SIDE_RATIO_THRESHOLD,
  };
};

export const isAudioBufferNearMono = (audioBuffer: AudioBuffer) => {
  if (audioBuffer.numberOfChannels < 2) return true;

  const left = audioBuffer.getChannelData(0);
  const right = audioBuffer.getChannelData(1);
  const maxSamplesToScan = Math.max(1, Math.floor(audioBuffer.sampleRate * 30));
  const stride = Math.max(1, Math.ceil(audioBuffer.length / maxSamplesToScan));

  return getStereoSimilarity(left, right, stride).nearMono;
};

export const softClipSample = (sample: number) => {
  const absX = Math.abs(sample);
  if (absX <= SOFT_CLIP_THRESHOLD) return sample;

  const sign = sample < 0 ? -1 : 1;
  const knee = 1 - SOFT_CLIP_THRESHOLD;
  const normalized = (absX - SOFT_CLIP_THRESHOLD) / knee;
  const softened =
    SOFT_CLIP_THRESHOLD +
    knee * (Math.atan(normalized * SOFT_CLIP_SHAPE) / SOFT_CLIP_SHAPE);

  return sign * Math.min(SOFT_CLIP_CEILING, softened);
};

export const createSoftClipCurve = (amount = SOFT_CLIP_CURVE_POINTS) => {
  const curve = new Float32Array(amount);

  for (let i = 0; i < amount; ++i) {
    const x = amount > 1 ? (i * 2) / (amount - 1) - 1 : 0;
    curve[i] = softClipSample(x);
  }
  return curve;
};

export const createIdentityCurve = (amount = SOFT_CLIP_CURVE_POINTS) => {
  const curve = new Float32Array(amount);

  for (let i = 0; i < amount; ++i) {
    curve[i] = amount > 1 ? (i * 2) / (amount - 1) - 1 : 0;
  }

  return curve;
};

export const configureMasterLimiter = (limiter: DynamicsCompressorNode) => {
  limiter.threshold.value = TRUE_PEAK_CEILING_DB;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.1;
};

export const loadOversampledSoftClipperWorklet = async (ctx: BaseAudioContext) => {
  if (!('audioWorklet' in ctx) || !ctx.audioWorklet) return false;
  if (loadedSoftClipperWorkletContexts.has(ctx)) return true;

  try {
    await ctx.audioWorklet.addModule(OVERSAMPLED_SOFT_CLIPPER_WORKLET_URL);
    loadedSoftClipperWorkletContexts.add(ctx);
    return true;
  } catch (error) {
    console.warn('[Audio] Falling back to WaveShaper soft clipper.', error);
    return false;
  }
};

export const createOversampledSoftClipperNode = (ctx: BaseAudioContext) =>
  new AudioWorkletNode(ctx, 'oversampled-soft-clipper', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    channelCount: 2,
    channelCountMode: 'max',
    channelInterpretation: 'speakers',
  });

export type CustomDynamicsCompressorSettings = {
  threshold: number;
  ratio: number;
  knee: number;
  attack: number;
  release: number;
  rmsSize: number;
};

export const loadCustomDynamicsCompressorWorklet = async (ctx: BaseAudioContext) => {
  if (!('audioWorklet' in ctx) || !ctx.audioWorklet) return false;
  if (loadedDynamicsCompressorWorkletContexts.has(ctx)) return true;

  try {
    await ctx.audioWorklet.addModule(CUSTOM_DYNAMICS_COMPRESSOR_WORKLET_URL);
    loadedDynamicsCompressorWorkletContexts.add(ctx);
    return true;
  } catch (error) {
    console.warn('[Audio] Custom dynamics compressor unavailable.', error);
    return false;
  }
};

export const applyCustomDynamicsCompressorSettings = (
  node: AudioWorkletNode,
  settings: CustomDynamicsCompressorSettings
) => {
  node.parameters.get('threshold')!.value = settings.threshold;
  node.parameters.get('ratio')!.value = settings.ratio;
  node.parameters.get('knee')!.value = settings.knee;
  node.parameters.get('attack')!.value = settings.attack;
  node.parameters.get('release')!.value = settings.release;
  node.parameters.get('rmsSize')!.value = settings.rmsSize;
};

export const createCustomDynamicsCompressorNode = (
  ctx: BaseAudioContext,
  settings: CustomDynamicsCompressorSettings
) => new AudioWorkletNode(ctx, 'custom-dynamics-compressor', {
  numberOfInputs: 1,
  numberOfOutputs: 1,
  outputChannelCount: [2],
  channelCount: 2,
  channelCountMode: 'max',
  channelInterpretation: 'speakers',
  parameterData: settings,
});

const MASTER_LIMITER_RAMP_SECONDS = 0.08;

const setAudioParam = (
  ctx: BaseAudioContext,
  param: AudioParam,
  value: number,
  smooth: boolean
) => {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);

  if (smooth) {
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + MASTER_LIMITER_RAMP_SECONDS);
    return;
  }

  param.value = value;
};

export const applyMasterLimiterCompressorState = (
  ctx: BaseAudioContext,
  limiter: DynamicsCompressorNode,
  enabled: boolean,
  smooth = false
) => {
  setAudioParam(ctx, limiter.threshold, enabled ? TRUE_PEAK_CEILING_DB : 0, smooth);
  setAudioParam(ctx, limiter.knee, 0, smooth);
  setAudioParam(ctx, limiter.ratio, enabled ? 20 : 1, smooth);
  setAudioParam(ctx, limiter.attack, enabled ? 0.001 : 0, smooth);
  setAudioParam(ctx, limiter.release, enabled ? 0.1 : 0.25, smooth);
};

export const applyMasterLimiterState = (
  ctx: BaseAudioContext,
  limiter: DynamicsCompressorNode,
  softClip: WaveShaperNode,
  enabled: boolean,
  useOversample: boolean,
  smooth = false
) => {
  applyMasterLimiterCompressorState(ctx, limiter, enabled, smooth);
  softClip.curve = enabled ? createSoftClipCurve() : createIdentityCurve();
  softClip.oversample = useOversample ? '4x' : 'none';
};

export const configureLoudnessNormalization = (
  preGain: GainNode,
  compressor: DynamicsCompressorNode,
  makeup: GainNode,
  enabled: boolean
) => {
  preGain.gain.value = 1;
  void enabled;

  compressor.threshold.value = 0;
  compressor.knee.value = 0;
  compressor.ratio.value = 1;
  compressor.attack.value = 0;
  compressor.release.value = 0.25;
  makeup.gain.value = 1;
};

export const generateImpulseResponse = (ctx: BaseAudioContext, duration: number, decay: number) => {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * duration));
  const impulse = ctx.createBuffer(2, length, sampleRate);

  const earlyReflections = [
    { time: 0.007, gain: 0.35 },
    { time: 0.013, gain: -0.28 },
    { time: 0.021, gain: 0.22 },
    { time: 0.034, gain: -0.18 },
    { time: 0.055, gain: 0.12 },
  ];

  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    let last = 0;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const progress = i / length;

      // T60 exponential decay
      const envelope = Math.exp((-6.9078 * t) / duration);

      // High frequency damping: cutoff smoothly decreases from 12kHz to 4kHz
      const cutoff = 12000 - progress * 8000;
      const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);

      const noise = Math.random() * 2 - 1;
      last = last + alpha * (noise - last);

      // Apply T60 envelope and base decay modifier
      data[i] = last * envelope * decay;
    }

    // Add early reflections
    for (const reflection of earlyReflections) {
      const index = Math.floor(reflection.time * sampleRate);
      if (index < length) {
        data[index] += reflection.gain;
      }
    }
  }

  return impulse;
};

export const connectStereoWidthMatrix = (
  ctx: BaseAudioContext,
  input: AudioNode,
  widthPercent: number,
  usePseudoStereo = true
) => {
  const width = percentToStereoBaseWidth(widthPercent);
  const pseudoAmount = usePseudoStereo ? percentToPseudoStereoAmount(widthPercent) : 0;
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
    pseudoDelay.delayTime.value = 0.006 + 0.007 * pseudoAmount;
    pseudoHighpass.type = 'highpass';
    pseudoHighpass.frequency.value = 180;
    pseudoWet.gain.value = pseudoStereoWetGain(pseudoAmount);

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

export const createSilentWavUrl = () => {
  const sampleRate = 8000;
  const durationSeconds = 1;
  const bytesPerSample = 2;
  const channelCount = 1;
  const sampleCount = sampleRate * durationSeconds;
  const dataSize = sampleCount * channelCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * bytesPerSample, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);

  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
};
