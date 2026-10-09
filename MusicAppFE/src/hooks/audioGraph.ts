import {
  clamp,
  percentToPseudoStereoAmount,
  percentToStereoBaseWidth,
} from './audioMath';
import { TRUE_PEAK_CEILING_DB } from './audioLoudness';
import { SPATIAL_ER_CONFIGS_3D, getKemarHrirPair } from '../utils/kemarHrirData';

export const REVERB_WET_GAIN = 0.70;
export const REVERB_PRE_DELAY_MIN_SECONDS = 0.008;
export const REVERB_PRE_DELAY_RANGE_SECONDS = 0.032;
export const REVERB_WET_HIGHPASS_HZ = 150;
export const REVERB_WET_LOWPASS_HZ = 7500;
export const HAAS_WET_GAIN_MAX = 0.14;
export const NEAR_MONO_CORRELATION_THRESHOLD = 0.985;
export const NEAR_MONO_SIDE_RATIO_THRESHOLD = 0.12;

export const CUSTOM_DYNAMICS_COMPRESSOR_WORKLET_URL = '/audio/custom-dynamics-compressor-worklet.js';
export const SOFT_CLIP_CURVE_POINTS = 65536;
export const SOFT_CLIP_THRESHOLD = 0.86;
export const SOFT_CLIP_SHAPE = 1.2;
export const SOFT_CLIP_CEILING = 0.985;


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

let cachedSoftClipCurve: Float32Array | null = null;
let cachedIdentityCurve: Float32Array | null = null;

export const createSoftClipCurve = (amount = SOFT_CLIP_CURVE_POINTS) => {
  if (amount === SOFT_CLIP_CURVE_POINTS && cachedSoftClipCurve) return cachedSoftClipCurve;
  const curve = new Float32Array(amount);

  for (let i = 0; i < amount; ++i) {
    const x = amount > 1 ? (i * 2) / (amount - 1) - 1 : 0;
    curve[i] = softClipSample(x);
  }
  if (amount === SOFT_CLIP_CURVE_POINTS) cachedSoftClipCurve = curve;
  return curve;
};

export const createIdentityCurve = (amount = SOFT_CLIP_CURVE_POINTS) => {
  if (amount === SOFT_CLIP_CURVE_POINTS && cachedIdentityCurve) return cachedIdentityCurve;
  const curve = new Float32Array(amount);

  for (let i = 0; i < amount; ++i) {
    curve[i] = amount > 1 ? (i * 2) / (amount - 1) - 1 : 0;
  }

  if (amount === SOFT_CLIP_CURVE_POINTS) cachedIdentityCurve = curve;
  return curve;
};

