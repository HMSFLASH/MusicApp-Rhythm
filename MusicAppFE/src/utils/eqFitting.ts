import { multiplyMatrix, multiplyMatrixVector, invertMatrix, transposeMatrix, addMatrix, createMatrix, multiplyMatrixScalar } from './matrixMath';
import type { EqBand } from '../hooks/audioTypes';
import { buildPchipTargetCurve } from '../hooks/audioInterpolation';

const LAMBDA = 0.12; // Smoother regularization
const Q_FACTOR = 2.15; // Parametric-like smooth Q (~2/3 octave)
const CORRECTION_AMOUNT = 0.45; // Reduce local correction strength to prevent ripples
const DEFAULT_SLIDER_FREQS = [31.25, 62.5, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export function getEq31Freqs(): number[] {
  return [
    20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160,
    200, 250, 315, 400, 500, 630, 800, 1000, 1250,
    1600, 2000, 2500, 3150, 4000, 5000, 6300,
    8000, 10000, 12500, 16000, 20000
  ];
}

export function createFrequencyGrid(sampleRate: number, numPoints: number = 257): number[] {
  const fMin = 20;
  const fMax = Math.min(20000, sampleRate * 0.45);
  const logMin = Math.log2(fMin);
  const logMax = Math.log2(fMax);
  const grid = new Float64Array(numPoints);
  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    grid[i] = Math.pow(2, logMin + t * (logMax - logMin));
  }
  return Array.from(grid);
}

// Biquad magnitude response for Peaking Filter
export function calculatePeakingMagnitudeDb(f: number, fc: number, q: number, gainDb: number, sampleRate: number): number {
  if (gainDb === 0) return 0;
  const a = Math.pow(10, gainDb / 40);
  const omega = (2 * Math.PI * fc) / sampleRate;
  const cos = Math.cos(omega);
  const sin = Math.sin(omega);
  const alpha = sin / (2 * q);

  const b0 = 1 + alpha * a;
  const b1 = -2 * cos;
  const b2 = 1 - alpha * a;
  const a0 = 1 + alpha / a;
  const a1 = -2 * cos;
  const a2 = 1 - alpha / a;

  const w = (2 * Math.PI * f) / sampleRate;
  const cosW = Math.cos(w);
  const cos2W = Math.cos(2 * w);

  const num = (b0 * b0 + b1 * b1 + b2 * b2) + 2 * (b0 * b1 + b1 * b2) * cosW + 2 * b0 * b2 * cos2W;
  const den = (a0 * a0 + a1 * a1 + a2 * a2) + 2 * (a0 * a1 + a1 * a2) * cosW + 2 * a0 * a2 * cos2W;

  return 10 * Math.log10(num / den);
}

export function buildResponseMatrix(freqGrid: number[], centerFreqs: number[], q: number, sampleRate: number): number[][] {
  const numGrid = freqGrid.length;
  const numBands = centerFreqs.length;
  const B = createMatrix(numGrid, numBands);

  const cosW = new Float64Array(numGrid);
  const cos2W = new Float64Array(numGrid);
  const invSampleRate = (2 * Math.PI) / sampleRate;
  for (let j = 0; j < numGrid; j++) {
    const w = freqGrid[j] * invSampleRate;
    cosW[j] = Math.cos(w);
    cos2W[j] = Math.cos(2 * w);
  }

  const a = Math.pow(10, 1.0 / 40);
  for (let i = 0; i < numBands; i++) {
    const omega = centerFreqs[i] * invSampleRate;
    const cos = Math.cos(omega);
    const sin = Math.sin(omega);
    const alpha = sin / (2 * q);

    const b0 = 1 + alpha * a;
    const b1 = -2 * cos;
    const b2 = 1 - alpha * a;
    const a0 = 1 + alpha / a;
    const a1 = -2 * cos;
    const a2 = 1 - alpha / a;

    const numC0 = b0 * b0 + b1 * b1 + b2 * b2;
    const numC1 = 2 * (b0 * b1 + b1 * b2);
    const numC2 = 2 * b0 * b2;
    const denC0 = a0 * a0 + a1 * a1 + a2 * a2;
    const denC1 = 2 * (a0 * a1 + a1 * a2);
    const denC2 = 2 * a0 * a2;

    for (let j = 0; j < numGrid; j++) {
      const num = numC0 + numC1 * cosW[j] + numC2 * cos2W[j];
      const den = denC0 + denC1 * cosW[j] + denC2 * cos2W[j];
      B[j][i] = 10 * Math.log10(num / den);
    }
  }
  return B;
}

