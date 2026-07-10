import { useAudioContext } from './useAudioContext';
import { useAudioMetadata } from './useAudioMetadata';
import { useAudioPlayback } from './useAudioPlayback';
import type { useAudioQueue } from './useAudioQueue';
import type { useAudioEffectsState } from './useAudioEffectsState';

export function useAudioEngine(
  isAuthenticated: boolean,
  queueState: ReturnType<typeof useAudioQueue>,
  effectsState: ReturnType<typeof useAudioEffectsState>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  savedState: any,
  driveToken?: string,
  fetchDriveToken?: () => Promise<string>
) {
  const metadataState = useAudioMetadata(isAuthenticated, queueState);
  const currentTrack = queueState.currentTrack;
  const currentTrackMetadata = currentTrack
    ? metadataState.metadataCacheRef.current.get(String(currentTrack.id))
    : undefined;
  const currentTrackChannelCount = currentTrack?.numberOfChannels ?? currentTrackMetadata?.numberOfChannels;
  const contextState = useAudioContext({
    ...effectsState,
    audioIsStereo: currentTrackChannelCount == null ? true : currentTrackChannelCount >= 2,
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
    getTrackMetadata: (id: string) => metadataState.metadataCacheRef.current.get(id),
    getTrackImage: (id: string) => metadataState.imageCacheRef.current.get(id),
    metadataVersion: metadataState.metadataVersion
  };
}
