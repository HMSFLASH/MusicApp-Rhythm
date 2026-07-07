import { useAudioContext } from './useAudioContext';
import { useAudioMetadata } from './useAudioMetadata';
import { useAudioPlayback } from './useAudioPlayback';
import type { useAudioQueue } from './useAudioQueue';
import type { useAudioEffectsState } from './useAudioEffectsState';

export function useAudioEngine(
  jwtToken: string,
  queueState: ReturnType<typeof useAudioQueue>,
  effectsState: ReturnType<typeof useAudioEffectsState>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  savedState: any
) {
  const contextState = useAudioContext(effectsState);
  
  const metadataState = useAudioMetadata(jwtToken, queueState);

  const playbackState = useAudioPlayback(
    jwtToken,
    queueState,
    effectsState,
    contextState,
    metadataState,
    savedState
  );

  return {
    ...playbackState,
    getTrackMetadata: (id: number | string) => metadataState.metadataCacheRef.current.get(String(id)),
    getTrackImage: (id: number | string) => metadataState.imageCacheRef.current.get(String(id))
  };
}