export function buildSecondDifferenceMatrix(n: number): number[][] {
  const L = createMatrix(n - 2, n);
  for (let i = 0; i < n - 2; i++) {
    L[i][i] = 1;
    L[i][i + 1] = -2;
    L[i][i + 2] = 1;
  }
  return L;
}

export function buildPrecomputedInverse(B: number[][], lambda: number, weights?: number[]): number[][] {
  const numBands = B[0].length;
  const numGrid = B.length;

  // Direct symmetric accumulation of B^T W B (or B^T B)
  const BT_B = createMatrix(numBands, numBands);
  for (let r = 0; r < numBands; r++) {
    for (let c = r; c < numBands; c++) {
      let sum = 0;
      if (weights) {
        for (let j = 0; j < numGrid; j++) {
          sum += B[j][r] * B[j][c] * weights[j];
        }
      } else {
        for (let j = 0; j < numGrid; j++) {
          sum += B[j][r] * B[j][c];
        }
      }
      BT_B[r][c] = sum;
      BT_B[c][r] = sum;
    }
  }

  const L = buildSecondDifferenceMatrix(numBands);
  const LT = transposeMatrix(L);
  const LT_L = multiplyMatrix(LT, L);
  const lambda_LT_L = multiplyMatrixScalar(LT_L, lambda);

  const A = addMatrix(BT_B, lambda_LT_L);
  let A_inv: number[][];
  try {
    A_inv = invertMatrix(A);
  } catch {
    A_inv = createMatrix(numBands, numBands);
    for (let i = 0; i < numBands; i++) {
      A_inv[i][i] = 1 / Math.max(1e-6, A[i][i] || 1);
    }
  }
  
  // Compute M = A_inv * (B^T W) directly without allocating large intermediate transpose/product matrices
  const M = createMatrix(numBands, numGrid);
  for (let i = 0; i < numBands; i++) {
    for (let j = 0; j < numGrid; j++) {
      let sum = 0;
      for (let k = 0; k < numBands; k++) {
        sum += A_inv[i][k] * B[j][k];
      }
      if (weights) {
        sum *= weights[j];
      }
      M[i][j] = sum;
    }
  }

  return M;
}

export function computeCascadeResponseDb(freqGrid: number[], centerFreqs: number[], gains: number[], q: number, sampleRate: number): number[] {
  const numGrid = freqGrid.length;
  const response = new Float64Array(numGrid);

  const cosW = new Float64Array(numGrid);
  const cos2W = new Float64Array(numGrid);
  const invSampleRate = (2 * Math.PI) / sampleRate;
  for (let j = 0; j < numGrid; j++) {
    const w = freqGrid[j] * invSampleRate;
    cosW[j] = Math.cos(w);
    cos2W[j] = Math.cos(2 * w);
  }

  for (let i = 0; i < centerFreqs.length; i++) {
    const gain = Number.isFinite(gains[i]) ? gains[i] : 0;
    if (gain === 0) continue;

    const a = Math.pow(10, gain / 40);
    const omega = centerFreqs[i] * invSampleRate;
    const cos = Math.cos(omega);
    const sin = Math.sin(omega);
    const alpha = sin / (2 * q);

    const b0 = 1 + alpha * a;
    const b1 = -2 * cos;
    const b2 = 1 - alpha * a;
    const a0 = 1 + alpha / a;
    const a1 = -2 * cos;
    const a2 = 1 - alpha / a;

    const numC0 = b0 * b0 + b1 * b1 + b2 * b2;
    const numC1 = 2 * (b0 * b1 + b1 * b2);
    const numC2 = 2 * b0 * b2;
    const denC0 = a0 * a0 + a1 * a1 + a2 * a2;
    const denC1 = 2 * (a0 * a1 + a1 * a2);
    const denC2 = 2 * a0 * a2;

    for (let j = 0; j < numGrid; j++) {
      const num = numC0 + numC1 * cosW[j] + numC2 * cos2W[j];
      const den = denC0 + denC1 * cosW[j] + denC2 * cos2W[j];
      response[j] += 10 * Math.log10(num / den);
    }
  }
  return Array.from(response);
}

