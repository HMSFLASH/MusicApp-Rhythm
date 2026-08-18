import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { getAllCachedIds, removeCachedAudio, removeCachedAudios, clearCachedAudio } from '../utils/mediaCache';
import { clearCovers } from '../utils/idb';
import { loadTrackAudioUrl } from '../hooks/audioTrackLoader';
import type { Track } from '../hooks/useAudioPlayer';
import { useAuth } from './AuthContext';
import { useGlobalAudio } from './AudioContext';

interface OfflineContextType {
  isOfflineMode: boolean;
  cachedMediaIds: Set<string>;
  isCached: (track: Track) => boolean;
  downloadTrack: (track: Track) => Promise<void>;
  downloadingTrackIds: Set<string>;
  refreshCachedMediaIds: () => Promise<void>;
  removeCachedAudioTrack: (id: string) => Promise<void>;
  removeCachedAudioTracks: (ids: string[]) => Promise<void>;
  clearAllCache: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

interface OfflineProviderProps {
  readonly children: ReactNode;
}

export function OfflineProvider({ children }: OfflineProviderProps) {
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);
  const [cachedMediaIds, setCachedMediaIds] = useState<Set<string>>(new Set());
  const [downloadingTrackIds, setDownloadingTrackIds] = useState<Set<string>>(new Set());
  const { driveToken, fetchDriveToken } = useAuth();
  const { playerState } = useGlobalAudio();

  const refreshCachedMediaIds = useCallback(async () => {
    const ids = await getAllCachedIds();
    setCachedMediaIds(new Set(ids));
  }, []);

  useEffect(() => {
    void refreshCachedMediaIds();

    const handleOnline = () => setIsOfflineMode(false);
    const handleOffline = () => setIsOfflineMode(true);

    globalThis.addEventListener('online', handleOnline);
    globalThis.addEventListener('offline', handleOffline);

    return () => {
      globalThis.removeEventListener('online', handleOnline);
      globalThis.removeEventListener('offline', handleOffline);
    };
  }, [refreshCachedMediaIds]);

  const isCached = useCallback((track: Track) => {
    if (track.sourceType === 'LOCAL') return true;
    const hasNewCache = cachedMediaIds.has(String(track.id));
    const isValidDriveId = Boolean(track.driveFileId && track.driveFileId !== 'undefined' && track.driveFileId !== 'null');
    const hasOldCache = isValidDriveId ? cachedMediaIds.has(`drive:${track.driveFileId}`) : false;
    return hasNewCache || hasOldCache;
  }, [cachedMediaIds]);

  const downloadTrack = useCallback(async (track: Track) => {
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
  }, [driveToken, fetchDriveToken, isCached, playerState, refreshCachedMediaIds]);

  const removeCachedAudioTrack = useCallback(async (id: string) => {
    await removeCachedAudio(id);
    await refreshCachedMediaIds();
  }, [refreshCachedMediaIds]);

  const removeCachedAudioTracks = useCallback(async (ids: string[]) => {
    await removeCachedAudios(ids);
    await refreshCachedMediaIds();
  }, [refreshCachedMediaIds]);

  const clearAllCache = useCallback(async () => {
    await Promise.allSettled([
      clearCachedAudio(),
      clearCovers(),
    ]);
    await refreshCachedMediaIds();
  }, [refreshCachedMediaIds]);

  const value = useMemo(() => ({
    isOfflineMode,
    cachedMediaIds,
    isCached,
    downloadTrack,
    downloadingTrackIds,
    refreshCachedMediaIds,
    removeCachedAudioTrack,
    removeCachedAudioTracks,
    clearAllCache,
  }), [isOfflineMode, cachedMediaIds, isCached, downloadTrack, downloadingTrackIds, refreshCachedMediaIds, removeCachedAudioTrack, removeCachedAudioTracks, clearAllCache]);

  return (
    <OfflineContext.Provider value={value}>
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
