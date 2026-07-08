import { useState, useCallback, useRef } from 'react';
import { COMPRESSOR_DEFAULTS, COMPRESSOR_RESET_SETTINGS, EQ_PRESETS, STYLISTIC_PRESETS } from './audioTypes';
import type { EqBand, CustomEqPreset } from './audioTypes';
import { clamp, STEREO_WIDTH_MAX_PERCENT } from './audioMath';

type FxKey = 'eq' | 'tone' | 'comp' | 'reverb' | 'master' | 'preamp' | 'limiter' | 'stereo';
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
  renderSignatureCacheEnabled: boolean;
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
  stereo: true
};

const createEqBands = (frequencies: number[], gains?: number[]): EqBand[] =>
  frequencies.map((freq, i) => ({
    id: `band_${i}`,
    frequency: freq,
    gain: gains?.[i] ?? 0,
    q: 1.41,
    channel: 'L+R',
    type: 'peaking'
  }));

export function useAudioEffectsState(savedState: SavedAudioEffectsState = {}) {
  const savedStylisticPreset = STYLISTIC_PRESETS[savedState.eqPresetName as keyof typeof STYLISTIC_PRESETS];
  const [eqPresetName, setEqPresetName] = useState<string>(savedState.eqPresetName || '10_BANDS');
  const [eqBands, setEqBands] = useState<EqBand[]>(() => {
    const initialBands = savedStylisticPreset
      ? createEqBands(savedStylisticPreset.eqBands, savedStylisticPreset.gains)
      : savedState.eqBands || createEqBands(EQ_PRESETS['10_BANDS']);
    return [...initialBands].sort((a, b) => a.frequency - b.frequency);
  });
  const [customEqPresets, setCustomEqPresets] = useState<CustomEqPreset[]>(savedState.customEqPresets || []);

  const [preampGain, setPreampGain] = useState<number>(savedStylisticPreset?.preampGain ?? savedState.preampGain ?? 0);
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
  const [renderSignatureCacheEnabled, setRenderSignatureCacheEnabled] = useState<boolean>(savedState.renderSignatureCacheEnabled ?? false);

  const initialFxEnabled: FxEnabledState = { ...DEFAULT_FX_ENABLED, ...savedState.fxEnabled };
  const [fxEnabled, setFxEnabled] = useState<FxEnabledState>(initialFxEnabled);
  const fxEnabledRef = useRef(initialFxEnabled);

  const toggleFx = useCallback((key: FxKey) => {
    setFxEnabled((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        fxEnabledRef.current = next;
        return next;
    });
  }, []);
  const setStereoWidth = useCallback((value: number) => {
    setStereoWidthState(clamp(value, 0, STEREO_WIDTH_MAX_PERCENT));
  }, []);
  const toggleLoudnessNormalization = useCallback(() => setLoudnessNormalization(prev => !prev), []);

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
  }, []);
  
  const applyStylisticPreset = useCallback((presetName: string) => {
    const preset = STYLISTIC_PRESETS[presetName as keyof typeof STYLISTIC_PRESETS];
    if (preset) {
        setEqPresetName(presetName);
        setEqBands(createEqBands(preset.eqBands, preset.gains));
        setBassGain(preset.bassGain);
        setTrebleGain(preset.trebleGain);
        setPreampGain(preset.preampGain);
    }
  }, []);
  
  const setCustomPreset = useCallback(() => setEqPresetName('CUSTOM'), []);
  const setParametricPreset = useCallback(() => setEqPresetName('PARAMETRIC'), []);
  const saveCustomPreset = useCallback((name: string) => {
    setCustomEqPresets(prev => {
      const newPreset = {
        name,
        bands: eqBands.map(band => ({ ...band })),
        isCustomOrigin: eqPresetName === 'CUSTOM' || eqPresetName === 'PARAMETRIC',
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
          setEqBands(preset.bands.map(band => ({ ...band })));
          if (typeof preset.preampGain === 'number') setPreampGain(preset.preampGain);
          if (typeof preset.bassGain === 'number') setBassGain(preset.bassGain);
          if (typeof preset.trebleGain === 'number') setTrebleGain(preset.trebleGain);
        }
        return prev;
    });
  }, []);
  const renameCustomPreset = useCallback((oldName: string, newName: string) => {
    setCustomEqPresets(prev => {
      if (prev.some(p => p.name === newName)) return prev;
      return prev.map(p => p.name === oldName ? { ...p, name: newName } : p);
    });
  }, []);
  const deleteCustomPreset = useCallback((name: string) => setCustomEqPresets(prev => prev.filter(p => p.name !== name)), []);

  const addCustomEqBand = useCallback((freq?: number) => setEqBands(prev => [...prev, { id: `band_${Date.now()}`, frequency: freq || 1000, gain: 0, q: 1.41, channel: 'L+R', type: 'peaking' }]), []);
  const removeCustomEqBand = useCallback((id: string) => setEqBands(prev => prev.filter(b => b.id !== id)), []);
  const updateEqGain = useCallback((id: string, val: number) => setEqBands(prev => prev.map(b => b.id === id ? { ...b, gain: val } : b)), []);
  const updateEqBandFreq = useCallback((id: string, val: number) => setEqBands(prev => prev.map(b => b.id === id ? { ...b, frequency: val } : b)), []);
  const updateEqBandQ = useCallback((id: string, val: number) => setEqBands(prev => prev.map(b => b.id === id ? { ...b, q: val } : b)), []);
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
    renderSignatureCacheEnabled, setRenderSignatureCacheEnabled,
    fxEnabled, setFxEnabled, toggleFx, fxEnabledRef,
    applyPreset, applyStylisticPreset, setCustomPreset, setParametricPreset,
    saveCustomPreset, applyCustomSavedPreset, renameCustomPreset, deleteCustomPreset,
    addCustomEqBand, removeCustomEqBand,
    updateEqGain, updateEqBandFreq, updateEqBandQ, updateEqBandChannel, updateEqBandType
  };
}
