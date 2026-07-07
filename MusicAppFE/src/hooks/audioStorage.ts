export const LOCAL_STORAGE_KEY = 'SONIC_DEPTH_AUDIO_CONFIG';
export const PLAYBACK_STORAGE_KEY = 'SONIC_DEPTH_PLAYBACK_STATE';

export const getInitialState = () => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
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

export const getInitialPlaybackState = () => {
  try {
    const saved = localStorage.getItem(PLAYBACK_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);

      if (parsed.queue) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parsed.queue = parsed.queue.filter((t: any) => t.sourceType !== 'LOCAL');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parsed.queue.forEach((t: any) => {
          if (t.imageUrl?.startsWith('blob:')) t.imageUrl = '';
        });
      }

      if (parsed.currentTrack) {
        if (parsed.currentTrack.sourceType === 'LOCAL') {
          parsed.currentTrack = parsed.queue.length > 0 ? parsed.queue[0] : null;
        } else if (parsed.currentTrack.imageUrl?.startsWith('blob:')) {
          parsed.currentTrack.imageUrl = '';
        }
      }

      return parsed;
    }
  } catch (e) {
    console.error('Failed to load playback state', e);
  }
  return { currentTrack: null, queue: [] };
};
