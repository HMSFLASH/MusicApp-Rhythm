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

  return (x: number) => {
    // Hold extrapolation
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];

    let i = 0;
    while (i < n - 1 && x > xs[i + 1]) {
      i++;
    }

    const hk = h[i];
    const t = (x - xs[i]) / hk;
    const t2 = t * t;
    const t3 = t2 * t;

    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    return h00 * ys[i] + h10 * hk * ms[i] + h01 * ys[i + 1] + h11 * hk * ms[i + 1];
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
