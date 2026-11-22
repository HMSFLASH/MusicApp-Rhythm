import type { EqBand } from './audioTypes';
import { clamp } from './audioMath';
import { getAudioFxActivity } from './audioFxActivity';

export const LOUDNESS_TARGET_LUFS = -14;
export const TRUE_PEAK_CEILING_DB = -1.5;
export const INPUT_HEADROOM_DB = -6;
export const BASE_POST_FX_TRIM_DB = 3;

const MINUS_INFINITY_DB = -120;
const ABSOLUTE_GATE_LUFS = -70;
const BLOCK_SECONDS = 0.4;
const BLOCK_OVERLAP = 0.75;
const BS1770_OFFSET_DB = -0.691;
const CHANNEL_WEIGHTS = [1, 1, 1, 1.41, 1.41];

export type LoudnessMeasurement = {
  integratedLufs: number;
  samplePeakDb: number;
};

export const dbToGain = (db: number) => Math.pow(10, db / 20);

export const gainToDb = (gain: number) =>
  gain > 0 ? 20 * Math.log10(gain) : MINUS_INFINITY_DB;

const energyToLufs = (energy: number) =>
  energy > 0 ? BS1770_OFFSET_DB + 10 * Math.log10(energy) : MINUS_INFINITY_DB;

type BiquadCoefficients = {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
};

const createHighpassCoefficients = (sampleRate: number, frequency: number, q: number): BiquadCoefficients => {
  const omega = (2 * Math.PI * frequency) / sampleRate;
  const cos = Math.cos(omega);
  const sin = Math.sin(omega);
  const alpha = sin / (2 * q);
  const a0 = 1 + alpha;

  return {
    b0: ((1 + cos) / 2) / a0,
    b1: (-(1 + cos)) / a0,
    b2: ((1 + cos) / 2) / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  };
};

const createHighShelfCoefficients = (
  sampleRate: number,
  frequency: number,
  gainDb: number,
  slope = 1
): BiquadCoefficients => {
  const a = Math.pow(10, gainDb / 40);
  const omega = (2 * Math.PI * frequency) / sampleRate;
  const cos = Math.cos(omega);
  const sin = Math.sin(omega);
  const alpha = (sin / 2) * Math.sqrt((a + 1 / a) * (1 / slope - 1) + 2);
  const beta = 2 * Math.sqrt(a) * alpha;
  const a0 = (a + 1) - (a - 1) * cos + beta;

  return {
    b0: a * ((a + 1) + (a - 1) * cos + beta) / a0,
    b1: -2 * a * ((a - 1) + (a + 1) * cos) / a0,
    b2: a * ((a + 1) + (a - 1) * cos - beta) / a0,
    a1: 2 * ((a - 1) - (a + 1) * cos) / a0,
    a2: ((a + 1) - (a - 1) * cos - beta) / a0,
  };
};

// Combined single-pass dual-biquad cascade (Shelf + Highpass) with direct peak tracking
const processKWeightedChannelAndPeak = (
  source: Float32Array,
  sampleRate: number
): { filtered: Float32Array; peak: number } => {
  const shelf = createHighShelfCoefficients(sampleRate, 1681.974, 4);
  const highpass = createHighpassCoefficients(sampleRate, 38, 0.5);

  const len = source.length;
  const output = new Float32Array(len);

  let sx1 = 0;
  let sx2 = 0;
  let sy1 = 0;
  let sy2 = 0;

  let hx1 = 0;
  let hx2 = 0;
  let hy1 = 0;
  let hy2 = 0;

  let peak = 0;

  const sb0 = shelf.b0;
  const sb1 = shelf.b1;
  const sb2 = shelf.b2;
  const sa1 = shelf.a1;
  const sa2 = shelf.a2;

  const hb0 = highpass.b0;
  const hb1 = highpass.b1;
  const hb2 = highpass.b2;
  const ha1 = highpass.a1;
  const ha2 = highpass.a2;

  for (let i = 0; i < len; i += 1) {
    const x0 = source[i] || 0;
    const absX = Math.abs(x0);
    if (absX > peak) peak = absX;

    // Stage 1: High shelf filter
    const yShelf = sb0 * x0 + sb1 * sx1 + sb2 * sx2 - sa1 * sy1 - sa2 * sy2;
    sx2 = sx1;
    sx1 = x0;
    sy2 = sy1;
    sy1 = yShelf;

    // Stage 2: Highpass filter (cascaded from Stage 1 output)
    const yHp = hb0 * yShelf + hb1 * hx1 + hb2 * hx2 - ha1 * hy1 - ha2 * hy2;
    hx2 = hx1;
    hx1 = yShelf;
    hy2 = hy1;
    hy1 = yHp;

    output[i] = yHp;
  }

  return { filtered: output, peak };
};

