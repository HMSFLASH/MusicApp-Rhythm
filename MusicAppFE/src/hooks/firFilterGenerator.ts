import { createMonotoneCubicSpline } from './audioInterpolation';
import type { EqBand } from './audioTypes';

interface TwiddleTable {
  cos: Float32Array;
  sin: Float32Array;
}
const twiddleCache = new Map<number, TwiddleTable>();

function getTwiddleTable(n: number): TwiddleTable {
  let table = twiddleCache.get(n);
  if (table) return table;

  const halfN = n / 2;
  const cos = new Float32Array(halfN);
  const sin = new Float32Array(halfN);
  const angleStep = (Math.PI * 2) / n;
  for (let i = 0; i < halfN; i++) {
    const angle = angleStep * i;
    cos[i] = Math.cos(angle);
    sin[i] = Math.sin(angle); // positive for IFFT
  }
  table = { cos, sin };
  twiddleCache.set(n, table);
  return table;
}

const windowCache = new Map<number, Float32Array>();

function getBlackmanHarrisWindow(n: number): Float32Array {
  const cached = windowCache.get(n);
  if (cached) return cached;

  const w = new Float32Array(n);
  const factor = (2 * Math.PI) / (n - 1);
  const half = Math.ceil(n / 2);

  for (let i = 0; i < half; i++) {
    const angle = factor * i;
    const val = 0.35875 - 0.48829 * Math.cos(angle)
              + 0.14128 * Math.cos(2 * angle)
              - 0.01168 * Math.cos(3 * angle);
    w[i] = val;
    w[n - 1 - i] = val; // Symmetric reflection
  }

  windowCache.set(n, w);
  return w;
}

function ifft(real: Float32Array, imag: Float32Array) {
  const n = real.length;
  let i, j, k, n1, n2, t1, t2;

  // Bit-reverse permutation
  j = 0;
  n2 = n / 2;
  for (i = 1; i < n - 1; i++) {
    n1 = n2;
    while (j >= n1) {
      j = j - n1;
      n1 = n1 / 2;
    }
    j = j + n1;

    if (i < j) {
      t1 = real[i];
      real[i] = real[j];
      real[j] = t1;
      t1 = imag[i];
      imag[i] = imag[j];
      imag[j] = t1;
    }
  }

  // Precomputed Cooley-Tukey Radix-2 IFFT with O(1) twiddle lookup
  const twiddles = getTwiddleTable(n);
  n2 = 1;
  const numStages = Math.log2(n);
  for (i = 0; i < numStages; i++) {
    n1 = n2;
    n2 = n2 + n2;
    const twiddleStep = n / n2;

    for (j = 0; j < n1; j++) {
      const twiddleIdx = j * twiddleStep;
      const c = twiddles.cos[twiddleIdx];
      const s = twiddles.sin[twiddleIdx];

      for (k = j; k < n; k += n2) {
        const kNext = k + n1;
        t1 = c * real[kNext] - s * imag[kNext];
        t2 = s * real[kNext] + c * imag[kNext];
        real[kNext] = real[k] - t1;
        imag[kNext] = imag[k] - t2;
        real[k] += t1;
        imag[k] += t2;
      }
    }
  }

  // Normalize
  const invN = 1 / n;
  for (i = 0; i < n; i++) {
    real[i] *= invN;
    imag[i] *= invN;
  }
}

export function generateGraphicEqImpulseResponse(bands: EqBand[], sampleRate: number, N: number = 4096): Float32Array {
  if (!bands || bands.length === 0) {
    const ir = new Float32Array(N);
    ir[N / 2] = 1.0;
    return ir;
  }

  // 1. Build PCHIP Spline from Graphic EQ Bands
  const sortedBands = [...bands].sort((a, b) => a.frequency - b.frequency);
  const freqs = sortedBands.map(b => b.frequency);
  const gains = sortedBands.map(b => b.gain);
  
  // Add boundaries for 20Hz and 20kHz if not present
  if (freqs[0] > 20) {
    freqs.unshift(20);
    gains.unshift(gains[0]);
  }
  if (freqs[freqs.length - 1] < 20000) {
    freqs.push(20000);
    gains.push(gains[gains.length - 1]);
  }

  const logFreqs = freqs.map(f => Math.log2(f));
  const spline = createMonotoneCubicSpline(logFreqs, gains);

  // 2. Evaluate spline on a dense linear frequency grid from DC to Nyquist
  const real = new Float32Array(N);
  const imag = new Float32Array(N);
  
  const df = sampleRate / N;
  const halfN = N / 2;

  for (let i = 0; i <= halfN; i++) {
    const freq = i * df;
    const gainDb = freq < 20
      ? spline(Math.log2(20))
      : freq > 20000
        ? spline(Math.log2(20000))
        : spline(Math.log2(freq));
    
    real[i] = Math.pow(10, gainDb / 20);
  }

  // 3. Mirror the spectrum (Hermitian symmetry for real-valued time signal)
  for (let i = 1; i < halfN; i++) {
    real[N - i] = real[i];
  }
  // imag remains 0 for a zero-phase filter

  // 4. Perform IFFT
  ifft(real, imag);

  // 5. Circular shift by N/2 to make it causal (center peak at N/2)
  const ir = new Float32Array(N);
  for (let i = 0; i < halfN; i++) {
    ir[i + halfN] = real[i];
    ir[i] = real[i + halfN];
  }

  // 6. Apply precomputed Blackman-Harris window to smooth edges
  const window = getBlackmanHarrisWindow(N);
  for (let i = 0; i < N; i++) {
    ir[i] *= window[i];
  }

  return ir;
}
