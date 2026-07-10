import { useMemo, useEffect, useCallback, useState } from 'react';
import { useAudioQueue } from './useAudioQueue';
import { useAudioEffectsState } from './useAudioEffectsState';
import { useAudioEngine } from './useAudioEngine';
import { getAudioConfigStorageKey, getInitialState } from './audioStorage';
import { getAudioExtension, getDefaultLegacyMetadataParser, shouldUseLegacyMetadataParser } from './audioMime';
import type { Track as AudioTrack } from './audioTypes';
import { db } from '../lib/db';
export type { Track } from './audioTypes';
export { EQ_PRESETS, STYLISTIC_PRESETS } from './audioTypes';

const FLAC_WASM_TRACKS_STORAGE_KEY = 'SONIC_FLAC_WASM_TRACKS_V1';
const LEGACY_METADATA_TRACKS_STORAGE_KEY = 'SONIC_LEGACY_METADATA_TRACKS_V1';

export function useAudioPlayer(isAuthenticated: boolean, driveToken?: string, fetchDriveToken?: () => Promise<string>) {
  const savedState = useMemo(() => getInitialState(isAuthenticated), [isAuthenticated]);
  const [flacWasmOverrides, setFlacWasmOverrides] = useState<Record<string, boolean>>({});
  const [legacyMetadataOverrides, setLegacyMetadataOverrides] = useState<Record<string, boolean>>({});

  const queueState = useAudioQueue(savedState, isAuthenticated);
  const effectsState = useAudioEffectsState(savedState);
  useEffect(() => {
    let cancelled = false;
    void db.get<Record<string, boolean> | string[]>(FLAC_WASM_TRACKS_STORAGE_KEY)
      .then((saved) => {
        if (cancelled || !saved) return;
        const normalized = Array.isArray(saved)
          ? Object.fromEntries(saved.map((id) => [String(id), true]))
          : saved;
        setFlacWasmOverrides(normalized);
      })
      .catch((error) => console.warn('[Audio] Failed to load FLAC WASM settings', error));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void db.get<Record<string, boolean>>(LEGACY_METADATA_TRACKS_STORAGE_KEY)
      .then((saved) => {
        if (cancelled || !saved) return;
        setLegacyMetadataOverrides(saved);
      })
      .catch((error) => console.warn('[Audio] Failed to load legacy metadata settings', error));

    return () => {
      cancelled = true;
    };
  }, []);

  const isFlacWasmEnabled = useCallback((track?: AudioTrack | null) => {
    if (!track || getAudioExtension(track.fileName) !== 'flac') return false;
    const trackId = String(track.id);
    return Boolean(flacWasmOverrides[trackId]);
  }, [flacWasmOverrides]);
  const toggleFlacWasmForTrack = useCallback((track: AudioTrack) => {
    if (getAudioExtension(track.fileName) !== 'flac') return;

    const trackId = String(track.id);
    const nextEnabled = !isFlacWasmEnabled(track);

    setFlacWasmOverrides((previous) => {
      const next = { ...previous, [trackId]: nextEnabled };
      void db.set(FLAC_WASM_TRACKS_STORAGE_KEY, next)
        .catch((error) => console.warn('[Audio] Failed to save FLAC WASM settings', error));
      return next;
    });
  }, [isFlacWasmEnabled]);

  const isLegacyMetadataEnabled = useCallback((track?: AudioTrack | null) => (
    shouldUseLegacyMetadataParser(track, legacyMetadataOverrides)
  ), [legacyMetadataOverrides]);

  const toggleLegacyMetadataForTrack = useCallback((track: AudioTrack) => {
    const trackId = String(track.id);
    const nextEnabled = !isLegacyMetadataEnabled(track);

    setLegacyMetadataOverrides((previous) => {
      const next = { ...previous };
      if (nextEnabled === getDefaultLegacyMetadataParser(track)) {
        delete next[trackId];
      } else {
        next[trackId] = nextEnabled;
      }
      void db.set(LEGACY_METADATA_TRACKS_STORAGE_KEY, next)
        .catch((error) => console.warn('[Audio] Failed to save legacy metadata settings', error));
      return next;
    });
  }, [isLegacyMetadataEnabled]);

  const engineState = useAudioEngine(
    isAuthenticated,
    queueState as Parameters<typeof useAudioEngine>[1],
    { ...effectsState, flacWasmOverrides, legacyMetadataOverrides } as Parameters<typeof useAudioEngine>[2],
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
      fullQueueCacheEnabled: effectsState.fullQueueCacheEnabled,
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
    effectsState.fullQueueCacheEnabled, effectsState.fxEnabled
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
    isLegacyMetadataEnabled,
    toggleLegacyMetadataForTrack,
  };
}