export const configureMasterLimiter = (limiter: DynamicsCompressorNode) => {
  limiter.threshold.value = TRUE_PEAK_CEILING_DB;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.1;
};



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
  const params = node.parameters as unknown as Map<string, AudioParam>;
  const setParam = (name: keyof CustomDynamicsCompressorSettings, defaultVal: number) => {
    const param = params.get(name);
    if (param) {
      const val = settings[name];
      param.value = Number.isFinite(val) ? val : defaultVal;
    }
  };

  setParam('threshold', -18);
  setParam('ratio', 3);
  setParam('knee', 12);
  setParam('attack', 0.005);
  setParam('release', 0.18);
  setParam('rmsSize', 0.005);
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
  const safeVal = Number.isFinite(value) ? value : 0;
  param.cancelScheduledValues(now);

  if (smooth) {
    const currentVal = Number.isFinite(param.value) ? param.value : 0;
    param.setValueAtTime(currentVal, now);
    param.linearRampToValueAtTime(safeVal, now + MASTER_LIMITER_RAMP_SECONDS);
    return;
  }

  param.value = safeVal;
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
  useOversample: boolean = false,
  smooth = false
) => {
  applyMasterLimiterCompressorState(ctx, limiter, enabled, smooth);
  softClip.curve = (enabled ? createSoftClipCurve() : createIdentityCurve()) as Float32Array<ArrayBuffer>;
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

// Seeded pseudo-random generator (Mulberry32) for deterministic, artifact-free impulse response generation
const createSeededPrng = (seed: number) => {
  let s = Math.floor(seed) >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Gaussian distribution noise generator (Box-Muller transform)
const gaussianNoise = (prng: () => number) => {
  let u = 0;
  let v = 0;
  while (u === 0) u = prng();
  while (v === 0) v = prng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
};

// Convolve an acoustic ray pulse (~0.2ms) with measured KEMAR Dummy-Head HRIR
const convolvePulseWithHrir = (
  pulse: Float32Array,
  hrir: Float32Array,
  gain: number
): Float32Array => {
  const outLen = pulse.length + hrir.length - 1;
  const out = new Float32Array(outLen);
  for (let i = 0; i < pulse.length; i++) {
    const p = pulse[i];
    for (let j = 0; j < hrir.length; j++) {
      out[i + j] += p * hrir[j];
    }
  }
  if (gain !== 1) {
    for (let i = 0; i < outLen; i++) {
      out[i] *= gain;
    }
  }
  return out;
};

// 2nd-order Butterworth filter helper for offline array processing
const applyBiquadFilterToArray = (
  input: Float32Array,
  fs: number,
  freq: number,
  type: 'lowpass' | 'highpass',
  q = 0.7071
) => {
  const output = new Float32Array(input.length);
  const safeFreq = clamp(freq, 20, fs * 0.49);
  const w0 = (2 * Math.PI * safeFreq) / fs;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);
  const alpha = sinW0 / (2 * q);

  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  if (type === 'lowpass') {
    b0 = (1 - cosW0) / 2;
    b1 = 1 - cosW0;
    b2 = (1 - cosW0) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosW0;
    a2 = 1 - alpha;
  } else {
    b0 = (1 + cosW0) / 2;
    b1 = -(1 + cosW0);
    b2 = (1 + cosW0) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosW0;
    a2 = 1 - alpha;
  }

  const invA0 = 1 / a0;
  const nb0 = b0 * invA0;
  const nb1 = b1 * invA0;
  const nb2 = b2 * invA0;
  const na1 = a1 * invA0;
  const na2 = a2 * invA0;

  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x0 = input[i];
    const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    output[i] = y0;
  }
  return output;
};

// 10-Direction 3D Spatial Early Reflections using real measured KEMAR HRTF (MIT Media Lab)
const generateSpatialEarlyReflectionsHrtf = (
  totalSamples: number,
  fs: number,
  seedVal: number
) => {
  const prng = createSeededPrng(seedVal);
  const erLeft = new Float32Array(totalSamples);
  const erRight = new Float32Array(totalSamples);

  // Tia phản xạ âm thanh bề mặt (~0.2ms)
  const pulseLen = Math.max(1, Math.floor(fs * 0.0002));
  const pulse = new Float32Array(pulseLen);
  for (let i = 0; i < pulseLen; i++) {
    pulse[i] = 1.0 - i / pulseLen;
  }

  for (let dirIdx = 0; dirIdx < SPATIAL_ER_CONFIGS_3D.length; dirIdx++) {
    const cfg = SPATIAL_ER_CONFIGS_3D[dirIdx];
    // Micro-jitter tự nhiên (±1.0ms, ±0.7dB) chống hiện tượng dội âm nhân tạo (comb filter)
    const msJitter = cfg.ms + (prng() * 2.0 - 1.0);
    const dbJitter = cfg.db + (prng() * 1.4 - 0.7);
    const gain = Math.pow(10, dbJitter / 20.0);

    // Trích xuất cặp HRIR KEMAR thực tế từ góc 3D (resample tự động nếu fs != 48kHz)
    const { hrirL, hrirR } = getKemarHrirPair(dirIdx, fs);

    // Tích chập tia âm thanh với HRIR thực nghiệm của từng tai
    const spatialL = convolvePulseWithHrir(pulse, hrirL, gain);
    const spatialR = convolvePulseWithHrir(pulse, hrirR, gain);

    const startIdx = Math.floor(fs * (msJitter / 1000.0));
    if (startIdx < totalSamples) {
      const copyLenL = Math.min(spatialL.length, totalSamples - startIdx);
      for (let i = 0; i < copyLenL; i++) {
        erLeft[startIdx + i] += spatialL[i];
      }

      const copyLenR = Math.min(spatialR.length, totalSamples - startIdx);
      for (let i = 0; i < copyLenR; i++) {
        erRight[startIdx + i] += spatialR[i];
      }
    }
  }

  // Bộ lọc hấp thụ không khí & tán xạ bề mặt (8000Hz 2nd-order lowpass)
  return {
    erLeft: applyBiquadFilterToArray(erLeft, fs, 8000, 'lowpass'),
    erRight: applyBiquadFilterToArray(erRight, fs, 8000, 'lowpass'),
  };
};

