import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { axiosClient } from '../api/axiosClient';
import { useAuth } from './AuthContext';
import type { Track } from '../hooks/useAudioPlayer';
import { db } from '../lib/db';
import { removeCachedAudio } from '../utils/mediaCache';

interface LibraryContextType {
  tracks: Track[];
  favorites: Track[];
  isLoading: boolean;
  toggleFavorite: (track: Track) => Promise<void>;
  deleteTrack: (track: Track) => Promise<void>;
  refreshLibrary: () => Promise<void>;
  syncLibrary: () => Promise<void>;
}

type BackendTrack = {
  id: string;
  name?: string;
  fileName?: string;
  sourceType: Track['sourceType'];
  driveFileId?: string;
  imageUrl?: string;
  artist?: string;
  title?: string;
  album?: string;
  genre?: string;
  durationSeconds?: number;
  playCount?: number;
  lyrics?: string;
};

type PlayCountedDetail = {
  trackId?: string;
  playCount?: number;
};

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

const metadataFields: Array<keyof Track> = [
  'title',
  'artist',
  'album',
  'genre',
  'imageUrl',
  'durationSeconds',
  'bitrate',
  'numberOfChannels',
  'sampleRate',
  'bitsPerSample',
  'fileFormat',
  'codec',
  'fileSize',
  'lyrics',
];

const parseTrack = (d: BackendTrack): Track => ({
  id: d.id,
  fileName: d.name || d.fileName || '',
  sourceType: d.sourceType,
  driveFileId: d.driveFileId,
  imageUrl: d.imageUrl,
  artist: d.artist,
  title: d.title,
  album: d.album,
  genre: d.genre,
  durationSeconds: d.durationSeconds,
  playCount: d.playCount ?? 0,
  lyrics: d.lyrics
});

const mergeCachedMetadata = async (track: Track): Promise<Track> => {
  const cached = await db.get<Partial<Track>>(`sonic_meta_v5_${track.id}`);
  if (!cached) return track;

  const merged = { ...track };
  for (const field of metadataFields) {
    const currentValue = merged[field];
    const cachedValue = cached[field];
    if ((currentValue === undefined || currentValue === null || currentValue === '') && cachedValue !== undefined && cachedValue !== null && cachedValue !== '') {
      (merged as Record<string, unknown>)[field] = cachedValue;
    }
  }
  return merged;
};

const enrichTracksWithCachedMetadata = (items: Track[]) => Promise.all(items.map(mergeCachedMetadata));

