import { useState, useCallback, useRef } from 'react';
import {
  BALANCER_DEFAULTS,
  BALANCER_TEMPLATES,
  EQ_PRESETS,
  PRECOMPUTED_STYLISTIC_PRESETS,
  STEREO_IMAGER_DEFAULTS,
  STYLISTIC_PRESETS,
} from './audioTypes';
import type {
  BalancerMode,
  BalancerTemplate,
  CustomEqPreset,
  EqBand,
} from './audioTypes';
import {
  BALANCER_OFFSET_MAX,
  BALANCER_OFFSET_MIN,
  CHORUS_AMOUNT_DEFAULT,
  CHORUS_AMOUNT_MAX,
  CHORUS_AMOUNT_MIN,
  clamp,
  MONO_SIDE_LEVEL_DEFAULT,
  MONO_SIDE_LEVEL_MAX,
  MONO_SIDE_LEVEL_MIN,
  MONO_THRESHOLD_DEFAULT,
  MONO_THRESHOLD_MAX,
  MONO_THRESHOLD_MIN,
  STEREO_WIDTH_MAX_PERCENT,
  SURROUND_DELAY_DEFAULT_MS,
  SURROUND_DELAY_MAX_MS,
  SURROUND_DELAY_MIN_MS,
  SURROUND_WET_MAX_PERCENT,
} from './audioMath';
import type { SpeakerMode } from './audioGraph';

type FxKey = 'eq' | 'tone' | 'comp' | 'reverb' | 'master' | 'preamp' | 'limiter' | 'stereo' | 'interpolate';
type FxEnabledState = Record<FxKey, boolean>;

const VALID_BALANCER_MODES = new Set<BalancerMode>(['normal', 'music', 'smart', 'custom']);
const VALID_SPEAKER_MODES = new Set<SpeakerMode>(['stereo', 'phase-safe-mono', 'mono-sum']);

const sanitizeBalancerMode = (value: unknown): BalancerMode =>
  typeof value === 'string' && VALID_BALANCER_MODES.has(value as BalancerMode)
    ? (value as BalancerMode)
    : BALANCER_DEFAULTS.mode;

const sanitizeSpeakerMode = (value: unknown): SpeakerMode =>
  typeof value === 'string' && VALID_SPEAKER_MODES.has(value as SpeakerMode)
    ? (value as SpeakerMode)
    : STEREO_IMAGER_DEFAULTS.speakerMode;

type SavedAudioEffectsState = Partial<{
  eqPresetName: string;
  eqBandCount: number;
  eqBands: EqBand[];
  customEqPresets: CustomEqPreset[];
  preampGain: number;
  bassGain: number;
  trebleGain: number;
  balancerMode: BalancerMode;
  balancerOffset: number;
  balancerTargetDb: number;
  balancerDeadzoneDb: number;
  balancerUpwardStrength: number;
  balancerDownwardStrength: number;
  balancerMaxUpwardDb: number;
  balancerMaxDownwardDb: number;
  balancerSpeed: number;
  balancerNoiseFloorDb: number;
  balancerLookaheadMs: number;
  balancerCeilingDb: number;
  balancerUseKWeight: boolean;
  panValue: number;
  stereoWidth: number;
  stereoCrossoverLow: number;
  stereoCrossoverHigh: number;
  stereoCrossoverMode: 'inside' | 'outside';
  surroundWet: number;
  surroundDelay: number;
  speakerMode: SpeakerMode;
  monoThreshold: number;
  monoSideLevel: number;
  chorusAmount: number;
  chorusEnabled: boolean;
  reverbMix: number;
  reverbTime: number;
  loudnessNormalization: boolean;
  useOversample: boolean;
  precalculateOnIdle: boolean;
  fullQueueCacheEnabled: boolean;
  masterFftSize: number;
  stereoFftSize: number;
  audioLatencyHint: AudioContextLatencyCategory;
  reverbEngine: 'procedural' | 'file';
  fxEnabled: Partial<FxEnabledState>;
}>;

const DEFAULT_FX_ENABLED: FxEnabledState = {
  eq: true,
  tone: true,
  comp: true,
  reverb: true,
  master: true,
  preamp: true,
  limiter: true,
  stereo: true,
  interpolate: false
};

const DEFAULT_PARAMETRIC_Q = 1.41;
const MIN_EQ_Q = 0.1;
const MAX_EQ_Q = 18;

function bandwidthToQ(bwOctaves: number) {
  const R = Math.pow(2, bwOctaves);
  return Math.sqrt(R) / (R - 1);
}

function asymmetryQFactor(asymmetry: number) {
  if (asymmetry <= 2.0) return 1.0;
  if (asymmetry >= 4.0) return 0.65;
  const t = (asymmetry - 2.0) / 2.0;
  return 1.0 + t * (0.65 - 1.0);
}

