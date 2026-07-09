import { useMemo, useEffect, useCallback, useState } from 'react';
import { useAudioQueue } from './useAudioQueue';
import { useAudioEffectsState } from './useAudioEffectsState';
import { useAudioEngine } from './useAudioEngine';
import { getAudioConfigStorageKey, getInitialState } from './audioStorage';
import { getAudioExtension } from './audioMime';
import type { Track as AudioTrack } from './audioTypes';
export type { Track } from './audioTypes';
export { EQ_PRESETS, STYLISTIC_PRESETS } from './audioTypes';

const FLAC_WASM_TRACKS_STORAGE_KEY = 'SONIC_FLAC_WASM_TRACKS_V1';

const loadFlacWasmTrackIds = () => {
  try {
    const saved = localStorage.getItem(FLAC_WASM_TRACKS_STORAGE_KEY);
    const ids = saved ? JSON.parse(saved) : [];
    return new Set<string>(Array.isArray(ids) ? ids.map(String) : []);
  } catch {
    return new Set<string>();
  }
};

export function useAudioPlayer(isAuthenticated: boolean, driveToken?: string, fetchDriveToken?: () => Promise<string>) {
  const savedState = useMemo(() => getInitialState(isAuthenticated), [isAuthenticated]);
  const [flacWasmTrackIds, setFlacWasmTrackIds] = useState<Set<string>>(loadFlacWasmTrackIds);

  const queueState = useAudioQueue(savedState, isAuthenticated);
  const effectsState = useAudioEffectsState(savedState);
  const isFlacWasmEnabled = useCallback((track?: AudioTrack | null) => (
    Boolean(track && getAudioExtension(track.fileName) === 'flac' && flacWasmTrackIds.has(String(track.id)))
  ), [flacWasmTrackIds]);
  const toggleFlacWasmForTrack = useCallback((track: AudioTrack) => {
    if (getAudioExtension(track.fileName) !== 'flac') return;

    setFlacWasmTrackIds((previous) => {
      const next = new Set(previous);
      const trackId = String(track.id);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      localStorage.setItem(FLAC_WASM_TRACKS_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engineState = useAudioEngine(
    isAuthenticated,
    queueState as any,
    { ...effectsState, flacWasmTrackIds } as any,
    savedState,
    driveToken,
    fetchDriveToken
  );

  useEffect(() => {
    const configToSave = {
      isShuffleState: queueState.isShuffleState,
      songEndMode: queueState.songEndMode,
      queueEndMode: queueState.queueEndMode,
      repeatMode: queueState.repeatMode,
      cycleQueues: queueState.cycleQueues,
      upcomingQueues: queueState.upcomingQueues,
      
      eqPresetName: effectsState.eqPresetName,
      eqBands: effectsState.eqBands,
      customEqPresets: effectsState.customEqPresets,
      preampGain: effectsState.preampGain,
      bassGain: effectsState.bassGain,
      trebleGain: effectsState.trebleGain,
      compThreshold: effectsState.compThreshold,
      compRatio: effectsState.compRatio,
      compKnee: effectsState.compKnee,
      compAttack: effectsState.compAttack,
      compRelease: effectsState.compRelease,
      compRmsSize: effectsState.compRmsSize,
      compMakeupGain: effectsState.compMakeupGain,
      panValue: effectsState.panValue,
      stereoWidth: effectsState.stereoWidth,
      reverbMix: effectsState.reverbMix,
      reverbTime: effectsState.reverbTime,
      loudnessNormalization: effectsState.loudnessNormalization,
      useOversample: effectsState.useOversample,
      precalculateOnIdle: effectsState.precalculateOnIdle,
      renderSignatureCacheEnabled: effectsState.renderSignatureCacheEnabled,
      fxEnabled: effectsState.fxEnabled
    };
    
    // Add a simple throttle to avoid too frequent writes
    const timeoutId = setTimeout(() => {
        localStorage.setItem(getAudioConfigStorageKey(isAuthenticated), JSON.stringify(configToSave));
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    isAuthenticated,
    queueState.isShuffleState, queueState.songEndMode, queueState.queueEndMode, queueState.repeatMode,
    queueState.cycleQueues, queueState.upcomingQueues,
    effectsState.eqPresetName, effectsState.eqBands, effectsState.customEqPresets,
    effectsState.preampGain, effectsState.bassGain, effectsState.trebleGain,
    effectsState.compThreshold, effectsState.compRatio, effectsState.compKnee,
    effectsState.compAttack, effectsState.compRelease, effectsState.compRmsSize, effectsState.compMakeupGain,
    effectsState.panValue, effectsState.stereoWidth, effectsState.reverbMix, effectsState.reverbTime,
    effectsState.loudnessNormalization, effectsState.useOversample, effectsState.precalculateOnIdle,
    effectsState.renderSignatureCacheEnabled, effectsState.fxEnabled
  ]);

  return {
    ...queueState,
    ...effectsState,
    ...engineState,
    isShuffle: queueState.isShuffleState,
    loudnessNormalization: effectsState.loudnessNormalization,
    getTrackMetadata: engineState.getTrackMetadata,
    getTrackImage: engineState.getTrackImage,
    isFlacWasmEnabled,
    toggleFlacWasmForTrack,
  };
}
