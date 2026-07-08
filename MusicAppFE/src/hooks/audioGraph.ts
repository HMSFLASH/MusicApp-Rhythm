import {
  percentToPseudoStereoAmount,
  percentToStereoBaseWidth,
} from './audioMath';

export const REVERB_WET_GAIN = 0.75;

export const createSoftClipCurve = (amount = 44100) => {
  const curve = new Float32Array(amount);
  const threshold = 0.92;
  const knee = 1 - threshold;

  for (let i = 0; i < amount; ++i) {
    const x = amount > 1 ? (i * 2) / (amount - 1) - 1 : 0;
    const absX = Math.abs(x);

    if (absX <= threshold) {
      curve[i] = x;
    } else {
      const sign = Math.sign(x);
      const normalized = (absX - threshold) / knee;
      const softened = threshold + knee * Math.tanh(normalized);
      curve[i] = Math.max(-1, Math.min(1, sign * softened));
    }
  }
  return curve;
};

export const createIdentityCurve = (amount = 44100) => {
  const curve = new Float32Array(amount);

  for (let i = 0; i < amount; ++i) {
    curve[i] = amount > 1 ? (i * 2) / (amount - 1) - 1 : 0;
  }

  return curve;
};

export const configureMasterLimiter = (limiter: DynamicsCompressorNode) => {
  limiter.threshold.value = -0.8;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.08;
};

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

export const applyMasterLimiterState = (
  ctx: BaseAudioContext,
  limiter: DynamicsCompressorNode,
  softClip: WaveShaperNode,
  enabled: boolean,
  useOversample: boolean,
  smooth = false
) => {
  setAudioParam(ctx, limiter.threshold, enabled ? -0.8 : 0, smooth);
  setAudioParam(ctx, limiter.knee, 0, smooth);
  setAudioParam(ctx, limiter.ratio, enabled ? 20 : 1, smooth);
  setAudioParam(ctx, limiter.attack, enabled ? 0.002 : 0, smooth);
  setAudioParam(ctx, limiter.release, enabled ? 0.08 : 0.25, smooth);
  softClip.curve = enabled ? createSoftClipCurve(44100) : createIdentityCurve(44100);
  softClip.oversample = useOversample ? '4x' : 'none';
};

export const configureLoudnessNormalization = (
  preGain: GainNode,
  compressor: DynamicsCompressorNode,
  makeup: GainNode,
  enabled: boolean
) => {
  preGain.gain.value = 1;

  if (enabled) {
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    makeup.gain.value = 1.25;
    return;
  }

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
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i += 1) {
    const factor = Math.pow(1 - i / length, decay);
    left[i] = (Math.random() * 2 - 1) * factor;
    right[i] = (Math.random() * 2 - 1) * factor;
  }

  return impulse;
};

export const connectStereoWidthMatrix = (ctx: BaseAudioContext, input: AudioNode, widthPercent: number) => {
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
