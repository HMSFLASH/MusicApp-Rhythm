import { createMonotoneCubicSpline } from './audioInterpolation';
import type { EqBand } from './audioTypes';

function ifft(real: Float32Array, imag: Float32Array) {
  const n = real.length;
  let i, j, k, n1, n2, a, c, s, t1, t2;

  // Bit-reverse
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

  // IFFT
  n1 = 0;
  n2 = 1;
  const numStages = Math.log2(n);
  for (i = 0; i < numStages; i++) {
    n1 = n2;
    n2 = n2 + n2;
    a = 0;
    for (j = 0; j < n1; j++) {
      c = Math.cos(a);
      s = Math.sin(a); // positive for IFFT
      a += (Math.PI * 2) / n2;
      for (k = j; k < n; k = k + n2) {
        t1 = c * real[k + n1] - s * imag[k + n1];
        t2 = s * real[k + n1] + c * imag[k + n1];
        real[k + n1] = real[k] - t1;
        imag[k + n1] = imag[k] - t2;
        real[k] = real[k] + t1;
        imag[k] = imag[k] + t2;
      }
    }
  }

  // Normalize
  for (i = 0; i < n; i++) {
    real[i] = real[i] / n;
    imag[i] = imag[i] / n;
  }
}

export function generateGraphicEqImpulseResponse(bands: EqBand[], sampleRate: number, N: number = 4096): Float32Array {
  if (!bands || bands.length === 0) {
    const ir = new Float32Array(N);
    ir[N / 2] = 1.0;
    return ir;
  }

  // 1. Build PCHIP Spline from Graphic EQ Bands
  // Sort bands just in case
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

  for (let i = 0; i <= N / 2; i++) {
    const freq = i * df;
    let gainDb = 0;
    if (freq < 20) {
      gainDb = spline(Math.log2(20)); // clamp to 20Hz
    } else if (freq > 20000) {
      gainDb = spline(Math.log2(20000)); // clamp to 20kHz
    } else {
      gainDb = spline(Math.log2(freq));
    }
    
    const magLinear = Math.pow(10, gainDb / 20);
    real[i] = magLinear;
  }

  // 3. Mirror the spectrum (Hermitian symmetry for real-valued time signal)
  for (let i = 1; i < N / 2; i++) {
    real[N - i] = real[i];
  }
  // imag remains 0 for a zero-phase filter

  // 4. Perform IFFT
  ifft(real, imag);

  // 5. Circular shift by N/2 to make it causal (center peak at N/2)
  const ir = new Float32Array(N);
  const halfN = N / 2;
  for (let i = 0; i < halfN; i++) {
    ir[i + halfN] = real[i];
    ir[i] = real[i + halfN];
  }

  // 6. Apply Blackman-Harris window to smooth edges
  for (let i = 0; i < N; i++) {
    const w = 0.35875 - 0.48829 * Math.cos((2 * Math.PI * i) / (N - 1)) 
            + 0.14128 * Math.cos((4 * Math.PI * i) / (N - 1)) 
            - 0.01168 * Math.cos((6 * Math.PI * i) / (N - 1));
    ir[i] *= w;
  }

  return ir;
}
