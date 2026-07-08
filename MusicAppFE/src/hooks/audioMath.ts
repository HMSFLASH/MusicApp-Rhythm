export const NEUTRAL_EPSILON = 0.0001;

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const msToAudioSeconds = (value: number) => clamp(value / 1000, 0, 1);

export const compressorAttackSeconds = (attackMs: number, rmsSizeMs: number) =>
  msToAudioSeconds(Math.max(attackMs, rmsSizeMs * 0.5));

export const percentToPan = (value: number) => clamp(value / 100, -1, 1);

export const STEREO_WIDTH_MAX_PERCENT = 400;

export const percentToStereoWidth = (value: number) =>
  clamp(value / 100, 0, STEREO_WIDTH_MAX_PERCENT / 100);

export const percentToStereoBaseWidth = (value: number) => {
  const width = percentToStereoWidth(value);
  return width <= 1 ? width : clamp(1 + Math.pow(width - 1, 0.85) * 0.45, 1, 2.2);
};

export const percentToPseudoStereoAmount = (value: number) => {
  const normalized = clamp((value - 100) / (STEREO_WIDTH_MAX_PERCENT - 100), 0, 1);
  return (1 - Math.exp(-normalized * 2.2)) / (1 - Math.exp(-2.2));
};

export const isNeutralDbGain = (value: number) => Math.abs(value || 0) < NEUTRAL_EPSILON;

export const isNeutralPercentValue = (value: number, neutralValue: number) =>
  Math.abs((value || 0) - neutralValue) < NEUTRAL_EPSILON;