const generateDiffuseTailStream = (
  duration: number,
  fs: number,
  seedVal: number
) => {
  const prng = createSeededPrng(seedVal);
  const totalSamples = Math.max(1, Math.floor(fs * duration));
  const rawNoise = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    rawNoise[i] = gaussianNoise(prng);
  }

  const alpha500 = 1 - Math.exp((-2 * Math.PI * 500) / fs);
  const alpha3000 = 1 - Math.exp((-2 * Math.PI * 3000) / fs);

  const decayConstant = 6.907755; // ln(1000) for -60dB (T60)
  const decayRateLow = decayConstant / (duration * 1.0 * fs);
  const decayRateMid = decayConstant / (duration * 0.85 * fs);
  const decayRateHigh = decayConstant / (duration * 0.50 * fs);

  const predelayStart = Math.floor(fs * 0.020);
  const predelayEnd = Math.floor(fs * 0.035);
  const fadeLen = Math.max(1, predelayEnd - predelayStart);

  let envLow = 1.0;
  let envMid = 1.0;
  let envHigh = 1.0;
  const multLow = Math.exp(-decayRateLow);
  const multMid = Math.exp(-decayRateMid);
  const multHigh = Math.exp(-decayRateHigh);

  let lp500 = 0;
  let lp3000 = 0;
  const tail = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const x = rawNoise[i];
    lp500 += alpha500 * (x - lp500);
    const hp500 = x - lp500;
    lp3000 += alpha3000 * (hp500 - lp3000);
    const hp3000 = hp500 - lp3000;

    let sample = (lp500 * envLow) + (lp3000 * envMid) + (hp3000 * envHigh);

    if (i < predelayStart) {
      sample = 0;
    } else if (i < predelayEnd) {
      sample *= (i - predelayStart) / fadeLen;
    }

    tail[i] = sample;

    envLow *= multLow;
    envMid *= multMid;
    envHigh *= multHigh;
  }

  return tail;
};

export const generateImpulseResponse = (ctx: BaseAudioContext, duration: number, decay: number) => {
  const fs = ctx.sampleRate;
  const safeDuration = clamp(duration, 0.1, 10);
  const totalSamples = Math.max(1, Math.floor(fs * safeDuration));
  const impulse = ctx.createBuffer(2, totalSamples, fs);

  const seedBase = Math.floor(safeDuration * 1000);

  // 1. Phản xạ sớm 10 hướng không gian đo đạc thực tế KEMAR HRTF 3D (MIT Media Lab)
  const { erLeft, erRight } = generateSpatialEarlyReflectionsHrtf(totalSamples, fs, seedBase);

  // 2. Đuôi vang khuếch tán đa hướng 360 độ (3 luồng độc lập)
  const tailShared = generateDiffuseTailStream(safeDuration, fs, seedBase + 10);
  const tailLIndep = generateDiffuseTailStream(safeDuration, fs, seedBase + 20);
  const tailRIndep = generateDiffuseTailStream(safeDuration, fs, seedBase + 30);

  // Mix đuôi vang: 35% Shared (giữ tâm vững chắc) + 65% Decorrelated (mở rộng 360 độ)
  const irLeftRaw = new Float32Array(totalSamples);
  const irRightRaw = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const tailL = 0.35 * tailShared[i] + 0.65 * tailLIndep[i];
    const tailR = 0.35 * tailShared[i] + 0.65 * tailRIndep[i];
    irLeftRaw[i] = tailL + erLeft[i];
    irRightRaw[i] = tailR + erRight[i];
  }

  // 3. Highpass 250Hz Butterworth để loại bỏ tiếng đục / rumble ở dải trầm
  const irLeftCut = applyBiquadFilterToArray(irLeftRaw, fs, 250, 'highpass');
  const irRightCut = applyBiquadFilterToArray(irRightRaw, fs, 250, 'highpass');

  // 4. L2-norm Energy Normalization toàn phần cho Wet của từng kênh
  let sumSqL = 0;
  let sumSqR = 0;
  for (let i = 0; i < totalSamples; i++) {
    sumSqL += irLeftCut[i] * irLeftCut[i];
    sumSqR += irRightCut[i] * irRightCut[i];
  }

  const energyL = Math.sqrt(sumSqL) + 1e-12;
  const energyR = Math.sqrt(sumSqR) + 1e-12;

  const targetGain = 0.5 * (decay || 2);
  const normFactorL = targetGain / energyL;
  const normFactorR = targetGain / energyR;

  for (let i = 0; i < totalSamples; i++) {
    irLeftCut[i] *= normFactorL;
    irRightCut[i] *= normFactorR;
  }

  impulse.copyToChannel(irLeftCut, 0);
  impulse.copyToChannel(irRightCut, 1);

  return impulse;
};

