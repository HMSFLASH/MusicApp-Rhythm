export function pchipEndpointSlope(h0: number, h1: number, d0: number, d1: number) {
  let m = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
  if (Math.sign(m) !== Math.sign(d0)) {
    m = 0;
  } else if (Math.sign(d0) !== Math.sign(d1) && Math.abs(m) > Math.abs(3 * d0)) {
    m = 3 * d0;
  }
  return m;
}

export function createMonotoneCubicSpline(xs: number[], ys: number[]) {
  const n = xs.length;
  const ms = new Float32Array(n);
  const h = new Float32Array(n - 1);
  const d = new Float32Array(n - 1);

  for (let i = 0; i < n - 1; i++) {
    h[i] = xs[i + 1] - xs[i];
    d[i] = (ys[i + 1] - ys[i]) / h[i];
  }

  // Endpoints
  if (n > 2) {
    ms[0] = pchipEndpointSlope(h[0], h[1], d[0], d[1]);
    ms[n - 1] = pchipEndpointSlope(h[n - 2], h[n - 3], d[n - 2], d[n - 3]);
  } else {
    ms[0] = d[0];
    ms[n - 1] = d[0];
  }

  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] === 0 || d[i] === 0 || Math.sign(d[i - 1]) !== Math.sign(d[i])) {
      ms[i] = 0;
    } else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      ms[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }

  // Precompute polynomial coefficients for each interval: c0 + c1*t + c2*t^2 + c3*t^3
  const c0 = new Float32Array(n - 1);
  const c1 = new Float32Array(n - 1);
  const c2 = new Float32Array(n - 1);
  const c3 = new Float32Array(n - 1);
  const invH = new Float32Array(n - 1);

  for (let i = 0; i < n - 1; i++) {
    const hk = h[i];
    invH[i] = 1 / hk;
    const dy = ys[i + 1] - ys[i];
    c0[i] = ys[i];
    c1[i] = hk * ms[i];
    c2[i] = 3 * dy - hk * (2 * ms[i] + ms[i + 1]);
    c3[i] = -2 * dy + hk * (ms[i] + ms[i + 1]);
  }

  let lastIdx = 0;

  return (x: number) => {
    // Hold extrapolation
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];

    // O(1) probe from last queried interval for sequential/monotonic queries
    let i = lastIdx;
    if (i < n - 1 && x >= xs[i] && x <= xs[i + 1]) {
      // Hit cache
    } else if (i + 1 < n - 1 && x >= xs[i + 1] && x <= xs[i + 2]) {
      i = i + 1;
      lastIdx = i;
    } else {
      // Binary search for general non-monotonic access
      let low = 0;
      let high = n - 2;
      while (low <= high) {
        const mid = (low + high) >> 1;
        if (x < xs[mid]) {
          high = mid - 1;
        } else if (x > xs[mid + 1]) {
          low = mid + 1;
        } else {
          i = mid;
          break;
        }
      }
      lastIdx = i;
    }

    // Fast Horner's evaluation
    const t = (x - xs[i]) * invH[i];
    return c0[i] + t * (c1[i] + t * (c2[i] + t * c3[i]));
  };
}

export function buildPchipTargetCurve(
  sliderFreqs: number[],
  sliderGains: number[],
  gridFreqs: number[]
): number[] {
  if (sliderFreqs.length < 2) {
    return new Array(gridFreqs.length).fill(sliderGains[0] || 0);
  }

  // Use log2 axis
  const xs = sliderFreqs.map(f => Math.log2(f));
  const ys = [...sliderGains];

  const spline = createMonotoneCubicSpline(xs, ys);

  const target = new Float64Array(gridFreqs.length);
  for (let i = 0; i < gridFreqs.length; i++) {
    const x = Math.log2(gridFreqs[i]);
    target[i] = spline(x);
  }

  return Array.from(target);
}
