import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { axiosClient } from '../api/axiosClient';
import { useAuth } from './AuthContext';
import type { Track } from '../hooks/useAudioPlayer';
import { db } from '../lib/db';

interface LibraryContextType {
  tracks: Track[];
  favorites: Track[];
  isLoading: boolean;
  toggleFavorite: (track: Track) => Promise<void>;
  refreshLibrary: () => Promise<void>;
}

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
];

const parseTrack = (d: any): Track => ({
  id: d.id,
  fileName: d.name || d.fileName || '',
  sourceType: d.sourceType,
  driveFileId: d.driveFileId,
  imageUrl: d.imageUrl,
  artist: d.artist,
  title: d.title,
  album: d.album,
  genre: d.genre,
  durationSeconds: d.durationSeconds
});

const mergeCachedMetadata = async (track: Track): Promise<Track> => {
  const cached = await db.get<Partial<Track>>(`sonic_meta_${track.id}`);
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

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { jwtToken } = useAuth();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [favorites, setFavorites] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchLibrary = useCallback(async () => {
    if (!jwtToken) {
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
    } catch (err) {
      console.error('Failed to load library', err);
    } finally {
      setIsLoading(false);
    }
  }, [jwtToken]);

  useEffect(() => {
    const init = async () => {
      if (jwtToken) {
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
  }, [fetchLibrary, jwtToken]);

  // Global listeners for background metadata and restore events
  useEffect(() => {
    if (!jwtToken) return;

    const handleRestore = () => {
      void fetchLibrary();
    };

    const handleMetadataUpdated = (event: Event) => {
      const trackId = (event as CustomEvent<string | number>).detail;
      if (!trackId) return;

      const applyCachedMetadata = async () => {
        const metadata = await db.get<Partial<Track>>(`sonic_meta_${trackId}`);
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

    window.addEventListener('DriveConfigRestored', handleRestore);
    window.addEventListener('sonic_metadata_updated', handleMetadataUpdated);

    return () => {
      window.removeEventListener('DriveConfigRestored', handleRestore);
      window.removeEventListener('sonic_metadata_updated', handleMetadataUpdated);
    };
  }, [fetchLibrary, jwtToken]);

  const toggleFavorite = useCallback(async (track: Track) => {
    if (track.sourceType === 'LOCAL') return;
    const isFav = favorites.some(f => f.id === track.id);
    try {
      if (isFav) {
        await axiosClient.delete(`/api/favorites/${track.id}`);
        setFavorites(prev => {
          const newFavs = prev.filter(f => f.id !== track.id);
          void db.set('sonic_favorites', newFavs);
          return newFavs;
        });
      } else {
        await axiosClient.post(`/api/favorites/${track.id}`);
        setFavorites(prev => {
          const newFavs = [...prev, track];
          void db.set('sonic_favorites', newFavs);
          return newFavs;
        });
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, [favorites]);

  const value = useMemo(
    () => ({ tracks, favorites, isLoading, toggleFavorite, refreshLibrary: fetchLibrary }),
    [tracks, favorites, isLoading, toggleFavorite, fetchLibrary],
  );

  return (
    <LibraryContext.Provider value={value}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (context === undefined) {
    throw new Error('useLibrary must be used within a LibraryProvider');
  }
  return context;
}
