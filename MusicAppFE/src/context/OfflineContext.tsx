import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getAllCachedIds } from '../utils/mediaCache';
import { loadTrackAudioUrl } from '../hooks/audioTrackLoader';
import type { Track } from '../hooks/useAudioPlayer';
import { useAuth } from './AuthContext';
import { useGlobalAudio } from './AudioContext';

interface OfflineContextType {
  isOfflineMode: boolean;
  toggleOfflineMode: () => void;
  cachedMediaIds: Set<string>;
  isCached: (track: Track) => boolean;
  downloadTrack: (track: Track) => Promise<void>;
  downloadingTrackIds: Set<string>;
  refreshCachedMediaIds: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

const OFFLINE_STORAGE_KEY = 'SONIC_OFFLINE_MODE';

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOfflineMode, setIsOfflineMode] = useState(() => {
    return localStorage.getItem(OFFLINE_STORAGE_KEY) === 'true';
  });
  const [cachedMediaIds, setCachedMediaIds] = useState<Set<string>>(new Set());
  const [downloadingTrackIds, setDownloadingTrackIds] = useState<Set<string>>(new Set());
  const { driveToken, fetchDriveToken } = useAuth();
  const { playerState } = useGlobalAudio();

  const refreshCachedMediaIds = async () => {
    const ids = await getAllCachedIds();
    setCachedMediaIds(new Set(ids));
  };

  useEffect(() => {
    void refreshCachedMediaIds();
  }, []);

  const toggleOfflineMode = () => {
    setIsOfflineMode((prev) => {
      const next = !prev;
      localStorage.setItem(OFFLINE_STORAGE_KEY, next ? 'true' : 'false');
      return next;
    });
  };

  const isCached = (track: Track) => {
    if (track.sourceType === 'LOCAL') return true;
    if (!track.driveFileId) return false;
    return cachedMediaIds.has(`drive:${track.driveFileId}`);
  };

  const downloadTrack = async (track: Track) => {
    if (track.sourceType === 'LOCAL') return;
    if (isCached(track)) return;
    const trackId = String(track.id);

    setDownloadingTrackIds((prev) => new Set(prev).add(trackId));
    try {
      // Force loading from network and cache it
      const tempCache = new Map<string, string>();
      const tempPromises = new Map<string, Promise<string>>();
      const url = await loadTrackAudioUrl({
        track,
        blobCache: tempCache,
        blobLoadingPromises: tempPromises,
        driveToken,
        fetchDriveToken,
        forceReloadFromDrive: true,
      });
      if (url) {
        URL.revokeObjectURL(url);
      }
      
      // Extract metadata so it is cached in IndexedDB
      if (playerState.extractMetadata) {
        await playerState.extractMetadata(track);
      }
      
      await refreshCachedMediaIds();
    } catch (e) {
      console.error('Failed to download track', e);
    } finally {
      setDownloadingTrackIds((prev) => {
        const next = new Set(prev);
        next.delete(trackId);
        return next;
      });
    }
  };

  return (
    <OfflineContext.Provider
      value={{
        isOfflineMode,
        toggleOfflineMode,
        cachedMediaIds,
        isCached,
        downloadTrack,
        downloadingTrackIds,
        refreshCachedMediaIds
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOffline() {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}