export const measureLoudness = (audioBuffer: AudioBuffer): LoudnessMeasurement => {
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const channelCount = Math.min(audioBuffer.numberOfChannels, CHANNEL_WEIGHTS.length);
  const blockSize = Math.max(1, Math.round(sampleRate * BLOCK_SECONDS));
  const stepSize = Math.max(1, Math.round(blockSize * (1 - BLOCK_OVERLAP)));
  const blockEnergies: number[] = [];
  const cumEnergies: Float64Array[] = [];
  let samplePeak = 0;

  for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
    const source = audioBuffer.getChannelData(channelIndex);
    const { filtered, peak } = processKWeightedChannelAndPeak(source, sampleRate);
    if (peak > samplePeak) samplePeak = peak;

    // Single-pass cumulative square energy (prefix sum) to allow O(1) block energy calculation
    const cum = new Float64Array(length + 1);
    let acc = 0;
    for (let i = 0; i < length; i += 1) {
      const s = filtered[i] || 0;
      acc += s * s;
      cum[i + 1] = acc;
    }
    cumEnergies.push(cum);
  }

  for (let start = 0; start < length; start += stepSize) {
    const end = Math.min(length, start + blockSize);
    const actualBlockSize = end - start;
    if (actualBlockSize <= 0) continue;

    let blockEnergy = 0;
    for (let channelIndex = 0; channelIndex < cumEnergies.length; channelIndex += 1) {
      const cum = cumEnergies[channelIndex];
      const sumSquares = cum[end] - cum[start];
      blockEnergy += (CHANNEL_WEIGHTS[channelIndex] || 1) * (sumSquares / actualBlockSize);
    }

    blockEnergies.push(blockEnergy);
    if (end >= length) break;
  }

  const absoluteGated = blockEnergies.filter((energy) => energyToLufs(energy) > ABSOLUTE_GATE_LUFS);
  if (absoluteGated.length === 0) {
    return {
      integratedLufs: MINUS_INFINITY_DB,
      samplePeakDb: gainToDb(samplePeak),
    };
  }

  const absoluteMeanEnergy = absoluteGated.reduce((sum, energy) => sum + energy, 0) / absoluteGated.length;
  const relativeGate = energyToLufs(absoluteMeanEnergy) - 10;
  const relativeGated = absoluteGated.filter((energy) => energyToLufs(energy) > relativeGate);
  const finalBlocks = relativeGated.length > 0 ? relativeGated : absoluteGated;
  const meanEnergy = finalBlocks.reduce((sum, energy) => sum + energy, 0) / finalBlocks.length;

  return {
    integratedLufs: energyToLufs(meanEnergy),
    samplePeakDb: gainToDb(samplePeak),
  };
};

export const calculateTrackGainDb = (
  measurement: LoudnessMeasurement,
  downstreamGainDb: number,
  targetLufs = LOUDNESS_TARGET_LUFS,
  peakCeilingDb = TRUE_PEAK_CEILING_DB
) => {
  if (!Number.isFinite(measurement.integratedLufs) || measurement.integratedLufs <= ABSOLUTE_GATE_LUFS) {
    return 0;
  }

  const loudnessGainDb = targetLufs - measurement.integratedLufs - downstreamGainDb;
  const peakLimitedGainDb = peakCeilingDb - measurement.samplePeakDb - downstreamGainDb;
  return clamp(Math.min(loudnessGainDb, peakLimitedGainDb), -24, 18);
};

