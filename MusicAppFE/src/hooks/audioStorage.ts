export const LOCAL_STORAGE_KEY = 'SONIC_DEPTH_AUDIO_CONFIG';
export const GUEST_LOCAL_STORAGE_KEY = 'SONIC_DEPTH_AUDIO_CONFIG_GUEST';
export const PLAYBACK_STORAGE_KEY = 'SONIC_DEPTH_PLAYBACK_STATE';

export const getAudioConfigStorageKey = (isAuthenticated: boolean) => (
  isAuthenticated ? LOCAL_STORAGE_KEY : GUEST_LOCAL_STORAGE_KEY
);

export const getInitialState = (isAuthenticated = true) => {
  try {
    const saved = localStorage.getItem(getAudioConfigStorageKey(isAuthenticated));
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.upcomingQueues) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parsed.upcomingQueues = parsed.upcomingQueues.map((upQueue: any[]) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const filtered = upQueue.filter((t: any) => t.sourceType !== 'LOCAL');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          filtered.forEach((t: any) => {
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
