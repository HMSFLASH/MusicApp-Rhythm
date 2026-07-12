import { useCallback, useEffect, useRef } from 'react';
import { isLikelyConstrainedDevice } from './audioDevice';
import { createSilentWavUrl } from './audioGraph';
import type { Track } from './audioTypes';

type UseMediaSessionPlaybackOptions = {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  onPlay: () => void;
  onPause: () => void;
  onPreviousTrack: () => void;
  onNextTrack: () => void;
  onSeekTo: (time: number) => void;
};

export function useMediaSessionPlayback({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  onPlay,
  onPause,
  onPreviousTrack,
  onNextTrack,
  onSeekTo,
}: UseMediaSessionPlaybackOptions) {
  const mediaSessionAnchorRef = useRef<HTMLAudioElement | null>(null);
  const mediaSessionAnchorUrlRef = useRef<string | null>(null);
  const lastPositionStateRef = useRef<{ duration: number; playbackRate: number; position: number } | null>(null);
  const playRef = useRef(onPlay);
  const pauseRef = useRef(onPause);
  const previousTrackRef = useRef(onPreviousTrack);
  const nextTrackRef = useRef(onNextTrack);
  const seekToRef = useRef(onSeekTo);

  useEffect(() => {
    playRef.current = onPlay;
    pauseRef.current = onPause;
    previousTrackRef.current = onPreviousTrack;
    nextTrackRef.current = onNextTrack;
    seekToRef.current = onSeekTo;
  });

  const getMediaSessionAnchor = useCallback(() => {
    if (!mediaSessionAnchorRef.current) {
      const anchor = new Audio();
      anchor.loop = true;
      anchor.preload = 'auto';
      anchor.src = mediaSessionAnchorUrlRef.current || createSilentWavUrl();
      mediaSessionAnchorUrlRef.current = anchor.src;
      mediaSessionAnchorRef.current = anchor;
    }

    return mediaSessionAnchorRef.current;
  }, []);

  const startMediaSessionAnchor = useCallback(() => {
    if (isLikelyConstrainedDevice()) return;

    const anchor = getMediaSessionAnchor();
    if (!anchor.paused) return;
    anchor.play().catch((e) => console.warn('[MediaSession] Silent anchor playback failed', e));
  }, [getMediaSessionAnchor]);

  const pauseMediaSessionAnchor = useCallback(() => {
    const anchor = mediaSessionAnchorRef.current;
    if (!anchor) return;

    anchor.pause();
    try {
      anchor.currentTime = 0;
    } catch {
      // Some browsers reject seeks while the silent anchor is still loading.
    }
  }, []);

  const cleanupMediaSessionAnchor = useCallback(() => {
    pauseMediaSessionAnchor();
    if (mediaSessionAnchorRef.current) {
      mediaSessionAnchorRef.current.src = "";
      mediaSessionAnchorRef.current = null;
    }
    if (mediaSessionAnchorUrlRef.current) {
      URL.revokeObjectURL(mediaSessionAnchorUrlRef.current);
      mediaSessionAnchorUrlRef.current = null;
    }
  }, [pauseMediaSessionAnchor]);

  const updateMediaSessionMetadata = useCallback((track: Track | null) => {
    if (!('mediaSession' in navigator) || !track) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || (track.fileName ? track.fileName.replace(/\.[^/.]+$/, "") : 'Unknown Title'),
      artist: track.artist || (track.fileName?.includes(' - ') ? track.fileName.split(' - ')[0] : 'Unknown Artist'),
      album: track.album || 'Unknown Album',
      artwork: track.imageUrl ? [{ src: track.imageUrl, sizes: '512x512', type: 'image/jpeg' }] : []
    });
  }, []);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      if (Number.isFinite(duration) && duration > 0) {
        const safePlaybackRate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
        const safePosition = Number.isFinite(currentTime)
          ? Math.min(Math.max(currentTime, 0), duration)
          : 0;
        const lastPositionState = lastPositionStateRef.current;
        const shouldUpdatePositionState = !lastPositionState
          || lastPositionState.duration !== duration
          || lastPositionState.playbackRate !== safePlaybackRate
          || Math.abs(lastPositionState.position - safePosition) >= 0.25;

        if (!shouldUpdatePositionState) return;

        try {
          navigator.mediaSession.setPositionState({
            duration,
            playbackRate: safePlaybackRate,
            position: safePosition
          });
          lastPositionStateRef.current = {
            duration,
            playbackRate: safePlaybackRate,
            position: safePosition
          };
        } catch {
          // Some browsers reject position updates while metadata is incomplete.
        }
      }
    }
  }, [isPlaying, playbackRate, duration, currentTime]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      updateMediaSessionMetadata(currentTrack);

      navigator.mediaSession.setActionHandler('play', () => playRef.current());
      navigator.mediaSession.setActionHandler('pause', () => pauseRef.current());
      navigator.mediaSession.setActionHandler('previoustrack', () => previousTrackRef.current());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextTrackRef.current());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          seekToRef.current(details.seekTime);
        }
      });
    }
  }, [currentTrack, updateMediaSessionMetadata]);

  return {
    startMediaSessionAnchor,
    pauseMediaSessionAnchor,
    cleanupMediaSessionAnchor,
    updateMediaSessionMetadata,
  };
}