// Allpass Diffuser Stage (Schroeder All-pass Filter)
const createSchroederAllpass = (ctx: BaseAudioContext, delaySec: number, g: number) => {
  const inputNode = ctx.createGain();
  const outputNode = ctx.createGain();
  const sumW = ctx.createGain();
  const delay = ctx.createDelay(0.05);
  delay.delayTime.value = delaySec;

  const feedback = ctx.createGain();
  feedback.gain.value = -g;

  const feedforward = ctx.createGain();
  feedforward.gain.value = g;

  inputNode.connect(sumW);
  sumW.connect(delay);
  delay.connect(feedback);
  feedback.connect(sumW);

  delay.connect(outputNode);
  sumW.connect(feedforward);
  feedforward.connect(outputNode);

  return { input: inputNode, output: outputNode };
};

export type SpeakerMode = 'stereo' | 'phase-safe-mono' | 'mono-sum';

export interface StereoWidthMatrixOptions {
  widthPercent: number;
  stereoCrossoverLow: number;
  stereoCrossoverHigh: number;
  stereoCrossoverMode: 'inside' | 'outside';
  usePseudoStereo?: boolean;
  surroundWet?: number;
  surroundDelay?: number;
  speakerMode?: SpeakerMode;
  chorusEnabled?: boolean;
}

