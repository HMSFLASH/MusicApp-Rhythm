import { useAudioContext } from './useAudioContext';
import { useAudioMetadata } from './useAudioMetadata';
import { useAudioPlayback } from './useAudioPlayback';
import type { useAudioQueue } from './useAudioQueue';
import type { useAudioEffectsState } from './useAudioEffectsState';
import type { SavedAudioConfig } from './audioStorage';

type AudioEngineEffectsState = ReturnType<typeof useAudioEffectsState> & {
  flacWasmOverrides?: Record<string, boolean>;
  m4aWasmOverrides?: Record<string, boolean>;
  legacyMetadataOverrides?: Record<string, boolean>;
  useLegacyMetadata?: boolean;
};

export function useAudioEngine(
  isAuthenticated: boolean,
  queueState: ReturnType<typeof useAudioQueue>,
  effectsState: AudioEngineEffectsState,
  savedState: SavedAudioConfig,
  driveToken?: string,
  fetchDriveToken?: () => Promise<string>
) {
  const metadataState = useAudioMetadata(isAuthenticated, queueState, {
    legacyMetadataOverrides: effectsState.legacyMetadataOverrides,
    useLegacyMetadata: effectsState.useLegacyMetadata,
  });

  const contextState = useAudioContext({
    ...effectsState,
    isAuthenticated,
  });

  const playbackState = useAudioPlayback(
    isAuthenticated,
    queueState,
    effectsState,
    contextState,
    metadataState,
    savedState,
    driveToken,
    fetchDriveToken
  );

  return {
    ...playbackState,
    extractMetadata: metadataState.extractMetadata,
    clearTrackCachedMetadata: metadataState.clearTrackCachedMetadata,
    loadCoverFromCache: metadataState.loadCoverFromCache,
    getTrackMetadata: (id: string) => metadataState.metadataCacheRef.current.get(id),
    getTrackImage: (id: string) => metadataState.imageCacheRef.current.get(id),
    refreshTrackMetadataFromDrive: metadataState.refreshTrackMetadataFromDrive,
    metadataVersion: metadataState.metadataVersion,
    eqResponseData: contextState.eqResponseData,
    masterAnalyserRef: contextState.masterAnalyserRef,
    subscribeBalancerTelemetry: contextState.subscribeBalancerTelemetry,
  };
}
