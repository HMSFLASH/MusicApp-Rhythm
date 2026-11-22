import type { CustomEqPreset, EqBand, QueueEndMode, SongEndMode, Track } from './audioTypes';

export const LOCAL_STORAGE_KEY = 'SONIC_DEPTH_AUDIO_CONFIG';
export const GUEST_LOCAL_STORAGE_KEY = 'SONIC_DEPTH_AUDIO_CONFIG_GUEST';
export const PLAYBACK_STORAGE_KEY = 'SONIC_DEPTH_PLAYBACK_STATE';

export const getAudioConfigStorageKey = (isAuthenticated: boolean) => (
  isAuthenticated ? LOCAL_STORAGE_KEY : GUEST_LOCAL_STORAGE_KEY
);

export interface SavedAudioConfig {
  upcomingQueues?: Track[][];
  isShuffleState?: boolean;
  songEndMode?: SongEndMode;
  queueEndMode?: QueueEndMode;
  eqPresetName?: string;
  eqBandCount?: number;
  eqBands?: EqBand[];
  customEqPresets?: CustomEqPreset[];
  volume?: number;
  playbackRate?: number;
  preservesPitch?: boolean;
  speedPitchMode?: 'simple' | 'advanced';
  sinkId?: string;
  useLegacyMetadata?: boolean;
  [key: string]: unknown;
}

export const getInitialState = (isAuthenticated = true): SavedAudioConfig => {
  try {
    const saved = localStorage.getItem(getAudioConfigStorageKey(isAuthenticated));
    if (saved) {
      const parsed = JSON.parse(saved) as SavedAudioConfig;
      if (Array.isArray(parsed.upcomingQueues)) {
        parsed.upcomingQueues = parsed.upcomingQueues.map((upQueue: Track[]) => {
          const filtered = upQueue.filter((t: Track) => t.sourceType !== 'LOCAL');
          filtered.forEach((t: Track) => {
            if (t.imageUrl?.startsWith('blob:')) t.imageUrl = '';
          });
          return filtered;
        });
      }
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load audio config', e);
  }
  return {};
};
