import { clamp } from './audioMath';
import { TRUE_PEAK_CEILING_DB } from './audioLoudness';
import { SPATIAL_ER_CONFIGS_3D, getKemarHrirPair } from '../utils/kemarHrirData';
import { BALANCER_MODE_TO_INDEX, type BalancerSettings } from './audioTypes';

export const REVERB_WET_GAIN = 0.70;
export const REVERB_PRE_DELAY_MIN_SECONDS = 0.008;
export const REVERB_PRE_DELAY_RANGE_SECONDS = 0.032;
export const REVERB_WET_HIGHPASS_HZ = 150;
export const REVERB_WET_LOWPASS_HZ = 7500;
export const HAAS_WET_GAIN_MAX = 0.14;
export const NEAR_MONO_CORRELATION_THRESHOLD = 0.985;
export const NEAR_MONO_SIDE_RATIO_THRESHOLD = 0.12;

export const MULTIBAND_STEREO_IMAGER_WORKLET_URL = '/audio/multiband-stereo-imager-worklet.js';
export const WEB_AUDIO_BALANCER_WORKLET_URL = '/audio/web-audio-balancer-worklet.js';
export const SOFT_CLIP_CURVE_POINTS = 65536;
export const SOFT_CLIP_THRESHOLD = 0.86;
export const SOFT_CLIP_SHAPE = 1.2;
export const SOFT_CLIP_CEILING = 0.985;

const createWorkletLoader = (url: string, label: string) => {
  const loadedContexts = new WeakSet<BaseAudioContext>();
  const inflightLoads = new WeakMap<BaseAudioContext, Promise<boolean>>();

  return async (ctx: BaseAudioContext): Promise<boolean> => {
    if (!('audioWorklet' in ctx) || !ctx.audioWorklet) return false;
    if (loadedContexts.has(ctx)) return true;

    const existing = inflightLoads.get(ctx);
    if (existing) return existing;

    const promise = ctx.audioWorklet.addModule(url)
      .then(() => {
        loadedContexts.add(ctx);
        inflightLoads.delete(ctx);
        return true;
      })
      .catch((error) => {
        inflightLoads.delete(ctx);
        console.warn(`[Audio] ${label} worklet unavailable.`, error);
        return false;
      });

    inflightLoads.set(ctx, promise);
    return promise;
  };
};

export const loadMultibandStereoImagerWorklet = createWorkletLoader(
  MULTIBAND_STEREO_IMAGER_WORKLET_URL,
  'Multiband Stereo Imager'
);

export const loadWebAudioBalancerWorklet = createWorkletLoader(
  WEB_AUDIO_BALANCER_WORKLET_URL,
  'Web Audio Balancer'
);

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



export type SpeakerMode = 'stereo' | 'phase-safe-mono' | 'mono-sum';

export const SPEAKER_MODE_TO_INDEX: Record<SpeakerMode, number> = {
  stereo: 0,
  'phase-safe-mono': 1,
  'mono-sum': 2,
};

export type MultibandStereoImagerSettings = {
  widthPercent: number;
  speakerMode: SpeakerMode;
  crossoverLow: number;
  crossoverHigh: number;
  crossoverMode: 'inside' | 'outside';
  surroundDelayMs: number;
  surroundWetPercent: number;
  monoThreshold: number;
  monoSideLevel: number;
  chorusAmount: number;
};

export type WebAudioBalancerNodeSettings = BalancerSettings & {
  enabled: boolean;
};

const setWorkletParams = (
  node: AudioWorkletNode,
  paramValues: Record<string, number>
) => {
  const params = node.parameters as unknown as Map<string, AudioParam>;
  for (const [name, value] of Object.entries(paramValues)) {
    const param = params.get(name);
    if (param && Number.isFinite(value)) {
      param.value = value;
    }
  }
};

