import { expandResonantEqBands, type EqBand } from './audioTypes';
import { createMonotoneCubicSpline } from './audioInterpolation';

export type EqResponsePoint = {
  frequency: number;
  db: number;
};

export type EqBandResponseCurve = {
  id: string;
  label: string;
  channel: EqBand['channel'];
  color: string;
  points: EqResponsePoint[];
};

export type EqResponseChartData = {
  frequencies: number[];
  total: EqResponsePoint[];
  left: EqResponsePoint[];
  right: EqResponsePoint[];
  bandCurves: EqBandResponseCurve[];
  hasStereoDifference: boolean;
};

type BiquadCoefficients = {
  b0: number;
  b1: number;
  b2: number;
  a0: number;
  a1: number;
  a2: number;
};

const SAMPLE_RATE = 48000;
const MIN_FREQUENCY = 20;
const MAX_FREQUENCY = 20000;
const RESPONSE_POINT_COUNT = 320;
const MIN_MAGNITUDE = 1e-6;

const GAIN_BASED_EQ_TYPES = new Set<BiquadFilterType>(['peaking', 'lowshelf', 'highshelf']);

const clampFrequency = (frequency: number) =>
  Math.max(MIN_FREQUENCY, Math.min(frequency, SAMPLE_RATE * 0.49));

const normalizedQ = (q: number | undefined) =>
  Number.isFinite(q) && Number(q) > 0 ? Number(q) : 1;

const linearToDb = (value: number) =>
  20 * Math.log10(Math.max(value, MIN_MAGNITUDE));

const normalizeCoefficients = (coefficients: BiquadCoefficients): BiquadCoefficients => ({
  b0: coefficients.b0 / coefficients.a0,
  b1: coefficients.b1 / coefficients.a0,
  b2: coefficients.b2 / coefficients.a0,
  a0: 1,
  a1: coefficients.a1 / coefficients.a0,
  a2: coefficients.a2 / coefficients.a0,
});

const createBiquadCoefficients = (band: EqBand): BiquadCoefficients => {
  const type = (band.type || 'peaking') as BiquadFilterType;
  const frequency = clampFrequency(Number(band.frequency) || 1000);
  const q = normalizedQ(band.q);
  const gainDb = Number(band.gain) || 0;
  const a = Math.pow(10, gainDb / 40);
  const omega = (2 * Math.PI * frequency) / SAMPLE_RATE;
  const cos = Math.cos(omega);
  const sin = Math.sin(omega);
  const alpha = sin / (2 * q);

  switch (type) {
    case 'lowpass':
      return normalizeCoefficients({
        b0: (1 - cos) / 2,
        b1: 1 - cos,
        b2: (1 - cos) / 2,
        a0: 1 + alpha,
        a1: -2 * cos,
        a2: 1 - alpha,
      });

    case 'highpass':
      return normalizeCoefficients({
        b0: (1 + cos) / 2,
        b1: -(1 + cos),
        b2: (1 + cos) / 2,
        a0: 1 + alpha,
        a1: -2 * cos,
        a2: 1 - alpha,
      });

    case 'bandpass':
      return normalizeCoefficients({
        b0: alpha,
        b1: 0,
        b2: -alpha,
        a0: 1 + alpha,
        a1: -2 * cos,
        a2: 1 - alpha,
      });

    case 'lowshelf': {
      const sqrtA = Math.sqrt(a);
      const shelfAlpha = sin / Math.SQRT2;
      return normalizeCoefficients({
        b0: a * ((a + 1) - (a - 1) * cos + 2 * sqrtA * shelfAlpha),
        b1: 2 * a * ((a - 1) - (a + 1) * cos),
        b2: a * ((a + 1) - (a - 1) * cos - 2 * sqrtA * shelfAlpha),
        a0: (a + 1) + (a - 1) * cos + 2 * sqrtA * shelfAlpha,
        a1: -2 * ((a - 1) + (a + 1) * cos),
        a2: (a + 1) + (a - 1) * cos - 2 * sqrtA * shelfAlpha,
      });
    }

    case 'highshelf': {
      const sqrtA = Math.sqrt(a);
      const shelfAlpha = sin / Math.SQRT2;
      return normalizeCoefficients({
        b0: a * ((a + 1) + (a - 1) * cos + 2 * sqrtA * shelfAlpha),
        b1: -2 * a * ((a - 1) + (a + 1) * cos),
        b2: a * ((a + 1) + (a - 1) * cos - 2 * sqrtA * shelfAlpha),
        a0: (a + 1) - (a - 1) * cos + 2 * sqrtA * shelfAlpha,
        a1: 2 * ((a - 1) - (a + 1) * cos),
        a2: (a + 1) - (a - 1) * cos - 2 * sqrtA * shelfAlpha,
      });
    }

    case 'peaking':
    default:
      return normalizeCoefficients({
        b0: 1 + alpha * a,
        b1: -2 * cos,
        b2: 1 - alpha * a,
        a0: 1 + alpha / a,
        a1: -2 * cos,
        a2: 1 - alpha / a,
      });
  }
};

const getMagnitudeAtFrequency = (coefficients: BiquadCoefficients, frequency: number) => {
  const omega = (2 * Math.PI * clampFrequency(frequency)) / SAMPLE_RATE;
  const cos1 = Math.cos(omega);
  const sin1 = Math.sin(omega);
  const cos2 = Math.cos(2 * omega);
  const sin2 = Math.sin(2 * omega);

  const numeratorReal = coefficients.b0 + coefficients.b1 * cos1 + coefficients.b2 * cos2;
  const numeratorImag = -(coefficients.b1 * sin1 + coefficients.b2 * sin2);
  const denominatorReal = 1 + coefficients.a1 * cos1 + coefficients.a2 * cos2;
  const denominatorImag = -(coefficients.a1 * sin1 + coefficients.a2 * sin2);
  const numeratorMagnitude = Math.hypot(numeratorReal, numeratorImag);
  const denominatorMagnitude = Math.max(Math.hypot(denominatorReal, denominatorImag), MIN_MAGNITUDE);

  return numeratorMagnitude / denominatorMagnitude;
};

