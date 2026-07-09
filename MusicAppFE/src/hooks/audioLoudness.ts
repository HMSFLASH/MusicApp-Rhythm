import type { EqBand } from './audioTypes';
import { clamp } from './audioMath';

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

const applyBiquad = (input: Float32Array, coefficients: BiquadCoefficients) => {
  const output = new Float32Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;

  for (let i = 0; i < input.length; i += 1) {
    const x0 = input[i] || 0;
    const y0 =
      coefficients.b0 * x0 +
      coefficients.b1 * x1 +
      coefficients.b2 * x2 -
      coefficients.a1 * y1 -
      coefficients.a2 * y2;

    output[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }

  return output;
};

const createKWeightedChannel = (channel: Float32Array, sampleRate: number) => {
  const shelf = createHighShelfCoefficients(sampleRate, 1681.974, 4);
  const highpass = createHighpassCoefficients(sampleRate, 38, 0.5);
  return applyBiquad(applyBiquad(channel, shelf), highpass);
};

export const measureLoudness = (audioBuffer: AudioBuffer): LoudnessMeasurement => {
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const channelCount = Math.min(audioBuffer.numberOfChannels, CHANNEL_WEIGHTS.length);
  const blockSize = Math.max(1, Math.round(sampleRate * BLOCK_SECONDS));
  const stepSize = Math.max(1, Math.round(blockSize * (1 - BLOCK_OVERLAP)));
  const blockEnergies: number[] = [];
  const weightedChannels: Float32Array[] = [];
  let samplePeak = 0;

  for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
    const source = audioBuffer.getChannelData(channelIndex);

    for (let i = 0; i < source.length; i += 1) {
      samplePeak = Math.max(samplePeak, Math.abs(source[i] || 0));
    }

    weightedChannels.push(createKWeightedChannel(source, sampleRate));
  }

  for (let start = 0; start < length; start += stepSize) {
    const end = Math.min(length, start + blockSize);
    const actualBlockSize = end - start;
    if (actualBlockSize <= 0) continue;

    let blockEnergy = 0;
    for (let channelIndex = 0; channelIndex < weightedChannels.length; channelIndex += 1) {
      const data = weightedChannels[channelIndex];
      let sumSquares = 0;

      for (let i = start; i < end; i += 1) {
        const sample = data[i] || 0;
        sumSquares += sample * sample;
      }

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
