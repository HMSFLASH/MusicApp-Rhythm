import { useEffect, useState, memo } from 'react';
import { Keyboard, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGlobalAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import { useToast } from '../context/ToastContext';
import { useSleepTimer } from '../context/SleepTimerContext';

export const KeyboardShortcutsModal = memo(function KeyboardShortcutsModal() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const { playerState } = useGlobalAudio();
  const { toggleFavorite, favorites } = useLibrary();
  const { toast } = useToast();
  const { toggleModal: toggleSleepTimerModal } = useSleepTimer();

  const {
    isPlaying, togglePlay, seek, currentTime, duration,
    volume, setVolume, isShuffle, setIsShuffle,
    songEndMode, setSongEndMode, queueEndMode, setQueueEndMode, currentTrack
  } = playerState;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable;

      if (isInput) return;

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        // Skip on mobile devices
        if (window.innerWidth < 768) return;
        e.preventDefault();
        setIsOpen(prev => !prev);
        return;
      }

      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
        toast.info(isPlaying ? t('shortcuts.toastPaused', 'Paused') : t('shortcuts.toastPlaying', 'Playing'));
        return;
      }

      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const delta = e.shiftKey ? 15 : 5;
        const target = Math.max(0, currentTime - delta);
        seek(target);
        toast.info(t('shortcuts.toastSeekBack', 'Rewind -{{delta}}s', { delta }));
        return;
      }

      if (e.code === 'ArrowRight') {
        e.preventDefault();
        const delta = e.shiftKey ? 15 : 5;
        const target = Math.min(duration, currentTime + delta);
        seek(target);
        toast.info(t('shortcuts.toastSeekForward', 'Fast forward +{{delta}}s', { delta }));
        return;
      }

      if (e.code === 'ArrowUp') {
        e.preventDefault();
        const newVol = Math.min(1, Math.round((volume + 0.05) * 100) / 100);
        setVolume(newVol);
        toast.info(t('shortcuts.toastVolume', 'Volume: {{vol}}%', { vol: Math.round(newVol * 100) }));
        return;
      }

      if (e.code === 'ArrowDown') {
        e.preventDefault();
        const newVol = Math.max(0, Math.round((volume - 0.05) * 100) / 100);
        setVolume(newVol);
        toast.info(t('shortcuts.toastVolume', 'Volume: {{vol}}%', { vol: Math.round(newVol * 100) }));
        return;
      }

      if (e.code === 'KeyM') {
        e.preventDefault();
        const newVol = volume > 0 ? 0 : 0.8;
        setVolume(newVol);
        toast.info(newVol === 0 ? t('shortcuts.toastMuted', 'Muted') : t('shortcuts.toastUnmuted', 'Volume: {{vol}}%', { vol: Math.round(newVol * 100) }));
        return;
      }

      if (e.code === 'KeyS') {
        e.preventDefault();
        setIsShuffle(!isShuffle);
        toast.info(!isShuffle ? t('shortcuts.toastShuffleOn', 'Shuffle: ON') : t('shortcuts.toastShuffleOff', 'Shuffle: OFF'));
        return;
      }

      if (e.code === 'KeyR') {
        e.preventDefault();
        if (songEndMode === 'next' && queueEndMode === 'stop') {
          setQueueEndMode('repeat');
          toast.info(t('shortcuts.toastRepeatQueue', 'Repeat: Queue'));
        } else if (songEndMode === 'next' && queueEndMode === 'repeat') {
          setSongEndMode('repeat_one');
          toast.info(t('shortcuts.toastRepeatOne', 'Repeat: 1 Track'));
        } else {
          setSongEndMode('next');
          setQueueEndMode('stop');
          toast.info(t('shortcuts.toastRepeatOff', 'Repeat: OFF'));
        }
        return;
      }

      if (e.code === 'KeyF' && currentTrack && currentTrack.sourceType !== 'LOCAL') {
        e.preventDefault();
        void toggleFavorite(currentTrack);
        const isFav = favorites.some(f => f.id === currentTrack.id);
        toast.success(isFav ? t('tracks.removedFavorite', 'Removed from Favorites') : t('tracks.addedFavorite', 'Added to Favorites'));
        return;
      }

      if (e.code === 'KeyT') {
        e.preventDefault();
        toggleSleepTimerModal();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPlaying, togglePlay, seek, currentTime, duration, volume, setVolume, isShuffle, setIsShuffle, songEndMode, setSongEndMode, queueEndMode, setQueueEndMode, currentTrack, toggleFavorite, favorites, toast, toggleSleepTimerModal, t]);

  if (!isOpen) return null;

  const shortcuts = [
    { keys: ['Space'], desc: t('shortcuts.playPause', 'Play / Pause') },
    { keys: ['←', '→'], desc: t('shortcuts.seek5s', 'Seek 5 seconds') },
    { keys: ['Shift', '← / →'], desc: t('shortcuts.seek15s', 'Fast seek 15 seconds') },
    { keys: ['↑', '↓'], desc: t('shortcuts.volumeChange', 'Volume ±5%') },
    { keys: ['M'], desc: t('shortcuts.mute', 'Mute / Unmute') },
    { keys: ['S'], desc: t('shortcuts.shuffle', 'Toggle Shuffle') },
    { keys: ['R'], desc: t('shortcuts.repeat', 'Cycle Repeat') },
    { keys: ['F'], desc: t('shortcuts.favorite', 'Toggle Favorite') },
    { keys: ['T'], desc: t('shortcuts.sleepTimer', 'Sleep Timer') },
    { keys: ['?'], desc: t('shortcuts.openModalDesc', 'Open this shortcuts cheatsheet') },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="bg-[#0c1626]/95 border border-white/[0.1] rounded-3xl w-full max-w-lg shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden animate-in zoom-in-95 duration-200 backdrop-blur-2xl flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/15 text-primary rounded-xl border border-primary/25">
              <Keyboard size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-display text-white">{t('shortcuts.modalTitle', 'Keyboard Shortcuts')}</h2>
              <p className="text-[11px] text-slate-400 font-mono">{t('shortcuts.modalSubtitle', 'Control music instantly with your keyboard')}</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-white hover:bg-white/[0.08] p-1.5 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto no-scrollbar flex flex-col gap-2.5">
          {shortcuts.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] transition-colors"
            >
              <span className="text-xs text-slate-200 font-medium">{s.desc}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                {s.keys.map((k, i) => (
                  <kbd
                    key={i}
                    className="px-2.5 py-1 text-[11px] font-mono font-bold text-primary bg-[#060b14] border border-primary/30 rounded-lg shadow-sm"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