const calculateGraphicEqQ = (frequencies: number[], index: number) => {
  const minFreq = 20;
  const maxFreq = 20000;
  const fc = clamp(frequencies[index], minFreq, maxFreq);
  if (!fc) return DEFAULT_PARAMETRIC_Q;

  let fPrev = frequencies[index - 1];
  let fNext = frequencies[index + 1];

  if (!fPrev && !fNext) return DEFAULT_PARAMETRIC_Q;

  if (fNext && fNext / fc < 1.03) return DEFAULT_PARAMETRIC_Q;
  if (fPrev && fc / fPrev < 1.03) return DEFAULT_PARAMETRIC_Q;

  if (!fPrev && fNext) {
    fPrev = (fc * fc) / fNext;
  }
  if (!fNext && fPrev) {
    fNext = (fc * fc) / fPrev;
  }

  let fL = Math.sqrt(fPrev * fc);
  let fH = Math.sqrt(fc * fNext);

  fL = clamp(fL, minFreq, maxFreq);
  fH = clamp(fH, minFreq, maxFreq);

  if (!(fL < fc && fc < fH)) {
    return DEFAULT_PARAMETRIC_Q;
  }

  const leftBW = Math.log2(fc / fL);
  const rightBW = Math.log2(fH / fc);
  let totalBW = leftBW + rightBW;

  const minBW = 1 / 24;
  totalBW = Math.max(totalBW, minBW);

  let q = bandwidthToQ(totalBW);

  if (!Number.isFinite(q)) return DEFAULT_PARAMETRIC_Q;

  const asymmetry = Math.max(leftBW, rightBW) / Math.max(0.001, Math.min(leftBW, rightBW));
  const asymFactor = asymmetryQFactor(asymmetry);
  if (Number.isFinite(asymFactor)) {
    q *= asymFactor;
  }

  const minQ = 0.5;
  const maxQ = 6;
  const finalQ = Math.round(clamp(q, minQ, maxQ) * 100) / 100;
  return Number.isFinite(finalQ) ? finalQ : DEFAULT_PARAMETRIC_Q;
};

const createEqBands = (frequencies: number[], gains?: number[]): EqBand[] =>
  frequencies.map((freq, i) => ({
    id: `band_${i}`,
    frequency: freq,
    gain: gains?.[i] ?? 0,
    q: calculateGraphicEqQ(frequencies, i),
    channel: 'L+R' as const,
    type: 'peaking' as const
  }));

const clampPreampGain = (value: number) => clamp(value, -12, 6);

const hasParametricBandSettings = (bands: EqBand[]) =>
  bands.some((band) => (
    (band.type || 'peaking') !== 'peaking' || band.channel !== 'L+R'
  ));

const applyGraphicEqQ = (bands: EqBand[]) => {
  const sortedBands = [...bands].sort((a, b) => a.frequency - b.frequency);
  const frequencies = sortedBands.map((band) => band.frequency);

  return sortedBands.map((band, index) => ({
    ...band,
    q: calculateGraphicEqQ(frequencies, index),
    channel: 'L+R' as const,
    type: 'peaking' as BiquadFilterType,
  }));
};