export const calculateNormalizedTrackGain = (
  audioBuffer: AudioBuffer,
  downstreamGainDb = INPUT_HEADROOM_DB + BASE_POST_FX_TRIM_DB
) => dbToGain(calculateTrackGainDb(measureLoudness(audioBuffer), downstreamGainDb));

const positiveGain = (value: number | undefined) => Math.max(0, Number(value) || 0);

export const calculateAutoPostFxTrimDb = (
  params: {
    preampGain?: number;
    eqBands?: EqBand[];
    bassGain?: number;
    trebleGain?: number;
    reverbMix?: number;
    stereoWidth?: number;
    stereoCrossoverLow?: number;
    stereoCrossoverHigh?: number;
    stereoCrossoverMode?: 'inside' | 'outside';
  },
  enabled: Partial<Record<'preamp' | 'eq' | 'tone' | 'reverb' | 'stereo', boolean>> = {}
) => {
  const preampReduction = enabled.preamp ? positiveGain(params.preampGain) * 0.75 : 0;
  const eqMaxBoost = enabled.eq && Array.isArray(params.eqBands)
    ? params.eqBands.reduce((max, band) => Math.max(max, positiveGain(band.gain)), 0)
    : 0;
  const eqReduction = eqMaxBoost * 0.35;
  const bassReduction = enabled.tone ? positiveGain(params.bassGain) * 0.55 : 0;
  const trebleReduction = enabled.tone ? positiveGain(params.trebleGain) * 0.25 : 0;
  const reverbReduction = enabled.reverb ? clamp((Number(params.reverbMix) || 0) / 100, 0, 1) * 2 : 0;
  const stereoReduction = enabled.stereo ? clamp(((Number(params.stereoWidth) || 100) - 100) / 300, 0, 1) * 1.5 : 0;

  return clamp(
    BASE_POST_FX_TRIM_DB -
      preampReduction -
      eqReduction -
      bassReduction -
      trebleReduction -
      reverbReduction -
      stereoReduction,
    -12,
    0
  );
};

export const calculateRealtimeTrackLoudnessGain = (
  measurement: LoudnessMeasurement,
  params: {
    preampGain?: number;
    eqBands?: EqBand[];
    bassGain?: number;
    trebleGain?: number;
    reverbMix?: number;
    stereoWidth?: number;
    stereoCrossoverLow?: number;
    stereoCrossoverHigh?: number;
    stereoCrossoverMode?: 'inside' | 'outside';
    panValue?: number;
  },
  fxEnabled: Partial<Record<'preamp' | 'eq' | 'tone' | 'reverb' | 'stereo' | 'master' | 'limiter', boolean>> = {}
): number => {
  const fxParams = {
    preampGain: params.preampGain ?? 0,
    eqBands: params.eqBands ?? [],
    bassGain: params.bassGain ?? 0,
    trebleGain: params.trebleGain ?? 0,
    reverbMix: params.reverbMix ?? 0,
    stereoWidth: params.stereoWidth ?? 100,
    stereoCrossoverLow: params.stereoCrossoverLow ?? 150,
    stereoCrossoverHigh: params.stereoCrossoverHigh ?? 20000,
    stereoCrossoverMode: params.stereoCrossoverMode ?? 'inside',
    panValue: params.panValue ?? 0,
  };
  const fxActivity = getAudioFxActivity(fxParams, fxEnabled);
  const postFxTrimDb = calculateAutoPostFxTrimDb(params, fxEnabled);
  const downstreamGainDb = INPUT_HEADROOM_DB + postFxTrimDb;
  const normalizedGain = dbToGain(calculateTrackGainDb(measurement, downstreamGainDb));
  return fxActivity.any
    ? normalizedGain
    : normalizedGain * dbToGain(downstreamGainDb);
};

