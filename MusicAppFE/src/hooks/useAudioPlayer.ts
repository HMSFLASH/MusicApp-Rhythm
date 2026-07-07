import { useMemo, useEffect } from 'react';
import { useAudioQueue } from './useAudioQueue';
import { useAudioEffectsState } from './useAudioEffectsState';
import { useAudioEngine } from './useAudioEngine';
import { getInitialState, getInitialPlaybackState, LOCAL_STORAGE_KEY } from './audioStorage';
export type { Track } from './audioTypes';
export { EQ_PRESETS, STYLISTIC_PRESETS } from './audioTypes';

export function useAudioPlayer(jwtToken: string) {
  const savedState = useMemo(() => getInitialState(), []);
  const initialPlayback = useMemo(() => getInitialPlaybackState(), []);

  const queueState = useAudioQueue(initialPlayback, savedState);
  const effectsState = useAudioEffectsState(savedState);
  const engineState = useAudioEngine(jwtToken, queueState as any, effectsState as any, savedState);

  useEffect(() => {
    const configToSave = {
      isShuffleState: queueState.isShuffleState,
      songEndMode: queueState.songEndMode,
      queueEndMode: queueState.queueEndMode,
      repeatMode: queueState.repeatMode,
      continueFromLast: queueState.continueFromLast,
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
      compMakeupGain: effectsState.compMakeupGain,
      panValue: effectsState.panValue,
      stereoWidth: effectsState.stereoWidth,
      reverbMix: effectsState.reverbMix,
      reverbTime: effectsState.reverbTime,
      loudnessNormalization: effectsState.loudnessNormalization,
      useOversample: effectsState.useOversample,
      precalculateOnIdle: effectsState.precalculateOnIdle,
      fxEnabled: effectsState.fxEnabled
    };
    
    // Add a simple throttle to avoid too frequent writes
    const timeoutId = setTimeout(() => {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(configToSave));
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    queueState.isShuffleState, queueState.songEndMode, queueState.queueEndMode, queueState.repeatMode,
    queueState.continueFromLast, queueState.cycleQueues, queueState.upcomingQueues,
    effectsState.eqPresetName, effectsState.eqBands, effectsState.customEqPresets,
    effectsState.preampGain, effectsState.bassGain, effectsState.trebleGain,
    effectsState.compThreshold, effectsState.compRatio, effectsState.compKnee,
    effectsState.compAttack, effectsState.compRelease, effectsState.compMakeupGain,
    effectsState.panValue, effectsState.stereoWidth, effectsState.reverbMix, effectsState.reverbTime,
    effectsState.loudnessNormalization, effectsState.useOversample, effectsState.precalculateOnIdle,
    effectsState.fxEnabled
  ]);

  return {
    ...queueState,
    ...effectsState,
    ...engineState,
    isShuffle: queueState.isShuffleState,
    loudnessNormalization: effectsState.loudnessNormalization,
    getTrackMetadata: engineState.getTrackMetadata,
    getTrackImage: engineState.getTrackImage,
  };
}