export const connectStereoWidthMatrix = (
  ctx: BaseAudioContext,
  input: AudioNode,
  widthPercentOrOptions: number | StereoWidthMatrixOptions,
  legacyLow = 150,
  legacyHigh = 20000,
  legacyMode: 'inside' | 'outside' = 'inside',
  legacyPseudo = true,
  legacySurroundWet?: number,
  legacySurroundDelay?: number,
  legacySpeakerMode: SpeakerMode = 'stereo',
  legacyChorusEnabled = false
) => {
  const opts: StereoWidthMatrixOptions = typeof widthPercentOrOptions === 'object'
    ? widthPercentOrOptions
    : {
      widthPercent: widthPercentOrOptions,
      stereoCrossoverLow: legacyLow,
      stereoCrossoverHigh: legacyHigh,
      stereoCrossoverMode: legacyMode,
      usePseudoStereo: legacyPseudo,
      surroundWet: legacySurroundWet,
      surroundDelay: legacySurroundDelay,
      speakerMode: legacySpeakerMode,
      chorusEnabled: legacyChorusEnabled,
    };

  const width = percentToStereoBaseWidth(opts.widthPercent);
  const out = ctx.createGain();

  // 1. Phân tách dải tần Crossover Transient-Perfect (hp = in - lp)
  // Tổng lp + hp = in tuyệt đối, triệt tiêu hoàn toàn hiện tượng lệch pha/khuyết tần số tại crossover
  const lowHz = Math.min(opts.stereoCrossoverLow, opts.stereoCrossoverHigh);
  const highHz = Math.max(opts.stereoCrossoverLow, opts.stereoCrossoverHigh);

  const lpLow = ctx.createBiquadFilter();
  lpLow.type = 'lowpass';
  lpLow.frequency.value = lowHz;
  lpLow.Q.value = 0.7071;

  const hpLowBus = ctx.createGain();
  const lpLowInv = ctx.createGain();
  lpLowInv.gain.value = -1;

  input.connect(lpLow);
  input.connect(hpLowBus);
  lpLow.connect(lpLowInv);
  lpLowInv.connect(hpLowBus); // hpLowBus = input - lpLow

  const lpHigh = ctx.createBiquadFilter();
  lpHigh.type = 'lowpass';
  lpHigh.frequency.value = highHz;
  lpHigh.Q.value = 0.7071;

  const hpHighBus = ctx.createGain();
  const lpHighInv = ctx.createGain();
  lpHighInv.gain.value = -1;

  hpLowBus.connect(lpHigh);
  hpLowBus.connect(hpHighBus);
  lpHigh.connect(lpHighInv);
  lpHighInv.connect(hpHighBus); // hpHighBus = hpLowBus - lpHigh

  const processedBand = ctx.createGain();
  const bypassBand = ctx.createGain();

  if (opts.stereoCrossoverMode === 'inside') {
    // Inside: Xử lý dải trung (từ lowHz đến highHz)
    lpHigh.connect(processedBand);
    lpLow.connect(bypassBand);
    hpHighBus.connect(bypassBand);
  } else {
    // Outside: Xử lý dải trầm và dải cao
    lpLow.connect(processedBand);
    hpHighBus.connect(processedBand);
    lpHigh.connect(bypassBand);
  }

  bypassBand.connect(out);

  // 2. Chế độ 1 Loa (Speaker Mode)
  if (opts.speakerMode === 'mono-sum') {
    // Chế độ 1 loa tiêu chuẩn: Downmix (L + R) * 0.5
    const monoSum = ctx.createGain();
    monoSum.gain.value = 0.5;
    const monoMerger = ctx.createChannelMerger(2);
    processedBand.connect(monoSum);
    monoSum.connect(monoMerger, 0, 0);
    monoSum.connect(monoMerger, 0, 1);
    monoMerger.connect(out);
    return out;
  }

  if (opts.speakerMode === 'phase-safe-mono') {
    // Chế độ 1 loa thông minh: Bộ dịch pha trực giao 90 độ (Olli Niemitalo Hilbert Network)
    // Giúp bảo toàn 100% âm lượng dải Side trên loa mono mà KHÔNG bị triệt tiêu pha
    const splitter = ctx.createChannelSplitter(2);
    processedBand.connect(splitter);

    const midNode = ctx.createGain();
    midNode.gain.value = 0.5;
    const sideNode = ctx.createGain();
    sideNode.gain.value = 0.5;
    const sideInv = ctx.createGain();
    sideInv.gain.value = -0.5;

    splitter.connect(midNode, 0);
    splitter.connect(midNode, 1); // M = (L+R)*0.5

    splitter.connect(sideNode, 0);
    splitter.connect(sideInv, 1);
    sideInv.connect(sideNode); // S = (L-R)*0.5

    // Lọc cắt trầm Side (120Hz) chống ù/đục âm khi gập vào mono
    const sideHp = ctx.createBiquadFilter();
    sideHp.type = 'highpass';
    sideHp.frequency.value = 120;
    sideHp.Q.value = 0.7071;
    sideNode.connect(sideHp);

    // Nhánh 1 (Mid): Trễ 1 mẫu + 4 bộ lọc Allpass IIR
    const samplePeriod = 1 / ctx.sampleRate;
    const delay1 = ctx.createDelay(0.001);
    delay1.delayTime.value = samplePeriod;
    midNode.connect(delay1);

    const apCoeffs = [0.4794008653, 0.8762184931, 0.9765975883, 0.9974992552];
    let prevP1: AudioNode = delay1;
    for (const c of apCoeffs) {
      const ap = ctx.createIIRFilter([c, 0, -1], [1, 0, -c]);
      prevP1.connect(ap);
      prevP1 = ap;
    }

    // Nhánh 2 (Side): 4 bộ lọc Allpass IIR (lệch pha 90 độ so với Mid)
    const bpCoeffs = [0.1617585000, 0.7330289300, 0.9453497000, 0.9905991600];
    let prevP2: AudioNode = sideHp;
    for (const c of bpCoeffs) {
      const bp = ctx.createIIRFilter([c, 0, -1], [1, 0, -c]);
      prevP2.connect(bp);
      prevP2 = bp;
    }

    // Gộp Mid và Side trực giao: M_phase + 0.7071 * k * S_phase
    const effK = 0.7071 * clamp(opts.widthPercent / 100, 0, 2);
    const monoSumOut = ctx.createGain();
    prevP1.connect(monoSumOut);

    const sideScaled = ctx.createGain();
    sideScaled.gain.value = effK;
    prevP2.connect(sideScaled);
    sideScaled.connect(monoSumOut);

    const monoMerger = ctx.createChannelMerger(2);
    monoSumOut.connect(monoMerger, 0, 0);
    monoSumOut.connect(monoMerger, 0, 1);
    monoMerger.connect(out);
    return out;
  }

  // 3. Chế độ Stereo: Mid/Side Width Matrix
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);

  const lToL = ctx.createGain();
  const rToL = ctx.createGain();
  const lToR = ctx.createGain();
  const rToR = ctx.createGain();

  lToL.gain.value = (1 + width) / 2;
  rToL.gain.value = (1 - width) / 2;
  lToR.gain.value = (1 - width) / 2;
  rToR.gain.value = (1 + width) / 2;

  processedBand.connect(splitter);
  splitter.connect(lToL, 0);
  splitter.connect(lToR, 0);
  splitter.connect(rToL, 1);
  splitter.connect(rToR, 1);

  lToL.connect(merger, 0, 0);
  rToL.connect(merger, 0, 0);
  lToR.connect(merger, 0, 1);
  rToR.connect(merger, 0, 1);

  // 4. Mạng trễ Khuyếch tán Đa hướng Âm vòm 3D (3D Differential Surround Multi-tap Network)
  let effectiveWet = 0;
  if (typeof opts.surroundWet === 'number' && opts.surroundWet > 0) {
    effectiveWet = opts.surroundWet / 100;
  } else if (opts.widthPercent > 100) {
    const pseudoAmount = percentToPseudoStereoAmount(opts.widthPercent);
    effectiveWet = pseudoAmount * 0.18;
    if (opts.usePseudoStereo) {
      effectiveWet = Math.max(0.10, effectiveWet);
    }
  } else if (opts.usePseudoStereo) {
    effectiveWet = 0.10;
  }

  if (effectiveWet > 0.001) {
    // Bước A: Lấy tín hiệu Mid và lọc Sub-rumble (80Hz) chống ù kick/bass
    const midFeed = ctx.createGain();
    midFeed.gain.value = 0.5;
    splitter.connect(midFeed, 0);
    splitter.connect(midFeed, 1);

    const subHp = ctx.createBiquadFilter();
    subHp.type = 'highpass';
    subHp.frequency.value = 80;
    subHp.Q.value = 0.7071;
    midFeed.connect(subHp);

    // Bước B: Mạng Khuếch tán All-Pass 2 tầng (Phase Dispersion / Transient Smearing)
    // Tầng 1: D1 ~ 2.1ms (g = 0.60); Tầng 2: D2 ~ 3.7ms (g = 0.50)
    const ap1 = createSchroederAllpass(ctx, 0.0021, 0.60);
    const ap2 = createSchroederAllpass(ctx, 0.0037, 0.50);
    subHp.connect(ap1.input);
    ap1.output.connect(ap2.input);

    // Bước C & D: Đọc 4 luồng phản xạ phi điều hòa (Golden ratio & irrational spacing) với Progressive Air Absorption
    const baseDelaySec = clamp((opts.surroundDelay ?? 12) / 1000, 0.005, 0.030);
    const diffBus = ctx.createGain();

    // Tap 1: 0.618x, gain +0.75, dải cao trong sáng
    const tap1Delay = ctx.createDelay(0.1);
    tap1Delay.delayTime.value = baseDelaySec * 0.618;
    const tap1Gain = ctx.createGain();
    tap1Gain.gain.value = 0.75;
    ap2.output.connect(tap1Delay);
    tap1Delay.connect(tap1Gain);
    tap1Gain.connect(diffBus);

    // Tap 2: 1.000x, gain -0.65, damping nhẹ 10kHz
    const tap2Delay = ctx.createDelay(0.1);
    tap2Delay.delayTime.value = baseDelaySec * 1.000;
    const tap2Lp = ctx.createBiquadFilter();
    tap2Lp.type = 'lowpass';
    tap2Lp.frequency.value = 10000;
    const tap2Gain = ctx.createGain();
    tap2Gain.gain.value = -0.65;
    ap2.output.connect(tap2Delay);
    tap2Delay.connect(tap2Lp);
    tap2Lp.connect(tap2Gain);
    tap2Gain.connect(diffBus);

    // Tap 3: 1.414x, gain +0.50, damping 7.5kHz cho phản xạ sau trái
    const tap3Delay = ctx.createDelay(0.1);
    tap3Delay.delayTime.value = baseDelaySec * 1.414;
    const tap3Lp = ctx.createBiquadFilter();
    tap3Lp.type = 'lowpass';
    tap3Lp.frequency.value = 7500;
    const tap3Gain = ctx.createGain();
    tap3Gain.gain.value = 0.50;
    ap2.output.connect(tap3Delay);
    tap3Delay.connect(tap3Lp);
    tap3Lp.connect(tap3Gain);
    tap3Gain.connect(diffBus);

    // Tap 4: 1.932x, gain -0.40, damping 5.5kHz cho ambient sau phải
    const tap4Delay = ctx.createDelay(0.1);
    tap4Delay.delayTime.value = baseDelaySec * 1.932;
    const tap4Lp = ctx.createBiquadFilter();
    tap4Lp.type = 'lowpass';
    tap4Lp.frequency.value = 5500;
    const tap4Gain = ctx.createGain();
    tap4Gain.gain.value = -0.40;
    ap2.output.connect(tap4Delay);
    tap4Delay.connect(tap4Lp);
    tap4Lp.connect(tap4Gain);
    tap4Gain.connect(diffBus);

    // Bước E: Ma trận phân bổ không gian vi sai (3D Differential Surround Matrix)
    // Kênh L nhận (+), kênh R nhận (-) => Triệt tiêu 100% đối xứng khi gập Mono (Phase-Safe Mono-Compatible)
    const surroundLeft = ctx.createGain();
    surroundLeft.gain.value = effectiveWet;
    const surroundRight = ctx.createGain();
    surroundRight.gain.value = -effectiveWet;

    diffBus.connect(surroundLeft);
    diffBus.connect(surroundRight);
    surroundLeft.connect(merger, 0, 0);
    surroundRight.connect(merger, 0, 1);
  }

  // 5. Chorus Micro-Delay Ensemble (Tạo độ dày và lộng lẫy âm thanh)
  if (opts.chorusEnabled) {
    try {
      const chorusLfo = ctx.createOscillator();
      chorusLfo.frequency.value = 0.45;

      const chorusModL = ctx.createGain();
      chorusModL.gain.value = 0.0012;
      const chorusModR = ctx.createGain();
      chorusModR.gain.value = -0.0012;

      chorusLfo.connect(chorusModL);
      chorusLfo.connect(chorusModR);

      const chorusDelayL = ctx.createDelay(0.02);
      chorusDelayL.delayTime.value = 0.0045;
      const chorusDelayR = ctx.createDelay(0.02);
      chorusDelayR.delayTime.value = 0.0045;

      chorusModL.connect(chorusDelayL.delayTime);
      chorusModR.connect(chorusDelayR.delayTime);

      splitter.connect(chorusDelayL, 0);
      splitter.connect(chorusDelayR, 1);

      const chorusSide = ctx.createGain();
      chorusSide.gain.value = 0.5;
      const chorusSideInv = ctx.createGain();
      chorusSideInv.gain.value = -0.5;

      chorusDelayL.connect(chorusSide);
      chorusDelayR.connect(chorusSideInv);
      chorusSideInv.connect(chorusSide);

      const chorusWet = 0.22;
      const chorusLeftGain = ctx.createGain();
      chorusLeftGain.gain.value = chorusWet;
      const chorusRightGain = ctx.createGain();
      chorusRightGain.gain.value = -chorusWet;

      chorusSide.connect(chorusLeftGain);
      chorusSide.connect(chorusRightGain);
      chorusLeftGain.connect(merger, 0, 0);
      chorusRightGain.connect(merger, 0, 1);

      chorusLfo.start(0);
    } catch {
      // Ignored if oscillator start fails in inactive context
    }
  }

  merger.connect(out);
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