const createLogFrequencies = () =>
  Array.from({ length: RESPONSE_POINT_COUNT }, (_, index) => {
    const t = index / (RESPONSE_POINT_COUNT - 1);
    return MIN_FREQUENCY * Math.pow(MAX_FREQUENCY / MIN_FREQUENCY, t);
  });

const isAudibleBand = (band: EqBand) => {
  const type = (band.type || 'peaking') as BiquadFilterType;
  return !GAIN_BASED_EQ_TYPES.has(type) || Math.abs(Number(band.gain) || 0) > 0.001;
};

const bandColor = (channel: EqBand['channel']) => {
  if (channel === 'L') return '#60a5fa';
  if (channel === 'R') return '#f87171';
  return '#22d3ee';
};

export const createEqResponseChartData = (
  eqBands: EqBand[],
  enabled = true,
  preampGain = 0,
  bassGain = 0,
  trebleGain = 0,
  enabledFlags?: { eq?: boolean; tone?: boolean; preamp?: boolean },
  isGraphicMode = false
): EqResponseChartData => {
  const frequencies = createLogFrequencies();
  const eqEnabled = enabledFlags?.eq ?? enabled;
  const toneEnabled = enabledFlags?.tone ?? enabled;
  const preampEnabled = enabledFlags?.preamp ?? enabled;
  
  const toneBands: EqBand[] = [];
  if (toneEnabled) {
    if (Math.abs(bassGain) > 0.001) {
      toneBands.push({ id: 'tone-bass', type: 'lowshelf', frequency: 150, q: 1, gain: bassGain, channel: 'L+R' });
    }
    if (Math.abs(trebleGain) > 0.001) {
      toneBands.push({ id: 'tone-treble', type: 'highshelf', frequency: 4000, q: 1, gain: trebleGain, channel: 'L+R' });
    }
  }

  const activeEqBands = eqEnabled ? eqBands.filter(isAudibleBand) : [];
  
  // Parametric EQ: simulate all biquad curves
  const curves = [...activeEqBands, ...toneBands].map((band) => ({
    band,
    coefficientsList: expandResonantEqBands([band]).map(createBiquadCoefficients),
  }));

  let graphicSpline: ((x: number) => number) | null = null;
  if (isGraphicMode && activeEqBands.length > 0) {
    const sortedBands = [...activeEqBands].sort((a, b) => a.frequency - b.frequency);
    const freqs = sortedBands.map(b => b.frequency);
    const gains = sortedBands.map(b => b.gain);
    if (freqs[0] > 20) { freqs.unshift(20); gains.unshift(gains[0]); }
    if (freqs[freqs.length - 1] < 20000) { freqs.push(20000); gains.push(gains[gains.length - 1]); }
    const logFreqs = freqs.map(f => Math.log2(f));
    graphicSpline = createMonotoneCubicSpline(logFreqs, gains);
  }

  const getEqGainDb = (frequency: number, channelFilter: (b: EqBand) => boolean) => {
    let eqDb = 0;
    if (graphicSpline) {
      // In graphic mode, eq is the spline
      eqDb = graphicSpline(Math.log2(clampFrequency(frequency)));
    } else {
      const eqCurves = curves.filter(c => !c.band.id.startsWith('tone-') && channelFilter(c.band));
      const gain = eqCurves.reduce((current, { coefficientsList }) => {
        let cGain = 1;
        for (const coef of coefficientsList) cGain *= getMagnitudeAtFrequency(coef, frequency);
        return current * cGain;
      }, 1);
      eqDb = linearToDb(gain);
    }
    
    // Add Tone
    const toneCurves = curves.filter(c => c.band.id.startsWith('tone-') && channelFilter(c.band));
    const toneGain = toneCurves.reduce((current, { coefficientsList }) => {
      let cGain = 1;
      for (const coef of coefficientsList) cGain *= getMagnitudeAtFrequency(coef, frequency);
      return current * cGain;
    }, 1);
    
    return eqDb + linearToDb(toneGain);
  };

  const left = frequencies.map((frequency) => ({
    frequency,
    db: getEqGainDb(frequency, b => b.channel !== 'R') + (preampEnabled ? preampGain : 0)
  }));

  const right = frequencies.map((frequency) => ({
    frequency,
    db: getEqGainDb(frequency, b => b.channel !== 'L') + (preampEnabled ? preampGain : 0)
  }));

  const total = frequencies.map((frequency, index) => ({
    frequency,
    db: (left[index].db + right[index].db) / 2,
  }));

  const bandCurves = curves.map(({ band, coefficientsList }) => ({
    id: band.id,
    label: `${Math.round(band.frequency)} Hz`,
    channel: band.channel,
    color: bandColor(band.channel),
    points: frequencies.map((frequency) => {
      if (graphicSpline && !band.id.startsWith('tone-')) {
        // Don't draw individual eq band curves in graphic mode
        return { frequency, db: 0 };
      }
      let cGain = 1;
      for (const coef of coefficientsList) cGain *= getMagnitudeAtFrequency(coef, frequency);
      return {
        frequency,
        db: linearToDb(cGain),
      };
    }),
  }));

  return {
    frequencies,
    total,
    left,
    right,
    bandCurves,
    hasStereoDifference: [...activeEqBands, ...toneBands].some((band) => band.channel === 'L' || band.channel === 'R'),
  };
};
