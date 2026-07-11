const MIN_DB = -120;
const MAX_UPWARD_GAIN_DB = 24;
const MAX_DOWNWARD_REDUCTION_DB = -48;
const LOOKAHEAD_SECONDS = 0.003;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const dbToGain = (db) => Math.pow(10, db / 20);

const coefficientForTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return 1;
  return 1 - Math.exp(-1 / Math.max(1, seconds * sampleRate));
};

const gainDbForLevel = (levelDb, threshold, ratio, knee) => {
  const safeRatio = clamp(ratio, 0.05, 20);
  const safeKnee = Math.max(0, knee);

  if (safeRatio >= 1) {
    const over = levelDb - threshold;
    const slope = (1 / safeRatio) - 1;

    if (safeKnee > 0) {
      const x = over + safeKnee / 2;
      if (x <= 0) return 0;
      if (x >= safeKnee) return clamp(over * slope, MAX_DOWNWARD_REDUCTION_DB, 0);
      return clamp((slope * x * x) / (2 * safeKnee), MAX_DOWNWARD_REDUCTION_DB, 0);
    }

    return over > 0 ? clamp(over * slope, MAX_DOWNWARD_REDUCTION_DB, 0) : 0;
  }

  const below = threshold - levelDb;
  const slope = 1 - safeRatio;

  if (safeKnee > 0) {
    const x = below + safeKnee / 2;
    if (x <= 0) return 0;
    if (x >= safeKnee) return clamp(below * slope, 0, MAX_UPWARD_GAIN_DB);
    return clamp((slope * x * x) / (2 * safeKnee), 0, MAX_UPWARD_GAIN_DB);
  }

  return below > 0 ? clamp(below * slope, 0, MAX_UPWARD_GAIN_DB) : 0;
};

class CustomDynamicsCompressorProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'threshold', defaultValue: -18, minValue: -100, maxValue: 0, automationRate: 'k-rate' },
      { name: 'ratio', defaultValue: 3, minValue: 0.05, maxValue: 20, automationRate: 'k-rate' },
      { name: 'knee', defaultValue: 12, minValue: 0, maxValue: 40, automationRate: 'k-rate' },
      { name: 'attack', defaultValue: 0.005, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'release', defaultValue: 0.18, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'rmsSize', defaultValue: 0.005, minValue: 0.001, maxValue: 0.25, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.envelopeEnergy = 0;
    this.gainDb = 0;
    this.lookaheadSamples = Math.max(1, Math.round(sampleRate * LOOKAHEAD_SECONDS));
    this.delayLength = this.lookaheadSamples + 1;
    this.delayBuffers = [];
    this.writeIndex = 0;
  }

  getDelayBuffer(channel) {
    while (this.delayBuffers.length <= channel) {
      this.delayBuffers.push(new Float32Array(this.delayLength));
    }

    return this.delayBuffers[channel];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const threshold = parameters.threshold[0];
    const ratio = parameters.ratio[0];
    const knee = parameters.knee[0];
    const attackCoefficient = coefficientForTime(parameters.attack[0]);
    const releaseCoefficient = coefficientForTime(parameters.release[0]);
    const rmsCoefficient = coefficientForTime(parameters.rmsSize[0]);

    if (!input.length) {
      for (let channel = 0; channel < output.length; channel += 1) {
        output[channel].fill(0);
      }
      return true;
    }

    const frameCount = output[0]?.length || 0;

    for (let frame = 0; frame < frameCount; frame += 1) {
      let instantEnergy = 0;
      let activeChannels = 0;

      for (let channel = 0; channel < output.length; channel += 1) {
        const source = input[channel] || input[0];
        if (!source) continue;
        const sample = source[frame] || 0;
        instantEnergy += sample * sample;
        activeChannels += 1;
      }

      instantEnergy = activeChannels > 0 ? instantEnergy / activeChannels : 0;
      this.envelopeEnergy += rmsCoefficient * (instantEnergy - this.envelopeEnergy);

      const levelDb = this.envelopeEnergy > 1e-12
        ? 10 * Math.log10(this.envelopeEnergy)
        : MIN_DB;
      const targetGainDb = levelDb <= -90
        ? 0
        : gainDbForLevel(levelDb, threshold, ratio, knee);
      const gainCoefficient = targetGainDb < this.gainDb ? attackCoefficient : releaseCoefficient;
      this.gainDb += gainCoefficient * (targetGainDb - this.gainDb);

      const gain = dbToGain(this.gainDb);
      const readIndex = (this.writeIndex + 1) % this.delayLength;

      for (let channel = 0; channel < output.length; channel += 1) {
        const source = input[channel] || input[0];
        const target = output[channel];
        const delay = this.getDelayBuffer(channel);

        delay[this.writeIndex] = source ? (source[frame] || 0) : 0;
        target[frame] = delay[readIndex] * gain;
      }

      this.writeIndex = readIndex;
    }

    return true;
  }
}

registerProcessor('custom-dynamics-compressor', CustomDynamicsCompressorProcessor);
