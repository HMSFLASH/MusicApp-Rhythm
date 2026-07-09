const FILTER_TAPS = 47;
const FILTER_HISTORY = FILTER_TAPS - 1;
const PHASE_HISTORY = Math.floor(FILTER_TAPS / 2);
const SOFT_CLIP_THRESHOLD = 0.86;
const SOFT_CLIP_SHAPE = 1.2;
const SOFT_CLIP_CEILING = 0.985;

const createHalfBandKernel = () => {
  const coefficients = new Float32Array(FILTER_TAPS);
  const center = (FILTER_TAPS - 1) / 2;
  const cutoff = 0.25;
  let sum = 0;

  for (let i = 0; i < FILTER_TAPS; i += 1) {
    const n = i - center;
    const sinc = n === 0
      ? 2 * cutoff
      : Math.sin(2 * Math.PI * cutoff * n) / (Math.PI * n);
    const window = 0.42 -
      0.5 * Math.cos((2 * Math.PI * i) / (FILTER_TAPS - 1)) +
      0.08 * Math.cos((4 * Math.PI * i) / (FILTER_TAPS - 1));

    coefficients[i] = sinc * window;
    sum += coefficients[i];
  }

  for (let i = 0; i < FILTER_TAPS; i += 1) {
    coefficients[i] /= sum;
  }

  return coefficients;
};

const HALF_BAND = createHalfBandKernel();
const HALF_BAND_UPSAMPLE = Float32Array.from(HALF_BAND, (value) => value * 2);

const appendHistory = (history, input) => {
  if (input.length >= history.length) {
    history.set(input.subarray(input.length - history.length));
    return;
  }

  history.copyWithin(0, input.length);
  history.set(input, history.length - input.length);
};

const makeExtendedBuffer = (history, input) => {
  const extended = new Float32Array(history.length + input.length);
  extended.set(history);
  extended.set(input, history.length);
  return extended;
};

const upsample2x = (input, history) => {
  const output = new Float32Array(input.length * 2);
  const extended = makeExtendedBuffer(history, input);

  for (let n = 0; n < input.length; n += 1) {
    const sampleIndex = history.length + n;
    let even = 0;
    let odd = 0;

    for (let tap = 0; tap < FILTER_TAPS; tap += 2) {
      even += HALF_BAND_UPSAMPLE[tap] * extended[sampleIndex - tap / 2];
    }

    for (let tap = 1; tap < FILTER_TAPS; tap += 2) {
      odd += HALF_BAND_UPSAMPLE[tap] * extended[sampleIndex - (tap - 1) / 2];
    }

    output[n * 2] = even;
    output[n * 2 + 1] = odd;
  }

  appendHistory(history, input);
  return output;
};

const downsample2x = (input, history) => {
  const outputLength = Math.floor(input.length / 2);
  const output = new Float32Array(outputLength);
  const extended = makeExtendedBuffer(history, input);

  for (let n = 0; n < outputLength; n += 1) {
    const sampleIndex = history.length + n * 2;
    let sum = 0;

    for (let tap = 0; tap < FILTER_TAPS; tap += 1) {
      sum += HALF_BAND[tap] * extended[sampleIndex - tap];
    }

    output[n] = sum;
  }

  appendHistory(history, input);
  return output;
};

const softClipSample = (sample) => {
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

class ChannelState {
  constructor() {
    this.upA = new Float32Array(PHASE_HISTORY);
    this.upB = new Float32Array(PHASE_HISTORY);
    this.downA = new Float32Array(FILTER_HISTORY);
    this.downB = new Float32Array(FILTER_HISTORY);
  }
}

class OversampledSoftClipperProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.channelStates = [];
  }

  getChannelState(channel) {
    while (this.channelStates.length <= channel) {
      this.channelStates.push(new ChannelState());
    }

    return this.channelStates[channel];
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    for (let channel = 0; channel < output.length; channel += 1) {
      const source = input[channel] || input[0];
      const target = output[channel];

      if (!source) {
        target.fill(0);
        continue;
      }

      const state = this.getChannelState(channel);
      const up2 = upsample2x(source, state.upA);
      const up4 = upsample2x(up2, state.upB);

      for (let i = 0; i < up4.length; i += 1) {
        up4[i] = softClipSample(up4[i]);
      }

      const down2 = downsample2x(up4, state.downA);
      const down1 = downsample2x(down2, state.downB);

      target.set(down1.subarray(0, target.length));
      if (down1.length < target.length) {
        target.fill(0, down1.length);
      }
    }

    return true;
  }
}

registerProcessor('oversampled-soft-clipper', OversampledSoftClipperProcessor);
