import { useState, useCallback, useRef } from 'react';
import { COMPRESSOR_DEFAULTS, COMPRESSOR_RESET_SETTINGS, EQ_PRESETS, STYLISTIC_PRESETS } from './audioTypes';
import type { EqBand, CustomEqPreset } from './audioTypes';
import { clamp, STEREO_WIDTH_MAX_PERCENT } from './audioMath';

type FxKey = 'eq' | 'tone' | 'comp' | 'reverb' | 'master' | 'preamp' | 'limiter' | 'stereo' | 'interpolate';
type FxEnabledState = Record<FxKey, boolean>;

type SavedAudioEffectsState = Partial<{
  eqPresetName: string;
  eqBands: EqBand[];
  customEqPresets: CustomEqPreset[];
  preampGain: number;
  bassGain: number;
  trebleGain: number;
  compThreshold: number;
  compRatio: number;
  compKnee: number;
  compAttack: number;
  compRelease: number;
  compRmsSize: number;
  compMakeupGain: number;
  panValue: number;
  stereoWidth: number;
  reverbMix: number;
  reverbTime: number;
  loudnessNormalization: boolean;
  useOversample: boolean;
  precalculateOnIdle: boolean;
  fullQueueCacheEnabled: boolean;
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
  const maxFreq = 20000; // Safe upper bound for UI
  const fc = clamp(frequencies[index], minFreq, maxFreq);
  if (!fc) return DEFAULT_PARAMETRIC_Q;

  let fPrev = frequencies[index - 1];
  let fNext = frequencies[index + 1];

  if (!fPrev && !fNext) return DEFAULT_PARAMETRIC_Q;

  // 0. Minimum spacing check
  if (fNext && fNext / fc < 1.03) return DEFAULT_PARAMETRIC_Q;
  if (fPrev && fc / fPrev < 1.03) return DEFAULT_PARAMETRIC_Q;

  // 1. Mirror log spacing for boundaries
  if (!fPrev && fNext) {
    fPrev = (fc * fc) / fNext;
  }
  if (!fNext && fPrev) {
    fNext = (fc * fc) / fPrev;
  }

  // 2. Geometric boundaries
  let fL = Math.sqrt(fPrev * fc);
  let fH = Math.sqrt(fc * fNext);

  // 3. Clamp into audible range
  fL = clamp(fL, minFreq, maxFreq);
  fH = clamp(fH, minFreq, maxFreq);

  // Fallback if clamp or bad custom input ruins the boundaries
  if (!(fL < fc && fc < fH)) {
    return DEFAULT_PARAMETRIC_Q;
  }

  // 4. Calculate bandwidth
  const leftBW = Math.log2(fc / fL);
  const rightBW = Math.log2(fH / fc);
  let totalBW = leftBW + rightBW;

  const minBW = 1 / 24; // 1/24 octave
  totalBW = Math.max(totalBW, minBW);

  // Custom Smooth Factor (1.0 = default)
  totalBW *= 1.0;

  let q = bandwidthToQ(totalBW);

  if (!Number.isFinite(q)) return DEFAULT_PARAMETRIC_Q;

  // 5. Asymmetry Protection (Soft Transition)
  const asymmetry = Math.max(leftBW, rightBW) / Math.max(0.001, Math.min(leftBW, rightBW));
  const asymFactor = asymmetryQFactor(asymmetry);
  if (Number.isFinite(asymFactor)) {
    q *= asymFactor;
  }

  // Smooth EQ Clamping
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
  const [eqPresetName, setEqPresetName] = useState<string>(savedState.eqPresetName || '10_BANDS');
  const [eqBands, setEqBands] = useState<EqBand[]>(() => {
    const initialBands = savedStylisticPreset
      ? ('bands' in savedStylisticPreset)
        ? (savedStylisticPreset.bands as EqBand[])
        : createEqBands((savedStylisticPreset as any).eqBands, (savedStylisticPreset as any).gains)
      : savedState.eqBands
        ? initialPresetIsParametric
          ? savedState.eqBands
          : applyGraphicEqQ(savedState.eqBands)
        : createEqBands(EQ_PRESETS['10_BANDS']);
    return [...initialBands].sort((a, b) => a.frequency - b.frequency);
  });
  const [customEqPresets, setCustomEqPresets] = useState<CustomEqPreset[]>(savedState.customEqPresets || []);

  const [preampGain, setPreampGainState] = useState<number>(
    clampPreampGain(savedStylisticPreset?.preampGain ?? savedState.preampGain ?? 0)
  );
  const [bassGain, setBassGain] = useState<number>(savedStylisticPreset?.bassGain ?? savedState.bassGain ?? 0);
  const [trebleGain, setTrebleGain] = useState<number>(savedStylisticPreset?.trebleGain ?? savedState.trebleGain ?? 0);

  const [compThreshold, setCompThreshold] = useState<number>(savedState.compThreshold ?? COMPRESSOR_DEFAULTS.threshold);
  const [compRatio, setCompRatio] = useState<number>(savedState.compRatio ?? COMPRESSOR_DEFAULTS.ratio);
  const [compKnee, setCompKnee] = useState<number>(savedState.compKnee ?? COMPRESSOR_DEFAULTS.knee);
  const [compAttack, setCompAttack] = useState<number>(savedState.compAttack ?? COMPRESSOR_DEFAULTS.attack);
  const [compRelease, setCompRelease] = useState<number>(savedState.compRelease ?? COMPRESSOR_DEFAULTS.release);
  const [compRmsSize, setCompRmsSize] = useState<number>(savedState.compRmsSize ?? COMPRESSOR_DEFAULTS.rmsSize);
  const [compMakeupGain, setCompMakeupGain] = useState<number>(savedState.compMakeupGain ?? COMPRESSOR_DEFAULTS.makeupGain);

  const [panValue, setPanValue] = useState<number>(savedState.panValue ?? 0);
  const [stereoWidth, setStereoWidthState] = useState<number>(
    clamp(savedState.stereoWidth ?? 100, 0, STEREO_WIDTH_MAX_PERCENT)
  );
  const [reverbMix, setReverbMix] = useState<number>(savedState.reverbMix ?? 0);
  const [reverbTime, setReverbTime] = useState<number>(savedState.reverbTime ?? 2);

  const [loudnessNormalization, setLoudnessNormalization] = useState<boolean>(savedState.loudnessNormalization ?? true);
  const [useOversample, setUseOversample] = useState<boolean>(savedState.useOversample ?? false);
  const [precalculateOnIdle, setPrecalculateOnIdle] = useState<boolean>(savedState.precalculateOnIdle ?? false);
  const [fullQueueCacheEnabled, setFullQueueCacheEnabled] = useState<boolean>(savedState.fullQueueCacheEnabled ?? false);

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
  const setStereoWidth = useCallback((value: number) => {
    setStereoWidthState(clamp(value, 0, STEREO_WIDTH_MAX_PERCENT));
  }, []);
  const toggleLoudnessNormalization = useCallback(() => setLoudnessNormalization(prev => !prev), []);
  const setPreampGain = useCallback((value: number) => setPreampGainState(clampPreampGain(value)), []);

  const setCompressorSettings = useCallback((settings: typeof COMPRESSOR_DEFAULTS, enabled = true) => {
    setCompThreshold(settings.threshold);
    setCompRatio(settings.ratio);
    setCompKnee(settings.knee);
    setCompAttack(settings.attack);
    setCompRelease(settings.release);
    setCompRmsSize(settings.rmsSize);
    setCompMakeupGain(settings.makeupGain);

    setFxEnabled((prev) => {
      const next = { ...prev, comp: enabled };
      fxEnabledRef.current = next;
      return next;
    });
  }, []);

  const applyDefaultCompressor = useCallback(() => {
    setCompressorSettings(COMPRESSOR_DEFAULTS, true);
  }, [setCompressorSettings]);

  const resetCompressor = useCallback(() => {
    setCompressorSettings(COMPRESSOR_RESET_SETTINGS, false);
  }, [setCompressorSettings]);

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
    const preset = STYLISTIC_PRESETS[presetName as keyof typeof STYLISTIC_PRESETS];
    if (preset) {
      setEqPresetName(presetName);
      if ('bands' in preset) {
        setEqBands(preset.bands as EqBand[]);
      } else {
        setEqBands(createEqBands((preset as any).eqBands, (preset as any).gains));
      }
      setBassGain(preset.bassGain);
      setTrebleGain(preset.trebleGain);
      setPreampGain(preset.preampGain);
    }
  }, [setPreampGain]);

  const isCurrentParametricEq = useCallback(() => {
    const currentPreset = customEqPresets.find(p => p.name === eqPresetName);
    const currentStylisticPreset = STYLISTIC_PRESETS[eqPresetName as keyof typeof STYLISTIC_PRESETS];
    return eqPresetName === 'PARAMETRIC'
      || currentPreset?.presetMode === 'parametric'
      || Boolean(currentPreset?.isCustomOrigin && hasParametricBandSettings(currentPreset.bands))
      || Boolean(currentStylisticPreset && 'bands' in currentStylisticPreset);
  }, [customEqPresets, eqPresetName]);

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
        if (isParametricPreset) disableInterpolation();
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
  const renameCustomPreset = useCallback((oldName: string, newName: string) => {
    setCustomEqPresets(prev => {
      if (prev.some(p => p.name === newName)) return prev;
      return prev.map(p => p.name === oldName ? { ...p, name: newName } : p);
    });
  }, []);
  const deleteCustomPreset = useCallback((name: string) => setCustomEqPresets(prev => prev.filter(p => p.name !== name)), []);

  const addCustomEqBand = useCallback((freq?: number) => setEqBands(prev => {
    const nextBands = [...prev, { id: `band_${Date.now()}`, frequency: freq || 1000, gain: 0, q: DEFAULT_PARAMETRIC_Q, channel: 'L+R' as const, type: 'peaking' as BiquadFilterType }];
    return isCurrentParametricEq() ? nextBands : applyGraphicEqQ(nextBands);
  }), [isCurrentParametricEq]);
  const removeCustomEqBand = useCallback((id: string) => setEqBands(prev => {
    const nextBands = prev.filter(b => b.id !== id);
    return isCurrentParametricEq() ? nextBands : applyGraphicEqQ(nextBands);
  }), [isCurrentParametricEq]);
  const updateEqGain = useCallback((id: string, val: number) => setEqBands(prev => prev.map(b => b.id === id ? { ...b, gain: val } : b)), []);
  const updateEqBandFreq = useCallback((id: string, val: number) => setEqBands(prev => {
    const nextBands = prev.map(b => b.id === id ? { ...b, frequency: val } : b);
    return isCurrentParametricEq() ? nextBands : applyGraphicEqQ(nextBands);
  }), [isCurrentParametricEq]);
  const updateEqBandQ = useCallback((id: string, val: number) => setEqBands(prev => prev.map(b => b.id === id ? { ...b, q: clamp(val, MIN_EQ_Q, MAX_EQ_Q) } : b)), []);
  const updateEqBandChannel = useCallback((id: string, val: EqBand['channel']) => setEqBands(prev => prev.map(b => b.id === id ? { ...b, channel: val } : b)), []);
  const updateEqBandType = useCallback((id: string, val: BiquadFilterType) => setEqBands(prev => prev.map(b => b.id === id ? { ...b, type: val } : b)), []);

  return {
    eqPresetName, eqBands, customEqPresets,
    preampGain, setPreampGain, updatePreampGain: setPreampGain,
    bassGain, setBassGain, updateBassGain: setBassGain,
    trebleGain, setTrebleGain, updateTrebleGain: setTrebleGain,
    compThreshold, setCompThreshold, updateCompThreshold: setCompThreshold,
    compRatio, setCompRatio, updateCompRatio: setCompRatio,
    compKnee, setCompKnee, updateCompKnee: setCompKnee,
    compAttack, setCompAttack, updateCompAttack: setCompAttack,
    compRelease, setCompRelease, updateCompRelease: setCompRelease,
    compRmsSize, setCompRmsSize, updateCompRmsSize: setCompRmsSize,
    compMakeupGain, setCompMakeupGain, updateCompMakeupGain: setCompMakeupGain,
    applyDefaultCompressor, resetCompressor,
    panValue, setPanValue, updatePanValue: setPanValue,
    stereoWidth, setStereoWidth, updateStereoWidth: setStereoWidth,
    reverbMix, setReverbMix, updateReverbMix: setReverbMix,
    reverbTime, setReverbTime, updateReverbTime: setReverbTime,
    loudnessNormalization, setLoudnessNormalization, toggleLoudnessNormalization,
    useOversample, setUseOversample,
    precalculateOnIdle, setPrecalculateOnIdle,
    fullQueueCacheEnabled, setFullQueueCacheEnabled,
    fxEnabled, setFxEnabled, toggleFx, fxEnabledRef,
    applyPreset, applyStylisticPreset, setCustomPreset, setParametricPreset,
    saveCustomPreset, applyCustomSavedPreset, renameCustomPreset, deleteCustomPreset,
    addCustomEqBand, removeCustomEqBand,
    updateEqGain, updateEqBandFreq, updateEqBandQ, updateEqBandChannel, updateEqBandType,
    isParametricPreset: isCurrentParametricEq(),
  };
}
