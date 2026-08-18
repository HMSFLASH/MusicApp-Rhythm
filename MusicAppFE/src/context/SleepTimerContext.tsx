import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalAudio } from './AudioContext';
import { useToast } from './ToastContext';

export type SleepTimerMode = 'off' | 'time' | 'end_of_track';

export interface SleepTimerState {
  mode: SleepTimerMode;
  targetTimestamp: number | null;
  totalDurationSeconds: number;
  remainingSeconds: number;
  fadeOut: boolean;
  isActive: boolean;
}

interface SleepTimerContextType {
  state: SleepTimerState;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  openModal: () => void;
  closeModal: () => void;
  toggleModal: () => void;
  setTimerMinutes: (minutes: number, fadeOut?: boolean) => void;
  setTimerEndOfTrack: (fadeOut?: boolean) => void;
  addMinutes: (minutes: number) => void;
  cancelTimer: () => void;
  setFadeOut: (enabled: boolean) => void;
}

const SleepTimerContext = createContext<SleepTimerContextType | undefined>(undefined);

const FADE_OUT_DURATION_SEC = 30;
const END_OF_TRACK_FADE_SEC = 15;
const STORAGE_FADEOUT_KEY = 'SONIC_SLEEP_TIMER_FADEOUT';

export function SleepTimerProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { playerState } = useGlobalAudio();
  const { isPlaying, togglePlay, volume, setVolume, currentTime, duration, currentTrack } = playerState;
  const { toast } = useToast();

  const [mode, setMode] = useState<SleepTimerMode>('off');
  const [targetTimestamp, setTargetTimestamp] = useState<number | null>(null);
  const [totalDurationSeconds, setTotalDurationSeconds] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [fadeOut, setFadeOutState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_FADEOUT_KEY);
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const baseVolumeRef = useRef<number | null>(null);
  const currentTrackIdRef = useRef<string | number | null>(currentTrack?.id ?? null);
  const initialTrackIdRef = useRef<string | number | null>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  useEffect(() => {
    currentTrackIdRef.current = currentTrack?.id ?? null;
  }, [currentTrack?.id]);

  const setFadeOut = useCallback((enabled: boolean) => {
    setFadeOutState(enabled);
    try {
      localStorage.setItem(STORAGE_FADEOUT_KEY, JSON.stringify(enabled));
    } catch {
      // ignore
    }
  }, []);

  const restoreVolume = useCallback(() => {
    if (baseVolumeRef.current !== null) {
      setVolume(baseVolumeRef.current);
      baseVolumeRef.current = null;
    }
  }, [setVolume]);

  const cancelTimer = useCallback(() => {
    restoreVolume();
    setMode('off');
    setTargetTimestamp(null);
    setTotalDurationSeconds(0);
    setRemainingSeconds(0);
    initialTrackIdRef.current = null;
  }, [restoreVolume]);

  const setTimerMinutes = useCallback((minutes: number, fadeOutOpt?: boolean) => {
    if (minutes <= 0) {
      cancelTimer();
      return;
    }
    const totalSec = Math.round(minutes * 60);
    const target = Date.now() + totalSec * 1000;
    restoreVolume();
    if (fadeOutOpt !== undefined) {
      setFadeOut(fadeOutOpt);
    }
    setTotalDurationSeconds(totalSec);
    setRemainingSeconds(totalSec);
    setTargetTimestamp(target);
    setMode('time');
    initialTrackIdRef.current = null;
  }, [cancelTimer, restoreVolume, setFadeOut]);

  const setTimerEndOfTrack = useCallback((fadeOutOpt?: boolean) => {
    restoreVolume();
    if (fadeOutOpt !== undefined) {
      setFadeOut(fadeOutOpt);
    }
    initialTrackIdRef.current = currentTrackIdRef.current;
    setMode('end_of_track');
    setTargetTimestamp(null);
    setTotalDurationSeconds(0);
    setRemainingSeconds(0);
  }, [restoreVolume, setFadeOut]);

  const addMinutes = useCallback((minutes: number) => {
    if (mode === 'time' && targetTimestamp) {
      const addedSec = minutes * 60;
      const nextTarget = targetTimestamp + addedSec * 1000;
      setTargetTimestamp(nextTarget);
      setTotalDurationSeconds(prev => prev + addedSec);
      setRemainingSeconds(prev => prev + addedSec);
      if (baseVolumeRef.current !== null) {
        restoreVolume();
      }
    } else if (mode === 'off' || mode === 'end_of_track') {
      setTimerMinutes(minutes);
    }
  }, [mode, targetTimestamp, restoreVolume, setTimerMinutes]);

  // Main countdown & fade-out loop for 'time' mode
  useEffect(() => {
    if (mode !== 'time' || !targetTimestamp) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diffMs = targetTimestamp - now;
      const leftSec = Math.max(0, Math.ceil(diffMs / 1000));
      setRemainingSeconds(leftSec);

      if (leftSec <= 0) {
        // Stop playback
        if (isPlayingRef.current) {
          togglePlay();
        }
        restoreVolume();
        setMode('off');
        setTargetTimestamp(null);
        setTotalDurationSeconds(0);
        setRemainingSeconds(0);
        toast.info(t('sleepTimer.stoppedNotification', 'Hẹn giờ tắt nhạc: Đã dừng phát nhạc'));
        return;
      }

      // Smooth Fade-out logic during last FADE_OUT_DURATION_SEC seconds
      if (fadeOut && leftSec <= FADE_OUT_DURATION_SEC) {
        if (baseVolumeRef.current === null) {
          baseVolumeRef.current = volumeRef.current;
        }
        const fadeRatio = Math.max(0, leftSec / FADE_OUT_DURATION_SEC);
        const nextVol = (baseVolumeRef.current ?? volumeRef.current) * fadeRatio;
        setVolume(Math.max(0, Math.min(1, nextVol)));
      }
    }, 500);

    return () => clearInterval(interval);
  }, [mode, targetTimestamp, fadeOut, togglePlay, restoreVolume, setVolume, t, toast]);

  // Logic for 'end_of_track' mode
  useEffect(() => {
    if (mode !== 'end_of_track') return;

    // Fade-out towards the end of current track
    if (fadeOut && duration > 0) {
      const trackRemaining = duration - currentTime;
      if (trackRemaining <= END_OF_TRACK_FADE_SEC && trackRemaining > 0) {
        if (baseVolumeRef.current === null) {
          baseVolumeRef.current = volumeRef.current;
        }
        const fadeRatio = Math.max(0, trackRemaining / END_OF_TRACK_FADE_SEC);
        const nextVol = (baseVolumeRef.current ?? volumeRef.current) * fadeRatio;
        setVolume(Math.max(0, Math.min(1, nextVol)));
      }
    }

    // Check if the track that was playing when timer was set has ended or changed
    const currentId = currentTrack?.id ?? null;
    if (initialTrackIdRef.current !== null && currentId !== null && currentId !== initialTrackIdRef.current) {
      if (isPlayingRef.current) {
        togglePlay();
      }
      restoreVolume();
      setMode('off');
      initialTrackIdRef.current = null;
      toast.info(t('sleepTimer.stoppedNotification', 'Hẹn giờ tắt nhạc: Đã hoàn tất bài hát và dừng phát nhạc'));
    }
  }, [mode, currentTrack?.id, currentTime, duration, fadeOut, restoreVolume, setVolume, t, toast, togglePlay]);

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);
  const toggleModal = useCallback(() => setIsModalOpen(prev => !prev), []);

  const state: SleepTimerState = {
    mode,
    targetTimestamp,
    totalDurationSeconds,
    remainingSeconds,
    fadeOut,
    isActive: mode !== 'off',
  };

  return (
    <SleepTimerContext.Provider
      value={{
        state,
        isModalOpen,
        setIsModalOpen,
        openModal,
        closeModal,
        toggleModal,
        setTimerMinutes,
        setTimerEndOfTrack,
        addMinutes,
        cancelTimer,
        setFadeOut,
      }}
    >
      {children}
    </SleepTimerContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSleepTimer() {
  const context = useContext(SleepTimerContext);
  if (!context) {
    throw new Error('useSleepTimer must be used within a SleepTimerProvider');
  }
  return context;
}