const toStereoImagerParamMap = (settings: MultibandStereoImagerSettings): Record<string, number> => ({
  widthPercent: clamp(Number.isFinite(settings.widthPercent) ? settings.widthPercent : 100, 0, 200),
  speakerMode: SPEAKER_MODE_TO_INDEX[settings.speakerMode] ?? 0,
  crossoverLow: clamp(Number.isFinite(settings.crossoverLow) ? settings.crossoverLow : 150, 20, 20000),
  crossoverHigh: clamp(Number.isFinite(settings.crossoverHigh) ? settings.crossoverHigh : 20000, 20, 20000),
  crossoverMode: settings.crossoverMode === 'outside' ? 1 : 0,
  surroundDelayMs: clamp(Number.isFinite(settings.surroundDelayMs) ? settings.surroundDelayMs : 12, 5, 30),
  surroundWetPercent: clamp(Number.isFinite(settings.surroundWetPercent) ? settings.surroundWetPercent : 14, 0, 50),
  monoThreshold: clamp(Number.isFinite(settings.monoThreshold) ? settings.monoThreshold : 0.985, 0.7, 1.0),
  monoSideLevel: clamp(Number.isFinite(settings.monoSideLevel) ? settings.monoSideLevel : 100, 0, 150),
  chorusAmount: clamp(Number.isFinite(settings.chorusAmount) ? settings.chorusAmount : 0, 0, 100),
});

export const applyMultibandStereoImagerSettings = (
  node: AudioWorkletNode,
  settings: MultibandStereoImagerSettings
) => {
  setWorkletParams(node, toStereoImagerParamMap(settings));
};

export const createMultibandStereoImagerNode = (
  ctx: BaseAudioContext,
  settings: MultibandStereoImagerSettings
) => new AudioWorkletNode(ctx, 'multiband-stereo-imager', {
  numberOfInputs: 1,
  numberOfOutputs: 1,
  outputChannelCount: [2],
  channelCount: 2,
  channelCountMode: 'explicit',
  channelInterpretation: 'speakers',
  parameterData: toStereoImagerParamMap(settings),
});

const toBalancerParamMap = (settings: WebAudioBalancerNodeSettings): Record<string, number> => ({
  mode: BALANCER_MODE_TO_INDEX[settings.mode] ?? 1,
  enabled: settings.enabled ? 1 : 0,
  loudnessOffset: clamp(Number.isFinite(settings.offset) ? settings.offset : 0, -6, 6),
  targetDb: clamp(Number.isFinite(settings.targetDb) ? settings.targetDb : -18, -32, -8),
  deadzoneDb: clamp(Number.isFinite(settings.deadzoneDb) ? settings.deadzoneDb : 2.0, 0, 8),
  upwardStrength: clamp(Number.isFinite(settings.upwardStrength) ? settings.upwardStrength : 45, 0, 100),
  downwardStrength: clamp(Number.isFinite(settings.downwardStrength) ? settings.downwardStrength : 65, 0, 100),
  maxUpwardDb: clamp(Number.isFinite(settings.maxUpwardDb) ? settings.maxUpwardDb : 9.0, 0, 20),
  maxDownwardDb: clamp(Number.isFinite(settings.maxDownwardDb) ? settings.maxDownwardDb : -14.0, -30, 0),
  speed: clamp(Number.isFinite(settings.speed) ? settings.speed : 38, 0, 100),
  noiseFloorDb: clamp(Number.isFinite(settings.noiseFloorDb) ? settings.noiseFloorDb : -48, -80, -25),
  lookaheadMs: clamp(Number.isFinite(settings.lookaheadMs) ? settings.lookaheadMs : 3.5, 1, 10),
  ceilingDb: clamp(Number.isFinite(settings.ceilingDb) ? settings.ceilingDb : -1.0, -6, -0.1),
  useKWeight: settings.useKWeight ? 1 : 0,
});

export const applyWebAudioBalancerSettings = (
  node: AudioWorkletNode,
  settings: WebAudioBalancerNodeSettings
) => {
  setWorkletParams(node, toBalancerParamMap(settings));
};

export const createWebAudioBalancerNode = (
  ctx: BaseAudioContext,
  settings: WebAudioBalancerNodeSettings
) => new AudioWorkletNode(ctx, 'web-audio-balancer', {
  numberOfInputs: 1,
  numberOfOutputs: 1,
  outputChannelCount: [2],
  channelCount: 2,
  channelCountMode: 'explicit',
  channelInterpretation: 'speakers',
  parameterData: toBalancerParamMap(settings),
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