// Local Least Squares Correction for residual
export function solveLocalCorrection(residual: number[], B: number[][], lambda: number, lockedBands: boolean[]): number[] {
  // If bands are locked, we effectively remove them from the solving variables
  const numBands = B[0].length;
  const numGrid = residual.length;
  
  const freeIndices: number[] = [];
  for (let i = 0; i < numBands; i++) {
    if (!lockedBands[i]) freeIndices.push(i);
  }
  
  if (freeIndices.length === 0) return new Array(numBands).fill(0);

  const kLen = freeIndices.length;

  // 1. Direct symmetric accumulation of A = (B_free^T * B_free + lambda * I)
  // Eliminates allocating B_free, BT_free, I_free and reduces inner multiplications by half
  const A = createMatrix(kLen, kLen);
  for (let r = 0; r < kLen; r++) {
    const idxR = freeIndices[r];
    for (let c = r; c < kLen; c++) {
      const idxC = freeIndices[c];
      let sum = 0;
      for (let j = 0; j < numGrid; j++) {
        sum += B[j][idxR] * B[j][idxC];
      }
      if (r === c) {
        sum += lambda;
      }
      A[r][c] = sum;
      A[c][r] = sum;
    }
  }

  // 2. Compute RHS vector v = B_free^T * residual (vector of length K)
  const v = new Array(kLen).fill(0);
  for (let r = 0; r < kLen; r++) {
    const idxR = freeIndices[r];
    let sum = 0;
    for (let j = 0; j < numGrid; j++) {
      sum += B[j][idxR] * residual[j];
    }
    v[r] = sum;
  }

  // 3. Invert small K x K matrix (K <= 31)
  let A_inv: number[][];
  try {
    A_inv = invertMatrix(A);
  } catch {
    // Fallback if singular
    return new Array(numBands).fill(0);
  }

  // 4. delta_free = A_inv * v (O(K^2) vector product instead of O(K^2 * numGrid) full matrix product)
  const delta_free = multiplyMatrixVector(A_inv, v);
  
  const delta = new Array(numBands).fill(0);
  for (let k = 0; k < kLen; k++) {
    const dVal = delta_free[k];
    delta[freeIndices[k]] = Number.isFinite(dVal) ? dVal : 0;
  }
  
  return delta;
}

export function clampArray(arr: number[], min: number, max: number): number[] {
  return arr.map(v => {
    if (!Number.isFinite(v)) return 0;
    return Math.max(min, Math.min(max, v));
  });
}

export function subtractArrays(a: number[], b: number[]): number[] {
  return a.map((v, i) => v - b[i]);
}

export function addArrays(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + b[i]);
}

export function detectClampedBands(gains: number[], min: number, max: number): boolean[] {
  return gains.map(v => v <= min || v >= max);
}

// Global Cache for Web Audio
let cachedM: number[][] | null = null;
let cachedB: number[][] | null = null;
let cachedGrid: number[] | null = null;
let cachedSampleRate = 0;
let cachedCenterFreqs: number[] | null = null;
let cachedWeightKey = '';

const createWeightKey = (sliderFreqs: number[]) =>
  sliderFreqs
    .filter((frequency) => Number.isFinite(frequency) && frequency > 0)
    .map((frequency) => Math.round(frequency * 1000) / 1000)
    .sort((a, b) => a - b)
    .join('|');

export function getFitterCache(sampleRate: number, sliderFreqs: number[] = DEFAULT_SLIDER_FREQS) {
  const effectiveSliderFreqs = sliderFreqs.length > 0 ? sliderFreqs : DEFAULT_SLIDER_FREQS;
  const weightKey = createWeightKey(effectiveSliderFreqs);
  if (cachedSampleRate === sampleRate && cachedWeightKey === weightKey && cachedM && cachedB && cachedGrid && cachedCenterFreqs) {
    return { M: cachedM, B: cachedB, grid: cachedGrid, centerFreqs: cachedCenterFreqs };
  }
  const grid = createFrequencyGrid(sampleRate, 257);
  const centerFreqs = getEq31Freqs();
  const B = buildResponseMatrix(grid, centerFreqs, Q_FACTOR, sampleRate);
  
  const weights = new Array(grid.length).fill(1.0);
  
  for (const sf of effectiveSliderFreqs) {
    let minDiff = Infinity;
    let minIdx = -1;
    for (let i = 0; i < grid.length; i++) {
      const diff = Math.abs(grid[i] - sf);
      if (diff < minDiff) {
        minDiff = diff;
        minIdx = i;
      }
    }
    if (minIdx !== -1) {
      weights[minIdx] = 50.0; // Strict law for slider positions
      if (minIdx > 0) weights[minIdx - 1] = 10.0;
      if (minIdx < grid.length - 1) weights[minIdx + 1] = 10.0;
    }
  }

  const M = buildPrecomputedInverse(B, LAMBDA, weights);

  cachedSampleRate = sampleRate;
  cachedGrid = grid;
  cachedB = B;
  cachedM = M;
  cachedCenterFreqs = centerFreqs;
  cachedWeightKey = weightKey;

  return { M, B, grid, centerFreqs };
}