export function useAudioEffectsState(savedState: SavedAudioEffectsState = {}) {
  const savedStylisticPreset = STYLISTIC_PRESETS[savedState.eqPresetName as keyof typeof STYLISTIC_PRESETS];
  const savedCustomPreset = savedState.customEqPresets?.find(p => p.name === savedState.eqPresetName);
  const initialPresetIsParametric = savedState.eqPresetName === 'PARAMETRIC'
    || savedCustomPreset?.presetMode === 'parametric'
    || Boolean(savedCustomPreset?.isCustomOrigin && hasParametricBandSettings(savedCustomPreset.bands));
  const [eqBandCount, setEqBandCountState] = useState<number>(savedState.eqBandCount ?? 10);
  const [eqPresetName, setEqPresetName] = useState<string>(savedState.eqPresetName || 'CUSTOM');
  const [eqBands, setEqBands] = useState<EqBand[]>(() => {
    const presetName = savedState.eqPresetName || 'CUSTOM';
    const precomputedPreset = PRECOMPUTED_STYLISTIC_PRESETS[presetName];
    const isParam = presetName === 'PARAMETRIC'
      || savedCustomPreset?.presetMode === 'parametric'
      || Boolean(savedCustomPreset?.isCustomOrigin && hasParametricBandSettings(savedCustomPreset.bands))
      || Boolean(precomputedPreset && precomputedPreset.isParametric);

    if (savedState.eqBands && savedState.eqBands.length > 0) {
      return isParam ? savedState.eqBands : applyGraphicEqQ(savedState.eqBands);
    }

    const bandKey = `${savedState.eqBandCount ?? 10}_BANDS` as keyof typeof EQ_PRESETS;

    if (precomputedPreset) {
      if (precomputedPreset.isParametric) return precomputedPreset.bands as EqBand[];
      const freqs = EQ_PRESETS[bandKey] || EQ_PRESETS['10_BANDS'];
      const gains = precomputedPreset.precomputedGains[bandKey] || precomputedPreset.precomputedGains['10_BANDS'];
      return createEqBands(freqs, gains);
    }

    const freqs = EQ_PRESETS[bandKey] || EQ_PRESETS['10_BANDS'];
    return createEqBands(freqs);
  });
  const [customEqPresets, setCustomEqPresets] = useState<CustomEqPreset[]>(savedState.customEqPresets || []);

  const [preampGain, setPreampGainState] = useState<number>(
    clampPreampGain(savedStylisticPreset?.preampGain ?? savedState.preampGain ?? 0)
  );
  const [bassGain, setBassGain] = useState<number>(savedStylisticPreset?.bassGain ?? savedState.bassGain ?? 0);
  const [trebleGain, setTrebleGain] = useState<number>(savedStylisticPreset?.trebleGain ?? savedState.trebleGain ?? 0);

  // Web Audio Balancer v2.1 state
  const [balancerMode, setBalancerModeState] = useState<BalancerMode>(
    sanitizeBalancerMode(savedState.balancerMode)
  );
  const [balancerOffset, setBalancerOffsetState] = useState<number>(
    clamp(savedState.balancerOffset ?? BALANCER_DEFAULTS.offset, BALANCER_OFFSET_MIN, BALANCER_OFFSET_MAX)
  );
  const [balancerTargetDb, setBalancerTargetDbState] = useState<number>(
    clamp(savedState.balancerTargetDb ?? BALANCER_DEFAULTS.targetDb, -32, -8)
  );
  const [balancerDeadzoneDb, setBalancerDeadzoneDbState] = useState<number>(
    clamp(savedState.balancerDeadzoneDb ?? BALANCER_DEFAULTS.deadzoneDb, 0, 8)
  );
  const [balancerUpwardStrength, setBalancerUpwardStrengthState] = useState<number>(
    clamp(savedState.balancerUpwardStrength ?? BALANCER_DEFAULTS.upwardStrength, 0, 100)
  );
  const [balancerDownwardStrength, setBalancerDownwardStrengthState] = useState<number>(
    clamp(savedState.balancerDownwardStrength ?? BALANCER_DEFAULTS.downwardStrength, 0, 100)
  );
  const [balancerMaxUpwardDb, setBalancerMaxUpwardDbState] = useState<number>(
    clamp(savedState.balancerMaxUpwardDb ?? BALANCER_DEFAULTS.maxUpwardDb, 0, 20)
  );
  const [balancerMaxDownwardDb, setBalancerMaxDownwardDbState] = useState<number>(
    clamp(savedState.balancerMaxDownwardDb ?? BALANCER_DEFAULTS.maxDownwardDb, -30, 0)
  );
  const [balancerSpeed, setBalancerSpeedState] = useState<number>(
    clamp(savedState.balancerSpeed ?? BALANCER_DEFAULTS.speed, 0, 100)
  );
  const [balancerNoiseFloorDb, setBalancerNoiseFloorDbState] = useState<number>(
    clamp(savedState.balancerNoiseFloorDb ?? BALANCER_DEFAULTS.noiseFloorDb, -80, -25)
  );
  const [balancerLookaheadMs, setBalancerLookaheadMsState] = useState<number>(
    clamp(savedState.balancerLookaheadMs ?? BALANCER_DEFAULTS.lookaheadMs, 1, 10)
  );
  const [balancerCeilingDb, setBalancerCeilingDbState] = useState<number>(
    clamp(savedState.balancerCeilingDb ?? BALANCER_DEFAULTS.ceilingDb, -6, -0.1)
  );
  const [balancerUseKWeight, setBalancerUseKWeightState] = useState<boolean>(
    savedState.balancerUseKWeight ?? BALANCER_DEFAULTS.useKWeight
  );

  // Stereo & 3D Spatializer state
  const [panValue, setPanValue] = useState<number>(savedState.panValue ?? 0);
  const [stereoWidth, setStereoWidthState] = useState<number>(
    clamp(savedState.stereoWidth ?? STEREO_IMAGER_DEFAULTS.stereoWidth, 0, STEREO_WIDTH_MAX_PERCENT)
  );
  const [stereoCrossoverLow, setStereoCrossoverLowState] = useState<number>(
    clamp(savedState.stereoCrossoverLow ?? STEREO_IMAGER_DEFAULTS.stereoCrossoverLow, 20, 20000)
  );
  const [stereoCrossoverHigh, setStereoCrossoverHighState] = useState<number>(
    clamp(savedState.stereoCrossoverHigh ?? STEREO_IMAGER_DEFAULTS.stereoCrossoverHigh, 20, 20000)
  );
  const [stereoCrossoverMode, setStereoCrossoverModeState] = useState<'inside' | 'outside'>(
    savedState.stereoCrossoverMode ?? STEREO_IMAGER_DEFAULTS.stereoCrossoverMode
  );
  const [surroundWet, setSurroundWetState] = useState<number>(
    clamp(savedState.surroundWet ?? STEREO_IMAGER_DEFAULTS.surroundWet, 0, SURROUND_WET_MAX_PERCENT)
  );
  const [surroundDelay, setSurroundDelayState] = useState<number>(
    clamp(savedState.surroundDelay ?? SURROUND_DELAY_DEFAULT_MS, SURROUND_DELAY_MIN_MS, SURROUND_DELAY_MAX_MS)
  );
  const [speakerMode, setSpeakerModeState] = useState<SpeakerMode>(
    sanitizeSpeakerMode(savedState.speakerMode)
  );
  const [monoThreshold, setMonoThresholdState] = useState<number>(
    clamp(savedState.monoThreshold ?? MONO_THRESHOLD_DEFAULT, MONO_THRESHOLD_MIN, MONO_THRESHOLD_MAX)
  );
  const [monoSideLevel, setMonoSideLevelState] = useState<number>(
    clamp(savedState.monoSideLevel ?? MONO_SIDE_LEVEL_DEFAULT, MONO_SIDE_LEVEL_MIN, MONO_SIDE_LEVEL_MAX)
  );
  const [chorusAmount, setChorusAmountState] = useState<number>(() => {
    if (typeof savedState.chorusAmount === 'number') {
      return clamp(savedState.chorusAmount, CHORUS_AMOUNT_MIN, CHORUS_AMOUNT_MAX);
    }
    return savedState.chorusEnabled ? 50 : CHORUS_AMOUNT_DEFAULT;
  });

  const [reverbMix, setReverbMix] = useState<number>(savedState.reverbMix ?? 0);
  const [reverbTime, setReverbTime] = useState<number>(savedState.reverbTime ?? 2);
  const [reverbEngine, setReverbEngine] = useState<'procedural' | 'file'>(savedState.reverbEngine ?? 'procedural');

  const [loudnessNormalization, setLoudnessNormalization] = useState<boolean>(savedState.loudnessNormalization ?? true);
  const [useOversample, setUseOversample] = useState<boolean>(savedState.useOversample ?? false);
  const [precalculateOnIdle, setPrecalculateOnIdle] = useState<boolean>(savedState.precalculateOnIdle ?? false);
  const [fullQueueCacheEnabled, setFullQueueCacheEnabled] = useState<boolean>(savedState.fullQueueCacheEnabled ?? false);
  const [masterFftSize, setMasterFftSize] = useState<number>(savedState.masterFftSize ?? 2048);
  const [stereoFftSize, setStereoFftSize] = useState<number>(savedState.stereoFftSize ?? 1024);
  const [audioLatencyHint, setAudioLatencyHint] = useState<AudioContextLatencyCategory>(savedState.audioLatencyHint ?? 'playback');

  const initialFxEnabled: FxEnabledState = {
    ...DEFAULT_FX_ENABLED,
    ...savedState.fxEnabled,
    ...(initialPresetIsParametric ? { interpolate: false } : {}),
  };
  const [fxEnabled, setFxEnabled] = useState<FxEnabledState>(initialFxEnabled);
  const fxEnabledRef = useRef(initialFxEnabled);

  const toggleFx = useCallback((key: FxKey) => {
    setFxEnabled((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      fxEnabledRef.current = next;
      return next;
    });
  }, []);
  const disableInterpolation = useCallback(() => {
    setFxEnabled((prev) => {
      if (!prev.interpolate) return prev;
      const next = { ...prev, interpolate: false };
      fxEnabledRef.current = next;
      return next;
    });
  }, []);

  // Stereo Imager setters & reset
  const setStereoWidth = useCallback((value: number) => {
    setStereoWidthState(clamp(value, 0, STEREO_WIDTH_MAX_PERCENT));
  }, []);
  const setStereoCrossoverLow = useCallback((value: number) => {
    setStereoCrossoverLowState(clamp(value, 20, 20000));
  }, []);
  const setStereoCrossoverHigh = useCallback((value: number) => {
    setStereoCrossoverHighState(clamp(value, 20, 20000));
  }, []);
  const setSurroundWet = useCallback((value: number) => {
    setSurroundWetState(clamp(value, 0, SURROUND_WET_MAX_PERCENT));
  }, []);
  const setSurroundDelay = useCallback((value: number) => {
    setSurroundDelayState(clamp(value, SURROUND_DELAY_MIN_MS, SURROUND_DELAY_MAX_MS));
  }, []);
  const setSpeakerMode = useCallback((mode: SpeakerMode) => {
    setSpeakerModeState(sanitizeSpeakerMode(mode));
  }, []);
  const setMonoThreshold = useCallback((value: number) => {
    setMonoThresholdState(clamp(value, MONO_THRESHOLD_MIN, MONO_THRESHOLD_MAX));
  }, []);
  const setMonoSideLevel = useCallback((value: number) => {
    setMonoSideLevelState(clamp(value, MONO_SIDE_LEVEL_MIN, MONO_SIDE_LEVEL_MAX));
  }, []);
  const setChorusAmount = useCallback((value: number) => {
    setChorusAmountState(clamp(value, CHORUS_AMOUNT_MIN, CHORUS_AMOUNT_MAX));
  }, []);
  const resetStereoImager = useCallback(() => {
    setStereoWidthState(STEREO_IMAGER_DEFAULTS.stereoWidth);
    setSpeakerModeState(STEREO_IMAGER_DEFAULTS.speakerMode);
    setStereoCrossoverLowState(STEREO_IMAGER_DEFAULTS.stereoCrossoverLow);
    setStereoCrossoverHighState(STEREO_IMAGER_DEFAULTS.stereoCrossoverHigh);
    setStereoCrossoverModeState(STEREO_IMAGER_DEFAULTS.stereoCrossoverMode);
    setSurroundDelayState(STEREO_IMAGER_DEFAULTS.surroundDelay);
    setSurroundWetState(STEREO_IMAGER_DEFAULTS.surroundWet);
    setMonoThresholdState(STEREO_IMAGER_DEFAULTS.monoThreshold);
    setMonoSideLevelState(STEREO_IMAGER_DEFAULTS.monoSideLevel);
    setChorusAmountState(STEREO_IMAGER_DEFAULTS.chorusAmount);
  }, []);

  // Web Audio Balancer setters, templates & reset
  const setBalancerMode = useCallback((mode: BalancerMode) => {
    setBalancerModeState(sanitizeBalancerMode(mode));
  }, []);
  const setBalancerOffset = useCallback((value: number) => {
    setBalancerOffsetState(clamp(value, BALANCER_OFFSET_MIN, BALANCER_OFFSET_MAX));
  }, []);
  const setBalancerTargetDb = useCallback((value: number) => {
    setBalancerTargetDbState(clamp(value, -32, -8));
  }, []);
  const setBalancerDeadzoneDb = useCallback((value: number) => {
    setBalancerDeadzoneDbState(clamp(value, 0, 8));
  }, []);
  const setBalancerUpwardStrength = useCallback((value: number) => {
    setBalancerUpwardStrengthState(clamp(value, 0, 100));
  }, []);
  const setBalancerDownwardStrength = useCallback((value: number) => {
    setBalancerDownwardStrengthState(clamp(value, 0, 100));
  }, []);
  const setBalancerMaxUpwardDb = useCallback((value: number) => {
    setBalancerMaxUpwardDbState(clamp(value, 0, 20));
  }, []);
  const setBalancerMaxDownwardDb = useCallback((value: number) => {
    setBalancerMaxDownwardDbState(clamp(value, -30, 0));
  }, []);
  const setBalancerSpeed = useCallback((value: number) => {
    setBalancerSpeedState(clamp(value, 0, 100));
  }, []);
  const setBalancerNoiseFloorDb = useCallback((value: number) => {
    setBalancerNoiseFloorDbState(clamp(value, -80, -25));
  }, []);
  const setBalancerLookaheadMs = useCallback((value: number) => {
    setBalancerLookaheadMsState(clamp(value, 1, 10));
  }, []);
  const setBalancerCeilingDb = useCallback((value: number) => {
    setBalancerCeilingDbState(clamp(value, -6, -0.1));
  }, []);
  const setBalancerUseKWeight = useCallback((value: boolean) => {
    setBalancerUseKWeightState(Boolean(value));
  }, []);
  const toggleBalancerKWeight = useCallback(() => {
    setBalancerUseKWeightState((prev) => !prev);
  }, []);

  const applyBalancerCustomValues = useCallback((vals: typeof BALANCER_TEMPLATES.normal) => {
    setBalancerTargetDbState(vals.targetDb);
    setBalancerDeadzoneDbState(vals.deadzoneDb);
    setBalancerUpwardStrengthState(vals.upwardStrength);
    setBalancerDownwardStrengthState(vals.downwardStrength);
    setBalancerMaxUpwardDbState(vals.maxUpwardDb);
    setBalancerMaxDownwardDbState(vals.maxDownwardDb);
    setBalancerSpeedState(vals.speed);
    setBalancerNoiseFloorDbState(vals.noiseFloorDb);
    setBalancerLookaheadMsState(vals.lookaheadMs);
    setBalancerCeilingDbState(vals.ceilingDb);
    setBalancerUseKWeightState(vals.useKWeight);
  }, []);

  const applyBalancerTemplate = useCallback((template: BalancerTemplate) => {
    const preset = BALANCER_TEMPLATES[template];
    if (!preset) return;
    applyBalancerCustomValues(preset);
    setBalancerModeState('custom');
    setFxEnabled((prev) => {
      if (prev.comp) return prev;
      const next = { ...prev, comp: true };
      fxEnabledRef.current = next;
      return next;
    });
  }, [applyBalancerCustomValues]);

  const resetBalancer = useCallback(() => {
    setBalancerModeState(BALANCER_DEFAULTS.mode);
    setBalancerOffsetState(BALANCER_DEFAULTS.offset);
    applyBalancerCustomValues(BALANCER_DEFAULTS);
  }, [applyBalancerCustomValues]);

  const toggleLoudnessNormalization = useCallback(() => setLoudnessNormalization(prev => !prev), []);
  const toggleUseOversample = useCallback(() => setUseOversample(prev => !prev), []);
  const setPreampGain = useCallback((value: number) => setPreampGainState(clampPreampGain(value)), []);

  const applyPreset = useCallback((presetName: string) => {
    setEqPresetName(presetName);
    if (EQ_PRESETS[presetName as keyof typeof EQ_PRESETS]) {
      setEqBands(createEqBands(EQ_PRESETS[presetName as keyof typeof EQ_PRESETS]));
      setBassGain(0);
      setTrebleGain(0);
      setPreampGain(0);
    }
  }, [setPreampGain]);

  const applyStylisticPreset = useCallback((presetName: string) => {
    const preset = PRECOMPUTED_STYLISTIC_PRESETS[presetName];
    if (preset) {
      setEqPresetName(presetName);
      if (preset.isParametric) {
        setEqBands(preset.bands as EqBand[]);
      } else {
        const bandKey = `${eqBandCount}_BANDS` as keyof typeof EQ_PRESETS;
        const freqs = EQ_PRESETS[bandKey] || EQ_PRESETS['10_BANDS'];
        const gains = preset.precomputedGains[bandKey] || preset.precomputedGains['10_BANDS'];
        setEqBands(createEqBands(freqs, gains));
      }
      setBassGain(preset.bassGain);
      setTrebleGain(preset.trebleGain);
      setPreampGain(preset.preampGain);
    }
  }, [setPreampGain, eqBandCount]);

  const isCurrentParametricEq = useCallback(() => {
    const currentPreset = customEqPresets.find(p => p.name === eqPresetName);
    const precomputedPreset = PRECOMPUTED_STYLISTIC_PRESETS[eqPresetName];
    return eqPresetName === 'PARAMETRIC'
      || currentPreset?.presetMode === 'parametric'
      || Boolean(currentPreset?.isCustomOrigin && hasParametricBandSettings(currentPreset.bands))
      || Boolean(precomputedPreset?.isParametric);
  }, [customEqPresets, eqPresetName]);

  const checkAndSwitchToCustom = useCallback(() => {
    setEqPresetName(prev => {
      if (prev === 'CUSTOM' || prev === 'PARAMETRIC') return prev;
      const isCustom = customEqPresets.some(p => p.name === prev);
      if (isCustom) return prev;

      const precomputedPreset = PRECOMPUTED_STYLISTIC_PRESETS[prev];
      return precomputedPreset?.isParametric ? 'PARAMETRIC' : 'CUSTOM';
    });
  }, [customEqPresets]);

  const setCustomPreset = useCallback(() => {
    setEqPresetName('CUSTOM');
    setEqBands(prev => applyGraphicEqQ(prev));
  }, []);
  const setParametricPreset = useCallback(() => {
    disableInterpolation();
    setEqPresetName('PARAMETRIC');
  }, [disableInterpolation]);
  const saveCustomPreset = useCallback((name: string) => {
    setCustomEqPresets(prev => {
      const currentPreset = prev.find(p => p.name === eqPresetName);
      const presetMode: CustomEqPreset['presetMode'] = eqPresetName === 'PARAMETRIC'
        || currentPreset?.presetMode === 'parametric'
        || (currentPreset?.isCustomOrigin && hasParametricBandSettings(currentPreset.bands))
        || hasParametricBandSettings(eqBands)
        ? 'parametric'
        : eqPresetName === 'CUSTOM' || currentPreset?.presetMode === 'custom'
          ? 'custom'
          : undefined;
      const newPreset: CustomEqPreset = {
        name,
        bands: eqBands.map(band => ({ ...band })),
        isCustomOrigin: presetMode === 'custom' || presetMode === 'parametric',
        presetMode,
        preampGain,
        bassGain,
        trebleGain
      };
      const existingIndex = prev.findIndex(p => p.name === name);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = newPreset;
        return next;
      }
      return [...prev, newPreset];
    });
  }, [bassGain, eqBands, eqPresetName, preampGain, trebleGain]);
  const applyCustomSavedPreset = useCallback((name: string) => {
    setEqPresetName(name);
    setCustomEqPresets(prev => {
      const preset = prev.find(p => p.name === name);
      if (preset) {
        const isParametricPreset = preset.presetMode === 'parametric'
          || Boolean(preset.isCustomOrigin && hasParametricBandSettings(preset.bands));
        if (isParametricPreset) {
          disableInterpolation();
        } else {
          setEqBandCountState(preset.bands.length);
        }
        setEqBands(isParametricPreset
          ? preset.bands.map(band => ({ ...band }))
          : applyGraphicEqQ(preset.bands));
        if (typeof preset.preampGain === 'number') setPreampGain(preset.preampGain);
        if (typeof preset.bassGain === 'number') setBassGain(preset.bassGain);
        if (typeof preset.trebleGain === 'number') setTrebleGain(preset.trebleGain);
      }
      return prev;
    });
  }, [disableInterpolation, setPreampGain]);

  const changeEqBandCount = useCallback((newCount: number) => {
    setEqBandCountState(newCount);
    const bandKey = `${newCount}_BANDS` as keyof typeof EQ_PRESETS;

    if (PRECOMPUTED_STYLISTIC_PRESETS[eqPresetName] && !PRECOMPUTED_STYLISTIC_PRESETS[eqPresetName].isParametric) {
      const preset = PRECOMPUTED_STYLISTIC_PRESETS[eqPresetName];
      const freqs = EQ_PRESETS[bandKey] || EQ_PRESETS['10_BANDS'];
      const gains = preset.precomputedGains[bandKey] || preset.precomputedGains['10_BANDS'];
      setEqBands(createEqBands(freqs, gains));
      return;
    }

    if (!isCurrentParametricEq()) {
      setEqBands(() => {
        const freqs = EQ_PRESETS[bandKey] || EQ_PRESETS['10_BANDS'];
        return applyGraphicEqQ(createEqBands(freqs));
      });
      setEqPresetName('CUSTOM');
    }
  }, [eqPresetName, isCurrentParametricEq]);
  const renameCustomPreset = useCallback((oldName: string, newName: string) => {
    setCustomEqPresets(prev => {
      if (prev.some(p => p.name === newName)) return prev;
      return prev.map(p => p.name === oldName ? { ...p, name: newName } : p);
    });
  }, []);
  const deleteCustomPreset = useCallback((name: string) => setCustomEqPresets(prev => prev.filter(p => p.name !== name)), []);

  const addCustomEqBand = useCallback((freq?: number) => setEqBands(prev => {
    checkAndSwitchToCustom();
    const nextBands = [...prev, { id: `band_${Date.now()}`, frequency: freq || 1000, gain: 0, q: DEFAULT_PARAMETRIC_Q, channel: 'L+R' as const, type: 'peaking' as BiquadFilterType }];
    return isCurrentParametricEq() ? nextBands : applyGraphicEqQ(nextBands);
  }), [isCurrentParametricEq, checkAndSwitchToCustom]);
  const removeCustomEqBand = useCallback((id: string) => setEqBands(prev => {
    checkAndSwitchToCustom();
    const nextBands = prev.filter(b => b.id !== id);
    return isCurrentParametricEq() ? nextBands : applyGraphicEqQ(nextBands);
  }), [isCurrentParametricEq, checkAndSwitchToCustom]);
  const updateEqGain = useCallback((id: string, val: number) => {
    checkAndSwitchToCustom();
    setEqBands(prev => prev.map(b => b.id === id ? { ...b, gain: val } : b));
  }, [checkAndSwitchToCustom]);
  const updateEqBandFreq = useCallback((id: string, val: number) => {
    checkAndSwitchToCustom();
    setEqBands(prev => {
      const nextBands = prev.map(b => b.id === id ? { ...b, frequency: val } : b);
      return isCurrentParametricEq() ? nextBands : applyGraphicEqQ(nextBands);
    });
  }, [isCurrentParametricEq, checkAndSwitchToCustom]);
  const updateEqBandQ = useCallback((id: string, val: number) => {
    checkAndSwitchToCustom();
    setEqBands(prev => prev.map(b => b.id === id ? { ...b, q: clamp(val, MIN_EQ_Q, MAX_EQ_Q) } : b));
  }, [checkAndSwitchToCustom]);
  const updateEqBandChannel = useCallback((id: string, val: EqBand['channel']) => {
    checkAndSwitchToCustom();
    setEqBands(prev => prev.map(b => b.id === id ? { ...b, channel: val } : b));
  }, [checkAndSwitchToCustom]);
  const updateEqBandType = useCallback((id: string, val: BiquadFilterType) => {
    checkAndSwitchToCustom();
    setEqBands(prev => prev.map(b => b.id === id ? { ...b, type: val } : b));
  }, [checkAndSwitchToCustom]);

  const eqBandMode = eqBandCount === 0 ? 'custom' : 'fixed';

  return {
    eqPresetName, setEqPresetName, eqBandCount, eqBandMode, changeEqBandCount, eqBands, setEqBands, customEqPresets,
    preampGain, setPreampGain, updatePreampGain: setPreampGain,
    bassGain, setBassGain, updateBassGain: setBassGain,
    trebleGain, setTrebleGain, updateTrebleGain: setTrebleGain,

    balancerMode, setBalancerMode, updateBalancerMode: setBalancerMode,
    balancerOffset, setBalancerOffset, updateBalancerOffset: setBalancerOffset,
    balancerTargetDb, setBalancerTargetDb, updateBalancerTargetDb: setBalancerTargetDb,
    balancerDeadzoneDb, setBalancerDeadzoneDb, updateBalancerDeadzoneDb: setBalancerDeadzoneDb,
    balancerUpwardStrength, setBalancerUpwardStrength, updateBalancerUpwardStrength: setBalancerUpwardStrength,
    balancerDownwardStrength, setBalancerDownwardStrength, updateBalancerDownwardStrength: setBalancerDownwardStrength,
    balancerMaxUpwardDb, setBalancerMaxUpwardDb, updateBalancerMaxUpwardDb: setBalancerMaxUpwardDb,
    balancerMaxDownwardDb, setBalancerMaxDownwardDb, updateBalancerMaxDownwardDb: setBalancerMaxDownwardDb,
    balancerSpeed, setBalancerSpeed, updateBalancerSpeed: setBalancerSpeed,
    balancerNoiseFloorDb, setBalancerNoiseFloorDb, updateBalancerNoiseFloorDb: setBalancerNoiseFloorDb,
    balancerLookaheadMs, setBalancerLookaheadMs, updateBalancerLookaheadMs: setBalancerLookaheadMs,
    balancerCeilingDb, setBalancerCeilingDb, updateBalancerCeilingDb: setBalancerCeilingDb,
    balancerUseKWeight, setBalancerUseKWeight, updateBalancerUseKWeight: setBalancerUseKWeight, toggleBalancerKWeight,
    applyBalancerTemplate, resetBalancer,

    panValue, setPanValue, updatePanValue: setPanValue,
    stereoWidth, setStereoWidth, updateStereoWidth: setStereoWidth,
    stereoCrossoverLow, setStereoCrossoverLow, updateStereoCrossoverLow: setStereoCrossoverLow,
    stereoCrossoverHigh, setStereoCrossoverHigh, updateStereoCrossoverHigh: setStereoCrossoverHigh,
    stereoCrossoverMode, setStereoCrossoverMode: setStereoCrossoverModeState, updateStereoCrossoverMode: setStereoCrossoverModeState,
    surroundWet, setSurroundWet, updateSurroundWet: setSurroundWet,
    surroundDelay, setSurroundDelay, updateSurroundDelay: setSurroundDelay,
    speakerMode, setSpeakerMode, updateSpeakerMode: setSpeakerMode,
    monoThreshold, setMonoThreshold, updateMonoThreshold: setMonoThreshold,
    monoSideLevel, setMonoSideLevel, updateMonoSideLevel: setMonoSideLevel,
    chorusAmount, setChorusAmount, updateChorusAmount: setChorusAmount,
    resetStereoImager,

    reverbMix, setReverbMix, updateReverbMix: setReverbMix,
    reverbTime, setReverbTime, updateReverbTime: setReverbTime,
    reverbEngine, setReverbEngine, updateReverbEngine: setReverbEngine,
    loudnessNormalization, setLoudnessNormalization, toggleLoudnessNormalization,
    useOversample, setUseOversample, toggleUseOversample,
    precalculateOnIdle, setPrecalculateOnIdle,
    fullQueueCacheEnabled, setFullQueueCacheEnabled,
    masterFftSize, setMasterFftSize, updateMasterFftSize: setMasterFftSize,
    stereoFftSize, setStereoFftSize, updateStereoFftSize: setStereoFftSize,

    audioLatencyHint, setAudioLatencyHint, updateAudioLatencyHint: setAudioLatencyHint,
    fxEnabled, setFxEnabled, toggleFx, fxEnabledRef,
    applyPreset, applyStylisticPreset, setCustomPreset, setParametricPreset,
    saveCustomPreset, applyCustomSavedPreset, renameCustomPreset, deleteCustomPreset,
    addCustomEqBand, removeCustomEqBand,
    updateEqGain, updateEqBandFreq, updateEqBandQ, updateEqBandChannel, updateEqBandType,
    isParametricPreset: isCurrentParametricEq(),
  };
}
