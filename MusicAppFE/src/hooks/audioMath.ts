export const NEUTRAL_EPSILON = 0.0001;

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const percentToPan = (value: number) => clamp(value / 100, -1, 1);

export const STEREO_WIDTH_MAX_PERCENT = 200;
export const SURROUND_WET_MAX_PERCENT = 50;
export const SURROUND_DELAY_DEFAULT_MS = 12;
export const SURROUND_DELAY_MIN_MS = 5;
export const SURROUND_DELAY_MAX_MS = 30;

export const CHORUS_AMOUNT_MIN = 0;
export const CHORUS_AMOUNT_MAX = 100;
export const CHORUS_AMOUNT_DEFAULT = 0;

export const MONO_SIDE_LEVEL_MIN = 0;
export const MONO_SIDE_LEVEL_MAX = 150;
export const MONO_SIDE_LEVEL_DEFAULT = 100;

export const MONO_THRESHOLD_MIN = 0.7;
export const MONO_THRESHOLD_MAX = 1.0;
export const MONO_THRESHOLD_DEFAULT = 0.985;

export const BALANCER_OFFSET_MIN = -6;
export const BALANCER_OFFSET_MAX = 6;
export const BALANCER_OFFSET_DEFAULT = 0;

export const percentToStereoWidth = (value: number) => {
  const effectiveValue = value <= 100 ? value : 100 + (value - 100) * 3;
  return clamp(effectiveValue / 100, 0, 4);
};

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