export type FitResult = {
  fittedBands: EqBand[];
  autoPreamp: number;
  targetCurve: number[]; // size 257
  actualCurve: number[]; // size 257
  gridFreqs: number[];
};

export function processGraphicEqBands(bands: EqBand[], sampleRate: number, qualityMode = true): FitResult {
  const groups: Record<string, EqBand[]> = { 'L+R': [], 'L': [], 'R': [] };
  bands.forEach(b => {
    if (groups[b.channel]) groups[b.channel].push(b);
  });

  const sliderWeightFreqs = bands
    .map((band) => band.frequency)
    .filter((frequency) => Number.isFinite(frequency) && frequency > 0);
  const cache = getFitterCache(sampleRate, sliderWeightFreqs);
  const { M, B, grid, centerFreqs } = cache;

  let fittedBands: EqBand[] = [];

  // We will assume L+R for graphing target/actual. If split L and R, we just visualize L+R or max.
  let finalTargetCurve = new Array(grid.length).fill(0);
  let finalActualCurve = new Array(grid.length).fill(0);

  for (const channel of ['L+R', 'L', 'R'] as const) {
    const channelBands = groups[channel]
      .filter((band) => Number.isFinite(band.frequency) && band.frequency > 0)
      .sort((a, b) => a.frequency - b.frequency)
      .reduce<EqBand[]>((uniqueBands, band) => {
        const clampedFrequency = Math.max(20, Math.min(sampleRate * 0.45, band.frequency));
        const previous = uniqueBands[uniqueBands.length - 1];
        const nextBand = { ...band, frequency: clampedFrequency };
        if (previous && Math.abs(previous.frequency - clampedFrequency) < 0.001) {
          uniqueBands[uniqueBands.length - 1] = nextBand;
        } else {
          uniqueBands.push(nextBand);
        }
        return uniqueBands;
      }, []);
    if (channelBands.length === 0) continue;

    if (channelBands.length < 3) {
      fittedBands = fittedBands.concat(channelBands);
      continue;
    }

    const sliderFreqs = channelBands.map(b => b.frequency);
    const sliderGains = channelBands.map(b => b.gain); // Already clamped in UI usually

    const target = buildPchipTargetCurve(sliderFreqs, sliderGains, grid);
    let fittedGains = multiplyMatrixVector(M, target);
    fittedGains = clampArray(fittedGains, -18, 18);

    let actual = computeCascadeResponseDb(grid, centerFreqs, fittedGains, Q_FACTOR, sampleRate);

    if (qualityMode) {
      const residual = subtractArrays(target, actual);
      const lockedBands = detectClampedBands(fittedGains, -18, 18);
      const delta = solveLocalCorrection(residual, B, LAMBDA, lockedBands);
      const scaledDelta = delta.map(d => d * CORRECTION_AMOUNT);
      fittedGains = clampArray(addArrays(fittedGains, scaledDelta), -18, 18);
      actual = computeCascadeResponseDb(grid, centerFreqs, fittedGains, Q_FACTOR, sampleRate);
    }

    if (channel === 'L+R' || finalTargetCurve[0] === 0) {
      finalTargetCurve = target;
      finalActualCurve = actual;
    }

    for (let i = 0; i < centerFreqs.length; i++) {
      fittedBands.push({
        id: `interp-${channel}-${i}`,
        type: 'peaking',
        frequency: centerFreqs[i],
        gain: fittedGains[i],
        q: Q_FACTOR,
        channel
      });
    }
  }

  return {
    fittedBands,
    autoPreamp: 0,
    targetCurve: finalTargetCurve,
    actualCurve: finalActualCurve,
    gridFreqs: grid
  };
}
