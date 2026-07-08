import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { axiosClient } from '../api/axiosClient';
import { useGlobalAudio } from './AudioContext'
import { useAuth } from './AuthContext';;
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

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { jwtToken } = useGlobalAudio();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [favorites, setFavorites] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchLibrary = async () => {
    if (!jwtToken) return;
    try {
      setIsLoading(true);
      // Fetch both in parallel
      const [listData, favData] = await Promise.all([
        axiosClient.get('/api/music/list'),
        axiosClient.get('/api/favorites')
      ]);

      const parseTrack = (d: any) => ({
        id: d.id,
        fileName: d.name,
        sourceType: d.sourceType,
        imageUrl: d.imageUrl,
        artist: d.artist,
        title: d.title,
        album: d.album,
        genre: d.genre,
        durationSeconds: d.durationSeconds
      });

      const parsedTracks = Array.isArray(listData) ? listData.map(parseTrack) : [];
      const parsedFavs = Array.isArray(favData) ? favData.map(parseTrack) : [];

      setTracks(parsedTracks);
      setFavorites(parsedFavs);

      await db.set('sonic_library_tracks', parsedTracks);
      await db.set('sonic_favorites', parsedFavs);
    } catch (err) {
      console.error('Failed to load library', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      if (jwtToken) {
        // Optimistic load from cache first
        try {
          const cachedTracks = await db.get<Track[]>('sonic_library_tracks');
          const cachedFavs = await db.get<Track[]>('sonic_favorites');
          if (cachedTracks) setTracks(cachedTracks);
          if (cachedFavs) setFavorites(cachedFavs);
        } catch (e) { console.error('Error loading from IDB', e); }

        // Fetch latest from API once
        fetchLibrary();
      } else {
        setTracks([]);
        setFavorites([]);
        setIsLoading(false);
      }
    };
    init();
  }, [jwtToken]);

  // Global listeners for background metadata and restore events
  useEffect(() => {
    if (!jwtToken) return;

    const handleRestore = () => {
      fetchLibrary();
    };

    const handleMetadataUpdated = () => {
      // Simple re-trigger fetch, or we could just force re-render
      // Since it's background updated, let's fetch to get clean data
      fetchLibrary();
    };

    window.addEventListener('DriveConfigRestored', handleRestore);
    window.addEventListener('sonic_metadata_updated', handleMetadataUpdated);

    return () => {
      window.removeEventListener('DriveConfigRestored', handleRestore);
      window.removeEventListener('sonic_metadata_updated', handleMetadataUpdated);
    };
  }, [jwtToken]);

  const toggleFavorite = async (track: Track) => {
    const isFav = favorites.some(f => f.id === track.id);
    try {
      if (isFav) {
        await axiosClient.delete(`/api/favorites/${track.id}`);
        setFavorites(prev => {
          const newFavs = prev.filter(f => f.id !== track.id);
          db.set('sonic_favorites', newFavs);
          return newFavs;
        });
      } else {
        await axiosClient.post(`/api/favorites/${track.id}`);
        setFavorites(prev => {
          const newFavs = [...prev, track];
          db.set('sonic_favorites', newFavs);
          return newFavs;
        });
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  return (
    <LibraryContext.Provider value={{ tracks, favorites, isLoading, toggleFavorite, refreshLibrary: fetchLibrary }}>
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