const dispatchLibraryRefreshed = (items: Track[]) => {
  window.dispatchEvent(new CustomEvent('music-library-refreshed', {
    detail: { trackIds: items.map((track) => track.id) }
  }));
};

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [favorites, setFavorites] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchLibrary = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      // Fetch both in parallel
      const [listData, favData] = await Promise.all([
        axiosClient.get('/api/music/list'),
        axiosClient.get('/api/favorites')
      ]);

      const parsedTracks = Array.isArray(listData) ? await enrichTracksWithCachedMetadata(listData.map(parseTrack)) : [];
      const parsedFavs = Array.isArray(favData) ? await enrichTracksWithCachedMetadata(favData.map(parseTrack)) : [];

      setTracks(parsedTracks);
      setFavorites(parsedFavs);

      await db.set('sonic_library_tracks', parsedTracks);
      await db.set('sonic_favorites', parsedFavs);
      dispatchLibraryRefreshed(parsedTracks);
    } catch (err) {
      console.error('Failed to load library', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const syncLibrary = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setIsLoading(true);
      const [listData, favData] = await Promise.all([
        axiosClient.post('/api/music/sync'),
        axiosClient.get('/api/favorites')
      ]);

      const parsedTracks = Array.isArray(listData) ? await enrichTracksWithCachedMetadata(listData.map(parseTrack)) : [];
      const parsedFavs = Array.isArray(favData) ? await enrichTracksWithCachedMetadata(favData.map(parseTrack)) : [];

      setTracks(parsedTracks);
      setFavorites(parsedFavs);

      await db.set('sonic_library_tracks', parsedTracks);
      await db.set('sonic_favorites', parsedFavs);
      dispatchLibraryRefreshed(parsedTracks);
    } catch (err) {
      console.error('Failed to sync library', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const init = async () => {
      if (isAuthenticated) {
        // Optimistic load from cache first
        try {
          const cachedTracks = await db.get<Track[]>('sonic_library_tracks');
          const cachedFavs = await db.get<Track[]>('sonic_favorites');
          if (cachedTracks) {
            const enrichedCachedTracks = await enrichTracksWithCachedMetadata(cachedTracks);
            setTracks(enrichedCachedTracks);
            void db.set('sonic_library_tracks', enrichedCachedTracks);
          }
          if (cachedFavs) {
            const enrichedCachedFavs = await enrichTracksWithCachedMetadata(cachedFavs);
            setFavorites(enrichedCachedFavs);
            void db.set('sonic_favorites', enrichedCachedFavs);
          }
        } catch (e) { console.error('Error loading from IDB', e); }

        // Fetch latest from API once
        void fetchLibrary();
      } else {
        setTracks([]);
        setFavorites([]);
        setIsLoading(false);
      }
    };
    void init();
  }, [fetchLibrary, isAuthenticated]);

  // Global listeners for background metadata and restore events
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleRestore = () => {
      void fetchLibrary();
    };

    const handleMetadataUpdated = (event: Event) => {
      const trackId = (event as CustomEvent<string>).detail;
      if (!trackId) return;

      const applyCachedMetadata = async () => {
        const metadata = await db.get<Partial<Track>>(`sonic_meta_v5_${trackId}`);
        if (!metadata) return;

        const applyToTracks = (items: Track[]) => items.map((track) => {
          if (String(track.id) !== String(trackId)) return track;
          const merged = { ...track };
          for (const field of metadataFields) {
            const cachedValue = metadata[field];
            if (cachedValue !== undefined && cachedValue !== null && cachedValue !== '') {
              (merged as Record<string, unknown>)[field] = cachedValue;
            }
          }
          return merged;
        });

        setTracks(prev => {
          const next = applyToTracks(prev);
          void db.set('sonic_library_tracks', next);
          return next;
        });
        setFavorites(prev => {
          const next = applyToTracks(prev);
          void db.set('sonic_favorites', next);
          return next;
        });
      };

      void applyCachedMetadata();
    };

    const handlePlayCounted = (event: Event) => {
      const detail = (event as CustomEvent<PlayCountedDetail>).detail;
      if (!detail?.trackId || typeof detail.playCount !== 'number') return;

      const applyPlayCount = (items: Track[]) => items.map((track) => (
        String(track.id) === String(detail.trackId)
          ? { ...track, playCount: detail.playCount }
          : track
      ));

      setTracks(prev => {
        const next = applyPlayCount(prev);
        void db.set('sonic_library_tracks', next);
        return next;
      });
      setFavorites(prev => {
        const next = applyPlayCount(prev);
        void db.set('sonic_favorites', next);
        return next;
      });
    };

    window.addEventListener('DriveConfigRestored', handleRestore);
    window.addEventListener('sonic_metadata_updated', handleMetadataUpdated);
    window.addEventListener('music-play-counted', handlePlayCounted);

    return () => {
      window.removeEventListener('DriveConfigRestored', handleRestore);
      window.removeEventListener('sonic_metadata_updated', handleMetadataUpdated);
      window.removeEventListener('music-play-counted', handlePlayCounted);
    };
  }, [fetchLibrary, isAuthenticated]);

  const toggleFavorite = useCallback(async (track: Track) => {
    if (track.sourceType === 'LOCAL') return;
    const isFav = favorites.some(f => f.id === track.id);
    
    // Optimistic UI update
    if (isFav) {
      setFavorites(prev => {
        const newFavs = prev.filter(f => f.id !== track.id);
        void db.set('sonic_favorites', newFavs);
        return newFavs;
      });
    } else {
      setFavorites(prev => {
        const newFavs = [...prev, track];
        void db.set('sonic_favorites', newFavs);
        return newFavs;
      });
    }

    try {
      if (isFav) {
        await axiosClient.delete(`/api/favorites/${track.id}`);
      } else {
        await axiosClient.post(`/api/favorites/${track.id}`);
      }
    } catch (err: unknown) {
      console.error(err);
      // Revert on error
      if (isFav) {
        setFavorites(prev => {
          const newFavs = [...prev, track];
          void db.set('sonic_favorites', newFavs);
          return newFavs;
        });
      } else {
        setFavorites(prev => {
          const newFavs = prev.filter(f => f.id !== track.id);
          void db.set('sonic_favorites', newFavs);
          return newFavs;
        });
      }
      // Suppress UI crash for duplicate rapid clicks
      const status = typeof err === 'object' && err && 'response' in err
        ? (err as { response?: { status?: number } }).response?.status
        : undefined;
      if (status !== 404 && status !== 400 && status !== 409) {
        throw err;
      }
    }
  }, [favorites]);

  const deleteTrack = useCallback(async (track: Track) => {
    if (track.sourceType === 'LOCAL') return;
    try {
      await axiosClient.delete(`/api/music/${track.id}`);
      if (track.driveFileId) void removeCachedAudio(`drive:${track.driveFileId}`);
      setTracks(prev => {
        const next = prev.filter(t => t.id !== track.id);
        void db.set('sonic_library_tracks', next);
        return next;
      });
      setFavorites(prev => {
        const next = prev.filter(t => t.id !== track.id);
        void db.set('sonic_favorites', next);
        return next;
      });
      window.dispatchEvent(new CustomEvent('music-deleted', { detail: track.id }));
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, []);

  const value = useMemo(
    () => ({ tracks, favorites, isLoading, toggleFavorite, deleteTrack, refreshLibrary: fetchLibrary, syncLibrary }),
    [tracks, favorites, isLoading, toggleFavorite, deleteTrack, fetchLibrary, syncLibrary],
  );

  return (
    <LibraryContext.Provider value={value}>
      {children}
    </LibraryContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLibrary() {
  const context = useContext(LibraryContext);
  if (context === undefined) {
    throw new Error('useLibrary must be used within a LibraryProvider');
  }
  return context;
}
